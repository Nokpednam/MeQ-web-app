import { CHECK_IN_SECONDS } from "./meq-domain";
import { reorderQueuePositions } from "./queue-rules";
import type { CheckInDataState, CheckInError, CheckInResult, LocationStatus, MockGame, TeamCheckInSession } from "./check-in-types";
import type { Court, CourtId, QueueDataState, QueueMemberSnapshot, QueueTeamSnapshot } from "./queue-types";

type Transition = { queueState: QueueDataState; checkInState: CheckInDataState; result: CheckInResult };

export function getCheckInTimeRemaining(deadline: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(deadline) - nowMs) / 1000));
}

export function getCheckedInMemberCount(session: TeamCheckInSession): number { return session.checkIns.length; }
export function isTeamFullyCheckedIn(session: TeamCheckInSession): boolean { return session.members.length > 0 && session.checkIns.length === session.members.length; }

export function canMemberCheckIn(session: TeamCheckInSession, userId: string, location: LocationStatus, nowMs: number): CheckInError | null {
  if (session.status !== "CALLED" && session.status !== "CHECKING_IN") return "SESSION_NOT_FOUND";
  if (getCheckInTimeRemaining(session.checkInDeadline, nowMs) === 0) return "DEADLINE_EXPIRED";
  if (!session.members.some((member) => member.id === userId)) return "MEMBER_NOT_IN_TEAM";
  if (session.checkIns.some((item) => item.userId === userId)) return "ALREADY_CHECKED_IN";
  if (location === "OUT_OF_RANGE") return "OUT_OF_RANGE";
  if (location === "PERMISSION_DENIED") return "PERMISSION_DENIED";
  return null;
}

export function canMemberCancelCheckIn(session: TeamCheckInSession, userId: string): CheckInError | null {
  if (session.status === "READY_TO_PLAY" || session.status === "PLAYING") return "CANNOT_CANCEL";
  if (!session.members.some((member) => member.id === userId)) return "MEMBER_NOT_IN_TEAM";
  if (!session.checkIns.some((item) => item.userId === userId)) return "NOT_CHECKED_IN";
  return null;
}

export function releaseOrphanCheckInEntries(queueState:QueueDataState,checkInState:CheckInDataState,courtId:CourtId,nowIso:string):QueueDataState {
  const activeSessionEntryIds=new Set(checkInState.sessions.filter((session)=>session.courtId===courtId&&(session.status==="CALLED"||session.status==="CHECKING_IN")).map((session)=>session.queueEntryId));
  let nextPosition=queueState.entries.filter((entry)=>entry.courtId===courtId&&entry.status==="WAITING").reduce((max,entry)=>Math.max(max,entry.position),0);
  const entries=queueState.entries.map((entry)=>entry.courtId===courtId&&(entry.status==="CALLED"||entry.status==="CHECKING_IN")&&!activeSessionEntryIds.has(entry.id)?{...entry,status:"WAITING" as const,position:++nextPosition,joinedAt:nowIso,calledAt:undefined,checkInDeadline:undefined}:entry);
  return {...queueState,entries:reorderQueuePositions(entries,courtId)};
}

export function callNextTeam(queueState: QueueDataState, checkInState: CheckInDataState, courtId: CourtId, team: QueueTeamSnapshot | null, nowIso: string): Transition {
  const normalizedQueue=releaseOrphanCheckInEntries(queueState,checkInState,courtId,nowIso);
  if (checkInState.sessions.some((session) => session.courtId === courtId && (session.status === "CALLED" || session.status === "CHECKING_IN"))) return { queueState:normalizedQueue, checkInState, result: { ok: false, error: "TEAM_ALREADY_CALLED" } };
  const head = normalizedQueue.entries.filter((entry) => entry.courtId === courtId && entry.status === "WAITING").sort((a,b)=>a.position-b.position||a.joinedAt.localeCompare(b.joinedAt))[0];
  if (!head || !team) return { queueState:normalizedQueue, checkInState, result: { ok: false, error: "NO_WAITING_TEAM" } };
  const deadline = new Date(Date.parse(nowIso) + CHECK_IN_SECONDS * 1000).toISOString();
  const entries = reorderQueuePositions(normalizedQueue.entries.map((entry) => entry.id === head.id ? { ...entry, status: "CALLED" as const, position: 0, calledAt: nowIso, checkInDeadline: deadline } : entry), courtId);
  const session: TeamCheckInSession = { id: `checkin-${crypto.randomUUID()}`, queueEntryId: head.id, courtId, teamId: team.id, teamName: team.name, members: team.members.map((member)=>({...member})), status: "CALLED", calledAt: nowIso, checkInDeadline: deadline, checkIns: [] };
  return { queueState: { ...normalizedQueue, entries }, checkInState: { ...checkInState, sessions: [...checkInState.sessions, session] }, result: { ok: true, session } };
}

export function beginTeamCheckIn(queueState: QueueDataState, checkInState: CheckInDataState, sessionId: string): Transition {
  const session = checkInState.sessions.find((item)=>item.id===sessionId);
  if (!session) return { queueState, checkInState, result:{ok:false,error:"SESSION_NOT_FOUND"} };
  const nextSession={...session,status:"CHECKING_IN" as const};
  return { queueState:{...queueState,entries:queueState.entries.map((entry)=>entry.id===session.queueEntryId?{...entry,status:"CHECKING_IN"}:entry)}, checkInState:{...checkInState,sessions:checkInState.sessions.map((item)=>item.id===session.id?nextSession:item)}, result:{ok:true,session:nextSession} };
}

export function checkInMember(queueState: QueueDataState, checkInState: CheckInDataState, sessionId: string, userId: string, location: LocationStatus, nowIso: string): Transition {
  const session=checkInState.sessions.find((item)=>item.id===sessionId);
  if(!session)return {queueState,checkInState,result:{ok:false,error:"SESSION_NOT_FOUND"}};
  const error=canMemberCheckIn(session,userId,location,Date.parse(nowIso));
  if(error)return {queueState,checkInState,result:{ok:false,error}};
  const pending={...session,status:"CHECKING_IN" as const,checkIns:[...session.checkIns,{userId,checkedInAt:nowIso,locationStatus:"WITHIN_RANGE" as const}]};
  const nextSession={...pending,status:isTeamFullyCheckedIn(pending)?"READY_TO_PLAY" as const:"CHECKING_IN" as const};
  return {queueState:{...queueState,entries:queueState.entries.map((entry)=>entry.id===session.queueEntryId?{...entry,status:nextSession.status}:entry)},checkInState:{...checkInState,sessions:checkInState.sessions.map((item)=>item.id===session.id?nextSession:item)},result:{ok:true,session:nextSession}};
}

export function cancelMemberCheckIn(queueState: QueueDataState, checkInState: CheckInDataState, sessionId: string, userId: string): Transition {
  const session=checkInState.sessions.find((item)=>item.id===sessionId); if(!session)return {queueState,checkInState,result:{ok:false,error:"SESSION_NOT_FOUND"}};
  const error=canMemberCancelCheckIn(session,userId); if(error)return {queueState,checkInState,result:{ok:false,error}};
  const nextSession={...session,status:"CHECKING_IN" as const,checkIns:session.checkIns.filter((item)=>item.userId!==userId)};
  return {queueState:{...queueState,entries:queueState.entries.map((entry)=>entry.id===session.queueEntryId?{...entry,status:"CHECKING_IN"}:entry)},checkInState:{...checkInState,sessions:checkInState.sessions.map((item)=>item.id===session.id?nextSession:item)},result:{ok:true,session:nextSession}};
}

export function markTeamMissedQueue(queueState: QueueDataState, checkInState: CheckInDataState, sessionId: string, nowIso: string): Transition {
  const session=checkInState.sessions.find((item)=>item.id===sessionId); if(!session)return {queueState,checkInState,result:{ok:false,error:"SESSION_NOT_FOUND"}};
  if(session.status==="READY_TO_PLAY"||session.status==="PLAYING")return {queueState,checkInState,result:{ok:true,session}};
  const nextSession={...session,status:"MISSED_QUEUE" as const,missedAt:nowIso,missedReason:"CHECK_IN_TIMEOUT" as const};
  const entries=reorderQueuePositions(queueState.entries.map((entry)=>entry.id===session.queueEntryId?{...entry,status:"MISSED_QUEUE" as const,position:0,missedAt:nowIso,missedReason:"CHECK_IN_TIMEOUT" as const}:entry),session.courtId);
  return {queueState:{...queueState,entries},checkInState:{...checkInState,sessions:checkInState.sessions.map((item)=>item.id===session.id?nextSession:item)},result:{ok:true,session:nextSession}};
}

export function expireCheckInIfNeeded(queueState: QueueDataState, checkInState: CheckInDataState, nowIso: string): Transition {
  let transition:Transition={queueState,checkInState,result:{ok:true}};
  for(const session of transition.checkInState.sessions.filter((item)=>(item.status==="CALLED"||item.status==="CHECKING_IN")&&getCheckInTimeRemaining(item.checkInDeadline,Date.parse(nowIso))===0)){ transition=markTeamMissedQueue(transition.queueState,transition.checkInState,session.id,nowIso); }
  return transition;
}

export function callReplacementTeam(queueState: QueueDataState, checkInState: CheckInDataState, courtId: CourtId, team: QueueTeamSnapshot | null, nowIso:string):Transition { const expired=expireCheckInIfNeeded(queueState,checkInState,nowIso); return callNextTeam(expired.queueState,expired.checkInState,courtId,team,nowIso); }

export function canStartGame(queueState:QueueDataState,checkInState:CheckInDataState,courtId:CourtId):CheckInError|null { if(checkInState.games.some((game)=>game.courtId===courtId&&game.status==="PLAYING"))return "GAME_ALREADY_ACTIVE";const hasHoldingWinner=queueState.entries.some((entry)=>entry.courtId===courtId&&entry.status==="HOLDING_COURT");const hasReturningChampion=queueState.entries.some((entry)=>entry.courtId===courtId&&entry.status==="RETURNING_CHAMPION");const requiredReadyTeams=hasHoldingWinner&&hasReturningChampion?0:hasHoldingWinner?1:2;return queueState.entries.filter((entry)=>entry.courtId===courtId&&entry.status==="READY_TO_PLAY").length>=requiredReadyTeams?null:"NOT_ENOUGH_READY_TEAMS"; }

export function releaseOrphanPlayingEntries(queueState:QueueDataState,courtId:CourtId):QueueDataState {
  let nextPosition=queueState.entries.filter((entry)=>entry.courtId===courtId&&entry.status==="WAITING").reduce((max,entry)=>Math.max(max,entry.position),0);
  const entries=queueState.entries.map((entry)=>entry.courtId===courtId&&entry.status==="PLAYING"?{...entry,status:"WAITING" as const,position:++nextPosition}:entry);
  return {...queueState,entries:reorderQueuePositions(entries,courtId)};
}

export function startMockGame(queueState:QueueDataState,checkInState:CheckInDataState,court:Court,nowIso:string,holdingTeam:QueueTeamSnapshot|null=null,returningChampionTeam:QueueTeamSnapshot|null=null):Transition {
  const error=canStartGame(queueState,checkInState,court.id); if(error)return {queueState,checkInState,result:{ok:false,error}};
  const holdingEntry=queueState.entries.find((entry)=>entry.courtId===court.id&&entry.status==="HOLDING_COURT");
  const returningEntry=queueState.entries.find((entry)=>entry.courtId===court.id&&entry.status==="RETURNING_CHAMPION");
  const restingEntry=queueState.entries.find((entry)=>entry.courtId===court.id&&entry.status==="RESTING");
  const returningPairReady=Boolean(holdingEntry&&returningEntry);
  const preparedQueue=returningPairReady?{...queueState,entries:reorderQueuePositions(queueState.entries.map((entry)=>entry.courtId===court.id&&entry.teamId!==holdingEntry!.teamId&&entry.teamId!==returningEntry!.teamId&&(["CALLED","CHECKING_IN","READY_TO_PLAY"] as const).includes(entry.status as "CALLED"|"CHECKING_IN"|"READY_TO_PLAY")?{...entry,status:"WAITING" as const}:entry),court.id)}:queueState;
  const preparedCheckIn=returningPairReady?{...checkInState,sessions:checkInState.sessions.filter((session)=>session.courtId!==court.id||session.teamId===holdingEntry!.teamId||session.teamId===returningEntry!.teamId)}:checkInState;
  const requiredReadyTeams=holdingEntry&&returningEntry?0:holdingEntry?1:2;
  const ready=preparedCheckIn.sessions.filter((session)=>session.courtId===court.id&&session.status==="READY_TO_PLAY").slice(0,requiredReadyTeams); if(ready.length<requiredReadyTeams||Boolean(holdingEntry)!==Boolean(holdingTeam))return {queueState:preparedQueue,checkInState:preparedCheckIn,result:{ok:false,error:"NOT_ENOUGH_READY_TEAMS"}};
  const normalizedQueue=releaseOrphanPlayingEntries(preparedQueue,court.id);
  const [firstReady,secondReady]=ready;
  const teamA=holdingTeam??{id:firstReady.teamId,name:firstReady.teamName,members:firstReady.members};
  const returningTeam=returningEntry?(returningChampionTeam??queueState.mockTeams.find((team)=>team.id===returningEntry.teamId)??null):null;
  if(returningEntry&&!returningTeam)return {queueState:preparedQueue,checkInState:preparedCheckIn,result:{ok:false,error:"NOT_ENOUGH_READY_TEAMS"}};
  const teamB=returningTeam??(holdingTeam?{id:firstReady.teamId,name:firstReady.teamName,members:firstReady.members}:{id:secondReady.teamId,name:secondReady.teamName,members:secondReady.members});
  const game:MockGame={id:`game-${crypto.randomUUID()}`,courtId:court.id,teamAId:teamA.id,teamAName:teamA.name,teamAMembers:teamA.members.map((m:QueueMemberSnapshot)=>({...m})),teamBId:teamB.id,teamBName:teamB.name,teamBMembers:teamB.members.map((m:QueueMemberSnapshot)=>({...m})),...(returningTeam?{teamBConsecutiveWinsBefore:0}:{}),targetScore:court.targetScore,startedAt:nowIso,status:"PLAYING",...(restingEntry&&!holdingEntry?{isRestGame:true,restingChampionTeamId:restingEntry.teamId}:{})};
  const ids=new Set([...(holdingEntry?[holdingEntry.id]:[]),...(returningEntry?[returningEntry.id]:[]),...ready.map((session)=>session.queueEntryId)]); const sessionIds=new Set(ready.map((session)=>session.id));
  return {queueState:{...normalizedQueue,entries:normalizedQueue.entries.map((entry)=>ids.has(entry.id)?{...entry,status:"PLAYING",position:0}:entry)},checkInState:{...preparedCheckIn,games:[...preparedCheckIn.games,game],sessions:preparedCheckIn.sessions.map((session)=>sessionIds.has(session.id)?{...session,status:"PLAYING"}:session)},result:{ok:true,game}};
}
