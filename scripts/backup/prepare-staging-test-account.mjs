import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const outputDir = process.argv[2];
if (!outputDir) throw new Error('Podaj katalog wyjściowy dla konta testowego stagingu.');

const userId = crypto.randomUUID();
const identityId = crypto.randomUUID();
const orderId = crypto.randomUUID();
const suffix = Date.now().toString(36);
const email = `staging-admin-${suffix}@example.invalid`;
const password = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const identityData = JSON.stringify({
  sub: userId,
  email,
  email_verified: true,
  phone_verified: false,
});
const appMetadata = JSON.stringify({ provider: 'email', providers: ['email'] });
const userMetadata = JSON.stringify({ full_name: 'Administrator testowy KORIX3D' });

const sql = `
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current,
  reauthentication_token, is_sso_user, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000', ${literal(userId)},
  'authenticated', 'authenticated', ${literal(email)},
  extensions.crypt(${literal(password)}, extensions.gen_salt('bf')),
  now(), ${literal(appMetadata)}::jsonb, ${literal(userMetadata)}::jsonb,
  now(), now(), '', '', '', '', '', '', '', '', false, false
);

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  ${literal(identityId)}, ${literal(email)}, ${literal(userId)},
  ${literal(identityData)}::jsonb, 'email', now(), now(), now()
);

insert into public.profiles (id, email, full_name, role)
values (${literal(userId)}, ${literal(email)}, 'Administrator testowy KORIX3D', 'admin')
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  updated_at = now();

insert into public.orders_3d (
  id, order_number, user_id, material_name, color, quantity,
  priority, notes, status, files, infill_percent, slicing_status
) values (
  ${literal(orderId)}, ${literal(`STAGING-${suffix.toUpperCase()}`)}, ${literal(userId)},
  'PLA', 'Testowy pomarańczowy', 1, 'standard',
  'Automatyczny test odtwarzania i Storage', 'new', '[]'::jsonb, 20, 'not_started'
);

commit;
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'staging-test-account.sql'), sql, {
  encoding: 'utf8',
  mode: 0o600,
});
fs.writeFileSync(
  path.join(outputDir, 'staging-test-account.json'),
  `${JSON.stringify({ userId, identityId, orderId, email, password }, null, 2)}\n`,
  { encoding: 'utf8', mode: 0o600 },
);

process.stdout.write(JSON.stringify({ userId, orderId, email, passwordStored: true }));
