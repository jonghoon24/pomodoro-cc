import { DEFAULT_SETTINGS, parseMinutes, type Settings } from './timer';

// 항목마다 키를 따로 둬서, 하나가 깨져도 그 항목만 기본값으로 돌린다.
const KEYS: Record<keyof Settings, string> = {
  focusMin: 'pomodoro.focusMin',
  breakMin: 'pomodoro.breakMin',
};

function readItem(field: keyof Settings): number {
  try {
    return parseMinutes(localStorage.getItem(KEYS[field]) ?? '') ?? DEFAULT_SETTINGS[field];
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)
    return DEFAULT_SETTINGS[field];
  }
}

export function loadSettings(): Settings {
  return { focusMin: readItem('focusMin'), breakMin: readItem('breakMin') };
}

// 저장에 실패하면 무시한다. 설정은 현재 화면의 상태로만 유지된다.
export function saveSetting(field: keyof Settings, value: number): void {
  try {
    localStorage.setItem(KEYS[field], String(value));
  } catch {
    // 무시
  }
}
