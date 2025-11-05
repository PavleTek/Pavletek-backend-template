const express = require('express');
const {
  getAllEmails,
  getEmailById,
  createEmail,
  updateEmail,
  deleteEmail,
  sendTestEmail,
} = require('../controllers/emailController');
const { authenticateToken, authenticateRoles } = require('../middleware/authentication');

const router = express.Router();

// All email routes require authentication and admin role
router.use(authenticateToken);
router.use(authenticateRoles(['admin']));

// Email sender management routes
router.get('/emails', getAllEmails);
router.get('/emails/:id', getEmailById);
router.post('/emails', createEmail);
router.put('/emails/:id', updateEmail);
router.delete('/emails/:id', deleteEmail);

// Test email route
router.post('/emails/test', sendTestEmail);

module.exports = router;

