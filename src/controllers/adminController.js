const prisma = require('../lib/prisma');
const { hashPassword } = require('../utils/password');

// Get all users with their roles
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    const usersWithoutPassword = users.map(user => ({
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
    }));

    res.status(200).json({
      message: 'Users retrieved successfully',
      users: usersWithoutPassword
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a specific user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

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

    res.status(200).json({
      message: 'User retrieved successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new user
const createUser = async (req, res) => {
  try {
    const { username, email, password, name, lastName, chileanRutNumber, roleIds } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      res.status(409).json({ error: 'Username or email already exists' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        hashedPassword,
        name,
        lastName,
        chileanRutNumber,
        createdBy: req.user?.id || 0,
        userRoles: roleIds ? {
          create: roleIds.map((roleId) => ({
            roleId
          }))
        } : undefined
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

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

    res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user information
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    const { username, email, name, lastName, chileanRutNumber, color } = req.body;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        ...(email && { email }),
        ...(name !== undefined && { name }),
        ...(lastName !== undefined && { lastName }),
        ...(chileanRutNumber !== undefined && { chileanRutNumber }),
        ...(color !== undefined && { color })
      },
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
      roles: updatedUser.userRoles.map((ur) => ur.role.name)
    };

    res.status(200).json({
      message: 'User updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change user password
const changeUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    const { password } = req.body;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id: userId },
      data: { hashedPassword }
    });

    res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change user roles
const changeUserRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    const { roleIds } = req.body;

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    if (!Array.isArray(roleIds)) {
      res.status(400).json({ error: 'Role IDs must be an array' });
      return;
    }

    // Check if user exists
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

    // Check if the user being modified is the current admin
    const currentUserId = req.user?.id;
    const isModifyingSelf = currentUserId === userId;

    if (isModifyingSelf) {
      // Check if they're trying to remove admin role from themselves
      const currentUserRoles = user.userRoles.map((ur) => ur.role.name);
      const hasAdminRole = currentUserRoles.includes('admin');
      
      if (hasAdminRole) {
        // Get the new roles
        const newRoles = await prisma.role.findMany({
          where: { id: { in: roleIds } }
        });
        
        const newRoleNames = newRoles.map(role => role.name);
        const willHaveAdminRole = newRoleNames.includes('admin');
        
        if (!willHaveAdminRole) {
          // Check how many other admins exist
          const adminCount = await prisma.userRole.count({
            where: {
              role: { name: 'admin' },
              userId: { not: userId }
            }
          });
          
          if (adminCount === 0) {
            res.status(400).json({ 
              error: 'Cannot remove admin role. At least one admin must remain in the system.' 
            });
            return;
          }
        }
      }
    }

    // Remove all existing roles
    await prisma.userRole.deleteMany({
      where: { userId }
    });

    // Add new roles
    if (roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId,
          roleId
        }))
      });
    }

    // Get updated user with roles
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
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
      roles: updatedUser.userRoles.map((ur) => ur.role.name)
    };

    res.status(200).json({
      message: 'User roles updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Change user roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Force reset user's 2FA (admin only)
const forceResetUser2FA = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Clear all 2FA-related data
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        userEnabledTwoFactor: false,
        twoFactorRecoveryCode: null,
        twoFactorRecoveryCodeExpires: null
      }
    });

    res.status(200).json({
      message: '2FA has been reset for this user. They will need to set up 2FA again on their next login if system 2FA is enabled.'
    });
  } catch (error) {
    console.error('Force reset 2FA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Prevent users from deleting themselves
    const currentUserId = req.user?.id;
    if (currentUserId && userId === currentUserId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    // Check if user exists
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

    // Check if the user being deleted is an admin
    const userRoles = user.userRoles.map((ur) => ur.role.name);
    const isAdmin = userRoles.includes('admin');

    if (isAdmin) {
      // Check how many other admins exist
      const adminCount = await prisma.userRole.count({
        where: {
          role: { name: 'admin' },
          userId: { not: userId }
        }
      });

      if (adminCount === 0) {
        res.status(400).json({ 
          error: 'Cannot delete user. At least one admin must remain in the system.' 
        });
        return;
      }
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    res.status(200).json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all available roles
const getAllRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' }
    });

    res.status(200).json({
      message: 'Roles retrieved successfully',
      roles
    });
  } catch (error) {
    console.error('Get all roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new role
const createRole = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Role name is required and must be a non-empty string' });
      return;
    }

    const roleName = name.trim().toLowerCase();

    // Check if role already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (existingRole) {
      res.status(409).json({ error: 'Role already exists' });
      return;
    }

    const role = await prisma.role.create({
      data: { name: roleName }
    });

    res.status(201).json({
      message: 'Role created successfully',
      role
    });
  } catch (error) {
    console.error('Create role error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Role already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a role
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const roleId = parseInt(id);
    const { name } = req.body;

    if (isNaN(roleId)) {
      res.status(400).json({ error: 'Invalid role ID' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Role name is required and must be a non-empty string' });
      return;
    }

    const roleName = name.trim().toLowerCase();

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!existingRole) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    // Prevent renaming 'admin' role
    if (existingRole.name === 'admin') {
      res.status(400).json({ error: 'Cannot rename the admin role' });
      return;
    }

    // Check if new name already exists (excluding current role)
    const duplicateRole = await prisma.role.findFirst({
      where: {
        AND: [
          { id: { not: roleId } },
          { name: roleName }
        ]
      }
    });

    if (duplicateRole) {
      res.status(409).json({ error: 'Role name already exists' });
      return;
    }

    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: { name: roleName }
    });

    res.status(200).json({
      message: 'Role updated successfully',
      role: updatedRole
    });
  } catch (error) {
    console.error('Update role error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Role name already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a role
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const roleId = parseInt(id);

    if (isNaN(roleId)) {
      res.status(400).json({ error: 'Invalid role ID' });
      return;
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        userRoles: true
      }
    });

    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    // Prevent deleting 'admin' role
    if (role.name === 'admin') {
      res.status(400).json({ error: 'Cannot delete the admin role' });
      return;
    }

    // Check if any users have this role
    if (role.userRoles.length > 0) {
      res.status(400).json({ 
        error: 'Cannot delete role. There are users assigned to this role.',
        userCount: role.userRoles.length
      });
      return;
    }

    await prisma.role.delete({
      where: { id: roleId }
    });

    res.status(200).json({
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserPassword,
  changeUserRoles,
  forceResetUser2FA,
  deleteUser,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole
};

