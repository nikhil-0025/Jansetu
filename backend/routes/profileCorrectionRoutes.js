const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const dataStore = require('../models/dataStore');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  uploadPdfMiddleware,
  validatePdfSignature,
  secureUploadDir,
  MAX_FILE_SIZE
} = require('../middleware/secureUpload');
const {
  ProfileCorrectionRequest,
  Citizen,
  Household,
  AuditLog,
  Notification
} = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// Allowed profile fields that can be legally requested for correction
const ALLOWED_CORRECTION_FIELDS = [
  'fullName',
  'dob',
  'gender',
  'occupation',
  'education',
  'category',
  'address'
];

// 8 Mandatory Document Types
const ALLOWED_DOCUMENT_TYPES = [
  'Aadhaar Card',
  'Voter ID Card',
  'Passport',
  'Matriculation / Class 10 Certificate',
  'Birth Certificate',
  'Driving Licence',
  'PAN Card',
  'Other'
];

/**
 * GET /api/profile-corrections
 * List correction requests.
 * Citizens only see requests belonging to their household/citizen account.
 * Officers and Admins can see all requests.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    let corrections = [];

    if (isMongoReady()) {
      try {
        const query = req.user.role === 'citizen' ? { familyId: req.user.familyId } : {};
        corrections = await ProfileCorrectionRequest.find(query).sort({ createdAt: -1 }).lean();
      } catch (dbErr) {
        console.warn('[ProfileCorrection] Mongo query failed, falling back to dataStore:', dbErr.message);
        corrections = dataStore.getAllProfileCorrections();
        if (req.user.role === 'citizen') {
          corrections = corrections.filter(c => c.familyId === req.user.familyId);
        }
      }
    } else {
      corrections = dataStore.getAllProfileCorrections();
      if (req.user.role === 'citizen') {
        corrections = corrections.filter(c => c.familyId === req.user.familyId);
      }
    }

    // Enrich with citizen details
    const enriched = corrections.map(c => {
      const cit = dataStore.findCitizen(c.citizenId);
      return {
        ...c,
        citizenName: cit ? cit.fullName : c.citizenId,
        hasSupportingDocument: Boolean(c.storedFilename || c.filePath || c.supportingDocumentUrl)
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      corrections: enriched
    });
  } catch (err) {
    console.error('Fetch profile corrections error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile corrections.' });
  }
});

/**
 * GET /api/profile-corrections/:requestId
 * Retrieve a specific profile correction request by ID.
 * Enforces ownership check: only the requesting citizen or authorized officers may access.
 */
router.get('/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    let correction = null;

    if (isMongoReady()) {
      try {
        correction = await ProfileCorrectionRequest.findOne({ requestId }).lean();
      } catch (err) {
        console.warn('[ProfileCorrection] Mongo fetch error, checking dataStore:', err.message);
      }
    }

    if (!correction) {
      correction = dataStore.findProfileCorrection(requestId);
    }

    if (!correction) {
      return res.status(404).json({ success: false, message: `Profile correction request '${requestId}' was not found.` });
    }

    // Ownership Check
    if (req.user.role === 'citizen' && correction.familyId !== req.user.familyId && correction.requesterId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view profile correction requests belonging to another household.'
      });
    }

    const citizen = dataStore.findCitizen(correction.citizenId);

    res.json({
      success: true,
      correction: {
        ...correction,
        citizenName: citizen ? citizen.fullName : correction.citizenId
      }
    });
  } catch (err) {
    console.error('Get profile correction details error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch correction details.' });
  }
});

/**
 * POST /api/profile-corrections
 * Submit a citizen profile correction request with mandatory supporting PDF.
 */
router.post('/', requireAuth, uploadPdfMiddleware('supportingDocument'), async (req, res) => {
  const uploadedFile = req.file;

  try {
    const {
      citizenId,
      fieldToCorrect,
      requestedValue,
      proposedValue,
      reason,
      documentType,
      otherDocumentType
    } = req.body;

    const targetValue = requestedValue || proposedValue;

    // 1. Mandatory Form Validations
    if (!citizenId || !fieldToCorrect || !targetValue || !reason || !documentType) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: 'Citizen ID, Field to Correct, Requested New Value, Correction Reason, and Document Type are mandatory.'
      });
    }

    if (!ALLOWED_CORRECTION_FIELDS.includes(fieldToCorrect)) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: `Field '${fieldToCorrect}' cannot be directly corrected. Permitted profile fields: ${ALLOWED_CORRECTION_FIELDS.join(', ')}.`
      });
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: `Invalid document type. Allowed options: ${ALLOWED_DOCUMENT_TYPES.join(', ')}.`
      });
    }

    if (documentType === 'Other' && (!otherDocumentType || !otherDocumentType.trim())) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: 'When document type is "Other", you must specify the custom document name in "Specify Document Type".'
      });
    }

    // 2. Validate PDF Upload Presence
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'Supporting PDF document is required for review. Please attach an official PDF certificate.'
      });
    }

    // 3. Server-Side Magic Byte Signature Verification
    const sigCheck = await validatePdfSignature(uploadedFile.path);
    if (!sigCheck.valid) {
      if (fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: sigCheck.reason || 'File validation failed: The uploaded file is not a genuine PDF document.'
      });
    }

    // 4. Verify Citizen Existence and Family Ownership
    const citizen = dataStore.findCitizen(citizenId);
    if (!citizen) {
      if (fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(404).json({ success: false, message: `Citizen record '${citizenId}' not found.` });
    }

    if (req.user.role === 'citizen' && citizen.currentFamilyId !== req.user.familyId) {
      if (fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(403).json({
        success: false,
        message: 'Access denied: You may only submit correction requests for members of your own registered household.'
      });
    }

    // 5. Fetch Secure Current Value
    let currentValue = 'Not specified';
    if (citizen[fieldToCorrect] !== undefined && citizen[fieldToCorrect] !== null) {
      currentValue = String(citizen[fieldToCorrect]);
    }

    // Prevent submitting identical value
    if (currentValue.trim().toLowerCase() === targetValue.trim().toLowerCase()) {
      if (fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: `The requested value '${targetValue}' is already identical to the currently recorded value.`
      });
    }

    const requestId = `COR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    // Sanitize original filename (remove directory traversals, control characters)
    const sanitizedOriginalFilename = path.basename(uploadedFile.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');

    const newCorrection = {
      requestId,
      requesterId: req.user.userId,
      citizenId,
      familyId: citizen.currentFamilyId,
      fieldToCorrect,
      currentValue,
      requestedValue: targetValue.trim(),
      proposedValue: targetValue.trim(),
      reason: reason.trim(),
      documentType,
      otherDocumentType: documentType === 'Other' ? otherDocumentType.trim() : null,
      originalFilename: sanitizedOriginalFilename,
      storedFilename: uploadedFile.filename,
      filePath: uploadedFile.path,
      fileSize: uploadedFile.size,
      mimeType: uploadedFile.mimetype,
      uploadedAt: now,
      supportingDocumentUrl: `/api/profile-corrections/${requestId}/document`,
      status: 'Pending',
      officerComment: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewHistory: [
        {
          action: 'SUBMITTED',
          actorId: req.user.userId,
          actorRole: req.user.role,
          comments: `Correction request submitted with supporting evidence: ${documentType}${documentType === 'Other' ? ` (${otherDocumentType})` : ''}`,
          timestamp: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    // 6. Persistence Strategy (MongoDB Atlas + dataStore fallback)
    if (isMongoReady()) {
      try {
        await ProfileCorrectionRequest.create(newCorrection);
      } catch (mongoErr) {
        console.warn('[ProfileCorrection] Mongo save error, proceeding with dataStore:', mongoErr.message);
      }
    }
    dataStore.createProfileCorrection(newCorrection);

    // 7. Audit Log Entry
    dataStore.createAuditLog({
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'LODGE_PROFILE_CORRECTION_REQUEST',
      targetEntity: 'ProfileCorrectionRequest',
      targetEntityId: requestId,
      details: `Correction requested for Citizen ${citizenId} (${citizen.fullName}): ${fieldToCorrect} from '${currentValue}' to '${targetValue}'. Document: ${documentType} (${sanitizedOriginalFilename}, ${(uploadedFile.size / 1024).toFixed(1)} KB).`,
      timestamp: now
    });

    // 8. Officer Notification
    dataStore.createNotification({
      notificationId: `NOTIF-${Date.now()}`,
      recipientType: 'Officer',
      recipientId: 'ALL_OFFICERS',
      title: 'New Profile Correction Request with Supporting PDF',
      message: `Correction request ${requestId} submitted for ${citizen.fullName} (${fieldToCorrect}). Supporting proof: ${documentType}. Officer review required.`,
      category: 'Correction',
      relatedEntityId: requestId,
      isRead: false,
      createdAt: now
    });

    res.status(201).json({
      success: true,
      message: `Profile correction request ${requestId} lodged successfully with supporting PDF proof. Status: Pending Officer Review.`,
      requestId,
      correction: newCorrection
    });
  } catch (err) {
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      await fs.promises.unlink(uploadedFile.path).catch(() => {});
    }
    console.error('Submit profile correction error:', err);
    res.status(500).json({ success: false, message: `Failed to submit profile correction: ${err.message}` });
  }
});

/**
 * GET /api/profile-corrections/:requestId/document
 * Stream or download the uploaded supporting PDF proof.
 * STRICT ACCESS CONTROL: Only the citizen owner or authorized reviewing officers may access.
 */
router.get('/:requestId/document', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    let correction = null;

    if (isMongoReady()) {
      try {
        correction = await ProfileCorrectionRequest.findOne({ requestId }).lean();
      } catch (err) {
        console.warn('[ProfileCorrection] Mongo fetch error:', err.message);
      }
    }

    if (!correction) {
      correction = dataStore.findProfileCorrection(requestId);
    }

    if (!correction) {
      return res.status(404).json({ success: false, message: `Correction request '${requestId}' not found.` });
    }

    // Authorization & Ownership Verification
    if (req.user.role === 'citizen') {
      const isOwner = correction.familyId === req.user.familyId || correction.requesterId === req.user.userId;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view or download supporting documents of other citizens.'
        });
      }
    }

    // Resolve file path safely
    let targetPath = correction.filePath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      if (correction.storedFilename) {
        targetPath = path.join(secureUploadDir, correction.storedFilename);
      }
    }

    // Fallback to sample supporting doc if running on seed records
    if (!targetPath || !fs.existsSync(targetPath)) {
      const fallbackPath = path.join(secureUploadDir, 'sample_supporting_doc.pdf');
      if (fs.existsSync(fallbackPath)) {
        targetPath = fallbackPath;
      } else {
        return res.status(404).json({
          success: false,
          message: 'The supporting PDF file is missing or has been relocated from secure storage.'
        });
      }
    }

    // Prevent Path Traversal
    const resolvedPath = path.resolve(targetPath);
    if (!resolvedPath.startsWith(path.resolve(secureUploadDir))) {
      return res.status(403).json({ success: false, message: 'Invalid file path traversal detected.' });
    }

    // Set secure headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${correction.originalFilename || 'supporting_document.pdf'}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    res.sendFile(resolvedPath);
  } catch (err) {
    console.error('Download correction document error:', err);
    res.status(500).json({ success: false, message: 'Failed to access supporting document.' });
  }
});

/**
 * PATCH /api/profile-corrections/:requestId/review
 * (Also supports POST for backward compatibility)
 * Officer reviews, inspects evidence, and records decision:
 * 'Approved' | 'Rejected' | 'Additional Evidence Required' | 'Under Review'
 */
const handleOfficerReview = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, remarks, officerRemarks } = req.body;
    const finalRemarks = remarks || officerRemarks;

    const VALID_DECISIONS = ['Approved', 'Rejected', 'Additional Evidence Required', 'Under Review'];

    if (!VALID_DECISIONS.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: `Invalid review decision. Permitted decisions: ${VALID_DECISIONS.join(', ')}.`
      });
    }

    // Mandatory comments check for rejection or additional evidence requests
    if (['Rejected', 'Additional Evidence Required'].includes(decision) && (!finalRemarks || !finalRemarks.trim())) {
      return res.status(400).json({
        success: false,
        message: `Mandatory officer remarks are required when decision is '${decision}' to inform the citizen of required next steps.`
      });
    }

    let correction = null;
    if (isMongoReady()) {
      try {
        correction = await ProfileCorrectionRequest.findOne({ requestId });
      } catch (err) {
        console.warn('[ProfileCorrection] Mongo fetch error:', err.message);
      }
    }

    if (!correction) {
      correction = dataStore.findProfileCorrection(requestId);
    }

    if (!correction) {
      return res.status(404).json({ success: false, message: `Correction request '${requestId}' not found.` });
    }

    const now = new Date();
    const officerId = req.user.userId;
    const officerName = req.user.officerName || 'Block Verification Officer';

    // Atomic / Consistency update: If Approved, update citizen's actual profile record
    let profileUpdated = false;
    if (decision === 'Approved') {
      const citizen = dataStore.findCitizen(correction.citizenId);
      if (citizen && ALLOWED_CORRECTION_FIELDS.includes(correction.fieldToCorrect)) {
        const updateObj = {};
        updateObj[correction.fieldToCorrect] = correction.requestedValue || correction.proposedValue;
        
        dataStore.updateCitizen(correction.citizenId, updateObj);
        profileUpdated = true;

        if (isMongoReady()) {
          try {
            await Citizen.updateOne({ citizenId: correction.citizenId }, { $set: updateObj });
          } catch (mErr) {
            console.warn('[ProfileCorrection] Mongo citizen update error:', mErr.message);
          }
        }
      }
    }

    // Review history entry
    const reviewHistoryEntry = {
      action: decision.toUpperCase().replace(/\s+/g, '_'),
      actorId: officerId,
      actorRole: req.user.role,
      comments: finalRemarks || `Status updated to ${decision}`,
      timestamp: now
    };

    const updateFields = {
      status: decision,
      officerComment: finalRemarks,
      reviewedBy: officerId,
      reviewedAt: now,
      officerReview: {
        officerId,
        officerName,
        officerRemarks: finalRemarks,
        decision,
        reviewedAt: now
      },
      updatedAt: now
    };

    // Update in Mongo & dataStore
    if (isMongoReady()) {
      try {
        await ProfileCorrectionRequest.updateOne(
          { requestId },
          {
            $set: updateFields,
            $push: { reviewHistory: reviewHistoryEntry }
          }
        );
      } catch (err) {
        console.warn('[ProfileCorrection] Mongo review update error:', err.message);
      }
    }

    const updatedDataStore = dataStore.updateProfileCorrection(requestId, {
      ...updateFields,
      reviewHistory: [...(correction.reviewHistory || []), reviewHistoryEntry]
    });

    // Notify Citizen Household
    dataStore.createNotification({
      notificationId: `NOTIF-${Date.now()}`,
      recipientType: 'Household',
      recipientId: correction.familyId,
      title: `Profile Correction Decision: ${decision}`,
      message: `Your correction request (${requestId}) for ${correction.fieldToCorrect} was marked '${decision}' by Officer ${officerName}. Remarks: ${finalRemarks || 'Verified'}`,
      category: 'Correction',
      relatedEntityId: requestId,
      isRead: false,
      createdAt: now
    });

    // Immutable Audit Log
    dataStore.createAuditLog({
      logId: `AUD-${Date.now()}`,
      actorId: officerId,
      actorRole: req.user.role,
      action: `REVIEW_PROFILE_CORRECTION_${decision.toUpperCase().replace(/\s+/g, '_')}`,
      targetEntity: 'ProfileCorrectionRequest',
      targetEntityId: requestId,
      details: `Officer ${officerId} reviewed request ${requestId} (${correction.fieldToCorrect}): ${decision}. Remarks: ${finalRemarks || 'None'}. Profile Field Updated: ${profileUpdated}`,
      timestamp: now
    });

    res.json({
      success: true,
      message: `Profile correction request ${requestId} has been marked as '${decision}'.${profileUpdated ? ' Citizen profile record has been successfully updated.' : ''}`,
      correction: updatedDataStore || updateFields,
      profileUpdated
    });
  } catch (err) {
    console.error('Officer review error:', err);
    res.status(500).json({ success: false, message: `Failed to record review decision: ${err.message}` });
  }
};

router.patch('/:requestId/review', requireAuth, requireRole(['officer', 'admin']), handleOfficerReview);
router.post('/:requestId/review', requireAuth, requireRole(['officer', 'admin']), handleOfficerReview);

/**
 * POST /api/profile-corrections/:requestId/resubmit
 * Citizen resubmission when additional evidence was requested by an officer.
 */
router.post('/:requestId/resubmit', requireAuth, uploadPdfMiddleware('supportingDocument'), async (req, res) => {
  const uploadedFile = req.file;

  try {
    const { requestId } = req.params;
    const { additionalReason, documentType, otherDocumentType } = req.body;

    let correction = dataStore.findProfileCorrection(requestId);
    if (!correction) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(404).json({ success: false, message: `Request '${requestId}' not found.` });
    }

    // Ownership check
    if (req.user.role === 'citizen' && correction.familyId !== req.user.familyId && correction.requesterId !== req.user.userId) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(403).json({ success: false, message: 'Unauthorized to resubmit this request.' });
    }

    if (!['Additional Evidence Required', 'Rejected'].includes(correction.status)) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: `Resubmission is only permitted when request status is 'Additional Evidence Required' or 'Rejected'. Current status is '${correction.status}'.`
      });
    }

    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: 'A replacement or additional PDF document is required for resubmission.' });
    }

    const sigCheck = await validatePdfSignature(uploadedFile.path);
    if (!sigCheck.valid) {
      if (fs.existsSync(uploadedFile.path)) {
        await fs.promises.unlink(uploadedFile.path).catch(() => {});
      }
      return res.status(400).json({ success: false, message: sigCheck.reason });
    }

    const now = new Date();
    const sanitizedOriginalFilename = path.basename(uploadedFile.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');

    const resubmitHistoryEntry = {
      action: 'RESUBMITTED',
      actorId: req.user.userId,
      actorRole: req.user.role,
      comments: additionalReason || 'Citizen resubmitted supporting evidence for review',
      timestamp: now
    };

    const updateFields = {
      status: 'Pending',
      originalFilename: sanitizedOriginalFilename,
      storedFilename: uploadedFile.filename,
      filePath: uploadedFile.path,
      fileSize: uploadedFile.size,
      mimeType: uploadedFile.mimetype,
      uploadedAt: now,
      documentType: documentType || correction.documentType,
      otherDocumentType: documentType === 'Other' ? otherDocumentType : (correction.otherDocumentType || null),
      reason: `${correction.reason}\n[Resubmission Note]: ${additionalReason || 'Updated evidence provided'}`,
      updatedAt: now
    };

    if (isMongoReady()) {
      try {
        await ProfileCorrectionRequest.updateOne(
          { requestId },
          {
            $set: updateFields,
            $push: { reviewHistory: resubmitHistoryEntry }
          }
        );
      } catch (mErr) {
        console.warn('[ProfileCorrection] Mongo resubmit update error:', mErr.message);
      }
    }

    const updated = dataStore.updateProfileCorrection(requestId, {
      ...updateFields,
      reviewHistory: [...(correction.reviewHistory || []), resubmitHistoryEntry]
    });

    dataStore.createAuditLog({
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'RESUBMIT_PROFILE_CORRECTION_REQUEST',
      targetEntity: 'ProfileCorrectionRequest',
      targetEntityId: requestId,
      details: `Citizen resubmitted evidence for ${requestId}. New document: ${sanitizedOriginalFilename}. Status set to Pending.`,
      timestamp: now
    });

    res.json({
      success: true,
      message: `Correction request ${requestId} has been resubmitted with updated evidence. Status reset to Pending.`,
      correction: updated
    });
  } catch (err) {
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      await fs.promises.unlink(uploadedFile.path).catch(() => {});
    }
    console.error('Resubmit error:', err);
    res.status(500).json({ success: false, message: `Failed to resubmit request: ${err.message}` });
  }
});

module.exports = router;
