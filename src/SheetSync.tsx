/**
 * 구글 시트 동기화 (선택 기능).
 *
 * override를 구글 시트에 직접 upsert하거나, 시트값을 override로 가져온다.
 * 시트 연동 설정(SheetsConfig)은 호스트가 주입할 때만 이 컴포넌트가 렌더된다.
 */
import {useCallback, useState} from 'react';
import {css} from '@emotion/react';
import type {i18n as I18n} from 'i18next';
import {getEffectiveValue, type Overrides, setOverrideValue} from './overrides';
import type {Language, SheetsConfig} from './types';
import {computeUpsert, type Diff, getAccessToken, providedLangs, readData, writeData} from './sheets';

/** diff 목록을 key별로 묶어 [key, {lang: diff}] 배열로 반환(key는 첫 등장 순서 유지). */
function groupDiffsByKey(diffs: Diff[]): [string, Partial<Record<Language, Diff>>][] {
  const byKey = new Map<string, Partial<Record<Language, Diff>>>();
  for (const d of diffs) {
    const g = byKey.get(d.key) ?? {};
    g[d.lang] = d;
    byKey.set(d.key, g);
  }
  return [...byKey];
}

type Props = {
  i18n: I18n;
  languages: Language[];
  sheets: SheetsConfig;
  overrides: Overrides;
  setOverrides: (next: Overrides) => void;
  /** 시트에서 가져와 override가 통째로 바뀐 뒤 호출(선택된 키 초기화 등). */
  onAfterPull?: () => void;
};

export default function SheetSync({i18n, languages, sheets, overrides, setOverrides, onAfterPull}: Props) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    token: string;
    values: string[][];
    diffs: Diff[];
    currentByKey: Record<string, Record<Language, string>>;
  } | null>(null);

  // 시트의 번역값을 읽어 override로 주입한다(base와 같은 값은 setOverrideValue가 자동으로 버림).
  const pullFromSheet = useCallback(async () => {
    if (!window.confirm('시트의 번역값을 가져와 현재 override에 덮어씁니다. 진행할까요?')) return;
    setBusy(true);
    setStatus('구글 인증 및 시트 읽는 중...');
    try {
      const token = await getAccessToken(sheets.clientId);
      const rows = await readData(token, sheets.spreadsheetId, sheets.tab);
      let acc = overrides;
      let count = 0;
      for (const row of rows) {
        const key = row[0];
        if (!key) continue;
        for (const lng of languages) {
          const val = row[sheets.langCol[lng]];
          if (val == null || val === '') continue;
          if (val === getEffectiveValue(acc, lng, key)) continue;
          acc = setOverrideValue(i18n, acc, lng, key, val);
          count += 1;
        }
      }
      setOverrides(acc);
      onAfterPull?.();
      setStatus(`시트에서 가져옴: ${count}건 반영`);
    } catch (e) {
      setStatus(`실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [i18n, languages, sheets, overrides, setOverrides, onAfterPull]);

  // override를 시트에 직접 반영하기 전, OAuth + 시트 읽기로 as-is→to-be diff를 계산해 confirm 모달을 띄운다.
  const previewPush = useCallback(async () => {
    if (providedLangs(overrides, languages).length === 0) {
      setStatus('반영할 override가 없습니다.');
      return;
    }
    setBusy(true);
    setStatus('구글 인증 및 시트 읽는 중...');
    try {
      const token = await getAccessToken(sheets.clientId);
      const existing = await readData(token, sheets.spreadsheetId, sheets.tab);
      const {values, diffs, currentByKey} = computeUpsert(existing, overrides, languages, sheets.langCol);
      if (diffs.length === 0) {
        setStatus('변경 사항이 없습니다 (시트와 동일).');
        return;
      }
      setPending({token, values, diffs, currentByKey});
      setStatus('');
    } catch (e) {
      setStatus(`실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [i18n, languages, sheets, overrides]);

  // confirm 후 실제 시트에 쓰기.
  const confirmPush = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    setStatus('시트에 반영 중...');
    try {
      await writeData(pending.token, sheets.spreadsheetId, sheets.tab, pending.values);
      setStatus(`반영 완료: ${pending.diffs.length}건`);
      setPending(null);
    } catch (e) {
      setStatus(`실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [pending, sheets]);

  return (
    <>
      <p css={hintCss}>
        지금까지 저장된 전체 변경사항을 확인하고 시트에 반영할 수 있어요. 개발자가 코드에 시트 내용을 반영해야 제품에
        최종 적용돼요.
      </p>
      <div css={rowCss}>
        <button type="button" css={primaryBtnCss} disabled={busy} onClick={previewPush}>
          {busy ? '처리 중...' : '시트에 적용하기'}
        </button>
        <button type="button" css={ghostBtnCss} disabled={busy} onClick={pullFromSheet}>
          {busy ? '처리 중...' : '시트에서 가져오기'}
        </button>
      </div>
      {status && <div css={statusCss}>{status}</div>}

      {/* as-is → to-be 미리보기 confirm 모달 */}
      {pending && (
        <div css={modalBackdropCss}>
          <div css={modalCss}>
            <div css={modalTitleCss}>시트 반영 미리보기 · {pending.diffs.length}건</div>
            <div css={modalScrollCss}>
              <table css={diffTableCss}>
                <thead>
                  <tr>
                    <th>key</th>
                    {languages.map(lng => (
                      <th key={lng}>{lng}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupDiffsByKey(pending.diffs).map(([key, langs]) => (
                    <tr key={key}>
                      <td>
                        {key}
                        {languages.some(lng => langs[lng]?.isNew) && <span css={newBadgeCss}>신규</span>}
                      </td>
                      {languages.map(lng => {
                        const d = langs[lng];
                        if (d) {
                          return (
                            <td key={lng}>
                              <div css={asIsCellCss}>{d.asIs || '—'}</div>
                              <div css={toBeCellCss}>{d.toBe}</div>
                            </td>
                          );
                        }
                        // 변경 안 된 언어: 기존 값을 회색으로 표시(비어있으면 "(값 없음)").
                        const current = pending.currentByKey[key]?.[lng] ?? '';
                        return (
                          <td key={lng}>
                            <div css={unchangedCellCss}>{current || '(값 없음)'}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div css={modalActionsCss}>
              <button type="button" css={primaryBtnCss} disabled={busy} onClick={confirmPush}>
                {busy ? '반영 중...' : '확인하고 반영'}
              </button>
              <button type="button" css={ghostBtnCss} disabled={busy} onClick={() => setPending(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;
const primaryBtnCss = css`
  cursor: pointer;
  border: none;
  background: #2f80ed;
  color: #fff;
  border-radius: 5px;
  padding: 6px 12px;
`;
const ghostBtnCss = css`
  cursor: pointer;
  border: 1px solid #cfcfcf;
  background: #fff;
  border-radius: 5px;
  padding: 5px 9px;
`;
const hintCss = css`
  color: #777;
  line-height: 1.5;
  margin: 0;
`;
const statusCss = css`
  margin-top: 8px;
  color: #2f80ed;
  word-break: break-all;
`;
const modalBackdropCss = css`
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;
const modalCss = css`
  width: min(720px, 92vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.35);
  overflow: hidden;
`;
const modalTitleCss = css`
  padding: 12px 16px;
  font-weight: 700;
  background: #2b2f36;
  color: #fff;
`;
const modalScrollCss = css`
  overflow: auto;
  padding: 8px 16px;
`;
const diffTableCss = css`
  width: 100%;
  border-collapse: collapse;
  th,
  td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
    word-break: break-word;
  }
  th {
    position: sticky;
    top: 0;
    background: #f6f7f9;
    color: #666;
  }
`;
const asIsCellCss = css`
  color: #c0392b;
  text-decoration: line-through;
`;
const toBeCellCss = css`
  color: #188038;
  font-weight: 600;
`;
const unchangedCellCss = css`
  color: #9aa0a6;
`;
const newBadgeCss = css`
  margin-left: 6px;
  font-size: 10px;
  color: #2f80ed;
  border: 1px solid #2f80ed;
  border-radius: 3px;
  padding: 0 4px;
`;
const modalActionsCss = css`
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #eee;
`;
