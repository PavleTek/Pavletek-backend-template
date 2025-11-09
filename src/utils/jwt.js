const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (user) => {
  const payload = {
    userId: user.id.toString(),
    username: user.username,
    email: user.email,
    name: user.name,
    lastName: user.lastName,
    roles: user.roles || [],
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    throw new Error('Token verification failed');
  }
};

const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header format');
  }
  
  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

// Generate temporary token for 2FA verification (short expiration)
const generateTempToken = (user) => {
  const payload = {
    userId: user.id.toString(),
    username: user.username,
    email: user.email,
    name: user.name,
    lastName: user.lastName,
    roles: user.roles || [],
    isTempToken: true, // Flag to indicate this is a temporary token
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '10m', // 10 minutes expiration for 2FA verification
  });
};

module.exports = {
  generateToken,
  generateTempToken,
  verifyToken,
  extractTokenFromHeader
};

