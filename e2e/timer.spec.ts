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
  return {
    app: page.locator('main.app'),
    mode: page.locator('.mode'),
    time: page.locator('.time'),
    button: (name: string) => page.getByRole('button', { name, exact: true }),
    focusInput: page.getByLabel('집중 시간(분)'),
    breakInput: page.getByLabel('휴식 시간(분)'),
    inputs: page.getByRole('textbox', { name: /시간\(분\)/ }),
    error: page.getByText('1~999 사이의 정수를 입력하세요'),
  };
}

// 브라우저의 탭 전환을 흉내 낸다. App은 visibilitychange에서 즉시 시각을 다시 읽는다.
async function setTabVisibility(page: Page, hidden: boolean) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('앱을 열면 25:00 집중 대기 상태이고, 시작을 누르면 남은 시간이 줄어든다', async ({ page }) => {
  const { app, mode, time, button } = ui(page);

  await expect(mode).toHaveText('집중 대기');
  await expect(time).toHaveText('25:00');
  await expect(app).toHaveAttribute('data-phase', 'focus');

  await button('시작').click();
  await expect(mode).toHaveText('집중 중');

  await page.clock.runFor(3 * SEC);
  await expect(time).toHaveText('24:57');

  await page.clock.runFor(10 * SEC);
  await expect(time).toHaveText('24:47');
});

test('일시정지하면 시간이 멈추고, 계속을 누르면 멈춘 시간부터 다시 줄어든다', async ({ page }) => {
  const { mode, time, button } = ui(page);

  await button('시작').click();
  await page.clock.runFor(10 * SEC);
  await expect(time).toHaveText('24:50');

  await button('일시정지').click();
  await expect(mode).toHaveText('집중 · 일시정지');
  await expect(time).toHaveText('24:50');

  await page.clock.runFor(2 * MIN);
  await expect(time).toHaveText('24:50');

  await button('계속').click();
  await expect(mode).toHaveText('집중 중');
  await expect(time).toHaveText('24:50');

  await page.clock.runFor(5 * SEC);
  await expect(time).toHaveText('24:45');
});

test('집중이 끝나면 자동으로 휴식이 시작되고, 휴식이 끝나면 25:00 집중 대기로 돌아와 멈춰 있다', async ({ page }) => {
  const { app, mode, time, button } = ui(page);

  await button('시작').click();

  // 긴 구간은 건너뛰고, 단계가 바뀌는 경계는 runFor로 인터벌을 그대로 돌린다.
  await page.clock.fastForward(25 * MIN - 2 * SEC);
  await expect(mode).toHaveText('집중 중');
  await expect(time).toHaveText('00:02');

  await page.clock.runFor(2 * SEC);
  await expect(mode).toHaveText('휴식 중');
  await expect(time).toHaveText('05:00');
  await expect(app).toHaveAttribute('data-phase', 'break');

  await page.clock.fastForward(5 * MIN - 2 * SEC);
  await expect(mode).toHaveText('휴식 중');
  await expect(time).toHaveText('00:02');

  await page.clock.runFor(2 * SEC);
  await expect(mode).toHaveText('집중 대기');
  await expect(time).toHaveText('25:00');
  await expect(app).toHaveAttribute('data-phase', 'focus');
  await expect(button('시작')).toBeVisible();

  // 다음 집중이 자동으로 시작되지 않는다.
  await page.clock.runFor(10 * SEC);
  await expect(mode).toHaveText('집중 대기');
  await expect(time).toHaveText('25:00');
});

test('휴식 중에 초기화를 누르면 25:00 집중 대기로 돌아온다', async ({ page }) => {
  const { app, mode, time, button } = ui(page);

  await button('시작').click();
  await page.clock.fastForward(26 * MIN);
  await expect(mode).toHaveText('휴식 중');
  await expect(time).toHaveText('04:00');

  await button('초기화').click();
  await expect(mode).toHaveText('집중 대기');
  await expect(time).toHaveText('25:00');
  await expect(app).toHaveAttribute('data-phase', 'focus');
  await expect(button('시작')).toBeVisible();
  await expect(button('초기화')).toHaveCount(0);
});

test('탭이 백그라운드에 있다가 돌아와도 실제 흐른 시간만큼 진행돼 있다', async ({ page }) => {
  const { mode, time, button } = ui(page);

  await button('시작').click();
  await page.clock.runFor(10 * SEC);
  await expect(time).toHaveText('24:50');

  // 백그라운드에서는 인터벌이 거의 실행되지 않는다. fastForward는 그 사이 타이머를 최대 한 번만 실행한다.
  await setTabVisibility(page, true);
  await page.clock.fastForward(10 * MIN);
  await setTabVisibility(page, false);
  await expect(mode).toHaveText('집중 중');
  await expect(time).toHaveText('14:50');

  // 백그라운드에 있는 동안 집중이 끝났다면, 돌아왔을 때 휴식이 그만큼 진행돼 있다.
  await setTabVisibility(page, true);
  await page.clock.fastForward(16 * MIN + 50 * SEC);
  await setTabVisibility(page, false);
  await expect(mode).toHaveText('휴식 중');
  await expect(time).toHaveText('03:00');
});

test('집중·휴식 시간을 바꾸면 그 시간으로 한 사이클이 돌고, 새로고침해도 유지된다', async ({ page }) => {
  const { mode, time, button, focusInput, breakInput, inputs } = ui(page);

  // 입력하는 동안에는 시계가 바뀌지 않고, Enter로 확정하면 바뀐다.
  await focusInput.fill('50');
  await expect(time).toHaveText('25:00');
  await focusInput.press('Enter');
  await expect(time).toHaveText('50:00');
  await expect(mode).toHaveText('집중 대기');

  // 포커스가 빠질 때도 확정된다.
  await breakInput.fill('10');
  await breakInput.blur();

  await button('시작').click();
  await expect(inputs).toHaveCount(0);

  await page.clock.fastForward(50 * MIN - 2 * SEC);
  await expect(time).toHaveText('00:02');
  await page.clock.runFor(2 * SEC);
  await expect(mode).toHaveText('휴식 중');
  await expect(time).toHaveText('10:00');

  await page.clock.fastForward(10 * MIN - 2 * SEC);
  await expect(time).toHaveText('00:02');
  await page.clock.runFor(2 * SEC);
  await expect(mode).toHaveText('집중 대기');
  await expect(time).toHaveText('50:00');
  await expect(inputs).toHaveCount(2);

  await page.reload();
  await expect(focusInput).toHaveValue('50');
  await expect(breakInput).toHaveValue('10');
  await expect(time).toHaveText('50:00');
});

test('잘못된 시간을 확정하면 시작할 수 없고, 고친 값을 확정한 뒤에야 시작된다', async ({ page }) => {
  const { mode, time, button, focusInput, error } = ui(page);

  await focusInput.fill('abc');
  await focusInput.press('Enter');
  await expect(error).toBeVisible();
  await expect(focusInput).toHaveValue('abc');
  await expect(time).toHaveText('25:00');
  await expect(button('시작')).toBeDisabled();

  // 고친 값을 확정하지 않고 비활성 시작 버튼을 누르면 값만 확정되고 시작되지 않는다.
  await focusInput.fill('30');
  await button('시작').click({ force: true });
  await expect(error).toHaveCount(0);
  await expect(time).toHaveText('30:00');
  await expect(mode).toHaveText('집중 대기');
  await expect(button('시작')).toBeEnabled();

  await button('시작').click();
  await expect(mode).toHaveText('집중 중');
  await expect(time).toHaveText('30:00');
});
