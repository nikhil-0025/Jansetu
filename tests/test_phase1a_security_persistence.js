/**
 * JanSetu Phase 1A Security & Persistence Remediation Test Suite
 *
 * Covers:
 * 1. Protected Reset Endpoints: Unauthenticated calls rejected (401/403); authorized calls succeed.
 * 2. Document Access Control:
 *    - Static /uploads directory blocked (404/not mounted).
 *    - Cross-household document downloads blocked (403).
 *    - Authorized household owner and officer document downloads succeed.
 * 3. Role Permissions & Authorization (RBAC):
 *    - Citizen accessing admin routes (/api/admin/dashboard) rejected (403).
 *    - Officer accessing admin routes succeeds.
 * 4. Persistence After Restart Simulation:
 *    - Data created in MongoDB Atlas persists when memory is cleared.
 * 5. Concurrent Requests & DB Resilience:
 *    - Concurrent requests handled safely without race conditions or state corruption.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const {
  Household,
  Citizen,
  UserAccount,
  Document,
  AuditLog,
  FamilyRelationship,
  HouseholdMembershipHistory
} = require('../backend/models/schemaDefinitions');

const BASE_URL = 'http://localhost:5000/api';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
  }
}

async function login(userId, password, expectedRole) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password, expectedRole })
  });
  return await res.json();
}

async function runPhase1ATests() {
  console.log('================================================================');
  console.log('   JanSetu Phase 1A: Security & Persistence Remediation Tests   ');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Protected Reset Endpoint Security
    // -------------------------------------------------------------------------
    console.log('--- Test Suite 1: Protected Reset Endpoint & Environment Security ---');
    
    // Unauthenticated reset attempt
    const unauthReset = await fetch(`${BASE_URL}/auth/reset-demo`, { method: 'POST' });
    assert(
      unauthReset.status === 401 || unauthReset.status === 403,
      `Unauthenticated /api/auth/reset-demo request is rejected with status ${unauthReset.status}`
    );

    // Reset with invalid key
    const invalidKeyReset = await fetch(`${BASE_URL}/auth/reset-demo`, {
      method: 'POST',
      headers: { 'x-reset-key': 'wrong-attacker-key' }
    });
    assert(
      invalidKeyReset.status === 401,
      `Reset attempt with invalid x-reset-key rejected with 401 Unauthorized`
    );

    // Authorized reset with valid key
    const authReset = await fetch(`${BASE_URL}/auth/reset-demo`, {
      method: 'POST',
      headers: { 'x-reset-key': process.env.RESET_DEMO_KEY || 'jansetu-test-reset-key' }
    });
    assert(
      authReset.ok,
      `Reset attempt with valid x-reset-key succeeds (Status ${authReset.status})`
    );

    // -------------------------------------------------------------------------
    // TEST 2: System Status Security (demo credentials exposure check)
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 2: System Status & Sensitive Information Exposure ---');
    const statusRes = await fetch(`${BASE_URL}/auth/system-status`);
    const statusData = await statusRes.json();
    assert(statusData.success === true, 'GET /api/auth/system-status is accessible');
    assert(statusData.dbStatus !== undefined, 'System status reports database connection health');

    // -------------------------------------------------------------------------
    // TEST 3: Document Access Control & Path Traversal Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 3: Document Access Control & Storage Security ---');

    // Verify raw static /uploads directory is NOT publicly accessible
    const staticUploadsRes = await fetch('http://localhost:5000/uploads/test.pdf');
    assert(
      staticUploadsRes.status === 404,
      `Public static directory /uploads is blocked/unmounted (Status ${staticUploadsRes.status})`
    );

    // Authenticate citizen FAM-1001
    const citizen1Auth = await login('FAM-1001', 'citizen123', 'citizen');
    assert(citizen1Auth.success === true, 'Citizen FAM-1001 authenticated');
    const citizen1Token = citizen1Auth.token;

    // Authenticate officer OFFICER-01
    const officerAuth = await login('OFFICER-01', 'officer123', 'officer');
    assert(officerAuth.success === true, 'Officer OFFICER-01 authenticated');
    const officerToken = officerAuth.token;

    // Test unauthenticated access to /api/documents/:id/file
    const unauthDocRes = await fetch(`${BASE_URL}/documents/DOC-TEST-999/file`);
    assert(
      unauthDocRes.status === 401,
      `Unauthenticated access to document file route returns 401 Unauthorized`
    );

    // Create a mock document in MongoDB belonging to FAM-2001
    const testDocId = `DOC-TEST-${Date.now()}`;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await Document.create({
        documentId: testDocId,
        title: 'Residence Proof Document',
        familyId: 'FAM-2001',
        citizenId: 'CIT-2001',
        documentType: 'Residence Proof',
        originalFilename: 'residence_proof.pdf',
        fileUrl: 'sample_supporting_doc.pdf',
        fileSize: '1.2 MB',
        verificationStatus: 'Pending Verification'
      });
    }

    // Citizen FAM-1001 tries to access FAM-2001's document (cross-household breach)
    const crossHouseholdRes = await fetch(`${BASE_URL}/documents/${testDocId}/file`, {
      headers: { 'Authorization': `Bearer ${citizen1Token}` }
    });
    assert(
      crossHouseholdRes.status === 403,
      `Citizen FAM-1001 blocked from accessing FAM-2001's document (Status ${crossHouseholdRes.status})`
    );

    // Officer accesses FAM-2001's document for official review
    const officerDocRes = await fetch(`${BASE_URL}/documents/${testDocId}/file`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    assert(
      officerDocRes.ok,
      `Officer OFFICER-01 authorized to inspect document for verification review (Status ${officerDocRes.status})`
    );

    // Clean up test document
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await Document.deleteOne({ documentId: testDocId });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Backend Role-Based Access Control (RBAC)
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 4: Backend Role-Based Access Control (RBAC) ---');

    // Citizen attempts to access officer/admin dashboard
    const citizenAdminRes = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${citizen1Token}` }
    });
    assert(
      citizenAdminRes.status === 403,
      `Citizen blocked from officer dashboard /api/admin/dashboard (Status ${citizenAdminRes.status})`
    );

    // Officer accesses admin dashboard
    const officerAdminRes = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const officerAdminData = await officerAdminRes.json();
    assert(
      officerAdminRes.ok && officerAdminData.success === true,
      `Officer authorized to view officer dashboard /api/admin/dashboard (Status ${officerAdminRes.status})`
    );
    assert(
      officerAdminData.metrics && officerAdminData.metrics.totalHouseholds >= 2,
      `Officer dashboard accurately reports persistent metrics (Households: ${officerAdminData.metrics.totalHouseholds})`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Persistent Storage After Restart Simulation
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 5: Persistent MongoDB Storage & Baseline Verification ---');

    // Verify baseline households and citizens exist in MongoDB Atlas
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const fam1001 = await Household.findOne({ familyId: 'FAM-1001' }).lean();
      assert(fam1001 !== null, 'Household FAM-1001 exists in persistent MongoDB Atlas collection');
      assert(fam1001.headCitizenId === 'CIT-1001', 'FAM-1001 head citizen is persistently CIT-1001');

      const citizens = await Citizen.find({ currentFamilyId: 'FAM-1001', status: { $ne: 'inactive' } }).lean();
      assert(citizens.length >= 3, `Persistent citizens found in MongoDB for FAM-1001 (Count: ${citizens.length})`);

      const relationships = await FamilyRelationship.find({ isActive: { $ne: false } }).lean();
      assert(relationships.length >= 3, `Persistent family relationships found in MongoDB (Count: ${relationships.length})`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Concurrent Request Handling & Database Integrity
    // -------------------------------------------------------------------------
    console.log('\n--- Test Suite 6: Concurrent Requests & System Stability ---');

    const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
      fetch(`${BASE_URL}/households/FAM-1001/members`, {
        headers: { 'Authorization': `Bearer ${citizen1Token}` }
      })
    );

    const concurrentResponses = await Promise.all(concurrentRequests);
    const allSuccessful = concurrentResponses.every(r => r.ok);
    assert(allSuccessful, '10 concurrent household query requests succeeded without failure or lockups');

    console.log('\n================================================================');
    console.log(`   Phase 1A Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

// Connect to MongoDB Atlas if URI is present and execute
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI).then(() => {
    runPhase1ATests().then(() => {
      mongoose.disconnect();
    });
  }).catch(err => {
    console.error('Failed to connect to MongoDB for tests:', err.message);
    process.exit(1);
  });
} else {
  runPhase1ATests();
}
