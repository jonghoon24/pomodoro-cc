import { useEffect, useMemo, useState } from 'react';
import {
  IDLE,
  advance,
  formatMMSS,
  parseMinutes,
  pause,
  remainingMs,
  resume,
  start,
  toDurations,
  type Settings,
  type TimerState,
} from './timer';
import { cancelAll, ensureAudio, scheduleChime } from './sound';
import { loadSettings, saveSetting } from './settings';
import TodoList from './TodoList';

const APP_NAME = '포모도로 타이머';

const PHASE_LABEL = { focus: '집중', break: '휴식' } as const;

const FIELDS = [
  { key: 'focusMin', label: '집중 시간(분)' },
  { key: 'breakMin', label: '휴식 시간(분)' },
] as const;

type Drafts = Record<keyof Settings, string>;
type Errors = Record<keyof Settings, boolean>;

// running 상태가 될 때마다 앞으로 남은 종료 시점마다 소리를 예약한다.
function scheduleEndChimes(state: TimerState, now: number, breakMs: number) {
  cancelAll();
  if (state.status !== 'running') return;
  const untilEnd = state.endAt - now;
  scheduleChime(untilEnd);
  if (state.phase === 'focus') scheduleChime(untilEnd + breakMs);
}

export default function App() {
  const [timer, setTimer] = useState<TimerState>(IDLE);
  const [now, setNow] = useState(() => Date.now());
  const [settings, setSettings] = useState(loadSettings);
  const [drafts, setDrafts] = useState<Drafts>(() => ({
    focusMin: String(settings.focusMin),
    breakMin: String(settings.breakMin),
  }));
  const [errors, setErrors] = useState<Errors>({ focusMin: false, breakMin: false });

  const durations = useMemo(() => toDurations(settings), [settings]);
  const hasError = errors.focusMin || errors.breakMin;
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
  }, [isRunning, durations]);

  const remaining = formatMMSS(remainingMs(timer, now, durations));

  useEffect(() => {
    if (timer.status === 'idle') {
      document.title = APP_NAME;
      return;
    }
    const prefix = timer.status === 'paused' ? '⏸ ' : '';
    document.title = `${prefix}${remaining} · ${PHASE_LABEL[timer.phase]}`;
  }, [timer, remaining]);

  // 입력칸의 값을 확정한다. 유효하면 저장하고, 아니면 에러만 표시하고 직전 유효값을 유지한다.
  const commitField = (field: keyof Settings): number | null => {
    const value = parseMinutes(drafts[field]);
    setErrors((e) => ({ ...e, [field]: value === null }));
    if (value !== null) {
      setSettings((s) => ({ ...s, [field]: value }));
      saveSetting(field, value);
    }
    return value;
  };

  const handleStart = () => {
    // 시작 버튼은 mousedown에서 포커스 이동을 막으므로, 여기서 보는 에러는 누르기 전 상태다.
    // 에러 상태에서 누르면 값만 확정하고 시작하지 않는다.
    const blocked = hasError;
    const focusMin = commitField('focusMin');
    const breakMin = commitField('breakMin');
    if (blocked || focusMin === null || breakMin === null) return;

    ensureAudio();
    const d = toDurations({ focusMin, breakMin });
    const t = Date.now();
    const next = start(t, d);
    scheduleEndChimes(next, t, d.breakMs);
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
    scheduleEndChimes(next, t, durations.breakMs);
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
            <button
              type="button"
              className="primary"
              aria-disabled={hasError}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleStart}
            >
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
        {timer.status === 'idle' && (
          <div className="settings">
            {FIELDS.map(({ key, label }) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <input
                  id={key}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={drafts[key]}
                  aria-invalid={errors[key]}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  onBlur={() => commitField(key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitField(key);
                  }}
                />
                {errors[key] && (
                  <p className="error" id={`${key}-error`}>
                    1~999 사이의 정수를 입력하세요
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <TodoList />
    </main>
  );
}
