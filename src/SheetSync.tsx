/**
 * 구글 시트 동기화 (선택 기능).
 *
 * override를 구글 시트에 직접 upsert하거나, 시트값을 override로 가져온다.
 * 시트 연동 설정(SheetsConfig)은 호스트가 주입할 때만 이 컴포넌트가 렌더된다.
 */
import {useCallback, useState} from 'react';
import type {i18n as I18n} from 'i18next';
import {Button} from './components/ui/button';
import {getEffectiveValue, type Overrides, setOverrideValue} from './overrides';
import type {Language, SheetsConfig} from './types';
import {computeUpsert, type Diff, getAccessToken, numCols, providedLangs, readData, writeData} from './sheets';
import SheetPushPreview from './SheetPushPreview';

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
      const rows = await readData(token, sheets.spreadsheetId, sheets.tab, numCols(sheets.keyCol, sheets.langCol));
      let acc = overrides;
      let count = 0;
      for (const row of rows) {
        const key = row[sheets.keyCol];
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
      const existing = await readData(token, sheets.spreadsheetId, sheets.tab, numCols(sheets.keyCol, sheets.langCol));
      const {values, diffs, currentByKey} = computeUpsert(existing, overrides, languages, sheets.keyCol, sheets.langCol);
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
    <div className="flex flex-col gap-2">
      <p className="m-0 leading-relaxed text-muted-foreground">
        지금까지 저장된 전체 변경사항을 확인하고 시트에 반영할 수 있어요. 개발자가 코드에 시트 내용을 반영해야 제품에
        최종 적용돼요.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button disabled={busy} onClick={previewPush}>
          {busy ? '처리 중...' : '시트에 적용하기'}
        </Button>
        <Button variant="outline" disabled={busy} onClick={pullFromSheet}>
          {busy ? '처리 중...' : '시트에서 가져오기'}
        </Button>
      </div>
      {status && <div className="break-all text-primary">{status}</div>}

      {/* as-is → to-be 미리보기 confirm 모달 */}
      {pending && (
        <SheetPushPreview
          diffs={pending.diffs}
          currentByKey={pending.currentByKey}
          languages={languages}
          busy={busy}
          onConfirm={confirmPush}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
