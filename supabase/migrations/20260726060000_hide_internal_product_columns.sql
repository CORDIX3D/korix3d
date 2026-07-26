-- RLS filters rows, not columns. Public storefront clients need catalogue data
-- but must not receive purchase costs, stock thresholds or Stripe identifiers.

REVOKE SELECT ON public.products FROM anon, authenticated;

GRANT SELECT (
  id,
  sku,
  name,
  slug,
  description,
  short_description,
  category_id,
  price,
  compare_price,
  images,
  stock_quantity,
  weight_grams,
  dimensions,
  active,
  featured,
  meta_title,
  meta_description,
  created_at,
  updated_at
) ON public.products TO anon, authenticated;
