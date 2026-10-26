const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dataStore = require('../models/dataStore');
const { requireAuth } = require('../middleware/auth');
const { evaluateEligibility } = require('../services/eligibilityEngine');
const { detectDuplicateBenefit } = require('../services/duplicateDetectionService');
const { Scheme } = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// GET /api/schemes
router.get('/', async (req, res) => {
  const { category, benefitType, search } = req.query;
  let schemes = [];

  if (isMongoReady()) {
    try {
      const filter = { isActive: { $ne: false } };
      if (category) filter.category = new RegExp(`^${category}$`, 'i');
      if (benefitType) filter.benefitType = new RegExp(`^${benefitType}$`, 'i');
      if (search) {
        const q = search.trim();
        filter.$or = [
          { name: new RegExp(q, 'i') },
          { nameHindi: new RegExp(q, 'i') },
          { description: new RegExp(q, 'i') }
        ];
      }
      schemes = await Scheme.find(filter).lean();
    } catch (dbErr) {
      console.warn('[Schemes] Mongo query warning:', dbErr.message);
    }
  }

  if (schemes.length === 0) {
    schemes = dataStore.getAllSchemes();
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
  }

  res.json({
    success: true,
    schemes,
    total: schemes.length
  });
});

// GET /api/schemes/:schemeId
router.get('/:schemeId', async (req, res) => {
  const { schemeId } = req.params;
  let scheme = null;

  if (isMongoReady()) {
    try {
      scheme = await Scheme.findOne({ schemeId }).lean();
    } catch (dbErr) {
      console.warn('[Schemes] Mongo fetch warning:', dbErr.message);
    }
  }

  if (!scheme) {
    scheme = dataStore.findScheme(schemeId);
  }

  if (!scheme) {
    return res.status(404).json({ success: false, message: `Scheme ${schemeId} not found.` });
  }

  res.json({
    success: true,
    scheme
  });
});

// POST /api/schemes/:schemeId/check-eligibility
router.post('/:schemeId/check-eligibility', requireAuth, async (req, res) => {
  const { schemeId } = req.params;
  const { citizenId, familyId, customAnswers } = req.body;

  const targetFamilyId = familyId || (req.user.role === 'citizen' ? req.user.familyId : 'FAM-1001');
  const targetCitizenId = citizenId || (req.user.headCitizenId || 'CIT-1001');

  // 1. Run Rule-Based Eligibility Engine
  const eligibility = await evaluateEligibility(schemeId, targetCitizenId, targetFamilyId, customAnswers);

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

// POST /api/schemes/finder - Interactive Eligibility Finder (Accessible to all citizens, no PII stored)
router.post('/finder/evaluate', async (req, res) => {
  try {
    const { annualIncome, age, gender, occupation, isFarmer, landholdingHectares, dwellingType, hasLpgConnection, category } = req.body;
    const customAnswers = {
      annualIncome: annualIncome !== undefined ? Number(annualIncome) : undefined,
      age: age !== undefined ? Number(age) : undefined,
      gender: gender ? String(gender).trim() : undefined,
      occupation: occupation ? String(occupation).trim() : undefined,
      isFarmer: isFarmer !== undefined ? Boolean(isFarmer) : (occupation && String(occupation).toLowerCase().includes('farmer')),
      landholdingHectares: landholdingHectares ? Number(landholdingHectares) : 0,
      dwellingType: dwellingType ? String(dwellingType).trim() : undefined,
      hasLpgConnection: hasLpgConnection !== undefined ? (hasLpgConnection === true || hasLpgConnection === 'true') : undefined
    };

    let schemes = [];
    if (isMongoReady()) {
      try {
        schemes = await Scheme.find({ isActive: { $ne: false } }).lean();
      } catch (e) {}
    }
    if (schemes.length === 0) {
      schemes = dataStore.getAllSchemes();
    }

    const evaluatedSchemes = await Promise.all(schemes.map(async (s) => {
      const result = await evaluateEligibility(s.schemeId, null, null, customAnswers);
      return {
        schemeId: s.schemeId,
        schemeName: s.name,
        nameHindi: s.nameHindi,
        category: s.category,
        ministry: s.ministry,
        department: s.department,
        benefitType: s.benefitType,
        benefitAmount: s.benefitAmount,
        status: result.status,
        passedConditions: result.passedConditions || [],
        unmetConditions: result.failedConditions || [],
        unknownConditions: result.unknownConditions || [],
        missingDocuments: result.missingDocuments || [],
        explanation: result.explanation,
        officialUrl: s.officialUrl,
        sourceUrl: s.sourceUrl,
        stateCoverage: s.stateCoverage,
        applicationProcess: s.applicationProcess,
        evaluation: result
      };
    }));

    // Categorize
    const eligible = evaluatedSchemes.filter(e => e.status === 'Potentially Eligible');
    const moreInfoNeeded = evaluatedSchemes.filter(e => ['Additional Profile Data Required', 'Documents Required'].includes(e.status));
    const notEligible = evaluatedSchemes.filter(e => e.status === 'Not Currently Eligible');

    res.json({
      success: true,
      summary: {
        totalEvaluated: evaluatedSchemes.length,
        eligibleCount: eligible.length,
        moreInfoCount: moreInfoNeeded.length,
        notEligibleCount: notEligible.length
      },
      evaluations: evaluatedSchemes,
      eligible,
      moreInfoNeeded,
      notEligible,
      disclaimer: 'Preliminary advisory guidance only based on verified scheme criteria. Final eligibility is determined solely by the competent administrative authority upon scrutiny of official documents.'
    });
  } catch (err) {
    console.error('Eligibility finder error:', err);
    res.status(500).json({ success: false, message: 'Failed to evaluate eligibility.' });
  }
});

module.exports = router;
