import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import prisma from './prisma.js'

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value
                const fullName = profile.displayName
                const profilePhotoUrl = profile.photos[0]?.value

                // Check if user exists
                let user = await prisma.user.findUnique({ where: { email } })

                if (user) {
                    // User exists — update photo if not set
                    if (!user.profilePhotoUrl && profilePhotoUrl) {
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: { profilePhotoUrl }
                        })
                    }
                    return done(null, user)
                }

                // Create new user
                user = await prisma.user.create({
                    data: {
                        fullName,
                        email,
                        passwordHash: '',
                        role: 'BUYER', // default role for Google signup
                        isVerified: true, // Google already verified the email
                        isActive: true,
                        profilePhotoUrl
                    }
                })

                return done(null, user)
            } catch (error) {
                return done(error, null)
            }
        }
    )
)

export default passport