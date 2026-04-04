import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.js'
import cloudinary from '../config/cloudinary.js'
import crypto from 'crypto'
import { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeVerification } from '../services/emailService.js'
export const register = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    const requiredFields = { fullName, email, password, role };
    const missingFields = Object.keys(requiredFields).filter(
      (key) => !requiredFields[key],
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }
    if (password.length < 8 || !/\d/.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and contain at least one number",
      });
    }
    const existing = await prisma.user.findUnique({
      where: { email: email },
    });

    if (existing) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: fullName,
        email: email,
        passwordHash: hashedPassword,
        role: role,
        isVerified: isEmailVerificationDisabled,
      },
    });

    if (role === "AGENT") {
      const { assignedRegion, commissionRate, bio } = req.body;
      if (!assignedRegion || !commissionRate) {
        return res.status(400).json({
          message: "assignedRegion and commissionRate are required for agents",
        });
      }
      await prisma.fieldAgent.create({
        data: {
          assignedRegion,
          commissionRate: parseFloat(commissionRate),
          bio,
          userId: user.id,
        },
      });
    }

    if (!isEmailVerificationDisabled) {
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationTokenExpiry = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ); // 24 hours

      await prisma.user.update({
        where: { id: user.id },
        data: { verificationToken, verificationTokenExpiry },
      });

      await sendVerificationEmail(user.email, user.fullName, verificationToken);
    }
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, isVerified: user.isVerified },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "50m" },
    );
    const refreshToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    return res.status(201).json({
      message: "Account created successfully",
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    if (isEmailVerificationDisabled) {
      return res
        .status(200)
        .json({ message: "Email verification is currently disabled" });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, isVerified: user.isVerified },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "50m" },
    );

    const refreshToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Email verified successfully",
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: true,
      },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resendVerification = async (req, res) => {
  try {
    if (isEmailVerificationDisabled) {
      return res
        .status(200)
        .json({ message: "Email verification is currently disabled" });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(200).json({
        message: "If that email exists, a verification link has been sent",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry },
    });

    await sendVerificationEmail(user.email, user.fullName, verificationToken);

    return res.status(200).json({
      message: "If that email exists, a verification link has been sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
export const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    const requiredFields = { email, password };
    const missingFields = Object.keys(requiredFields).filter(
      (key) => !requiredFields[key],
    );
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "Your account has been disabled. Contact support." });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, isVerified: user.isVerified },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "50m" },
    );

    const refreshToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: rememberMe ? "30d" : "7d" },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const accessToken = jwt.sign(
      { id: decoded.id, role: decoded.role, isVerified: user.isVerified },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "50m" },
    );

    return res.status(200).json({ accessToken });
  } catch (error) {
    return res
      .status(403)
      .json({ message: "Invalid or expired refresh token" });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res
        .status(200)
        .json({ message: "If that email exists, a reset link has been sent" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: resetToken,
        verificationTokenExpiry: resetTokenExpiry,
      },
    });

    await sendPasswordResetEmail(user.email, user.fullName, resetToken);

    return res
      .status(200)
      .json({ message: "If that email exists, a reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .json({ message: "Token and password are required" });
    }

    if (password.length < 8 || !/\d/.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and contain at least one number",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      return res.status(400).json({
        message:
          "New password must be at least 8 characters and contain at least one number",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: hashedPassword },
    });

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body

        if (!password) {
            return res.status(400).json({ message: 'Password is required to delete your account' })
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } })

        const isMatch = await bcrypt.compare(password, user.passwordHash)
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect password' })
        }

        await prisma.user.delete({ where: { id: req.user.id } })

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        })

        return res.status(200).json({ message: 'Account deleted successfully' })
    } catch (error) {
        console.error('Delete account error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const editProfile = async (req, res) => {
    try {
        const { fullName, phoneNumber, region, bio } = req.body

        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(fullName && { fullName }),
                ...(phoneNumber && { phoneNumber }),
                ...(region && { region })
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                region: true,
                role: true,
                isVerified: true,
                profilePhotoUrl: true
            }
        })

        // If agent, update bio
        if (bio && user.role === 'AGENT') {
            await prisma.fieldAgent.update({
                where: { userId: req.user.id },
                data: { bio }
            })
        }

        return res.status(200).json({ message: 'Profile updated successfully', user: updated })
    } catch (error) {
        console.error('Edit profile error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const requestEmailChange = async (req, res) => {
    try {
        const { newEmail, password } = req.body

        if (!newEmail || !password) {
            return res.status(400).json({ message: 'New email and password are required' })
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } })

        const isMatch = await bcrypt.compare(password, user.passwordHash)
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect password' })
        }

        if (newEmail === user.email) {
            return res.status(400).json({ message: 'New email must be different from current email' })
        }

        // Check if new email is already taken
        const existing = await prisma.user.findUnique({ where: { email: newEmail } })
        if (existing) {
            return res.status(409).json({ message: 'Email already in use' })
        }

        const token = crypto.randomBytes(32).toString('hex')
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        // Store token and pending new email
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                verificationToken: token,
                verificationTokenExpiry: expiry
            }
        })

        await sendEmailChangeVerification(newEmail, user.fullName, token)

        return res.status(200).json({ message: 'Verification email sent to your new email address' })
    } catch (error) {
        console.error('Request email change error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const confirmEmailChange = async (req, res) => {
    try {
        const { token, newEmail } = req.body

        if (!token || !newEmail) {
            return res.status(400).json({ message: 'Token and new email are required' })
        }

        const user = await prisma.user.findFirst({
            where: {
                verificationToken: token,
                verificationTokenExpiry: { gt: new Date() }
            }
        })

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' })
        }

        // Check again if new email is taken
        const existing = await prisma.user.findUnique({ where: { email: newEmail } })
        if (existing) {
            return res.status(409).json({ message: 'Email already in use' })
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                email: newEmail,
                verificationToken: null,
                verificationTokenExpiry: null
            }
        })

        return res.status(200).json({ message: 'Email updated successfully' })
    } catch (error) {
        console.error('Confirm email change error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const uploadProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No photo uploaded' })
        }

        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { profilePhotoUrl: req.file.path },
            select: {
                id: true,
                fullName: true,
                email: true,
                profilePhotoUrl: true
            }
        })

        return res.status(200).json({ message: 'Profile photo updated successfully', user: updated })
    } catch (error) {
        console.error('Upload profile photo error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

export const removeProfilePhoto = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })

    if (!user.profilePhotoUrl) {
      return res.status(400).json({ message: 'No profile photo to remove' })
    }

    // Delete from Cloudinary
    const publicId = user.profilePhotoUrl.split('/').slice(-1)[0].split('.')[0]
    await cloudinary.uploader.destroy(`agritech/profiles/${publicId}`)

    await prisma.user.update({
      where: { id: req.user.id },
      data: { profilePhotoUrl: null }
    })

    return res.status(200).json({ message: 'Profile photo removed successfully' })
  } catch (error) {
    console.error('Remove profile photo error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
