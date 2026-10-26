/**
 * JanSetu Phase 2: Real Government Schemes Portal Integration Test Suite
 * 
 * Tests:
 * 1. Persistent retrieval of 8 verified real government schemes from MongoDB Atlas
 * 2. Search filtering by scheme name, description, and keywords
 * 3. Category filtering (Agriculture, Housing, Healthcare, Food Security, Energy, Skills, Social Security, Financial Inclusion)
 * 4. Location and geographic coverage filtering (Rural, Urban, Pan-India)
 * 5. Single scheme retrieval with complete verified metadata (ministry, sourceUrl, officialUrl, verificationStatus)
 * 6. Interactive non-PII Eligibility Finder with rule-based matching:
 *    - Farmer profile -> PM-KISAN & PMAY-G Potentially Eligible
 *    - Urban street vendor profile -> PM SVANidhi Potentially Eligible
 *    - High income / Pucca house -> Transparently marks unmet conditions with clear explanations
 *    - Distinguishes unmet criteria from unknown criteria
 *    - Includes official statutory preliminary guidance disclaimer
 * 7. Verification of official sources & prevention of fabricated API claims
 * 8. Error handling for non-existent schemes
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (options.body) {
      if (!reqOptions.headers['Content-Type']) {
        reqOptions.headers['Content-Type'] = 'application/json';
      }
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runPhase2Tests() {
  console.log('=====================================================================');
  console.log('  JANSETU PHASE 2: REAL GOVERNMENT SCHEMES PORTAL TEST SUITE         ');
  console.log('=====================================================================\n');

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
    // 1. Test Scheme Retrieval & Persistence (at least 8 real schemes)
    console.log('--- TEST GROUP 1: Scheme Data Persistence & Verified Schema ---');
    const allSchemesRes = await request('/schemes');
    assert(allSchemesRes.status === 200, 'GET /api/schemes returns HTTP 200');
    assert(allSchemesRes.data.success === true, 'Response contains success: true');
    assert(Array.isArray(allSchemesRes.data.schemes), 'Response contains schemes array');
    assert(allSchemesRes.data.schemes.length >= 8, `Expected >= 8 verified schemes, found: ${allSchemesRes.data.schemes.length}`);

    const schemes = allSchemesRes.data.schemes;
    const requiredAttributes = [
      'schemeId', 'name', 'nameHindi', 'department', 'ministry',
      'category', 'description', 'benefitType', 'benefitAmount',
      'targetBeneficiaries', 'stateCoverage', 'applicationProcess',
      'officialUrl', 'sourceUrl', 'lastVerifiedDate', 'verificationStatus',
      'requiredDocuments', 'imageUrl'
    ];

    let allAttrsPresent = true;
    for (const s of schemes) {
      for (const attr of requiredAttributes) {
        if (!s[attr]) {
          console.error(`Missing attribute ${attr} in scheme ${s.schemeId}`);
          allAttrsPresent = false;
        }
      }
      assert(s.officialUrl.startsWith('http'), `Scheme ${s.schemeId} has valid official URL (${s.officialUrl})`);
      assert(s.verificationStatus && s.verificationStatus.startsWith('Verified'), `Scheme ${s.schemeId} is marked as Verified (${s.verificationStatus})`);
    }
    assert(allAttrsPresent, 'All schemes have complete verified attributes and source attribution');

    // 2. Test Search Filtering
    console.log('\n--- TEST GROUP 2: Search Query Filtering ---');
    const searchAwas = await request('/schemes?search=Awas');
    assert(searchAwas.status === 200, 'Search for "Awas" returned 200');
    assert(searchAwas.data.schemes.some(s => s.schemeId === 'SCH-PMAY-G'), 'Search for "Awas" found SCH-PMAY-G');

    const searchKisan = await request('/schemes?search=Kisan');
    assert(searchKisan.status === 200, 'Search for "Kisan" returned 200');
    assert(searchKisan.data.schemes.some(s => s.schemeId === 'SCH-PM-KISAN'), 'Search for "Kisan" found SCH-PM-KISAN');

    const searchPension = await request('/schemes?search=Pension');
    assert(searchPension.status === 200, 'Search for "Pension" returned 200');
    assert(searchPension.data.schemes.some(s => s.schemeId === 'SCH-APY'), 'Search for "Pension" found SCH-APY (Atal Pension Yojana)');

    // 3. Test Category Filtering
    console.log('\n--- TEST GROUP 3: Category Filtering ---');
    const catAgri = await request('/schemes?category=Agriculture');
    assert(catAgri.status === 200, 'Category filter Agriculture returned 200');
    assert(catAgri.data.schemes.every(s => s.category === 'Agriculture'), 'All returned schemes belong to Agriculture');
    assert(catAgri.data.schemes.some(s => s.schemeId === 'SCH-PM-KISAN'), 'Found PM-KISAN in Agriculture');

    const catSocial = await request('/schemes?category=Social%20Security');
    assert(catSocial.status === 200, 'Category filter Social Security returned 200');
    assert(catSocial.data.schemes.some(s => s.schemeId === 'SCH-APY'), 'Found APY in Social Security');

    const catFinancial = await request('/schemes?category=Financial%20Inclusion');
    assert(catFinancial.status === 200, 'Category filter Financial Inclusion returned 200');
    assert(catFinancial.data.schemes.some(s => s.schemeId === 'SCH-PMSVANIDHI'), 'Found PM SVANidhi in Financial Inclusion');

    // 4. Test Location / State Coverage Filtering
    console.log('\n--- TEST GROUP 4: Location / State Coverage Filtering ---');
    const covUrban = await request('/schemes?coverage=Urban');
    assert(covUrban.status === 200, 'Coverage filter Urban returned 200');
    assert(covUrban.data.schemes.some(s => s.schemeId === 'SCH-PMSVANIDHI'), 'Urban coverage returned PM SVANidhi');

    const covRural = await request('/schemes?coverage=Rural');
    assert(covRural.status === 200, 'Coverage filter Rural returned 200');
    assert(covRural.data.schemes.some(s => s.schemeId === 'SCH-PMAY-G'), 'Rural coverage returned PMAY-G');

    // 5. Test Single Scheme Retrieval & Error Handling
    console.log('\n--- TEST GROUP 5: Single Scheme Retrieval & Unknown Scheme Handling ---');
    const singleScheme = await request('/schemes/SCH-PM-JAY');
    assert(singleScheme.status === 200, 'GET /api/schemes/SCH-PM-JAY returned 200');
    assert(singleScheme.data.scheme.name.includes('Ayushman Bharat'), 'Retrieved Ayushman Bharat correctly');
    assert(singleScheme.data.scheme.ministry.includes('Health'), 'Ministry is Ministry of Health and Family Welfare');
    assert(singleScheme.data.scheme.officialUrl === 'https://pmjay.gov.in/', 'Official portal is https://pmjay.gov.in/');

    const nonExistent = await request('/schemes/SCH-NON-EXISTENT-999');
    assert(nonExistent.status === 404, 'Non-existent scheme returns HTTP 404');
    assert(nonExistent.data.success === false, 'Non-existent scheme returns success: false');

    // 6. Test Interactive Non-PII Eligibility Finder
    console.log('\n--- TEST GROUP 6: Interactive Non-PII Eligibility Finder ---');
    
    // Scenario 6A: Small & Marginal Farmer with Kutcha Dwelling and Low Income
    const farmerFinder = await request('/schemes/finder/evaluate', {
      method: 'POST',
      body: {
        age: 38,
        gender: 'Male',
        occupation: 'Small & Marginal Farmer',
        annualIncome: 110000,
        dwellingType: 'Kutcha',
        hasLpgConnection: false
      }
    });

    assert(farmerFinder.status === 200, 'Finder returned 200 for Farmer questionnaire');
    assert(farmerFinder.data.disclaimer !== undefined, 'Finder response includes statutory disclaimer');
    assert(farmerFinder.data.disclaimer.includes('Preliminary advisory guidance only'), 'Disclaimer explicitly states preliminary guidance');
    
    const farmerEvaluations = farmerFinder.data.evaluations;
    const pmKisanEval = farmerEvaluations.find(e => e.schemeId === 'SCH-PM-KISAN');
    assert(pmKisanEval !== undefined, 'Evaluated PM-KISAN for farmer');
    assert(pmKisanEval.status === 'Potentially Eligible', 'PM-KISAN is Potentially Eligible for small farmer');
    assert(pmKisanEval.passedConditions.some(c => c.includes('Farmer')), 'Passed condition mentions Farmer occupation');

    const pmaygEval = farmerEvaluations.find(e => e.schemeId === 'SCH-PMAY-G');
    assert(pmaygEval !== undefined, 'Evaluated PMAY-G for kutcha dwelling');
    assert(pmaygEval.status === 'Potentially Eligible', 'PMAY-G is Potentially Eligible for kutcha dwelling + low income');

    // Scenario 6B: Urban Street Vendor
    const vendorFinder = await request('/schemes/finder/evaluate', {
      method: 'POST',
      body: {
        age: 32,
        gender: 'Female',
        occupation: 'Urban Street Vendor / Informal',
        annualIncome: 90000,
        dwellingType: 'Kutcha',
        hasLpgConnection: false
      }
    });

    const vendorEvaluations = vendorFinder.data.evaluations;
    const svanidhiEval = vendorEvaluations.find(e => e.schemeId === 'SCH-PMSVANIDHI');
    assert(svanidhiEval !== undefined, 'Evaluated PM SVANidhi for vendor');
    assert(svanidhiEval.status === 'Potentially Eligible', 'PM SVANidhi is Potentially Eligible for street vendor');

    const pmuyEval = vendorEvaluations.find(e => e.schemeId === 'SCH-PMUY');
    assert(pmuyEval !== undefined, 'Evaluated PM Ujjwala Yojana for female without LPG');
    assert(pmuyEval.status === 'Potentially Eligible', 'PMUY is Potentially Eligible for female adult without existing LPG connection');

    // Scenario 6C: Ineligible Profile (Pucca House, 15 Lakh Income, Age 58)
    const highIncomeFinder = await request('/schemes/finder/evaluate', {
      method: 'POST',
      body: {
        age: 58,
        gender: 'Male',
        occupation: 'General / Salaried',
        annualIncome: 1500000,
        dwellingType: 'Pucca',
        hasLpgConnection: true
      }
    });

    const highIncomeEvals = highIncomeFinder.data.evaluations;
    const pmaygPucca = highIncomeEvals.find(e => e.schemeId === 'SCH-PMAY-G');
    assert(pmaygPucca.status === 'Not Currently Eligible', 'PMAY-G is Not Currently Eligible for pucca dwelling + high income');
    assert(pmaygPucca.unmetConditions.some(c => c.includes('Pucca')), 'Explains unmet condition: Household already has a pucca dwelling');
    assert(pmaygPucca.unmetConditions.some(c => c.toLowerCase().includes('income')), 'Explains unmet condition: Annual income exceeds scheme threshold');

    const apyAge = highIncomeEvals.find(e => e.schemeId === 'SCH-APY');
    assert(apyAge.status === 'Not Currently Eligible', 'APY is Not Currently Eligible for age 58');
    assert(apyAge.unmetConditions.some(c => c.includes('Age must be between 18 and 40')), 'Explains unmet condition: Age must be between 18 and 40 years');

    // Scenario 6D: Unknown data conditions
    assert(pmKisanEval.unknownConditions.some(c => c.includes('Land record khatauni')), 'PM-KISAN identifies land title as an unknown/document requirement');
    assert(pmaygEval.unknownConditions.some(c => c.includes('Gram Sabha')), 'PMAY-G identifies Gram Sabha priority verification as unknown');

    // 7. Verify Phase 1A Security Controls are preserved
    console.log('\n--- TEST GROUP 7: Verification of Phase 1A Security Preservation ---');
    const privateDocAttempt = await request('/documents/DOC-1001/file');
    assert(privateDocAttempt.status === 401, 'Unauthorized document access without token returns 401');

    const resetInProdAttempt = await request('/auth/reset-demo', { method: 'POST' });
    assert([401, 403].includes(resetInProdAttempt.status), `Reset endpoint is guarded by authentication controls (returned ${resetInProdAttempt.status})`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n=====================================================================');
  console.log(`  PHASE 2 SCHEMES TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests();
