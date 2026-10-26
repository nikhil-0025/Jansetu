const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dataStore = require('../models/dataStore');
const { requireAuth, requireRole } = require('../middleware/auth');
const { evaluateEligibility } = require('../services/eligibilityEngine');
const { detectDuplicateBenefit } = require('../services/duplicateDetectionService');
const {
  Application,
  BenefitRecord,
  AuditLog,
  Notification,
  Citizen,
  Household,
  Scheme
} = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// GET /api/applications - Get applications
router.get('/', requireAuth, async (req, res) => {
  const { familyId, citizenId, status } = req.query;
  let apps = [];

  if (isMongoReady()) {
    try {
      const query = {};
      if (req.user.role === 'citizen') {
        query.familyId = req.user.familyId;
      } else {
        if (familyId) query.familyId = familyId;
        if (citizenId) query.applicantCitizenId = citizenId;
        if (status) query.status = status;
      }
      apps = await Application.find(query).sort({ submittedAt: -1 }).lean();
    } catch (dbErr) {
      console.warn('[Applications] Mongo query warning:', dbErr.message);
    }
  }

  if (apps.length === 0) {
    apps = dataStore.getAllApplications();
    if (req.user.role === 'citizen') {
      apps = apps.filter(a => a.familyId === req.user.familyId);
    } else {
      if (familyId) apps = apps.filter(a => a.familyId === familyId);
      if (citizenId) apps = apps.filter(a => a.applicantCitizenId === citizenId);
      if (status) apps = apps.filter(a => a.status === status);
    }
    apps.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  res.json({
    success: true,
    applications: apps,
    total: apps.length
  });
});

// GET /api/applications/:applicationId
router.get('/:applicationId', requireAuth, async (req, res) => {
  const { applicationId } = req.params;
  let app = null;

  if (isMongoReady()) {
    try {
      app = await Application.findOne({ applicationId }).lean();
    } catch (dbErr) {
      console.warn('[Applications] Mongo fetch warning:', dbErr.message);
    }
  }

  if (!app) {
    app = dataStore.findApplication(applicationId);
  }

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
router.post('/', requireAuth, async (req, res) => {
  try {
    const { schemeId, applicantCitizenId } = req.body;

    if (!schemeId || !applicantCitizenId) {
      return res.status(400).json({
        success: false,
        message: 'Scheme ID and Applicant Citizen ID are required.'
      });
    }

    let scheme = null;
    let citizen = null;

    if (isMongoReady()) {
      try {
        scheme = await Scheme.findOne({ schemeId }).lean();
        citizen = await Citizen.findOne({ citizenId: applicantCitizenId }).lean();
      } catch (e) {}
    }

    if (!scheme) scheme = dataStore.findScheme(schemeId);
    if (!scheme) {
      return res.status(404).json({ success: false, message: `Scheme ${schemeId} not found.` });
    }

    if (!citizen) citizen = dataStore.findCitizen(applicantCitizenId);
    if (!citizen) {
      return res.status(404).json({ success: false, message: `Citizen ${applicantCitizenId} not found.` });
    }

    // Household at time of application
    const familyId = citizen.currentFamilyId;
    let household = null;
    if (isMongoReady()) {
      try {
        household = await Household.findOne({ familyId }).lean();
      } catch (e) {}
    }
    if (!household) household = dataStore.findHousehold(familyId);

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
    const auditData = {
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'SUBMIT_APPLICATION',
      targetEntity: 'Application',
      targetEntityId: appId,
      details: `Submitted application for ${scheme.name}. Duplicate flag: ${duplicateCheckResult.isPotentialDuplicate}.`,
      timestamp: new Date()
    };
    dataStore.createAuditLog(auditData);

    // Create Notification
    const notifData = {
      notificationId: `NOTIF-${Date.now()}-1`,
      recipientType: 'Household',
      recipientId: familyId,
      title: `Application Submitted: ${scheme.name}`,
      message: `Your application ${appId} for '${scheme.name}' has been successfully lodged. Current status: Submitted.`,
      category: 'Scheme',
      relatedEntityId: appId,
      isRead: false,
      createdAt: new Date()
    };
    dataStore.createNotification(notifData);

    let dupNotifData = null;
    if (duplicateCheckResult.isPotentialDuplicate) {
      dupNotifData = {
        notificationId: `NOTIF-${Date.now()}-2`,
        recipientType: 'Officer',
        recipientId: 'ALL_OFFICERS',
        title: 'POTENTIAL DUPLICATE CLAIM ALERT',
        message: `Application ${appId} from Family ${familyId} flagged for potential duplicate claim (${duplicateCheckResult.flagType}). Officer review required.`,
        category: 'Scheme',
        relatedEntityId: appId,
        isRead: false,
        createdAt: new Date()
      };
      dataStore.createNotification(dupNotifData);
    }

    if (isMongoReady()) {
      try {
        await Application.create(newApp);
        await AuditLog.create(auditData);
        await Notification.create(notifData);
        if (dupNotifData) await Notification.create(dupNotifData);
      } catch (dbErr) {
        console.warn('[Applications] Mongo persistence warning:', dbErr.message);
      }
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
router.post('/:applicationId/review', requireAuth, requireRole(['officer', 'admin']), async (req, res) => {
  const { applicationId } = req.params;
  const { decision, remarks } = req.body;

  if (!['Approved', 'Rejected', 'Additional Information Required'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'Decision must be Approved, Rejected, or Additional Information Required.' });
  }

  if (!remarks) {
    return res.status(400).json({ success: false, message: 'Mandatory officer review remarks are required.' });
  }

  let app = null;
  if (isMongoReady()) {
    try {
      app = await Application.findOne({ applicationId }).lean();
    } catch (e) {}
  }
  if (!app) {
    app = dataStore.findApplication(applicationId);
  }

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

  const updateFields = {
    status: decision,
    officerReview: {
      officerId: req.user.userId,
      officerName: req.user.officerName || 'Verification Officer',
      decision,
      remarks,
      reviewedAt: new Date()
    },
    statusHistory: updatedStatusHistory,
    updatedAt: new Date()
  };

  const updated = dataStore.updateApplication(applicationId, updateFields);

  // If approved, create BenefitRecord
  let newBenefit = null;
  if (decision === 'Approved') {
    let scheme = null;
    if (isMongoReady()) {
      try {
        scheme = await Scheme.findOne({ schemeId: app.schemeId }).lean();
      } catch (e) {}
    }
    if (!scheme) scheme = dataStore.findScheme(app.schemeId);

    newBenefit = {
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
    };
    dataStore.createBenefitRecord(newBenefit);
  }

  // Notify Citizen Family
  const reviewNotif = {
    notificationId: `NOTIF-${Date.now()}`,
    recipientType: 'Household',
    recipientId: app.familyId,
    title: `Application ${decision}: ${app.schemeName}`,
    message: `Application ${app.applicationId} was ${decision} by Officer ${req.user.officerName || req.user.userId}. Remarks: ${remarks}`,
    category: 'Scheme',
    relatedEntityId: applicationId,
    isRead: false,
    createdAt: new Date()
  };
  dataStore.createNotification(reviewNotif);

  // Create Audit Log
  const reviewAudit = {
    logId: `AUD-${Date.now()}`,
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: `REVIEW_APPLICATION_${decision.toUpperCase()}`,
    targetEntity: 'Application',
    targetEntityId: applicationId,
    details: `Officer reviewed application ${applicationId}: Decision ${decision}. Remarks: ${remarks}`,
    timestamp: new Date()
  };
  dataStore.createAuditLog(reviewAudit);

  if (isMongoReady()) {
    try {
      await Application.updateOne({ applicationId }, { $set: updateFields });
      if (newBenefit) await BenefitRecord.create(newBenefit);
      await Notification.create(reviewNotif);
      await AuditLog.create(reviewAudit);
    } catch (dbErr) {
      console.warn('[Applications] Mongo review persistence warning:', dbErr.message);
    }
  }

  res.json({
    success: true,
    message: `Application ${applicationId} has been ${decision}.`,
    application: updated || { ...app, ...updateFields }
  });
});

module.exports = router;
