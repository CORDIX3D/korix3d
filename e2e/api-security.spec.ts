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
    const expectedStatuses = path === '/api/stripe/create-checkout-session' ? [400, 403] : [400];
    expect(expectedStatuses, path).toContain(response.status());
  }
});

test('prywatne API nie pozwala na anonimowy dostęp', async ({ request }) => {
  for (const path of ['/api/admin/health', '/api/accounting/reports', '/api/executive/reports']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([401, 403, 503], path).toContain(response.status());
  }
});

test('prywatne API odrzuca mutację z obcej domeny', async ({ request }) => {
  const responses = await Promise.all([
    request.patch('/api/admin/settings', {
      headers: { origin: 'https://atak.example' },
      data: { settings: {} },
    }),
    request.post('/api/admin/store-orders/refund', {
      headers: { origin: 'https://atak.example' },
      data: { orderId: '00000000-0000-4000-8000-000000000000' },
    }),
  ]);
  for (const response of responses) expect(response.status()).toBe(403);
});
