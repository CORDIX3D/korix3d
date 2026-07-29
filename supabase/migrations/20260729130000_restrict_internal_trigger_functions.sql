-- Trigger functions do not need to be callable through the Data API.
-- Revoking PUBLIC execution narrows the exposed database surface without
-- changing trigger behavior or existing data.

REVOKE ALL ON FUNCTION public.normalize_contact_reply() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_contact_reply() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_notification_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_privileges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_materials_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_slicing_jobs_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

-- is_employee is used only by authenticated policies. Anonymous catalogue
-- policies use is_admin, which safely returns false without a signed-in user.
REVOKE EXECUTE ON FUNCTION public.is_employee() FROM anon;
