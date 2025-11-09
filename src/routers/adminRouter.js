const express = require('express');
const { 
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
} = require('../controllers/adminController');
const { getConfig, updateConfig } = require('../controllers/configController');
const { authenticateToken, authenticateRoles } = require('../middleware/authentication');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(authenticateRoles(['admin']));

// User management routes
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.put('/users/:id/password', changeUserPassword);
router.put('/users/:id/roles', changeUserRoles);
router.post('/users/:id/reset-2fa', forceResetUser2FA);
router.delete('/users/:id', deleteUser);

// Role management routes
router.get('/roles', getAllRoles);
router.post('/roles', createRole);
router.put('/roles/:id', updateRole);
router.delete('/roles/:id', deleteRole);

// Configuration routes
router.get('/config', getConfig);
router.put('/config', updateConfig);

module.exports = router;

