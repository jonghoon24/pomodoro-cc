# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

React 18 + TypeScript + Vite로 만든 단일 페이지 포모도로 타이머. 백엔드·라우터·상태관리 라이브러리 없이 `src/`의 파일 몇 개로 구성된다. UI 문구는 모두 한국어다.

## 명령어

```bash
npm install
npm run dev       # Vite 개발 서버
npm run build     # tsc -b 로 타입 검사 후 vite build → dist/
npm run preview   # 빌드 결과 미리보기
npm run lint      # ESLint (eslint.config.js, flat config)
npm run test:e2e  # Playwright E2E (e2e/, 개발 서버를 5174 포트로 자동 실행)
```

- 변경 검증은 `npm run lint`, `npm run build`(타입 검사 포함), `npm run test:e2e`로 한다. 단위 테스트 러너는 없다. 처음 실행할 때는 `npx playwright install chromium`이 필요하다.
- E2E 테스트는 `page.clock`으로 페이지의 `Date`·타이머를 멈춘 가짜 시계로 바꾸고 시간을 직접 흘린다. 긴 구간은 `fastForward`(사이의 타이머를 최대 한 번만 실행해 백그라운드 탭과 비슷함)로 건너뛰고, 단계 경계처럼 틱이 필요한 짧은 구간만 `runFor`를 쓴다. 수십 분을 `runFor`로 돌리면 250ms 인터벌이 수천 번 실행돼 타임아웃이 난다.
- ESLint는 `@eslint/js`·`typescript-eslint` recommended에 `react-hooks`, `react-refresh`(Vite) 규칙을 더한 구성이다(Vite react-ts 템플릿과 동일).
- 수동 테스트에서 짧은 시간이 필요하면 집중·휴식 시간을 1분으로 설정한다(예전 `?fast` 옵션은 없앴다). E2E 테스트는 각 테스트가 새 브라우저 컨텍스트에서 돌아 저장된 설정이 없으므로 기본값 25/5로 시작한다.
- tsconfig에 `noUnusedLocals`/`noUnusedParameters`가 켜져 있어 사용하지 않는 변수가 있으면 빌드가 실패한다.
- `vite.config.ts`의 `base: './'`는 `dist/`를 하위 경로나 정적 호스팅에 그대로 올리기 위한 설정이므로 유지한다.

## 아키텍처

### 타이머 상태 (`src/timer.ts`)
- React와 무관한 순수 함수 모음. 설정값 검사(`parseMinutes`: 1~999 정수, 앞뒤 공백·앞자리 0 허용)와 `toDurations`도 여기 있다. 모든 함수는 `now`(ms)를 인자로 받으며 내부에서 `Date.now()`를 호출하지 않는다.
- `TimerState`는 `idle | running | paused` 판별 유니온이다. `running`은 남은 시간을 줄여가는 카운터가 아니라 **종료 시각 `endAt`** 을 저장하고, `paused`일 때만 `remainingMs`를 저장한다. 따라서 탭이 백그라운드에서 스로틀링돼도 시간이 밀리지 않는다.
- 한 사이클은 `집중 → 휴식 → idle`로 끝나며 자동 반복하지 않는다. `advance`는 실제 흐른 시각 기준으로 여러 단계를 한 번에 건너뛸 수 있다(다음 단계의 `endAt`은 이전 `endAt`에 이어 붙인다).

### 설정 저장 (`src/settings.ts`)
- 집중·휴식 시간을 localStorage 키 두 개(`pomodoro.focusMin`, `pomodoro.breakMin`)에 따로 저장한다. 읽을 때 깨진 항목만 기본값(25/5)으로 돌린다.
- 저장소 접근은 모두 try/catch로 감싼다. 쓸 수 없는 환경에서는 설정이 App state에만 남는다.

### 화면과 부수효과 (`src/App.tsx`)
- 타이머·설정 상태를 가진다(할 일 목록 상태는 `TodoList`가 따로 가진다). `running`일 때만 250ms 인터벌과 `visibilitychange`로 `now`를 갱신하고 `advance`를 적용한다.
- 일시정지 시에는 `advance`를 먼저 적용한 뒤 `pause`한다(멈춘 사이 이미 단계가 넘어갔을 수 있으므로).
- 설정 입력칸은 대기 중에만 보이고, blur·Enter에서만 확정한다(입력 중에는 시계·에러 불변). 설정은 대기 중에만 바뀌므로 실행 중에는 현재 `settings`로 만든 `durations`를 그대로 쓴다.
- 시작 버튼은 네이티브 `disabled` 대신 `aria-disabled`를 쓰고 `onMouseDown`에서 `preventDefault`한다. 클릭해도 입력칸 blur가 먼저 일어나지 않으므로 `handleStart`가 누르기 전의 에러 상태를 보고, "에러 상태에서 고친 값은 확정만 하고 시작하지 않는다"는 스펙을 지킨다.
- `document.title`에 남은 시간·단계를 표시한다.
- `main.app`의 `data-phase` 속성(`focus`/`break`)이 `App.css`의 CSS 변수(`--accent`, `--bg`)를 바꿔 테마를 전환한다.

### 할 일 목록 (`src/todos.ts`, `src/TodoList.tsx`)
- 타이머와 독립적이라 상태를 App이 아니라 `TodoList`가 가진다. 타이머 상태·탭 제목과 서로 영향을 주지 않는다.
- localStorage 키 `pomodoro.todos` 하나에 `[{ text, done }]` JSON 배열로 저장한다(배열 순서 = 화면 순서). `id`는 화면 안 구분용이라 저장하지 않고 불러올 때 새로 붙인다. 값이 깨져 있으면(원소 하나라도) 빈 목록으로 시작한다. 저장소 접근은 설정과 같이 try/catch로 감싼다.
- 항목 메뉴(`⋯`)는 `openMenuId` 하나로 한 번에 하나만 연다. 메뉴 밖 클릭은 `document`의 capture `pointerdown`으로 닫기만 하고 기본 동작은 막지 않는다(누른 체크박스 등은 그대로 동작). 같은 `⋯` 버튼은 래퍼 안이라 무시하고 onClick 토글로 닫는다. `focusout`으로 닫지 않는 이유는 Safari가 버튼 클릭 시 포커스를 주지 않아 재클릭이 다시 열기가 되기 때문이다.
- 메뉴 항목은 `tabIndex={-1}`이고 ↑/↓로만 오간다. Tab/Esc로 닫을 때는 메뉴가 DOM에서 빠지기 전에 `⋯` 버튼으로 포커스를 먼저 옮긴다.
- 글자 수정은 `onBlur` 한 경로에서만 끝낸다. Enter는 `blur()`, Esc는 취소 플래그를 세운 뒤 `blur()`한다. 비우고 확정하면 원래 글자를 유지한다.

### 알림음 (`src/sound.ts`)
- 오디오 파일 없이 Web Audio로 합성한다.
- 백그라운드 탭에서는 JS 타이머가 늦게 실행되므로, 종료 시점을 감지해서 재생하는 대신 **시작/재개 시점에 미래의 종료 시각들을 AudioContext 시계에 미리 예약**한다(`scheduleEndChimes`: 집중 종료 + 휴식 종료 두 번).
- 따라서 타이머 상태를 바꾸는 모든 경로(시작·일시정지·재개·초기화)는 `cancelAll()`로 기존 예약을 취소하고 필요하면 다시 예약해야 한다. 새 전이를 추가할 때 이 규칙을 지킬 것.
- 브라우저 자동재생 정책 때문에 `ensureAudio()`는 반드시 사용자 클릭 핸들러 안에서 호출한다.
