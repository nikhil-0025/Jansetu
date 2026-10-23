const crypto = require('crypto');

/**
 * JanSetu Government Consent Management Service
 * Generates and validates electronic consent artifacts compliant with:
 * 1. Digital Personal Data Protection (DPDP) Act, 2023.
 * 2. API Setu / DigiLocker Electronic Consent Schema v3.
 */

class ConsentService {
  /**
   * Generates a standard API Setu / DigiLocker electronic consent artifact.
   *
   * @param {Object} params
   * @param {string} params.citizenId - Citizen identifier (e.g. CIT-1001)
   * @param {string} params.citizenName - Full name of citizen granting consent
   * @param {string} params.purposeCode - Purpose of data pull (e.g. 'WELFARE_ELIGIBILITY_VERIFICATION')
   * @param {string} params.purposeDescription - Human-readable explanation of why data is requested
   * @param {string} params.dataProviderId - Government department/issuer ID (e.g. 'in.gov.uppcl', 'in.gov.fcs')
   * @param {string} params.documentType - Document identifier (e.g. 'ratcr', 'elctc', 'incme')
   * @param {number} [params.validityHours=24] - Consent window in hours
   * @returns {Object} Full API Setu v3 Consent Artifact & Transaction ID
   */
  generateConsentArtifact({
    citizenId,
    citizenName,
    purposeCode = 'WELFARE_ELIGIBILITY_VERIFICATION',
    purposeDescription = 'Verification of citizen documentation and household dwelling for JanSetu welfare eligibility',
    dataProviderId = 'in.gov.apisetu',
    documentType = 'document',
    validityHours = 24
  }) {
    if (!citizenId || !citizenName) {
      throw new Error('Citizen ID and Name are mandatory to establish informed electronic consent.');
    }

    const txnId = crypto.randomUUID();
    const consentId = crypto.randomUUID();
    const now = new Date();
    const expiry = new Date(now.getTime() + validityHours * 60 * 60 * 1000);

    const consentBody = {
      consentId,
      timestamp: now.toISOString(),
      dataConsumer: {
        id: 'in.gov.jansetu.techtrix',
        name: 'JanSetu Unified Public Welfare Verification Platform',
        role: 'DATA_FIDUCIARY'
      },
      dataProvider: {
        id: dataProviderId,
        category: 'GOVERNMENT_ISSUER'
      },
      purpose: {
        code: purposeCode,
        description: purposeDescription,
        legalBasis: 'Informed Citizen Consent under DPDP Act, 2023'
      },
      user: {
        idType: 'CITIZEN_ID',
        idNumber: citizenId,
        fullName: citizenName,
        consentGranted: true,
        consentChannel: 'JANSETU_CITIZEN_PORTAL'
      },
      data: {
        id: documentType,
        accessType: 'VIEW_AND_VERIFY_ONLY',
        retentionPolicy: 'EPHEMERAL_VERIFICATION_CACHE'
      },
      permission: {
        access: 'ONE_TIME',
        dateRange: {
          from: now.toISOString(),
          to: expiry.toISOString()
        },
        frequency: {
          unit: 'HOUR',
          value: validityHours,
          repeats: 0
        }
      }
    };

    // Generate cryptographic digest of consent body
    const digest = crypto
      .createHash('sha256')
      .update(JSON.stringify(consentBody))
      .digest('hex');

    return {
      txnId,
      consentArtifact: {
        consent: consentBody,
        signature: {
          signatureType: 'SHA256_DIGEST',
          digest,
          signedAt: now.toISOString(),
          signer: 'in.gov.jansetu.security'
        }
      }
    };
  }

  /**
   * Validates that an incoming consent artifact is unexpired and properly signed.
   */
  validateConsentArtifact(artifact) {
    if (!artifact || !artifact.consent || !artifact.signature) {
      return { valid: false, reason: 'Malformed consent artifact structure.' };
    }

    const { consent, signature } = artifact;
    const now = new Date();
    const expiry = new Date(consent.permission?.dateRange?.to);

    if (now > expiry) {
      return { valid: false, reason: `Consent expired at ${expiry.toISOString()}.` };
    }

    if (!consent.user?.consentGranted) {
      return { valid: false, reason: 'Consent was explicitly revoked or not granted.' };
    }

    // Verify digest integrity
    const expectedDigest = crypto
      .createHash('sha256')
      .update(JSON.stringify(consent))
      .digest('hex');

    if (expectedDigest !== signature.digest) {
      return { valid: false, reason: 'Consent artifact cryptographic integrity verification failed (tampered).' };
    }

    return {
      valid: true,
      consentId: consent.consentId,
      citizenId: consent.user.idNumber,
      purpose: consent.purpose.code,
      expiresAt: expiry
    };
  }
}

module.exports = new ConsentService();
