import { test, expect } from '@playwright/test';

test.describe('Scheduled match flow', () => {
  // These tests verify the schedule mode UI in the log-match form.
  // They don't require a running backend — they check frontend behavior only.

  test('log-match page shows mode toggle', async ({ page }) => {
    await page.goto('/log-match');

    // Both toggle buttons should be visible
    await expect(page.getByRole('button', { name: 'Log Match' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule Match' })).toBeVisible();
  });

  test('switching to schedule mode hides game scores and shows plan notes', async ({ page }) => {
    await page.goto('/log-match');

    // Initially in log mode — game scores visible
    await expect(page.getByText('Game Scores')).toBeVisible();
    await expect(page.getByText('Match Plan')).not.toBeVisible();

    // Switch to schedule mode
    await page.getByRole('button', { name: 'Schedule Match' }).click();

    // Game scores hidden, plan notes shown
    await expect(page.getByText('Game Scores')).not.toBeVisible();
    await expect(page.getByText('Match Plan')).toBeVisible();
    await expect(page.getByPlaceholder("What's your game plan?")).toBeVisible();

    // Submit button says "Schedule Match"
    await expect(page.getByRole('button', { name: 'Schedule Match' }).last()).toBeVisible();
  });

  test('switching back to log mode restores game scores', async ({ page }) => {
    await page.goto('/log-match');

    // Switch to schedule mode
    await page.getByRole('button', { name: 'Schedule Match' }).click();
    await expect(page.getByText('Game Scores')).not.toBeVisible();

    // Switch back to log mode
    await page.getByRole('button', { name: 'Log Match' }).click();
    await expect(page.getByText('Game Scores')).toBeVisible();
    await expect(page.getByText('Match Plan')).not.toBeVisible();
  });

  test('schedule mode shows "Match Date" label', async ({ page }) => {
    await page.goto('/log-match');

    // Initially shows "Date Played"
    await expect(page.getByText('Date Played')).toBeVisible();

    // Switch to schedule mode
    await page.getByRole('button', { name: 'Schedule Match' }).click();

    // Shows "Match Date"
    await expect(page.getByText('Match Date')).toBeVisible();
    await expect(page.getByText('Date Played')).not.toBeVisible();
  });

  test('page heading changes with mode', async ({ page }) => {
    await page.goto('/log-match');

    await expect(page.getByRole('heading', { name: 'Log a Match' })).toBeVisible();

    await page.getByRole('button', { name: 'Schedule Match' }).click();

    await expect(page.getByRole('heading', { name: 'Schedule Match' })).toBeVisible();
  });
});
