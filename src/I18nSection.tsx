/**
 * i18n 편집 섹션.
 *
 * 1) inspect(번역키 picker): 화면의 번역 텍스트 element를 클릭하면 거기 심긴 data-i18n-key를 읽어
 *    모든 언어의 번역값을 한 패널에서 수정.
 * 2) override: 수정값을 localStorage에 덮어써 실제 화면에서 즉시 확인.
 * 3) 시트 반영(선택): override한 key만 OAuth로 구글 시트에 직접 upsert(반영 전 as-is→to-be 확인).
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {i18n as I18n} from 'i18next';
import {ChevronDown, ChevronRight, Compass, Crosshair, Eye, Languages, ListChecks, MousePointerClick, Pencil, Save, ScanSearch, Search, Tags, Trash2, X} from 'lucide-react';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {SectionLabel} from './components/ui/section-label';
import {ToggleRow} from './components/ui/toggle-row';
import {Separator} from './components/ui/separator';
import {Textarea} from './components/ui/textarea';
import {keyForMarkedText, MARKER_START, setMarkerEnabled} from './marker';
import {
  forceRerender,
  getBaseValue,
  getEffectiveValue,
  loadOverrides,
  type Overrides,
  overrideDiffs,
  resetToBase,
  setOverrideValue,
} from './overrides';
import {setupI18nEditor} from './setup';
import {getLanguage, type Language, type SheetsConfig} from './types';
import {NUL} from './chars';
import SheetSync from './SheetSync';
import OverrideReview from './OverrideReview';
import {Toaster, useToasts} from './Toast';
import {useConfirm} from './ConfirmDialog';

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

export default function I18nSection({i18n, languages: languagesProp, fallbackLng, sheets}: Props) {
  // languages prop을 내용 기준으로 스냅샷한다. 호스트가 매 렌더 새 배열을 넘기면(특히
  // languageChanged 구독으로 리렌더하는 경우) prop identity churn이 inspect effect를
  // 재실행시키고, cleanup의 forceRerender가 또 languageChanged를 쏴 무한 루프가 된다.
  // 안정 참조로 고정해 호스트의 referential stability 여부와 무관하게 동작하게 한다.
  const languages = useMemo(() => languagesProp, [languagesProp.join(NUL)]);
  const [inspecting, setInspecting] = useState(false);
  // 미번역 키 체크 모드 + 체크 대상 언어 필터(기본: 전체 언어).
  const [checking, setChecking] = useState(false);
  const [checkLangs, setCheckLangs] = useState<Language[]>(() => languages);
  const [badges, setBadges] = useState<Array<{key: string; rect: Rect; missing: Language[]}>>([]);
  // 키 위치 찾기 모드 + 검색어(키 부분일치). 매칭된 element 좌표를 하이라이트한다.
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Array<{key: string; rect: Rect}>>([]);
  // 번역키 이름 전부 표시 모드 + 탐색 섹션 접힘 상태.
  const [showAll, setShowAll] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [lang, setLang] = useState<Language>(() => getLanguage(i18n.language, languages, fallbackLng));
  const [overrides, setOverrides] = useState<Overrides>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<Language, string>>({});
  const [hover, setHover] = useState<Rect | null>(null);
  const {toasts, push: setStatus, dismiss} = useToasts();
  const {confirm, dialog: confirmDialog} = useConfirm();
  const [reviewing, setReviewing] = useState(false);
  const inspectingRef = useRef(inspecting);
  inspectingRef.current = inspecting;
  const checkingRef = useRef(checking);
  checkingRef.current = checking;
  const locatingRef = useRef(locating);
  locatingRef.current = locating;
  const showAllRef = useRef(showAll);
  showAllRef.current = showAll;
  // recompute를 effect 의존성에서 빼되 최신 클로저를 쓰도록 ref로 들고 간다(마커 재토글 flicker 방지).
  const recomputeRef = useRef<() => void>(() => {});
  // 오버레이를 패널 div 바깥(shadow root)에 portal하기 위한 타겟. 마운트 후 1회 확정.
  const rootRef = useRef<HTMLDivElement>(null);
  const [portalRoot, setPortalRoot] = useState<ShadowRoot | null>(null);
  useEffect(() => {
    const r = rootRef.current?.getRootNode();
    if (r instanceof ShadowRoot) setPortalRoot(r);
  }, []);

  // 언어 목록이 바뀌면 체크 필터를 전체로 리셋.
  useEffect(() => {
    setCheckLangs(languages);
  }, [languages]);

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

  // 태깅된 element 중 체크 대상 언어에서 값이 비어있는 것을 찾아 빨간 밑줄 배지 좌표를 계산.
  const recompute = useCallback(() => {
    const out: Array<{key: string; rect: Rect; missing: Language[]}> = [];
    const found: Array<{key: string; rect: Rect}> = [];
    const q = query.trim().toLowerCase();
    document.querySelectorAll(`[${ATTR}]`).forEach(el => {
      const key = el.getAttribute(ATTR);
      if (!key) return;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const rect = {top: r.top, left: r.left, width: r.width, height: r.height};
      const missing = checkLangs.filter(lng => getEffectiveValue(overrides, lng, key).trim() === '');
      if (missing.length) out.push({key, missing, rect});
      if (showAll || (locating && q && key.toLowerCase().includes(q))) found.push({key, rect});
    });
    setBadges(out);
    setMatches(found);
  }, [overrides, checkLangs, query, showAll, locating]);
  recomputeRef.current = recompute;

  // inspect/체크 모드: 마커 활성화 + 리렌더 + observer/리스너 부착. 둘 다 꺼질 때만 정리.
  useEffect(() => {
    if (!inspecting && !checking && !locating && !showAll) return;
    setMarkerEnabled(i18n, true);
    forceRerender(i18n);

    // recompute는 querySelectorAll+getBoundingClientRect(전체 reflow)라 비싸다. DOM 변경/스크롤마다
    // 동기 실행하면 호스트 앱이 버벅이므로 rAF로 프레임당 1회만 돌게 합친다.
    let rafId = 0;
    const scheduleRecompute = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        recomputeRef.current();
      });
    };

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.parentNode) {
          tagMarkedNodes(i18n, m.target.parentNode);
        }
        m.addedNodes.forEach(n => {
          tagMarkedNodes(i18n, n);
        });
      }
      scheduleRecompute();
    });
    observer.observe(document.body, {childList: true, subtree: true, characterData: true});
    // 첫 스캔(이미 렌더된 노드).
    const initial = window.setTimeout(() => {
      tagMarkedNodes(i18n, document.body);
      recomputeRef.current();
    }, 0);

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
    // 스크롤/리사이즈로 배지 위치가 어긋나면 다시 계산(rAF로 합쳐 연속 이벤트에도 프레임당 1회).
    const onReflow = () => scheduleRecompute();
    if (inspecting) {
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('click', onClick, true);
    }
    if (checking || locating || showAll) {
      window.addEventListener('scroll', onReflow, true);
      window.addEventListener('resize', onReflow);
    }

    return () => {
      observer.disconnect();
      window.clearTimeout(initial);
      if (rafId) window.cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
      // 다른 모드가 아직 켜져 있으면 마커/태그를 유지한다.
      if (
        !inspectingRef.current &&
        !checkingRef.current &&
        !locatingRef.current &&
        !showAllRef.current
      ) {
        setMarkerEnabled(i18n, false);
        forceRerender(i18n);
        removeAllTags();
      }
      setHover(null);
      setBadges([]);
      setMatches([]);
    };
  }, [inspecting, checking, locating, showAll, selectKey, i18n]);

  // override/언어필터/검색어 변경 시 마커를 재토글하지 않고 배지·매칭만 다시 계산.
  useEffect(() => {
    if (checking || locating || showAll) recompute();
  }, [checking, locating, showAll, recompute]);

  const save = useCallback(() => {
    if (!selectedKey) return;
    try {
      let acc = overrides;
      for (const lng of languages) {
        acc = setOverrideValue(i18n, acc, lng, selectedKey, draft[lng] ?? '');
      }
      setOverrides(acc);
      setStatus(`저장됨: ${selectedKey}`);
    } catch (e) {
      setStatus(`저장 실패: ${(e as Error).message}`);
    }
  }, [selectedKey, draft, overrides, languages, i18n, setStatus]);

  const resetAll = useCallback(async () => {
    if (!(await confirm('저장된 override를 모두 초기화할까요? 아직 시트에 반영하지 않은 변경은 사라져요.', {destructive: true})))
      return;
    resetToBase(i18n);
    setOverrides({});
    setStatus('override 초기화됨');
  }, [i18n, confirm, setStatus]);

  // 한 키의 override를 모든 언어에서 해제(base값으로 되돌리면 setOverrideValue가 삭제 처리).
  const revertKey = useCallback(
    (key: string) => {
      let acc = overrides;
      for (const lng of languages) {
        acc = setOverrideValue(i18n, acc, lng, key, getBaseValue(lng, key) ?? '');
      }
      setOverrides(acc);
    },
    [overrides, languages, i18n]
  );

  // 하이라이트 오버레이. devtool 패널(z 2147483647)보다 낮은 z로 두고, 패널 div 바깥(shadow root
  // 직속)에 portal한다. 패널 안에 두면 패널이 stacking context라 z를 낮춰도 패널 위에 그려진다.
  const overlays = (
    <>
      {/* inspect 하이라이트 오버레이 */}
      {inspecting && hover && (
        <div
          className="pointer-events-none fixed z-[2147483645] rounded-sm border-2 border-ring bg-ring/10"
          style={{top: hover.top, left: hover.left, width: hover.width, height: hover.height}}
        />
      )}

      {/* 미번역 키 배지: 빨간 밑줄 + 값 없는 언어 라벨 */}
      {checking &&
        badges.map(b => (
          <div key={`${b.key}@${b.rect.top},${b.rect.left}`} className="contents pointer-events-none">
            <div
              className="fixed z-[2147483645] border-b-2 border-red-500"
              style={{top: b.rect.top, left: b.rect.left, width: b.rect.width, height: b.rect.height}}
            />
            <div
              className="fixed z-[2147483646] whitespace-nowrap rounded-sm bg-red-500 px-1 text-[9px] font-bold uppercase leading-tight text-white"
              style={{top: b.rect.top + b.rect.height, left: b.rect.left}}>
              {b.missing.join(', ')}
            </div>
          </div>
        ))}

      {/* 키 위치 찾기 / 전부 표시: 매칭 element를 노란 박스 + 키 라벨로 하이라이트 */}
      {(locating || showAll) &&
        matches.map(m => (
          <div key={`${m.key}@${m.rect.top},${m.rect.left}`} className="contents pointer-events-none">
            <div
              className="fixed z-[2147483645] rounded-sm border-2 border-amber-500 bg-amber-400/20"
              style={{top: m.rect.top, left: m.rect.left, width: m.rect.width, height: m.rect.height}}
            />
            <div
              className="fixed z-[2147483646] max-w-[40vw] truncate rounded-sm bg-amber-500 px-1 text-[9px] font-bold leading-tight text-white"
              style={{top: Math.max(0, m.rect.top - 12), left: m.rect.left}}>
              {m.key}
            </div>
          </div>
        ))}
    </>
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-2.5">
      {portalRoot ? createPortal(overlays, portalRoot) : overlays}

      <SectionLabel icon={Search}>검사 도구</SectionLabel>
      <ToggleRow icon={MousePointerClick} label="번역키 picker" checked={inspecting} onChange={setInspecting} />
      <ToggleRow icon={ScanSearch} label="번역 안 된 키 확인" checked={checking} onChange={setChecking} />
      {checking && (
        // 검사 토글의 하위 옵션임을 드러내려 좌측 라인 + 틴트로 들여쓴다.
        <div className="-mt-1 flex flex-col gap-1.5 rounded-md bg-primary/5 py-2 pl-2">
          <div className="text-[11px] text-muted-foreground">번역 여부 확인할 언어 (다중 선택)</div>
          <div className="flex flex-wrap gap-1">
            {languages.map(lng => {
              const on = checkLangs.includes(lng);
              return (
                <Button
                  key={lng}
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  className="uppercase"
                  onClick={() =>
                    setCheckLangs(prev => (prev.includes(lng) ? prev.filter(l => l !== lng) : [...prev, lng]))
                  }>
                  {lng}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <Separator />
      {/* 탐색: 접히는 아코디언 섹션 */}
      <button
        type="button"
        onClick={() => setExploreOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground transition-colors hover:text-foreground">
        {exploreOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Compass size={13} />
        탐색
      </button>
      {exploreOpen && (
        <div className="flex flex-col gap-2.5">
          <ToggleRow icon={Crosshair} label="키 위치 찾기" checked={locating} onChange={setLocating} />
          {locating && (
            <div className="-mt-1 flex flex-col gap-1.5 rounded-md bg-primary/5 py-2 pl-2 pr-2">
              <Input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="번역키 (부분일치)"
              />
              <div className="text-[11px] text-muted-foreground">
                {query.trim() ? `${matches.length}개 위치 하이라이트` : '키를 입력하면 화면에서 위치를 표시해요.'}
              </div>
            </div>
          )}
          <ToggleRow icon={Tags} label="번역키 이름 전부 표시" checked={showAll} onChange={setShowAll} />
        </div>
      )}

      <Separator />
      <div>
        <SectionLabel icon={Languages}>현재 UI 언어</SectionLabel>
        <div className="mt-1.5" />
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

      <SectionLabel icon={Pencil}>번역 수정</SectionLabel>
      {selectedKey ? (
        <div className="flex flex-col gap-1.5">
          <div className="break-all font-bold text-primary">{selectedKey}</div>
          {languages.map(lng => (
            // biome-ignore lint/a11y/noLabelWithoutControl: 아래 Textarea를 감싸 암묵적으로 연결된다.
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
            <Button onClick={save}>
              <Save size={14} />
              저장
            </Button>
            <Button variant="outline" onClick={() => setSelectedKey(null)}>
              <X size={14} />
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
            onStatus={setStatus}
            confirm={confirm}
          />
        </>
      )}

      <Separator />
      <SectionLabel icon={ListChecks}>변경 관리</SectionLabel>
      <Button variant="outline" className="w-full" onClick={() => setReviewing(true)}>
        <Eye size={14} />
        override된 번역키 일괄 확인
      </Button>
      <Button variant="destructive" className="w-full" onClick={resetAll}>
        <Trash2 size={14} />
        저장된 override값 초기화
      </Button>
      <Toaster toasts={toasts} dismiss={dismiss} />
      {confirmDialog}

      {reviewing &&
        (() => {
          const {diffs, currentByKey} = overrideDiffs(overrides);
          return (
            <OverrideReview
              diffs={diffs}
              currentByKey={currentByKey}
              languages={languages}
              onRevertKey={revertKey}
              onClose={() => setReviewing(false)}
            />
          );
        })()}
    </div>
  );
}
