/**
 * JanSetu Synthetic Verification & Signup Integration Test Suite
 * 
 * Tests the 9 required verification and security specifications:
 * 1. Matching record and certificate reference
 * 2. Wrong name, date of birth or reference
 * 3. Wrong certificate type
 * 4. Expired certificate
 * 5. Review-required certificate
 * 6. Duplicate signup
 * 7. MongoDB unavailable
 * 8. Pending account accessing protected routes
 * 9. Unauthorized officer approval (and successful authorized approval)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'jansetu_super_secure_jwt_secret_key_2026_techtrix';

async function runTests() {
  console.log('===============================================================');
  console.log('   JANSETU SYNTHETIC VERIFICATION & SIGNUP TEST SUITE         ');
  console.log('===============================================================\n');

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

  let createdPendingUser1 = null;
  let createdPendingUser2 = null;

  try {
    // Connect to MongoDB Atlas for setup / cleanup verification
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✓ Connected to MongoDB Atlas test environment.\n');

    // Clean up any previous test accounts from MongoDB to ensure clean run
    const { UserAccount, Household, Citizen, AuditLog } = require('../backend/models/schemaDefinitions');
    await UserAccount.deleteMany({
      'verificationDetails.certificateId': { $in: ['1259954764', '6900642755'] }
    });
    await fetch(`${BASE_URL}/auth/reset-demo`, { method: 'POST' });

    // -------------------------------------------------------------------------
    // TEST 1: Matching record and certificate reference (Valid)
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Matching record & certificate reference (Valid) ---');
    const validSignupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Vivaan Pandey',
        dateOfBirth: '1983-08-14',
        certificateType: 'BIRTH',
        certificateId: '1259954764',
        password: 'password123',
        mobile: '9991089594',
        email: 'citizen002@example.test'
      })
    });

    const validSignupData = await validSignupRes.json();
    assert(validSignupRes.status === 201, 'Valid signup returned HTTP 201 Created.');
    assert(validSignupData.success === true, 'Response indicates success = true.');
    assert(validSignupData.accountStatus === 'pending', 'Account was created in PENDING status.');
    assert(validSignupData.isSimulated === true, 'Response explicitly flags verification as simulated.');
    assert(validSignupData.certificateId === '1259954764', 'Certificate reference preserved in response.');
    createdPendingUser1 = validSignupData.userId;
    console.log(`Created Pending User: ${createdPendingUser1}\n`);

    // -------------------------------------------------------------------------
    // TEST 2: Wrong name, date of birth or reference (Mismatches)
    // -------------------------------------------------------------------------
    console.log('--- Test 2: Identity & Reference Mismatches ---');
    // 2a. Wrong Name (Aditya Saxena record with wrong name)
    const wrongNameRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Rahul Saxena', // Real record has Aditya Saxena
        dateOfBirth: '2007-05-11',
        certificateType: 'DISABILITY',
        certificateId: '3408272744',
        password: 'password123'
      })
    });
    const wrongNameData = await wrongNameRes.json();
    assert(wrongNameRes.status === 400, 'Server rejected wrong name with HTTP 400.');
    assert(
      !wrongNameData.message.includes('Aditya'),
      'Generic error message preserves privacy without leaking genuine name.'
    );

    // 2b. Wrong Date of Birth
    const wrongDobRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Aditya Saxena',
        dateOfBirth: '1995-01-01', // Real record has 2007-05-11
        certificateType: 'DISABILITY',
        certificateId: '3408272744',
        password: 'password123'
      })
    });
    assert(wrongDobRes.status === 400, 'Server rejected wrong Date of Birth with HTTP 400.');

    // 2c. Non-existent certificate reference
    const nonExistentRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Aditya Saxena',
        dateOfBirth: '2007-05-11',
        certificateType: 'DISABILITY',
        certificateId: '9999999999', // Non-existent
        password: 'password123'
      })
    });
    assert(nonExistentRes.status === 400, 'Server rejected non-existent certificate reference with HTTP 400.');
    console.log('');

    // -------------------------------------------------------------------------
    // TEST 3: Wrong certificate type
    // -------------------------------------------------------------------------
    console.log('--- Test 3: Wrong Certificate Type ---');
    const wrongTypeRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Aditya Saxena',
        dateOfBirth: '2007-05-11',
        certificateType: 'BIRTH', // Record 3408272744 is a DISABILITY certificate
        certificateId: '3408272744',
        password: 'password123'
      })
    });
    const wrongTypeData = await wrongTypeRes.json();
    assert(wrongTypeRes.status === 400, 'Server rejected mismatched certificate type with HTTP 400.');
    assert(wrongTypeData.status === 'TYPE_MISMATCH', 'Status correctly identified as TYPE_MISMATCH.');
    console.log('');

    // -------------------------------------------------------------------------
    // TEST 4: Expired certificate
    // -------------------------------------------------------------------------
    console.log('--- Test 4: Expired Certificate ---');
    const expiredRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Aarav Sharma',
        dateOfBirth: '1983-12-03',
        certificateType: 'BIRTH',
        certificateId: '5668213469', // Status in dataset is EXPIRED
        password: 'password123'
      })
    });
    const expiredData = await expiredRes.json();
    assert(expiredRes.status === 400, 'Server rejected expired certificate with HTTP 400.');
    assert(expiredData.status === 'EXPIRED', 'Response status is EXPIRED.');
    assert(expiredData.message.toLowerCase().includes('expired'), 'Error message clearly explains certificate has expired.');
    console.log('');

    // -------------------------------------------------------------------------
    // TEST 5: Review-required certificate
    // -------------------------------------------------------------------------
    console.log('--- Test 5: Review-Required Certificate ---');
    const reviewRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Krishna Kaur',
        dateOfBirth: '2005-09-22',
        certificateType: 'INCOME',
        certificateId: '6900642755', // Status in dataset is REVIEW_REQUIRED
        password: 'password123'
      })
    });
    const reviewData = await reviewRes.json();
    assert(reviewRes.status === 201, 'Review-required certificate accepted for pending registration (HTTP 201).');
    assert(reviewData.accountStatus === 'pending', 'Account marked pending.');
    assert(reviewData.requiresManualReview === true, 'Flagged requiresManualReview = true.');
    assert(reviewData.verificationStatus === 'review_required', 'Verification status marked as review_required.');
    createdPendingUser2 = reviewData.userId;
    console.log(`Created Review-Required Pending User: ${createdPendingUser2}\n`);

    // -------------------------------------------------------------------------
    // TEST 6: Duplicate signup
    // -------------------------------------------------------------------------
    console.log('--- Test 6: Duplicate Signup Prevention ---');
    const duplicateRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Vivaan Pandey',
        dateOfBirth: '1983-08-14',
        certificateType: 'BIRTH',
        certificateId: '1259954764', // Already registered in Test 1
        password: 'password123'
      })
    });
    const duplicateData = await duplicateRes.json();
    assert(duplicateRes.status === 409, 'Server prevented duplicate registration with HTTP 409 Conflict.');
    assert(duplicateData.message.toLowerCase().includes('already registered'), 'Duplicate message is clear and unambiguous.');
    console.log('');

    // -------------------------------------------------------------------------
    // TEST 7: MongoDB unavailable
    // -------------------------------------------------------------------------
    console.log('--- Test 7: MongoDB Unavailable Handling ---');
    const { verifyCertificate } = require('../backend/services/identityVerificationService');
    // Temporarily disconnect to verify error handling without false success
    await mongoose.disconnect();
    
    let caughtDbError = false;
    try {
      await verifyCertificate({
        fullName: 'Vivaan Pandey',
        dateOfBirth: '1983-08-14',
        certificateType: 'BIRTH',
        certificateId: '1259954764'
      });
    } catch (dbErr) {
      caughtDbError = true;
      assert(dbErr.code === 'DB_UNAVAILABLE' || dbErr.status === 503, 'Service threw DB_UNAVAILABLE (503) error when Mongo is offline.');
    }
    assert(caughtDbError, 'Service safely rejected verification rather than falsely reporting success.');

    // Reconnect for remaining tests
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('');

    // -------------------------------------------------------------------------
    // TEST 8: Pending account accessing protected routes
    // -------------------------------------------------------------------------
    console.log('--- Test 8: Pending Account Blocked from Protected Routes ---');
    // 8a. Login attempt by pending user
    const pendingLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: createdPendingUser1,
        password: 'password123'
      })
    });
    const pendingLoginData = await pendingLoginRes.json();
    assert(pendingLoginRes.status === 403, 'Pending user blocked from logging in (HTTP 403 Forbidden).');
    assert(pendingLoginData.accountStatus === 'pending', 'Response states account is pending verification.');

    // 8b. Token with status 'pending' presented to protected endpoint
    const pendingToken = jwt.sign(
      { userId: createdPendingUser1, role: 'citizen', status: 'pending', familyId: createdPendingUser1 },
      JWT_SECRET
    );
    const protectedRes = await fetch(`${BASE_URL}/documents`, {
      headers: { 'Authorization': `Bearer ${pendingToken}` }
    });
    assert(protectedRes.status === 403, 'Protected citizen service blocked pending token with HTTP 403.');
    console.log('');

    // -------------------------------------------------------------------------
    // TEST 9: Unauthorized officer approval & Authorized approval flow
    // -------------------------------------------------------------------------
    console.log('--- Test 9: Officer Authorization & Approval Workflow ---');
    // 9a. Unauthorized: No token
    const unauthRes = await fetch(`${BASE_URL}/admin/pending-registrations/${createdPendingUser1}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approve', remarks: 'Trying to approve without token' })
    });
    assert(unauthRes.status === 401, 'Unauthenticated approval attempt rejected with HTTP 401.');

    // 9b. Unauthorized: Citizen token (FAM-1001)
    const citizenToken = jwt.sign(
      { userId: 'FAM-1001', role: 'citizen', familyId: 'FAM-1001' },
      JWT_SECRET
    );
    const citizenApprovalRes = await fetch(`${BASE_URL}/admin/pending-registrations/${createdPendingUser1}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({ decision: 'approve', remarks: 'Citizen trying to approve own/other signup' })
    });
    assert(citizenApprovalRes.status === 403, 'Citizen role blocked from officer approval endpoint with HTTP 403 Forbidden.');

    // 9c. Authorized: Officer token (OFFICER-01)
    const officerToken = jwt.sign(
      { userId: 'OFFICER-01', role: 'officer', officerName: 'Vikramaditya Verma' },
      JWT_SECRET
    );

    // List pending registrations as officer
    const listPendingRes = await fetch(`${BASE_URL}/admin/pending-registrations`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const listPendingData = await listPendingRes.json();
    assert(listPendingRes.status === 200, 'Officer successfully retrieved pending registrations list.');
    assert(listPendingData.registrations.some(r => r.userId === createdPendingUser1), 'Newly registered pending user found in officer queue.');

    // Approve the pending account
    const approveRes = await fetch(`${BASE_URL}/admin/pending-registrations/${createdPendingUser1}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({ decision: 'approve', remarks: 'Verified against synthetic test records in Block Office.' })
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200, 'Officer successfully approved pending citizen registration.');
    assert(approveData.status === 'active', 'User account status updated to ACTIVE.');

    // Verify user can now log in after officer approval!
    const activeLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: createdPendingUser1,
        password: 'password123'
      })
    });
    const activeLoginData = await activeLoginRes.json();
    assert(activeLoginRes.status === 200, 'Approved citizen successfully signed in (HTTP 200).');
    assert(Boolean(activeLoginData.token), 'Citizen received valid JWT token upon signing in.');
    console.log('');

  } finally {
    // Clean up temporary test accounts created during test
    try {
      const { UserAccount, Household, Citizen, AuditLog } = require('../backend/models/schemaDefinitions');
      if (createdPendingUser1) {
        await UserAccount.deleteOne({ userId: createdPendingUser1 });
        await Household.deleteOne({ familyId: createdPendingUser1 });
        await Citizen.deleteMany({ currentFamilyId: createdPendingUser1 });
      }
      if (createdPendingUser2) {
        await UserAccount.deleteOne({ userId: createdPendingUser2 });
        await Household.deleteOne({ familyId: createdPendingUser2 });
        await Citizen.deleteMany({ currentFamilyId: createdPendingUser2 });
      }
      await mongoose.disconnect().catch(() => {});
      console.log('✓ Cleaned up temporary test registrations from database.\n');
    } catch (e) {}
  }

  console.log('===============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
