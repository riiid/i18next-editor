/**
 * 구글 시트 동기화 (선택 기능).
 *
 * override를 구글 시트에 직접 upsert하거나, 시트값을 override로 가져온다.
 * 시트 연동 설정(SheetsConfig)은 호스트가 주입할 때만 이 컴포넌트가 렌더된다.
 */
import {useCallback, useMemo, useState} from 'react';
import type {i18n as I18n} from 'i18next';
import {Download, ExternalLink, FileSpreadsheet, Upload} from 'lucide-react';
import {Button} from './components/ui/button';
import {SectionLabel} from './components/ui/section-label';
import {getEffectiveValue, type Overrides, setOverrideValue} from './overrides';
import type {Language, SheetsConfig} from './types';
import {computeUpsert, type Diff, getAccessToken, numCols, parseSheetRows, providedLangs, readData, sameDiffs, writeData} from './sheets';
import SheetPushPreview from './SheetPushPreview';

type Props = {
  i18n: I18n;
  languages: Language[];
  sheets: SheetsConfig;
  overrides: Overrides;
  setOverrides: (next: Overrides) => void;
  /** 시트에서 가져와 override가 통째로 바뀐 뒤 호출(선택된 키 초기화 등). */
  onAfterPull?: () => void;
  /** 결과·오류 메시지를 호스트 패널의 토스트로 띄운다(진행 상태는 버튼 라벨로 표시). */
  onStatus?: (msg: string) => void;
  /** 자체 confirm 모달. 미주입 시 window.confirm으로 폴백(스토리/단독 렌더용). */
  confirm?: (message: string, opts?: {destructive?: boolean}) => Promise<boolean>;
};

// 403 = 시트에 쓰기 권한이 없는 계정으로 인증됨. 토스트 대신 인라인으로 안내 + 시트 열기 버튼을 보여준다.
function isPermissionError(e: Error): boolean {
  return e.message.includes('(403)');
}

/** 쓰기 권한(403) 없을 때의 인라인 안내 + 시트 열기 버튼. */
export function PermissionNotice({sheetUrl}: {sheetUrl: string}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-destructive">
      <p className="m-0 font-medium">번역 시트에 쓰기 권한이 없어요.</p>
      <p className="m-0 leading-relaxed">
        지금 인증한 구글 계정에 이 시트의 편집 권한이 없습니다. 시트 소유자에게 편집 권한을 요청한 뒤 다시 시도하세요.
      </p>
      <a href={sheetUrl} target="_blank" rel="noreferrer" className="self-start">
        <Button variant="outline" size="sm">
          <ExternalLink size={14} />
          번역 시트 열기
        </Button>
      </a>
    </div>
  );
}

export default function SheetSync({i18n, languages, sheets, overrides, setOverrides, onAfterPull, onStatus, confirm}: Props) {
  const [busy, setBusy] = useState(false);
  const [permError, setPermError] = useState(false);
  const setStatus = useMemo(() => onStatus ?? (() => {}), [onStatus]);
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheets.spreadsheetId)}/edit`;
  // 403이면 권한 안내로, 그 외엔 토스트로.
  const report = useCallback(
    (e: Error) => (isPermissionError(e) ? setPermError(true) : setStatus(`실패: ${e.message}`)),
    [setStatus]
  );
  const ask = useMemo(() => confirm ?? ((msg: string) => Promise.resolve(window.confirm(msg))), [confirm]);
  const [pending, setPending] = useState<{
    token: string;
    diffs: Diff[];
    currentByKey: Record<string, Record<Language, string>>;
  } | null>(null);

  // 시트의 번역값을 읽어 override로 주입한다(base와 같은 값은 setOverrideValue가 자동으로 버림).
  const pullFromSheet = useCallback(async () => {
    if (!(await ask('시트의 번역값을 가져와 현재 override에 덮어씁니다. 진행할까요?'))) return;
    setBusy(true);
    setPermError(false);
    try {
      const token = await getAccessToken(sheets.clientId);
      const rows = await readData(token, sheets.spreadsheetId, sheets.tab, numCols(sheets.keyCol, sheets.langCol));
      let acc = overrides;
      let count = 0;
      for (const {key, lang, value} of parseSheetRows(rows, languages, sheets.keyCol, sheets.langCol)) {
        if (value === getEffectiveValue(acc, lang, key)) continue;
        acc = setOverrideValue(i18n, acc, lang, key, value);
        count += 1;
      }
      setOverrides(acc);
      onAfterPull?.();
      setStatus(`시트에서 가져옴: ${count}건 반영`);
    } catch (e) {
      report(e as Error);
    } finally {
      setBusy(false);
    }
  }, [i18n, languages, sheets, overrides, setOverrides, onAfterPull, ask, setStatus]);

  // override를 시트에 직접 반영하기 전, OAuth + 시트 읽기로 as-is→to-be diff를 계산해 confirm 모달을 띄운다.
  const previewPush = useCallback(async () => {
    if (providedLangs(overrides, languages).length === 0) {
      setStatus('반영할 override가 없습니다.');
      return;
    }
    setBusy(true);
    setPermError(false);
    try {
      const token = await getAccessToken(sheets.clientId);
      const existing = await readData(token, sheets.spreadsheetId, sheets.tab, numCols(sheets.keyCol, sheets.langCol));
      const {diffs, currentByKey} = computeUpsert(existing, overrides, languages, sheets.keyCol, sheets.langCol);
      if (diffs.length === 0) {
        setStatus('변경 사항이 없습니다 (시트와 동일).');
        return;
      }
      setPending({token, diffs, currentByKey});
    } catch (e) {
      report(e as Error);
    } finally {
      setBusy(false);
    }
  }, [languages, sheets, overrides, setStatus]);

  // confirm 후 실제 시트에 쓰기.
  const confirmPush = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    setPermError(false);
    try {
      // 낙관적 동시성: 미리보기 이후 누가 시트를 편집했는지 다시 읽어 확인한다.
      // 시트 API엔 조건부 쓰기/락이 없으므로, 적용 직전 재계산한 diff가 미리보기와 같을 때만 쓴다.
      const existing = await readData(pending.token, sheets.spreadsheetId, sheets.tab, numCols(sheets.keyCol, sheets.langCol));
      const fresh = computeUpsert(existing, overrides, languages, sheets.keyCol, sheets.langCol);
      if (!sameDiffs(pending.diffs, fresh.diffs)) {
        setStatus('미리보기 이후 시트가 변경되어 적용을 중단했습니다. "시트에 적용하기"를 다시 눌러 확인하세요.');
        setPending(null);
        return;
      }
      setStatus('시트에 반영 중...');
      await writeData(pending.token, sheets.spreadsheetId, sheets.tab, fresh.values, fresh.changedCells);
      setStatus(`반영 완료: ${fresh.diffs.length}건`);
      setPending(null);
    } catch (e) {
      report(e as Error);
    } finally {
      setBusy(false);
    }
  }, [pending, sheets, overrides, languages, setStatus]);

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel icon={FileSpreadsheet}>구글 시트 동기화</SectionLabel>
      <p className="m-0 leading-relaxed text-muted-foreground">
        지금까지 저장된 전체 변경사항을 확인하고 시트에 반영할 수 있어요. 개발자가 코드에 시트 내용을 반영해야 제품에
        최종 적용돼요.
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button disabled={busy} onClick={previewPush}>
          <Upload size={14} />
          {busy ? '처리 중...' : '시트에 적용하기'}
        </Button>
        <Button variant="outline" disabled={busy} onClick={pullFromSheet}>
          <Download size={14} />
          {busy ? '처리 중...' : '시트에서 가져오기'}
        </Button>
      </div>

      {permError && <PermissionNotice sheetUrl={sheetUrl} />}

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
