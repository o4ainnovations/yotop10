export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      id ? `${entity} not found: ${id}` : `${entity} not found`,
      'NOT_FOUND',
      404,
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class AuthError extends AppError {
  constructor(message: string, code: string = 'UNAUTHORIZED') {
    super(message, code, 401);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION', 400);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 'RATE_LIMITED', 429);
  }
}
