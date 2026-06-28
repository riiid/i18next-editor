/**
 * override된 번역값이 하나라도 있을 때 화면 상단에 띄우는 경고 배너.
 *
 * - 패널의 열림 여부와 무관하게 항상 보인다(override 중임을 상기시키는 용도).
 * - override 변경(저장/초기화) 시 i18next가 languageChanged(forceRerender)를 발행하므로 그때 갱신한다.
 * - pointer-events:none 이라 클릭을 가로채지 않는다.
 */
import {useEffect, useState} from 'react';
import {css} from '@emotion/react';
import type {i18n as I18n} from 'i18next';
import {hasAnyOverride, loadOverrides} from './overrides';

export default function OverrideBanner({i18n}: {i18n: I18n}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const update = () => setActive(hasAnyOverride(loadOverrides()));
    update();
    i18n.on('languageChanged', update);
    return () => {
      i18n.off('languageChanged', update);
    };
  }, [i18n]);

  if (!active) return null;
  return <div css={bannerCss}>override된 번역키가 있어요</div>;
}

const bannerCss = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99;
  pointer-events: none;
  opacity: 0.3;
  background: red;
  color: #fff;
  text-align: center;
  font-weight: 700;
  padding: 4px 0;
`;
