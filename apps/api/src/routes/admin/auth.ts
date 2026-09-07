import { loginSchema } from '@shop/shared'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { getEnv } from '../../env.js'
import { AppError } from '../../errors.js'

export const adminAuthRouter = Router()

adminAuthRouter.post('/api/admin/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const env = getEnv()
  const valid = email === env.ADMIN_EMAIL && (await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH))
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
  const token = jwt.sign({ sub: 'admin' }, env.JWT_SECRET, { expiresIn: '12h' })
  res.json({ token })
})
