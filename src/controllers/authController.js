const prisma = require('../lib/prisma');
const { comparePassword, hashPassword } = require('../utils/password');
const { generateToken, generateTempToken, verifyToken } = require('../utils/jwt');
const { generateSecret, generateQRCode, verifyToken: verifyTwoFactorToken, generateBackupCodes, hashBackupCode, generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode: verifyRecoveryCodeUtil } = require('../utils/twoFactor');
const { sendEmail } = require('../services/emailService');

// Login user
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Find user by username or email (case-insensitive)
    // For PostgreSQL, use mode: 'insensitive' for case-insensitive comparison
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { 
            username: {
              equals: username,
              mode: 'insensitive'
            }
          },
          { 
            email: {
              equals: username,
              mode: 'insensitive'
            }
          }
        ]
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.hashedPassword);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update lastLogin timestamp
    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now }
    });

    // Prepare user data without password
    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      chileanRutNumber: user.chileanRutNumber,
      color: user.color,
      lastLogin: now.toISOString(), // Use the updated timestamp
      createdAt: user.createdAt,
      createdBy: user.createdBy,
      roles: user.userRoles.map((ur) => ur.role.name)
    };

    // Check if 2FA is enabled system-wide
    const config = await prisma.configuration.findFirst();
    const system2FAEnabled = config?.twoFactorEnabled || false;

    // If system 2FA is enabled
    if (system2FAEnabled) {
      // Check if user has 2FA set up
      // NOTE: User 2FA settings are preserved even when system 2FA is disabled/re-enabled
      // Users who already have 2FA configured will only need to verify (enter code)
      // Users without 2FA will need to set it up
      const userHas2FA = user.twoFactorSecret && user.twoFactorEnabled;

      if (userHas2FA) {
        // User has 2FA set up - require 2FA verification (just enter code)
        const tempToken = generateTempToken(userWithoutPassword);

        res.status(200).json({
          message: '2FA verification required',
          requiresTwoFactor: true,
          tempToken: tempToken
        });
        return;
      } else {
        // User doesn't have 2FA set up - require 2FA setup
        const tempToken = generateTempToken(userWithoutPassword);

        res.status(200).json({
          message: '2FA setup required',
          requiresTwoFactorSetup: true,
          tempToken: tempToken
        });
        return;
      }
    }

    // System 2FA is disabled - normal login (users can login regardless of their 2FA status)
    // User 2FA settings remain intact in the database
    const token = generateToken(userWithoutPassword);

    res.status(200).json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    // User data is already available from the authentication middleware
    const user = req.user;

    res.status(200).json({
      message: 'Profile retrieved successfully',
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user's own profile
// SECURITY: This endpoint only allows users to update their own profile.
// Role updates are explicitly prevented - even if roleIds are sent in the request,
// they will be ignored. Only admins can change roles via /admin/users/:id/roles
const updateProfile = async (req, res) => {
  try {
    const currentUser = req.user; // User from authentication middleware
    
    // Only extract allowed fields - roleIds and other admin-only fields are ignored
    const { username, email, name, lastName, chileanRutNumber, color } = req.body;

    // Ensure user can only update their own profile
    // No userId in params - user can only update themselves
    const userId = currentUser.id;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if username or email already exists (excluding current user)
    if (username || email) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                ...(username ? [{ username }] : []),
                ...(email ? [{ email }] : [])
              ]
            }
          ]
        }
      });

      if (duplicateUser) {
        res.status(409).json({ error: 'Username or email already exists' });
        return;
      }
    }

    // Explicitly exclude roleIds and any other admin-only fields from the update
    // Only allow updating: username, email, name, lastName, chileanRutNumber, color
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (chileanRutNumber !== undefined) updateData.chileanRutNumber = chileanRutNumber;
    if (color !== undefined) updateData.color = color;

    // Update user (roles are NOT updated - they can only be changed by admin)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    const userWithoutPassword = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      name: updatedUser.name,
      lastName: updatedUser.lastName,
      chileanRutNumber: updatedUser.chileanRutNumber,
      color: updatedUser.color,
      lastLogin: updatedUser.lastLogin,
      createdAt: updatedUser.createdAt,
      createdBy: updatedUser.createdBy,
      roles: updatedUser.userRoles.map((ur) => ur.role.name)
    };

    res.status(200).json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user's own password
const updatePassword = async (req, res) => {
  try {
    const currentUser = req.user; // User from authentication middleware
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    // Ensure user can only update their own password
    const userId = currentUser.id;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Hash and update password
    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id: userId },
      data: { hashedPassword }
    });

    res.status(200).json({
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify 2FA token during login
const verifyTwoFactor = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      res.status(400).json({ error: 'Temporary token and 2FA code are required' });
      return;
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = verifyToken(tempToken);
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired temporary token' });
      return;
    }

    if (!decoded.isTempToken) {
      res.status(400).json({ error: 'Invalid token type' });
      return;
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      res.status(400).json({ error: '2FA is not enabled for this user' });
      return;
    }

    // Verify 2FA code
    const isValid = verifyTwoFactorToken(user.twoFactorSecret, code);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid 2FA code' });
      return;
    }

    // Update lastLogin timestamp
    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now }
    });

    // Prepare user data without password
    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      chileanRutNumber: user.chileanRutNumber,
      color: user.color,
      lastLogin: now.toISOString(),
      createdAt: user.createdAt,
      createdBy: user.createdBy,
      roles: user.userRoles.map((ur) => ur.role.name)
    };

    // Generate full JWT token
    const token = generateToken(userWithoutPassword);

    res.status(200).json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Setup 2FA for user during mandatory login (public, uses tempToken)
const setupTwoFactorMandatory = async (req, res) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      res.status(400).json({ error: 'Temporary token is required' });
      return;
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = verifyToken(tempToken);
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired temporary token' });
      return;
    }

    if (!decoded.isTempToken) {
      res.status(400).json({ error: 'Invalid token type' });
      return;
    }

    const userId = parseInt(decoded.userId);

    // Check if user already has 2FA enabled
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      res.status(400).json({ error: '2FA is already enabled for this user' });
      return;
    }

    // Generate new secret
    const secret = generateSecret();

    // Get app name from configuration
    const config = await prisma.configuration.findFirst();
    const appName = config?.appName || 'Application';

    // Generate QR code with app name
    const qrCodeDataUrl = await generateQRCode(secret, user.email, appName);

    res.status(200).json({
      message: '2FA setup initiated',
      secret: secret,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Setup 2FA mandatory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify 2FA setup during mandatory login (public, uses tempToken)
const verifyTwoFactorSetupMandatory = async (req, res) => {
  try {
    const { tempToken, secret, code } = req.body;

    if (!tempToken || !secret || !code) {
      res.status(400).json({ error: 'Temporary token, secret, and verification code are required' });
      return;
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = verifyToken(tempToken);
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired temporary token' });
      return;
    }

    if (!decoded.isTempToken) {
      res.status(400).json({ error: 'Invalid token type' });
      return;
    }

    const userId = parseInt(decoded.userId);

    // Verify the code with the provided secret
    const isValid = verifyTwoFactorToken(secret, code);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid verification code' });
      return;
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

    // Save secret and enable 2FA for user
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedBackupCodes
      }
    });

    // Update lastLogin timestamp
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: now }
    });

    // Prepare user data without password
    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      chileanRutNumber: user.chileanRutNumber,
      color: user.color,
      lastLogin: now.toISOString(),
      createdAt: user.createdAt,
      createdBy: user.createdBy,
      roles: user.userRoles.map((ur) => ur.role.name)
    };

    // Generate full JWT token
    const token = generateToken(userWithoutPassword);

    res.status(200).json({
      message: '2FA enabled successfully',
      backupCodes: backupCodes,
      token: token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Verify 2FA setup mandatory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Setup 2FA for user (generate secret and QR code)
const setupTwoFactor = async (req, res) => {
  try {
    const currentUser = req.user;
    const userId = currentUser.id;

    // Check if user already has 2FA enabled
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      res.status(400).json({ error: '2FA is already enabled for this user' });
      return;
    }

    // Generate new secret
    const secret = generateSecret();

    // Get app name from configuration
    const config = await prisma.configuration.findFirst();
    const appName = config?.appName || 'Application';

    // Generate QR code with app name
    const qrCodeDataUrl = await generateQRCode(secret, user.email, appName);

    // Store secret temporarily (don't save to DB until verified)
    // For now, we'll return it and require verification before saving

    res.status(200).json({
      message: '2FA setup initiated',
      secret: secret,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Setup 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify 2FA setup (save secret after verification)
const verifyTwoFactorSetup = async (req, res) => {
  try {
    const currentUser = req.user;
    const userId = currentUser.id;
    const { secret, code } = req.body;

    if (!secret || !code) {
      res.status(400).json({ error: 'Secret and verification code are required' });
      return;
    }

    // Verify the code with the provided secret
    const isValid = verifyTwoFactorToken(secret, code);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid verification code' });
      return;
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

    // Save secret and enable 2FA for user
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        twoFactorBackupCodes: hashedBackupCodes
      }
    });

    res.status(200).json({
      message: '2FA enabled successfully',
      backupCodes: backupCodes // Return plain codes only once
    });
  } catch (error) {
    console.error('Verify 2FA setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Disable 2FA for user
const disableTwoFactor = async (req, res) => {
  try {
    const currentUser = req.user;
    const userId = currentUser.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: []
      }
    });

    res.status(200).json({
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get 2FA status for user
const getTwoFactorStatus = async (req, res) => {
  try {
    const currentUser = req.user;
    const userId = currentUser.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check system-wide 2FA status
    const config = await prisma.configuration.findFirst();
    const system2FAEnabled = config?.twoFactorEnabled || false;

    res.status(200).json({
      message: '2FA status retrieved successfully',
      enabled: user.twoFactorEnabled && !!user.twoFactorSecret,
      systemEnabled: system2FAEnabled
    });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Request 2FA recovery code (public, uses tempToken)
const requestRecoveryCode = async (req, res) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      res.status(400).json({ error: 'Temporary token is required' });
      return;
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = verifyToken(tempToken);
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired temporary token' });
      return;
    }

    if (!decoded.isTempToken) {
      res.status(400).json({ error: 'Invalid token type' });
      return;
    }

    const userId = parseInt(decoded.userId);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if user has 2FA enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(400).json({ error: '2FA is not enabled for this user' });
      return;
    }

    // Rate limiting: Check if user requested a code in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (user.twoFactorRecoveryCodeExpires && user.twoFactorRecoveryCodeExpires > oneHourAgo) {
      const minutesRemaining = Math.ceil((user.twoFactorRecoveryCodeExpires.getTime() - Date.now()) / (1000 * 60));
      res.status(429).json({ 
        error: `Please wait before requesting another recovery code. You can request again in ${minutesRemaining} minutes.` 
      });
      return;
    }

    // Get configuration for recovery email
    const config = await prisma.configuration.findFirst();
    if (!config || !config.recoveryEmailSenderId) {
      res.status(500).json({ error: 'Recovery email is not configured. Please contact an administrator.' });
      return;
    }

    // Get recovery email sender
    const recoveryEmailSender = await prisma.emailSender.findUnique({
      where: { id: config.recoveryEmailSenderId }
    });

    if (!recoveryEmailSender) {
      res.status(500).json({ error: 'Recovery email sender not found. Please contact an administrator.' });
      return;
    }

    // Generate recovery code
    const recoveryCode = generateRecoveryCode();
    const hashedCode = hashRecoveryCode(recoveryCode);

    // Set expiration to 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Store hashed code and expiration
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorRecoveryCode: hashedCode,
        twoFactorRecoveryCodeExpires: expiresAt
      }
    });

    // Determine which email/alias to use for sending
    // Use the main email (no alias) as default
    const fromEmail = recoveryEmailSender.email;

    // Get app name for email
    const appName = config.appName || 'Application';

    // Send recovery email
    try {
      await sendEmail({
        fromEmail: fromEmail,
        toEmails: [user.email],
        subject: `${appName} - 2FA Recovery Code`,
        content: `Your 2FA recovery code is: ${recoveryCode}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this code, please ignore this email.`,
        isHtml: false
      });
    } catch (emailError) {
      console.error('Error sending recovery email:', emailError);
      // Clear the recovery code if email failed
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorRecoveryCode: null,
          twoFactorRecoveryCodeExpires: null
        }
      });
      res.status(500).json({ error: 'Failed to send recovery email. Please try again later.' });
      return;
    }

    res.status(200).json({
      message: 'Recovery code sent to your email address'
    });
  } catch (error) {
    console.error('Request recovery code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify 2FA recovery code (public, uses tempToken)
const verifyRecoveryCode = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      res.status(400).json({ error: 'Temporary token and recovery code are required' });
      return;
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = verifyToken(tempToken);
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired temporary token' });
      return;
    }

    if (!decoded.isTempToken) {
      res.status(400).json({ error: 'Invalid token type' });
      return;
    }

    const userId = parseInt(decoded.userId);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if user has 2FA enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(400).json({ error: '2FA is not enabled for this user' });
      return;
    }

    // Check if recovery code exists and is not expired
    if (!user.twoFactorRecoveryCode || !user.twoFactorRecoveryCodeExpires) {
      res.status(400).json({ error: 'No recovery code found. Please request a new recovery code.' });
      return;
    }

    if (new Date() > user.twoFactorRecoveryCodeExpires) {
      res.status(400).json({ error: 'Recovery code has expired. Please request a new one.' });
      return;
    }

    // Verify recovery code
    const isValid = verifyRecoveryCodeUtil(code, user.twoFactorRecoveryCode);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid recovery code' });
      return;
    }

    // Disable 2FA for user and clear recovery code
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
        twoFactorRecoveryCode: null,
        twoFactorRecoveryCodeExpires: null
      }
    });

    // Update lastLogin timestamp
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: now }
    });

    // Prepare user data without password
    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      chileanRutNumber: user.chileanRutNumber,
      color: user.color,
      lastLogin: now.toISOString(),
      createdAt: user.createdAt,
      createdBy: user.createdBy,
      roles: user.userRoles.map((ur) => ur.role.name)
    };

    // Generate full JWT token
    const token = generateToken(userWithoutPassword);

    res.status(200).json({
      message: 'Recovery code verified successfully. 2FA has been disabled. You can set it up again from your profile.',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Verify recovery code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Request password reset code (public)
const requestPasswordReset = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username or email is required' });
      return;
    }

    // Find user by username or email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { 
            username: {
              equals: username,
              mode: 'insensitive'
            }
          },
          { 
            email: {
              equals: username,
              mode: 'insensitive'
            }
          }
        ]
      }
    });

    // Don't reveal if user exists or not (security best practice)
    // But we still need to check for rate limiting
    if (user) {
      // Rate limiting: Check if user requested a code in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (user.passwordResetCodeExpires && user.passwordResetCodeExpires > oneHourAgo) {
        const minutesRemaining = Math.ceil((user.passwordResetCodeExpires.getTime() - Date.now()) / (1000 * 60));
        res.status(429).json({ 
          error: `Please wait before requesting another password reset code. You can request again in ${minutesRemaining} minutes.` 
        });
        return;
      }

      // Get configuration for recovery email
      const config = await prisma.configuration.findFirst();
      if (!config || !config.recoveryEmailSenderId) {
        res.status(500).json({ error: 'Password reset email is not configured. Please contact an administrator.' });
        return;
      }

      // Get recovery email sender
      const recoveryEmailSender = await prisma.emailSender.findUnique({
        where: { id: config.recoveryEmailSenderId }
      });

      if (!recoveryEmailSender) {
        res.status(500).json({ error: 'Password reset email sender not found. Please contact an administrator.' });
        return;
      }

      // Generate reset code
      const resetCode = generateRecoveryCode();
      const hashedCode = hashRecoveryCode(resetCode);

      // Set expiration to 15 minutes from now
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Store hashed code and expiration
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCode: hashedCode,
          passwordResetCodeExpires: expiresAt
        }
      });

      // Determine which email/alias to use for sending
      // Use the main email (no alias) as default
      const fromEmail = recoveryEmailSender.email;

      // Get app name for email
      const appName = config.appName || 'Application';

      // Send password reset email
      try {
        await sendEmail({
          fromEmail: fromEmail,
          toEmails: [user.email],
          subject: `${appName} - Password Reset Code`,
          content: `Your password reset code is: ${resetCode}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this code, please ignore this email and your password will remain unchanged.`,
          isHtml: false
        });
      } catch (emailError) {
        console.error('Error sending password reset email:', emailError);
        // Clear the reset code if email failed
        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetCode: null,
            passwordResetCodeExpires: null
          }
        });
        res.status(500).json({ error: 'Failed to send password reset email. Please try again later.' });
        return;
      }
    }

    // Always return success message (don't reveal if user exists)
    res.status(200).json({
      message: 'If an account with that username or email exists, a password reset code has been sent.'
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify password reset code and reset password (public)
const verifyPasswordReset = async (req, res) => {
  try {
    const { username, code, newPassword } = req.body;

    if (!username || !code || !newPassword) {
      res.status(400).json({ error: 'Username or email, code, and new password are required' });
      return;
    }

    // Find user by username or email (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { 
            username: {
              equals: username,
              mode: 'insensitive'
            }
          },
          { 
            email: {
              equals: username,
              mode: 'insensitive'
            }
          }
        ]
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if reset code exists and is not expired
    if (!user.passwordResetCode || !user.passwordResetCodeExpires) {
      res.status(400).json({ error: 'No password reset code found. Please request a new password reset code.' });
      return;
    }

    if (new Date() > user.passwordResetCodeExpires) {
      res.status(400).json({ error: 'Password reset code has expired. Please request a new one.' });
      return;
    }

    // Verify reset code
    const isValid = verifyRecoveryCodeUtil(code, user.passwordResetCode);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid password reset code' });
      return;
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword: hashedPassword,
        passwordResetCode: null,
        passwordResetCodeExpires: null
      }
    });

    res.status(200).json({
      message: 'Password has been reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Verify password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  getProfile,
  updateProfile,
  updatePassword,
  verifyTwoFactor,
  setupTwoFactor,
  setupTwoFactorMandatory,
  verifyTwoFactorSetup,
  verifyTwoFactorSetupMandatory,
  disableTwoFactor,
  getTwoFactorStatus,
  requestRecoveryCode,
  verifyRecoveryCode,
  requestPasswordReset,
  verifyPasswordReset
};