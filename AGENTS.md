# AGENTS.md

## 커밋 규칙

커밋 제목은 `{작업}({영향 범위}): {한국어 요약}` 형태로 작성한다.

- `{작업}`: `feat` / `fix` / `refactor` / `style` / `test` / `chore` / `docs` 등
- `{영향 범위}`: 변경이 닿는 영역 (`storybook`, `i18n`, `sheets`, `overrides`, `story`, `deploy` 등)
- 요약: 한국어 명령형 한 줄. 무엇을 왜 바꿨는지 드러나게.

예:
- `fix(storybook): 배경 없는 스토리 배경을 흰색으로 변경`
- `feat(i18n): 환경설정에 언어 변경(한국어/日本語/English) 추가`
- `refactor(game): 미사용 widthFactor 제거`

### 기타
- 한 커밋 = 하나의 논리적 변경. 독립적인 변경은 별개 커밋으로 쪼갠다.
- PR 머지 시 `(#번호)`는 자동 부착되므로 제목에 직접 달지 않는다.

## 코드 컨벤션

### import 경로
- `src` 하위 모듈을 참조할 때는 **절대경로(`@/*`)를 사용한다.** (`@/components/...`, `@/lib/...`)
- 상위 디렉토리로 올라가는 상대경로(`../`)는 쓰지 않는다. 같은 디렉토리 내 참조(`./`)만 상대경로를 허용한다.
- alias는 `tsconfig.json` paths + `vitest.config.ts`/`.storybook/main.ts`의 vite alias로 정의돼 있다.
