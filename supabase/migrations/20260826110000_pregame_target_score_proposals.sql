-- Captains may agree on an allowed target score before the second team starts the game.

create table public.game_target_score_proposals (
  id uuid primary key default gen_random_uuid(),
  court_id text not null references public.courts(id),
  proposer_check_in_id uuid not null references public.team_check_ins(id),
  opponent_check_in_id uuid not null references public.team_check_ins(id),
  proposed_by_team_id uuid not null references public.teams(id),
  target_score integer not null check (target_score > 0),
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','APPLIED','CANCELLED')),
  confirmed_by_team_id uuid references public.teams(id),
  proposed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint different_proposal_check_ins check (proposer_check_in_id <> opponent_check_in_id)
);

create unique index one_open_target_proposal_per_court
  on public.game_target_score_proposals(court_id)
  where status in ('PENDING','CONFIRMED');

alter table public.game_target_score_proposals enable row level security;
create policy target_proposals_read on public.game_target_score_proposals
  for select to authenticated using (true);
revoke all on public.game_target_score_proposals from anon,authenticated;
grant select on public.game_target_score_proposals to authenticated;

create or replace function public.propose_game_target_score(p_check_in_id uuid,p_target_score integer)
returns public.game_target_score_proposals language plpgsql security definer set search_path='' as $$
declare v_own public.team_check_ins;v_other public.team_check_ins;v_allowed integer[];v_result public.game_target_score_proposals;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_own from public.team_check_ins where id=p_check_in_id for update;
  if v_own.id is null then raise exception using errcode='P0002',message='SESSION_NOT_FOUND'; end if;
  if not private.is_team_captain(v_own.team_id) then raise exception using errcode='42501',message='CAPTAIN_ONLY'; end if;
  perform pg_advisory_xact_lock(hashtext('meq-target-'||v_own.court_id));
  perform private.expire_court_check_ins(v_own.court_id);
  select * into v_own from public.team_check_ins where id=p_check_in_id;
  if v_own.status not in ('ACTIVE','READY') then raise exception using errcode='23514',message='SESSION_NOT_ACTIVE'; end if;
  select * into v_other from public.team_check_ins where court_id=v_own.court_id and id<>v_own.id
    and status in ('ACTIVE','READY') order by created_at,id limit 1 for update;
  if v_other.id is null then raise exception using errcode='P0002',message='OPPONENT_NOT_CALLED'; end if;
  select g.allowed_target_scores into v_allowed from public.courts c join public.court_groups g on g.id=c.court_group_id where c.id=v_own.court_id;
  if not p_target_score=any(v_allowed) then raise exception using errcode='23514',message='INVALID_TARGET_SCORE'; end if;
  update public.game_target_score_proposals set status='CANCELLED'
    where court_id=v_own.court_id and status in ('PENDING','CONFIRMED');
  insert into public.game_target_score_proposals(court_id,proposer_check_in_id,opponent_check_in_id,proposed_by_team_id,target_score)
    values(v_own.court_id,v_own.id,v_other.id,v_own.team_id,p_target_score) returning * into v_result;
  return v_result;
end;$$;

create or replace function public.confirm_game_target_score(p_proposal_id uuid)
returns public.game_target_score_proposals language plpgsql security definer set search_path='' as $$
declare v_result public.game_target_score_proposals;v_opponent public.team_check_ins;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  select * into v_result from public.game_target_score_proposals where id=p_proposal_id for update;
  if v_result.id is null then raise exception using errcode='P0002',message='PROPOSAL_NOT_FOUND'; end if;
  if v_result.status<>'PENDING' then raise exception using errcode='23514',message='PROPOSAL_NOT_PENDING'; end if;
  select * into v_opponent from public.team_check_ins where id=v_result.opponent_check_in_id for update;
  if v_opponent.status not in ('ACTIVE','READY') then raise exception using errcode='23514',message='SESSION_NOT_ACTIVE'; end if;
  if not private.is_team_captain(v_opponent.team_id) then raise exception using errcode='42501',message='OPPONENT_CAPTAIN_ONLY'; end if;
  update public.game_target_score_proposals set status='CONFIRMED',confirmed_by_team_id=v_opponent.team_id,confirmed_at=now()
    where id=p_proposal_id returning * into v_result;
  return v_result;
end;$$;

create or replace function private.apply_confirmed_game_target_score()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_proposal public.game_target_score_proposals;
begin
  select p.* into v_proposal
  from public.game_target_score_proposals p
  join public.team_check_ins proposer on proposer.id=p.proposer_check_in_id
  join public.team_check_ins opponent on opponent.id=p.opponent_check_in_id
  where p.court_id=new.court_id and p.status='CONFIRMED'
    and proposer.status='READY' and opponent.status='READY'
    and array[proposer.team_id,opponent.team_id]::uuid[] @> array[new.team_a_id,new.team_b_id]::uuid[]
    and array[new.team_a_id,new.team_b_id]::uuid[] @> array[proposer.team_id,opponent.team_id]::uuid[]
  order by p.confirmed_at desc limit 1 for update of p;
  if v_proposal.id is not null then
    new.target_score:=v_proposal.target_score;
    update public.game_target_score_proposals set status='APPLIED' where id=v_proposal.id;
    insert into public.audit_logs(action,entity_type,entity_id,payload)
      values('GAME_TARGET_SCORE_APPLIED','game',new.id::text,
        jsonb_build_object('proposalId',v_proposal.id,'targetScore',v_proposal.target_score));
  end if;
  return new;
end;$$;

create trigger apply_confirmed_game_target_score
before insert on public.games for each row execute function private.apply_confirmed_game_target_score();

revoke execute on function public.propose_game_target_score(uuid,integer) from public,anon;
revoke execute on function public.confirm_game_target_score(uuid) from public,anon;
grant execute on function public.propose_game_target_score(uuid,integer) to authenticated;
grant execute on function public.confirm_game_target_score(uuid) to authenticated;
revoke execute on function private.apply_confirmed_game_target_score() from public,anon,authenticated;
