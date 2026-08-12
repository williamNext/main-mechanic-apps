export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'MECHANIC_NOT_FOUND'
  | 'TIMESLOT_NOT_FOUND'
  | 'APPOINTMENT_NOT_FOUND'
  | 'NOTIFICATION_NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'TIMESLOT_UNAVAILABLE'
  | 'TIMESLOT_EXPIRED'
  | 'MECHANIC_UNAVAILABLE'
  | 'APPOINTMENT_NOT_CANCELLABLE'
  | 'NOT_IMPLEMENTED'
  | 'DATABASE_BUSY'
  | 'INTERNAL_ERROR';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: ErrorCode,
  ) {
    super(message);
  }
}

export const NotFound = (m: string, code: ErrorCode) => new HttpError(404, m, code);
export const Conflict = (m: string, code: ErrorCode) => new HttpError(409, m, code);
