export type Phase = 'focus' | 'break';

export type TimerState =
  | { status: 'idle' }
  | { status: 'running'; phase: Phase; endAt: number }
  | { status: 'paused'; phase: Phase; remainingMs: number };

export interface Durations {
  focusMs: number;
  breakMs: number;
}

export interface Settings {
  focusMin: number;
  breakMin: number;
}

export const DEFAULT_SETTINGS: Settings = { focusMin: 25, breakMin: 5 };

// 1~999 사이의 정수(분)만 허용한다. 앞뒤 공백과 앞자리 0은 허용한다.
export function parseMinutes(input: string): number | null {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 999 ? n : null;
}

export function toDurations(s: Settings): Durations {
  return { focusMs: s.focusMin * 60 * 1000, breakMs: s.breakMin * 60 * 1000 };
}

export const IDLE: TimerState = { status: 'idle' };

export function start(now: number, d: Durations): TimerState {
  return { status: 'running', phase: 'focus', endAt: now + d.focusMs };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  return { status: 'paused', phase: state.phase, remainingMs: Math.max(0, state.endAt - now) };
}

export function resume(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') return state;
  return { status: 'running', phase: state.phase, endAt: now + state.remainingMs };
}

// 실제 흐른 시각을 기준으로 상태를 진행시킨다. 집중 종료 → 휴식 → 대기까지 한 번에 건너뛸 수 있다.
export function advance(state: TimerState, now: number, d: Durations): TimerState {
  let s = state;
  while (s.status === 'running' && now >= s.endAt) {
    s = s.phase === 'focus' ? { status: 'running', phase: 'break', endAt: s.endAt + d.breakMs } : IDLE;
  }
  return s;
}

export function remainingMs(state: TimerState, now: number, d: Durations): number {
  switch (state.status) {
    case 'idle':
      return d.focusMs;
    case 'running':
      return Math.max(0, state.endAt - now);
    case 'paused':
      return state.remainingMs;
  }
}

export function formatMMSS(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
