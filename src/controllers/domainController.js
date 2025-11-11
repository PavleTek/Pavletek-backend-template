const prisma = require('../lib/prisma');

// Get all domains
const getAllDomains = async (req, res) => {
  try {
    const domains = await prisma.domain.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      message: 'Domains retrieved successfully',
      domains: domains,
    });
  } catch (error) {
    console.error('Get all domains error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new domain
const createDomain = async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      res.status(400).json({ error: 'Domain is required' });
      return;
    }

    const normalizedDomain = domain.trim();

    if (!normalizedDomain) {
      res.status(400).json({ error: 'Domain cannot be empty' });
      return;
    }

    const existingDomain = await prisma.domain.findUnique({
      where: { domain: normalizedDomain },
    });

    if (existingDomain) {
      res.status(409).json({ error: 'Domain already exists' });
      return;
    }

    const newDomain = await prisma.domain.create({
      data: {
        domain: normalizedDomain,
      },
    });

    res.status(201).json({
      message: 'Domain created successfully',
      domain: newDomain,
    });
  } catch (error) {
    console.error('Create domain error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Domain already exists' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a domain
const deleteDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const domainId = parseInt(id);

    if (isNaN(domainId)) {
      res.status(400).json({ error: 'Invalid domain ID' });
      return;
    }

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }

    // Check if any emails use this domain
    // Email format is: name@domain, so we check if any email ends with @{domain}
    const emailsUsingDomain = await prisma.emailSender.findMany({
      where: {
        email: {
          endsWith: `@${domain.domain}`,
        },
      },
    });

    if (emailsUsingDomain.length > 0) {
      res.status(400).json({
        error: `Cannot delete domain. ${emailsUsingDomain.length} email sender(s) are using this domain.`,
      });
      return;
    }

    await prisma.domain.delete({
      where: { id: domainId },
    });

    res.status(200).json({
      message: 'Domain deleted successfully',
    });
  } catch (error) {
    console.error('Delete domain error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllDomains,
  createDomain,
  deleteDomain,
};

