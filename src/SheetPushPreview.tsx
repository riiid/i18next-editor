/**
 * 시트 반영 미리보기 모달 (presentational).
 *
 * as-is→to-be diff를 표로 보여주고 확인/취소만 위임받는다.
 * 데이터(diffs/currentByKey)와 콜백을 주입받아 그리므로 SheetSync 없이도 단독 렌더 가능(스토리/테스트).
 */
import {FileSpreadsheet, Upload, X} from 'lucide-react';
import {Button} from './components/ui/button';
import DiffTable from './DiffTable';
import type {Language} from './types';
import type {Diff} from './sheets';


type Props = {
  diffs: Diff[];
  /** 변경되지 않은 언어 칸에 회색으로 표시할 현재값(key→lang→value). */
  currentByKey: Record<string, Record<Language, string>>;
  languages: Language[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function SheetPushPreview({diffs, currentByKey, languages, busy, onConfirm, onCancel}: Props) {
  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-6">
      <div className="flex max-h-[80vh] w-[min(720px,92vw)] flex-col overflow-hidden rounded-lg bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center gap-1.5 bg-primary px-4 py-3 font-bold text-primary-foreground">
          <FileSpreadsheet size={15} />
          시트 반영 미리보기 · {diffs.length}건
        </div>
        <div className="overflow-auto px-4 py-2">
          <DiffTable diffs={diffs} currentByKey={currentByKey} languages={languages} />
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button disabled={busy} onClick={onConfirm}>
            <Upload size={14} />
            {busy ? '반영 중...' : '확인하고 반영'}
          </Button>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            <X size={14} />
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}
