/**
 * i18n 편집 섹션.
 *
 * 1) inspect(번역키 picker): 화면의 번역 텍스트 element를 클릭하면 거기 심긴 data-i18n-key를 읽어
 *    모든 언어의 번역값을 한 패널에서 수정.
 * 2) override: 수정값을 localStorage에 덮어써 실제 화면에서 즉시 확인.
 * 3) 시트 반영(선택): override한 key만 OAuth로 구글 시트에 직접 upsert(반영 전 as-is→to-be 확인).
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {css} from '@emotion/react';
import type {i18n as I18n} from 'i18next';
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
function tagMarkedNodes(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? '';
    if (text.includes(MARKER_START)) {
      const key = keyForMarkedText(text);
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
    setMarkerEnabled(true);
    forceRerender(i18n);

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.parentNode) {
          tagMarkedNodes(m.target.parentNode);
        }
        m.addedNodes.forEach(n => {
          tagMarkedNodes(n);
        });
      }
    });
    observer.observe(document.body, {childList: true, subtree: true, characterData: true});
    // 첫 스캔(이미 렌더된 노드).
    const initial = window.setTimeout(() => tagMarkedNodes(document.body), 0);

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
      setMarkerEnabled(false);
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
    <>
      {/* inspect 하이라이트 오버레이 */}
      {inspecting && hover && (
        <div
          css={css`
            position: fixed;
            z-index: 2147483646;
            pointer-events: none;
            border: 2px solid #2f80ed;
            background: rgba(47, 128, 237, 0.12);
            border-radius: 3px;
          `}
          style={{top: hover.top, left: hover.left, width: hover.width, height: hover.height}}
        />
      )}

      <button type="button" css={inspectBtnCss(inspecting)} onClick={() => setInspecting(v => !v)}>
        {inspecting ? '● 번역키 picker 끄기' : '◎ 번역키 picker 켜기'}
      </button>

      <div css={dividerCss} />
      <div css={sectionTitleCss}>표시 언어</div>
      <div css={rowCss}>
        {languages.map(lng => (
          <button key={lng} type="button" css={langBtnCss(lang === lng)} onClick={() => changeLang(lng)}>
            {lng}
          </button>
        ))}
      </div>

      <div css={dividerCss} />

      {selectedKey ? (
        <div>
          <div css={keyLabelCss}>{selectedKey}</div>
          {languages.map(lng => (
            <label key={lng} css={fieldCss}>
              <span>{lng}</span>
              <textarea
                value={draft[lng] ?? ''}
                onChange={e => setDraft(d => ({...d, [lng]: e.target.value}))}
                rows={2}
              />
            </label>
          ))}
          <p css={hintCss}>변경한 값은 현재 브라우저에만 저장돼요.</p>
          <div css={rowCss}>
            <button type="button" css={primaryBtnCss} onClick={save}>
              저장
            </button>
            <button type="button" css={ghostBtnCss} onClick={() => setSelectedKey(null)}>
              닫기
            </button>
          </div>
        </div>
      ) : (
        <p css={hintCss}>번역키 picker를 켜고 화면의 번역 텍스트를 클릭하면 여기서 모든 언어를 수정할 수 있어요.</p>
      )}

      {sheets && (
        <>
          <div css={dividerCss} />
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

      <div css={dividerCss} />
      <button type="button" css={dangerBtnCss} onClick={resetAll}>
        저장된 override값 초기화
      </button>
      {status && <div css={statusCss}>{status}</div>}
    </>
  );
}

const inspectBtnCss = (active: boolean) => css`
  cursor: pointer;
  border: 1px solid ${active ? '#2f80ed' : '#cfcfcf'};
  background: ${active ? '#2f80ed' : '#fff'};
  color: ${active ? '#fff' : '#444'};
  border-radius: 5px;
  padding: 5px 9px;
`;
const langBtnCss = (active: boolean) => css`
  cursor: pointer;
  border: 1px solid ${active ? '#2f80ed' : '#cfcfcf'};
  background: ${active ? '#2f80ed' : '#fff'};
  color: ${active ? '#fff' : '#444'};
  border-radius: 5px;
  padding: 5px 12px;
  text-transform: uppercase;
`;
const sectionTitleCss = css`
  color: #888;
  margin-bottom: 6px;
`;
const keyLabelCss = css`
  font-weight: 700;
  word-break: break-all;
  margin-bottom: 6px;
  color: #2f80ed;
`;
const fieldCss = css`
  display: block;
  margin-bottom: 6px;
  span {
    display: inline-block;
    width: 24px;
    color: #888;
    text-transform: uppercase;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    font: inherit;
    border: 1px solid #d5d5d5;
    border-radius: 4px;
    padding: 4px 6px;
  }
`;
const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;
const primaryBtnCss = css`
  cursor: pointer;
  border: none;
  background: #2f80ed;
  color: #fff;
  border-radius: 5px;
  padding: 6px 12px;
`;
const ghostBtnCss = css`
  cursor: pointer;
  border: 1px solid #cfcfcf;
  background: #fff;
  border-radius: 5px;
  padding: 5px 9px;
`;
const dangerBtnCss = css`
  cursor: pointer;
  border: 1px solid #eab0b0;
  background: #fff;
  color: #c0392b;
  border-radius: 5px;
  padding: 5px 9px;
`;
const hintCss = css`
  color: #777;
  line-height: 1.5;
  margin: 0;
`;
const dividerCss = css`
  height: 1px;
  background: #ececec;
  margin: 10px 0;
`;
const statusCss = css`
  margin-top: 8px;
  color: #2f80ed;
  word-break: break-all;
`;
