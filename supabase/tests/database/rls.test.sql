begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select is(
  (
    select count(*)
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'r'
      and relation.relrowsecurity = false
  ),
  0::bigint,
  'all public tables have RLS enabled'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'customer-one@example.test', crypt('test-password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'customer-two@example.test', crypt('test-password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'employee@example.test', crypt('test-password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'admin@example.test', crypt('test-password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles set role = 'employee' where id = '10000000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000004';

insert into public.store_orders (
  id, order_number, user_id, customer_email, subtotal, total
) values
  ('20000000-0000-4000-8000-000000000001', 'RLS-ONE', '10000000-0000-4000-8000-000000000001', 'customer-one@example.test', 10, 10),
  ('20000000-0000-4000-8000-000000000002', 'RLS-TWO', '10000000-0000-4000-8000-000000000002', 'customer-two@example.test', 20, 20);

insert into public.store_order_items (
  order_id, sku, name, quantity, unit_price, total
) values
  ('20000000-0000-4000-8000-000000000001', 'RLS-ONE', 'Item one', 1, 10, 10),
  ('20000000-0000-4000-8000-000000000002', 'RLS-TWO', 'Item two', 1, 20, 20);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.profiles), 1::bigint, 'customer sees only own profile');
select is((select count(*) from public.store_orders), 1::bigint, 'customer sees only own store order');
select is((select count(*) from public.store_order_items), 1::bigint, 'customer sees only own order items');

select throws_like(
  $$update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000001'$$,
  '%protected%',
  'customer cannot promote own profile'
);

select is(
  (
    with changed as (
      update public.store_orders
      set status = 'paid'
      where id = '20000000-0000-4000-8000-000000000001'
      returning id
    )
    select count(*) from changed
  ),
  0::bigint,
  'customer cannot change payment status'
);

select throws_like(
  $$insert into public.store_orders (order_number, user_id, customer_email, subtotal, total) values ('RLS-ATTACK', '10000000-0000-4000-8000-000000000001', 'attacker@example.test', 1, 1)$$,
  '%row-level security%',
  'customer cannot create checkout rows directly'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.store_orders), 2::bigint, 'employee can read store orders');
select throws_like(
  $$update public.store_orders set status = 'paid' where id = '20000000-0000-4000-8000-000000000001'$$,
  '%service role%',
  'employee cannot set an order as paid'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.profiles), 4::bigint, 'admin can read all profiles');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_like(
  $$select count(*) from public.profiles$$,
  '%permission denied%',
  'anonymous user cannot enumerate profiles'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select is((select count(*) from public.store_orders), 2::bigint, 'service role can operate across RLS');

select * from finish();
rollback;
