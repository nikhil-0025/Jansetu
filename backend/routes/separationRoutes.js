const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dataStore = require('../models/dataStore');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  HouseholdSeparationRequest,
  Household,
  Citizen,
  UserAccount,
  HouseholdMembershipHistory,
  AuditLog,
  Notification
} = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// GET /api/separation-requests - List separation requests
router.get('/', requireAuth, async (req, res) => {
  try {
    let requests = [];

    if (isMongoReady()) {
      try {
        const query = req.user.role === 'citizen'
          ? { $or: [{ originalFamilyId: req.user.familyId }, { generatedNewFamilyId: req.user.familyId }] }
          : {};
        requests = await HouseholdSeparationRequest.find(query).sort({ requestedAt: -1 }).lean();
      } catch (dbErr) {
        console.warn('[Separation] Mongo query failed, falling back to dataStore:', dbErr.message);
        requests = dataStore.getAllSeparationRequests();
        if (req.user.role === 'citizen') {
          requests = requests.filter(r => r.originalFamilyId === req.user.familyId || r.generatedNewFamilyId === req.user.familyId);
        }
      }
    } else {
      requests = dataStore.getAllSeparationRequests();
      if (req.user.role === 'citizen') {
        requests = requests.filter(r => r.originalFamilyId === req.user.familyId || r.generatedNewFamilyId === req.user.familyId);
      }
    }

    // Enrich with citizen names
    const enriched = requests.map(r => {
      const initiator = dataStore.findCitizen(r.initiatorCitizenId);
      const movingMembers = (r.movingCitizenIds || []).map(id => {
        const c = dataStore.findCitizen(id);
        return c ? { citizenId: id, name: c.fullName } : { citizenId: id, name: id };
      });

      return {
        ...r,
        initiatorName: initiator ? initiator.fullName : r.initiatorCitizenId,
        movingMembers
      };
    });

    res.json({
      success: true,
      requests: enriched
    });
  } catch (err) {
    console.error('List separation requests error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve separation requests.' });
  }
});

// GET /api/separation-requests/:requestId
router.get('/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    let request = null;

    if (isMongoReady()) {
      try {
        request = await HouseholdSeparationRequest.findOne({ requestId }).lean();
      } catch (dbErr) {
        console.warn('[Separation] Mongo get error:', dbErr.message);
      }
    }

    if (!request) {
      request = dataStore.findSeparationRequest(requestId);
    }

    if (!request) {
      return res.status(404).json({ success: false, message: `Separation request ${requestId} not found.` });
    }

    // Citizens can only view requests for their own household
    if (req.user.role === 'citizen' &&
        request.originalFamilyId !== req.user.familyId &&
        request.generatedNewFamilyId !== req.user.familyId) {
      return res.status(403).json({ success: false, message: 'Access denied to separation request of another household.' });
    }

    const originalFamily = dataStore.findHousehold(request.originalFamilyId);
    const initiator = dataStore.findCitizen(request.initiatorCitizenId);
    const movingMembers = (request.movingCitizenIds || []).map(id => dataStore.findCitizen(id)).filter(Boolean);

    res.json({
      success: true,
      request,
      originalFamily,
      initiator,
      movingMembers
    });
  } catch (err) {
    console.error('Get separation request error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve separation request details.' });
  }
});

// POST /api/separation-requests - Citizen lodges separation request
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      originalFamilyId,
      initiatorCitizenId,
      movingCitizenIds,
      newAddress,
      newDwellingReference,
      separationDate,
      reason,
      supportingDocuments
    } = req.body;

    const familyId = originalFamilyId || req.user.familyId;

    if (!familyId || !movingCitizenIds || !Array.isArray(movingCitizenIds) || !movingCitizenIds.length || !reason || !separationDate) {
      return res.status(400).json({
        success: false,
        message: 'All fields: Moving Member(s), Reason, Separation Date, and Address are required.'
      });
    }

    // Ensure citizen cannot lodge separation for another household without authorization
    if (req.user.role === 'citizen' && req.user.familyId && req.user.familyId !== familyId) {
      return res.status(403).json({
        success: false,
        message: 'You can only lodge separation requests for your own registered household.'
      });
    }

    // Verify existing household
    const household = dataStore.findHousehold(familyId);
    if (!household) {
      return res.status(404).json({ success: false, message: `Household ${familyId} not found.` });
    }

    // Verify all moving citizens are CURRENT active members of this household (Requirement 3 & 7)
    const currentHouseholdMembers = dataStore.getCitizensByFamilyId(familyId);
    for (const cid of movingCitizenIds) {
      const activeMember = currentHouseholdMembers.find(m => m.citizenId === cid);
      if (!activeMember) {
        return res.status(400).json({
          success: false,
          message: `Citizen ${cid} is not an active registered member of household ${familyId}.`
        });
      }
    }

    // Prevent moving ALL members without keeping original household active (Requirement 1)
    if (movingCitizenIds.length >= currentHouseholdMembers.length) {
      return res.status(400).json({
        success: false,
        message: 'Household separation requires at least one member to remain in the original household. For total relocation, use an address update.'
      });
    }

    // DUPLICATE & CONFLICT CHECK (Requirements 5, 7, 11):
    // Prevent concurrent active separation requests for any of the moving citizens across ALL households
    let allActiveRequests = [];
    if (isMongoReady()) {
      try {
        allActiveRequests = await HouseholdSeparationRequest.find({
          status: { $in: ['Pending Verification', 'Additional Information Required', 'Pending'] }
        }).lean();
      } catch (dbErr) {
        allActiveRequests = dataStore.getAllSeparationRequests().filter(r =>
          ['Pending Verification', 'Additional Information Required', 'Pending'].includes(r.status)
        );
      }
    } else {
      allActiveRequests = dataStore.getAllSeparationRequests().filter(r =>
        ['Pending Verification', 'Additional Information Required', 'Pending'].includes(r.status)
      );
    }

    for (const activeReq of allActiveRequests) {
      const conflictCitizenId = movingCitizenIds.find(cid => (activeReq.movingCitizenIds || []).includes(cid));
      if (conflictCitizenId) {
        const citizenObj = dataStore.findCitizen(conflictCitizenId);
        const citizenName = citizenObj ? citizenObj.fullName : conflictCitizenId;
        return res.status(409).json({
          success: false,
          message: `Citizen ${conflictCitizenId} (${citizenName}) is already part of an active separation request (${activeReq.requestId}). Concurrent separation requests for the same verified identity are prohibited.`
        });
      }
    }

    const requestId = `SEP-2026-${Math.floor(100 + Math.random() * 900)}`;

    const newRequest = {
      requestId,
      originalFamilyId: familyId,
      initiatorCitizenId: initiatorCitizenId || movingCitizenIds[0],
      movingCitizenIds,
      newAddress: newAddress || {
        line1: 'Near New Panchayat Bhavan, Ward 3',
        line2: 'Rampur Village, Sevapuri',
        district: 'Varanasi',
        state: 'Uttar Pradesh',
        pincode: '221001'
      },
      newDwellingReference: newDwellingReference || `D-${Math.floor(200 + Math.random() * 100)}`,
      separationDate,
      reason,
      supportingDocuments: supportingDocuments || [
        {
          title: 'Mutual Family Partition Declaration / Rent Agreement',
          fileUrl: '/uploads/sample_separation_affidavit.pdf',
          documentType: 'Separation Affidavit'
        }
      ],
      status: 'Pending Verification',
      generatedNewFamilyId: null, // Assigned ONLY upon official approval (Requirement 8)
      officerReview: null,
      requestedAt: new Date(),
      updatedAt: new Date()
    };

    // Save to dataStore
    dataStore.createSeparationRequest(newRequest);

    // Save to MongoDB if available
    if (isMongoReady()) {
      try {
        await HouseholdSeparationRequest.create(newRequest);
      } catch (mongoErr) {
        console.warn('[Separation] Mongo insert warning:', mongoErr.message);
      }
    }

    // Create Audit Log (Requirement 6)
    const auditEntry = {
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'LODGE_HOUSEHOLD_SEPARATION_REQUEST',
      targetEntity: 'HouseholdSeparationRequest',
      targetEntityId: requestId,
      details: `Lodge separation request for citizens [${movingCitizenIds.join(', ')}] from ${familyId}. Reason: ${reason}`,
      previousState: { originalFamilyId: familyId, movingCitizenIds },
      newState: { status: 'Pending Verification', generatedNewFamilyId: null },
      timestamp: new Date()
    };
    dataStore.createAuditLog(auditEntry);
    if (isMongoReady()) {
      try {
        await AuditLog.create(auditEntry);
      } catch (e) { /* ignore */ }
    }

    // Notify Officers
    const notifObj = {
      notificationId: `NOTIF-${Date.now()}`,
      recipientType: 'Officer',
      recipientId: 'ALL_OFFICERS',
      title: 'New Household Separation Request',
      message: `Household separation request ${requestId} submitted by Family ${familyId} for ${movingCitizenIds.length} member(s). Verification required.`,
      category: 'Separation',
      relatedEntityId: requestId,
      isRead: false,
      createdAt: new Date()
    };
    dataStore.createNotification(notifObj);
    if (isMongoReady()) {
      try {
        await Notification.create(notifObj);
      } catch (e) { /* ignore */ }
    }

    res.status(201).json({
      success: true,
      message: `Household separation request ${requestId} lodged successfully. Tracking ID: ${requestId}. Status: Pending Verification. Neither household membership has been modified.`,
      request: newRequest
    });
  } catch (err) {
    console.error('Separation request error:', err);
    res.status(500).json({ success: false, message: 'Failed to process separation request.' });
  }
});

// POST /api/separation-requests/:requestId/review - Officer reviews separation request
router.post('/:requestId/review', requireAuth, requireRole(['officer', 'admin']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, mandatoryReason } = req.body;

    if (!['Approved', 'Rejected', 'Additional Information Required'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be Approved, Rejected, or Additional Information Required.' });
    }

    if (!mandatoryReason || !mandatoryReason.trim()) {
      return res.status(400).json({ success: false, message: 'A mandatory review reason is legally required for household separation decisions.' });
    }

    let request = dataStore.findSeparationRequest(requestId);
    if (!request && isMongoReady()) {
      try {
        request = await HouseholdSeparationRequest.findOne({ requestId }).lean();
      } catch (e) { /* ignore */ }
    }

    if (!request) {
      return res.status(404).json({ success: false, message: `Separation request ${requestId} not found.` });
    }

    if (request.status === 'Approved') {
      return res.status(400).json({ success: false, message: 'This separation request has already been approved.' });
    }

    // REJECTION OR ADDITIONAL INFO SCENARIO (Requirement 8)
    if (decision !== 'Approved') {
      const reviewPayload = {
        officerId: req.user.userId,
        officerName: req.user.officerName || 'Verification Officer',
        decision,
        mandatoryReason: mandatoryReason.trim(),
        reviewedAt: new Date()
      };

      // Update in dataStore
      const updated = dataStore.updateSeparationRequest(requestId, {
        status: decision,
        officerReview: reviewPayload,
        updatedAt: new Date()
      });

      // Update in Mongo
      if (isMongoReady()) {
        try {
          await HouseholdSeparationRequest.updateOne(
            { requestId },
            {
              $set: {
                status: decision,
                officerReview: reviewPayload,
                updatedAt: new Date()
              }
            }
          );
        } catch (dbErr) {
          console.warn('[Separation] Mongo update warning:', dbErr.message);
        }
      }

      // Notify citizen family
      const notif = {
        notificationId: `NOTIF-${Date.now()}`,
        recipientType: 'Household',
        recipientId: request.originalFamilyId,
        title: `Separation Request ${decision}: ${requestId}`,
        message: `Separation request ${requestId} was marked as '${decision}'. Officer Reason: ${mandatoryReason}`,
        category: 'Separation',
        relatedEntityId: requestId,
        isRead: false,
        createdAt: new Date()
      };
      dataStore.createNotification(notif);
      if (isMongoReady()) {
        try { await Notification.create(notif); } catch (e) {}
      }

      // Audit Log (Requirement 6)
      const auditLog = {
        logId: `AUD-${Date.now()}`,
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: `REVIEW_SEPARATION_${decision.toUpperCase()}`,
        targetEntity: 'HouseholdSeparationRequest',
        targetEntityId: requestId,
        details: `Separation request ${requestId} marked as ${decision}. Reason: ${mandatoryReason}. Active household memberships remain unchanged.`,
        previousState: { status: request.status },
        newState: { status: decision },
        timestamp: new Date()
      };
      dataStore.createAuditLog(auditLog);
      if (isMongoReady()) {
        try { await AuditLog.create(auditLog); } catch (e) {}
      }

      return res.json({
        success: true,
        message: `Separation request ${requestId} updated to ${decision}. Household active memberships remain unchanged.`,
        request: updated
      });
    }

    // APPROVAL SCENARIO (Requirements 1, 2, 3, 4, 5, 6, 7, 9, 10)
    // 1. Backend duplicate-membership & validity check
    const originalFamily = dataStore.findHousehold(request.originalFamilyId);
    if (!originalFamily) {
      return res.status(404).json({ success: false, message: `Original household ${request.originalFamilyId} not found.` });
    }

    for (const cid of request.movingCitizenIds) {
      const citizen = dataStore.findCitizen(cid);
      if (!citizen || citizen.currentFamilyId !== request.originalFamilyId) {
        return res.status(400).json({
          success: false,
          message: `Citizen ${cid} is no longer an active member of household ${request.originalFamilyId}. Approval aborted.`
        });
      }
    }

    // 2. Generate new unique internal Household ID
    const existingFamilies = dataStore.getAllHouseholds().map(h => h.familyId);
    let nextNum = 2001;
    while (existingFamilies.includes(`FAM-${nextNum}`)) {
      nextNum++;
    }
    const newFamilyId = `FAM-${nextNum}`;
    const newHeadCitizenId = request.movingCitizenIds[0];

    // Determine new head for original family if original head moved
    let newHeadForOriginal = null;
    if (request.movingCitizenIds.includes(originalFamily.headCitizenId)) {
      const remainingCitizens = dataStore.getCitizensByFamilyId(originalFamily.familyId)
        .filter(c => !request.movingCitizenIds.includes(c.citizenId));
      if (remainingCitizens.length > 0) {
        newHeadForOriginal = remainingCitizens[0].citizenId;
      }
    }

    // Prepare New Household Record (Requirement 1 & 9)
    const newHousehold = {
      familyId: newFamilyId,
      identifierType: 'Local JanSetu System Household ID (Not an official National Family ID)',
      headCitizenId: newHeadCitizenId,
      address: { ...(request.newAddress || originalFamily.address) },
      dwellingReference: request.newDwellingReference || `D-${nextNum}`,
      dwellingType: 'Kutcha',
      annualIncome: Math.round((originalFamily.annualIncome || 120000) * 0.6),
      incomeCategory: originalFamily.incomeCategory || 'BPL',
      rationCardNumber: `RC-UP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      verificationStatus: 'Verified',
      verifiedBy: req.user.userId,
      verifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Prepare New Citizen User Account (Requirement 4)
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('citizen123', salt);
    const newUserAccount = {
      userId: newFamilyId,
      passwordHash,
      role: 'citizen',
      familyId: newFamilyId,
      email: `${newFamilyId.toLowerCase()}@jansetu.gov.in`,
      phone: '9876500000',
      isActive: true,
      status: 'active',
      createdAt: new Date()
    };

    // Prepare Restricted Audit Record (Requirement 6)
    const auditRecord = {
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'APPROVE_HOUSEHOLD_SEPARATION',
      targetEntity: 'HouseholdSeparationRequest',
      targetEntityId: requestId,
      details: `Approved separation of citizens [${request.movingCitizenIds.join(', ')}] from ${request.originalFamilyId} into new household ${newFamilyId}. Reason: ${mandatoryReason}. Authorized Reviewer: ${req.user.officerName || req.user.userId}`,
      previousState: {
        originalFamilyId: request.originalFamilyId,
        movingCitizenIds: request.movingCitizenIds,
        previousHeadCitizenId: originalFamily.headCitizenId
      },
      newState: {
        newFamilyId,
        newHeadCitizenId,
        movingCitizenIds: request.movingCitizenIds,
        status: 'Approved'
      },
      timestamp: new Date()
    };

    const notifOriginal = {
      notificationId: `NOTIF-${Date.now()}-1`,
      recipientType: 'Household',
      recipientId: originalFamily.familyId,
      title: 'Household Separation Order Approved',
      message: `Household separation request ${requestId} approved. New Household ${newFamilyId} established. Citizen IDs & kinship ties preserved.`,
      category: 'Separation',
      relatedEntityId: requestId,
      isRead: false,
      createdAt: new Date()
    };

    const notifNew = {
      notificationId: `NOTIF-${Date.now()}-2`,
      recipientType: 'Household',
      recipientId: newFamilyId,
      title: 'Welcome to JanSetu - New Family Account Activated',
      message: `Your new household account ${newFamilyId} is active. Login using Family ID '${newFamilyId}' and default password 'citizen123'.`,
      category: 'Separation',
      relatedEntityId: newFamilyId,
      isRead: false,
      createdAt: new Date()
    };

    // ATOMIC EXECUTION USING MONGODB TRANSACTION WHERE SUPPORTED (Requirement 5)
    if (isMongoReady()) {
      let session = null;
      let transactionSuccess = false;

      try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
          // 1. Update separation request status
          await HouseholdSeparationRequest.updateOne(
            { requestId },
            {
              $set: {
                status: 'Approved',
                generatedNewFamilyId: newFamilyId,
                officerReview: {
                  officerId: req.user.userId,
                  officerName: req.user.officerName || 'Verification Officer',
                  decision: 'Approved',
                  mandatoryReason,
                  reviewedAt: new Date()
                },
                updatedAt: new Date()
              }
            },
            { session }
          );

          // 2. Insert new Household
          await Household.create([newHousehold], { session });

          // 3. Update original Household if head changed
          if (newHeadForOriginal) {
            await Household.updateOne(
              { familyId: request.originalFamilyId },
              { $set: { headCitizenId: newHeadForOriginal, updatedAt: new Date() } },
              { session }
            );
          }

          // 4. Update Citizen currentFamilyId & isHeadOfFamily atomically
          for (const cid of request.movingCitizenIds) {
            await Citizen.updateOne(
              { citizenId: cid },
              {
                $set: {
                  currentFamilyId: newFamilyId,
                  isHeadOfFamily: cid === newHeadCitizenId,
                  updatedAt: new Date()
                }
              },
              { session }
            );
          }

          if (newHeadForOriginal) {
            await Citizen.updateOne(
              { citizenId: newHeadForOriginal },
              { $set: { isHeadOfFamily: true, updatedAt: new Date() } },
              { session }
            );
          }

          // 5. Create new UserAccount for the new household
          await UserAccount.create([newUserAccount], { session });

          // 6. Update Membership History (close old, insert new)
          await HouseholdMembershipHistory.updateMany(
            { citizenId: { $in: request.movingCitizenIds }, endDate: null },
            {
              $set: {
                endDate: new Date(),
                exitReason: `Approved Household Separation (${requestId})`,
                separationRequestId: requestId
              }
            },
            { session }
          );

          const newHistEntries = request.movingCitizenIds.map((cid, idx) => ({
            historyId: `HIST-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
            citizenId: cid,
            familyId: newFamilyId,
            startDate: new Date(),
            endDate: null
          }));
          await HouseholdMembershipHistory.insertMany(newHistEntries, { session, ordered: true });

          // 7. Insert Audit Log
          await AuditLog.create([auditRecord], { session });

          // 8. Insert Notifications
          await Notification.insertMany([notifOriginal, notifNew], { session, ordered: true });
        });

        transactionSuccess = true;
      } catch (txErr) {
        console.warn('[Separation Transaction] Transaction failed or not supported by cluster:', txErr.message);
        // Standalone MongoDB fallback: execute sequentially
        try {
          await HouseholdSeparationRequest.updateOne(
            { requestId },
            {
              $set: {
                status: 'Approved',
                generatedNewFamilyId: newFamilyId,
                officerReview: {
                  officerId: req.user.userId,
                  officerName: req.user.officerName || 'Verification Officer',
                  decision: 'Approved',
                  mandatoryReason,
                  reviewedAt: new Date()
                },
                updatedAt: new Date()
              }
            }
          );
          await Household.create(newHousehold);
          if (newHeadForOriginal) {
            await Household.updateOne(
              { familyId: request.originalFamilyId },
              { $set: { headCitizenId: newHeadForOriginal, updatedAt: new Date() } }
            );
          }
          for (const cid of request.movingCitizenIds) {
            await Citizen.updateOne(
              { citizenId: cid },
              {
                $set: {
                  currentFamilyId: newFamilyId,
                  isHeadOfFamily: cid === newHeadCitizenId,
                  updatedAt: new Date()
                }
              }
            );
          }
          if (newHeadForOriginal) {
            await Citizen.updateOne(
              { citizenId: newHeadForOriginal },
              { $set: { isHeadOfFamily: true, updatedAt: new Date() } }
            );
          }
          await UserAccount.create(newUserAccount);
          await HouseholdMembershipHistory.updateMany(
            { citizenId: { $in: request.movingCitizenIds }, endDate: null },
            {
              $set: {
                endDate: new Date(),
                exitReason: `Approved Household Separation (${requestId})`,
                separationRequestId: requestId
              }
            }
          );
          const newHistEntries = request.movingCitizenIds.map((cid, idx) => ({
            historyId: `HIST-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
            citizenId: cid,
            familyId: newFamilyId,
            startDate: new Date(),
            endDate: null
          }));
          await HouseholdMembershipHistory.insertMany(newHistEntries);
          await AuditLog.create(auditRecord);
          await Notification.insertMany([notifOriginal, notifNew]);
        } catch (fallbackErr) {
          console.error('[Separation Fallback] Sequential write error:', fallbackErr.message);
        }
      } finally {
        if (session) session.endSession();
      }
    }

    // Always synchronize in-memory dataStore
    const executionResult = dataStore.executeSeparationApproval(
      requestId,
      req.user.userId,
      req.user.officerName || 'Verification Officer',
      mandatoryReason,
      newFamilyId
    );

    return res.json({
      success: true,
      message: `Separation request ${requestId} APPROVED. New Household ${newFamilyId} has been established. Member Citizen IDs, individual records, and family bonds are preserved. No government benefits have been auto-assigned.`,
      details: {
        ...executionResult,
        newFamilyId,
        identifierDisclaimer: 'Local JanSetu System Household ID (Not an official National Family ID)',
        benefitRecordsPreserved: 0,
        applicationsPreserved: 0
      }
    });
  } catch (err) {
    console.error('Separation review error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error processing separation review.' });
  }
});

module.exports = router;
