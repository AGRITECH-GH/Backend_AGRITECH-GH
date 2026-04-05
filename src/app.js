import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRouter from './routes/authRoutes.js'
import { authenticate } from './middleware/authenticate.js'
import listingRouter from './routes/listingRoutes.js'
import orderRouter from './routes/orderRoutes.js'
import cartRouter from './routes/cartRoutes.js'
import barterRouter from './routes/barterRoutes.js'
import adminRouter from './routes/adminRoutes.js'
import agentRouter from './routes/agentRoutes.js'
import paymentRouter from './routes/paymentRoutes.js'
import { authLimiter, generalLimiter, paymentLimiter } from './middleware/rateLimiter.js'
import categoryRouter from './routes/categoryRoutes.js'

const app = express()
// app.use(cors({
//     // origin: process.env.CLIENT_URL,
//     origin: 'http://localhost:5173',
//     credentials: true
// }))
// app.use(cors({
//   origin: (origin, callback) => {
//     callback(null, process.env.CLIENT_URL)
//   },
//   credentials: true
// }))
app.use(cors({
  origin: [process.env.CLIENT_URL, 'http://localhost:5173'],
  credentials: true
}))
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())
app.use(cookieParser())
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})
app.use(generalLimiter)
app.use('/api/auth', authRouter)
app.use('/api/listings', listingRouter)
app.use('/api/orders', orderRouter)
app.use('/api/cart', cartRouter)
app.use('/api/barter', barterRouter)
app.use('/api/admin', adminRouter)
app.use('/api/agents', agentRouter)
app.use('/api/payments', paymentRouter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/payments/initialize', paymentLimiter)
app.use('/api/categories', categoryRouter)
app.get('/api/protected', authenticate, (req, res) => {

})
export default app