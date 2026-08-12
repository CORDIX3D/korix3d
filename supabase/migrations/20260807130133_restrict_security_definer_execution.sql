-- Security-definer functions bypass RLS and must never inherit the default
-- EXECUTE privilege from PUBLIC. Production had explicit grants for anon,
-- authenticated and service_role on every function, including internal
-- triggers and payment/stock worker RPCs.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

REVOKE ALL PRIVILEGES ON FUNCTION public.accept_order_quote(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.apply_order_3d_pricing_snapshot() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.can_upload_quote_file(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.cancel_store_order_and_restore_stock(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.cancel_store_order_and_restore_stock_locked(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.capture_admin_audit_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.capture_product_stock_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.claim_slicing_job(text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.claim_stripe_webhook_event(text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.consume_public_api_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, numeric, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, numeric, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.create_store_order_with_stock_locked(uuid, text, text, text, jsonb, jsonb, numeric, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.discard_incomplete_quote(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.fail_or_retry_slicing_job(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.fail_stripe_webhook_event(text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.finalize_quote_files(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.finish_slicing_job(uuid, text, jsonb, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.finish_stripe_webhook_event(text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_order_3d_filament_stock() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.is_employee() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.normalize_contact_reply() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.notify_contact_reply() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.notify_order_3d_status() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.notify_store_order_status() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.protect_accepted_order_3d_quote_terms() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.protect_notification_fields() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.protect_store_order_checkout_terms() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.validate_order_3d_file_objects() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.validate_order_3d_status_transition() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION public.validate_store_order_status_transition() FROM PUBLIC, anon, authenticated, service_role;

-- RLS helper used by public catalogue policies. It returns false when there is
-- no signed-in user and does not expose profile data.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Authenticated helpers and customer-owned quote operations.
GRANT EXECUTE ON FUNCTION public.is_employee() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_order_quote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_upload_quote_file(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.discard_incomplete_quote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_quote_files(uuid, jsonb) TO authenticated, service_role;

-- Internal server RPCs. These are invoked only through service-role clients in
-- Next.js route handlers or by the authenticated slicer worker.
GRANT EXECUTE ON FUNCTION public.cancel_store_order_and_restore_stock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_store_order_and_restore_stock_locked(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_slicing_job(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_public_api_rate_limit(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, numeric, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, numeric, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock_locked(uuid, text, text, text, jsonb, jsonb, numeric, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_or_retry_slicing_job(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_stripe_webhook_event(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_slicing_job(uuid, text, jsonb, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_stripe_webhook_event(text, text, uuid) TO service_role;

-- Remove mutable search paths from application-owned timestamp triggers.
ALTER FUNCTION public.set_filaments_updated_at() SET search_path = '';
ALTER FUNCTION public.set_materials_updated_at() SET search_path = '';
ALTER FUNCTION public.update_updated_at() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
