export type ApiResponse<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: { message: string; code: ErrorCode };
    };

export type ErrorCode =
  | "NOT_FOUND"
  | "PASTE_NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export interface Paste {
  id: string;
  content: Uint8Array;
  createdAt: Date;
  updatedAt: Date;
}
