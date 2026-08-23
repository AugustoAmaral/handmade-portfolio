import Stripe from 'stripe'
import { getEnv } from '../env.js'

export const stripe = new Stripe(getEnv().STRIPE_SECRET_KEY)
