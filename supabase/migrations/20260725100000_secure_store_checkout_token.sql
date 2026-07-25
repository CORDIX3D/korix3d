-- Bind Stripe Checkout creation to the browser that created the order.
ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS checkout_token_hash text;

CREATE INDEX IF NOT EXISTS store_orders_checkout_token_hash_idx
  ON public.store_orders (checkout_token_hash)
  WHERE checkout_token_hash IS NOT NULL;
