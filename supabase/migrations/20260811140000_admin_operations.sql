-- Administrative court, target-score, and calendar operations.

create or replace function public.admin_set_court_open(p_court_id text,p_is_open boolean)
returns public.courts language plpgsql security definer set search_path='' as $$
declare v_court public.courts;
begin
 if not private.is_admin() then raise exception using errcode='42501',message='ADMIN_ONLY'; end if;
 update public.courts set is_open=p_is_open,updated_at=now() where id=p_court_id returning * into v_court;
 if v_court.id is null then raise exception using errcode='P0002',message='COURT_NOT_FOUND'; end if;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,payload) values(auth.uid(),'COURT_OPEN_CHANGED','court',p_court_id,jsonb_build_object('isOpen',p_is_open));
 return v_court;
end;$$;

create or replace function public.admin_set_daily_target(p_court_group_id text,p_target_score integer)
returns public.daily_score_settings language plpgsql security definer set search_path='' as $$
declare v_group public.court_groups;v_setting public.daily_score_settings;v_date date:=(now() at time zone 'Asia/Bangkok')::date;
begin
 if not private.is_admin() then raise exception using errcode='42501',message='ADMIN_ONLY'; end if;
 select * into v_group from public.court_groups where id=p_court_group_id;
 if v_group.id is null then raise exception using errcode='P0002',message='COURT_GROUP_NOT_FOUND'; end if;
 if not p_target_score=any(v_group.allowed_target_scores) then raise exception using errcode='23514',message='INVALID_TARGET_SCORE'; end if;
 insert into public.daily_score_settings(court_group_id,business_date,target_score,updated_by) values(v_group.id,v_date,p_target_score,auth.uid())
 on conflict(court_group_id,business_date) do update set target_score=excluded.target_score,updated_by=auth.uid(),updated_at=now() returning * into v_setting;
 return v_setting;
end;$$;

create or replace function public.admin_save_court_event(p_event_id uuid,p_title text,p_details text,p_starts_at timestamptz,p_ends_at timestamptz,p_all_day boolean,p_court_ids text[])
returns public.court_events language plpgsql security definer set search_path='' as $$
declare v_event public.court_events;v_id uuid:=coalesce(p_event_id,gen_random_uuid());
begin
 if not private.is_admin() then raise exception using errcode='42501',message='ADMIN_ONLY'; end if;
 if char_length(trim(p_title))=0 or p_ends_at<=p_starts_at or coalesce(array_length(p_court_ids,1),0)=0 then raise exception using errcode='23514',message='INVALID_EVENT'; end if;
 if exists(select 1 from unnest(p_court_ids) as x(court_id) where not exists(select 1 from public.courts c where c.id=x.court_id)) then raise exception using errcode='23514',message='INVALID_COURT'; end if;
 insert into public.court_events(id,title,details,starts_at,ends_at,all_day,created_by) values(v_id,trim(p_title),coalesce(p_details,''),p_starts_at,p_ends_at,p_all_day,auth.uid())
 on conflict(id) do update set title=excluded.title,details=excluded.details,starts_at=excluded.starts_at,ends_at=excluded.ends_at,all_day=excluded.all_day,cancelled_at=null returning * into v_event;
 delete from public.court_event_courts where event_id=v_id;
 insert into public.court_event_courts(event_id,court_id) select v_id,x.court_id from unnest(p_court_ids) as x(court_id);
 return v_event;
end;$$;

create or replace function public.admin_cancel_court_event(p_event_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception using errcode='42501',message='ADMIN_ONLY'; end if;
 update public.court_events set cancelled_at=now() where id=p_event_id and cancelled_at is null;
 if not found then raise exception using errcode='P0002',message='EVENT_NOT_FOUND'; end if;
end;$$;

revoke execute on function public.admin_set_court_open(text,boolean) from public,anon;
revoke execute on function public.admin_set_daily_target(text,integer) from public,anon;
revoke execute on function public.admin_save_court_event(uuid,text,text,timestamptz,timestamptz,boolean,text[]) from public,anon;
revoke execute on function public.admin_cancel_court_event(uuid) from public,anon;
grant execute on function public.admin_set_court_open(text,boolean),public.admin_set_daily_target(text,integer),public.admin_save_court_event(uuid,text,text,timestamptz,timestamptz,boolean,text[]),public.admin_cancel_court_event(uuid) to authenticated;
