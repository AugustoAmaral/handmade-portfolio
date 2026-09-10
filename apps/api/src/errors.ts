import type { NextFunction, Request, Response } from 'express'
import { MAX_PHOTO_BYTES, fieldErrorsFromIssues } from '@shop/shared'
import { MulterError } from 'multer'
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
  // The photo upload's own refusals, and the reason this branch exists: a `MulterError` is neither
  // an `AppError` nor a `ZodError`, so it used to fall through to the line at the bottom and answer
  // a request the server understood perfectly well with the body a crash produces. Nothing else on
  // the branch reaches this handler through middleware rather than through a route.
  //
  // The size limit is the only one with a status of its own. 413 is what `LIMIT_FILE_SIZE` means
  // and 400 is what the rest mean — an unexpected part, a second file, a text field over multer's
  // own 1 MB field cap — so the code is what the panel branches on and the message carries multer's
  // reason for whoever is reading a response by hand.
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      // The number is `@shop/shared`'s, the same constant multer is configured with and the panel
      // refuses on, so this sentence cannot drift away from the limit it describes.
      res.status(413).json({
        error: { code: 'PHOTO_TOO_LARGE', message: `Photo is larger than ${MAX_PHOTO_BYTES / 1024 / 1024} MB` },
      })
      return
    }
    res.status(400).json({ error: { code: 'BAD_UPLOAD', message: `Upload rejected: ${err.message}` } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } })
}
