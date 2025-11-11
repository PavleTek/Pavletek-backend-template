const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate a TOTP secret for a user
 * @returns {string} Base32 encoded secret
 */
function generateSecret() {
  return speakeasy.generateSecret({
    name: process.env.APP_NAME || 'Application',
    length: 32
  }).base32;
}

/**
 * Generate QR code data URL for TOTP setup
 * @param {string} secret - Base32 encoded secret
 * @param {string} email - User's email address
 * @param {string} issuer - Issuer name (default: APP_NAME or 'Application')
 * @returns {Promise<string>} Data URL of QR code image
 */
async function generateQRCode(secret, email, issuer = null) {
  const appName = issuer || process.env.APP_NAME || 'Application';
  const otpauthUrl = speakeasy.otpauthURL({
    secret: secret,
    label: email,
    issuer: appName,
    encoding: 'base32'
  });

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP token
 * @param {string} secret - Base32 encoded secret
 * @param {string} token - TOTP code from user
 * @param {number} window - Time window tolerance (default: 2)
 * @returns {boolean} True if token is valid
 */
function verifyToken(secret, token, window = 2) {
  try {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: window // Allow tokens from previous/next 2 time steps
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}

/**
 * Generate a 6-digit recovery code for 2FA reset
 * @returns {string} 6-digit numeric code
 */
function generateRecoveryCode() {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash a recovery code for storage
 * @param {string} code - Plain recovery code
 * @returns {string} Hashed code
 */
function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify a recovery code against hashed code
 * @param {string} code - Plain recovery code to verify
 * @param {string} hashedCode - Hashed recovery code
 * @returns {boolean} True if code matches
 */
function verifyRecoveryCode(code, hashedCode) {
  const computedHash = hashRecoveryCode(code);
  return computedHash === hashedCode;
}

module.exports = {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode
};

