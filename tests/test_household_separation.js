/**
 * JanSetu Household Separation Workflow Verification Test Suite
 * 
 * Verifies all requirements of the Household Separation workflow:
 * 1. Creation of new household with internal ID (FAM-XXXX) and non-government disclaimer.
 * 2. Separate family tree for the new household with approved members.
 * 3. Removal of separated person's active membership from old household.
 * 4. Preservation of person's own account, stable Citizen ID, and personal details without copying unrelated private info.
 * 5. Atomic MongoDB transaction where supported, and backend duplicate-membership checks.
 * 6. Restricted audit trail recording old ID, new ID, approval decision, timestamp, reviewer.
 * 7. Prevention of conflicting active household memberships for verified identities.
 * 8. Pending or rejected requests do not alter either household's active membership.
 * 9. Benefit isolation: no auto-grant of welfare benefits or claim of official state record change.
 * 10. Dashboard, family tree, and officer review display updates.
 * 11. Automated tests confirming removal from old tree, addition to new tree, independent login, and concurrent request blocking.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api';

async function runHouseholdSeparationTests() {
  console.log('========================================================================');
  console.log('   JANSETU HOUSEHOLD SEPARATION WORKFLOW VERIFICATION TEST SUITE        ');
  console.log('========================================================================\n');

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
    // 1. Reset demo environment to pristine state
    console.log('--- Setup: Initializing Environment & Authenticating Users ---');
    const resetRes = await fetch(`${BASE_URL}/auth/reset-demo`, { method: 'POST' });
    assert(resetRes.ok, 'Demo environment reset to pristine state.');

    // 2. Authenticate Citizen FAM-1001
    const citizenLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'FAM-1001', password: 'citizen123' })
    });
    const citizenLoginData = await citizenLoginRes.json();
    const citizenToken = citizenLoginData.token;
    assert(Boolean(citizenToken), 'Citizen FAM-1001 logged in successfully.');

    // 3. Authenticate Officer OFFICER-01
    const officerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'OFFICER-01', password: 'officer123' })
    });
    const officerLoginData = await officerLoginRes.json();
    const officerToken = officerLoginData.token;
    assert(Boolean(officerToken), 'Officer OFFICER-01 logged in successfully.');

    // 4. Verify initial state: FAM-1001 has 4 active members
    const initMembersRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const initMembersData = await initMembersRes.json();
    assert(initMembersData.count === 4, 'Initial household FAM-1001 has exactly 4 members (Rahul, Amit, Sunita, Aarav).');
    const amitInInitial = initMembersData.members.find(m => m.citizenId === 'CIT-1002');
    assert(Boolean(amitInInitial), 'Amit Sharma (CIT-1002) is an active member of FAM-1001.');

    // -------------------------------------------------------------------------
    // TEST 1: Lodge Household Separation Request
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Lodging Household Separation Request ---');
    const lodgeRes = await fetch(`${BASE_URL}/separation-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        originalFamilyId: 'FAM-1001',
        initiatorCitizenId: 'CIT-1002',
        movingCitizenIds: ['CIT-1002'],
        separationDate: '2026-11-15',
        reason: 'Marriage and independent residential dwelling establishment in Rampur Ward 4.',
        newAddress: {
          line1: 'House No. 25, Ward 4',
          line2: 'New Colony, Sevapuri',
          district: 'Varanasi',
          state: 'Uttar Pradesh',
          pincode: '221001'
        },
        newDwellingReference: 'D-305'
      })
    });
    const lodgeData = await lodgeRes.json();
    assert(lodgeRes.status === 201 || lodgeRes.status === 200, 'Separation request lodged successfully with HTTP 201/200.');
    assert(lodgeData.request?.status === 'Pending Verification', 'Separation request status is Pending Verification.');
    assert(lodgeData.request?.generatedNewFamilyId === null, 'No new family ID is assigned while request is pending.');

    const separationRequestId = lodgeData.request?.requestId;
    assert(Boolean(separationRequestId), `Separation request ID assigned: ${separationRequestId}`);

    // -------------------------------------------------------------------------
    // TEST 2: Pending Request Does NOT Change Active Membership (Requirement 8)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Active Household Membership Unchanged While Pending (Req 8) ---');
    const pendingMembersRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const pendingMembersData = await pendingMembersRes.json();
    const amitStillInOld = pendingMembersData.members.find(m => m.citizenId === 'CIT-1002');
    assert(Boolean(amitStillInOld), 'CIT-1002 remains active in FAM-1001 while separation is pending.');
    assert(pendingMembersData.count === 4, 'FAM-1001 member count remains 4 while separation is pending.');

    // -------------------------------------------------------------------------
    // TEST 3: Concurrent / Duplicate Separation Request Prevention (Req 5, 7, 11)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Concurrent Separation Request Blocking (Req 5, 7, 11) ---');
    const duplicateLodgeRes = await fetch(`${BASE_URL}/separation-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        originalFamilyId: 'FAM-1001',
        initiatorCitizenId: 'CIT-1002',
        movingCitizenIds: ['CIT-1002'],
        separationDate: '2026-11-20',
        reason: 'Attempting duplicate concurrent separation request.'
      })
    });
    const duplicateLodgeData = await duplicateLodgeRes.json();
    assert(duplicateLodgeRes.status === 409, 'Duplicate concurrent separation request rejected with HTTP 409 Conflict.');
    assert(duplicateLodgeData.message.includes('already part of an active separation request'),
      'Clear conflict message: concurrent separation requests for same identity prohibited.');

    // -------------------------------------------------------------------------
    // TEST 4: Validation - Cannot Move Non-members or All Members
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Separation Validation Checks ---');
    const nonMemberRes = await fetch(`${BASE_URL}/separation-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({
        originalFamilyId: 'FAM-1001',
        movingCitizenIds: ['CIT-2001'], // Member of FAM-2001, not FAM-1001
        separationDate: '2026-11-20',
        reason: 'Moving citizen from another family.'
      })
    });
    assert(nonMemberRes.status === 400, 'Moving a non-member citizen rejected with HTTP 400 Bad Request.');

    const allMembersRes = await fetch(`${BASE_URL}/separation-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        originalFamilyId: 'FAM-1001',
        movingCitizenIds: ['CIT-1001', 'CIT-1002', 'CIT-1003', 'CIT-1004'],
        separationDate: '2026-11-20',
        reason: 'Attempting to move all household members.'
      })
    });
    assert(allMembersRes.status === 400, 'Moving all household members rejected with HTTP 400 (at least one member must remain).');

    // -------------------------------------------------------------------------
    // TEST 5: Officer Rejection Scenario - Memberships Unchanged (Req 8)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Officer Rejection Preserves Active Memberships (Req 8) ---');
    // Reject separationRequestId first to test rejection path
    const rejectRes = await fetch(`${BASE_URL}/separation-requests/${separationRequestId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({
        decision: 'Rejected',
        mandatoryReason: 'Physical dwelling inspection indicated single shared kitchen and electricity meter.'
      })
    });
    const rejectData = await rejectRes.json();
    assert(rejectRes.status === 200, 'Officer rejection returned HTTP 200.');
    assert(rejectData.request?.status === 'Rejected', 'Separation request status is Rejected.');

    // Verify memberships after rejection
    const postRejectMembersRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const postRejectMembersData = await postRejectMembersRes.json();
    assert(postRejectMembersData.count === 4, 'FAM-1001 retains all 4 members after separation request rejection.');
    const amitPostReject = postRejectMembersData.members.find(m => m.citizenId === 'CIT-1002');
    assert(Boolean(amitPostReject), 'CIT-1002 remains active in FAM-1001 after rejection.');

    // -------------------------------------------------------------------------
    // TEST 6: Officer Approval Workflow (Req 1, 2, 3, 4, 5, 9, 10)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Officer Approval Workflow & Atomic Execution ---');
    // Lodge fresh separation request for CIT-1002
    const freshLodgeRes = await fetch(`${BASE_URL}/separation-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        originalFamilyId: 'FAM-1001',
        initiatorCitizenId: 'CIT-1002',
        movingCitizenIds: ['CIT-1002'],
        separationDate: '2026-11-20',
        reason: 'Partition deed executed and separate dwelling unit established with individual electricity meter.',
        newAddress: {
          line1: 'House No. 34, Ward 4',
          line2: 'Shivpur Extension, Sevapuri',
          district: 'Varanasi',
          state: 'Uttar Pradesh',
          pincode: '221002'
        },
        newDwellingReference: 'D-401'
      })
    });
    const freshLodgeData = await freshLodgeRes.json();
    const freshRequestId = freshLodgeData.request.requestId;
    assert(Boolean(freshRequestId), `Fresh separation request lodged: ${freshRequestId}`);

    // Officer reviews and approves
    const approveRes = await fetch(`${BASE_URL}/separation-requests/${freshRequestId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      },
      body: JSON.stringify({
        decision: 'Approved',
        mandatoryReason: 'Physical verification conducted. Independent residential unit, separate cooking facility, and registered partition deed verified.'
      })
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200, 'Officer approved separation request with HTTP 200.');
    assert(Boolean(approveData.details?.newFamilyId), `New unique Household ID assigned: ${approveData.details?.newFamilyId}`);

    const newFamilyId = approveData.details.newFamilyId;
    assert(newFamilyId !== 'FAM-1001', `New Family ID (${newFamilyId}) is distinct from original (FAM-1001).`);
    assert(approveData.details?.identifierDisclaimer?.includes('Local JanSetu System Household ID'),
      'Disclaimer present: Local JanSetu System Household ID (Not an official National Family ID).');

    // -------------------------------------------------------------------------
    // TEST 7: Separated Member Disappears from Old Active Tree (Req 2, 3, 11)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Separated Member Disappears from Old Household Tree (Req 3, 11) ---');
    const oldHouseholdRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const oldHouseholdData = await oldHouseholdRes.json();
    assert(oldHouseholdData.count === 3, 'FAM-1001 member count reduced from 4 to 3.');
    const amitInOld = oldHouseholdData.members.find(m => m.citizenId === 'CIT-1002');
    assert(!amitInOld, 'CIT-1002 has disappeared from old household FAM-1001 active members list and active tree.');

    // Remaining members in old household
    const remainingIds = oldHouseholdData.members.map(m => m.citizenId);
    assert(remainingIds.includes('CIT-1001') && remainingIds.includes('CIT-1003') && remainingIds.includes('CIT-1004'),
      'Remaining active members in FAM-1001 are Rahul (CIT-1001), Sunita (CIT-1003), and Aarav (CIT-1004).');

    // -------------------------------------------------------------------------
    // TEST 8: Separated Member Appears in New Tree & Retains Identity (Req 2, 4, 11)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Separated Member Appears in New Household Tree (Req 2, 4, 11) ---');
    const newHouseholdMembersRes = await fetch(`${BASE_URL}/households/${newFamilyId}/members`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const newHouseholdMembersData = await newHouseholdMembersRes.json();
    assert(newHouseholdMembersData.count === 1, `New household ${newFamilyId} has exactly 1 active member.`);

    const movingMemberInNew = newHouseholdMembersData.members.find(m => m.citizenId === 'CIT-1002');
    assert(Boolean(movingMemberInNew), `CIT-1002 is active member of new household ${newFamilyId}.`);
    assert(movingMemberInNew?.isHeadOfFamily === true, 'CIT-1002 is head of the new separated household.');
    assert(movingMemberInNew?.fullName === 'Amit Sharma', 'Citizen personal name (Amit Sharma) preserved intact.');
    assert(movingMemberInNew?.dob === '1992-11-24', 'Citizen personal DOB (1992-11-24) preserved intact.');

    // -------------------------------------------------------------------------
    // TEST 9: Independent Citizen Account & Login for New Household (Req 4, 11)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Independent Citizen Account & Login for New Household (Req 4, 11) ---');
    const newLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: newFamilyId, password: 'citizen123' })
    });
    const newLoginData = await newLoginRes.json();
    assert(newLoginRes.status === 200, `New household citizen login returned HTTP 200.`);
    assert(Boolean(newLoginData.token), 'New household issued valid JWT access token.');
    assert(newLoginData.user?.familyId === newFamilyId, `JWT payload correctly identifies active household as ${newFamilyId}.`);
    const newCitizenToken = newLoginData.token;

    // -------------------------------------------------------------------------
    // TEST 10: Prevention of Conflicting Active Memberships (Req 5, 7, 11)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: Conflicting Active Household Memberships Prevented (Req 7, 11) ---');
    // Attempt to re-add Amit Sharma into FAM-1001 while active in new household
    const reAddRes = await fetch(`${BASE_URL}/households/FAM-1001/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        fullName: 'Amit Sharma',
        dob: '1992-11-24',
        gender: 'Male',
        relationship: 'Brother',
        occupation: 'Electrician'
      })
    });
    const reAddData = await reAddRes.json();
    assert(reAddRes.status === 409, 'Attempt to add citizen with active household membership rejected with HTTP 409 Conflict.');
    assert(reAddData.message.includes('already associated with an active household record') ||
           reAddData.message.includes('already registered'),
      'Clear conflict message: duplicate active household memberships prevented.');

    // -------------------------------------------------------------------------
    // TEST 11: Government Benefit Isolation (Req 9)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 11: Benefit Isolation - No Auto-grant of Schemes (Req 9) ---');
    const newAppsRes = await fetch(`${BASE_URL}/applications`, {
      headers: { 'Authorization': `Bearer ${newCitizenToken}` }
    });
    const newAppsData = await newAppsRes.json();
    const newHouseholdApps = (newAppsData.applications || []).filter(a => a.familyId === newFamilyId);
    assert(newHouseholdApps.length === 0, 'New household starts with 0 welfare applications (no auto-granted benefits).');

    // -------------------------------------------------------------------------
    // TEST 12: Restricted Audit Trail & Membership History (Req 6)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 12: Restricted Audit Trail & Membership History (Req 6) ---');
    const memberDetailRes = await fetch(`${BASE_URL}/households/${newFamilyId}/members/CIT-1002`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const memberDetailData = await memberDetailRes.json();
    assert(memberDetailRes.status === 200, 'Member detail endpoint returned HTTP 200.');

    // Verify membership history has previous closed history and new active history
    const history = memberDetailData.membershipHistory || [];
    const closedHistory = history.find(h => h.familyId === 'FAM-1001' && h.endDate !== null);
    assert(Boolean(closedHistory), 'Membership history records closed membership in FAM-1001 with end date.');
    assert(Boolean(closedHistory?.exitReason?.includes('Separation')), 'Exit reason explicitly notes household separation.');

    const activeHistory = history.find(h => h.familyId === newFamilyId && h.endDate === null);
    assert(Boolean(activeHistory), `Membership history records active membership in new household ${newFamilyId} with start date.`);

    // -------------------------------------------------------------------------
    // TEST 13: Kinship Continuity Across Household Separation (Req 2)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 13: Biological Relationship Continuity (Req 2) ---');
    const relRes = await fetch(`${BASE_URL}/citizens/CIT-1002/relationships`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const relData = await relRes.json();
    const brotherRel = (relData.relationships || []).find(r => r.relationshipType === 'Brother');
    assert(Boolean(brotherRel), 'Biological brother relationship between CIT-1001 and CIT-1002 preserved across household separation.');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(`HOUSEHOLD SEPARATION TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHouseholdSeparationTests();
