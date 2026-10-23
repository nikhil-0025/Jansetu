const express = require('express');
const router = express.Router();
const dataStore = require('../models/dataStore');
const { requireAuth } = require('../middleware/auth');
const { evaluateEligibility } = require('../services/eligibilityEngine');
const { detectDuplicateBenefit } = require('../services/duplicateDetectionService');

// GET /api/schemes
router.get('/', (req, res) => {
  const { category, benefitType, search } = req.query;
  let schemes = dataStore.getAllSchemes();

  if (category) {
    schemes = schemes.filter(s => s.category.toLowerCase() === category.toLowerCase());
  }
  if (benefitType) {
    schemes = schemes.filter(s => s.benefitType.toLowerCase() === benefitType.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    schemes = schemes.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.nameHindi && s.nameHindi.includes(q)) || 
      s.description.toLowerCase().includes(q)
    );
  }

  res.json({
    success: true,
    schemes,
    total: schemes.length
  });
});

// GET /api/schemes/:schemeId
router.get('/:schemeId', (req, res) => {
  const { schemeId } = req.params;
  const scheme = dataStore.findScheme(schemeId);

  if (!scheme) {
    return res.status(404).json({ success: false, message: `Scheme ${schemeId} not found.` });
  }

  res.json({
    success: true,
    scheme
  });
});

// POST /api/schemes/:schemeId/check-eligibility
router.post('/:schemeId/check-eligibility', requireAuth, (req, res) => {
  const { schemeId } = req.params;
  const { citizenId, familyId } = req.body;

  const targetFamilyId = familyId || (req.user.role === 'citizen' ? req.user.familyId : 'FAM-1001');
  const targetCitizenId = citizenId || (req.user.headCitizenId || 'CIT-1001');

  // 1. Run Rule-Based Eligibility Engine
  const eligibility = evaluateEligibility(schemeId, targetCitizenId, targetFamilyId);

  // 2. Run Explainable Duplicate Benefit Detection
  const duplicateCheck = detectDuplicateBenefit(schemeId, targetCitizenId, targetFamilyId);

  // Overall assessment synthesis
  let overallRecommendation = eligibility.status;
  if (duplicateCheck.isPotentialDuplicate) {
    overallRecommendation = 'Potential Duplicate — Officer Review Required';
  }

  res.json({
    success: true,
    schemeId,
    citizenId: targetCitizenId,
    familyId: targetFamilyId,
    overallRecommendation,
    eligibility,
    duplicateCheck
  });
});

module.exports = router;
