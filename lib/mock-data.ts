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
    status: "OPEN",
    targetScore: 7,
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
    status: "OPEN",
    targetScore: 7,
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
    status: "OPEN",
    targetScore: 15,
    queue: [
      { position: 1, team: "Engineering", state: "WAITING" },
      { position: 2, team: "Alumni", state: "WAITING" },
    ],
  },
];

export type PlayerStatsView = {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPoints: number;
  averagePoints: number;
  highestScoreInGame: number;
};

export const playerStats: PlayerStatsView = {
  totalGames: 18,
  wins: 11,
  losses: 7,
  winRate: 61,
  totalPoints: 86,
  averagePoints: 4.8,
  highestScoreInGame: 9,
};

export const playerStatsByFormat = {
  THREE_X_THREE: { totalGames: 12, wins: 8, losses: 4, winRate: 67, totalPoints: 46, averagePoints: 3.8, highestScoreInGame: 7 },
  FIVE_X_FIVE: { totalGames: 6, wins: 3, losses: 3, winRate: 50, totalPoints: 40, averagePoints: 6.7, highestScoreInGame: 9 },
} as const satisfies Record<"THREE_X_THREE" | "FIVE_X_FIVE", PlayerStatsView>;

export const upcomingEvents = [
  { date: "8 ส.ค.", title: "งดใช้ Full Court 2", detail: "กิจกรรมมหาวิทยาลัย 16:00–20:00" },
  { date: "12 ส.ค.", title: "ตรวจระบบไฟ", detail: "อาจปิดสนามช่วง 09:00–10:30" },
  { date: "18 ส.ค.", title: "ทำความสะอาดพื้นสนาม", detail: "งดใช้ทั้ง 2 Full Court 05:00–08:00" },
];
