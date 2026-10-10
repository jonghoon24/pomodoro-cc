import { useEffect, useState } from 'react';
import {
  IDLE,
  advance,
  formatMMSS,
  getDurations,
  pause,
  remainingMs,
  resume,
  start,
  type TimerState,
} from './timer';
import { cancelAll, ensureAudio, scheduleChime } from './sound';

const APP_NAME = '포모도로 타이머';
const durations = getDurations(window.location.search);

const PHASE_LABEL = { focus: '집중', break: '휴식' } as const;

// running 상태가 될 때마다 앞으로 남은 종료 시점마다 소리를 예약한다.
function scheduleEndChimes(state: TimerState, now: number) {
  cancelAll();
  if (state.status !== 'running') return;
  const untilEnd = state.endAt - now;
  scheduleChime(untilEnd);
  if (state.phase === 'focus') scheduleChime(untilEnd + durations.breakMs);
}

export default function App() {
  const [timer, setTimer] = useState<TimerState>(IDLE);
  const [now, setNow] = useState(() => Date.now());
  const [memo, setMemo] = useState('');

  const isRunning = timer.status === 'running';

  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      setTimer((s) => advance(s, t, durations));
    };
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isRunning]);

  const remaining = formatMMSS(remainingMs(timer, now, durations));

  useEffect(() => {
    if (timer.status === 'idle') {
      document.title = APP_NAME;
      return;
    }
    const prefix = timer.status === 'paused' ? '⏸ ' : '';
    document.title = `${prefix}${remaining} · ${PHASE_LABEL[timer.phase]}`;
  }, [timer, remaining]);

  const handleStart = () => {
    ensureAudio();
    const t = Date.now();
    const next = start(t, durations);
    scheduleEndChimes(next, t);
    setNow(t);
    setTimer(next);
  };

  const handlePause = () => {
    const t = Date.now();
    cancelAll();
    setNow(t);
    setTimer(pause(advance(timer, t, durations), t));
  };

  const handleResume = () => {
    ensureAudio();
    const t = Date.now();
    const next = resume(timer, t);
    scheduleEndChimes(next, t);
    setNow(t);
    setTimer(next);
  };

  const handleReset = () => {
    cancelAll();
    setNow(Date.now());
    setTimer(IDLE);
  };

  const phase = timer.status === 'idle' ? 'focus' : timer.phase;
  const label =
    timer.status === 'idle'
      ? '집중 대기'
      : `${PHASE_LABEL[timer.phase]}${timer.status === 'paused' ? ' · 일시정지' : ' 중'}`;

  return (
    <main className="app" data-phase={phase}>
      <section className="timer">
        <p className="mode">{label}</p>
        <p className="time">{remaining}</p>
        <div className="controls">
          {timer.status === 'idle' && (
            <button type="button" className="primary" onClick={handleStart}>
              시작
            </button>
          )}
          {timer.status === 'running' && (
            <button type="button" className="primary" onClick={handlePause}>
              일시정지
            </button>
          )}
          {timer.status === 'paused' && (
            <button type="button" className="primary" onClick={handleResume}>
              계속
            </button>
          )}
          {timer.status !== 'idle' && (
            <button type="button" onClick={handleReset}>
              초기화
            </button>
          )}
        </div>
      </section>

      <section className="memo">
        <label htmlFor="memo">이번 집중에 할 일</label>
        <textarea
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="이번 집중 동안 할 일을 적어 두세요"
          rows={5}
        />
      </section>
    </main>
  );
}
