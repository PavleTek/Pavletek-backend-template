const prisma = require('../lib/prisma');
const { sendEmail } = require('../services/emailService');

// Get all sender emails
const getAllEmails = async (req, res) => {
  try {
    const emails = await prisma.emailSender.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      message: 'Email senders retrieved successfully',
      emails: emails,
    });
  } catch (error) {
    console.error('Get all emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a specific email sender by ID
const getEmailById = async (req, res) => {
  try {
    const { id } = req.params;
    const emailId = parseInt(id);

    if (isNaN(emailId)) {
      res.status(400).json({ error: 'Invalid email ID' });
      return;
    }

    const email = await prisma.emailSender.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      res.status(404).json({ error: 'Email sender not found' });
      return;
    }

    res.status(200).json({
      message: 'Email sender retrieved successfully',
      email: email,
    });
  } catch (error) {
    console.error('Get email by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new email sender
const createEmail = async (req, res) => {
  try {
    const { email, emailProvider, refreshToken, aliases } = req.body;

    if (!email || !emailProvider) {
      res.status(400).json({ error: 'Email and emailProvider are required' });
      return;
    }

    if (!['GMAIL', 'OUTLOOK'].includes(emailProvider.toUpperCase())) {
      res.status(400).json({ error: 'emailProvider must be either GMAIL or OUTLOOK' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const createData = {
      email: email.toLowerCase().trim(),
      emailProvider: emailProvider.toUpperCase(),
    };

    // Add refreshToken if provided
    if (refreshToken) {
      createData.refreshToken = refreshToken.trim();
    }

    // Validate and process aliases
    if (aliases && Array.isArray(aliases)) {
      const normalizedAliases = [];
      const seenAliases = new Set();

      for (const alias of aliases) {
        if (!alias || typeof alias !== 'string') {
          continue;
        }

        const normalizedAlias = alias.toLowerCase().trim();

        // Validate email format
        if (!emailRegex.test(normalizedAlias)) {
          res.status(400).json({ error: `Invalid alias email format: ${alias}` });
          return;
        }

        // Check for duplicates within the array
        if (seenAliases.has(normalizedAlias)) {
          res.status(400).json({ error: `Duplicate alias: ${normalizedAlias}` });
          return;
        }

        // Check if alias matches the main email
        if (normalizedAlias === createData.email) {
          res.status(400).json({ error: 'Alias cannot be the same as the main email' });
          return;
        }

        seenAliases.add(normalizedAlias);
        normalizedAliases.push(normalizedAlias);
      }

      // Check if aliases conflict with existing email senders
      if (normalizedAliases.length > 0) {
        const existingSenders = await prisma.emailSender.findMany({
          where: {
            OR: [
              { email: { in: normalizedAliases } },
              { aliases: { hasSome: normalizedAliases } }
            ]
          }
        });

        if (existingSenders.length > 0) {
          const conflictingEmails = existingSenders.map(s => s.email).join(', ');
          res.status(409).json({ 
            error: `Aliases conflict with existing email sender(s): ${conflictingEmails}` 
          });
          return;
        }
      }

      createData.aliases = normalizedAliases;
    }

    const newEmail = await prisma.emailSender.create({
      data: createData,
    });

    res.status(201).json({
      message: 'Email sender created successfully',
      email: newEmail,
    });
  } catch (error) {
    console.error('Create email error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update an email sender
const updateEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const emailId = parseInt(id);
    const { email, emailProvider, refreshToken, aliases } = req.body;

    if (isNaN(emailId)) {
      res.status(400).json({ error: 'Invalid email ID' });
      return;
    }

    if (!email && !emailProvider && refreshToken === undefined && aliases === undefined) {
      res.status(400).json({ error: 'At least one field (email, emailProvider, refreshToken, or aliases) is required' });
      return;
    }

    // Get the current email sender to check existing email
    const currentEmailSender = await prisma.emailSender.findUnique({
      where: { id: emailId },
    });

    if (!currentEmailSender) {
      res.status(404).json({ error: 'Email sender not found' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const updateData = {};

    if (email) {
      // Basic email validation
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
      updateData.email = email.toLowerCase().trim();
    }

    if (emailProvider) {
      if (!['GMAIL', 'OUTLOOK'].includes(emailProvider.toUpperCase())) {
        res.status(400).json({ error: 'emailProvider must be either GMAIL or OUTLOOK' });
        return;
      }
      updateData.emailProvider = emailProvider.toUpperCase();
    }

    if (refreshToken !== undefined) {
      // Allow setting refreshToken to null/empty string to clear it
      updateData.refreshToken = refreshToken ? refreshToken.trim() : null;
    }

    // Validate and process aliases
    if (aliases !== undefined) {
      if (!Array.isArray(aliases)) {
        res.status(400).json({ error: 'Aliases must be an array' });
        return;
      }

      const normalizedAliases = [];
      const seenAliases = new Set();
      const mainEmail = updateData.email || currentEmailSender.email;

      for (const alias of aliases) {
        if (!alias || typeof alias !== 'string') {
          continue;
        }

        const normalizedAlias = alias.toLowerCase().trim();

        // Validate email format
        if (!emailRegex.test(normalizedAlias)) {
          res.status(400).json({ error: `Invalid alias email format: ${alias}` });
          return;
        }

        // Check for duplicates within the array
        if (seenAliases.has(normalizedAlias)) {
          res.status(400).json({ error: `Duplicate alias: ${normalizedAlias}` });
          return;
        }

        // Check if alias matches the main email
        if (normalizedAlias === mainEmail) {
          res.status(400).json({ error: 'Alias cannot be the same as the main email' });
          return;
        }

        seenAliases.add(normalizedAlias);
        normalizedAliases.push(normalizedAlias);
      }

      // Check if aliases conflict with existing email senders (excluding current one)
      if (normalizedAliases.length > 0) {
        const existingSenders = await prisma.emailSender.findMany({
          where: {
            AND: [
              { id: { not: emailId } },
              {
                OR: [
                  { email: { in: normalizedAliases } },
                  { aliases: { hasSome: normalizedAliases } }
                ]
              }
            ]
          }
        });

        if (existingSenders.length > 0) {
          const conflictingEmails = existingSenders.map(s => s.email).join(', ');
          res.status(409).json({ 
            error: `Aliases conflict with existing email sender(s): ${conflictingEmails}` 
          });
          return;
        }
      }

      updateData.aliases = normalizedAliases;
    }

    const updatedEmail = await prisma.emailSender.update({
      where: { id: emailId },
      data: updateData,
    });

    res.status(200).json({
      message: 'Email sender updated successfully',
      email: updatedEmail,
    });
  } catch (error) {
    console.error('Update email error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Email sender not found' });
      return;
    }
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete an email sender
const deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const emailId = parseInt(id);

    if (isNaN(emailId)) {
      res.status(400).json({ error: 'Invalid email ID' });
      return;
    }

    await prisma.emailSender.delete({
      where: { id: emailId },
    });

    // Check if any email senders remain
    const remainingEmailSenders = await prisma.emailSender.count();

    // Get configuration
    const config = await prisma.configuration.findFirst();

    if (remainingEmailSenders === 0) {
      // If no email senders remain and 2FA is enabled, auto-disable it
      if (config && config.twoFactorEnabled) {
        await prisma.configuration.update({
          where: { id: config.id },
          data: { 
            twoFactorEnabled: false,
            recoveryEmailSenderId: null
          }
        });
      } else if (config) {
        // Clear recovery email even if 2FA is disabled
        await prisma.configuration.update({
          where: { id: config.id },
          data: { recoveryEmailSenderId: null }
        });
      }
    } else {
      // If deleted email was the recovery email, clear it and disable 2FA
      // Users will keep their 2FA setup but won't be required to use it until 2FA is re-enabled
      if (config && config.recoveryEmailSenderId === emailId) {
        await prisma.configuration.update({
          where: { id: config.id },
          data: { 
            recoveryEmailSenderId: null,
            twoFactorEnabled: false
          }
        });
      }
    }

    res.status(200).json({
      message: 'Email sender deleted successfully',
    });
  } catch (error) {
    console.error('Delete email error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Email sender not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Send test email
const sendTestEmail = async (req, res) => {
  try {
    const { fromEmail, toEmails, ccEmails, bccEmails, subject, content } = req.body;

    if (!fromEmail || !toEmails || !subject || !content) {
      res.status(400).json({ error: 'fromEmail, toEmails, subject, and content are required' });
      return;
    }

    // Parse email arrays from JSON strings if needed (multer sends form fields as strings)
    const parseEmailArray = (emails) => {
      if (!emails) return [];
      if (Array.isArray(emails)) return emails;
      if (typeof emails === 'string') {
        try {
          const parsed = JSON.parse(emails);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          // If not JSON, treat as comma-separated string
          return emails.split(',').map(e => e.trim()).filter(e => e);
        }
      }
      return [];
    };

    const toEmailsArray = parseEmailArray(toEmails);
    const ccEmailsArray = parseEmailArray(ccEmails);
    const bccEmailsArray = parseEmailArray(bccEmails);

    // Validate at least one recipient
    if (toEmailsArray.length === 0) {
      res.status(400).json({ error: 'At least one recipient email is required' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(fromEmail)) {
      res.status(400).json({ error: 'Invalid fromEmail format' });
      return;
    }

    const validateEmailArray = (emails, fieldName) => {
      for (const email of emails) {
        if (!emailRegex.test(email)) {
          res.status(400).json({ error: `Invalid email format in ${fieldName}: ${email}` });
          return false;
        }
      }
      return true;
    };

    if (!validateEmailArray(toEmailsArray, 'toEmails')) return;
    if (ccEmailsArray.length > 0 && !validateEmailArray(ccEmailsArray, 'ccEmails')) return;
    if (bccEmailsArray.length > 0 && !validateEmailArray(bccEmailsArray, 'bccEmails')) return;

    // Process attachments from multer
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        });
      }
    }

    const emailOptions = {
      fromEmail: fromEmail.toLowerCase().trim(),
      toEmails: toEmailsArray.map(e => e.toLowerCase().trim()),
      ccEmails: ccEmailsArray.length > 0 ? ccEmailsArray.map(e => e.toLowerCase().trim()) : undefined,
      bccEmails: bccEmailsArray.length > 0 ? bccEmailsArray.map(e => e.toLowerCase().trim()) : undefined,
      subject: subject,
      content: content,
      isHtml: false, // Default to plain text, can be made configurable
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const result = await sendEmail(emailOptions);

    res.status(200).json({
      message: 'Test email sent successfully',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send test email' });
  }
};

module.exports = {
  getAllEmails,
  getEmailById,
  createEmail,
  updateEmail,
  deleteEmail,
  sendTestEmail,
};

