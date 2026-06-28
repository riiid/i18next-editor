/**
 * Google OAuth(GIS) + Sheets API 로 override를 스프레드시트에 직접 upsert (선택 기능).
 *
 * - 사용자가 자기 구글 계정으로 OAuth 동의(spreadsheets 스코프) 후, 그 토큰으로 시트를 수정한다.
 * - upsert 규칙: key가 있으면 해당 언어 셀만 교체, 없으면 행 추가.
 *   A열·memo·다른 언어값·행 순서는 보존한다.
 *
 * 시트 레이아웃/계정은 호스트가 SheetsConfig로 주입한다(하드코딩 없음).
 */
import {flatten} from './paths';
import type {Language} from './types';
import type {Overrides} from './overrides';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// B열 기준 0-based 컬럼 인덱스. 기본 레이아웃: B:key C:memo D:ko E:ja F:en.
const KEY_COL = 0;
// 시트의 데이터 영역(헤더 1행 제외, B열부터 F열까지).
const READ_RANGE = 'B2:F';
const WRITE_ANCHOR = 'B2';

type TokenResponse = {access_token?: string; error?: string; error_description?: string};
type TokenClient = {requestAccessToken: (overrides?: {prompt?: string}) => void};
type GoogleOAuth = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
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
    s.onerror = () => reject(new Error('Google Identity Services 로드 실패'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** OAuth 동의 팝업을 띄워 spreadsheets 스코프 access token을 얻는다. */
export async function getAccessToken(clientId: string): Promise<string> {
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity Services 사용 불가');
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SHEETS_SCOPE,
      callback: resp => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error_description || resp.error || 'OAuth 토큰 획득 실패'));
      },
    });
    client.requestAccessToken();
  });
}

/** 시트명을 A1 표기로 안전하게 인용한다('Web(game)'!B2:F 처럼). */
function a1(tab: string, range: string): string {
  const quoted = `'${tab.replace(/'/g, "''")}'!${range}`;
  return encodeURIComponent(quoted);
}

/** 시트의 데이터 영역(B2:F)을 2차원 문자열 배열로 읽는다. */
export async function readData(token: string, spreadsheetId: string, tab: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${a1(tab, READ_RANGE)}?majorDimension=ROWS`;
  const res = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});
  if (!res.ok) throw new Error(`시트 읽기 실패 (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {values?: string[][]};
  return json.values ?? [];
}

/** values(2차원 배열)를 B2부터 한 번에 덮어쓴다(RAW). A열은 건드리지 않는다. */
export async function writeData(token: string, spreadsheetId: string, tab: string, values: string[][]): Promise<void> {
  // 빈 문자열('')을 그대로 쓰면 셀에 빈 문자열이 "값"으로 기록되어 ISBLANK가 false가 된다.
  // null로 보내면 해당 셀을 건드리지 않아(skip) 원래의 빈 셀 상태가 유지된다.
  const sanitized: (string | null)[][] = values.map(row => row.map(cell => (cell === '' ? null : cell)));
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${a1(tab, WRITE_ANCHOR)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({values: sanitized}),
  });
  if (!res.ok) throw new Error(`시트 쓰기 실패 (${res.status}): ${await res.text()}`);
}

export type Diff = {key: string; lang: Language; asIs: string; toBe: string; isNew: boolean};

/** override에서 실제로 값이 있는(=수정한) 언어 목록. */
export function providedLangs(overrides: Overrides, languages: Language[]): Language[] {
  return languages.filter(lng => {
    const b = overrides[lng];
    return b != null && Object.keys(b).length > 0;
  });
}

/** langCol에서 행 길이(컬럼 수)를 도출한다(key 0열 + 최대 언어 컬럼). */
function numCols(langCol: Record<Language, number>): number {
  return Math.max(KEY_COL, ...Object.values(langCol)) + 1;
}

/**
 * 기존 시트 데이터 + override로 upsert 결과(쓸 values)와 변경 목록(diffs)을 계산한다.
 * 값이 같은 셀은 변경하지 않는다(diff/쓰기 모두 생략).
 */
export function computeUpsert(
  existing: string[][],
  overrides: Overrides,
  languages: Language[],
  langCol: Record<Language, number>
): {
  values: string[][];
  diffs: Diff[];
  /** 변경된 key별 언어별 기존(as-is) 값. 변경 안 된 언어 셀을 미리보기에 회색으로 보여주기 위함. */
  currentByKey: Record<string, Record<Language, string>>;
} {
  const cols = numCols(langCol);
  // 각 행을 cols 길이로 패딩(Sheets는 trailing 빈 셀을 생략하므로).
  const values: string[][] = existing.map(row => {
    const r = row.slice(0, cols);
    while (r.length < cols) r.push('');
    return r;
  });
  // 변경 전 스냅샷(아래 루프에서 values를 덮어쓰므로 기존값 보존용).
  const originalValues: string[][] = values.map(r => [...r]);

  const rowByKey: Record<string, number> = {};
  for (let i = 0; i < values.length; i++) {
    const k = values[i][KEY_COL];
    if (k) rowByKey[k] = i;
  }

  const diffs: Diff[] = [];

  for (const lang of providedLangs(overrides, languages)) {
    const colIdx = langCol[lang];
    const flat = flatten(overrides[lang]);
    for (const [key, toBe] of Object.entries(flat)) {
      if (key in rowByKey) {
        const idx = rowByKey[key];
        const asIs = values[idx][colIdx] ?? '';
        if (asIs !== toBe) {
          values[idx][colIdx] = toBe;
          diffs.push({key, lang, asIs, toBe, isNew: false});
        }
      } else {
        const newRow = new Array<string>(cols).fill('');
        newRow[KEY_COL] = key;
        newRow[colIdx] = toBe;
        rowByKey[key] = values.length;
        values.push(newRow);
        diffs.push({key, lang, asIs: '', toBe, isNew: true});
      }
    }
  }

  // 변경된 key마다 모든 언어의 기존값을 모은다(변경 안 된 언어 셀 표시용).
  const currentByKey: Record<string, Record<Language, string>> = {};
  for (const {key} of diffs) {
    if (key in currentByKey) continue;
    const idx = rowByKey[key];
    const rec = {} as Record<Language, string>;
    for (const lng of languages) {
      rec[lng] = originalValues[idx]?.[langCol[lng]] ?? '';
    }
    currentByKey[key] = rec;
  }

  return {values, diffs, currentByKey};
}
