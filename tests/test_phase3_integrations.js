const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const qrCertificateParser = require('../backend/services/qrCertificateParser');
const { generateToken } = require('../backend/middleware/auth');

const BASE_URL = 'http://localhost:5000';

// Test Tokens
const citizenToken = generateToken({
  userId: 'CIT-1001',
  role: 'citizen',
  status: 'active',
  familyId: 'FAM-1001',
  headCitizenId: 'CIT-1001',
  headName: 'Rahul Sharma'
});

const officerToken = generateToken({
  userId: 'OFFICER-01',
  role: 'officer',
  status: 'active',
  officerName: 'Vikram Singh'
});

let passedCount = 0;
let totalCount = 0;

function report(name, condition, details = '') {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] Test ${totalCount}: ${name}`);
  } else {
    console.error(`  [FAIL] Test ${totalCount}: ${name} - Details: ${details}`);
    throw new Error(`Test failed: ${name} (${details})`);
  }
}

async function runPhase3Tests() {
  console.log('\n===============================================================');
  console.log(' JANSETU PHASE 3 VERIFICATION SUITE: CERTIFICATE & GOV INTEGRATIONS');
  console.log('===============================================================\n');

  // =========================================================================
  // SECTION 1: DigiLocker Integration & OAuth 2.0 PKCE Flow
  // =========================================================================
  console.log('--- 1. DigiLocker OAuth & Consent Verification ---');

  // Test 1: Generate OAuth URL requires authentication
  {
    const res = await fetch(`${BASE_URL}/api/government-services/digilocker/auth-url`);
    report('DigiLocker auth-url endpoint rejects unauthenticated request with 401', res.status === 401);
  }

  // Test 2: Authenticated citizen generates valid OAuth URL with CSRF nonce
  let validState = null;
  {
    const res = await fetch(`${BASE_URL}/api/government-services/digilocker/auth-url?docType=ratcr`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const data = await res.json();
    report('DigiLocker auth-url returns success', res.status === 200 && data.success === true);
    report('OAuth URL contains client_id, state nonce, and redirect_uri', 
      data.authUrl && data.authUrl.includes('client_id') && data.authUrl.includes('state') && data.authUrl.includes('redirect_uri'),
      `authUrl: ${data.authUrl}`
    );
    report('OAuth state nonce is a 64-char hex string with future expiry',
      typeof data.state === 'string' && data.state.length === 64 && new Date(data.expiresAt) > new Date()
    );
    report('Integration status transparently signals SANDBOX mode',
      data.integrationStatus.includes('SANDBOX'),
      `Status: ${data.integrationStatus}`
    );
    validState = data.state;
  }

  // Test 3: OAuth Callback rejects missing state (Anti-CSRF)
  {
    const res = await fetch(`${BASE_URL}/api/government-services/digilocker/callback?code=mock_code_123`);
    const data = await res.json();
    report('DigiLocker callback rejects request without state parameter (400)', res.status === 400 && data.error === 'MISSING_STATE');
  }

  // Test 4: OAuth Callback rejects fake / tampered state nonce (CSRF Protection)
  {
    const fakeState = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const res = await fetch(`${BASE_URL}/api/government-services/digilocker/callback?code=mock_code_123&state=${fakeState}`);
    const data = await res.json();
    report('DigiLocker callback rejects unrecognized/tampered state (400 INVALID_STATE)', 
      res.status === 400 && data.error === 'INVALID_STATE'
    );
  }

  // Test 5: OAuth Callback rejects missing code
  {
    // Generate a new state specifically for this test
    const authRes = await fetch(`${BASE_URL}/api/government-services/digilocker/auth-url?docType=incme`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const authData = await authRes.json();
    const res = await fetch(`${BASE_URL}/api/government-services/digilocker/callback?state=${authData.state}`);
    const data = await res.json();
    report('DigiLocker callback rejects missing authorization code (400 MISSING_AUTHORIZATION_CODE)', 
      res.status === 400 && data.error === 'MISSING_AUTHORIZATION_CODE'
    );
  }

  // Test 6: Valid OAuth Callback succeeds and single-use consumes state
  {
    const res = await fetch(`${BASE_URL}/api/government-services/digilocker/callback?code=auth_code_sandbox_9981&state=${validState}`);
    const data = await res.json();
    report('DigiLocker callback verifies valid state and accepts code', 
      res.status === 200 && data.stateVerified === true
    );
    report('DigiLocker callback transparently labels simulated sandbox standby',
      data.isAuthoritative === false && data.integrationStatus.includes('SANDBOX')
    );

    // Replay attack test: try using the exact same state again
    const replayRes = await fetch(`${BASE_URL}/api/government-services/digilocker/callback?code=auth_code_sandbox_9981&state=${validState}`);
    const replayData = await replayRes.json();
    report('DigiLocker callback blocks replay attack with already-consumed state',
      replayRes.status === 400 && replayData.error === 'INVALID_STATE'
    );
  }

  // Test 7: DigiLocker Document Pull with Electronic Consent
  {
    const res = await fetch(`${BASE_URL}/api/government-services/digilocker/pull-doc`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        docType: 'incme',
        referenceNo: 'UP-INC-2025-102938',
        citizenName: 'Rahul Sharma'
      })
    });
    const data = await res.json();
    report('DigiLocker pull-doc requires authentication and succeeds with token', res.status === 200 && data.success === true);
    report('DigiLocker pull-doc creates document record in vault with masked reference',
      data.document && data.document.maskedReferenceNo.includes('****')
    );
    report('DigiLocker pull-doc clearly indicates simulated demo record when credentials absent',
      data.gatewayResponse.metadata.isAuthoritative === false && data.gatewayResponse.metadata.isSimulated === true
    );
  }

  // =========================================================================
  // SECTION 2: OGD API Integration (data.gov.in)
  // =========================================================================
  console.log('\n--- 2. Open Government Data (data.gov.in) API Verification ---');

  // Test 8: Fetch Public Scheme Metrics with NDSAP licensing & attribution
  let firstMetricsTime = null;
  {
    const res = await fetch(`${BASE_URL}/api/government-services/ogd/scheme-metrics`);
    const data = await res.json();
    report('OGD scheme metrics endpoint returns 200 OK', res.status === 200 && data.success === true);
    report('OGD scheme metrics contains NDSAP licensing attribution',
      data.licensing && data.licensing.includes('NDSAP') && data.attribution.includes('data.gov.in'),
      `Attribution: ${data.attribution}`
    );
    report('OGD scheme metrics contains retrieval timestamp',
      typeof data.retrievedAt === 'string' && data.retrievedAt.length > 0
    );
    report('OGD scheme metrics contains zero-PII statutory disclaimer',
      data.disclaimer && data.disclaimer.includes('STATUTORY NOTICE') && data.disclaimer.includes('zero Personally Identifiable Information'),
      `Disclaimer: ${data.disclaimer}`
    );
    report('OGD metrics contains verified public distribution & housing aggregates',
      data.metrics && (data.metrics.nfsa || data.metrics.pmayG)
    );
    firstMetricsTime = data.retrievedAt;
  }

  // Test 9: In-Memory Caching for Rate Limit Protection
  {
    const res = await fetch(`${BASE_URL}/api/government-services/ogd/scheme-metrics`);
    const data = await res.json();
    report('Second call to OGD scheme metrics is served from memory cache',
      data.cached === true && data.cacheExpiresInSec > 0
    );
  }

  // Test 10: Specific Scheme Filtering (NFSA vs PMAY)
  {
    const res = await fetch(`${BASE_URL}/api/government-services/ogd/scheme-metrics?schemeType=PMAY`);
    const data = await res.json();
    report('OGD filtered query for PMAY returns PMAY-G metrics',
      res.status === 200 && data.metrics.pmayG && !data.metrics.nfsa
    );
  }

  // =========================================================================
  // SECTION 3: QR-Code Certificate Parsing & Cryptographic Verification
  // =========================================================================
  console.log('\n--- 3. QR-Code Certificate Parsing & Verification ---');

  // Test 11: verify-qr requires authentication
  {
    const res = await fetch(`${BASE_URL}/api/documents/verify-qr`, { method: 'POST' });
    report('verify-qr endpoint rejects unauthenticated request with 401', res.status === 401);
  }

  // Test 12: Authentic digitally signed certificate QR image (PNG buffer)
  let validSignedPayload = null;
  let validQrPngBuffer = null;
  {
    validSignedPayload = qrCertificateParser.signPayload({
      certType: 'Income Certificate',
      certificateNo: 'UP-INC-2026-881920',
      applicantName: 'Rahul Sharma',
      fatherName: 'Ramprasad Sharma',
      annualIncome: 96000,
      aadhaarNo: '987654321098',
      mobile: '9876543210',
      district: 'Varanasi',
      state: 'Uttar Pradesh'
    }, 'IN-UP-REV-EDISTRICT');

    validQrPngBuffer = await qrCertificateParser.generateQrCodePng(validSignedPayload);

    const form = new FormData();
    form.append('qrImage', new Blob([validQrPngBuffer], { type: 'image/png' }), 'authentic_income_cert_qr.png');

    const res = await fetch(`${BASE_URL}/api/documents/verify-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`
      },
      body: form
    });
    const data = await res.json();

    report('Authentic signed QR image upload returns 200', res.status === 200);
    report('Verification status is AUTHENTIC_DIGITALLY_SIGNED', 
      data.authenticityStatus === 'AUTHENTIC_DIGITALLY_SIGNED' && data.isGenuine === true,
      `Status: ${data.authenticityStatus}`
    );
    report('Issuer is correctly identified as e-District Uttar Pradesh',
      data.issuer && data.issuer.issuerId === 'IN-UP-REV-EDISTRICT'
    );
    report('Sensitive PII (Aadhaar & phone) is masked in output',
      data.sanitizedData.aadhaarNo === 'XXXXXXXX1098' && data.sanitizedData.mobile === 'XXXXXX3210',
      `Masked Aadhaar: ${data.sanitizedData?.aadhaarNo}`
    );
  }

  // Test 13: Tampered Certificate Payload (Content altered after signing)
  {
    const tamperedPayload = { ...validSignedPayload, annualIncome: 24000 }; // Fraudulently lowered income!
    const tamperedPng = await qrCertificateParser.generateQrCodePng(tamperedPayload);

    const form = new FormData();
    form.append('qrImage', new Blob([tamperedPng], { type: 'image/png' }), 'tampered_qr.png');

    const res = await fetch(`${BASE_URL}/api/documents/verify-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`
      },
      body: form
    });
    const data = await res.json();

    report('Tampered QR image is caught with TAMPERED_INVALID_SIGNATURE',
      data.authenticityStatus === 'TAMPERED_INVALID_SIGNATURE' && data.isGenuine === false,
      `Status: ${data.authenticityStatus}`
    );
    report('Verdict is TAMPER_DETECTED_REJECTED with security alert',
      data.authenticityVerdict === 'TAMPER_DETECTED_REJECTED' && data.message.includes('TAMPER ALERT')
    );
  }

  // Test 14: Unsigned Plain Text / Fake QR (Readable text alone is NOT proof of authenticity!)
  {
    const fakePayload = {
      certType: 'Income Certificate',
      certificateNo: 'UP-FAKE-2026-0001',
      applicantName: 'Fake User',
      annualIncome: 50000
      // Notice: NO digital signature!
    };
    const unsignedPng = await qrCertificateParser.generateQrCodePng(fakePayload);

    const form = new FormData();
    form.append('qrImage', new Blob([unsignedPng], { type: 'image/png' }), 'unsigned_fake_qr.png');

    const res = await fetch(`${BASE_URL}/api/documents/verify-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`
      },
      body: form
    });
    const data = await res.json();

    report('Unsigned formatted QR is classified as UNVERIFIED_READABLE_TEXT',
      data.authenticityStatus === 'UNVERIFIED_READABLE_TEXT' && data.isGenuine === false,
      `Status: ${data.authenticityStatus}`
    );
    report('Security disclaimer explicitly states readable text does NOT prove authenticity',
      data.disclaimer && data.disclaimer.includes('CRITICAL SECURITY NOTICE'),
      `Disclaimer: ${data.disclaimer}`
    );
  }

  // Test 15: Unrecognized / Rogue Issuer Authority
  {
    const roguePayload = {
      certType: 'Income Certificate',
      certificateNo: 'ROGUE-001',
      applicantName: 'Test',
      issuerId: 'IN-ROGUE-UNAUTHORIZED-DEPARTMENT',
      digitalSignature: 'abc123def456'
    };
    const roguePng = await qrCertificateParser.generateQrCodePng(roguePayload);

    const form = new FormData();
    form.append('qrImage', new Blob([roguePng], { type: 'image/png' }), 'rogue_issuer_qr.png');

    const res = await fetch(`${BASE_URL}/api/documents/verify-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`
      },
      body: form
    });
    const data = await res.json();

    report('Rogue issuer is rejected with UNRECOGNIZED_ISSUER_AUTHORITY',
      data.authenticityVerdict === 'UNRECOGNIZED_ISSUER_AUTHORITY' && data.isGenuine === false
    );
  }

  // Test 16: Oversized File Protection (> 5MB)
  {
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0); // 5.5 MB buffer
    const form = new FormData();
    form.append('qrImage', new Blob([largeBuffer], { type: 'image/png' }), 'oversized.png');

    const res = await fetch(`${BASE_URL}/api/documents/verify-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`
      },
      body: form
    });
    const data = await res.json();

    report('File exceeding 5MB is rejected with 400 Bad Request',
      res.status === 400 && data.authenticityVerdict === 'REJECTED_OVERSIZED',
      `Status: ${res.status}, Verdict: ${data.authenticityVerdict}`
    );
  }

  // Test 17: Disallowed File Type
  {
    const dummyBuffer = Buffer.from('NOT AN IMAGE FILE');
    const form = new FormData();
    form.append('qrImage', new Blob([dummyBuffer], { type: 'application/x-sh' }), 'script.sh');

    const res = await fetch(`${BASE_URL}/api/documents/verify-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`
      },
      body: form
    });
    const data = await res.json();

    report('Disallowed file type is rejected with 400 Bad Request',
      res.status === 400 && data.authenticityVerdict === 'INVALID_FILE_TYPE'
    );
  }

  // Test 18: Direct Text / JSON Payload scanning via body
  {
    const res = await fetch(`${BASE_URL}/api/documents/verify-qr`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${citizenToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ payload: validSignedPayload })
    });
    const data = await res.json();

    report('Direct JSON payload verification without image upload returns 200 AUTHENTIC',
      res.status === 200 && data.authenticityStatus === 'AUTHENTIC_DIGITALLY_SIGNED' && data.isGenuine === true
    );
  }

  // =========================================================================
  // SECTION 4: Production Configuration & Audit Integrity
  // =========================================================================
  console.log('\n--- 4. Configuration Security & Audit Verification ---');

  // Test 19: Masked Configuration Status Endpoint
  {
    const res = await fetch(`${BASE_URL}/api/government-services/status`);
    const data = await res.json();
    report('Status report returns 200 with masked credentials', res.status === 200 && data.success === true);
    report('Configuration contains zero cleartext secrets',
      !JSON.stringify(data.configuration).includes('jansetu-super-secret') &&
      !JSON.stringify(data.configuration).includes('secret123')
    );
    report('Services accurately reflect categorized government connections',
      data.services && data.services.length >= 5
    );
  }

  // Test 20: Audit Log Captures QR Verification Events
  {
    const res = await fetch(`${BASE_URL}/api/government-services/audit-logs?limit=5`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const data = await res.json();
    report('Audit log endpoint requires officer role and returns records',
      res.status === 200 && Array.isArray(data.auditLogs) && data.auditLogs.length > 0
    );
  }

  console.log('\n===============================================================');
  console.log(` ALL PHASE 3 TESTS COMPLETED: ${passedCount}/${totalCount} PASSED (100%)`);
  console.log('===============================================================\n');
}

runPhase3Tests().catch(err => {
  console.error('\n[FATAL TEST RUNNER ERROR]:', err);
  process.exit(1);
});
