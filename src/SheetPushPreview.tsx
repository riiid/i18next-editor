/**
 * 시트 반영 미리보기 모달 (presentational).
 *
 * as-is→to-be diff를 표로 보여주고 확인/취소만 위임받는다.
 * 데이터(diffs/currentByKey)와 콜백을 주입받아 그리므로 SheetSync 없이도 단독 렌더 가능(스토리/테스트).
 */
import {Badge} from './components/ui/badge';
import {Button} from './components/ui/button';
import type {Language} from './types';
import type {Diff} from './sheets';

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
        <div className="bg-primary px-4 py-3 font-bold text-primary-foreground">시트 반영 미리보기 · {diffs.length}건</div>
        <div className="overflow-auto px-4 py-2">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky top-0 border-b border-border bg-muted px-2 py-1.5 text-left font-medium text-muted-foreground">
                  key
                </th>
                {languages.map(lng => (
                  <th
                    key={lng}
                    className="sticky top-0 border-b border-border bg-muted px-2 py-1.5 text-left font-medium uppercase text-muted-foreground">
                    {lng}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupDiffsByKey(diffs).map(([key, langs]) => (
                <tr key={key}>
                  <td className="border-b border-border px-2 py-1.5 align-top [word-break:break-word]">
                    {key}
                    {languages.some(lng => langs[lng]?.isNew) && (
                      <Badge variant="outline" className="ml-1.5">
                        신규
                      </Badge>
                    )}
                  </td>
                  {languages.map(lng => {
                    const d = langs[lng];
                    if (d) {
                      return (
                        <td key={lng} className="border-b border-border px-2 py-1.5 align-top [word-break:break-word]">
                          <div className="text-destructive line-through">{d.asIs || '—'}</div>
                          <div className="font-semibold text-emerald-600">{d.toBe}</div>
                        </td>
                      );
                    }
                    // 변경 안 된 언어: 기존 값을 회색으로 표시(비어있으면 "(값 없음)").
                    const current = currentByKey[key]?.[lng] ?? '';
                    return (
                      <td key={lng} className="border-b border-border px-2 py-1.5 align-top [word-break:break-word]">
                        <div className="text-muted-foreground">{current || '(값 없음)'}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? '반영 중...' : '확인하고 반영'}
          </Button>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}
