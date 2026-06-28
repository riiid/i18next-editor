/**
 * key×언어 diff 테이블 (presentational).
 *
 * 변경된 언어 칸은 as-is(취소선)→to-be(초록)로, 변경 안 된 언어 칸은 기존값을 회색으로 보여준다.
 * 시트 반영 미리보기(SheetPushPreview)와 override 일괄 확인(OverrideReview)이 공유한다.
 */
import type {ReactNode} from 'react';
import {Badge} from './components/ui/badge';
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
  /** 주면 key 행마다 액션 칸(예: 되돌리기 버튼)을 렌더한다. */
  rowAction?: (key: string) => ReactNode;
};

export default function DiffTable({diffs, currentByKey, languages, rowAction}: Props) {
  return (
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
          {rowAction && <th className="sticky top-0 border-b border-border bg-muted px-2 py-1.5" />}
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
            {rowAction && <td className="border-b border-border px-2 py-1.5 align-top">{rowAction(key)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
