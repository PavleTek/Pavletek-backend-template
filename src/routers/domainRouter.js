const express = require('express');
const {
  getAllDomains,
  createDomain,
  deleteDomain,
} = require('../controllers/domainController');
const { authenticateToken, authenticateRoles } = require('../middleware/authentication');

const router = express.Router();

// All domain routes require authentication and admin role
router.use(authenticateToken);
router.use(authenticateRoles(['admin']));

// Domain management routes
router.get('/domains', getAllDomains);
router.post('/domains', createDomain);
router.delete('/domains/:id', deleteDomain);

module.exports = router;

