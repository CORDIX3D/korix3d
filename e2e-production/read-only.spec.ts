import { expect, test } from '@playwright/test';

test('domena, HTTPS, nagłówki i canonical są poprawne', async ({ page, request }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['strict-transport-security']).toContain('max-age=31536000');
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://korix3d.pl');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const www = await request.get('https://www.korix3d.pl/test-www-redirect', {
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  expect([301, 308]).toContain(www.status());
  expect(www.headers().location).toBe('https://korix3d.pl/test-www-redirect');
});

test('robots, sitemap, manifest i health są dostępne', async ({ request }) => {
  const health = await request.get('/api/health', { failOnStatusCode: false });
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toMatchObject({ status: 'ok' });

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('https://korix3d.pl/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain('<loc>https://korix3d.pl/');

  const manifest = await request.get('/site.webmanifest');
  expect(manifest.status()).toBe(200);
  await expect(manifest.json()).resolves.toMatchObject({ name: 'KORIX3D', start_url: '/' });
});

test('najważniejsze strony publiczne renderują treść', async ({ page }) => {
  for (const path of ['/sklep', '/wycena', '/blog', '/portfolio', '/materialy', '/kontakt', '/faq', '/koszyk']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }).first(), path).toBeVisible();
    await expect(page.locator('body'), path).not.toContainText('Application error');
  }
});

test('sklep, wyszukiwarka, kalkulator i AI mają bezpieczny stan wejściowy', async ({ page }) => {
  await page.goto('/sklep');
  await expect(page.getByPlaceholder('Szukaj produktów...')).toBeVisible();
  await page.getByPlaceholder('Szukaj produktów...').fill('PETG');
  await expect(page.getByRole('heading', { level: 1, name: 'Sklep' })).toBeVisible();

  await page.goto('/wycena');
  await expect(page.getByText(/STL, STEP, OBJ, 3MF/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dalej' })).toBeDisabled();

  await page.goto('/');
  await page.getByRole('button', { name: 'Otwórz asystenta KORIX AI' }).click();
  await expect(page.getByText('Bezpłatny asystent druku 3D')).toBeVisible();
});

test('chronione strony i API nie ujawniają danych anonimowo', async ({ page, request }) => {
  for (const path of ['/panel', '/admin']) {
    const response = await page.goto(path);
    expect([200, 302, 307, 308], path).toContain(response?.status());
    await expect(page).toHaveURL(/\/logowanie(?:\?|$)/);
  }

  const adminHealth = await request.get('/api/admin/health', { failOnStatusCode: false });
  expect([401, 403]).toContain(adminHealth.status());
  const invalidOrder = await request.post('/api/store/orders', {
    data: {},
    failOnStatusCode: false,
  });
  expect(invalidOrder.status()).toBe(400);
});

test('brakująca strona zwraca prawdziwe 404', async ({ page }) => {
  const response = await page.goto('/__production_smoke_missing__');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Nie znaleziono strony' })).toBeVisible();
});
