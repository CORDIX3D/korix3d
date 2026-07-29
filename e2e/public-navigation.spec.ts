import { expect, test } from '@playwright/test';

test('publiczna nawigacja prowadzi do sklepu i obsługuje 404', async ({ page }) => {
  const homeResponse = await page.goto('/');
  expect(homeResponse?.status()).toBe(200);
  expect(homeResponse?.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(homeResponse?.headers()['x-content-type-options']).toBe('nosniff');
  expect(homeResponse?.headers()['x-frame-options']).toBe('DENY');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://korix3d.pl');
  await expect(page.locator('h1').first()).toBeVisible();

  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole('button', { name: 'Otwórz menu' }).click();
  }

  await page.getByRole('link', { name: 'Sklep', exact: true }).first().click();
  await expect(page).toHaveURL(/\/sklep$/);
  await expect(page.getByRole('heading', { name: 'Sklep', exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://korix3d.pl/sklep');

  const missingResponse = await page.goto('/__brakujaca_strona_e2e__');
  expect(missingResponse?.status()).toBe(404);
  await expect(page.locator('body')).not.toBeEmpty();
});

test('formularz kontaktowy pokazuje walidację bez wysyłania danych', async ({ page }) => {
  await page.goto('/kontakt');
  await page.getByLabel(/Imię i nazwisko/).fill('A');
  await page.getByLabel(/^Email/).fill('błędny-email');
  await page.getByLabel(/^Temat/).fill('x');
  await page.getByRole('textbox', { name: 'Wiadomość *', exact: true }).fill('krótka');
  await page.locator('main form').evaluate((form) => form.setAttribute('novalidate', ''));
  await page.locator('main').getByRole('button', { name: 'Wyślij wiadomość', exact: true }).click();

  await expect(page.getByText(/co najmniej 2 znaki/)).toBeVisible();
  await expect(page.getByText(/Nieprawidłowy adres email/)).toBeVisible();
  await expect(page.getByText(/co najmniej 10 znaków/)).toBeVisible();
});
