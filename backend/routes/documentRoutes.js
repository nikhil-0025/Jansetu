const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dataStore = require('../models/dataStore');
const { requireAuth, requireRole } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    cb(null, safeName);
  }
});

// File filter (PDF, JPG, PNG)
const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, and PNG documents are supported.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET /api/documents - Fetch documents
router.get('/', requireAuth, (req, res) => {
  const { familyId, citizenId } = req.query;

  // Officers can see all, citizens only their own
  const targetFamilyId = req.user.role === 'citizen' ? req.user.familyId : (familyId || null);
  const docs = dataStore.getDocuments(targetFamilyId, citizenId || null);

  // Enrich with citizen name if individual doc
  const enriched = docs.map(d => {
    let citizenName = null;
    if (d.citizenId) {
      const c = dataStore.findCitizen(d.citizenId);
      citizenName = c ? c.fullName : d.citizenId;
    }
    return {
      ...d,
      citizenName
    };
  });

  res.json({
    success: true,
    documents: enriched
  });
});

// POST /api/documents - Upload / Register new document
router.post('/', requireAuth, upload.single('file'), (req, res) => {
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
    const fileSize = req.file ? `${(req.file.size / (1024 * 1024)).toFixed(2)} MB` : '1.20 MB';
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : '/uploads/sample_verified_doc.pdf';

    const newDoc = {
      documentId: docId,
      title,
      documentType,
      scope: scope || 'Individual',
      familyId,
      citizenId: scope === 'Individual' ? (citizenId || null) : null,
      fileUrl,
      originalFilename,
      fileSize,
      issuingAuthority: issuingAuthority || 'Authorized Competent Authority',
      maskedReferenceNo: maskedRef,
      verificationStatus: 'Pending Verification',
      officerRemarks: null,
      verifiedBy: null,
      verifiedAt: null,
      uploadedAt: new Date()
    };

    dataStore.createDocument(newDoc);

    // Create Audit Log
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

// PATCH /api/documents/:documentId/verification - Officer verifies or rejects document (Scenario D)
router.patch('/:documentId/verification', requireAuth, requireRole(['officer', 'admin']), (req, res) => {
  const { documentId } = req.params;
  const { status, remarks } = req.body;

  if (!['Verified', 'Rejected', 'Pending Verification'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid verification status.' });
  }

  if (status === 'Rejected' && !remarks) {
    return res.status(400).json({ success: false, message: 'A rejection remark/reason is mandatory.' });
  }

  const doc = dataStore.findDocument(documentId);
  if (!doc) {
    return res.status(404).json({ success: false, message: `Document ${documentId} not found.` });
  }

  const updated = dataStore.updateDocument(documentId, {
    verificationStatus: status,
    officerRemarks: remarks || (status === 'Verified' ? 'Document verified against government repository records.' : ''),
    verifiedBy: req.user.userId,
    verifiedAt: new Date()
  });

  // Notify Citizen Family
  dataStore.createNotification({
    notificationId: `NOTIF-${Date.now()}`,
    recipientType: 'Household',
    recipientId: doc.familyId,
    title: `Document ${status}: ${doc.title}`,
    message: `Your document '${doc.title}' (${doc.documentType}) was marked as ${status} by Officer ${req.user.officerName || req.user.userId}. Remarks: ${updated.officerRemarks}`,
    category: 'Document',
    relatedEntityId: documentId,
    isRead: false,
    createdAt: new Date()
  });

  // Create Audit Log
  dataStore.createAuditLog({
    logId: `AUD-${Date.now()}`,
    actorId: req.user.userId,
    actorRole: req.user.role,
    action: `DOCUMENT_${status.toUpperCase()}`,
    targetEntity: 'Document',
    targetEntityId: documentId,
    details: `Officer ${req.user.userId} updated document ${documentId} to ${status}. Remarks: ${updated.officerRemarks}`,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: `Document ${documentId} status updated to ${status}.`,
    document: updated
  });
});

module.exports = router;
