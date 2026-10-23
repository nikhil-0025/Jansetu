const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const dataStore = require('../models/dataStore');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UserAccount, Household, AuditLog, Citizen } = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// GET /api/admin/dashboard - High-level metrics for government verification dashboard
router.get('/dashboard', requireAuth, requireRole(['officer', 'admin']), async (req, res) => {
  const households = dataStore.getAllHouseholds();
  const citizens = dataStore.getAllCitizens();
  const applications = dataStore.getAllApplications();
  const separationRequests = dataStore.getAllSeparationRequests();
  const documents = dataStore.getDocuments();
  const auditLogs = dataStore.getAuditLogs();
  const corrections = dataStore.getAllProfileCorrections();

  // Metrics calculation
  const totalHouseholds = households.length;
  const totalCitizens = citizens.length;
  const pendingApplications = applications.filter(a => ['Submitted', 'Pending Verification', 'Additional Information Required'].includes(a.status)).length;
  const approvedApplications = applications.filter(a => a.status === 'Approved').length;
  const pendingSeparations = separationRequests.filter(s => s.status === 'Pending Verification').length;
  const pendingDocuments = documents.filter(d => d.verificationStatus === 'Pending Verification').length;
  const pendingCorrections = corrections.filter(c => c.status === 'Pending Verification' || c.status === 'Pending').length;

  let pendingRegistrations = 0;
  if (isMongoReady()) {
    try {
      pendingRegistrations = await UserAccount.countDocuments({ status: 'pending' });
    } catch (e) {
      pendingRegistrations = (dataStore.getAllUsers ? dataStore.getAllUsers() : []).filter(u => u.status === 'pending').length;
    }
  } else {
    pendingRegistrations = (dataStore.getAllUsers ? dataStore.getAllUsers() : []).filter(u => u.status === 'pending').length;
  }
  
  // Potential duplicate alerts
  const duplicateAlerts = applications.filter(a => a.duplicateCheckResult && a.duplicateCheckResult.isPotentialDuplicate).length;

  res.json({
    success: true,
    metrics: {
      totalHouseholds,
      totalCitizens,
      pendingApplications,
      approvedApplications,
      pendingSeparations,
      pendingDocuments,
      pendingCorrections,
      pendingRegistrations,
      duplicateAlerts
    },
    recentApplications: applications.slice(0, 5),
    recentSeparations: separationRequests.slice(0, 5),
    recentDocuments: documents.filter(d => d.verificationStatus === 'Pending Verification').slice(0, 5),
    recentAuditLogs: auditLogs.slice(0, 10)
  });
});

// GET /api/admin/pending-registrations - Queue of citizen registrations awaiting officer verification
router.get('/pending-registrations', requireAuth, requireRole(['officer', 'admin']), async (req, res) => {
  try {
    let pendingUsers = [];

    if (isMongoReady()) {
      try {
        pendingUsers = await UserAccount.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
      } catch (err) {
        console.warn('[OfficerRoutes] Mongo pending-registrations query failed, using dataStore:', err.message);
        pendingUsers = (dataStore.getAllUsers ? dataStore.getAllUsers() : []).filter(u => u.status === 'pending');
      }
    } else {
      pendingUsers = (dataStore.getAllUsers ? dataStore.getAllUsers() : []).filter(u => u.status === 'pending');
    }

    // Enrich with citizen head name and household information
    const enriched = await Promise.all(pendingUsers.map(async (u) => {
      let citName = null;
      let citDob = null;
      let hhState = null;
      let hhDistrict = null;

      if (isMongoReady()) {
        try {
          const cit = await Citizen.findOne({ currentFamilyId: u.familyId }).lean();
          if (cit) {
            citName = cit.fullName;
            citDob = cit.dob;
          }
          const hh = await Household.findOne({ familyId: u.familyId }).lean();
          if (hh && hh.address) {
            hhState = hh.address.state;
            hhDistrict = hh.address.district;
          }
        } catch (e) {}
      }

      if (!citName && u.familyId) {
        const cit = (dataStore.getCitizensByFamilyId ? dataStore.getCitizensByFamilyId(u.familyId) : [])[0];
        if (cit) {
          citName = cit.fullName;
          citDob = cit.dob;
        }
        const hh = dataStore.findHousehold(u.familyId);
        if (hh && hh.address) {
          hhState = hh.address.state;
          hhDistrict = hh.address.district;
        }
      }

      return {
        userId: u.userId,
        role: u.role,
        familyId: u.familyId,
        status: u.status,
        verificationStatus: u.verificationStatus,
        verificationSource: u.verificationSource || 'LOCAL_SYNTHETIC_DATASET',
        verificationDetails: u.verificationDetails || null,
        fullName: citName || u.userId,
        dateOfBirth: citDob,
        state: hhState,
        district: hhDistrict,
        createdAt: u.createdAt
      };
    }));

    res.json({
      success: true,
      count: enriched.length,
      registrations: enriched
    });
  } catch (err) {
    console.error('Fetch pending registrations error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pending citizen registrations.' });
  }
});

// POST /api/admin/pending-registrations/:userId/review - Officer approval or rejection
router.post('/pending-registrations/:userId/review', requireAuth, requireRole(['officer', 'admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { decision, remarks } = req.body;

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision: Must be either "approve" or "reject".'
      });
    }

    let user = null;
    if (isMongoReady()) {
      try {
        user = await UserAccount.findOne({ userId }).lean();
      } catch (e) {}
    }
    if (!user) {
      user = dataStore.findUserByUserId(userId);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: `User account '${userId}' not found.` });
    }

    if (user.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Account '${userId}' is not in pending status (Current status: '${user.status}').`
      });
    }

    const officerId = req.user.userId;
    const officerName = req.user.officerName || 'Verification Officer';
    const now = new Date();

    if (decision === 'approve') {
      const updates = {
        status: 'active',
        verificationStatus: 'verified',
        approvedBy: officerId,
        approvedAt: now
      };

      if (isMongoReady()) {
        try {
          await UserAccount.updateOne({ userId }, { $set: updates });
          if (user.familyId) {
            await Household.updateOne(
              { familyId: user.familyId },
              { $set: { verificationStatus: 'Verified', verifiedBy: officerId, verifiedAt: now } }
            );
          }
          await AuditLog.create({
            logId: `AUD-${Date.now()}`,
            actorId: officerId,
            actorRole: 'officer',
            action: 'APPROVE_CITIZEN_REGISTRATION',
            targetEntity: 'UserAccount',
            targetEntityId: userId,
            details: `Officer ${officerName} (${officerId}) approved citizen registration. Remarks: ${remarks || 'Identity & synthetic certificates verified.'}`,
            previousState: { status: 'pending' },
            newState: { status: 'active', approvedBy: officerId },
            timestamp: now
          });
        } catch (dbErr) {
          console.error('[OfficerReview] MongoDB update error:', dbErr);
        }
      }

      dataStore.updateUser(userId, updates);
      if (user.familyId) {
        dataStore.updateHousehold(user.familyId, { verificationStatus: 'Verified', verifiedBy: officerId, verifiedAt: now });
      }
      if (dataStore.getDB && dataStore.getDB().auditLogs) {
        dataStore.getDB().auditLogs.push({
          logId: `AUD-${Date.now()}`,
          actorId: officerId,
          actorRole: 'officer',
          action: 'APPROVE_CITIZEN_REGISTRATION',
          targetEntity: 'UserAccount',
          targetEntityId: userId,
          details: `Officer approved registration for ${userId}.`,
          timestamp: now
        });
      }

      return res.json({
        success: true,
        message: `Citizen account '${userId}' has been approved successfully. Citizen services are now activated.`,
        userId,
        status: 'active'
      });
    } else {
      // Rejection
      const updates = {
        status: 'rejected',
        verificationStatus: 'rejected',
        rejectionRemarks: remarks || 'Registration rejected during officer review.'
      };

      if (isMongoReady()) {
        try {
          await UserAccount.updateOne({ userId }, { $set: updates });
          if (user.familyId) {
            await Household.updateOne(
              { familyId: user.familyId },
              { $set: { verificationStatus: 'Rejected' } }
            );
          }
          await AuditLog.create({
            logId: `AUD-${Date.now()}`,
            actorId: officerId,
            actorRole: 'officer',
            action: 'REJECT_CITIZEN_REGISTRATION',
            targetEntity: 'UserAccount',
            targetEntityId: userId,
            details: `Officer rejected registration. Reason: ${remarks || 'Identity details unverified.'}`,
            previousState: { status: 'pending' },
            newState: { status: 'rejected' },
            timestamp: now
          });
        } catch (dbErr) {
          console.error('[OfficerReview] MongoDB update error:', dbErr);
        }
      }

      dataStore.updateUser(userId, updates);
      if (user.familyId) {
        dataStore.updateHousehold(user.familyId, { verificationStatus: 'Rejected' });
      }

      return res.json({
        success: true,
        message: `Citizen account '${userId}' registration has been rejected.`,
        userId,
        status: 'rejected'
      });
    }

  } catch (err) {
    console.error('Review registration error:', err);
    res.status(500).json({ success: false, message: 'Internal server error while processing registration review.' });
  }
});

// GET /api/admin/duplicate-claims - Filtered queue of potential duplicate benefits requiring officer review
router.get('/duplicate-claims', requireAuth, requireRole(['officer', 'admin']), (req, res) => {
  const applications = dataStore.getAllApplications();
  const duplicates = applications.filter(a => a.duplicateCheckResult && a.duplicateCheckResult.isPotentialDuplicate);

  res.json({
    success: true,
    total: duplicates.length,
    duplicateClaims: duplicates
  });
});

// GET /api/admin/audit-logs - Full immutable system audit logs
router.get('/audit-logs', requireAuth, requireRole(['officer', 'admin']), (req, res) => {
  const logs = dataStore.getAuditLogs();
  res.json({
    success: true,
    total: logs.length,
    auditLogs: logs
  });
});

module.exports = router;
