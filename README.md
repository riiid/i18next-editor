# i18next-editor

react-i18next 앱에 끼우는 인앱 번역 편집 devtool입니다.

화면 위에서 번역키를 집어 전 언어 값을 고치고, 그 결과를 `localStorage`로 즉시 미리보며, (선택적으로) 구글 시트에 반영합니다. 코드/빌드 왕복 없이 번역 검수와 수정을 브라우저 안에서 끝낼 수 있습니다.

호스트의 i18next 인스턴스와 지원 언어를 **주입**받으므로 특정 앱에 묶이지 않습니다. `base` 원본은 마운트 시점에 i18next store에서 스냅샷합니다.

## 기능

### 검사 도구
- **번역키 picker** — 화면의 번역 텍스트를 클릭하면 그 키의 전 언어 값을 한 패널에서 수정합니다 (zero-width 마커 + `data-i18n-key`).
- **번역 안 된 키 확인** — 값이 비어있는 키를 화면 위에 빨간 밑줄 + 누락 언어 라벨로 표시합니다. 확인할 언어를 다중 선택할 수 있습니다.
- **키 위치 찾기** — 번역키를 부분일치로 검색해 화면에서 해당 element 위치를 하이라이트합니다.
- **번역키 이름 전부 표시** — 화면의 모든 번역 element에 키 이름을 오버레이합니다.

### 편집 / override
- **override** — 수정값을 `localStorage`에 덮어써 실제 화면에서 즉시 확인합니다. 원본과 같아지면 자동 복귀합니다.
- **override 경고 배너** — override가 하나라도 걸려 있으면 패널을 닫아도 항상 배너로 알려, 임시 값이 켜진 채 방치되는 걸 막습니다.
- **현재 UI 언어 전환** — 패널에서 바로 i18next 언어를 바꿔 각 언어 화면을 확인합니다.
- **변경 관리** — override된 키를 diff(원본→수정값)로 일괄 확인하거나 개별/전체 초기화합니다.

### Google Sheets 동기화 (선택)
- override를 시트에 **upsert**하거나 시트값을 override로 **가져옵니다**. `sheets` 설정을 주입할 때만 켜집니다.
- 시트에 쓰기 전 **as-is → to-be 미리보기**로 확인합니다.
- 적용 직전 시트를 다시 읽어, 미리보기 이후 누가 편집했으면 **동시 편집 충돌**을 감지하고 중단합니다(시트 API엔 락이 없어 낙관적 동시성으로 처리합니다).

### 패널 UX
- **Ctrl+Shift+D** (mac ⌘+Shift+D)로 토글합니다. 헤더를 잡아 드래그로 이동하고, 모서리로 크기를 조절합니다. 위치·크기는 `localStorage`에 영속됩니다.
- UI는 Shadow DOM 안에 격리 렌더되고 Tailwind CSS가 번들에 인라인되므로, 호스트 앱에 Tailwind 등 스타일 설정은 필요 없습니다.

## 설치

```sh
pnpm add -D i18next-editor
```

peerDependencies: `react` (>=18), `react-dom` (>=18), `i18next` (>=23), `react-i18next` (>=14).

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

### Props

| prop | 타입 | 설명 |
| --- | --- | --- |
| `i18n` | `i18n` | 호스트의 i18next 인스턴스. **필수** |
| `languages` | `string[]` | 지원 언어 코드 목록(예: `['ko','ja','en']`). **필수** |
| `fallbackLng` | `string` | 언어 정규화 실패 시 fallback 코드. **필수** |
| `sheets` | `SheetsConfig` | 주면 구글 시트 동기화 UI가 켜진다. |
| `defaultSize` | `{width, height}` | 패널 기본 크기(px). 미지정 시 288×420. |
| `shortcut` | `KeyCode[]` | 토글 단축키(모든 키 AND). 미지정 시 `['Mod','Shift','D']`. `'Mod'`=Ctrl/⌘. |

## production에서 제외하기

dev 전용 도구입니다. 호스트가 prod 번들에서 빼야 합니다(예: Next.js):

```tsx
import dynamic from 'next/dynamic';

const I18nEditor =
  process.env.NODE_ENV !== 'production'
    ? dynamic(() => import('i18next-editor').then(m => m.I18nEditor), {ssr: false})
    : () => null;
```

> 환경 변수를 **같은 모듈에서 직접** 비교해야 minifier가 dynamic import를 dead-code로 제거합니다.

## 개발

```sh
pnpm build      # tsdown으로 dist 생성 (esm + d.ts)
pnpm demo       # 데모 앱 실행 (vite)
pnpm storybook  # 컴포넌트 스토리북
pnpm test       # vitest
pnpm typecheck
```
