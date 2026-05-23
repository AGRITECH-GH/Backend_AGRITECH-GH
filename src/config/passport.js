import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./prisma.js";

const OAUTH_ALLOWED_ROLES = new Set(["BUYER", "FARMER", "AGENT"]);

const isGoogleManagedAccount = (user) =>
  String(user?.passwordHash || "").trim().length === 0;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const fullName = profile.displayName;
        const profilePhotoUrl = profile.photos[0]?.value;

        // Parse role from OAuth state parameter
        let role = "BUYER";
        if (req.query.state) {
          try {
            const stateObj = JSON.parse(req.query.state);
            if (stateObj.role) {
              const candidateRole = String(stateObj.role).toUpperCase();
              role = OAUTH_ALLOWED_ROLES.has(candidateRole)
                ? candidateRole
                : "BUYER";
            }
          } catch (e) {
            console.error("Failed to parse OAuth state:", e);
          }
        }

        // Check if user exists
        let user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          // Do not auto-link Google sign-in to an existing password account.
          // This prevents silent account switching when emails overlap.
          if (!isGoogleManagedAccount(user)) {
            return done(null, false, { code: "oauth_email_conflict" });
          }

          // User exists — update photo if not set
          if (!user.profilePhotoUrl && profilePhotoUrl) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { profilePhotoUrl },
            });
          }
          return done(null, user);
        }

        // Create new user
        const normalizedRole = role.toUpperCase();
        user = await prisma.user.create({
          data: {
            fullName,
            email,
            passwordHash: "",
            role: normalizedRole,
            isVerified: true, // Google already verified the email
            isActive: true,
            profilePhotoUrl,
            kycStatus: normalizedRole === "FARMER" ? "PENDING" : "APPROVED",
            kycSubmittedAt: normalizedRole === "FARMER" ? new Date() : null,
          },
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    },
  ),
);

export default passport;
