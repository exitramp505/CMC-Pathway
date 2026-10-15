-- Applied to CMC Pathway production Supabase, 2026-10-15.
-- Remove unnecessary direct RPC access to privileged trigger functions
-- without changing who can update profiles through their existing policies.
revoke execute on function public.protect_cmc_access_fields() from public, anon, authenticated;
revoke execute on function public.protect_cmc_account_role() from public, anon, authenticated;
revoke execute on function public.protect_cmc_profile_privileges() from public, anon, authenticated;

grant execute on function public.protect_cmc_access_fields() to service_role;
grant execute on function public.protect_cmc_account_role() to service_role;
grant execute on function public.protect_cmc_profile_privileges() to service_role;

alter function public.cmc_region_for_state(text) set search_path = pg_catalog, public;
