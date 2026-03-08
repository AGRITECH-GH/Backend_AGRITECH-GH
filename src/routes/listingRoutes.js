import { Router } from 'express'
import { authenticate, authorize } from '../middleware/authenticate.js'
import { createListing, getAllListings, getListingById, updateListing, deleteListing } from '../controllers/listingController.js'

const router = Router()

router.post('/', authenticate, authorize('FARMER', 'AGENT'), createListing)
router.get('/', getAllListings)
router.get('/:id', getListingById)
router.put('/:id', authenticate, authorize('FARMER', 'AGENT'), updateListing)
router.delete('/:id', authenticate, authorize('FARMER', 'AGENT'), deleteListing)

export default router