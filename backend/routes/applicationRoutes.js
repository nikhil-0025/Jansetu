const express = require('express');
const router = express.Router();
const dataStore = require('../models/dataStore');
const { requireAuth, requireRole } = require('../middleware/auth');
const { evaluateEligibility } = require('../services/eligibilityEngine');
const { detectDuplicateBenefit } = require('../services/duplicateDetectionService');

// GET /api/applications - Get applications
router.get('/', requireAuth, (req, res) => {
  const { familyId, citizenId, status } = req.query;

  let apps = dataStore.getAllApplications();

  // If citizen, only their household's applications
  if (req.user.role === 'citizen') {
    apps = apps.filter(a => a.familyId === req.user.familyId);
  } else {
    if (familyId) apps = apps.filter(a => a.familyId === familyId);
    if (citizenId) apps = apps.filter(a => a.applicantCitizenId === citizenId);
    if (status) apps = apps.filter(a => a.status === status);
  }

  // Sort descending by submission date
  apps.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  res.json({
    success: true,
    applications: apps,
    total: apps.length
  });
});

// GET /api/applications/:applicationId
router.get('/:applicationId', requireAuth, (req, res) => {
  const { applicationId } = req.params;
  const app = dataStore.findApplication(applicationId);

  if (!app) {
    return res.status(404).json({ success: false, message: `Application ${applicationId} not found.` });
  }

  if (req.user.role === 'citizen' && app.familyId !== req.user.familyId) {
    return res.status(403).json({ success: false, message: 'Access denied to this application.' });
  }

  res.json({
    success: true,
    application: app
  });
});

// POST /api/applications - Submit new scheme application (Scenario B, C, E)
router.post('/', requireAuth, (req, res) => {
  try {
    const { schemeId, applicantCitizenId } = req.body;

    if (!schemeId || !applicantCitizenId) {
      return res.status(400).json({
        success: false,
        message: 'Scheme ID and Applicant Citizen ID are required.'
      });
    }

    const scheme = dataStore.findScheme(schemeId);
    if (!scheme) {
      return res.status(404).json({ success: false, message: `Scheme ${schemeId} not found.` });
    }

    const citizen = dataStore.findCitizen(applicantCitizenId);
    if (!citizen) {
      return res.status(404).json({ success: false, message: `Citizen ${applicantCitizenId} not found.` });
    }

    // Household at time of application
    const familyId = citizen.currentFamilyId;
    const household = dataStore.findHousehold(familyId);

    // 1. Run Eligibility Evaluation
    const eligibilityAssessment = evaluateEligibility(schemeId, applicantCitizenId, familyId);

    // 2. Run Duplicate Benefit Detection
    const duplicateCheckResult = detectDuplicateBenefit(schemeId, applicantCitizenId, familyId);

    // Generate unique ID
    const appId = `APP-2026-${Math.floor(100 + Math.random() * 900)}`;

    const newApp = {
      applicationId: appId,
      schemeId,
      schemeName: scheme.name,
      benefitType: scheme.benefitType,
      applicantCitizenId,
      applicantName: citizen.fullName,
      familyId,
      dwellingReference: household ? household.dwellingReference : null,
      status: 'Submitted',
      eligibilityAssessment,
      duplicateCheckResult,
      officerReview: null,
      statusHistory: [
        {
          status: 'Submitted',
          timestamp: new Date(),
          remarks: `Application filed by ${citizen.fullName} for ${scheme.name}. Assessment status: ${eligibilityAssessment.status}.`,
          actor: citizen.fullName
        }
      ],
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    dataStore.createApplication(newApp);

    // Create Audit Log
    dataStore.createAuditLog({
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'SUBMIT_APPLICATION',
      targetEntity: 'Application',
      targetEntityId: appId,
      details: `Submitted application for ${scheme.name}. Duplicate flag: ${duplicateCheckResult.isPotentialDuplicate}.`,
      timestamp: new Date()
    });

    // Create Notification
    dataStore.createNotification({
      notificationId: `NOTIF-${Date.now()}-1`,
      recipientType: 'Household',
      recipientId: familyId,
      title: `Application Submitted: ${scheme.name}`,
      message: `Your application ${appId} for '${scheme.name}' has been successfully lodged. Current status: Submitted.`,
      category: 'Scheme',
      relatedEntityId: appId,
      isRead: false,
      createdAt: new Date()
    });

    if (duplicateCheckResult.isPotentialDuplicate) {
      dataStore.createNotification({
        notificationId: `NOTIF-${Date.now()}-2`,
        recipientType: 'Officer',
        recipientId: 'ALL_OFFICERS',
        title: 'POTENTIAL DUPLICATE CLAIM ALERT',
        message: `Application ${appId} from Family ${familyId} flagged for potential duplicate claim (${duplicateCheckResult.flagType}). Officer review required.`,
        category: 'Scheme',
        relatedEntityId: appId,
        isRead: false,
        createdAt: new Date()
      });
    }

    res.json({
      success: true,
      message: `Application ${appId} lodged successfully.`,
      application: newApp
    });
  } catch (err) {
    console.error('Submit application error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit application.' });
  }
});

// POST /api/applications/:applicationId/review - Officer reviews application (Scenario E)
router.post('/:applicationId/review', requireAuth, requireRole(['officer', 'admin']), (req, res) => {
  const { applicationId } = req.params;
  const { decision, remarks } = req.body;

  if (!['Approved', 'Rejected', 'Additional Information Required'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'Decision must be Approved, Rejected, or Additional Information Required.' });
  }

  if (!remarks) {
    return res.status(400).json({ success: false, message: 'Mandatory officer review remarks are required.' });
  }

  const app = dataStore.findApplication(applicationId);
  if (!app) {
    return res.status(404).json({ success: false, message: `Application ${applicationId} not found.` });
  }

  // Update application
  const updatedStatusHistory = [
    ...app.statusHistory,
    {
      status: decision,
      timestamp: new Date(),
      remarks,
      actor: req.user.officerName || req.user.userId
    }
  ];

  const updated = dataStore.updateApplication(applicationId, {
    status: decision,
    officerReview: {
      officerId: req.user.userId,
      officerName: req.user.officerName || 'Verification Officer',
      decision,
      remarks,
      reviewedAt: new Date()
    },
    statusHistory: updatedStatusHistory
  });

  // If approved, create BenefitRecord
  if (decision === 'Approved') {
    const scheme = dataStore.findScheme(app.schemeId);
    dataStore.createBenefitRecord({
      benefitRecordId: `BEN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      schemeId: app.schemeId,
      schemeName: app.schemeName,
      benefitType: app.benefitType,
      familyId: app.familyId,
      citizenId: app.applicantCitizenId,
      dwellingReference: app.dwellingReference,
      disbursedAmount: scheme ? scheme.benefitAmount : 'Standard Grant',
      financialYear: '2025-26',
      disbursedDate: new Date(),
      status: 'Approved / Pending Disbursement'
    });
  }

  // Notify Citizen Family
  dataStore.createNotification({
    notificationId: `NOTIF-${Date.now()}`,
    recipientType: 'Household',
    recipientId: app.familyId,
    title: `Application ${decision}: ${app.schemeName}`,
    message: `Application ${app.applicationId} was ${decision} by Officer ${req.user.officerName || req.user.userId}. Remarks: ${remarks}`,
    category: 'Scheme',
    relatedEntityId: applicationId,
    isRead: false,
    createdAt: new Date()
  });

  // Create Audit Log
  dataStore.createAuditLog({
    logId: `AUD-${Date.now()}`,
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: `REVIEW_APPLICATION_${decision.toUpperCase()}`,
    targetEntity: 'Application',
    targetEntityId: applicationId,
    details: `Officer reviewed application ${applicationId}: Decision ${decision}. Remarks: ${remarks}`,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: `Application ${applicationId} has been ${decision}.`,
    application: updated
  });
});

module.exports = router;
