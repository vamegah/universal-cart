import { expect, Page, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return documentWidth - window.innerWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

test('core pages expose landmarks, labels, and skip-link keyboard access', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('form', { name: 'Import product by URL' })).toBeVisible();
  await expect(page.getByLabel('Product URL')).toBeVisible();

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('dashboard and account stay usable in a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Universal Cart Dashboard' })).toBeVisible();
  await expect(page.getByLabel('Product URL')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
