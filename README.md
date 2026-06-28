# i18next-editor

react-i18next 앱에 끼우는 인앱 번역 편집 devtool.

- **번역키 picker** — 화면의 번역 텍스트를 클릭해 그 키의 전 언어 값을 한 패널에서 수정 (zero-width 마커 + `data-i18n-key`).
- **override** — 수정값을 `localStorage`에 덮어써 실제 화면에서 즉시 확인. 원본과 같아지면 자동 복귀.
- **Google Sheets 동기화 (선택)** — override를 시트에 upsert하거나 시트값을 가져오기. 설정을 주입할 때만 켜진다.

호스트의 i18next 인스턴스와 지원 언어를 **주입**받으므로 특정 앱에 묶이지 않는다. `base` 원본은 마운트 시점에 i18next store에서 스냅샷한다.

## 설치

```sh
pnpm add -D i18next-editor
```

peerDependencies: `react`, `react-dom`, `i18next`, `react-i18next`.

UI는 Shadow DOM 안에 격리 렌더되고 Tailwind CSS가 번들에 인라인되므로, 호스트 앱에 Tailwind 등 스타일 설정은 필요 없다.

## 사용

```tsx
import i18n from './i18n';
import {I18nEditor} from 'i18next-editor';

<I18nEditor
  i18n={i18n}
  languages={['ko', 'ja', 'en']}
  fallbackLng="en"
  // 선택: 주면 구글 시트 동기화 UI가 켜진다
  sheets={{
    clientId: '...apps.googleusercontent.com',
    spreadsheetId: '...',
    tab: 'Sheet1',
    keyCol: 0, // A열(0-based) 기준 key 컬럼
    langCol: {ko: 2, ja: 3, en: 4}, // A열(0-based) 기준 각 언어 컬럼 (A:key B:memo C:ko D:ja E:en)
  }}
/>
```

**Ctrl+Shift+D** (mac ⌘+Shift+D)로 패널을 토글한다.

### production에서 제외하기

dev 전용 도구다. 호스트가 prod 번들에서 빼야 한다(예: Next.js):

```tsx
import dynamic from 'next/dynamic';

const I18nEditor =
  process.env.NODE_ENV !== 'production'
    ? dynamic(() => import('i18next-editor').then(m => m.I18nEditor), {ssr: false})
    : () => null;
```

> 환경 변수를 **같은 모듈에서 직접** 비교해야 minifier가 dynamic import를 dead-code로 제거한다.

## 개발

```sh
pnpm build      # tsdown으로 dist 생성 (esm + d.ts)
pnpm test       # vitest
pnpm typecheck
```
