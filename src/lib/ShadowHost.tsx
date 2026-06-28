/**
 * devtool UI 전체를 Shadow DOM 안에 격리해 렌더한다.
 *
 * - 호스트 앱 CSS가 패널로 새어들어오거나(상속 속성 제외), 패널 CSS가 호스트로 새는 걸 차단.
 * - 컴파일된 Tailwind CSS(generated)를 shadow root 에 adoptedStyleSheets 로 주입.
 * - children 은 호스트 React 트리의 context 를 유지한 채 portal 로 shadow 안에 렌더된다.
 */
import {type ReactNode, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styles from '../generated/styles';

// @property 규칙은 shadow root 의 adoptedStyleSheets 안에서는 등록되지 않고(전역 등록만 유효),
// 등록이 없으면 Tailwind v4 의 var(--tw-border-style) 등이 무효가 되어 테두리/링/그림자가 깨진다.
// → @property 선언만 뽑아 document 에 1회 전역 등록한다(--tw-* 네임스페이스라 호스트 영향 없음).
let propsInstalled = false;
function installGlobalTailwindProperties() {
  if (propsInstalled || typeof document === 'undefined') return;
  propsInstalled = true;
  const props = styles.match(/@property[^{]+\{[^}]*\}/g);
  if (!props) return;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(props.join(''));
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

export default function ShadowHost({children}: {children: ReactNode}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    installGlobalTailwindProperties();
    const sr = host.shadowRoot ?? host.attachShadow({mode: 'open'});
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    sr.adoptedStyleSheets = [sheet];
    setRoot(sr);
  }, []);

  // host div 자체는 레이아웃에 영향 없음(자식은 전부 fixed, shadow 안 portal).
  return <div ref={hostRef} style={{display: 'contents'}}>{root && createPortal(children, root)}</div>;
}
