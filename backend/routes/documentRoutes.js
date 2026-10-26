const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');

const dataStore = require('../models/dataStore');
const { requireAuth, requireRole } = require('../middleware/auth');
const { Document, Citizen, AuditLog, Notification } = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// Ensure private uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration with random hex filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomHex = crypto.randomBytes(8).toString('hex');
    const safeName = `doc_${Date.now()}_${randomHex}${ext}`;
    cb(null, safeName);
  }
});

// File filter (PDF, JPG, PNG)
const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = ['application/pdf', 'application/x-pdf', 'image/jpeg', 'image/png'];

  if (!allowedExts.includes(ext) || !allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid file format. Only PDF, JPG, and PNG documents are supported.'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET /api/documents - Fetch documents
router.get('/', requireAuth, async (req, res) => {
  try {
    const { familyId, citizenId } = req.query;

    // Officers can see all, citizens only their own
    const targetFamilyId = req.user.role === 'citizen' ? req.user.familyId : (familyId || null);

    let docs = [];

    if (isMongoReady()) {
      try {
        const query = {};
        if (targetFamilyId) query.familyId = targetFamilyId;
        if (citizenId) query.citizenId = citizenId;

        docs = await Document.find(query).sort({ uploadedAt: -1 }).lean();
      } catch (dbErr) {
        console.warn('[Documents] Mongo query failed, falling back to dataStore:', dbErr.message);
      }
    }

    if (!docs || docs.length === 0) {
      docs = dataStore.getDocuments(targetFamilyId, citizenId || null);
    }

    // Enrich with citizen name if individual doc
    const enriched = await Promise.all(docs.map(async (d) => {
      let citizenName = null;
      if (d.citizenId) {
        if (isMongoReady()) {
          try {
            const cit = await Citizen.findOne({ citizenId: d.citizenId }).lean();
            if (cit) citizenName = cit.fullName;
          } catch (e) {}
        }
        if (!citizenName) {
          const c = dataStore.findCitizen(d.citizenId);
          citizenName = c ? c.fullName : d.citizenId;
        }
      }
      return {
        ...d,
        citizenName,
        // Ensure download URL points to the secure authenticated route
        secureFileUrl: `/api/documents/${d.documentId}/file`
      };
    }));

    res.json({
      success: true,
      documents: enriched
    });
  } catch (err) {
    console.error('Fetch documents error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve documents.' });
  }
});

// GET /api/documents/:documentId/file - Authenticated & access-controlled document download
router.get('/:documentId/file', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    let doc = null;
    if (isMongoReady()) {
      try {
        doc = await Document.findOne({ documentId }).lean();
      } catch (e) {}
    }
    if (!doc) {
      doc = dataStore.findDocument(documentId);
    }

    if (!doc) {
      return res.status(404).json({ success: false, message: `Document '${documentId}' not found.` });
    }

    // Authorization check: Citizens can only download documents belonging to their household
    if (req.user.role === 'citizen' && doc.familyId && doc.familyId !== req.user.familyId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view documents from another household.'
      });
    }

    // Locate file on disk
    let targetPath = null;
    if (doc.storedFilename) {
      targetPath = path.join(uploadDir, doc.storedFilename);
    } else if (doc.fileUrl) {
      const baseFilename = path.basename(doc.fileUrl);
      targetPath = path.join(uploadDir, baseFilename);
    }

    // Fallback to sample verified doc or secure_uploads sample doc if demo file is referenced
    if (!targetPath || !fs.existsSync(targetPath)) {
      const samplePaths = [
        path.join(uploadDir, 'sample_verified_doc.pdf'),
        path.join(__dirname, '../secure_uploads/corrections/sample_supporting_doc.pdf'),
        path.join(__dirname, '../../backend/secure_uploads/corrections/sample_supporting_doc.pdf')
      ];
      for (const sp of samplePaths) {
        if (fs.existsSync(sp)) {
          targetPath = sp;
          break;
        }
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        return res.status(404).json({
          success: false,
          message: 'The requested document file is missing or has been removed from storage.'
        });
      }
    }

    // Path traversal prevention: verify file is within project uploads or secure_uploads
    const resolvedPath = path.resolve(targetPath);
    const allowedRoots = [
      path.resolve(uploadDir),
      path.resolve(path.join(__dirname, '../secure_uploads'))
    ];
    const isAllowed = allowedRoots.some(root => resolvedPath.startsWith(root));
    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'Invalid file path traversal detected.' });
    }

    // Set secure headers
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalFilename || 'document' + ext}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    res.sendFile(resolvedPath);
  } catch (err) {
    console.error('Download document error:', err);
    res.status(500).json({ success: false, message: 'Failed to access document file.' });
  }
});

// POST /api/documents - Upload / Register new document
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { title, documentType, scope, citizenId, issuingAuthority, referenceNo } = req.body;

    if (!title || !documentType) {
      return res.status(400).json({ success: false, message: 'Document Title and Type are mandatory.' });
    }

    const familyId = req.user.role === 'citizen' ? req.user.familyId : (req.body.familyId || 'FAM-1001');

    // Create masked reference number
    let maskedRef = referenceNo || `DOC-${Math.floor(1000 + Math.random() * 9000)}`;
    if (maskedRef.length > 6) {
      maskedRef = `${maskedRef.substring(0, 2)}****${maskedRef.slice(-4)}`;
    }

    const docId = `DOC-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90)}`;
    const originalFilename = req.file ? req.file.originalname : 'uploaded_document.pdf';
    const storedFilename = req.file ? req.file.filename : null;
    const fileSize = req.file ? `${(req.file.size / (1024 * 1024)).toFixed(2)} MB` : '1.20 MB';
    const fileUrl = `/api/documents/${docId}/file`;

    const newDoc = {
      documentId: docId,
      title,
      documentType,
      scope: scope || 'Individual',
      familyId,
      citizenId: scope === 'Individual' ? (citizenId || null) : null,
      fileUrl,
      originalFilename,
      storedFilename,
      fileSize,
      issuingAuthority: issuingAuthority || 'Authorized Competent Authority',
      maskedReferenceNo: maskedRef,
      verificationStatus: 'Pending Verification',
      officerRemarks: null,
      verifiedBy: null,
      verifiedAt: null,
      uploadedAt: new Date()
    };

    // Persist to MongoDB Atlas if available
    if (isMongoReady()) {
      try {
        await Document.create(newDoc);
        await AuditLog.create({
          logId: `AUD-${Date.now()}`,
          actorId: req.user.userId,
          actorRole: req.user.role,
          action: 'UPLOAD_DOCUMENT',
          targetEntity: 'Document',
          targetEntityId: docId,
          details: `Uploaded ${documentType}: ${title} for ${scope} verification.`,
          timestamp: new Date()
        });
      } catch (dbErr) {
        console.warn('[Documents] MongoDB write warning:', dbErr.message);
      }
    }

    // Always update in-memory dataStore
    dataStore.createDocument(newDoc);
    dataStore.createAuditLog({
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: 'UPLOAD_DOCUMENT',
      targetEntity: 'Document',
      targetEntityId: docId,
      details: `Uploaded ${documentType}: ${title} for ${scope} verification.`,
      timestamp: new Date()
    });

    // Notify Officer
    dataStore.createNotification({
      notificationId: `NOTIF-${Date.now()}`,
      recipientType: 'Officer',
      recipientId: 'ALL_OFFICERS',
      title: 'New Document Pending Verification',
      message: `New ${documentType} uploaded for Household ${familyId} (Document ID: ${docId}).`,
      category: 'Document',
      relatedEntityId: docId,
      isRead: false,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: `Document '${title}' uploaded successfully. Status: Pending Verification.`,
      document: newDoc
    });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'File upload failed.' });
  }
});

// PATCH /api/documents/:documentId/verification - Officer verifies or rejects document
router.patch('/:documentId/verification', requireAuth, requireRole(['officer', 'admin']), async (req, res) => {
  try {
    const { documentId } = req.params;
    const { status, remarks } = req.body;

    if (!['Verified', 'Rejected', 'Pending Verification'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid verification status.' });
    }

    if (status === 'Rejected' && !remarks) {
      return res.status(400).json({ success: false, message: 'A rejection remark/reason is mandatory.' });
    }

    let doc = null;
    if (isMongoReady()) {
      try {
        doc = await Document.findOne({ documentId }).lean();
      } catch (e) {}
    }
    if (!doc) {
      doc = dataStore.findDocument(documentId);
    }

    if (!doc) {
      return res.status(404).json({ success: false, message: `Document ${documentId} not found.` });
    }

    const updates = {
      verificationStatus: status,
      officerRemarks: remarks || (status === 'Verified' ? 'Document verified against government repository records.' : ''),
      verifiedBy: req.user.userId,
      verifiedAt: new Date()
    };

    if (isMongoReady()) {
      try {
        await Document.updateOne({ documentId }, { $set: updates });
        await AuditLog.create({
          logId: `AUD-${Date.now()}`,
          actorId: req.user.userId,
          actorRole: req.user.role,
          action: `DOCUMENT_${status.toUpperCase()}`,
          targetEntity: 'Document',
          targetEntityId: documentId,
          details: `Officer ${req.user.userId} updated document ${documentId} to ${status}. Remarks: ${updates.officerRemarks}`,
          timestamp: new Date()
        });
      } catch (dbErr) {
        console.warn('[Documents] MongoDB update warning:', dbErr.message);
      }
    }

    const updated = dataStore.updateDocument(documentId, updates);

    // Notify Citizen Family
    dataStore.createNotification({
      notificationId: `NOTIF-${Date.now()}`,
      recipientType: 'Household',
      recipientId: doc.familyId,
      title: `Document ${status}: ${doc.title}`,
      message: `Your document '${doc.title}' (${doc.documentType}) was marked as ${status} by Officer ${req.user.officerName || req.user.userId}. Remarks: ${updates.officerRemarks}`,
      category: 'Document',
      relatedEntityId: documentId,
      isRead: false,
      createdAt: new Date()
    });

    dataStore.createAuditLog({
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: `DOCUMENT_${status.toUpperCase()}`,
      targetEntity: 'Document',
      targetEntityId: documentId,
      details: `Officer ${req.user.userId} updated document ${documentId} to ${status}. Remarks: ${updates.officerRemarks}`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: `Document ${documentId} status updated to ${status}.`,
      document: updated || { ...doc, ...updates }
    });
  } catch (err) {
    console.error('Document verification error:', err);
    res.status(500).json({ success: false, message: 'Failed to update document verification status.' });
  }
});

// Ephemeral memory storage for QR code parsing (avoid persisting raw scan images)
const qrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Strict 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Invalid QR image format. Please upload a PNG, JPEG, or WebP image.'));
    }
    cb(null, true);
  }
});

const qrCertificateParser = require('../services/qrCertificateParser');

// POST /api/documents/verify-qr - Cryptographic QR Certificate Verification
router.post('/verify-qr', requireAuth, (req, res, next) => {
  qrUpload.single('qrImage')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          authenticityStatus: 'MALFORMED_UNREADABLE',
          authenticityVerdict: 'REJECTED_OVERSIZED',
          message: 'Uploaded file exceeds the maximum permitted size of 5 MB.'
        });
      }
      return res.status(400).json({
        success: false,
        authenticityStatus: 'MALFORMED_UNREADABLE',
        authenticityVerdict: 'INVALID_FILE_TYPE',
        message: err.message
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const imageBuffer = req.file ? req.file.buffer : null;
    const rawQrText = req.body?.rawQrText || req.body?.qrText || (typeof req.body?.payload === 'string' ? req.body.payload : (req.body?.payload ? JSON.stringify(req.body.payload) : null));

    if (!imageBuffer && !rawQrText) {
      return res.status(400).json({
        success: false,
        authenticityStatus: 'MALFORMED_UNREADABLE',
        authenticityVerdict: 'MISSING_INPUT',
        message: 'No QR image or payload provided. Please attach a qrImage file or rawQrText.'
      });
    }

    const verificationResult = qrCertificateParser.verifyCertificate({
      imageBuffer,
      rawQrText
    });

    // Audit log verification event
    const logAction = verificationResult.isGenuine ? 'QR_VERIFICATION_AUTHENTIC' : 'QR_VERIFICATION_UNVERIFIED';
    const auditDetails = `QR scan by ${req.user.userId} (${req.user.role}): Verdict=${verificationResult.authenticityVerdict}, Status=${verificationResult.authenticityStatus}`;

    dataStore.createAuditLog({
      logId: `AUD-${Date.now()}`,
      actorId: req.user.userId,
      actorRole: req.user.role,
      action: logAction,
      targetEntity: 'QrCertificate',
      targetEntityId: verificationResult.sanitizedData?.maskedCertNo || 'QR-SCAN',
      details: auditDetails,
      timestamp: new Date()
    });

    if (isMongoReady()) {
      try {
        await AuditLog.create({
          logId: `AUD-${Date.now()}`,
          actorId: req.user.userId,
          actorRole: req.user.role,
          action: logAction,
          targetEntity: 'QrCertificate',
          targetEntityId: verificationResult.sanitizedData?.maskedCertNo || 'QR-SCAN',
          details: auditDetails,
          timestamp: new Date()
        });
      } catch (dbErr) {}
    }

    res.json(verificationResult);
  } catch (err) {
    console.error('QR verification endpoint error:', err);
    res.status(500).json({
      success: false,
      authenticityStatus: 'MALFORMED_UNREADABLE',
      message: err.message || 'Internal QR parsing error.'
    });
  }
});

module.exports = router;
