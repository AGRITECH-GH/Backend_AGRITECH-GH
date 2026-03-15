import prisma from '../config/prisma.js'

export const createBarterRequest = async (req, res) => {
    try {
        const { targetListingId, offeredListingId, offeredDescription, offeredQuantity, message } = req.body

        if (!targetListingId) {
            return res.status(400).json({ message: 'targetListingId is required' })
        }

        if (!offeredListingId && !offeredDescription) {
            return res.status(400).json({ message: 'Either offeredListingId or offeredDescription is required' })
        }

        const targetListing = await prisma.listing.findUnique({ where: { id: parseInt(targetListingId) } })

        if (!targetListing) {
            return res.status(404).json({ message: 'Target listing not found' })
        }

        if (targetListing.status !== 'ACTIVE') {
            return res.status(400).json({ message: 'This listing is no longer available' })
        }

        if (targetListing.sellerId === req.user.id) {
            return res.status(400).json({ message: 'You cannot barter with your own listing' })
        }

        if (offeredListingId) {
            const offeredListing = await prisma.listing.findUnique({ where: { id: parseInt(offeredListingId) } })
            if (!offeredListing) {
                return res.status(404).json({ message: 'Offered listing not found' })
            }
            if (offeredListing.sellerId !== req.user.id) {
                return res.status(403).json({ message: 'You can only offer your own listings' })
            }
        }

        const barterRequest = await prisma.barterRequest.create({
            data: {
                targetListingId: parseInt(targetListingId),
                offeredListingId: offeredListingId ? parseInt(offeredListingId) : null,
                offeredDescription,
                offeredQuantity: offeredQuantity ? parseFloat(offeredQuantity) : null,
                message,
                requesterId: req.user.id
            },
            include: {
                requester: { select: { id: true, fullName: true } },
                targetListing: { select: { id: true, title: true } },
                offeredListing: { select: { id: true, title: true } }
            }
        })

        return res.status(201).json({ message: 'Barter request sent', barterRequest })
    } catch (error) {
        console.error('Create barter error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const getMyBarterRequests = async (req, res) => {
    try {
        const { status } = req.query

        const filters = {
            OR: [
                { requesterId: req.user.id },
                { targetListing: { sellerId: req.user.id } }
            ]
        }

        if (status) filters.status = status

        const barterRequests = await prisma.barterRequest.findMany({
            where: filters,
            include: {
                requester: { select: { id: true, fullName: true } },
                targetListing: { select: { id: true, title: true, seller: { select: { id: true, fullName: true } } } },
                offeredListing: { select: { id: true, title: true } }
            },
            orderBy: { createdAt: 'desc' }
        })

        return res.status(200).json({ barterRequests })
    } catch (error) {
        console.error('Get barter requests error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const updateBarterStatus = async (req, res) => {
    try {
        const { id } = req.params
        const { status } = req.body

        if (!status) {
            return res.status(400).json({ message: 'Status is required' })
        }

        const validStatuses = ['ACCEPTED', 'REJECTED', 'CANCELLED']
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` })
        }

        const barterRequest = await prisma.barterRequest.findUnique({
            where: { id: parseInt(id) },
            include: { targetListing: true }
        })

        if (!barterRequest) {
            return res.status(404).json({ message: 'Barter request not found' })
        }

        const isSeller = barterRequest.targetListing.sellerId === req.user.id
        const isRequester = barterRequest.requesterId === req.user.id

        if (status === 'CANCELLED' && !isRequester) {
            return res.status(403).json({ message: 'Only the requester can cancel a barter request' })
        }

        if ((status === 'ACCEPTED' || status === 'REJECTED') && !isSeller) {
            return res.status(403).json({ message: 'Only the listing owner can accept or reject a barter request' })
        }

        if (barterRequest.status !== 'PENDING') {
            return res.status(400).json({ message: 'This barter request has already been resolved' })
        }

        const updated = await prisma.barterRequest.update({
            where: { id: parseInt(id) },
            data: {
                status,
                agreedAt: status === 'ACCEPTED' ? new Date() : null
            },
            include: {
                requester: { select: { id: true, fullName: true } },
                targetListing: { select: { id: true, title: true } }
            }
        })

        return res.status(200).json({ message: `Barter request ${status.toLowerCase()}`, barterRequest: updated })
    } catch (error) {
        console.error('Update barter error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const uploadBarterImages = async (req, res) => {
    try {
        const { id } = req.params

        const barterRequest = await prisma.barterRequest.findUnique({ where: { id: parseInt(id) } })

        if (!barterRequest) {
            return res.status(404).json({ message: 'Barter request not found' })
        }

        if (barterRequest.requesterId !== req.user.id) {
            return res.status(403).json({ message: 'You can only upload images to your own barter requests' })
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No images uploaded' })
        }

        const images = await Promise.all(
            req.files.map((file) =>
                prisma.barterImage.create({
                    data: {
                        imageUrl: file.path,
                        barterRequestId: parseInt(id)
                    }
                })
            )
        )

        return res.status(201).json({ message: 'Images uploaded successfully', images })
    } catch (error) {
        console.error('Upload barter images error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}