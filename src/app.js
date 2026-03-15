import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRouter from './routes/authRoutes.js'
import { authenticate } from './middleware/authenticate.js'
import listingRouter from './routes/listingRoutes.js'
import orderRouter from './routes/orderRoutes.js'
import cartRouter from './routes/cartRoutes.js'
import barterRouter from './routes/barterRoutes.js'

const app = express()
// app.use(cors({
//     // origin: process.env.CLIENT_URL,
//     origin: 'http://localhost:5173',
//     credentials: true
// }))
app.use(cors({
  origin: (origin, callback) => {
    callback(null, process.env.CLIENT_URL)
  },
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})
app.use('/api/auth', authRouter)
app.use('/api/listings', listingRouter)
app.use('/api/orders', orderRouter)
app.use('/api/cart', cartRouter)
app.use('/api/barter', barterRouter)


app.get('/api/protected', authenticate, (req, res) => {
  res.json({ message: 'You are authenticated', user: req.user })
})
export default app