insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('maintenance-evidence','maintenance-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy maintenance_upload_own on storage.objects for insert to authenticated
with check(bucket_id='maintenance-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy maintenance_read_authorized on storage.objects for select to authenticated
using(bucket_id='maintenance-evidence' and ((storage.foldername(name))[1]=(select auth.uid())::text or private.is_admin()));
create policy maintenance_delete_own on storage.objects for delete to authenticated
using(bucket_id='maintenance-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.admin_update_maintenance_status(p_report_id uuid,p_status public.maintenance_status,p_admin_note text default null)
returns public.maintenance_reports language plpgsql security definer set search_path='' as $$
declare v_report public.maintenance_reports;
begin
 if not private.is_admin() then raise exception using errcode='42501',message='ADMIN_ONLY'; end if;
 update public.maintenance_reports set status=p_status,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),updated_at=now() where id=p_report_id returning * into v_report;
 if v_report.id is null then raise exception using errcode='P0002',message='REPORT_NOT_FOUND'; end if;
 return v_report;
end;$$;
revoke execute on function public.admin_update_maintenance_status(uuid,public.maintenance_status,text) from public,anon;
grant execute on function public.admin_update_maintenance_status(uuid,public.maintenance_status,text) to authenticated;
