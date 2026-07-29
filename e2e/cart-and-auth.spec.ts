import { expect, test } from '@playwright/test';

const cartItem = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'testowy-produkt',
  sku: 'E2E-001',
  name: 'Testowy produkt KORIX3D',
  price: 24.5,
  image: null,
  quantity: 1,
  stockQuantity: 3,
};

test('koszyk z localStorage pozwala zmienić ilość i usunąć produkt', async ({ page }) => {
  await page.addInitScript((item) => {
    window.localStorage.setItem('korix3d_cart', JSON.stringify([item]));
  }, cartItem);

  await page.goto('/koszyk');
  await expect(page.getByRole('heading', { name: 'Koszyk', exact: true })).toBeVisible();
  await expect(page.getByText(cartItem.name)).toBeVisible();
  await expect(page.getByText('24.50 zł').first()).toBeVisible();

  await page.getByRole('button', { name: `Zwiększ ilość ${cartItem.name}` }).click();
  await expect(page.getByText('49.00 zł')).toBeVisible();

  await page.getByRole('button', { name: `Usuń ${cartItem.name} z koszyka` }).click();
  await expect(page.getByRole('heading', { name: 'Twój koszyk jest pusty' })).toBeVisible();
});

test('chronione panele nie ujawniają danych anonimowemu użytkownikowi', async ({ page }) => {
  for (const path of ['/panel', '/admin']) {
    const response = await page.goto(path);
    expect([200, 503]).toContain(response?.status());
    expect(page.url()).toMatch(/\/(logowanie|panel|admin)$/);

    if (response?.status() === 200) {
      await expect(page.getByText(/Zaloguj się|Usługa jest chwilowo niedostępna/).first()).toBeVisible();
    } else {
      await expect(page.locator('body')).toContainText(/niedostępna/i);
    }
  }
});

test('logowanie i odzyskiwanie hasła odrzucają błędny email lokalnie', async ({ page }) => {
  const loginResponse = await page.goto('/logowanie');
  if (loginResponse?.status() === 503) {
    await expect(page.locator('body')).toContainText(/niedostępna/i);
    return;
  }

  await page.getByPlaceholder('twoj@email.pl').fill('błędny-email');
  await page.locator('input[type="password"]').fill('123');
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await expect(page.getByText(/Nieprawidłowy adres email/)).toBeVisible();

  await page.goto('/odzyskaj-haslo');
  await page.getByPlaceholder('twoj@email.pl').fill('nadal-błędny');
  await page.getByRole('button', { name: 'Wyślij instrukcje' }).click();
  await expect(page.getByText(/Nieprawidłowy adres email/)).toBeVisible();
});
