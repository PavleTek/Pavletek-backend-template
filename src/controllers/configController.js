const prisma = require('../lib/prisma');

// Get system configuration
const getConfig = async (req, res) => {
  try {
    // Get or create configuration (singleton pattern)
    let config = await prisma.configuration.findFirst();

    if (!config) {
      // Create default configuration if it doesn't exist
      config = await prisma.configuration.create({
        data: {
          twoFactorEnabled: false,
          appName: 'Application'
        }
      });
    }

    res.status(200).json({
      message: 'Configuration retrieved successfully',
      config: {
        id: config.id,
        twoFactorEnabled: config.twoFactorEnabled,
        appName: config.appName || 'Application',
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
    const { twoFactorEnabled, appName } = req.body;

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

    if (!config) {
      config = await prisma.configuration.create({
        data: {
          twoFactorEnabled: twoFactorEnabled !== undefined ? twoFactorEnabled : false,
          appName: appName !== undefined ? appName.trim() : 'Application'
        }
      });
    } else {
      config = await prisma.configuration.update({
        where: { id: config.id },
        data: updateData
      });
    }

    res.status(200).json({
      message: 'Configuration updated successfully',
      config: {
        id: config.id,
        twoFactorEnabled: config.twoFactorEnabled,
        appName: config.appName || 'Application',
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

