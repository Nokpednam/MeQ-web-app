begin;
select plan(1);

do $$
declare
  reporter_id uuid := '17000000-0000-0000-0000-000000000001';
  second_reporter_id uuid := '17000000-0000-0000-0000-000000000002';
  admin_id uuid := '17000000-0000-0000-0000-000000000003';
  first_report public.maintenance_reports;
  second_report public.maintenance_reports;
  deleted_image_path text;
begin
  insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
  values
    (reporter_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maintenance-reporter@meq.test', '', now(), now(), '{"display_name":"Maintenance Reporter"}'),
    (second_reporter_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maintenance-second@meq.test', '', now(), now(), '{"display_name":"Maintenance Second"}'),
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maintenance-admin@meq.test', '', now(), now(), '{"display_name":"Maintenance Admin"}');
  update public.profiles set role = 'ADMIN' where id = admin_id;

  perform set_config('request.jwt.claim.sub', reporter_id::text, true);
  first_report := public.create_maintenance_report('3x3-a', 'LIGHTING', 'ไฟสนามทดสอบดับ', null);
  if exists (select 1 from public.list_public_maintenance_status() where id = first_report.id) then
    raise exception 'NEW report was visible in the public feed';
  end if;

  perform set_config('request.jwt.claim.sub', second_reporter_id::text, true);
  begin
    perform public.create_maintenance_report('3x3-a', 'LIGHTING', 'รายงานซ้ำจากผู้ใช้อีกคน', null);
    raise exception 'duplicate active report was allowed';
  exception when unique_violation then
    if sqlerrm <> 'DUPLICATE_ACTIVE_REPORT' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.admin_update_maintenance_status(first_report.id, 'IN_PROGRESS', 'รับเรื่องแล้ว');
  if not exists (select 1 from public.list_public_maintenance_status() where id = first_report.id) then
    raise exception 'accepted report was missing from the public feed';
  end if;
  perform public.admin_update_maintenance_status(first_report.id, 'WAITING_FOR_CARETAKER', 'ส่งต่อผู้ดูแลสนาม');
  if (select status from public.list_public_maintenance_status() where id = first_report.id) <> 'WAITING_FOR_CARETAKER' then
    raise exception 'caretaker status was not published';
  end if;
  perform public.admin_update_maintenance_status(first_report.id, 'RESOLVED', 'แก้ไขแล้ว');

  perform set_config('request.jwt.claim.sub', second_reporter_id::text, true);
  second_report := public.create_maintenance_report('3x3-a', 'LIGHTING', 'ไฟสนามดับอีกครั้งหลังแก้ไข', null);
  if second_report.id is null then raise exception 'resolved issue did not allow a new report'; end if;

  begin
    perform public.admin_delete_maintenance_report(second_report.id);
    raise exception 'non-admin deleted a maintenance report';
  exception when insufficient_privilege then
    if sqlerrm <> 'ADMIN_ONLY' then raise; end if;
  end;

  update public.maintenance_reports
  set image_path = second_reporter_id::text || '/evidence.jpg'
  where id = second_report.id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  deleted_image_path := public.admin_delete_maintenance_report(second_report.id);
  if deleted_image_path is distinct from second_reporter_id::text || '/evidence.jpg' then
    raise exception 'delete did not return the stored image path';
  end if;
  if exists (select 1 from public.maintenance_reports where id = second_report.id)
    or exists (select 1 from public.maintenance_active_issues where report_id = second_report.id) then
    raise exception 'deleted report or its active-issue slot remained';
  end if;

  perform set_config('request.jwt.claim.sub', reporter_id::text, true);
  if public.create_maintenance_report('3x3-a', 'LIGHTING', 'แจ้งใหม่หลังแอดมินลบรายการ', null) is null then
    raise exception 'deleted issue did not free the active-issue slot';
  end if;

  raise notice 'MAINTENANCE_WORKFLOW_TESTS_PASSED';
end;
$$;

select pass('maintenance visibility, status, duplicate, and admin delete flow completed');
select * from finish();
rollback;
