import type { CourtId, QueueMemberSnapshot } from "./queue-types";

export type GameStatus="PLAYING"|"END_REQUESTED"|"AWAITING_SCORE"|"VALIDATING_RESULT"|"COMPLETED"|"INVALID_SCORE"|"CANCELLED";
export type PostGameTeamStatus="PLAYING"|"DECIDING_CONTINUE"|"HOLDING_COURT"|"DECIDING_REQUEUE"|"WAITING"|"RESTING"|"RETURNING_CHAMPION"|"READY_TO_PLAY"|"LEFT_QUEUE";
export type GameRoster={teamId:string;teamName:string;captainUserId:string;members:QueueMemberSnapshot[];consecutiveWinsBefore:number};
export type GameLifecycle={id:string;courtId:CourtId;teamA:GameRoster;teamB:GameRoster;targetScore:number;startedAt:string;status:GameStatus;isRestGame:boolean;restingChampionTeamId?:string;requestedByTeamId?:string;requestedByUserId?:string;endRequestedAt?:string;confirmedByUserId?:string;winnerTeamId?:string;loserTeamId?:string;finalTeamAScore?:number;finalTeamBScore?:number;completedAt?:string;invalidReason?:ScoreValidationError;postGame?:{winnerStatus:PostGameTeamStatus;winnerConsecutiveWins:number;winnerContinuationDecision?:"PENDING"|"CONTINUE"|"LEAVE";loserStatus:PostGameTeamStatus;nextTeamIds:string[];returningChampionTeamId?:string;restStartedAfterGameId?:string}};
export type PlayerScore={gameId:string;teamId:string;playerId:string;points:number};
export type SubmissionStatus="DRAFT"|"SUBMITTED";
export type ScoreSubmission={id:string;gameId:string;teamId:string;submittedByUserId:string;status:SubmissionStatus;submittedAt?:string;updatedAt:string;playerScores:PlayerScore[]};
export type ScoreValidationError="INCOMPLETE_PLAYERS"|"INVALID_POINTS"|"TIED_SCORE"|"NO_TEAM_REACHED_TARGET"|"BOTH_TEAMS_REACHED_TARGET";
export type RequeueDecisionValue="REQUEUE"|"LEAVE"|"TIMEOUT";
export type PostGameDecision={id:string;gameId:string;courtId:CourtId;teamId:string;captainUserId:string;status:"DECIDING"|"DECIDED";requeueDecisionStartedAt:string;requeueDecisionDeadline:string;decision?:RequeueDecisionValue;decidedAt?:string};
export type PlayerGameHistory={gameId:string;playerId:string;teamId:string;teamType:"THREE_X_THREE"|"FIVE_X_FIVE";courtId:CourtId;completedAt:string;points:number;won:boolean};
export type GameLifecycleError="GAME_NOT_FOUND"|"NOT_CAPTAIN"|"INVALID_GAME_STATUS"|"DUPLICATE_END_REQUEST"|"CANNOT_CONFIRM_OWN_REQUEST"|"NOT_REQUEST_OWNER"|"INVALID_SCORE_VALUE"|"INCOMPLETE_PLAYERS"|"SUBMISSION_LOCKED"|"TEAM_NOT_IN_GAME"|"WAITING_FOR_OTHER_TEAM"|"ALREADY_FINALIZED"|"DECISION_NOT_FOUND"|"DECISION_EXPIRED";
export type GameMutationResult={ok:true;game:GameLifecycle}|{ok:false;error:GameLifecycleError};
export type ScoreSubmitOutcome="WAITING_FOR_OTHER_TEAM"|"INVALID_SCORE"|"COMPLETED";
export type ScoreSubmitResult={outcome?:ScoreSubmitOutcome;error?:GameLifecycleError};
