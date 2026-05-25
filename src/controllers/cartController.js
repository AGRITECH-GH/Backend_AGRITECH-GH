import prisma from '../config/prisma.js'

export const getCart = async (req, res) => {
    try {
        let cart = await prisma.cart.findUnique({
            where: { userId: req.user.id },
            include: {
                items: {
                    include: {
                        listing: {
                            select: {
                                id: true,
                                title: true,
                                pricePerUnit: true,
                                quantityAvailable: true,
                                unit: true,
                                status: true,
                                images: true,
                                seller: { select: { id: true, fullName: true } }
                            }
                        }
                    }
                }
            }
        })

        if (!cart) {
            cart = { items: [], total: 0 }
        } else {
            const total = cart.items.reduce((sum, item) => {
                return sum + parseFloat(item.listing.pricePerUnit) * parseFloat(item.quantity)
            }, 0)
            cart = { ...cart, total }
        }

        return res.status(200).json({ cart })
    } catch (error) {
        console.error('Get cart error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const addToCart = async (req, res) => {
    try {
        const { listingId, quantity } = req.body

        if (!listingId || !quantity) {
            return res.status(400).json({ message: 'listingId and quantity are required' })
        }

        const listing = await prisma.listing.findUnique({ where: { id: listingId } })

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' })
        }

        if (listing.status !== 'ACTIVE') {
            return res.status(400).json({ message: 'This listing is no longer available' })
        }

        if (listing.sellerId === req.user.id) {
            return res.status(400).json({ message: 'You cannot add your own listing to cart' })
        }

        if (parseFloat(listing.quantityAvailable) < parseFloat(quantity)) {
            return res.status(400).json({ message: `Only ${listing.quantityAvailable} ${listing.unit} available` })
        }

        // Get or create cart
        let cart = await prisma.cart.findUnique({ where: { userId: req.user.id } })
        if (!cart) {
            cart = await prisma.cart.create({ data: { userId: req.user.id } })
        }

        // Upsert cart item
        const cartItem = await prisma.cartItem.upsert({
            where: { cartId_listingId: { cartId: cart.id, listingId } },
            update: { quantity: parseFloat(quantity) },
            create: { cartId: cart.id, listingId, quantity: parseFloat(quantity) },
            include: { listing: { select: { id: true, title: true, pricePerUnit: true, unit: true, images: true } } }
        })

        return res.status(200).json({ message: 'Item added to cart', cartItem })
    } catch (error) {
        console.error('Add to cart error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const removeFromCart = async (req, res) => {
    try {
        const { listingId } = req.params

        const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } })

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' })
        }

        await prisma.cartItem.delete({
            where: { cartId_listingId: { cartId: cart.id, listingId } }
        })

        return res.status(200).json({ message: 'Item removed from cart' })
    } catch (error) {
        console.error('Remove from cart error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const clearCart = async (req, res) => {
    try {
        const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } })

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' })
        }

        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })

        return res.status(200).json({ message: 'Cart cleared' })
    } catch (error) {
        console.error('Clear cart error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const validateCart = async (req, res) => {
    try {
        const cart = await prisma.cart.findUnique({
            where: { userId: req.user.id },
            include: {
                items: {
                    include: { listing: true }
                }
            }
        })

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' })
        }

        const issues = []
        let total = 0

        for (const item of cart.items) {
            const listing = item.listing

            if (listing.status !== 'ACTIVE') {
                issues.push({ listingId: listing.id, title: listing.title, issue: 'Listing is no longer available' })
                continue
            }

            if (parseFloat(listing.quantityAvailable) < parseFloat(item.quantity)) {
                issues.push({
                    listingId: listing.id,
                    title: listing.title,
                    issue: `Only ${listing.quantityAvailable} ${listing.unit} available, you requested ${item.quantity}`
                })
                continue
            }

            total += parseFloat(listing.pricePerUnit) * parseFloat(item.quantity)
        }

        return res.status(200).json({
            valid: issues.length === 0,
            issues,
            total
        })
    } catch (error) {
        console.error('Validate cart error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}