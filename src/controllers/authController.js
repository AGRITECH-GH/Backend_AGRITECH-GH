import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import crypto from 'crypto'
import { sendVerificationEmail } from '../services/emailService.js'
export const register = async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body
        const requiredFields = { fullName, email, password, role }
        const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key])

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(', ')}`
            })
        }
        if (password.length < 8 || !/\d/.test(password)) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters and contain at least one number'
            })
        }
        const existing = await prisma.user.findUnique({
            where: { email: email }
        })

        if (existing) {
            return res.status(409).json({
                message: "Email already exists"
            })
        }
        const hashedPassword = await bcrypt.hash(password, 12)

        const user = await prisma.user.create({
            data: {
                fullName: fullName,
                email: email,
                passwordHash: hashedPassword,
                role: role
            }
        })

        const verificationToken = crypto.randomBytes(32).toString('hex')
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken, verificationTokenExpiry }
        })

        await sendVerificationEmail(user.email, user.fullName, verificationToken)
        const accessToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '30m' }

        )
        const refreshToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        )

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        })

        return res.status(201).json({
            message: 'Account created successfully',
            accessToken,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            }
        })
    } catch (error) {
        console.error('Register error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body

        if (!token) {
            return res.status(400).json({ message: 'Token is required' })
        }

        const user = await prisma.user.findFirst({
            where: {
                verificationToken: token,
                verificationTokenExpiry: { gt: new Date() }
            }
        })

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification token' })
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
                verificationTokenExpiry: null
            }
        })

        const accessToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        )

        const refreshToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        )

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json({
            message: 'Email verified successfully',
            accessToken,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                isVerified: true
            }
        })
    } catch (error) {
        console.error('Verify email error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({ message: 'Email is required' })
        }

        const user = await prisma.user.findUnique({ where: { email } })

        if (!user) {
            return res.status(200).json({ message: 'If that email exists, a verification link has been sent' })
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Email is already verified' })
        }

        const verificationToken = crypto.randomBytes(32).toString('hex')
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken, verificationTokenExpiry }
        })

        await sendVerificationEmail(user.email, user.fullName, verificationToken)

        return res.status(200).json({ message: 'If that email exists, a verification link has been sent' })
    } catch (error) {
        console.error('Resend verification error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}
export const login = async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body

        const requiredFields = { email, password }
        const missingFields = Object.keys(requiredFields).filter(key => !requiredFields[key])
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missingFields.join(', ')}`
            })
        }

        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' })
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash)
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' })
        }

        const accessToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        )

        const refreshToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: rememberMe ? '30d' : '7d' }
        )

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json({
            message: 'Login successful',
            accessToken,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            }
        })
    } catch (error) {
        console.error('Login error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const refresh = async (req, res) => {
    try {
        const token = req.cookies.refreshToken

        if (!token) {
            return res.status(401).json({ message: 'No refresh token' })
        }

        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)

        const accessToken = jwt.sign(
            { id: decoded.id, role: decoded.role },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        )

        return res.status(200).json({ accessToken })
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired refresh token' })
    }
}

export const logout = async (req, res) => {
    try {
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        })
        return res.status(200).json({ message: 'Logged out successfully' })
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' })
    }
}
