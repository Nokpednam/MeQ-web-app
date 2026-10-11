-- Remember when a user has seen the first-login welcome guide, so it shows
-- once per account on any device. Users mark it themselves through an RPC;
-- direct profile writes stay limited to display_name and avatar_url.
alter table public.profiles
  add column onboarding_completed_at timestamptz;

create or replace function public.complete_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      updated_at = now()
  where id = auth.uid();
end;
$$;

revoke execute on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;
