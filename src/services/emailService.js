const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { ConfidentialClientApplication } = require("@azure/msal-node");
const prisma = require("../lib/prisma");

/**
 * Get OAuth2 access token for Gmail
 */
async function getGmailAccessToken() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob" // Redirect URI for installed apps
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token;
}

/**
 * Get OAuth2 access token for Outlook
 */
async function getOutlookAccessToken() {
  const msalConfig = {
    auth: {
      clientId: process.env.OUTLOOK_CLIENT_ID,
      clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
      authority: "https://login.microsoftonline.com/common",
    },
  };

  const cca = new ConfidentialClientApplication(msalConfig);
  const tokenRequest = {
    scopes: ["https://graph.microsoft.com/.default"],
    grantType: "client_credentials",
  };

  // For Outlook, we'll use client credentials flow
  // But for sending emails, we need user delegated permissions
  // This is a simplified version - in production, you'd want to use refresh tokens
  try {
    const response = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });
    return response.accessToken;
  } catch (error) {
    // Fallback to using refresh token if available
    if (process.env.OUTLOOK_REFRESH_TOKEN) {
      // In a real implementation, you'd exchange the refresh token for a new access token
      // This is a placeholder - you may need to implement token refresh logic
      throw new Error(
        "Outlook OAuth2 refresh token flow not fully implemented. Consider using App Password instead."
      );
    }
    throw error;
  }
}

/**
 * Send email via Gmail
 */
async function sendViaGmail(options) {
  const { fromEmail, toEmails, ccEmails, bccEmails, subject, content, isHtml } =
    options;

  let transporter;
  console.log()

  // Try OAuth2 first if credentials are available
  if (
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  ) {
    try {
      console.log("trying to use the oauth2 shit");
      const accessToken = await getGmailAccessToken();
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: fromEmail,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          accessToken: accessToken,
        },
      });
    } catch (error) {
      console.error("Gmail OAuth2 failed, trying app password:", error);
      // Fall through to app password
    }
  }

  // Fallback to App Password if OAuth2 failed or not configured
  if (!transporter && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: fromEmail,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  if (!transporter) {
    throw new Error(
      "Gmail credentials not configured. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, or GMAIL_APP_PASSWORD in .env"
    );
  }

  const mailOptions = {
    from: fromEmail,
    to: Array.isArray(toEmails) ? toEmails.join(", ") : toEmails,
    cc: ccEmails && Array.isArray(ccEmails) ? ccEmails.join(", ") : ccEmails,
    bcc:
      bccEmails && Array.isArray(bccEmails) ? bccEmails.join(", ") : bccEmails,
    subject: subject,
    [isHtml ? "html" : "text"]: content,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

/**
 * Send email via Outlook
 */
async function sendViaOutlook(options) {
  const { fromEmail, toEmails, ccEmails, bccEmails, subject, content, isHtml } =
    options;

  let transporter;

  // Try OAuth2 first if credentials are available
  if (process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_CLIENT_SECRET) {
    try {
      // For Outlook, OAuth2 is more complex and typically requires user interaction
      // For template purposes, we'll use SMTP with App Password as the primary method
      // OAuth2 can be implemented later if needed
    } catch (error) {
      console.error("Outlook OAuth2 setup error:", error);
    }
  }

  // Use SMTP with App Password (recommended for Outlook)
  if (process.env.OUTLOOK_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: fromEmail,
        pass: process.env.OUTLOOK_APP_PASSWORD,
      },
      tls: {
        ciphers: "SSLv3",
      },
    });
  } else {
    throw new Error(
      "Outlook credentials not configured. Please set OUTLOOK_APP_PASSWORD in .env"
    );
  }

  const mailOptions = {
    from: fromEmail,
    to: Array.isArray(toEmails) ? toEmails.join(", ") : toEmails,
    cc: ccEmails && Array.isArray(ccEmails) ? ccEmails.join(", ") : ccEmails,
    bcc:
      bccEmails && Array.isArray(bccEmails) ? bccEmails.join(", ") : bccEmails,
    subject: subject,
    [isHtml ? "html" : "text"]: content,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

/**
 * Main reusable email sending function
 * @param {Object} options - Email options
 * @param {string} options.fromEmail - Sender email address (must be in EmailSender table)
 * @param {string|string[]} options.toEmails - Recipient email(s)
 * @param {string|string[]} [options.ccEmails] - CC email(s)
 * @param {string|string[]} [options.bccEmails] - BCC email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.content - Email content (text or HTML)
 * @param {boolean} [options.isHtml=false] - Whether content is HTML
 * @returns {Promise} - Email send result
 */
async function sendEmail(options) {
  const { fromEmail, toEmails, subject, content } = options;

  if (!fromEmail || !toEmails || !subject || !content) {
    throw new Error(
      "Missing required email parameters: fromEmail, toEmails, subject, and content are required"
    );
  }

  // Get the email sender from database to determine provider
  const emailSender = await prisma.emailSender.findUnique({
    where: { email: fromEmail.toLowerCase().trim() },
  });

  if (!emailSender) {
    throw new Error(
      `Email sender ${fromEmail} not found in database. Please add it first.`
    );
  }

  // Use the normalized email from database for sending
  const normalizedOptions = {
    ...options,
    fromEmail: emailSender.email,
  };

  // Route to appropriate provider function
  if (emailSender.emailProvider === "GMAIL") {
    return await sendViaGmail(normalizedOptions);
  } else if (emailSender.emailProvider === "OUTLOOK") {
    return await sendViaOutlook(normalizedOptions);
  } else {
    throw new Error(`Unsupported email provider: ${emailSender.emailProvider}`);
  }
}

module.exports = {
  sendEmail,
  sendViaGmail,
  sendViaOutlook,
};
