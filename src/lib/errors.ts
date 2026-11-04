/**
 * Application-level error types. Server actions translate these into safe,
 * human messages; raw SQL and stack details never reach the client.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, code = "APP_ERROR", status = 400) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the submitted details and try again.") {
    super(message, "VALIDATION_ERROR", 422);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sign in to continue.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this operation.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "That record could not be found.") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "That change conflicts with a current booking.") {
    super(message, "CONFLICT", 409);
  }
}

export class NoSeatsAvailableError extends AppError {
  constructor(message = "No seats remain for that journey. Join the waitlist to keep your place.") {
    super(message, "NO_SEATS", 409);
  }
}

export class HoldExpiredError extends AppError {
  constructor(
    message = "Your seat hold has expired. Seats were released — please select again.",
  ) {
    super(message, "HOLD_EXPIRED", 410);
  }
}

export class DuplicateRequestError extends AppError {
  constructor(message = "This request was already submitted.") {
    super(message, "DUPLICATE_REQUEST", 409);
  }
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: string; constraint_name?: string; message?: string };
  if (candidate.code !== "23505") return false;
  if (!constraint) return true;
  return (
    candidate.constraint_name === constraint ||
    (candidate.message ?? "").includes(constraint)
  );
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.name === "DatabaseNotConfiguredError") {
    return error.message;
  }
  return "Something went wrong on our side. Please try again.";
}
