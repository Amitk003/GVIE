import type { infer as ZodInfer, ZodTypeAny } from 'zod';

export class RequestError extends Error {
  readonly statusCode: number;
  readonly details: string[];

  constructor(statusCode: number, message: string, details: string[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message: string, details: string[] = []): RequestError {
  return new RequestError(400, message, details);
}

export function parseOrThrow<S extends ZodTypeAny>(
  schema: S,
  value: unknown,
  label = 'body',
): ZodInfer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.') || label;
      return `${path}: ${issue.message}`;
    });
    throw badRequest(`bad ${label}`, details);
  }
  return parsed.data as ZodInfer<S>;
}
