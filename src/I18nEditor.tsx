/**
 * i18next 번역 편집 패널.
 *
 * - 기본은 숨김. **Ctrl+Shift+D** (mac은 ⌘+Shift+D)로 표시/숨김 토글한다.
 * - i18n 편집 도구를 devtool 패널에 바로 그린다.
 * - UI 전체는 ShadowHost(Shadow DOM)에 격리 렌더되어 호스트 앱 CSS와 충돌하지 않는다.
 *
 * 호스트는 prod 번들에서 이 컴포넌트를 제외할 책임이 있다(dynamic import + 환경 게이팅 권장).
 */
import {type MouseEvent as ReactMouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Wrench, X} from 'lucide-react';
import type {i18n as I18n} from 'i18next';
import ShadowHost from './lib/ShadowHost';
import I18nSection from './I18nSection';
import OverrideBanner from './OverrideBanner';
import {type KeyCode, matchKey, type Language, type SheetsConfig} from './types';

/** 기본 토글 단축키: Ctrl+Shift+D (mac은 ⌘+Shift+D). */
const DEFAULT_SHORTCUT: KeyCode[] = ['Mod', 'Shift', 'D'];

/** 단축키 배열을 표시용 라벨로(예: "Ctrl/⌘+Shift+D"). */
const shortcutLabel = (shortcut: KeyCode[]) =>
  shortcut.map(c => (c === 'Mod' ? 'Ctrl/⌘' : c)).join('+');

const POS_KEY = 'i18n-editor-pos';
const SIZE_KEY = 'i18n-editor-size';

/** 드래그 위치를 localStorage에서 복원한다(없거나 깨졌으면 null=기본 우하단). */
function loadPos(): {top: number; left: number} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as {top: number; left: number};
    return typeof p?.top === 'number' && typeof p?.left === 'number' ? p : null;
  } catch {
    return null;
  }
}

/** 조절한 패널 크기를 localStorage에서 복원한다(없거나 깨졌으면 null=defaultSize). */
function loadSize(): {width: number; height: number} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SIZE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as {width: number; height: number};
    return typeof s?.width === 'number' && typeof s?.height === 'number' ? s : null;
  } catch {
    return null;
  }
}

export type I18nEditorProps = {
  /** 호스트의 i18next 인스턴스. */
  i18n: I18n;
  /** 지원 언어 코드 목록(예: ['ko','ja','en']). */
  languages: Language[];
  /** 누락 시 fallback 언어 코드. */
  fallbackLng: Language;
  /** 구글 시트 동기화 설정. 주면 시트 UI가 켜진다. */
  sheets?: SheetsConfig;
  /** 패널 기본 크기(px). 미지정 시 288×420. 드래그/resize는 그대로 동작. */
  defaultSize?: {width: number; height: number};
  /** 표시/숨김 토글 단축키(모든 키 AND). 미지정 시 ['Mod','Shift','D']. */
  shortcut?: KeyCode[];
};

export default function I18nEditor({
  i18n,
  languages,
  fallbackLng,
  sheets,
  defaultSize,
  shortcut = DEFAULT_SHORTCUT,
}: I18nEditorProps) {
  const [visible, setVisible] = useState(false);
  // 드래그로 옮긴 위치. null이면 기본 위치(우하단). localStorage에서 복원한다.
  const [pos, setPos] = useState<{top: number; left: number} | null>(loadPos);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcut.length > 0 && shortcut.every(code => matchKey(e, code))) {
        e.preventDefault();
        setVisible(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  // 패널이 열릴 때: 저장된 크기를 복원하고, CSS resize로 바뀐 최종 크기를 저장한다.
  // (resize는 React state를 거치지 않고 DOM을 직접 바꾸므로 ResizeObserver로 잡는다.)
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    // 크기는 style prop이 아니라 여기서만 소유한다(드래그 리렌더가 resize한 크기를 덮어쓰지 않도록).
    const init = loadSize() ?? defaultSize ?? {width: 288, height: 420};
    el.style.width = `${init.width}px`;
    el.style.height = `${init.height}px`;
    // 연속 resize는 rAF로 프레임당 1회만 저장.
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        try {
          window.localStorage.setItem(SIZE_KEY, JSON.stringify({width: el.offsetWidth, height: el.offsetHeight}));
        } catch {
          // 저장 실패는 무시(크기 영속은 부가 기능).
        }
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [visible, defaultSize]);

  // 헤더를 잡고 패널을 드래그한다.
  const onHeaderMouseDown = useCallback((e: ReactMouseEvent) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    // 시작 시점에 left/top 기준으로 고정(기본 우하단 → 좌표 기반 전환).
    setPos({top: rect.top, left: rect.left});

    let last = {top: rect.top, left: rect.left};
    const onMove = (ev: globalThis.MouseEvent) => {
      // 헤더 일부가 항상 화면에 남도록 살짝 clamp.
      const left = Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - 40);
      const top = Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - 24);
      last = {top, left};
      setPos(last);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // 드래그 종료 시점의 최종 위치만 저장(매 mousemove마다 쓰지 않음).
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(last));
      } catch {
        // 저장 실패는 무시(위치 영속은 부가 기능).
      }
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
          className="fixed bottom-3 right-3 z-[2147483647] flex max-h-[90vh] min-h-[160px] min-w-[220px] max-w-[90vw] resize flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl"
          style={pos ? {top: pos.top, left: pos.left, right: 'auto', bottom: 'auto'} : undefined}>
          {/* 패널 드래그 핸들 */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: 패널 드래그 핸들 (dev 전용 도구) */}
          <div
            onMouseDown={onHeaderMouseDown}
            className="flex cursor-move select-none items-center justify-between bg-primary px-3 py-2 text-primary-foreground">
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <Wrench size={13} /> i18next editor
            </span>
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setVisible(false)}
              title={shortcutLabel(shortcut)}
              className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-white/20">
              <X size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <I18nSection i18n={i18n} languages={languages} fallbackLng={fallbackLng} sheets={sheets} />
          </div>
        </div>
      )}
    </ShadowHost>
  );
}
