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
```

- 테스트 러너와 린터는 설정되어 있지 않다. 변경 검증은 `npm run build`(타입 검사 포함)와 브라우저 동작 확인으로 한다.
- URL에 `?fast`를 붙이면 집중 25초 / 휴식 5초로 동작한다(`getDurations`). 수동 테스트 시 사용.
- tsconfig에 `noUnusedLocals`/`noUnusedParameters`가 켜져 있어 사용하지 않는 변수가 있으면 빌드가 실패한다.
- `vite.config.ts`의 `base: './'`는 `dist/`를 하위 경로나 정적 호스팅에 그대로 올리기 위한 설정이므로 유지한다.

## 아키텍처

### 타이머 상태 (`src/timer.ts`)
- React와 무관한 순수 함수 모음. 모든 함수는 `now`(ms)를 인자로 받으며 내부에서 `Date.now()`를 호출하지 않는다.
- `TimerState`는 `idle | running | paused` 판별 유니온이다. `running`은 남은 시간을 줄여가는 카운터가 아니라 **종료 시각 `endAt`** 을 저장하고, `paused`일 때만 `remainingMs`를 저장한다. 따라서 탭이 백그라운드에서 스로틀링돼도 시간이 밀리지 않는다.
- 한 사이클은 `집중 → 휴식 → idle`로 끝나며 자동 반복하지 않는다. `advance`는 실제 흐른 시각 기준으로 여러 단계를 한 번에 건너뛸 수 있다(다음 단계의 `endAt`은 이전 `endAt`에 이어 붙인다).

### 화면과 부수효과 (`src/App.tsx`)
- 상태를 가진 유일한 컴포넌트. `running`일 때만 250ms 인터벌과 `visibilitychange`로 `now`를 갱신하고 `advance`를 적용한다.
- 일시정지 시에는 `advance`를 먼저 적용한 뒤 `pause`한다(멈춘 사이 이미 단계가 넘어갔을 수 있으므로).
- `document.title`에 남은 시간·단계를 표시한다.
- `main.app`의 `data-phase` 속성(`focus`/`break`)이 `App.css`의 CSS 변수(`--accent`, `--bg`)를 바꿔 테마를 전환한다.

### 알림음 (`src/sound.ts`)
- 오디오 파일 없이 Web Audio로 합성한다.
- 백그라운드 탭에서는 JS 타이머가 늦게 실행되므로, 종료 시점을 감지해서 재생하는 대신 **시작/재개 시점에 미래의 종료 시각들을 AudioContext 시계에 미리 예약**한다(`scheduleEndChimes`: 집중 종료 + 휴식 종료 두 번).
- 따라서 타이머 상태를 바꾸는 모든 경로(시작·일시정지·재개·초기화)는 `cancelAll()`로 기존 예약을 취소하고 필요하면 다시 예약해야 한다. 새 전이를 추가할 때 이 규칙을 지킬 것.
- 브라우저 자동재생 정책 때문에 `ensureAudio()`는 반드시 사용자 클릭 핸들러 안에서 호출한다.
