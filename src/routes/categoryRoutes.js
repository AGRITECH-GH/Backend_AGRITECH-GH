import { Router } from 'express'
import { getCategories } from '../controllers/adminController.js'

const router = Router()

router.get('/', getCategories)

export default router