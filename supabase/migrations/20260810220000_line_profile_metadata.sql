-- Map standard OAuth/OIDC profile claims, including LINE's name and picture,
-- into the public profile created for each authenticated user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'ผู้ใช้งาน'
    ),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'picture'), '')
    )
  );
  return new;
end;
$$;

-- Repair profiles created during the first LINE Login test without changing
-- names that users have already chosen themselves.
update public.profiles as profile
set
  display_name = coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    profile.display_name
  ),
  avatar_url = coalesce(
    profile.avatar_url,
    nullif(trim(auth_user.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'picture'), '')
  ),
  updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.display_name = 'ผู้ใช้งาน'
  and auth_user.raw_app_meta_data ->> 'provider' = 'custom:line';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
