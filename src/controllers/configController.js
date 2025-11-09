const prisma = require('../lib/prisma');

// Get system configuration
const getConfig = async (req, res) => {
  try {
    // Get or create configuration (singleton pattern)
    let config = await prisma.configuration.findFirst();

    if (!config) {
      // Get first email sender for default recovery email
      const firstEmailSender = await prisma.emailSender.findFirst({
        orderBy: { createdAt: 'asc' }
      });

      // Create default configuration if it doesn't exist
      config = await prisma.configuration.create({
        data: {
          twoFactorEnabled: false,
          appName: 'Application',
          recoveryEmailSenderId: firstEmailSender?.id || null
        }
      });
    }

    // Note: Recovery email is not auto-set here. It will be set when 2FA is enabled if not already set.

    // Get recovery email sender details if set
    let recoveryEmailSender = null;
    if (config.recoveryEmailSenderId) {
      recoveryEmailSender = await prisma.emailSender.findUnique({
        where: { id: config.recoveryEmailSenderId },
        select: {
          id: true,
          email: true,
          aliases: true
        }
      });
    }

    res.status(200).json({
      message: 'Configuration retrieved successfully',
      config: {
        id: config.id,
        twoFactorEnabled: config.twoFactorEnabled,
        appName: config.appName || 'Application',
        recoveryEmailSenderId: config.recoveryEmailSenderId,
        recoveryEmailSender: recoveryEmailSender,
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update system configuration
// NOTE: This only updates system-wide settings. User 2FA settings (twoFactorSecret, twoFactorEnabled)
// are NEVER modified when system 2FA is toggled. Users keep their 2FA configuration.
const updateConfig = async (req, res) => {
  try {
    const { twoFactorEnabled, appName, recoveryEmailSenderId } = req.body;

    // Validate twoFactorEnabled if provided
    if (twoFactorEnabled !== undefined && typeof twoFactorEnabled !== 'boolean') {
      res.status(400).json({ error: 'twoFactorEnabled must be a boolean' });
      return;
    }

    // Validate appName if provided
    if (appName !== undefined) {
      if (typeof appName !== 'string' || appName.trim().length === 0) {
        res.status(400).json({ error: 'appName must be a non-empty string' });
        return;
      }
      if (appName.length > 100) {
        res.status(400).json({ error: 'appName must be 100 characters or less' });
        return;
      }
    }

    // Validate recoveryEmailSenderId if provided
    if (recoveryEmailSenderId !== undefined) {
      if (recoveryEmailSenderId !== null && (typeof recoveryEmailSenderId !== 'number' || isNaN(recoveryEmailSenderId))) {
        res.status(400).json({ error: 'recoveryEmailSenderId must be a number or null' });
        return;
      }

      // If setting a recovery email, verify it exists
      if (recoveryEmailSenderId !== null) {
        const emailSender = await prisma.emailSender.findUnique({
          where: { id: recoveryEmailSenderId }
        });

        if (!emailSender) {
          res.status(404).json({ error: 'Recovery email sender not found' });
          return;
        }
      }
    }

    // If trying to enable 2FA, check if at least one email sender exists
    if (twoFactorEnabled === true) {
      const emailSenderCount = await prisma.emailSender.count();
      
      if (emailSenderCount === 0) {
        res.status(400).json({ 
          error: 'Cannot enable 2FA. At least one email sender must be configured.' 
        });
        return;
      }
    }

    // Get or create configuration
    let config = await prisma.configuration.findFirst();

    const updateData = {};
    if (twoFactorEnabled !== undefined) {
      updateData.twoFactorEnabled = twoFactorEnabled;
    }
    if (appName !== undefined) {
      updateData.appName = appName.trim();
    }
    if (recoveryEmailSenderId !== undefined) {
      updateData.recoveryEmailSenderId = recoveryEmailSenderId;
    }

    // If enabling 2FA and recovery email is not set, auto-set it to first available email
    if (twoFactorEnabled === true && recoveryEmailSenderId === undefined) {
      const currentConfig = config || await prisma.configuration.findFirst();
      if (!currentConfig || !currentConfig.recoveryEmailSenderId) {
        const firstEmailSender = await prisma.emailSender.findFirst({
          orderBy: { createdAt: 'asc' }
        });
        if (firstEmailSender) {
          updateData.recoveryEmailSenderId = firstEmailSender.id;
        }
      }
    }

    if (!config) {
      // Get first email sender for default recovery email if not specified
      if (updateData.recoveryEmailSenderId === undefined) {
        const firstEmailSender = await prisma.emailSender.findFirst({
          orderBy: { createdAt: 'asc' }
        });
        updateData.recoveryEmailSenderId = firstEmailSender?.id || null;
      }

      config = await prisma.configuration.create({
        data: {
          twoFactorEnabled: twoFactorEnabled !== undefined ? twoFactorEnabled : false,
          appName: appName !== undefined ? appName.trim() : 'Application',
          recoveryEmailSenderId: updateData.recoveryEmailSenderId
        }
      });
    } else {
      config = await prisma.configuration.update({
        where: { id: config.id },
        data: updateData
      });
    }

    // Get recovery email sender details if set
    let recoveryEmailSender = null;
    if (config.recoveryEmailSenderId) {
      recoveryEmailSender = await prisma.emailSender.findUnique({
        where: { id: config.recoveryEmailSenderId },
        select: {
          id: true,
          email: true,
          aliases: true
        }
      });
    }

    res.status(200).json({
      message: 'Configuration updated successfully',
      config: {
        id: config.id,
        twoFactorEnabled: config.twoFactorEnabled,
        appName: config.appName || 'Application',
        recoveryEmailSenderId: config.recoveryEmailSenderId,
        recoveryEmailSender: recoveryEmailSender,
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getConfig,
  updateConfig
};

