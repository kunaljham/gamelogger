import { test, expect } from '@playwright/test';

test.describe('Sign-in flow', () => {
  test('landing page has Get Started button', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'GameLogger' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
  });

  test('clicking Get Started navigates to login page', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Get Started' }).click();

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to GameLogger' })).toBeVisible();
  });

  test('entering email and submitting navigates to check-email page', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL('/login/check-email');
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();
  });

  test('simulating sign-in link click navigates to feed', async ({ page }) => {
    // Start from login to set up sessionStorage
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL('/login/check-email');

    // Click the dev simulate button
    await page.getByRole('button', { name: '[Dev] Simulate sign-in link click' }).click();

    await expect(page).toHaveURL('/feed');
    await expect(page.getByRole('heading', { name: "You're signed in!" })).toBeVisible();
  });
});
