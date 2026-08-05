import type { CheckInError } from "./check-in-types"; import type { CheckInCopy } from "./check-in-translations";
export function getCheckInError(error:CheckInError,copy:CheckInCopy){return copy[`error_${error}` as keyof CheckInCopy];}
