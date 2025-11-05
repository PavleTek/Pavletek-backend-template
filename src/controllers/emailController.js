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
    const { email, emailProvider } = req.body;

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

    const newEmail = await prisma.emailSender.create({
      data: {
        email: email.toLowerCase().trim(),
        emailProvider: emailProvider.toUpperCase(),
      },
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
    const { email, emailProvider } = req.body;

    if (isNaN(emailId)) {
      res.status(400).json({ error: 'Invalid email ID' });
      return;
    }

    if (!email && !emailProvider) {
      res.status(400).json({ error: 'At least one field (email or emailProvider) is required' });
      return;
    }

    const updateData = {};
    if (email) {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
    const { fromEmail, toEmail, subject, content } = req.body;

    if (!fromEmail || !toEmail || !subject || !content) {
      res.status(400).json({ error: 'fromEmail, toEmail, subject, and content are required' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail) || !emailRegex.test(toEmail)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const emailOptions = {
      fromEmail: fromEmail.toLowerCase().trim(),
      toEmails: [toEmail.toLowerCase().trim()],
      subject: subject,
      content: content,
      isHtml: false, // Default to plain text, can be made configurable
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

