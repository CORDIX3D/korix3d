import { expect, test } from '@playwright/test';

test('publiczne API odrzuca nieprawidłowe dane', async ({ request }) => {
  const cases: Array<[string, unknown]> = [
    ['/api/public/contact', {}],
    ['/api/public/newsletter', { email: 'niepoprawny-email' }],
    ['/api/store/orders', {}],
    ['/api/stripe/create-checkout-session', {}],
    ['/api/monitoring/client-error', {}],
  ];

  for (const [path, data] of cases) {
    const response = await request.post(path, { data });
    expect(response.status(), path).toBe(400);
  }
});

test('prywatne API nie pozwala na anonimowy dostęp', async ({ request }) => {
  for (const path of ['/api/admin/health', '/api/accounting/reports', '/api/executive/reports']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([401, 403, 503], path).toContain(response.status());
  }
});

test('prywatne API odrzuca mutację z obcej domeny', async ({ request }) => {
  const response = await request.patch('/api/admin/settings', {
    headers: { origin: 'https://atak.example' },
    data: { settings: {} },
  });
  expect(response.status()).toBe(403);
});
