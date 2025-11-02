const prisma = require('../lib/prisma');
const { extractTokenFromHeader, verifyToken } = require('../utils/jwt');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = extractTokenFromHeader(authHeader);
    const decoded = verifyToken(token);

    // Fetch user from database with roles to ensure they still exist
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

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Transform user data to match our interface
    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      chileanRutNumber: user.chileanRutNumber,
      color: user.color,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      createdBy: user.createdBy,
      roles: user.userRoles.map((ur) => ur.role.name)
    };

    req.user = userWithoutPassword;
    next();
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const token = extractTokenFromHeader(authHeader);
    const decoded = verifyToken(token);

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

    if (user) {
      const userWithoutPassword = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        chileanRutNumber: user.chileanRutNumber,
        color: user.color,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        createdBy: user.createdBy,
        roles: user.userRoles.map((ur) => ur.role.name)
      };
      req.user = userWithoutPassword;
    }
    
    next();
  } catch (error) {
    // For optional auth, we just continue without setting req.user
    next();
  }
};

const authenticateRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRoles = req.user.roles;
    const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        userRoles: userRoles
      });
      return;
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  authenticateRoles
};

