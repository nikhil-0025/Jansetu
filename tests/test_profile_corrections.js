const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('=== STARTING JANSETU PROFILE CORRECTION WORKFLOW TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:5000/api';

  // Setup: Reset demo environment to pristine state
  await fetch(`${BASE_URL}/auth/reset-demo`, {
    method: 'POST',
    headers: { 'x-reset-key': process.env.RESET_DEMO_KEY || 'jansetu-test-reset-key' }
  });

  // 1. Authenticate Citizen FAM-1001
  console.log('Step 1: Authenticating Citizen (FAM-1001)...');
  const citizenLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'FAM-1001', password: 'citizen123' })
  });
  const citizenLogin = await citizenLoginRes.json();
  assert(citizenLogin.success && citizenLogin.token, 'Citizen logged in successfully and received JWT token.');
  const citizenToken = citizenLogin.token;

  // 2. Authenticate Officer OFFICER-01
  console.log('\nStep 2: Authenticating Officer (OFFICER-01)...');
  const officerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'OFFICER-01', password: 'officer123' })
  });
  const officerLogin = await officerLoginRes.json();
  assert(officerLogin.success && officerLogin.token, 'Officer logged in successfully and received JWT token.');
  const officerToken = officerLogin.token;

  // 3. Reject upload without file
  console.log('\nStep 3: Testing server rejection when supporting PDF is missing...');
  const formDataNoFile = new FormData();
  formDataNoFile.append('citizenId', 'CIT-1001');
  formDataNoFile.append('fieldToCorrect', 'fullName');
  formDataNoFile.append('requestedValue', 'Rahul Kumar Sharma');
  formDataNoFile.append('reason', 'Adding middle name as per Class 10 certificate.');
  formDataNoFile.append('documentType', 'Matriculation / Class 10 Certificate');

  const noFileRes = await fetch(`${BASE_URL}/profile-corrections`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${citizenToken}` },
    body: formDataNoFile
  });
  const noFileData = await noFileRes.json();
  assert(!noFileRes.ok && noFileRes.status === 400, 'Server correctly rejected request lacking supporting PDF file.');

  // 4. Reject invalid/fake PDF (Magic byte validation test)
  console.log('\nStep 4: Testing server rejection of fake PDF (invalid magic bytes)...');
  const fakePdfBlob = new Blob(['THIS IS NOT A REAL PDF FILE CONTENTS'], { type: 'application/pdf' });
  const fakePdfForm = new FormData();
  fakePdfForm.append('citizenId', 'CIT-1001');
  fakePdfForm.append('fieldToCorrect', 'fullName');
  fakePdfForm.append('requestedValue', 'Rahul Kumar Sharma');
  fakePdfForm.append('reason', 'Adding middle name as per Class 10 certificate.');
  fakePdfForm.append('documentType', 'Matriculation / Class 10 Certificate');
  fakePdfForm.append('supportingDocument', fakePdfBlob, 'fake.pdf');

  const fakePdfRes = await fetch(`${BASE_URL}/profile-corrections`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${citizenToken}` },
    body: fakePdfForm
  });
  const fakePdfData = await fakePdfRes.json();
  const signatureRejected = !fakePdfRes.ok && fakePdfRes.status === 400 && (fakePdfData.message.includes('authentic PDF') || fakePdfData.message.includes('genuine PDF'));
  assert(signatureRejected, `Server rejected fake PDF through magic byte signature inspection (Message: "${fakePdfData.message}").`);

  // 5. Submit valid correction request with genuine PDF
  console.log('\nStep 5: Submitting valid profile correction request with genuine PDF...');
  const currCitRes = await fetch(`${BASE_URL}/citizens/CIT-1001`, {
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  const currCitData = await currCitRes.json();
  const currentFullName = currCitData.citizen.fullName;
  const targetFullName = currentFullName.includes('Dev') ? 'Rahul Kumar Sharma' : 'Rahul Dev Sharma';

  const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Class 10 Certificate) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  const validPdfBlob = new Blob([validPdfBuffer], { type: 'application/pdf' });

  const validForm = new FormData();
  validForm.append('citizenId', 'CIT-1001');
  validForm.append('fieldToCorrect', 'fullName');
  validForm.append('requestedValue', targetFullName);
  validForm.append('reason', 'Legal name correction substantiated by matriculation gazette record.');
  validForm.append('documentType', 'Matriculation / Class 10 Certificate');
  validForm.append('supportingDocument', validPdfBlob, 'matriculation_cert.pdf');

  const submitRes = await fetch(`${BASE_URL}/profile-corrections`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${citizenToken}` },
    body: validForm
  });
  const submitData = await submitRes.json();
  if (!submitRes.ok) console.log('Step 5 error response:', submitRes.status, submitData);
  const createdRequestId = submitData.requestId || (submitData.correction && submitData.correction.requestId);
  assert(submitRes.ok && submitData.success && createdRequestId, `Correction request submitted successfully with Request ID: ${createdRequestId}`);

  // 6. Test Document Access Control: Owner citizen can access PDF
  console.log('\nStep 6: Verifying owner citizen can access document...');
  const citizenDocRes = await fetch(`${BASE_URL}/profile-corrections/${createdRequestId}/document`, {
    headers: { 'Authorization': `Bearer ${citizenToken}` }
  });
  assert(citizenDocRes.ok && citizenDocRes.headers.get('content-type') === 'application/pdf', 'Owner citizen successfully accessed supporting PDF evidence.');

  // 7. Test Document Access Control: Officer can access PDF
  console.log('\nStep 7: Verifying reviewing officer can access document...');
  const officerDocRes = await fetch(`${BASE_URL}/profile-corrections/${createdRequestId}/document`, {
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  assert(officerDocRes.ok && officerDocRes.headers.get('content-type') === 'application/pdf', 'Authorized officer successfully accessed supporting PDF evidence.');

  // 8. Test Document Access Control: Unauthenticated user rejected
  console.log('\nStep 8: Verifying unauthenticated user is denied document access...');
  const unauthDocRes = await fetch(`${BASE_URL}/profile-corrections/${createdRequestId}/document`);
  assert(!unauthDocRes.ok && unauthDocRes.status === 401, 'Unauthenticated user correctly denied document access (401).');

  // 9. Officer Review: Request Additional Evidence
  console.log('\nStep 9: Testing Officer decision: Additional Evidence Required...');
  const addEvidRes = await fetch(`${BASE_URL}/profile-corrections/${createdRequestId}/review`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${officerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      decision: 'Additional Evidence Required',
      remarks: 'Scan of Class 10 certificate is blurred. Please upload a high-resolution state board certificate.'
    })
  });
  const addEvidData = await addEvidRes.json();
  assert(addEvidRes.ok && addEvidData.success, 'Officer recorded "Additional Evidence Required" with mandatory remarks.');

  // 10. Citizen Resubmission with updated PDF
  console.log('\nStep 10: Testing Citizen Resubmission workflow with new PDF proof...');
  const newPdfBuffer = Buffer.from('%PDF-1.4\n% High Resolution State Board Gazette Document\n%%EOF');
  const newPdfBlob = new Blob([newPdfBuffer], { type: 'application/pdf' });
  const resubmitForm = new FormData();
  resubmitForm.append('reason', 'Resubmitting high resolution official state board gazette certificate.');
  resubmitForm.append('documentType', 'Matriculation / Class 10 Certificate');
  resubmitForm.append('supportingDocument', newPdfBlob, 'high_res_board_cert.pdf');

  const resubmitRes = await fetch(`${BASE_URL}/profile-corrections/${createdRequestId}/resubmit`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${citizenToken}` },
    body: resubmitForm
  });
  const resubmitData = await resubmitRes.json();
  assert(resubmitRes.ok && resubmitData.success && resubmitData.correction.status === 'Pending', 'Citizen successfully resubmitted updated PDF; status returned to Pending.');

  // 11. Ordinary citizen cannot approve/reject (Officer-only endpoint)
  console.log('\nStep 11: Testing citizen authorization restriction on officer review endpoint...');
  const citizenReviewRes = await fetch(`${BASE_URL}/profile-corrections/${createdRequestId}/review`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${citizenToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ decision: 'Approved', remarks: 'Self approval attempt' })
  });
  assert(!citizenReviewRes.ok && citizenReviewRes.status === 403, 'Citizen blocked from officer review endpoint (403 Forbidden).');

  // 12. Officer Approval and Profile Mutation
  console.log('\nStep 12: Testing Officer Approval & Profile Field Update...');
  const approveRes = await fetch(`${BASE_URL}/profile-corrections/${createdRequestId}/review`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${officerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      decision: 'Approved',
      remarks: 'High resolution certificate authenticated against Uttar Pradesh Board records. Name change approved.'
    })
  });
  const approveData = await approveRes.json();
  assert(approveRes.ok && approveData.success, 'Officer approved correction request.');

  // Verify Citizen record was updated
  const citizenCheckRes = await fetch(`${BASE_URL}/citizens/CIT-1001`, {
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  const citizenCheck = await citizenCheckRes.json();
  assert(citizenCheck.citizen && citizenCheck.citizen.fullName === targetFullName, `Citizen profile field updated correctly: fullName = '${citizenCheck.citizen.fullName}'`);

  // 13. Test Rejection preserving profile value
  console.log('\nStep 13: Testing Rejection preserving original profile value...');
  const validForm2 = new FormData();
  validForm2.append('citizenId', 'CIT-1002');
  validForm2.append('fieldToCorrect', 'occupation');
  validForm2.append('requestedValue', 'Government Engineer');
  validForm2.append('reason', 'Promotion claim');
  validForm2.append('documentType', 'Other');
  validForm2.append('otherDocumentType', 'Private Appointment Letter');
  validForm2.append('supportingDocument', validPdfBlob, 'appointment_letter.pdf');

  const submit2Res = await fetch(`${BASE_URL}/profile-corrections`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${citizenToken}` },
    body: validForm2
  });
  const submit2Data = await submit2Res.json();
  const req2Id = submit2Data.requestId;

  // Reject with mandatory remark
  const rejectRes = await fetch(`${BASE_URL}/profile-corrections/${req2Id}/review`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${officerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      decision: 'Rejected',
      remarks: 'Private appointment letter does not constitute verified government appointment.'
    })
  });
  assert(rejectRes.ok, 'Officer rejected correction request with mandatory remarks.');

  // Verify Citizen CIT-1002 occupation is preserved
  const citizen2CheckRes = await fetch(`${BASE_URL}/citizens/CIT-1002`, {
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  const citizen2Check = await citizen2CheckRes.json();
  assert(citizen2Check.citizen && citizen2Check.citizen.occupation === 'Certified Electrician', `Original profile value preserved upon rejection: occupation = '${citizen2Check.citizen.occupation}'`);

  // 14. Test "Other" document type validation without specifying custom name
  console.log('\nStep 14: Testing "Other" document type without required custom name...');
  const otherInvalidForm = new FormData();
  otherInvalidForm.append('citizenId', 'CIT-1001');
  otherInvalidForm.append('fieldToCorrect', 'education');
  otherInvalidForm.append('requestedValue', 'Graduate (B.Sc.)');
  otherInvalidForm.append('reason', 'Graduation degree completed');
  otherInvalidForm.append('documentType', 'Other');
  // intentionally omitting otherDocumentType
  otherInvalidForm.append('supportingDocument', validPdfBlob, 'degree.pdf');

  const otherInvalidRes = await fetch(`${BASE_URL}/profile-corrections`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${citizenToken}` },
    body: otherInvalidForm
  });
  const otherInvalidData = await otherInvalidRes.json();
  assert(!otherInvalidRes.ok && otherInvalidRes.status === 400 && otherInvalidData.message.includes('Specify Document Type'), 'Server required custom document name when documentType is "Other".');

  // 15. Test Direct edits to sensitive/unauthorized fields
  console.log('\nStep 15: Testing rejection of sensitive/system fields (e.g. role, citizenId, familyId)...');
  const sensitiveForm = new FormData();
  sensitiveForm.append('citizenId', 'CIT-1001');
  sensitiveForm.append('fieldToCorrect', 'role');
  sensitiveForm.append('requestedValue', 'admin');
  sensitiveForm.append('reason', 'Elevation attempt');
  sensitiveForm.append('documentType', 'Aadhaar Card');
  sensitiveForm.append('supportingDocument', validPdfBlob, 'aadhaar.pdf');

  const sensitiveRes = await fetch(`${BASE_URL}/profile-corrections`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${citizenToken}` },
    body: sensitiveForm
  });
  const sensitiveData = await sensitiveRes.json();
  assert(!sensitiveRes.ok && sensitiveRes.status === 400 && sensitiveData.message.includes('cannot be directly corrected'), 'Server disallowed tampering with sensitive/system fields.');

  // 16. Test Oversized file (> 5 MB) rejection
  console.log('\nStep 16: Testing rejection of oversized files (> 5 MB)...');
  const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0x41); // 5.5 MB
  // Put PDF magic bytes at the start
  largeBuffer.write('%PDF-1.4\n', 0);
  const largeBlob = new Blob([largeBuffer], { type: 'application/pdf' });

  const largeForm = new FormData();
  largeForm.append('citizenId', 'CIT-1001');
  largeForm.append('fieldToCorrect', 'education');
  largeForm.append('requestedValue', 'Post Graduate');
  largeForm.append('reason', 'Degree completion');
  largeForm.append('documentType', 'Matriculation / Class 10 Certificate');
  largeForm.append('supportingDocument', largeBlob, 'oversized.pdf');

  const largeRes = await fetch(`${BASE_URL}/profile-corrections`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${citizenToken}` },
    body: largeForm
  });
  assert(!largeRes.ok && (largeRes.status === 400 || largeRes.status === 413), 'Server rejected oversized file exceeding 5 MB limit.');

  // Clean up temporary test records so the database only preserves 2 clean demonstration examples
  try {
    const mongoose = require('mongoose');
    require('dotenv').config();
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      const { ProfileCorrectionRequest, Citizen } = require('../backend/models/schemaDefinitions');
      if (typeof createdRequestId !== 'undefined' && createdRequestId) {
        await ProfileCorrectionRequest.deleteOne({ requestId: createdRequestId });
      }
      if (typeof req2Id !== 'undefined' && req2Id) {
        await ProfileCorrectionRequest.deleteOne({ requestId: req2Id });
      }
      await Citizen.updateOne({ citizenId: 'CIT-1001' }, { $set: { fullName: 'Rahul Sharma' } });
      await mongoose.disconnect().catch(() => {});
    }
  } catch (cleanErr) {
    // Non-fatal cleanup
  }

  console.log(`\n=======================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
