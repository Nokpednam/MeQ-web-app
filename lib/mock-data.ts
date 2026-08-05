import type { CourtType, TeamState } from "./meq-domain";

export type CourtView = {
  id: string;
  name: string;
  type: CourtType;
  image: string;
  status: "OPEN" | "BUSY" | "CLOSED";
  targetScore: number;
  playing?: { home: string; away: string; continuingTeam?: string; consecutiveWins?: number };
  awaitingScore?: { home: string; away: string };
  queue: { position: number; team: string; state: TeamState }[];
};

export const courts: CourtView[] = [
  {
    id: "3x3-a",
    name: "3x3 A",
    type: "THREE_X_THREE",
    image: "/courts/3x3-a.svg",
    status: "BUSY",
    targetScore: 7,
    playing: { home: "Falcon", away: "Red Fox", continuingTeam: "Falcon", consecutiveWins: 1 },
    queue: [
      { position: 1, team: "North Star", state: "WAITING" },
      { position: 2, team: "Blue Wave", state: "WAITING" },
      { position: 3, team: "NU Rookie", state: "WAITING" },
    ],
  },
  {
    id: "3x3-b",
    name: "3x3 B",
    type: "THREE_X_THREE",
    image: "/courts/3x3-b.svg",
    status: "BUSY",
    targetScore: 7,
    playing: { home: "Phoenix", away: "Mango" },
    queue: [
      { position: 1, team: "Black Cat", state: "CHECK_IN_REQUIRED" },
      { position: 2, team: "Air Ball", state: "WAITING" },
    ],
  },
  {
    id: "5x5",
    name: "5x5",
    type: "FIVE_X_FIVE",
    image: "/courts/5x5.svg",
    status: "BUSY",
    targetScore: 15,
    awaitingScore: { home: "Thunder", away: "Orbit" },
    queue: [
      { position: 1, team: "Engineering", state: "WAITING" },
      { position: 2, team: "Alumni", state: "WAITING" },
    ],
  },
];

type GameViewBase = {
  id: string;
  court: string;
  home: string;
  away: string;
  targetScore: number;
};

export type PlayingGameView = GameViewBase & {
  status: "PLAYING";
  continuingTeam?: string;
  consecutiveWins?: number;
};

export type AwaitingScoreGameView = GameViewBase & {
  status: "AWAITING_SCORE";
};

export type CompletedGameView = GameViewBase & {
  status: "COMPLETED";
  homeScore: number;
  awayScore: number;
  winner: string;
  completedAt: string;
};

export type GameView = PlayingGameView | AwaitingScoreGameView | CompletedGameView;

export const games: GameView[] = [
  { id: "game-101", court: "3x3 A", home: "Falcon", away: "Red Fox", targetScore: 7, status: "PLAYING", continuingTeam: "Falcon", consecutiveWins: 1 },
  { id: "game-102", court: "3x3 B", home: "Phoenix", away: "Mango", targetScore: 7, status: "PLAYING" },
  { id: "game-103", court: "5x5", home: "Thunder", away: "Orbit", targetScore: 15, status: "AWAITING_SCORE" },
  { id: "game-098", court: "3x3 A", home: "North Star", away: "Air Ball", targetScore: 7, status: "COMPLETED", homeScore: 7, awayScore: 4, winner: "North Star", completedAt: "14:32" },
  { id: "game-097", court: "5x5", home: "Engineering", away: "Alumni", targetScore: 15, status: "COMPLETED", homeScore: 15, awayScore: 11, winner: "Engineering", completedAt: "13:48" },
];

export type PlayerStatsView = {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPoints: number;
  averagePoints: number;
};

export const playerStats: PlayerStatsView = {
  totalGames: 18,
  wins: 11,
  losses: 7,
  winRate: 61,
  totalPoints: 86,
  averagePoints: 4.8,
};

export const upcomingEvents = [
  { date: "8 ส.ค.", title: "งดใช้ Full Court 2", detail: "กิจกรรมมหาวิทยาลัย 16:00–20:00" },
  { date: "12 ส.ค.", title: "ตรวจระบบไฟ", detail: "อาจปิดสนามช่วง 09:00–10:30" },
  { date: "18 ส.ค.", title: "ทำความสะอาดพื้นสนาม", detail: "งดใช้ทั้ง 2 Full Court 05:00–08:00" },
];
