export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const NotFound = (m: string) => new HttpError(404, m);
export const Conflict = (m: string) => new HttpError(409, m);
