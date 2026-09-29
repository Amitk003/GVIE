import type { FastifyReply, FastifyRequest } from 'fastify';
import type { infer as ZodInfer, ZodTypeAny } from 'zod';
import { RequestError } from './validation.js';

export type ErrorPayload = {
  error: string;
  details: string[];
};

export function errorPayload(error: unknown): { status: number; payload: ErrorPayload } {
  if (error instanceof RequestError) {
    return { status: error.statusCode, payload: { error: error.message, details: error.details } };
  }
  const message = error instanceof Error ? error.message : 'unknown error';
  return { status: 500, payload: { error: message, details: [] } };
}

/**
 * Parse a request part with a zod schema. On failure it sends a 400 reply and
 * returns null so the calling route can stop early.
 */
export function parseInput<S extends ZodTypeAny>(
  schema: S,
  request: FastifyRequest,
  reply: FastifyReply,
  target: 'body' | 'query' | 'params' = 'body',
): ZodInfer<S> | null {
  const parsed = schema.safeParse(request[target]);
  if (parsed.success) return parsed.data as ZodInfer<S>;
  const details = parsed.error.issues.map((issue) => {
    const path = issue.path.join('.') || target;
    return `${path}: ${issue.message}`;
  });
  reply.code(400).send({ error: `bad ${target}`, details } satisfies ErrorPayload);
  return null;
}


