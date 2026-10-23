const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dataStore = require('../models/dataStore');
const { requireAuth, requireHouseholdAccess } = require('../middleware/auth');
const { 
  Household, 
  Citizen, 
  FamilyRelationship, 
  HouseholdMembershipHistory, 
  AuditLog, 
  Notification 
} = require('../models/schemaDefinitions');
const { verifyCertificate } = require('../services/identityVerificationService');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// Helper: Calculate age from DOB string (YYYY-MM-DD)
function calculateAge(dobString) {
  if (!dobString) return null;
  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

// GET /api/households/:familyId
router.get('/:familyId', requireAuth, requireHouseholdAccess, (req, res) => {
  const { familyId } = req.params;
  const household = dataStore.findHousehold(familyId);

  if (!household) {
    return res.status(404).json({ success: false, message: `Household ${familyId} not found.` });
  }

  const members = dataStore.getCitizensByFamilyId(familyId);
  const headCitizen = members.find(m => m.citizenId === household.headCitizenId) || members[0];

  res.json({
    success: true,
    household: {
      ...household,
      headName: headCitizen ? headCitizen.fullName : 'Not specified',
      memberCount: members.length,
      identifierDisclaimer: 'Local JanSetu System Household ID (Not an official National/Government Family ID)'
    }
  });
});

// GET /api/households/:familyId/members
router.get('/:familyId/members', requireAuth, requireHouseholdAccess, (req, res) => {
  const { familyId } = req.params;
  const members = dataStore.getCitizensByFamilyId(familyId);
  const memberCitizenIds = members.map(m => m.citizenId);

  // Retrieve relationships among members
  const relationships = dataStore.getRelationshipsForCitizens(memberCitizenIds);

  res.json({
    success: true,
    familyId,
    identifierDisclaimer: 'Local JanSetu System Household ID (Not an official National/Government Family ID)',
    members,
    relationships,
    count: members.length
  });
});

// GET /api/households/:familyId/members/:citizenId
router.get('/:familyId/members/:citizenId', requireAuth, requireHouseholdAccess, (req, res) => {
  const { familyId, citizenId } = req.params;
  const citizen = dataStore.findCitizen(citizenId);

  if (!citizen || (citizen.currentFamilyId !== familyId && citizen.status !== 'inactive')) {
    return res.status(404).json({ success: false, message: `Member ${citizenId} not found in household ${familyId}.` });
  }

  const household = dataStore.findHousehold(familyId);
  const relationships = dataStore.getRelationshipsForCitizens([citizenId]);
  const history = dataStore.getMembershipHistory(null, citizenId);
  const auditLogs = dataStore.getAuditLogs().filter(l => l.targetEntityId === citizenId);

  res.json({
    success: true,
    member: {
      ...citizen,
      identifierDisclaimer: 'Internal Citizen ID (JanSetu local identifier)'
    },
    household,
    relationships,
    membershipHistory: history,
    auditTrail: auditLogs
  });
});

// POST /api/households/:familyId/members - Add new family member
router.post('/:familyId/members', requireAuth, requireHouseholdAccess, async (req, res) => {
  try {
    const { familyId } = req.params;
    const household = dataStore.findHousehold(familyId);

    if (!household) {
      return res.status(404).json({ success: false, message: `Household ${familyId} not found.` });
    }

    const {
      fullName,
      dob,
      gender,
      relationship,
      occupation,
      education,
      isFarmer,
      landholdingHectares,
      hasDisability,
      category,
      certificateType,
      certificateId
    } = req.body;

    // 1. Validate required fields
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Please provide a valid full name (minimum 2 characters).' });
    }

    if (!dob || isNaN(new Date(dob).getTime())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid date of birth (YYYY-MM-DD).' });
    }

    const validGenders = ['Male', 'Female', 'Other'];
    if (!gender || !validGenders.includes(gender)) {
      return res.status(400).json({ success: false, message: 'Please select a valid gender (Male, Female, Other).' });
    }

    const validRelationships = [
      'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 
      'Brother', 'Sister', 'Other Relative', 'Other'
    ];
    if (!relationship || !validRelationships.includes(relationship)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please select a valid relationship (Spouse, Son, Daughter, Father, Mother, Brother, Sister, Other Relative).' 
      });
    }

    const cleanName = fullName.trim();
    const cleanDob = dob.trim();
    const cleanCertType = certificateType ? String(certificateType).trim() : null;
    const cleanCertId = certificateId ? String(certificateId).trim() : null;

    // 2. Duplicate Detection across all households (Backend validation)
    // CRITICAL PRIVACY REQUIREMENT: Never expose another household's private information!
    const allCitizens = dataStore.getAllCitizens();
    const normalizedTargetName = cleanName.toLowerCase();

    // Check by Name + DOB
    const matchByNameAndDob = allCitizens.find(c => 
      c.status !== 'inactive' &&
      c.fullName.trim().toLowerCase() === normalizedTargetName &&
      c.dob === cleanDob
    );

    if (matchByNameAndDob) {
      if (matchByNameAndDob.currentFamilyId === familyId) {
        return res.status(409).json({
          success: false,
          message: 'This family member is already registered in your household.'
        });
      } else {
        return res.status(409).json({
          success: false,
          message: 'A citizen matching these identity details is already associated with an active household record.'
        });
      }
    }

    // Check by verification certificate reference if provided
    if (cleanCertId) {
      const matchByCert = allCitizens.find(c => 
        c.status !== 'inactive' &&
        c.verificationDetails &&
        c.verificationDetails.certificateId &&
        c.verificationDetails.certificateId.trim().toLowerCase() === cleanCertId.toLowerCase()
      );

      if (matchByCert) {
        if (matchByCert.currentFamilyId === familyId) {
          return res.status(409).json({
            success: false,
            message: 'A member with this verification reference is already registered in your household.'
          });
        } else {
          return res.status(409).json({
            success: false,
            message: 'A citizen matching this verification reference is already associated with an active household record.'
          });
        }
      }
    }

    // Check in MongoDB Atlas if connected
    if (isMongoReady()) {
      try {
        const mongoMatch = await Citizen.findOne({
          status: { $ne: 'inactive' },
          fullName: { $regex: new RegExp(`^${cleanName}$`, 'i') },
          dob: cleanDob
        });

        if (mongoMatch) {
          if (mongoMatch.currentFamilyId === familyId) {
            return res.status(409).json({
              success: false,
              message: 'This family member is already registered in your household.'
            });
          } else {
            return res.status(409).json({
              success: false,
              message: 'A citizen matching these identity details is already associated with an active household record.'
            });
          }
        }
      } catch (dbErr) {
        console.warn('[Household] MongoDB duplicate check warning:', dbErr.message);
      }
    }

    // 3. Simulated Verification against synthetic dataset if configured (Requirements 7 & 10)
    let verificationStatus = 'Pending Verification'; // ALWAYS defaults to pending review!
    let verificationSource = 'Self-Declared Household Registration';
    let isSimulated = true;
    let syntheticMatch = false;
    let verificationDetails = {
      certificateType: cleanCertType,
      certificateId: cleanCertId,
      requiresManualReview: true,
      isSimulated: true,
      note: 'Added by household owner. Awaiting official officer document review and verification.'
    };

    if (cleanCertType && cleanCertId) {
      const mode = process.env.IDENTITY_VERIFICATION_MODE || 'synthetic';
      if (mode === 'synthetic' && isMongoReady()) {
        try {
          const verifyResult = await verifyCertificate({
            certificateType: cleanCertType,
            certificateId: cleanCertId,
            fullName: cleanName,
            dateOfBirth: cleanDob,
            familyReferenceId: familyId
          });

          if (verifyResult && verifyResult.success && verifyResult.match) {
            // MATCHED synthetic record!
            // CRITICAL REQUIREMENT 7:
            // "A family member must not be marked officially verified just because the submitted details match synthetic records."
            syntheticMatch = true;
            verificationSource = 'Synthetic Reference Check (Simulated)';
            verificationDetails = {
              recordId: verifyResult.recordId,
              certificateType: verifyResult.certificateType,
              certificateId: verifyResult.certificateId,
              certificateStatus: verifyResult.certificateStatus,
              syntheticVerificationMatch: true,
              requiresManualReview: true,
              isSimulated: true,
              verifiedAt: new Date(),
              note: 'Simulated verification matched against synthetic test records. Fictional dataset - member remains in Pending Verification awaiting authorized officer review.'
            };
          } else {
            verificationDetails = {
              certificateType: cleanCertType,
              certificateId: cleanCertId,
              syntheticVerificationMatch: false,
              requiresManualReview: true,
              isSimulated: true,
              note: 'Certificate reference could not be verified against synthetic records. Submitted for manual officer review.'
            };
          }
        } catch (vErr) {
          console.warn('[Household] Verification check notice:', vErr.message);
          verificationDetails = {
            certificateType: cleanCertType,
            certificateId: cleanCertId,
            syntheticVerificationMatch: false,
            requiresManualReview: true,
            isSimulated: true,
            note: 'Verification service check pending. Submitted for manual officer review.'
          };
        }
      } else {
        isSimulated = (mode === 'synthetic');
        verificationDetails = {
          certificateType: cleanCertType,
          certificateId: cleanCertId,
          requiresManualReview: true,
          isSimulated,
          note: 'Reference captured. Live official government verification provider not configured. Submitted for manual officer review.'
        };
      }
    }

    // 4. Generate unique internal IDs
    let randomSuffix = Math.floor(1000 + Math.random() * 9000);
    while (dataStore.findCitizen(`CIT-${randomSuffix}`)) {
      randomSuffix = Math.floor(1000 + Math.random() * 9000);
    }
    const citizenId = `CIT-${randomSuffix}`;
    const relationshipId = `REL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const age = calculateAge(cleanDob);

    // 5. Build member document
    const newCitizenData = {
      citizenId,
      currentFamilyId: familyId,
      fullName: cleanName,
      gender,
      dob: cleanDob,
      age: age || 0,
      occupation: occupation ? String(occupation).trim() : 'Resident',
      education: education ? String(education).trim() : 'Not Specified',
      isHeadOfFamily: false,
      isFarmer: Boolean(isFarmer),
      landholdingHectares: Number(landholdingHectares) || 0,
      hasDisability: Boolean(hasDisability),
      category: category ? String(category).trim() : 'General',
      maskedAadhaar: `XXXX-XXXX-${Math.floor(1000 + Math.random() * 9000)}`,
      verificationStatus,
      verificationSource,
      verificationDetails,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 6. Build relationship document
    const headCitizenId = household.headCitizenId || req.user.userId;
    const newRelationshipData = {
      relationshipId,
      citizenId1: headCitizenId,
      citizenId2: citizenId,
      relationshipType: relationship,
      isActive: true,
      notes: `Relationship to Household Head: ${relationship}`
    };

    // 7. Build membership history entry
    const newMembershipHistory = {
      historyId: `HIST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      citizenId,
      familyId,
      startDate: new Date(),
      endDate: null,
      exitReason: null
    };

    // 8. Build audit log entry
    const auditData = {
      logId: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'ADD_HOUSEHOLD_MEMBER',
      targetEntity: 'Citizen',
      targetEntityId: citizenId,
      details: `Added member ${cleanName} (${citizenId}) with relationship '${relationship}' to household ${familyId}. Verification status: ${verificationStatus} (Simulated match: ${syntheticMatch}).`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
      timestamp: new Date()
    };

    // 9. Persist to MongoDB Atlas if available
    if (isMongoReady()) {
      try {
        await Citizen.create(newCitizenData);
        await FamilyRelationship.create(newRelationshipData);
        await HouseholdMembershipHistory.create(newMembershipHistory);
        await AuditLog.create(auditData);
      } catch (dbErr) {
        console.error('[Household] MongoDB write error on add member:', dbErr);
        // Continue to keep dataStore in sync
      }
    }

    // Always update in-memory dataStore
    dataStore.createCitizen(newCitizenData);
    dataStore.createRelationship(newRelationshipData);
    dataStore.addMembershipHistory(newMembershipHistory);
    dataStore.createAuditLog(auditData);

    // Notify Officers about new member verification task
    dataStore.createNotification({
      notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      recipientType: 'Officer',
      recipientId: 'ALL_OFFICERS',
      title: 'New Household Member Pending Verification',
      message: `Member ${cleanName} (${citizenId}) added to Family ${familyId}. Relationship: ${relationship}. Status: Pending Verification.`,
      category: 'Correction',
      relatedEntityId: citizenId,
      isRead: false,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: `Family member ${cleanName} added successfully in 'Pending Verification' status.`,
      member: newCitizenData,
      relationship: newRelationshipData,
      isSimulatedVerification: isSimulated,
      syntheticMatch
    });
  } catch (err) {
    console.error('Add family member error:', err);
    res.status(500).json({ success: false, message: 'Internal server error while adding family member.' });
  }
});

// PATCH /api/households/:familyId/members/:citizenId - Update or submit correction for family member
router.patch('/:familyId/members/:citizenId', requireAuth, requireHouseholdAccess, async (req, res) => {
  try {
    const { familyId, citizenId } = req.params;
    const citizen = dataStore.findCitizen(citizenId);

    if (!citizen || citizen.currentFamilyId !== familyId || citizen.status === 'inactive') {
      return res.status(404).json({ success: false, message: `Member ${citizenId} not found in household ${familyId}.` });
    }

    const {
      fullName,
      dob,
      gender,
      relationship,
      occupation,
      education,
      isFarmer,
      landholdingHectares,
      hasDisability,
      category
    } = req.body;

    const previousState = { ...citizen };
    const updates = {};

    if (occupation !== undefined) updates.occupation = String(occupation).trim();
    if (education !== undefined) updates.education = String(education).trim();
    if (isFarmer !== undefined) updates.isFarmer = Boolean(isFarmer);
    if (landholdingHectares !== undefined) updates.landholdingHectares = Number(landholdingHectares) || 0;
    if (hasDisability !== undefined) updates.hasDisability = Boolean(hasDisability);
    if (category !== undefined) updates.category = String(category).trim();

    // If member is in 'Pending Verification' status, allow updating name/dob/gender
    if (citizen.verificationStatus === 'Pending Verification' || req.user.role === 'officer' || req.user.role === 'admin') {
      if (fullName && fullName.trim().length >= 2) updates.fullName = fullName.trim();
      if (dob && !isNaN(new Date(dob).getTime())) {
        updates.dob = dob.trim();
        updates.age = calculateAge(dob.trim());
      }
      if (gender && ['Male', 'Female', 'Other'].includes(gender)) updates.gender = gender;
    }

    updates.updatedAt = new Date();

    // Update relationship if provided
    let updatedRelationship = null;
    if (relationship) {
      const relationships = dataStore.getRelationshipsForCitizens([citizenId]);
      const headRel = relationships.find(r => r.citizenId1 === citizenId || r.citizenId2 === citizenId);
      if (headRel) {
        headRel.relationshipType = relationship;
        headRel.notes = `Updated relationship: ${relationship}`;
        updatedRelationship = headRel;
        if (isMongoReady()) {
          try {
            await FamilyRelationship.updateOne({ relationshipId: headRel.relationshipId }, { relationshipType: relationship });
          } catch (e) {}
        }
      }
    }

    // Persist updates to MongoDB if ready
    if (isMongoReady()) {
      try {
        await Citizen.updateOne({ citizenId }, { $set: updates });
        await AuditLog.create({
          logId: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          actorId: req.user.userId,
          actorRole: req.user.role,
          action: 'UPDATE_HOUSEHOLD_MEMBER',
          targetEntity: 'Citizen',
          targetEntityId: citizenId,
          details: `Updated details for member ${citizenId} in household ${familyId}.`,
          previousState,
          newState: { ...previousState, ...updates },
          ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
          timestamp: new Date()
        });
      } catch (dbErr) {
        console.warn('[Household] MongoDB update warning:', dbErr.message);
      }
    }

    // Update in-memory dataStore
    const updatedCitizen = dataStore.updateCitizen(citizenId, updates);
    dataStore.createAuditLog({
      logId: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'UPDATE_HOUSEHOLD_MEMBER',
      targetEntity: 'Citizen',
      targetEntityId: citizenId,
      details: `Updated details for member ${citizenId} in household ${familyId}.`,
      previousState,
      newState: updatedCitizen,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Family member details updated successfully.',
      member: updatedCitizen,
      relationship: updatedRelationship
    });
  } catch (err) {
    console.error('Update member error:', err);
    res.status(500).json({ success: false, message: 'Internal server error while updating family member.' });
  }
});

// DELETE /api/households/:familyId/members/:citizenId - Remove member with audit trail & history
router.delete('/:familyId/members/:citizenId', requireAuth, requireHouseholdAccess, async (req, res) => {
  try {
    const { familyId, citizenId } = req.params;
    const { reason } = req.body || {};

    const household = dataStore.findHousehold(familyId);
    if (!household) {
      return res.status(404).json({ success: false, message: `Household ${familyId} not found.` });
    }

    const citizen = dataStore.findCitizen(citizenId);
    if (!citizen || citizen.currentFamilyId !== familyId || citizen.status === 'inactive') {
      return res.status(404).json({ success: false, message: `Member ${citizenId} not found in household ${familyId}.` });
    }

    // Cannot remove the household head!
    if (citizen.isHeadOfFamily || household.headCitizenId === citizenId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the household head. Use the Household Separation workflow to move or transfer headship before removal.'
      });
    }

    const removalReason = (reason && String(reason).trim()) || 'Removed by Household Owner';

    // Remove from in-memory dataStore
    dataStore.removeCitizenFromHousehold(citizenId, familyId, removalReason);

    // Audit Log
    const auditData = {
      logId: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'REMOVE_HOUSEHOLD_MEMBER',
      targetEntity: 'Citizen',
      targetEntityId: citizenId,
      details: `Removed member ${citizen.fullName} (${citizenId}) from household ${familyId}. Reason: ${removalReason}.`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
      timestamp: new Date()
    };
    dataStore.createAuditLog(auditData);

    // Persist to MongoDB if available
    if (isMongoReady()) {
      try {
        await Citizen.updateOne(
          { citizenId },
          { status: 'inactive', currentFamilyId: 'REMOVED', updatedAt: new Date() }
        );
        await HouseholdMembershipHistory.updateOne(
          { citizenId, endDate: null },
          { endDate: new Date(), exitReason: removalReason }
        );
        await FamilyRelationship.updateMany(
          { $or: [{ citizenId1: citizenId }, { citizenId2: citizenId }] },
          { isActive: false }
        );
        await AuditLog.create(auditData);
      } catch (dbErr) {
        console.warn('[Household] MongoDB removal warning:', dbErr.message);
      }
    }

    res.json({
      success: true,
      message: `Member ${citizen.fullName} (${citizenId}) removed from household ${familyId}. Membership history and audit trail updated.`
    });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ success: false, message: 'Internal server error while removing family member.' });
  }
});

// GET /api/households/:familyId/history
router.get('/:familyId/history', requireAuth, requireHouseholdAccess, (req, res) => {
  const { familyId } = req.params;
  const history = dataStore.getMembershipHistory(familyId, null);
  const separationRequests = dataStore.getSeparationRequestsByFamily(familyId);

  // Enrich with citizen names
  const enrichedHistory = history.map(h => {
    const citizen = dataStore.findCitizen(h.citizenId);
    return {
      ...h,
      citizenName: citizen ? citizen.fullName : h.citizenId
    };
  });

  res.json({
    success: true,
    familyId,
    history: enrichedHistory,
    separationRequests
  });
});

// GET /api/households/:familyId/benefits
router.get('/:familyId/benefits', requireAuth, requireHouseholdAccess, (req, res) => {
  const { familyId } = req.params;
  const benefits = dataStore.getBenefitsByFamily(familyId);

  res.json({
    success: true,
    familyId,
    benefits
  });
});

module.exports = router;
