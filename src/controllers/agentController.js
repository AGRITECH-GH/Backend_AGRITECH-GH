import prisma from '../config/prisma.js'

export const registerAsAgent = async (req, res) => {
    try {
        const { assignedRegion, commissionRate, bio } = req.body

        if (!assignedRegion || !commissionRate) {
            return res.status(400).json({ message: 'assignedRegion and commissionRate are required' })
        }

        // Check if already an agent
        const existing = await prisma.fieldAgent.findUnique({ where: { userId: req.user.id } })
        if (existing) {
            return res.status(409).json({ message: 'You are already registered as a field agent' })
        }

        const agent = await prisma.fieldAgent.create({
            data: {
                assignedRegion,
                commissionRate: parseFloat(commissionRate),
                bio,
                userId: req.user.id
            },
            include: {
                user: { select: { id: true, fullName: true, email: true, role: true } }
            }
        })

        // Update user role to AGENT
        await prisma.user.update({
            where: { id: req.user.id },
            data: { role: 'AGENT' }
        })

        return res.status(201).json({ message: 'Registered as field agent successfully', agent })
    } catch (error) {
        console.error('Register agent error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const getAllAgents = async (req, res) => {
    try {
        const { region, page = 1, limit = 20 } = req.query

        const filters = { isActive: true }
        if (region) filters.assignedRegion = { contains: region, mode: 'insensitive' }

        const skip = (parseInt(page) - 1) * parseInt(limit)

        const [agents, total] = await Promise.all([
            prisma.fieldAgent.findMany({
                where: filters,
                include: {
                    user: { select: { id: true, fullName: true, email: true, region: true } }
                },
                orderBy: { ratingAvg: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.fieldAgent.count({ where: filters })
        ])

        return res.status(200).json({
            agents,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        })
    } catch (error) {
        console.error('Get agents error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const getAgentById = async (req, res) => {
    try {
        const { id } = req.params

        const agent = await prisma.fieldAgent.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: { select: { id: true, fullName: true, email: true, region: true } }
            }
        })

        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' })
        }

        return res.status(200).json({ agent })
    } catch (error) {
        console.error('Get agent error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const assignAgentToOrder = async (req, res) => {
    try {
        const { orderId } = req.params
        const { agentId } = req.body

        if (!agentId) {
            return res.status(400).json({ message: 'agentId is required' })
        }

        const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } })
        if (!order) {
            return res.status(404).json({ message: 'Order not found' })
        }

        const agent = await prisma.fieldAgent.findUnique({
            where: { id: parseInt(agentId) },
            include: { user: true }
        })
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' })
        }

        const updated = await prisma.order.update({
            where: { id: parseInt(orderId) },
            data: { agentId: agent.userId },
            include: {
                agent: { select: { id: true, fullName: true } }
            }
        })

        // Increment agent's total orders handled
        await prisma.fieldAgent.update({
            where: { id: parseInt(agentId) },
            data: { totalOrdersHandled: { increment: 1 } }
        })

        return res.status(200).json({ message: 'Agent assigned to order', order: updated })
    } catch (error) {
        console.error('Assign agent error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}