export interface LocationChecker {
  isInRange(): boolean;
}

export class MockLocationChecker implements LocationChecker {
  constructor(private readonly inRange: boolean) {}

  isInRange(): boolean {
    return this.inRange;
  }
}
