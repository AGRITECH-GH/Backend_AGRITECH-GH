import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import { uploadListingImages as uploadMiddleware } from '../middleware/upload.js'
import { createListing, getAllListings, getListingById, updateListing, deleteListing, uploadListingImages } from '../controllers/listingController.js'
import {requireVerified} from '../middleware/requireVerified.js'
const router = Router()

router.post('/', authenticate, requireVerified,authorize('FARMER', 'AGENT'), createListing)
router.get('/', getAllListings)
router.get('/:id', getListingById)
router.put('/:id', authenticate, authorize('FARMER', 'AGENT'), updateListing)
router.delete('/:id', authenticate, authorize('FARMER', 'AGENT'), deleteListing)
router.post('/:id/images', authenticate, authorize('FARMER', 'AGENT'), uploadMiddleware, uploadListingImages)

export default router