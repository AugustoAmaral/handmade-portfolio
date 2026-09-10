import type { NextFunction, Request, Response } from 'express'
import { fieldErrorsFromIssues } from '@shop/shared'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.fieldErrors && { fieldErrors: err.fieldErrors }) },
    })
    return
  }
  if (err instanceof ZodError) {
    // The mapping is `@shop/shared`'s, not this file's: the browser parses the same request with
    // the same schema before it ever posts, so the field names it hangs errors on have to be the
    // ones this handler would have produced.
    const fieldErrors = fieldErrorsFromIssues(err.issues)
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid request', fieldErrors } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } })
}
