import prisma from '../config/prisma.js'

export const getAllUsers = async (req, res) => {
    try {
        const { role, isActive, search, page = 1, limit = 20 } = req.query

        const filters = {}
        if (role) filters.role = role
        if (isActive !== undefined) filters.isActive = isActive === 'true'
        if (search) {
            filters.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ]
        }

        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where: filters,
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                    isActive: true,
                    isVerified: true,
                    phoneNumber: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.user.count({ where: filters })
        ])

        return res.status(200).json({
            users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        })
    } catch (error) {
        console.error('Get all users error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params
        const { isActive, role, isVerified } = req.body

        const user = await prisma.user.findUnique({ where: { id } })

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        // Prevent admin from disabling themselves
        if (id === req.user.id && isActive === false) {
            return res.status(400).json({ message: 'You cannot disable your own account' })
        }

        const updated = await prisma.user.update({
            where: { id },
            data: {
                ...(isActive !== undefined && { isActive }),
                ...(role && { role }),
                ...(isVerified !== undefined && { isVerified })
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                isActive: true,
                isVerified: true
            }
        })

        return res.status(200).json({ message: 'User updated successfully', user: updated })
    } catch (error) {
        console.error('Update user error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const getAllOrders = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query

        const filters = {}
        if (status) filters.status = status

        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: filters,
                include: {
                    items: {
                        include: { listing: { select: { id: true, title: true } } }
                    },
                    buyer: { select: { id: true, fullName: true, email: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.order.count({ where: filters })
        ])

        return res.status(200).json({
            orders,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        })
    } catch (error) {
        console.error('Get all orders error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const getDashboardStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalListings,
            totalOrders,
            totalBarterRequests,
            recentOrders,
            usersByRole
        ] = await Promise.all([
            prisma.user.count(),
            prisma.listing.count(),
            prisma.order.count(),
            prisma.barterRequest.count(),
            prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    buyer: { select: { id: true, fullName: true } },
                    items: { include: { listing: { select: { title: true } } } }
                }
            }),
            prisma.user.groupBy({
                by: ['role'],
                _count: { role: true }
            })
        ])

        return res.status(200).json({
            stats: {
                totalUsers,
                totalListings,
                totalOrders,
                totalBarterRequests
            },
            usersByRole,
            recentOrders
        })
    } catch (error) {
        console.error('Get dashboard stats error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params

        if (id === req.user.id) {
            return res.status(400).json({ message: 'You cannot delete your own account' })
        }

        const user = await prisma.user.findUnique({ where: { id } })

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        await prisma.user.delete({ where: { id } })

        return res.status(200).json({ message: 'User deleted successfully' })
    } catch (error) {
        console.error('Delete user error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const createCategory = async (req, res) => {
    try {
        const { name, description, iconUrl, parentId } = req.body

        if (!name) {
            return res.status(400).json({ message: 'Category name is required' })
        }

        const category = await prisma.category.create({
            data: {
                name,
                description,
                iconUrl,
                parentId: parentId ?? null
            }
        })

        return res.status(201).json({ message: 'Category created successfully', category })
    } catch (error) {
        console.error('Create category error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const getCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true, parentId: null },
            include: {
                children: {
                    where: { isActive: true },
                    select: { id: true, name: true, description: true, iconUrl: true }
                }
            },
            orderBy: { name: 'asc' }
        })

        return res.status(200).json({ categories })
    } catch (error) {
        console.error('Get categories error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params
        const { name, description, iconUrl, isActive } = req.body

        const category = await prisma.category.findUnique({ where: { id } })
        if (!category) {
            return res.status(404).json({ message: 'Category not found' })
        }

        const updated = await prisma.category.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description && { description }),
                ...(iconUrl && { iconUrl }),
                ...(isActive !== undefined && { isActive })
            }
        })

        return res.status(200).json({ message: 'Category updated successfully', category: updated })
    } catch (error) {
        console.error('Update category error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}