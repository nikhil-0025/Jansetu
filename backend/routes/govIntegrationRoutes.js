const express = require('express');
const router = express.Router();
const govIntegration = require('../integrations');
const { requireAuth, requireRole } = require('../middleware/auth');
const dataStore = require('../models/dataStore');

// GET /api/government-services/status - Overall gateway status, connection states, and masked config
router.get('/status', (req, res) => {
  try {
    const report = govIntegration.getStatusReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/government-services/inventory - Formal Candidate API Integration Inventory
router.get('/inventory', (req, res) => {
  try {
    const inventory = govIntegration.getInventory();
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/government-services/audit-logs - Outbound Government Request Audit Logs
router.get('/audit-logs', requireAuth, requireRole(['officer', 'admin']), (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const logs = govIntegration.getAuditLogs(limit);
    res.json({ success: true, count: logs.length, auditLogs: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/government-services/digilocker/verify-ration - Verify e-PDS Ration Card
router.post('/digilocker/verify-ration', requireAuth, async (req, res) => {
  try {
    const { rationCardNo, citizenId, citizenName, state } = req.body;
    const actorId = req.user.userId;
    const actorRole = req.user.role;

    if (!rationCardNo) {
      return res.status(400).json({ success: false, message: 'Ration card number is required.' });
    }

    const result = await govIntegration.verifyRationCard({
      rationCardNo,
      citizenId: citizenId || req.user.headCitizenId || 'CIT-1001',
      citizenName: citizenName || req.user.headName || 'Rahul Sharma',
      state: state || 'UP',
      actorId,
      actorRole
    });

    res.json({
      success: true,
      message: result.metadata.isAuthoritative 
        ? 'Authoritative e-PDS record verified successfully.' 
        : 'Simulated e-PDS record returned via JanSetu Demo Adapter.',
      result
    });
  } catch (err) {
    console.error('Ration verification error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/government-services/digilocker/verify-electricity - Verify Dwelling Electricity Connection
router.post('/digilocker/verify-electricity', requireAuth, async (req, res) => {
  try {
    const { consumerNumber, premisesAddress, citizenId, citizenName } = req.body;
    const actorId = req.user.userId;
    const actorRole = req.user.role;

    if (!consumerNumber) {
      return res.status(400).json({ success: false, message: 'Electricity consumer number is required.' });
    }

    const result = await govIntegration.verifyElectricityDwelling({
      consumerNumber,
      premisesAddress,
      citizenId: citizenId || req.user.headCitizenId || 'CIT-1002',
      citizenName: citizenName || 'Amit Sharma',
      actorId,
      actorRole
    });

    res.json({
      success: true,
      message: result.metadata.isAuthoritative 
        ? 'Authoritative DISCOM electricity connection verified.' 
        : 'Simulated DISCOM electricity connection returned via JanSetu Demo Adapter.',
      result
    });
  } catch (err) {
    console.error('Electricity verification error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/government-services/digilocker/pull-doc - Pull DigiLocker Document with consent
router.post('/digilocker/pull-doc', requireAuth, async (req, res) => {
  try {
    const { docType, referenceNo, citizenName, familyId, citizenId } = req.body;
    const actorId = req.user.userId;
    const actorRole = req.user.role;

    if (!docType) {
      return res.status(400).json({ success: false, message: 'Document type is required.' });
    }

    const result = await govIntegration.pullDigiLockerDoc({
      docType,
      referenceNo,
      citizenId: citizenId || req.user.headCitizenId || 'CIT-1001',
      citizenName: citizenName || req.user.headName || 'Rahul Sharma',
      actorId,
      actorRole
    });

    // Optionally save directly into JanSetu Document Vault
    const targetFamilyId = req.user.role === 'citizen' ? req.user.familyId : (familyId || 'FAM-1001');
    const newDocId = `DOC-DL-${Date.now().toString().slice(-4)}`;

    const vaultDoc = {
      documentId: newDocId,
      title: result.documentTitle,
      documentType: result.documentTitle,
      scope: 'Individual',
      familyId: targetFamilyId,
      citizenId: citizenId || null,
      fileUrl: result.fileUrl || '/uploads/sample_verified_doc.pdf',
      originalFilename: `digilocker_${docType}_${Date.now()}.pdf`,
      fileSize: '0.85 MB',
      issuingAuthority: result.issuingAuthority,
      maskedReferenceNo: result.referenceNumber,
      verificationStatus: result.metadata.isAuthoritative 
        ? 'Authoritative Government Verified' 
        : 'Simulated Demonstration Record (Non-Authoritative)',
      officerRemarks: result.metadata.isAuthoritative 
        ? 'Pulled and verified via official DigiLocker Partner Gateway.' 
        : 'Simulated DigiLocker import via JanSetu Demo Mock Adapter.',
      verifiedBy: result.metadata.isAuthoritative ? 'DIGILOCKER_ISSUER' : 'DEMO_MOCK_ADAPTER',
      verifiedAt: new Date(),
      uploadedAt: new Date(),
      isAuthoritative: result.metadata.isAuthoritative,
      isSimulated: result.metadata.isSimulated
    };

    dataStore.createDocument(vaultDoc);

    res.json({
      success: true,
      message: result.metadata.isAuthoritative
        ? 'Document pulled and verified authoritatively via DigiLocker.'
        : 'Document pulled via JanSetu Demo Mock Adapter and registered in Document Vault.',
      document: vaultDoc,
      gatewayResponse: result
    });
  } catch (err) {
    console.error('DigiLocker pull error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/government-services/ogd/stats - Fetch Public Open Government Data
router.get('/ogd/stats', async (req, res) => {
  try {
    const { resourceId, limit } = req.query;
    const result = await govIntegration.fetchOgdStats({
      resourceId,
      limit: parseInt(limit || '5', 10),
      actorId: req.user?.userId || 'PUBLIC_ANONYMOUS',
      actorRole: req.user?.role || 'public'
    });

    res.json({
      success: true,
      stats: result
    });
  } catch (err) {
    console.error('OGD stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/government-services/myscheme/catalog - Fetch myScheme catalog
router.get('/myscheme/catalog', async (req, res) => {
  try {
    const { category, search } = req.query;
    const result = await govIntegration.fetchMySchemeCatalog({ category, search });
    res.json({
      success: true,
      catalog: result
    });
  } catch (err) {
    console.error('myScheme catalog error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
