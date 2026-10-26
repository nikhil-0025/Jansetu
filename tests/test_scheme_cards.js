const http = require('http');

async function verifySchemes() {
  console.log('===============================================================');
  console.log('   JANSETU SCHEME CARDS WITH VISUAL PREVIEWS TEST SUITE       ');
  console.log('===============================================================');

  const data = await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/schemes', (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    }).on('error', reject);
  });

  const schemes = data.schemes || [];
  console.log(`[PASS] API returned ${schemes.length} schemes successfully.`);

  const requiredFields = [
    'schemeId',
    'name',
    'nameHindi',
    'category',
    'description',
    'benefitType',
    'benefitAmount',
    'requiredDocuments',
    'imageUrl',
    'imageAlt',
    'eligibilityPreview',
    'ministry',
    'officialUrl',
    'sourceUrl',
    'lastVerifiedDate',
    'verificationStatus',
    'stateCoverage'
  ];

  let allChecksPassed = true;

  if (schemes.length < 8) {
    console.error(`[FAIL] Expected at least 8 verified schemes, but got ${schemes.length}`);
    allChecksPassed = false;
  }

  for (const s of schemes) {
    for (const f of requiredFields) {
      if (!s[f] || (Array.isArray(s[f]) && s[f].length === 0)) {
        console.error(`[FAIL] Scheme ${s.schemeId || 'unknown'} is missing required field: ${f}`);
        allChecksPassed = false;
      }
    }

    // Verify image asset exists and is accessible
    const imgUrl = 'http://localhost:5000' + s.imageUrl;
    const imgStatus = await new Promise((resolve) => {
      http.get(imgUrl, (res) => resolve(res.statusCode)).on('error', () => resolve(500));
    });

    if (imgStatus === 200) {
      console.log(`[PASS] ${s.schemeId} | ${s.category.padEnd(20)} | Image: ${s.imageUrl}`);
    } else {
      console.error(`[FAIL] Scheme ${s.schemeId} image returned HTTP ${imgStatus} at ${imgUrl}`);
      allChecksPassed = false;
    }
  }

  // Also verify fallback image
  const fallbackStatus = await new Promise((resolve) => {
    http.get('http://localhost:5000/assets/schemes/fallback.svg', (res) => resolve(res.statusCode)).on('error', () => resolve(500));
  });
  if (fallbackStatus === 200) {
    console.log('[PASS] Graceful fallback image accessible at /assets/schemes/fallback.svg');
  } else {
    console.error('[FAIL] Fallback image returned HTTP ' + fallbackStatus);
    allChecksPassed = false;
  }

  console.log('===============================================================');
  console.log(allChecksPassed ? 'ALL SCHEME CARD CHECKS PASSED (100%)' : 'SOME CHECKS FAILED');
  console.log('===============================================================');
  process.exit(allChecksPassed ? 0 : 1);
}

verifySchemes().catch(err => {
  console.error(err);
  process.exit(1);
});
