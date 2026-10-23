import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_TODO_LENGTH, loadTodos, newTodo, saveTodos, type Todo } from './todos';

type Editing = { id: number; draft: string };

// 할 일 목록은 타이머와 독립적이라 상태를 App이 아니라 여기서 가진다.
export default function TodoList() {
  const [todos, setTodos] = useState(loadTodos);
  const [draft, setDraft] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  // 메뉴는 한 번에 하나만 열리므로 열린 항목의 요소에만 ref를 붙인다.
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cancelEditRef = useRef(false);

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  useEffect(() => {
    if (openMenuId === null) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    menuRef.current?.scrollIntoView({ block: 'nearest' });

    // 메뉴 밖을 누르면 닫기만 한다. 기본 동작을 막지 않으므로 누른 곳(체크박스 등)의 동작은 그대로 일어난다.
    // 같은 ⋯ 버튼은 래퍼 안이라 여기서 무시하고, 버튼의 onClick이 토글로 닫는다.
    const onPointerDown = (e: PointerEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [openMenuId]);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const todo = newTodo(text);
    setTodos((ts) => [...ts, todo]);
    setDraft('');
    addInputRef.current?.focus();
  };

  const toggle = (id: number) => {
    setTodos((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const remove = (id: number) => {
    setOpenMenuId(null);
    setTodos((ts) => ts.filter((t) => t.id !== id));
  };

  const startEdit = (todo: Todo) => {
    setOpenMenuId(null);
    cancelEditRef.current = false;
    setEditing({ id: todo.id, draft: todo.text });
  };

  // 수정은 포커스가 빠질 때 한 곳에서만 끝낸다. Enter·Esc도 blur를 일으켜 이 경로로 온다.
  // 비우거나 공백만 남기고 확정하면 원래 글자를 유지한다.
  const finishEdit = () => {
    if (!editing) return;
    const text = editing.draft.trim();
    if (!cancelEditRef.current && text) {
      setTodos((ts) => ts.map((t) => (t.id === editing.id ? { ...t, text } : t)));
    }
    cancelEditRef.current = false;
    setEditing(null);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      cancelEditRef.current = true;
      e.currentTarget.blur();
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        items[(i + step + items.length) % items.length].focus();
        break;
      }
      case 'Escape':
        e.preventDefault();
        menuButtonRef.current?.focus();
        setOpenMenuId(null);
        break;
      case 'Tab':
        // 메뉴가 DOM에서 빠지기 전에 ⋯ 버튼으로 포커스를 옮겨 둔다.
        // Tab은 거기서 다음 칸으로 넘어가고, Shift+Tab은 ⋯ 버튼에 머문다.
        menuButtonRef.current?.focus();
        if (e.shiftKey) e.preventDefault();
        setOpenMenuId(null);
        break;
    }
  };

  return (
    <section className="todos" aria-labelledby="todos-title">
      <h2 id="todos-title">이번 집중에 할 일</h2>

      {todos.length === 0 ? (
        <p className="todo-empty">할 일을 추가해 보세요</p>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => {
            const isOpen = openMenuId === todo.id;
            const isEditing = editing?.id === todo.id;
            return (
              <li key={todo.id} className="todo" data-done={todo.done}>
                <input
                  type="checkbox"
                  id={`todo-${todo.id}`}
                  checked={todo.done}
                  onChange={() => toggle(todo.id)}
                />
                {isEditing ? (
                  <input
                    className="todo-edit"
                    type="text"
                    aria-label="할 일 수정"
                    autoComplete="off"
                    autoFocus
                    maxLength={MAX_TODO_LENGTH}
                    value={editing.draft}
                    onChange={(e) =>
                      setEditing({ id: todo.id, draft: e.target.value.slice(0, MAX_TODO_LENGTH) })
                    }
                    onBlur={finishEdit}
                    onKeyDown={handleEditKeyDown}
                  />
                ) : (
                  <label htmlFor={`todo-${todo.id}`}>{todo.text}</label>
                )}
                <div className="todo-menu" ref={isOpen ? menuWrapRef : undefined}>
                  <button
                    type="button"
                    className="todo-menu-button"
                    ref={isOpen ? menuButtonRef : undefined}
                    aria-label={`${todo.text} 메뉴`}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onClick={() => setOpenMenuId(isOpen ? null : todo.id)}
                  >
                    ⋯
                  </button>
                  {isOpen && (
                    <div className="menu" role="menu" ref={menuRef} onKeyDown={handleMenuKeyDown}>
                      <button type="button" role="menuitem" tabIndex={-1} onClick={() => startEdit(todo)}>
                        수정
                      </button>
                      <button type="button" role="menuitem" tabIndex={-1} onClick={() => remove(todo.id)}>
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form className="todo-add" onSubmit={handleAdd}>
        <input
          ref={addInputRef}
          type="text"
          aria-label="새 할 일"
          placeholder="할 일을 입력하세요"
          autoComplete="off"
          maxLength={MAX_TODO_LENGTH}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_TODO_LENGTH))}
        />
        <button type="submit" className="primary" disabled={!draft.trim()}>
          추가
        </button>
      </form>
    </section>
  );
}
