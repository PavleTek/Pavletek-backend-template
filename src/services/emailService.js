const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { ConfidentialClientApplication } = require("@azure/msal-node");
const prisma = require("../lib/prisma");

/**
 * Get OAuth2 access token for Gmail
 * @param {string} refreshToken - Gmail refresh token from database
 */
async function getGmailAccessToken(refreshToken) {
  console.log("🔑 [getGmailAccessToken] Starting Gmail access token retrieval");
  
  if (!refreshToken) {
    console.error("❌ [getGmailAccessToken] Refresh token is missing");
    throw new Error("Gmail refresh token is required");
  }

  console.log("🔑 [getGmailAccessToken] Refresh token present (length:", refreshToken.length, ")");
  console.log("🔑 [getGmailAccessToken] GMAIL_CLIENT_ID present:", !!process.env.GMAIL_CLIENT_ID);
  console.log("🔑 [getGmailAccessToken] GMAIL_CLIENT_SECRET present:", !!process.env.GMAIL_CLIENT_SECRET);

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "urn:ietf:wg:oauth:2.0:oob" // Redirect URI for installed apps
    );

    console.log("🔑 [getGmailAccessToken] OAuth2 client created");

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    console.log("🔑 [getGmailAccessToken] Credentials set, refreshing access token...");

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    console.log("✅ [getGmailAccessToken] Access token retrieved successfully");
    console.log("🔑 [getGmailAccessToken] Access token present:", !!credentials.access_token);
    console.log("🔑 [getGmailAccessToken] Access token length:", credentials.access_token?.length || 0);
    
    return credentials.access_token;
  } catch (error) {
    console.error("❌ [getGmailAccessToken] Error retrieving access token:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data
    });
    throw error;
  }
}

/**
 * Get OAuth2 access token for Outlook
 * @param {string} refreshToken - Outlook refresh token from database
 */
async function getOutlookAccessToken(refreshToken) {
  console.log("🔑 [getOutlookAccessToken] Starting Outlook access token retrieval");
  
  if (!refreshToken) {
    console.error("❌ [getOutlookAccessToken] Refresh token is missing");
    throw new Error("Outlook refresh token is required");
  }

  console.log("🔑 [getOutlookAccessToken] Refresh token present (length:", refreshToken.length, ")");
  console.warn("⚠️ [getOutlookAccessToken] Outlook OAuth2 refresh token flow not implemented");

  // Note: Outlook OAuth2 refresh token flow requires additional implementation
  // This is a placeholder - you may need to implement token refresh logic using
  // Microsoft Graph API or Azure AD token endpoint
  // For now, we'll use SMTP with OAuth2, which requires the refresh token
  // to be exchanged for an access token via Microsoft's token endpoint
  
  // TODO: Implement proper Outlook refresh token exchange
  // This typically involves calling:
  // POST https://login.microsoftonline.com/common/oauth2/v2.0/token
  // with grant_type=refresh_token, client_id, client_secret, and refresh_token
  
  throw new Error(
    "Outlook OAuth2 refresh token flow needs to be implemented. For now, use SMTP with OAuth2 access tokens."
  );
}

/**
 * Send email via Gmail
 */
async function sendViaGmail(options) {
  console.log("📧 [sendViaGmail] Starting Gmail email send");
  console.log("📧 [sendViaGmail] Options received:", {
    fromEmail: options.fromEmail,
    toEmails: options.toEmails,
    ccEmails: options.ccEmails,
    bccEmails: options.bccEmails,
    subject: options.subject,
    contentLength: options.content?.length || 0,
    isHtml: options.isHtml,
    attachmentsCount: options.attachments?.length || 0,
    hasRefreshToken: !!options.refreshToken
  });

  const { fromEmail, toEmails, ccEmails, bccEmails, subject, content, isHtml, attachments, refreshToken } =
    options;

  if (!refreshToken) {
    console.error("❌ [sendViaGmail] Refresh token is missing");
    throw new Error(
      "Gmail refresh token is required. Please add a refresh token to the email sender configuration."
    );
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.error("❌ [sendViaGmail] Gmail OAuth2 credentials not configured");
    console.error("❌ [sendViaGmail] GMAIL_CLIENT_ID:", !!process.env.GMAIL_CLIENT_ID);
    console.error("❌ [sendViaGmail] GMAIL_CLIENT_SECRET:", !!process.env.GMAIL_CLIENT_SECRET);
    throw new Error(
      "Gmail OAuth2 credentials not configured. Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env"
    );
  }

  console.log("🔑 [sendViaGmail] Getting Gmail access token...");
  let accessToken;
  try {
    accessToken = await getGmailAccessToken(refreshToken);
    console.log("✅ [sendViaGmail] Access token retrieved");
  } catch (error) {
    console.error("❌ [sendViaGmail] Failed to get access token:", {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
  
  console.log("📧 [sendViaGmail] Creating nodemailer transporter...");
  let transporter;
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: fromEmail,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: refreshToken,
        accessToken: accessToken,
      },
    });
    console.log("✅ [sendViaGmail] Transporter created successfully");
  } catch (error) {
    console.error("❌ [sendViaGmail] Failed to create transporter:", {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }

  console.log("📧 [sendViaGmail] Preparing mail options...");
  const mailOptions = {
    from: fromEmail,
    to: Array.isArray(toEmails) ? toEmails.join(", ") : toEmails,
    cc: ccEmails && Array.isArray(ccEmails) ? ccEmails.join(", ") : ccEmails,
    bcc:
      bccEmails && Array.isArray(bccEmails) ? bccEmails.join(", ") : bccEmails,
    subject: subject,
    [isHtml ? "html" : "text"]: content,
    attachments: attachments || [],
  };

  console.log("📧 [sendViaGmail] Mail options prepared:", {
    from: mailOptions.from,
    to: mailOptions.to,
    cc: mailOptions.cc || "(none)",
    bcc: mailOptions.bcc || "(none)",
    subject: mailOptions.subject,
    contentType: isHtml ? "html" : "text",
    attachmentsCount: mailOptions.attachments.length
  });

  console.log("📧 [sendViaGmail] Attempting to send email via nodemailer...");
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ [sendViaGmail] Email sent successfully!");
    console.log("📧 [sendViaGmail] Send result:", {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending
    });
    return info;
  } catch (error) {
    console.error("❌ [sendViaGmail] Failed to send email:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      responseMessage: error.responseMessage
    });
    throw error;
  }
}

/**
 * Send email via Outlook
 */
async function sendViaOutlook(options) {
  console.log("📧 [sendViaOutlook] Starting Outlook email send");
  console.log("📧 [sendViaOutlook] Options received:", {
    fromEmail: options.fromEmail,
    toEmails: options.toEmails,
    ccEmails: options.ccEmails,
    bccEmails: options.bccEmails,
    subject: options.subject,
    contentLength: options.content?.length || 0,
    isHtml: options.isHtml,
    attachmentsCount: options.attachments?.length || 0,
    hasRefreshToken: !!options.refreshToken
  });

  const { fromEmail, toEmails, ccEmails, bccEmails, subject, content, isHtml, attachments, refreshToken } =
    options;

  if (!refreshToken) {
    console.error("❌ [sendViaOutlook] Refresh token is missing");
    throw new Error(
      "Outlook refresh token is required. Please add a refresh token to the email sender configuration."
    );
  }

  console.warn("⚠️ [sendViaOutlook] Outlook OAuth2 implementation not yet complete");

  // For Outlook, we'll use SMTP with OAuth2
  // Note: This requires getting an access token from the refresh token
  // For now, we'll use a simplified approach - in production, you may need
  // to implement proper token refresh using Microsoft Graph API
  
  // TODO: Implement proper Outlook OAuth2 token refresh
  // For now, using SMTP with basic auth is not supported without app passwords
  // Outlook OAuth2 requires access token generation from refresh token
  
  throw new Error(
    "Outlook OAuth2 implementation requires access token refresh. Please implement token refresh logic using Microsoft Graph API or Azure AD token endpoint."
  );
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
 * @param {Array} [options.attachments] - Email attachments array
 * @returns {Promise} - Email send result
 */
async function sendEmail(options) {
  console.log("📬 [sendEmail] ========== EMAIL SEND REQUEST STARTED ==========");
  console.log("📬 [sendEmail] Received options:", {
    fromEmail: options.fromEmail,
    toEmails: options.toEmails,
    ccEmails: options.ccEmails,
    bccEmails: options.bccEmails,
    subject: options.subject,
    contentLength: options.content?.length || 0,
    isHtml: options.isHtml || false,
    attachmentsCount: options.attachments?.length || 0
  });

  const { fromEmail, toEmails, subject, content } = options;

  if (!fromEmail || !toEmails || !subject || !content) {
    console.error("❌ [sendEmail] Missing required parameters:", {
      hasFromEmail: !!fromEmail,
      hasToEmails: !!toEmails,
      hasSubject: !!subject,
      hasContent: !!content
    });
    throw new Error(
      "Missing required email parameters: fromEmail, toEmails, subject, and content are required"
    );
  }

  // Normalize the fromEmail for lookup
  const normalizedFromEmail = fromEmail.toLowerCase().trim();
  console.log("📬 [sendEmail] Normalized fromEmail:", normalizedFromEmail);

  // Try to find email sender by main email first
  console.log("📬 [sendEmail] Looking up email sender in database by main email...");
  let emailSender = await prisma.emailSender.findUnique({
    where: { email: normalizedFromEmail },
  });

  if (emailSender) {
    console.log("✅ [sendEmail] Email sender found by main email:", {
      id: emailSender.id,
      email: emailSender.email,
      provider: emailSender.emailProvider,
      hasRefreshToken: !!emailSender.refreshToken,
      aliasesCount: emailSender.aliases?.length || 0
    });
  } else {
    console.log("⚠️ [sendEmail] Email sender not found by main email, searching aliases...");
    // If not found by main email, search for it in aliases
    const allEmailSenders = await prisma.emailSender.findMany();
    console.log("📬 [sendEmail] Found", allEmailSenders.length, "total email senders in database");
    
    emailSender = allEmailSenders.find((sender) => {
      // Check if the fromEmail matches any alias
      return sender.aliases && sender.aliases.some(
        (alias) => alias.toLowerCase().trim() === normalizedFromEmail
      );
    });

    if (emailSender) {
      console.log("✅ [sendEmail] Email sender found by alias:", {
        id: emailSender.id,
        email: emailSender.email,
        provider: emailSender.emailProvider,
        hasRefreshToken: !!emailSender.refreshToken,
        matchingAlias: normalizedFromEmail
      });
    } else {
      console.error("❌ [sendEmail] Email sender not found in database");
      console.error("❌ [sendEmail] Searched for:", normalizedFromEmail);
      console.error("❌ [sendEmail] Available senders:", allEmailSenders.map(s => ({
        id: s.id,
        email: s.email,
        aliases: s.aliases
      })));
    }
  }

  if (!emailSender) {
    throw new Error(
      `Email sender ${fromEmail} not found in database. Please add it first or ensure the alias is configured.`
    );
  }

  // Check if refresh token is present
  if (!emailSender.refreshToken) {
    console.error("❌ [sendEmail] Email sender missing refresh token:", {
      id: emailSender.id,
      email: emailSender.email,
      provider: emailSender.emailProvider
    });
    throw new Error(
      `Email sender ${emailSender.email} is missing a refresh token. Please add a refresh token to the email sender configuration.`
    );
  }

  console.log("✅ [sendEmail] Refresh token found (length:", emailSender.refreshToken.length, ")");

  // Use the provided fromEmail (which could be an alias) for sending
  // But use the main email's refresh token for OAuth authentication
  const normalizedOptions = {
    ...options,
    fromEmail: normalizedFromEmail, // Use the alias or main email as provided
    refreshToken: emailSender.refreshToken, // Use main email's refresh token
  };

  console.log("📬 [sendEmail] Routing to provider:", emailSender.emailProvider);
  console.log("📬 [sendEmail] Normalized options prepared:", {
    fromEmail: normalizedOptions.fromEmail,
    toEmails: normalizedOptions.toEmails,
    hasRefreshToken: !!normalizedOptions.refreshToken,
    refreshTokenLength: normalizedOptions.refreshToken?.length || 0
  });

  // Route to appropriate provider function
  try {
    let result;
    if (emailSender.emailProvider === "GMAIL") {
      console.log("📬 [sendEmail] Routing to Gmail provider...");
      result = await sendViaGmail(normalizedOptions);
    } else if (emailSender.emailProvider === "OUTLOOK") {
      console.log("📬 [sendEmail] Routing to Outlook provider...");
      result = await sendViaOutlook(normalizedOptions);
    } else {
      console.error("❌ [sendEmail] Unsupported provider:", emailSender.emailProvider);
      throw new Error(`Unsupported email provider: ${emailSender.emailProvider}`);
    }

    console.log("✅ [sendEmail] ========== EMAIL SEND SUCCESSFUL ==========");
    console.log("✅ [sendEmail] Result:", {
      messageId: result.messageId,
      response: result.response
    });
    return result;
  } catch (error) {
    console.error("❌ [sendEmail] ========== EMAIL SEND FAILED ==========");
    console.error("❌ [sendEmail] Error details:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
      cause: error.cause
    });
    throw error;
  }
}

module.exports = {
  sendEmail,
  sendViaGmail,
  sendViaOutlook,
};
