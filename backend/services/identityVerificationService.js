const mongoose = require('mongoose');

/**
 * JanSetu Identity & Certificate Verification Service
 * 
 * Verifies citizen identity and supporting certificate references against
 * the synthetic verification dataset (collection: 'verification_records').
 * 
 * IMPORTANT DEMO DISCLOSURE:
 * The 80 records are fictional test records and do not constitute official Government
 * of India verification. Enabled via IDENTITY_VERIFICATION_MODE=synthetic.
 */

// Helper: Normalize person full names (lowercase, single spaces, trimmed)
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Helper: Standardize certificate type identifiers
function normalizeCertType(type) {
  if (!type || typeof type !== 'string') return '';
  const clean = type.trim().toUpperCase().replace(/[\s_-]+/g, '_');
  if (clean.includes('BIRTH')) return 'BIRTH';
  if (clean.includes('EWS')) return 'EWS';
  if (clean.includes('DISABILITY')) return 'DISABILITY';
  if (clean.includes('INCOME')) return 'INCOME';
  if (clean.includes('CASTE')) return 'CASTE';
  if (clean.includes('DOMICILE')) return 'DOMICILE';
  if (clean.includes('RATION')) return 'RATION_CARD';
  return clean;
}

// Helper: Normalize date strings to standard YYYY-MM-DD
function normalizeDob(dob) {
  if (!dob) return '';
  if (typeof dob === 'string') {
    const match = dob.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  try {
    const d = new Date(dob);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  return String(dob).trim();
}

/**
 * Verify a certificate and citizen identity against the verification collection.
 * 
 * @param {Object} params
 * @param {string} params.certificateType - Type of certificate (e.g. BIRTH, EWS, INCOME)
 * @param {string} params.certificateId - Reference number of the certificate
 * @param {string} params.fullName - Full name of the citizen
 * @param {string} params.dateOfBirth - Date of birth in YYYY-MM-DD format
 * @param {string} [params.familyReferenceId] - Optional family reference ID
 * @returns {Promise<Object>} Verification outcome
 */
async function verifyCertificate({ certificateType, certificateId, fullName, dateOfBirth, familyReferenceId }) {
  const mode = process.env.IDENTITY_VERIFICATION_MODE || 'synthetic';

  // Strict check: if synthetic mode is turned off and no live provider is configured,
  // report that real verification is unavailable. Never silently fall back.
  if (mode !== 'synthetic') {
    return {
      success: false,
      match: false,
      status: 'UNAVAILABLE',
      message: 'Official live government verification provider is not configured or unavailable. Synthetic simulation mode is disabled.',
      isSimulated: false
    };
  }

  // Database availability check - Do not falsely report success if MongoDB is unreachable
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    const error = new Error('Verification database (MongoDB Atlas) is currently unreachable.');
    error.code = 'DB_UNAVAILABLE';
    error.status = 503;
    throw error;
  }

  const cleanCertId = String(certificateId || '').trim();
  const cleanCertType = normalizeCertType(certificateType);
  const cleanName = normalizeName(fullName);
  const cleanDob = normalizeDob(dateOfBirth);

  if (!cleanCertId || !cleanCertType || !cleanName || !cleanDob) {
    return {
      success: false,
      match: false,
      status: 'INVALID_INPUT',
      message: 'Identity verification failed: Please provide complete certificate reference, certificate type, full name, and date of birth.'
    };
  }

  const collection = mongoose.connection.collection('verification_records');

  // Look up record containing this certificate ID
  let matchedRecord;
  try {
    matchedRecord = await collection.findOne({
      'certificates.certificateId': cleanCertId
    });
  } catch (dbErr) {
    const error = new Error(`Verification database query error: ${dbErr.message}`);
    error.code = 'DB_UNAVAILABLE';
    error.status = 503;
    throw error;
  }

  // 1. Certificate reference not found in records
  if (!matchedRecord) {
    return {
      success: false,
      match: false,
      status: 'MISMATCH',
      message: 'Identity verification failed: The provided certificate reference and identity details could not be verified against government records.'
    };
  }

  // Locate the specific certificate inside the record
  const certObj = (matchedRecord.certificates || []).find(
    c => String(c.certificateId).trim() === cleanCertId
  );

  if (!certObj) {
    return {
      success: false,
      match: false,
      status: 'MISMATCH',
      message: 'Identity verification failed: The provided certificate reference and identity details could not be verified against government records.'
    };
  }

  // 2. Certificate Type Mismatch
  const recordCertType = normalizeCertType(certObj.type);
  if (recordCertType !== cleanCertType) {
    return {
      success: false,
      match: false,
      status: 'TYPE_MISMATCH',
      message: 'Identity verification failed: The submitted certificate reference does not match the selected certificate type.'
    };
  }

  // 3. Name & Date of Birth Mismatch
  const recordNameNormalized = matchedRecord.fullNameNormalized || normalizeName(matchedRecord.fullName);
  const recordDobNormalized = normalizeDob(matchedRecord.dateOfBirth);

  if (recordNameNormalized !== cleanName || recordDobNormalized !== cleanDob) {
    // Return generic message that does not leak another citizen's personal record
    return {
      success: false,
      match: false,
      status: 'IDENTITY_MISMATCH',
      message: 'Identity verification failed: The provided personal information does not match government verification records.'
    };
  }

  // 4. Family Reference ID Check (if provided)
  if (familyReferenceId) {
    const cleanFamRef = String(familyReferenceId).trim();
    const recordFamRef = String(matchedRecord.familyReferenceId).trim();
    if (cleanFamRef && recordFamRef && cleanFamRef !== recordFamRef) {
      return {
        success: false,
        match: false,
        status: 'FAMILY_REF_MISMATCH',
        message: 'Identity verification failed: Family reference number does not match verification records.'
      };
    }
  }

  // 5. Expiration Check
  const certStatus = String(certObj.status || '').toUpperCase();
  const isExpiredByDate = certObj.expiresOn && new Date(certObj.expiresOn) < new Date();

  if (certStatus === 'EXPIRED' || isExpiredByDate) {
    return {
      success: false,
      match: false,
      status: 'EXPIRED',
      message: `Verification rejected: The submitted certificate has expired (${certObj.expiresOn || 'prior date'}) and cannot be used for registration.`,
      certificateStatus: 'EXPIRED',
      isSimulated: true,
      verificationSource: matchedRecord.verificationSource || 'LOCAL_SYNTHETIC_DATASET'
    };
  }

  // 6. Review Required Check
  if (certStatus === 'REVIEW_REQUIRED') {
    return {
      success: true,
      match: true,
      requiresManualReview: true,
      status: 'REVIEW_REQUIRED',
      message: 'The submitted certificate is marked for mandatory administrative review in government records. Your registration will require officer review before approval.',
      certificateStatus: 'REVIEW_REQUIRED',
      recordId: matchedRecord.recordId,
      certificateType: certObj.type,
      certificateId: certObj.certificateId,
      state: matchedRecord.state,
      district: matchedRecord.district,
      address: matchedRecord.address,
      familyReferenceId: matchedRecord.familyReferenceId,
      isSimulated: true,
      verificationSource: matchedRecord.verificationSource || 'LOCAL_SYNTHETIC_DATASET',
      verificationNote: 'Fictional test record; not an official government verification.'
    };
  }

  // 7. Fully Valid Record
  return {
    success: true,
    match: true,
    requiresManualReview: false,
    status: 'VALID',
    message: 'Identity and certificate reference successfully verified against synthetic verification records.',
    certificateStatus: 'VALID',
    recordId: matchedRecord.recordId,
    certificateType: certObj.type,
    certificateId: certObj.certificateId,
    state: matchedRecord.state,
    district: matchedRecord.district,
    address: matchedRecord.address,
    familyReferenceId: matchedRecord.familyReferenceId,
    isSimulated: true,
    verificationSource: matchedRecord.verificationSource || 'LOCAL_SYNTHETIC_DATASET',
    verificationNote: 'Fictional test record; not an official government verification.'
  };
}

module.exports = {
  verifyCertificate,
  normalizeName,
  normalizeCertType,
  normalizeDob
};
