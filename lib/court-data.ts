import type { Court, CourtId } from "./queue-types";

export const courts: Court[] = [
  {
    id: "3x3-a",
    name: "3x3 A",
    type: "THREE_X_THREE",
    requiredMembers: 3,
    image: "/courts/3x3-a.svg",
    isOpen: true,
    opensAt: "05:00",
    closesAt: "24:00",
    targetScore: 7,
    allowedTargetScores: [7, 9, 11],
    currentGame: { home: "Falcon", away: "Red Fox", status: "PLAYING" },
  },
  {
    id: "3x3-b",
    name: "3x3 B",
    type: "THREE_X_THREE",
    requiredMembers: 3,
    image: "/courts/3x3-b.svg",
    isOpen: true,
    opensAt: "05:00",
    closesAt: "24:00",
    targetScore: 7,
    allowedTargetScores: [7, 9, 11],
    currentGame: { home: "Phoenix", away: "Mango", status: "PLAYING" },
  },
  {
    id: "5x5",
    name: "5x5",
    type: "FIVE_X_FIVE",
    requiredMembers: 5,
    image: "/courts/5x5.svg",
    isOpen: true,
    opensAt: "05:00",
    closesAt: "24:00",
    targetScore: 15,
    allowedTargetScores: [11, 15, 21],
    currentGame: { home: "Engineering", away: "Alumni", status: "AWAITING_SCORE" },
  },
];

export function getCourtById(courtId: string): Court | null {
  return courts.find((court) => court.id === courtId) ?? null;
}

export function isCourtId(value: string): value is CourtId {
  return courts.some((court) => court.id === value);
}
