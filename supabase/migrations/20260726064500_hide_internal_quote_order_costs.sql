-- Customers may read their quote and production progress, but never the
-- company's rates, cost breakdown, slicer internals or staff-only notes.

REVOKE SELECT ON public.orders_3d FROM anon, authenticated;

GRANT SELECT (
  id,
  order_number,
  user_id,
  material_id,
  filament_id,
  material_name,
  color,
  color_hex,
  infill_percent,
  quantity,
  priority,
  delivery_type,
  notes,
  status,
  files,
  slicing_status,
  sliced_at,
  printing_time_hours,
  filament_used_grams,
  final_price,
  tracking_number,
  shipped_at,
  created_at,
  updated_at
) ON public.orders_3d TO authenticated;

