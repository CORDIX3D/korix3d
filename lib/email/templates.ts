type PaymentLinkEmailInput = {
  customerName?: string | null;
  orderNumber: string;
  paymentUrl: string;
  totalGross: number;
  expiresAt: Date;
  orderType: 'store' | 'quote';
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safePaymentUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:'
    || (url.hostname !== 'stripe.com' && !url.hostname.endsWith('.stripe.com'))
  ) {
    throw new Error('Payment email URL must be an HTTPS Stripe URL.');
  }
  return url.toString();
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(value);
}

function formatExpiry(value: Date) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(value);
}

export function createPaymentLinkEmail(input: PaymentLinkEmailInput) {
  if (!Number.isFinite(input.totalGross) || input.totalGross <= 0) {
    throw new Error('Payment email total must be positive.');
  }

  const paymentUrl = safePaymentUrl(input.paymentUrl);
  const customerName = input.customerName?.trim();
  const greeting = customerName
    ? `Dzień dobry, ${escapeHtml(customerName)}!`
    : 'Dzień dobry!';
  const orderNumber = escapeHtml(input.orderNumber);
  const total = escapeHtml(formatPrice(input.totalGross));
  const expiresAt = escapeHtml(formatExpiry(input.expiresAt));
  const orderLabel = input.orderType === 'quote' ? 'wyceny projektu 3D' : 'zamówienia';
  const subject = `Dokończ płatność za ${orderLabel} ${input.orderNumber}`;
  const plainGreeting = customerName ? `Dzień dobry, ${customerName}!` : 'Dzień dobry!';

  const text = [
    plainGreeting,
    '',
    `Płatność za ${orderLabel} ${input.orderNumber} jest gotowa.`,
    `Kwota brutto: ${formatPrice(input.totalGross)}`,
    `Bezpieczny link Stripe jest aktywny do: ${formatExpiry(input.expiresAt)}.`,
    '',
    paymentUrl,
    '',
    'Jeśli płatność została już wykonana, zignoruj tę wiadomość.',
    'KORIX3D — tworzymy przyszłość warstwa po warstwie',
  ].join('\n');

  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;background:#111214;color:#f5f5f5;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#111214;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#191b1f;border:1px solid #303238;border-radius:16px;overflow:hidden">
          <tr><td style="padding:28px 32px;background:#0c0d0f;border-bottom:3px solid #ff7900">
            <div style="font-size:26px;font-weight:800;letter-spacing:2px;color:#fff">KORIX<span style="color:#ff7900">3D</span></div>
            <div style="margin-top:7px;font-size:12px;letter-spacing:1.5px;color:#aaa">TWORZYMY PRZYSZŁOŚĆ WARSTWA PO WARSTWIE</div>
          </td></tr>
          <tr><td style="padding:32px">
            <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#fff">Dokończ płatność</h1>
            <p style="margin:0 0 16px;line-height:1.65;color:#ddd">${greeting}</p>
            <p style="margin:0 0 22px;line-height:1.65;color:#ddd">Płatność za ${orderLabel} <strong style="color:#fff">${orderNumber}</strong> jest gotowa.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#101114;border-radius:10px">
              <tr><td style="padding:16px;color:#aaa">Kwota brutto</td><td align="right" style="padding:16px;color:#fff;font-size:20px;font-weight:700">${total}</td></tr>
            </table>
            <div style="text-align:center;margin:28px 0">
              <a href="${escapeHtml(paymentUrl)}" style="display:inline-block;padding:14px 26px;background:#ff7900;color:#111;text-decoration:none;border-radius:8px;font-weight:800">Przejdź do bezpiecznej płatności</a>
            </div>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#aaa">Link prowadzi bezpośrednio do zabezpieczonej strony Stripe i jest aktywny do ${expiresAt}.</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#aaa">Jeśli płatność została już wykonana, zignoruj tę wiadomość.</p>
          </td></tr>
          <tr><td style="padding:20px 32px;background:#0c0d0f;color:#777;font-size:12px;text-align:center">Automatyczna wiadomość dotycząca zamówienia w KORIX3D.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
