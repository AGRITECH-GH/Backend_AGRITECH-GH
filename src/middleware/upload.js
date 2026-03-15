import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import cloudinary from '../config/cloudinary.js'

const listingStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'agritech/listings',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit' }]
    }
})

const barterStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'agritech/barter',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit' }]
    }
})

export const uploadListingImages = multer({
    storage: listingStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
}).array('images', 5)

export const uploadBarterImages = multer({
    storage: barterStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
}).array('images', 3)