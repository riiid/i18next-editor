/**
 * i18next 번역 편집 패널.
 *
 * - 기본은 숨김. **Ctrl+Shift+D** (mac은 ⌘+Shift+D)로 표시/숨김 토글한다.
 * - 도구를 아코디언 섹션으로 나열한다.
 * - UI 전체는 ShadowHost(Shadow DOM)에 격리 렌더되어 호스트 앱 CSS와 충돌하지 않는다.
 *
 * 호스트는 prod 번들에서 이 컴포넌트를 제외할 책임이 있다(dynamic import + 환경 게이팅 권장).
 */
import {type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useRef, useState} from 'react';
import {ChevronDown, ChevronRight, X} from 'lucide-react';
import type {i18n as I18n} from 'i18next';
import ShadowHost from './lib/ShadowHost';
import I18nSection from './I18nSection';
import OverrideBanner from './OverrideBanner';
import type {Language, SheetsConfig} from './types';

type Section = {id: string; title: string; render: () => ReactNode};

export type I18nEditorProps = {
  /** 호스트의 i18next 인스턴스. */
  i18n: I18n;
  /** 지원 언어 코드 목록(예: ['ko','ja','en']). */
  languages: Language[];
  /** 누락 시 fallback 언어 코드. */
  fallbackLng: Language;
  /** 구글 시트 동기화 설정. 주면 시트 UI가 켜진다. */
  sheets?: SheetsConfig;
};

export default function I18nEditor({i18n, languages, fallbackLng, sheets}: I18nEditorProps) {
  // 새 dev tool은 여기에 추가한다.
  const SECTIONS: Section[] = [
    {
      id: 'i18n',
      title: '🌐 i18n',
      render: () => <I18nSection i18n={i18n} languages={languages} fallbackLng={fallbackLng} sheets={sheets} />,
    },
  ];
  const [visible, setVisible] = useState(false);
  // 기본으로 첫 섹션만 펼쳐둔다. 한 번에 하나만 펼친다.
  const [expanded, setExpanded] = useState<string | null>(SECTIONS[0]?.id ?? null);
  // 드래그로 옮긴 위치. null이면 기본 위치(우하단).
  const [pos, setPos] = useState<{top: number; left: number} | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setVisible(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSection = useCallback((id: string) => {
    setExpanded(cur => (cur === id ? null : id));
  }, []);

  // 헤더를 잡고 패널을 드래그한다.
  const onHeaderMouseDown = useCallback((e: ReactMouseEvent) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    // 시작 시점에 left/top 기준으로 고정(기본 우하단 → 좌표 기반 전환).
    setPos({top: rect.top, left: rect.left});

    const onMove = (ev: globalThis.MouseEvent) => {
      // 헤더 일부가 항상 화면에 남도록 살짝 clamp.
      const left = Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - 40);
      const top = Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - 24);
      setPos({top, left});
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <ShadowHost>
      {/* override 경고 배너는 패널 열림 여부와 무관하게 항상 표시 */}
      <OverrideBanner i18n={i18n} />
      {visible && (
        <div
          ref={panelRef}
          data-devtools
          className="fixed bottom-3 right-3 z-[2147483647] flex h-[420px] max-h-[90vh] min-h-[160px] w-72 min-w-[220px] max-w-[90vw] resize flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl"
          style={pos ? {top: pos.top, left: pos.left, right: 'auto', bottom: 'auto'} : undefined}>
          {/* 패널 드래그 핸들 */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: 패널 드래그 핸들 (dev 전용 도구) */}
          <div
            onMouseDown={onHeaderMouseDown}
            className="flex cursor-move select-none items-center justify-between bg-primary px-3 py-2 text-primary-foreground">
            <span className="text-xs font-bold">🛠 i18next editor</span>
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setVisible(false)}
              title="Ctrl+Shift+D"
              className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-white/20">
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {SECTIONS.map(s => {
              const isOpen = expanded === s.id;
              return (
                <div key={s.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleSection(s.id)}
                    className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                      isOpen ? 'bg-accent text-accent-foreground' : 'bg-muted/40 hover:bg-accent/60'
                    }`}>
                    <span>{s.title}</span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {isOpen && <div className="p-3">{s.render()}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ShadowHost>
  );
}
