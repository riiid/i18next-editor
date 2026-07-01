/**
 * Google OAuth(GIS) + Sheets API 로 override를 스프레드시트에 직접 upsert (선택 기능).
 *
 * - 사용자가 자기 구글 계정으로 OAuth 동의(spreadsheets 스코프) 후, 그 토큰으로 시트를 수정한다.
 * - upsert 규칙: key가 있으면 해당 언어 셀만 교체, 없으면 행 추가.
 *   memo·다른 언어값·행 순서는 보존한다.
 *
 * 시트 레이아웃/계정은 호스트가 SheetsConfig로 주입한다(하드코딩 없음).
 */
import {flatten} from './paths';
import type {Language} from './types';
import type {Overrides} from './overrides';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** 0-based 컬럼 인덱스를 A1 컬럼 문자로 변환한다(0→A, 25→Z, 26→AA). */
function colLetter(idx: number): string {
  let s = '';
  for (let n = idx; n >= 0; n = Math.floor(n / 26) - 1) {
    s = String.fromCharCode((n % 26) + 65) + s;
  }
  return s;
}

type TokenResponse = {access_token?: string; expires_in?: number; error?: string; error_description?: string};
type TokenClient = {requestAccessToken: (overrides?: {prompt?: string}) => void};
type GoogleOAuth = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
        error_callback?: (err: {type?: string; message?: string}) => void;
      }) => TokenClient;
    };
  };
};
declare global {
  interface Window {
    google?: GoogleOAuth;
  }
}

let gisPromise: Promise<void> | null = null;

/** Google Identity Services 스크립트를 1회 동적 로드한다. */
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      // 실패한 promise를 캐시에 남기면 이후 모든 호출이 같은 거부를 반환해 재시도가 불가능하다.
      gisPromise = null;
      reject(new Error('Google Identity Services 로드 실패'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

// 발급받은 토큰을 메모리에 캐시해 매번 동의 팝업이 뜨지 않게 한다(탭 유지 중에만, 새로고침하면 사라짐).
let cachedToken: {value: string; expiresAt: number} | null = null;

/** OAuth 동의 팝업을 띄워 spreadsheets 스코프 access token을 얻는다(유효한 캐시가 있으면 재사용). */
export async function getAccessToken(clientId: string): Promise<string> {
  // 만료 60초 전까진 캐시 재사용. 클럭 스큐/네트워크 지연 여유.
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.value;
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity Services 사용 불가');
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SHEETS_SCOPE,
      callback: resp => {
        if (resp.access_token) {
          cachedToken = {value: resp.access_token, expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000};
          resolve(resp.access_token);
        } else reject(new Error(resp.error_description || resp.error || 'OAuth 토큰 획득 실패'));
      },
      // 사용자가 동의하지 않고 팝업을 닫으면 callback이 불리지 않으므로 여기서 reject해 버튼 로딩을 푼다.
      error_callback: err => reject(new Error(err.type === 'popup_closed' ? '인증 창이 닫혔습니다' : err.message || 'OAuth 실패')),
    });
    // prompt:'' → 이미 동의한 사용자는 동의 화면을 건너뛰고 조용히 토큰 재발급(세션 유효 시).
    client.requestAccessToken({prompt: ''});
  });
}

/** 시트명을 A1 표기로 안전하게 인용한다('Web(game)'!A2:F 처럼). */
/** 'tab'!range 형태의 A1 표기(인코딩 전). batchUpdate처럼 body에 넣는 range는 인코딩하면 안 된다. */
function sheetRange(tab: string, range: string): string {
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

export function a1(tab: string, range: string): string {
  return encodeURIComponent(sheetRange(tab, range));
}

/** 시트의 데이터 영역(A2부터 cols개 컬럼)을 2차원 문자열 배열로 읽는다. */
export async function readData(token: string, spreadsheetId: string, tab: string, cols: number): Promise<string[][]> {
  const range = `A2:${colLetter(cols - 1)}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${a1(tab, range)}?majorDimension=ROWS`;
  const res = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});
  if (!res.ok) throw new Error(`시트 읽기 실패 (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {values?: string[][]};
  return json.values ?? [];
}

/** values 기준 변경된 셀 좌표(r=0 → 시트 2행, c=0 → A열). */
export type CellRef = {r: number; c: number};

/**
 * 변경된 셀만 골라 values:batchUpdate로 부분 갱신한다(RAW, 단일 요청).
 * 변경 안 된 셀(수식·다른 언어·후행 빈 셀 포함)은 건드리지 않는다.
 */
export async function writeData(
  token: string,
  spreadsheetId: string,
  tab: string,
  values: string[][],
  changedCells: CellRef[]
): Promise<void> {
  if (changedCells.length === 0) return;
  // 빈 문자열('')은 null로 보낸다: 셀에 ''를 기록하면 ISBLANK가 false가 되므로, null로 skip해 빈 셀을 유지한다.
  const data = changedCells.map(({r, c}) => {
    const a1cell = `${colLetter(c)}${r + 2}`;
    const cell = values[r][c];
    return {range: sheetRange(tab, `${a1cell}:${a1cell}`), values: [[cell === '' ? null : cell]]};
  });
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`;
  // 셀 1개당 range 1개라 대량 push는 단일 요청 한도에 걸릴 수 있어 청크로 나눠 보낸다.
  // ponytail: 순차 전송. 처리량이 문제되면 병렬화.
  const CHUNK = 1000;
  for (let i = 0; i < data.length; i += CHUNK) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({valueInputOption: 'RAW', data: data.slice(i, i + CHUNK)}),
    });
    if (!res.ok) throw new Error(`시트 쓰기 실패 (${res.status}): ${await res.text()}`);
  }
}

// 시트 셀은 개행을 리터럴 escape("\n" 두 글자)로 보관한다(앱 문자열 관례). override/i18next는
// 실제 제어문자를 쓰므로 pull 시 되돌린다. ponytail: \n \t \r만 처리(번역값에 진짜 역슬래시는 거의 없음).
/** 시트 셀의 리터럴 escape를 실제 제어문자로 되돌린다(pull용). */
export function unescapeCell(s: string): string {
  return s.replace(/\\([ntr])/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : '\r'));
}

export type Diff = {key: string; lang: Language; asIs: string; toBe: string; isNew: boolean};

/** override에서 실제로 값이 있는(=수정한) 언어 목록. */
export function providedLangs(overrides: Overrides, languages: Language[]): Language[] {
  return languages.filter(lng => {
    const b = overrides[lng];
    return b != null && Object.keys(b).length > 0;
  });
}

/** keyCol/langCol에서 행 길이(컬럼 수)를 도출한다(최대 컬럼 인덱스 + 1). */
export function numCols(keyCol: number, langCol: Record<Language, number>): number {
  return Math.max(keyCol, ...Object.values(langCol)) + 1;
}

/**
 * 기존 시트 데이터 + override로 upsert 결과(쓸 values)와 변경 목록(diffs)을 계산한다.
 * 값이 같은 셀은 변경하지 않는다(diff/쓰기 모두 생략).
 */
export function computeUpsert(
  existing: string[][],
  overrides: Overrides,
  languages: Language[],
  keyCol: number,
  langCol: Record<Language, number>
): {
  values: string[][];
  diffs: Diff[];
  /** 변경된 셀 좌표(values 기준). batchUpdate로 이 셀들만 쓴다. */
  changedCells: CellRef[];
  /** 변경된 key별 언어별 기존(as-is) 값. 변경 안 된 언어 셀을 미리보기에 회색으로 보여주기 위함. */
  currentByKey: Record<string, Record<Language, string>>;
} {
  const cols = numCols(keyCol, langCol);
  // 각 행을 cols 길이로 패딩(Sheets는 trailing 빈 셀을 생략하므로).
  const values: string[][] = existing.map(row => {
    const r = row.slice(0, cols);
    while (r.length < cols) r.push('');
    return r;
  });
  // 변경 전 스냅샷(아래 루프에서 values를 덮어쓰므로 기존값 보존용).
  const originalValues: string[][] = values.map(r => [...r]);

  // key가 중복된 행이 있으면 모두 갱신한다(하나만 고치면 나머지가 stale로 남아 앱이 옛 값을 읽음).
  const rowsByKey: Record<string, number[]> = {};
  for (let i = 0; i < values.length; i++) {
    const k = values[i][keyCol];
    if (!k) continue;
    if (!rowsByKey[k]) rowsByKey[k] = [];
    rowsByKey[k].push(i);
  }

  const diffs: Diff[] = [];
  const changedCells: CellRef[] = [];

  for (const lang of providedLangs(overrides, languages)) {
    const colIdx = langCol[lang];
    const flat = flatten(overrides[lang]);
    for (const [key, toBe] of Object.entries(flat)) {
      const rows = rowsByKey[key];
      if (rows) {
        // diff/미리보기는 첫 행 기준(asIs), 쓰기는 값이 다른 모든 중복 행에 반영.
        const asIs = values[rows[0]][colIdx] ?? '';
        let changed = false;
        for (const idx of rows) {
          if ((values[idx][colIdx] ?? '') !== toBe) {
            values[idx][colIdx] = toBe;
            changedCells.push({r: idx, c: colIdx});
            changed = true;
          }
        }
        if (changed) diffs.push({key, lang, asIs, toBe, isNew: false});
      } else {
        const idx = values.length;
        const newRow = new Array<string>(cols).fill('');
        newRow[keyCol] = key;
        newRow[colIdx] = toBe;
        rowsByKey[key] = [idx];
        // 새 행은 key 셀과 값 셀만 쓴다(나머지 빈 셀은 건드리지 않음).
        changedCells.push({r: idx, c: keyCol}, {r: idx, c: colIdx});
        values.push(newRow);
        diffs.push({key, lang, asIs: '', toBe, isNew: true});
      }
    }
  }

  // 변경된 key마다 모든 언어의 기존값을 모은다(변경 안 된 언어 셀 표시용).
  const currentByKey: Record<string, Record<Language, string>> = {};
  for (const {key} of diffs) {
    if (key in currentByKey) continue;
    const idx = rowsByKey[key][0];
    const rec = {} as Record<Language, string>;
    for (const lng of languages) {
      rec[lng] = originalValues[idx]?.[langCol[lng]] ?? '';
    }
    currentByKey[key] = rec;
  }

  return {values, diffs, changedCells, currentByKey};
}

/**
 * 시트 행들에서 값이 있는 셀만 (key, lang, value)로 펼친다(pull용).
 * key가 빈 행, 빈/누락 셀은 건너뛴다. 적용 여부(base/override 비교)는 호출부가 판단한다.
 */
export function parseSheetRows(
  rows: string[][],
  languages: Language[],
  keyCol: number,
  langCol: Record<Language, number>
): {key: string; lang: Language; value: string}[] {
  const out: {key: string; lang: Language; value: string}[] = [];
  for (const row of rows) {
    const key = row[keyCol];
    if (!key) continue;
    for (const lang of languages) {
      const value = row[langCol[lang]];
      if (value == null || value === '') continue;
      out.push({key, lang, value: unescapeCell(value)});
    }
  }
  return out;
}

/**
 * 두 diff 목록이 (순서 무관) 동일한지 비교한다.
 * 낙관적 동시성 체크용: 미리보기 때 계산한 diff와 적용 직전 재계산한 diff가 같아야 안전하게 쓴다.
 * asIs(시트 현재값)가 달라졌거나, 새 key가 그 사이 추가/변경됐으면 시그니처가 달라져 불일치로 잡힌다.
 */
export function sameDiffs(a: Diff[], b: Diff[]): boolean {
  if (a.length !== b.length) return false;
  const sig = (d: Diff) => JSON.stringify([d.key, d.lang, d.asIs, d.toBe, d.isNew]);
  const sa = a.map(sig).sort();
  const sb = b.map(sig).sort();
  return sa.every((s, i) => s === sb[i]);
}

/** diff 목록을 key별로 묶어 [key, {lang: diff}] 배열로 반환(key는 첫 등장 순서 유지). */
export function groupDiffsByKey(diffs: Diff[]): [string, Partial<Record<Language, Diff>>][] {
  const byKey = new Map<string, Partial<Record<Language, Diff>>>();
  for (const d of diffs) {
    const g = byKey.get(d.key) ?? {};
    g[d.lang] = d;
    byKey.set(d.key, g);
  }
  return [...byKey];
}
