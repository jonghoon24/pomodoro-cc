// 알림 소리는 파일 없이 Web Audio로 합성한다.
// 백그라운드 탭에서는 JS 타이머가 늦게 불리므로, 종료 시각에 맞춰 오디오 시계에 미리 예약해 둔다.

const NOTES = [1046.5, 1318.5, 1568.0]; // C6, E6, G6
const NOTE_GAP = 0.35;
const NOTE_DECAY = 1.8;

let ctx: AudioContext | null = null;
let scheduled: GainNode[] = [];

// 브라우저 자동재생 정책 때문에 사용자 클릭 핸들러 안에서 호출해야 한다.
export function ensureAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function scheduleChime(delayMs: number): void {
  if (!ctx) return;
  const when = ctx.currentTime + Math.max(0, delayMs) / 1000;

  const out = ctx.createGain();
  out.gain.value = 0.25;
  out.connect(ctx.destination);

  NOTES.forEach((freq, i) => {
    const t = when + i * NOTE_GAP;
    const osc = ctx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = ctx!.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + NOTE_DECAY);

    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + NOTE_DECAY);
  });

  scheduled.push(out);
}

export function cancelAll(): void {
  for (const node of scheduled) node.disconnect();
  scheduled = [];
}
