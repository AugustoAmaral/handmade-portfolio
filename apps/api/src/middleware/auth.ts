import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { getEnv } from '../env.js'
import { AppError } from '../errors.js'

export function adminGuard(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  try {
    jwt.verify(token, getEnv().JWT_SECRET)
    next()
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid token'))
  }
}
