import { test, expect, type Page } from '@playwright/test';

const SEC = 1000;
const MIN = 60 * SEC;

// 페이지의 Date·setInterval을 가짜 시계로 바꾸고 멈춰 둔다. 시간은 runFor/fastForward로만 흐른다.
test.beforeEach(async ({ page }) => {
  const t0 = new Date('2026-01-01T09:00:00');
  await page.clock.install({ time: t0 });
  await page.goto('/');
  await page.clock.pauseAt(new Date(t0.getTime() + SEC));
});

function ui(page: Page) {
  const items = page.locator('.todo');
  return {
    mode: page.locator('.mode'),
    button: (name: string) => page.getByRole('button', { name, exact: true }),
    empty: page.getByText('할 일을 추가해 보세요'),
    newInput: page.getByRole('textbox', { name: '새 할 일' }),
    addButton: page.getByRole('button', { name: '추가', exact: true }),
    editInput: page.getByRole('textbox', { name: '할 일 수정' }),
    items,
    // 항목 글자. 항목 전체 텍스트에는 ⋯ 버튼 글자가 섞인다.
    labels: page.locator('.todo label'),
    item: (i: number) => items.nth(i),
    checkbox: (i: number) => items.nth(i).getByRole('checkbox'),
    menuButton: (i: number) => items.nth(i).getByRole('button', { name: /메뉴$/ }),
    menu: page.getByRole('menu'),
    menuItem: (name: '수정' | '삭제') => page.getByRole('menuitem', { name }),
  };
}

async function addTodos(page: Page, texts: string[]) {
  const { newInput } = ui(page);
  for (const text of texts) {
    await newInput.fill(text);
    await newInput.press('Enter');
  }
}

test('할 일을 추가·체크·수정·삭제하고, 새로고침해도 순서와 체크 상태가 유지된다', async ({ page }) => {
  const { empty, newInput, addButton, editInput, items, labels, item, checkbox, menuButton, menuItem } = ui(page);

  // 처음에는 안내 문구와 비활성 추가 버튼만 있고 예전 메모 칸은 없다.
  await expect(page.getByRole('heading', { name: '이번 집중에 할 일' })).toBeVisible();
  await expect(empty).toBeVisible();
  await expect(addButton).toBeDisabled();
  await expect(page.locator('textarea')).toHaveCount(0);

  // 공백만 넣으면 추가되지 않는다.
  await newInput.fill('   ');
  await expect(addButton).toBeDisabled();
  await newInput.press('Enter');
  await expect(items).toHaveCount(0);
  await expect(empty).toBeVisible();

  // Enter로 추가하면 앞뒤 공백이 잘리고, 입력칸이 비고 포커스가 남는다.
  await newInput.fill('  보고서 쓰기  ');
  await newInput.press('Enter');
  await expect(labels).toHaveText(['보고서 쓰기']);
  await expect(newInput).toHaveValue('');
  await expect(newInput).toBeFocused();
  await expect(empty).toHaveCount(0);

  // 추가 버튼으로 추가해도 맨 아래에 붙고 포커스는 입력칸으로 돌아온다.
  await newInput.fill('메일 답장');
  await addButton.click();
  await expect(newInput).toHaveValue('');
  await expect(newInput).toBeFocused();
  await addTodos(page, ['회의 준비']);
  await expect(labels).toHaveText(['보고서 쓰기', '메일 답장', '회의 준비']);
  await expect(checkbox(0)).not.toBeChecked();

  // 글자를 눌러 체크하고 다시 눌러 푼다. 순서는 그대로다.
  await item(1).getByText('메일 답장').click();
  await expect(checkbox(1)).toBeChecked();
  await expect(item(1).locator('label')).toHaveCSS('text-decoration-line', 'line-through');
  await item(1).getByText('메일 답장').click();
  await expect(checkbox(1)).not.toBeChecked();
  await checkbox(1).click();
  await expect(checkbox(1)).toBeChecked();
  await expect(labels).toHaveText(['보고서 쓰기', '메일 답장', '회의 준비']);

  // 체크된 항목을 수정해도 체크 상태가 유지된다.
  await menuButton(1).click();
  await menuItem('수정').click();
  await expect(editInput).toHaveValue('메일 답장');
  await expect(editInput).toBeFocused();
  await editInput.fill(' 메일 두 통 답장 ');
  await editInput.press('Enter');
  await expect(editInput).toHaveCount(0);
  await expect(labels).toHaveText(['보고서 쓰기', '메일 두 통 답장', '회의 준비']);
  await expect(checkbox(1)).toBeChecked();

  await page.reload();
  await expect(labels).toHaveText(['보고서 쓰기', '메일 두 통 답장', '회의 준비']);
  await expect(checkbox(0)).not.toBeChecked();
  await expect(checkbox(1)).toBeChecked();
  await expect(checkbox(2)).not.toBeChecked();

  // 삭제하면 확인 없이 그 항목만 사라지고, 모두 지우면 안내 문구가 다시 보인다.
  await menuButton(1).click();
  await menuItem('삭제').click();
  await expect(labels).toHaveText(['보고서 쓰기', '회의 준비']);
  await menuButton(0).click();
  await menuItem('삭제').click();
  await menuButton(0).click();
  await menuItem('삭제').click();
  await expect(items).toHaveCount(0);
  await expect(empty).toBeVisible();

  await page.reload();
  await expect(empty).toBeVisible();
});

test('메뉴는 하나만 열리고, 키보드로 고르거나 Esc·메뉴 밖 클릭으로 닫힌다', async ({ page }) => {
  const { editInput, items, labels, checkbox, menuButton, menu, menuItem } = ui(page);
  await addTodos(page, ['하나', '둘', '셋']);
  await expect(items).toHaveCount(3);

  // 열면 수정에 포커스가 가고, ↑/↓로 끝에서 처음으로 돌며 오간다.
  await menuButton(0).click();
  await expect(menu).toBeVisible();
  await expect(menuItem('수정')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menuItem('삭제')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menuItem('수정')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menuItem('삭제')).toBeFocused();

  // Esc로 닫으면 포커스가 메뉴 버튼으로 돌아간다.
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(menuButton(0)).toBeFocused();
  await expect(labels).toHaveText(['하나', '둘', '셋']);

  // 같은 메뉴 버튼을 다시 누르면 닫힌다.
  await menuButton(0).click();
  await expect(menu).toBeVisible();
  await menuButton(0).click();
  await expect(menu).toHaveCount(0);

  // 메뉴 밖의 다른 항목 체크박스를 누르면 메뉴가 닫히고 그 항목이 체크된다.
  await menuButton(0).click();
  await checkbox(2).click();
  await expect(menu).toHaveCount(0);
  await expect(checkbox(2)).toBeChecked();

  // 다른 항목의 메뉴 버튼을 누르면 앞 메뉴는 닫히고 그 항목의 메뉴만 열린다.
  // (위 항목의 메뉴는 아래 항목의 ⋯ 버튼을 덮으므로 아래 항목부터 연다.)
  await menuButton(2).click();
  await expect(menuButton(2)).toHaveAttribute('aria-expanded', 'true');
  await menuButton(0).click();
  await expect(menu).toHaveCount(1);
  await expect(menuButton(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(menuButton(2)).toHaveAttribute('aria-expanded', 'false');

  // 키보드 Enter로 고른다.
  await expect(menuItem('수정')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(editInput).toHaveValue('하나');
  await expect(editInput).toBeFocused();
});

test('수정 중 Esc나 빈 값 확정은 원래 글자로 되돌리고, 포커스가 빠지면 저장된다', async ({ page }) => {
  const { editInput, items, labels, menuButton, menuItem } = ui(page);
  await addTodos(page, ['보고서 쓰기', '메일 답장']);

  // Esc는 고친 내용을 버린다.
  await menuButton(0).click();
  await menuItem('수정').click();
  await editInput.fill('바뀐 글자');
  await editInput.press('Escape');
  await expect(editInput).toHaveCount(0);
  await expect(labels).toHaveText(['보고서 쓰기', '메일 답장']);

  // 비우거나 공백만 남기고 확정하면 원래 글자로 되돌리고 항목은 남는다.
  await menuButton(0).click();
  await menuItem('수정').click();
  await editInput.fill('   ');
  await editInput.press('Enter');
  await expect(labels).toHaveText(['보고서 쓰기', '메일 답장']);

  // 입력칸 밖을 클릭하면 저장된다.
  await menuButton(0).click();
  await menuItem('수정').click();
  await editInput.fill('보고서 초안 쓰기');
  await page.getByRole('heading', { name: '이번 집중에 할 일' }).click();
  await expect(editInput).toHaveCount(0);
  await expect(labels).toHaveText(['보고서 초안 쓰기', '메일 답장']);

  // 수정 중에 다른 항목의 메뉴 버튼을 누르면 앞 항목이 저장되고, 이어서 뒤 항목을 수정할 수 있다.
  await menuButton(0).click();
  await menuItem('수정').click();
  await editInput.fill('보고서 완성');
  await menuButton(1).click();
  await expect(labels.nth(0)).toHaveText('보고서 완성');
  await menuItem('수정').click();
  await expect(editInput).toHaveValue('메일 답장');
  await expect(editInput).toBeFocused();
  await expect(items.nth(1).getByRole('textbox')).toHaveCount(1);
});

test('타이머가 진행·휴식·초기화를 거쳐도 할 일 목록과 체크 상태는 그대로다', async ({ page }) => {
  const { mode, button, labels, checkbox, menuButton, menuItem } = ui(page);
  await addTodos(page, ['보고서 쓰기', '메일 답장']);
  await checkbox(0).click();

  // 집중 중에도 추가·체크할 수 있다.
  await button('시작').click();
  await page.clock.runFor(3 * SEC);
  await addTodos(page, ['회의 준비']);
  await checkbox(1).click();
  await expect(mode).toHaveText('집중 중');

  await page.clock.fastForward(25 * MIN - 5 * SEC);
  await page.clock.runFor(2 * SEC);
  await expect(mode).toHaveText('휴식 중');
  await expect(labels).toHaveText(['보고서 쓰기', '메일 답장', '회의 준비']);

  // 휴식 중에도 삭제할 수 있다.
  await menuButton(2).click();
  await menuItem('삭제').click();
  await expect(labels).toHaveText(['보고서 쓰기', '메일 답장']);

  await page.clock.fastForward(5 * MIN - 2 * SEC);
  await page.clock.runFor(2 * SEC);
  await expect(mode).toHaveText('집중 대기');
  await expect(labels).toHaveText(['보고서 쓰기', '메일 답장']);
  await expect(checkbox(0)).toBeChecked();
  await expect(checkbox(1)).toBeChecked();

  await button('시작').click();
  await button('초기화').click();
  await expect(mode).toHaveText('집중 대기');
  await expect(labels).toHaveText(['보고서 쓰기', '메일 답장']);
  await expect(checkbox(0)).toBeChecked();
  await expect(checkbox(1)).toBeChecked();
});
