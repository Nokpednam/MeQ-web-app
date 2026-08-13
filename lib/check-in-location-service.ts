import type { LocationStatus } from "./check-in-types";
export interface LocationService { getStatus(userId: string): LocationStatus }
export class MockLocationService implements LocationService {
  constructor(private readonly locations: Record<string, LocationStatus>) {}
  getStatus(userId: string): LocationStatus { return this.locations[userId] ?? "WITHIN_RANGE"; }
}
