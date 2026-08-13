-- Separate owner/admin Storage policies so an owner read never depends on a
-- private helper and admins can reliably create signed evidence URLs.
drop policy if exists maintenance_read_authorized on storage.objects;

create policy maintenance_read_own
on storage.objects for select to authenticated
using (
  bucket_id = 'maintenance-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy maintenance_read_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'maintenance-evidence'
  and exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid()) and profile.role = 'ADMIN'
  )
);
