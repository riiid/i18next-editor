/**
 * override된 번역키 일괄 확인 모달 (presentational).
 *
 * 현재 적용 중인 override 전부를 key×언어 diff 표로 보여준다(asIs=레포 원본, toBe=override 값).
 * 시트 미리보기와 같은 DiffTable을 공유한다. 행마다 "되돌리기"로 그 키의 override만 해제할 수 있다.
 */
import {Button} from './components/ui/button';
import DiffTable from './DiffTable';
import type {Language} from './types';
import type {Diff} from './sheets';

type Props = {
  diffs: Diff[];
  currentByKey: Record<string, Record<Language, string>>;
  languages: Language[];
  onRevertKey: (key: string) => void;
  onClose: () => void;
};

export default function OverrideReview({diffs, currentByKey, languages, onRevertKey, onClose}: Props) {
  const keyCount = new Set(diffs.map(d => d.key)).size;
  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 p-6">
      <div className="flex max-h-[80vh] w-[min(720px,92vw)] flex-col overflow-hidden rounded-lg bg-card text-card-foreground shadow-2xl">
        <div className="bg-primary px-4 py-3 font-bold text-primary-foreground">override된 번역키 · {keyCount}건</div>
        <div className="overflow-auto px-4 py-2">
          {diffs.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">override된 번역키가 없어요.</p>
          ) : (
            <DiffTable
              diffs={diffs}
              currentByKey={currentByKey}
              languages={languages}
              rowAction={key => (
                <Button size="sm" variant="outline" onClick={() => onRevertKey(key)}>
                  되돌리기
                </Button>
              )}
            />
          )}
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
