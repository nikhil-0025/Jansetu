/**
 * JanSetu Family Management & Household Separation Test Suite
 * 
 * Verifies the 5 core test scenarios required:
 * 1. Adding members with full name, DOB, relationship, and verification reference.
 * 2. Duplicate requests & conflict detection without cross-household data leakage.
 * 3. Unauthorized access prevention (cross-household protection & unauthenticated blocks).
 * 4. Pending verification & simulation labels (fictional match does NOT auto-verify).
 * 5. Member update, removal with audit history, and household separation review workflow.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('===============================================================');
  console.log('   JANSETU FAMILY MANAGEMENT & HOUSEHOLD SEPARATION TEST SUITE ');
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

  try {
    // Connect to MongoDB Atlas for setup / cleanup verification if configured
    if (process.env.MONGODB_URI) {
      try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        const { Citizen } = require('../backend/models/schemaDefinitions');
        await Citizen.deleteMany({ fullName: { $in: ['Pooja Sharma', 'Kavita Sharma'] } });
      } catch (e) {
        console.warn('MongoDB direct connection notice:', e.message);
      }
    }

    // 1. Reset demo environment to pristine state
    await fetch(`${BASE_URL}/auth/reset-demo`, {
      method: 'POST',
      headers: { 'x-reset-key': process.env.RESET_DEMO_KEY || 'jansetu-test-reset-key' }
    });

    // 2. Obtain citizen FAM-1001 authentication token
    console.log('--- Setup: Authenticating Citizen & Officer Accounts ---');
    const citizenLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'FAM-1001', password: 'citizen123' })
    });
    const citizenLoginData = await citizenLoginRes.json();
    const citizenToken = citizenLoginData.token;
    assert(Boolean(citizenToken), 'Citizen FAM-1001 authenticated successfully.');

    // Obtain officer OFFICER-01 authentication token
    const officerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'OFFICER-01', password: 'officer123' })
    });
    const officerLoginData = await officerLoginRes.json();
    const officerToken = officerLoginData.token;
    assert(Boolean(officerToken), 'Officer OFFICER-01 authenticated successfully.');

    // Obtain second citizen FAM-2001 authentication token (for cross-household testing)
    const otherCitizenLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'FAM-2001', password: 'citizen123' })
    });
    const otherCitizenLoginData = await otherCitizenLoginRes.json();
    const otherCitizenToken = otherCitizenLoginData.token;
    assert(Boolean(otherCitizenToken), 'Second Citizen FAM-2001 authenticated successfully.');

    // -------------------------------------------------------------------------
    // TEST 1: Adding a Valid Family Member
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Adding a Valid Family Member ---');
    const addMemberRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        fullName: 'Pooja Sharma',
        dob: '1996-05-15',
        gender: 'Female',
        relationship: 'Sister',
        occupation: 'Software Engineer',
        education: 'B.Tech',
        category: 'OBC',
        isFarmer: false
      })
    });

    const addMemberData = await addMemberRes.json();
    assert(addMemberRes.status === 201, 'Adding valid member returned HTTP 201 Created.');
    assert(addMemberData.success === true, 'Response indicates success = true.');
    assert(Boolean(addMemberData.member?.citizenId), `Assigned internal Citizen ID: ${addMemberData.member?.citizenId}`);
    assert(addMemberData.member?.currentFamilyId === 'FAM-1001', 'Member linked to household FAM-1001.');
    assert(addMemberData.relationship?.relationshipType === 'Sister', 'Created relationship record with type Sister.');
    assert(addMemberData.member?.verificationStatus === 'Pending Verification', 'Member status defaults to Pending Verification.');

    const newCitizenId = addMemberData.member?.citizenId;

    // -------------------------------------------------------------------------
    // TEST 2: Pending Verification Status & Synthetic Match Labels
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Pending Verification & Synthetic Match Labels ---');
    // Add member with synthetic verification reference
    const addWithCertRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        fullName: 'Kavita Sharma',
        dob: '2001-10-20',
        gender: 'Female',
        relationship: 'Daughter',
        certificateType: 'BIRTH',
        certificateId: '1259954764' // Fictional test certificate ID
      })
    });

    const addWithCertData = await addWithCertRes.json();
    if (addWithCertRes.status !== 201) {
      console.log('DEBUG Test 2 failure:', addWithCertRes.status, addWithCertData);
    }
    assert(addWithCertRes.status === 201, 'Member with verification reference added with HTTP 201.');
    // Critical: must remain Pending Verification even if reference provided!
    assert(addWithCertData.member?.verificationStatus === 'Pending Verification', 'Member remains Pending Verification (not auto-verified).');
    assert(addWithCertData.member?.verificationDetails?.isSimulated === true, 'Verification explicitly flagged as simulated.');
    assert(addWithCertData.isSimulatedVerification === true, 'Response confirms isSimulatedVerification = true.');

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate Requests & Cross-Household Conflict Detection
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Duplicate Detection & Privacy Protection ---');
    // Attempt duplicate in SAME household
    const sameHouseholdDupRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        fullName: 'Pooja Sharma',
        dob: '1996-05-15',
        gender: 'Female',
        relationship: 'Sister'
      })
    });

    const sameHouseholdDupData = await sameHouseholdDupRes.json();
    assert(sameHouseholdDupRes.status === 409, 'Duplicate in same household returned HTTP 409 Conflict.');
    assert(sameHouseholdDupData.message.includes('already registered in your household'), 'Clear error that member exists in household.');

    // Attempt duplicate in ANOTHER household (FAM-2001)
    const crossHouseholdDupRes = await fetch(`${BASE_URL}/households/FAM-2001/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${otherCitizenToken}`
      },
      body: JSON.stringify({
        fullName: 'Pooja Sharma',
        dob: '1996-05-15',
        gender: 'Female',
        relationship: 'Other Relative'
      })
    });

    const crossHouseholdDupData = await crossHouseholdDupRes.json();
    assert(crossHouseholdDupRes.status === 409, 'Duplicate cross-household returned HTTP 409 Conflict.');
    // Check that NO private data about FAM-1001 or Rahul Sharma is leaked!
    assert(
      !crossHouseholdDupData.message.includes('FAM-1001') && !crossHouseholdDupData.message.includes('Rahul'),
      'Privacy Protected: Cross-household duplicate message does NOT leak FAM-1001 or other family data.'
    );
    assert(
      crossHouseholdDupData.message.includes('already associated with an active household'),
      'Generic conflict explanation returned for privacy protection.'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Unauthorized Access Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Unauthorized Access Prevention ---');
    // Foreign citizen FAM-9999 tries to read FAM-1001 members
    const unauthGetRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      headers: { 'Authorization': `Bearer ${otherCitizenToken}` }
    });
    assert(unauthGetRes.status === 403, 'Foreign citizen reading FAM-1001 members returned HTTP 403 Forbidden.');

    // Foreign citizen FAM-9999 tries to add member to FAM-1001
    const unauthPostRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${otherCitizenToken}`
      },
      body: JSON.stringify({ fullName: 'Intruder', dob: '1990-01-01', gender: 'Male', relationship: 'Other' })
    });
    assert(unauthPostRes.status === 403, 'Foreign citizen adding member to FAM-1001 returned HTTP 403 Forbidden.');

    // Foreign citizen FAM-9999 tries to delete a member from FAM-1001
    const unauthDelRes = await fetch(`${BASE_URL}/households/FAM-1001/members/${newCitizenId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${otherCitizenToken}` }
    });
    assert(unauthDelRes.status === 403, 'Foreign citizen deleting member from FAM-1001 returned HTTP 403 Forbidden.');

    // Completely unauthenticated request (no token)
    const noTokenRes = await fetch(`${BASE_URL}/households/FAM-1001/members`);
    assert(noTokenRes.status === 401, 'Unauthenticated request with no token returned HTTP 401 Unauthorized.');

    // -------------------------------------------------------------------------
    // TEST 5: Member Details, Update & Removal with Audit Trail
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Member Details, Update, Removal & Audit Trail ---');
    // Get member details
    const getDetailRes = await fetch(`${BASE_URL}/households/FAM-1001/members/${newCitizenId}`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const getDetailData = await getDetailRes.json();
    assert(getDetailRes.status === 200, 'Member details endpoint returned HTTP 200 OK.');
    assert(getDetailData.member?.fullName === 'Pooja Sharma', 'Fetched correct member full name.');
    assert(Boolean(getDetailData.membershipHistory?.length), 'Membership history entries present.');
    assert(Boolean(getDetailData.auditTrail?.length), 'Audit trail records present for member.');

    // Update member details
    const patchRes = await fetch(`${BASE_URL}/households/FAM-1001/members/${newCitizenId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({ occupation: 'Senior Software Engineer', education: 'M.Tech' })
    });
    const patchData = await patchRes.json();
    assert(patchRes.status === 200, 'Updating member details returned HTTP 200 OK.');
    assert(patchData.member?.occupation === 'Senior Software Engineer', 'Updated occupation verified.');

    // Cannot remove household head
    const removeHeadRes = await fetch(`${BASE_URL}/households/FAM-1001/members/CIT-1001`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({ reason: 'Relocated' })
    });
    assert(removeHeadRes.status === 400, 'Attempting to remove household head returned HTTP 400 Bad Request.');

    // Remove non-head member with audit reason
    const removeMemberRes = await fetch(`${BASE_URL}/households/FAM-1001/members/${newCitizenId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({ reason: 'Relocated to Bangalore for Employment' })
    });
    const removeMemberData = await removeMemberRes.json();
    assert(removeMemberRes.status === 200, 'Member removal returned HTTP 200 OK.');
    assert(removeMemberData.success === true, 'Member successfully removed.');

    // Verify member is no longer in active household members list
    const activeMembersRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const activeMembersData = await activeMembersRes.json();
    const isStillActive = activeMembersData.members.some(m => m.citizenId === newCitizenId);
    assert(isStillActive === false, 'Removed member is no longer in active household members list.');

    // -------------------------------------------------------------------------
    // TEST 6: Household Separation Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Household Separation Workflow ---');
    // Citizen lodges separation request for Amit Sharma (CIT-1002)
    const lodgeSepRes = await fetch(`${BASE_URL}/separation-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        originalFamilyId: 'FAM-1001',
        initiatorCitizenId: 'CIT-1002',
        movingCitizenIds: ['CIT-1002'],
        separationDate: '2026-11-01',
        reason: 'Marriage and relocation to new independent residential dwelling.',
        newAddress: {
          line1: 'House No. 12, Ward 4',
          line2: 'New Colony, Sevapuri',
          district: 'Varanasi',
          state: 'Uttar Pradesh',
          pincode: '221001'
        }
      })
    });

    const lodgeSepData = await lodgeSepRes.json();
    assert(lodgeSepRes.status === 200 || lodgeSepRes.status === 201, 'Separation request lodged successfully.');
    assert(lodgeSepData.request?.status === 'Pending Verification', 'Separation request created in Pending Verification status.');
    assert(lodgeSepData.request?.generatedNewFamilyId === null, 'No new family ID granted prior to authorized officer review.');

    const requestId = lodgeSepData.request?.requestId;

    // Officer reviews and approves separation
    const officerReviewRes = await fetch(`${BASE_URL}/separation-requests/${requestId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({
        decision: 'Approved',
        mandatoryReason: 'Field inspection completed. Verified separate independent cooking and residential unit.'
      })
    });

    const officerReviewData = await officerReviewRes.json();
    assert(officerReviewRes.status === 200, 'Officer approved separation request with HTTP 200.');
    assert(Boolean(officerReviewData.details?.newFamilyId), `New unique Household ID assigned: ${officerReviewData.details?.newFamilyId}`);

    // Verify biological relationship persistence
    const newFamilyId = officerReviewData.details?.newFamilyId;
    const newHouseholdMembersRes = await fetch(`${BASE_URL}/households/${newFamilyId}/members`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const newHouseholdMembersData = await newHouseholdMembersRes.json();
    const movingMemberInNewFamily = newHouseholdMembersData.members.find(m => m.citizenId === 'CIT-1002');
    assert(Boolean(movingMemberInNewFamily), 'Citizen CIT-1002 preserved same stable Citizen ID in new household.');

    // Biological relationship between Rahul and Amit persists in global relationships
    const relRes = await fetch(`${BASE_URL}/citizens/CIT-1002/relationships`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const relData = await relRes.json();
    const brotherRel = relData.relationships?.find(r => r.relationshipType === 'Brother');
    assert(Boolean(brotherRel), 'Biological brother relationship between CIT-1001 and CIT-1002 preserved across household separation.');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
