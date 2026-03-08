import 'dotenv/config'
console.log('CLIENT_URL:', process.env.CLIENT_URL)
console.log('PORT:', process.env.PORT)
import app from './app.js'
app.listen(process.env.PORT, () => console.log(`server running on port ${process.env.PORT}`))