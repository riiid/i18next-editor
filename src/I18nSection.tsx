/**
 * i18n 편집 섹션.
 *
 * 1) inspect(번역키 picker): 화면의 번역 텍스트 element를 클릭하면 거기 심긴 data-i18n-key를 읽어
 *    모든 언어의 번역값을 한 패널에서 수정.
 * 2) override: 수정값을 localStorage에 덮어써 실제 화면에서 즉시 확인.
 * 3) 시트 반영(선택): override한 key만 OAuth로 구글 시트에 직접 upsert(반영 전 as-is→to-be 확인).
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import type {i18n as I18n} from 'i18next';
import {Button} from './components/ui/button';
import {Separator} from './components/ui/separator';
import {Textarea} from './components/ui/textarea';
import {keyForMarkedText, MARKER_START, setMarkerEnabled} from './marker';
import {
  forceRerender,
  getEffectiveValue,
  loadOverrides,
  type Overrides,
  resetToBase,
  setOverrideValue,
} from './overrides';
import {setupI18nEditor} from './setup';
import {getLanguage, type Language, type SheetsConfig} from './types';
import SheetSync from './SheetSync';

const ATTR = 'data-i18n-key';

/** 마커가 박힌 텍스트 노드를 훑어 부모 element에 data-i18n-key를 심는다. */
function tagMarkedNodes(i18n: I18n, root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? '';
    if (text.includes(MARKER_START)) {
      const key = keyForMarkedText(i18n, text);
      const parent = node.parentElement;
      if (key && parent) {
        parent.setAttribute(ATTR, key);
      }
    }
    node = walker.nextNode();
  }
}

function removeAllTags(): void {
  document.querySelectorAll(`[${ATTR}]`).forEach(el => {
    el.removeAttribute(ATTR);
  });
}

type Rect = {top: number; left: number; width: number; height: number};

type Props = {
  i18n: I18n;
  languages: Language[];
  fallbackLng: Language;
  sheets?: SheetsConfig;
};

export default function I18nSection({i18n, languages, fallbackLng, sheets}: Props) {
  const [inspecting, setInspecting] = useState(false);
  const [lang, setLang] = useState<Language>(() => getLanguage(i18n.language, languages, fallbackLng));
  const [overrides, setOverrides] = useState<Overrides>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<Language, string>>({});
  const [hover, setHover] = useState<Rect | null>(null);
  const [status, setStatus] = useState('');
  const inspectingRef = useRef(inspecting);
  inspectingRef.current = inspecting;

  useEffect(() => {
    // 마커 postProcessor 등록 + base 스냅샷 + 저장된 override 적용.
    setupI18nEditor(i18n, languages);
    setOverrides(loadOverrides());
  }, [i18n, languages]);

  // 현재 표시 언어를 i18next와 동기화(다른 경로로 바뀌어도 패널에 반영).
  useEffect(() => {
    const onChanged = () => setLang(getLanguage(i18n.language, languages, fallbackLng));
    i18n.on('languageChanged', onChanged);
    return () => {
      i18n.off('languageChanged', onChanged);
    };
  }, [i18n, languages, fallbackLng]);

  const changeLang = useCallback(
    (lng: Language) => {
      void i18n.changeLanguage(lng);
    },
    [i18n]
  );

  const selectKey = useCallback(
    (key: string) => {
      setSelectedKey(key);
      const next: Record<Language, string> = {};
      for (const lng of languages) {
        // i18n 내부 상태(getResource)가 아니라 override→base를 직접 읽어 입력값을 채운다.
        next[lng] = getEffectiveValue(overrides, lng, key);
      }
      setDraft(next);
    },
    [overrides, languages]
  );

  // inspect 모드: 마커 활성화 + 리렌더 + observer/리스너 부착. 끌 때 정리.
  useEffect(() => {
    if (!inspecting) return;
    setMarkerEnabled(i18n, true);
    forceRerender(i18n);

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.parentNode) {
          tagMarkedNodes(i18n, m.target.parentNode);
        }
        m.addedNodes.forEach(n => {
          tagMarkedNodes(i18n, n);
        });
      }
    });
    observer.observe(document.body, {childList: true, subtree: true, characterData: true});
    // 첫 스캔(이미 렌더된 노드).
    const initial = window.setTimeout(() => tagMarkedNodes(i18n, document.body), 0);

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest(`[${ATTR}]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setHover({top: r.top, left: r.left, width: r.width, height: r.height});
      } else {
        setHover(null);
      }
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest(`[${ATTR}]`);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const key = el.getAttribute(ATTR);
      if (key) selectKey(key);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);

    return () => {
      observer.disconnect();
      window.clearTimeout(initial);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      setMarkerEnabled(i18n, false);
      forceRerender(i18n);
      removeAllTags();
      setHover(null);
    };
  }, [inspecting, selectKey, i18n]);

  const save = useCallback(() => {
    if (!selectedKey) return;
    let acc = overrides;
    for (const lng of languages) {
      acc = setOverrideValue(i18n, acc, lng, selectedKey, draft[lng] ?? '');
    }
    setOverrides(acc);
    setStatus(`저장됨: ${selectedKey}`);
  }, [selectedKey, draft, overrides, languages, i18n]);

  const resetAll = useCallback(() => {
    resetToBase(i18n);
    setOverrides({});
    setStatus('override 초기화됨');
  }, [i18n]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* inspect 하이라이트 오버레이 */}
      {inspecting && hover && (
        <div
          className="pointer-events-none fixed z-[2147483646] rounded-sm border-2 border-ring bg-ring/10"
          style={{top: hover.top, left: hover.left, width: hover.width, height: hover.height}}
        />
      )}

      <Button variant={inspecting ? 'default' : 'outline'} className="w-full" onClick={() => setInspecting(v => !v)}>
        {inspecting ? '● 번역키 picker 끄기' : '◎ 번역키 picker 켜기'}
      </Button>

      <Separator />
      <div>
        <div className="mb-1.5 text-[11px] text-muted-foreground">표시 언어</div>
        <div className="inline-flex flex-wrap divide-x divide-input overflow-hidden rounded-md border border-input">
          {languages.map(lng => (
            <Button
              key={lng}
              size="sm"
              variant={lang === lng ? 'default' : 'ghost'}
              className="rounded-none uppercase"
              onClick={() => changeLang(lng)}>
              {lng}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {selectedKey ? (
        <div className="flex flex-col gap-1.5">
          <div className="break-all font-bold text-primary">{selectedKey}</div>
          {languages.map(lng => (
            <label key={lng} className="block">
              <span className="mb-0.5 inline-block uppercase text-muted-foreground">{lng}</span>
              <Textarea
                value={draft[lng] ?? ''}
                onChange={e => setDraft(d => ({...d, [lng]: e.target.value}))}
                rows={2}
              />
            </label>
          ))}
          <p className="m-0 leading-relaxed text-muted-foreground">변경한 값은 현재 브라우저에만 저장돼요.</p>
          <div className="flex flex-wrap gap-1.5">
            <Button onClick={save}>저장</Button>
            <Button variant="outline" onClick={() => setSelectedKey(null)}>
              닫기
            </Button>
          </div>
        </div>
      ) : (
        <p className="m-0 leading-relaxed text-muted-foreground">
          번역키 picker를 켜고 화면의 번역 텍스트를 클릭하면 여기서 모든 언어를 수정할 수 있어요.
        </p>
      )}

      {sheets && (
        <>
          <Separator />
          <SheetSync
            i18n={i18n}
            languages={languages}
            sheets={sheets}
            overrides={overrides}
            setOverrides={setOverrides}
            onAfterPull={() => setSelectedKey(null)}
          />
        </>
      )}

      <Separator />
      <Button variant="destructive" className="w-full" onClick={resetAll}>
        저장된 override값 초기화
      </Button>
      {status && <div className="break-all text-primary">{status}</div>}
    </div>
  );
}
