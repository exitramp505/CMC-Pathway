-- Separate regional responsibility from national access while preserving legacy
-- account_role for existing CMC pages. Both fields are server-administered.
alter table public.candidate_profiles
  add column if not exists cmc_regional_director_region text,
  add column if not exists cmc_national_access text not null default 'none';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='candidate_profiles_cmc_national_access_check') then
    alter table public.candidate_profiles add constraint candidate_profiles_cmc_national_access_check
      check (cmc_national_access in ('none','viewer','admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname='candidate_profiles_cmc_regional_director_region_check') then
    alter table public.candidate_profiles add constraint candidate_profiles_cmc_regional_director_region_check
      check (cmc_regional_director_region is null or cmc_regional_director_region in
      ('Central','East','Mountain Plains','Pacific','Southeast'));
  end if;
end$$;

-- Existing assigned regional leaders retain their precise regional responsibility.
update public.candidate_profiles
  set cmc_regional_director_region=region
  where account_role='regional_leader'
  and region in ('Central','East','Mountain Plains','Pacific','Southeast')
  and cmc_regional_director_region is null;

-- Preserve East directorship for the existing national-admin East director.
-- Do not infer a director appointment merely from the home region of other admins.
update public.candidate_profiles
  set cmc_regional_director_region='East'
  where lower(email)='george@openbibleeast.org'
    and account_role='cmc_admin' and region='East'
    and cmc_regional_director_region is null;

update public.candidate_profiles
  set cmc_national_access=case account_role when 'cmc_admin' then 'admin' when 'cmc_viewer' then 'viewer' else 'none' end
  where account_role in ('cmc_admin','cmc_viewer') and cmc_national_access='none';

-- A browser may edit its own ordinary profile fields but can never grant itself
-- regional or national authority. Follow the existing JWT/service-role guard.
create or replace function public.protect_cmc_access_fields()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if session_user <> 'postgres'
     and coalesce(auth.jwt() ->> 'role','') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.account_role := 'participant';
      new.is_coach := false;
      new.cmc_national_access := 'none';
      new.cmc_regional_director_region := null;
    elsif new.account_role is distinct from old.account_role
       or new.is_coach is distinct from old.is_coach
       or new.cmc_national_access is distinct from old.cmc_national_access
       or new.cmc_regional_director_region is distinct from old.cmc_regional_director_region then
      raise exception 'Only an authorized CMC leader can change leadership access.';
    end if;
  end if;
  return new;
end;
$function$;

-- A regional director's authorized region must not change when they edit their
-- personal address/state. Account-level access changes go through the admin API.
create or replace function public.protect_cmc_profile_privileges()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if session_user <> 'postgres'
     and coalesce(auth.jwt() ->> 'role','') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.account_role := 'participant';
      new.region := coalesce(public.cmc_region_for_state(new.state),new.region,'Unassigned');
      new.current_stage := 'discover';
      new.archived_at := null;
      new.stage_updated_at := coalesce(new.stage_updated_at,now());
      new.email := coalesce(auth.jwt() ->> 'email',new.email,'');
    else
      new.account_role := old.account_role;
      new.region := case
        when old.cmc_regional_director_region is not null then old.region
        else coalesce(public.cmc_region_for_state(new.state),old.region,'Unassigned')
      end;
      new.current_stage := old.current_stage;
      new.archived_at := old.archived_at;
      new.stage_updated_at := old.stage_updated_at;
      new.email := old.email;
    end if;
  end if;
  return new;
end;
$function$;

create index if not exists candidate_profiles_director_role_idx
  on public.candidate_profiles(cmc_regional_director_region)
  where cmc_regional_director_region is not null;
