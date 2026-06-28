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

export default function ShadowHost({children}: {children: ReactNode}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const sr = host.shadowRoot ?? host.attachShadow({mode: 'open'});
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    sr.adoptedStyleSheets = [sheet];
    setRoot(sr);
  }, []);

  // host div 자체는 레이아웃에 영향 없음(자식은 전부 fixed, shadow 안 portal).
  return <div ref={hostRef} style={{display: 'contents'}}>{root && createPortal(children, root)}</div>;
}
