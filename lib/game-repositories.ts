import type { GameLifecycle, PlayerGameHistory, PostGameDecision, ScoreSubmission } from "./game-lifecycle-types";
import type { QueueMemberSnapshot } from "./queue-types";
type Versioned<T>={version:1;items:T[]};
export interface GameRepository{load():Versioned<GameLifecycle>;save(state:Versioned<GameLifecycle>):void;reset():Versioned<GameLifecycle>}
export interface ScoreSubmissionRepository{load():Versioned<ScoreSubmission>;save(state:Versioned<ScoreSubmission>):void;reset():Versioned<ScoreSubmission>}
export interface PlayerStatisticsRepository{load():Versioned<PlayerGameHistory>;save(state:Versioned<PlayerGameHistory>):void;reset():Versioned<PlayerGameHistory>}
export interface PostGameDecisionRepository{load():Versioned<PostGameDecision>;save(state:Versioned<PostGameDecision>):void;reset():Versioned<PostGameDecision>}
const black:QueueMemberSnapshot[]=[{id:"black-1",displayName:"Beam",initials:"BM"},{id:"black-2",displayName:"Pond",initials:"PD"},{id:"black-3",displayName:"Tee",initials:"TE"}];
const air:QueueMemberSnapshot[]=[{id:"air-1",displayName:"Art",initials:"AR"},{id:"air-2",displayName:"Ice",initials:"IC"},{id:"air-3",displayName:"Run",initials:"RN"}];
export function createDemoGame():GameLifecycle{return{id:"game-demo",courtId:"3x3-b",teamA:{teamId:"queue-team-black",teamName:"Black Cat",captainUserId:"black-1",members:black,consecutiveWinsBefore:0},teamB:{teamId:"queue-team-air",teamName:"Air Ball",captainUserId:"air-1",members:air,consecutiveWinsBefore:0},targetScore:7,startedAt:new Date(Date.now()-12*60*1000).toISOString(),status:"PLAYING",isRestGame:false}}
class LocalVersionedRepository<T>{constructor(private key:string,private factory:()=>Versioned<T>,private validate:(item:unknown)=>boolean){}load():Versioned<T>{try{const raw=localStorage.getItem(this.key);if(!raw)return this.reset();const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||(parsed as Versioned<T>).version!==1||!Array.isArray((parsed as Versioned<T>).items)||(parsed as Versioned<T>).items.some((item)=>!this.validate(item)))return this.reset();return parsed as Versioned<T>}catch{return this.reset()}}save(state:Versioned<T>){localStorage.setItem(this.key,JSON.stringify(state))}reset(){const state=this.factory();this.save(state);return state}}
export class LocalStorageGameRepository extends LocalVersionedRepository<GameLifecycle> implements GameRepository{
  constructor(){super("meq-games-v1",()=>({version:1,items:[createDemoGame()]}),(item)=>Boolean(item)&&typeof (item as GameLifecycle).id==="string"&&typeof (item as GameLifecycle).status==="string")}
  save(state:Versioned<GameLifecycle>){const unique=new Map(state.items.map((item)=>[item.id,item]));super.save({version:1,items:[...unique.values()]})}
  load(){const state=super.load(),unique=new Map(state.items.map((item)=>[item.id,item]));const normalized={version:1 as const,items:[...unique.values()]};if(normalized.items.length!==state.items.length)super.save(normalized);return normalized}
}
export class LocalStorageScoreSubmissionRepository extends LocalVersionedRepository<ScoreSubmission> implements ScoreSubmissionRepository{
  constructor(){super("meq-score-submissions-v1",()=>({version:1,items:[]}),(item)=>Boolean(item)&&typeof (item as ScoreSubmission).id==="string"&&typeof (item as ScoreSubmission).gameId==="string"&&typeof (item as ScoreSubmission).teamId==="string"&&Array.isArray((item as ScoreSubmission).playerScores))}
  save(state:Versioned<ScoreSubmission>){const unique=new Map(state.items.map((item)=>[`${item.gameId}:${item.teamId}`,item]));super.save({version:1,items:[...unique.values()]})}
  load(){const state=super.load(),unique=new Map(state.items.map((item)=>[`${item.gameId}:${item.teamId}`,item]));const normalized={version:1 as const,items:[...unique.values()]};if(normalized.items.length!==state.items.length)super.save(normalized);return normalized}
}
export class LocalStoragePlayerStatisticsRepository extends LocalVersionedRepository<PlayerGameHistory> implements PlayerStatisticsRepository{
  constructor(){super("meq-player-history-v1",()=>({version:1,items:[]}),(item)=>Boolean(item)&&typeof (item as PlayerGameHistory).gameId==="string"&&typeof (item as PlayerGameHistory).playerId==="string"&&Number.isInteger((item as PlayerGameHistory).points))}
  save(state:Versioned<PlayerGameHistory>){const unique=new Map(state.items.map((item)=>[`${item.gameId}:${item.playerId}`,item]));super.save({version:1,items:[...unique.values()]})}
}
export class LocalStoragePostGameDecisionRepository extends LocalVersionedRepository<PostGameDecision> implements PostGameDecisionRepository{constructor(){super("meq-postgame-decisions-v1",()=>({version:1,items:[]}),(item)=>Boolean(item)&&typeof (item as PostGameDecision).id==="string"&&typeof (item as PostGameDecision).requeueDecisionDeadline==="string")}}
