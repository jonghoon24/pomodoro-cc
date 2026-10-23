export type Todo = { id: number; text: string; done: boolean };

export const MAX_TODO_LENGTH = 100;

const KEY = 'pomodoro.todos';

// id는 화면 안에서 항목을 구분하는 용도라 저장하지 않고, 만들거나 불러올 때마다 새로 붙인다.
let lastId = 0;

export function newTodo(text: string, done = false): Todo {
  lastId += 1;
  return { id: lastId, text, done };
}

function isStoredTodo(v: unknown): v is { text: string; done: boolean } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.text === 'string' && typeof o.done === 'boolean';
}

// 저장된 값이 없거나 하나라도 깨져 있으면 빈 목록으로 시작한다.
export function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isStoredTodo)) return [];
    return parsed.map((t) => newTodo(t.text, t.done));
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)이거나 JSON이 깨진 경우
    return [];
  }
}

// 저장에 실패하면 무시한다. 목록은 현재 화면의 상태로만 유지된다.
export function saveTodos(todos: Todo[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(todos.map(({ text, done }) => ({ text, done }))));
  } catch {
    // 무시
  }
}
