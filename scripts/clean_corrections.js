require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const { ProfileCorrectionRequest } = require('../backend/models/schemaDefinitions');

async function cleanCorrections() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB Atlas.');

    // Delete any test requests that are not the official demonstration requests
    const deleteRes = await ProfileCorrectionRequest.deleteMany({
      requestId: { $nin: ['COR-2026-1001', 'COR-2026-1002'] }
    });
    console.log(`Removed ${deleteRes.deletedCount} temporary test requests.`);

    const samplePdfPath = path.join(__dirname, '../backend/secure_uploads/corrections/sample_supporting_doc.pdf');

    // Ensure COR-2026-1001 exists
    await ProfileCorrectionRequest.updateOne(
      { requestId: 'COR-2026-1001' },
      {
        $setOnInsert: {
          requestId: 'COR-2026-1001',
          requesterId: 'FAM-1001',
          citizenId: 'CIT-1001',
          familyId: 'FAM-1001',
          fieldToCorrect: 'fullName',
          currentValue: 'Rahul Sharma',
          requestedValue: 'Rahul Kumar Sharma',
          reason: 'Typographical omission in school matriculation certificate; adding middle name as published in State Gazette.',
          documentType: 'Matriculation / Class 10 Certificate',
          otherDocumentType: null,
          originalFilename: 'matriculation_gazette_cert.pdf',
          storedFilename: 'sample_supporting_doc.pdf',
          filePath: samplePdfPath,
          fileSize: 148200,
          mimeType: 'application/pdf',
          status: 'Pending',
          createdAt: new Date('2026-10-22T10:30:00Z'),
          updatedAt: new Date('2026-10-22T10:30:00Z')
        }
      },
      { upsert: true }
    );

    // Ensure COR-2026-1002 exists
    await ProfileCorrectionRequest.updateOne(
      { requestId: 'COR-2026-1002' },
      {
        $setOnInsert: {
          requestId: 'COR-2026-1002',
          requesterId: 'FAM-1001',
          citizenId: 'CIT-1002',
          familyId: 'FAM-1001',
          fieldToCorrect: 'occupation',
          currentValue: 'Certified Electrician',
          requestedValue: 'Certified Master Electrician',
          reason: 'Completion of National Trade Certificate from Industrial Training Institute (ITI).',
          documentType: 'Other',
          otherDocumentType: 'National Trade Certificate (NTC)',
          originalFilename: 'iti_trade_certificate.pdf',
          storedFilename: 'sample_supporting_doc.pdf',
          filePath: samplePdfPath,
          fileSize: 215400,
          mimeType: 'application/pdf',
          status: 'Approved',
          officerComment: 'Supporting NTC certificate authenticated against NCVT database. Occupation updated.',
          reviewedBy: 'OFFICER-01',
          reviewedAt: new Date('2026-10-23T11:15:00Z'),
          reviewHistory: [
            {
              decision: 'Approved',
              officerRemarks: 'Supporting NTC certificate authenticated against NCVT database. Occupation updated.',
              reviewedBy: 'OFFICER-01',
              reviewedAt: new Date('2026-10-23T11:15:00Z')
            }
          ],
          officerReview: {
            decision: 'Approved',
            officerRemarks: 'Supporting NTC certificate authenticated against NCVT database. Occupation updated.',
            reviewedBy: 'OFFICER-01',
            reviewedAt: new Date('2026-10-23T11:15:00Z')
          },
          createdAt: new Date('2026-10-21T09:00:00Z'),
          updatedAt: new Date('2026-10-23T11:15:00Z')
        }
      },
      { upsert: true }
    );

    const remaining = await ProfileCorrectionRequest.find({}).lean();
    console.log(`\nFinal Profile Correction Requests in MongoDB Atlas (${remaining.length}):`);
    remaining.forEach((r, idx) => {
      console.log(` ${idx + 1}. [${r.requestId}] Citizen: ${r.citizenId} | Field: ${r.fieldToCorrect} (${r.currentValue} -> ${r.requestedValue}) | Status: ${r.status}`);
    });

  } catch (err) {
    console.error('Error cleaning corrections:', err.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

cleanCorrections();
