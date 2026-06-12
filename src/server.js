import 'dotenv/config'
console.log('CLIENT_URL:', process.env.CLIENT_URL)
console.log('PORT:', process.env.PORT)
import app from './app.js'
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server running on port ${PORT}`));