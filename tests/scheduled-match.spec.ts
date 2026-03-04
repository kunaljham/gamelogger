import { test, expect } from '@playwright/test';

test.describe('Scheduled match flow', () => {
  // These tests verify the schedule mode UI in the log-match form.
  // They don't require a running backend — they check frontend behavior only.

  test('log-match page shows future match toggle', async ({ page }) => {
    await page.goto('/log-match');

    // Toggle switch should be visible
    await expect(page.getByRole('switch')).toBeVisible();
    await expect(page.getByText('Future match — add scores later')).toBeVisible();
  });

  test('toggling future match hides game scores and notes, shows plan notes', async ({ page }) => {
    await page.goto('/log-match');

    // Initially in log mode — game scores and notes visible, plan notes hidden
    await expect(page.getByText('Game Scores')).toBeVisible();
    await expect(page.getByText('Match Plan')).not.toBeVisible();

    // Toggle future match on
    await page.getByRole('switch').click();

    // Game scores and notes hidden, plan notes shown
    await expect(page.getByText('Game Scores')).not.toBeVisible();
    await expect(page.getByText('Match Plan')).toBeVisible();
    await expect(page.getByPlaceholder("What's your game plan?")).toBeVisible();

    // Submit button says "Schedule Match"
    await expect(page.getByRole('button', { name: 'Schedule Match' })).toBeVisible();
  });

  test('toggling back restores game scores and notes', async ({ page }) => {
    await page.goto('/log-match');

    // Toggle on
    await page.getByRole('switch').click();
    await expect(page.getByText('Game Scores')).not.toBeVisible();

    // Toggle off
    await page.getByRole('switch').click();
    await expect(page.getByText('Game Scores')).toBeVisible();
    await expect(page.getByText('Match Plan')).not.toBeVisible();
  });

  test('schedule mode shows "Match Date" label', async ({ page }) => {
    await page.goto('/log-match');

    // Initially shows "Date Played"
    await expect(page.getByText('Date Played')).toBeVisible();

    // Toggle future match on
    await page.getByRole('switch').click();

    // Shows "Match Date"
    await expect(page.getByText('Match Date')).toBeVisible();
    await expect(page.getByText('Date Played')).not.toBeVisible();
  });

  test('heading stays "Log a Match" regardless of toggle', async ({ page }) => {
    await page.goto('/log-match');

    await expect(page.getByRole('heading', { name: 'Log a Match' })).toBeVisible();

    await page.getByRole('switch').click();

    // Heading unchanged — toggle is inside the date section, not the page title
    await expect(page.getByRole('heading', { name: 'Log a Match' })).toBeVisible();
  });
});
