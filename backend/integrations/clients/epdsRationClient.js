const apiSetuClient = require('./apiSetuClient');
const consentService = require('../services/consentService');
const mockAdapter = require('../adapters/mockAdapter');

/**
 * e-PDS Ration Card Verification Client (Food & Civil Supplies)
 * Interacts with API Setu route: /{publisher}/v3/ratcr/certificate
 */
class EpdsRationClient {
  constructor() {
    this.serviceId = 'APISETU-EPDS-RATION';
  }

  getConnectionState() {
    return apiSetuClient.getConnectionState();
  }

  /**
   * Verifies an e-PDS Ration Card with user consent.
   */
  async verifyRationCard({
    rationCardNo,
    citizenId,
    citizenName,
    state = 'UP',
    actorId = 'CITIZEN',
    actorRole = 'citizen'
  }) {
    if (!rationCardNo) {
      throw new Error('Ration Card Number is required for verification.');
    }

    // 1. Generate mandatory electronic consent artifact
    const { txnId, consentArtifact } = consentService.generateConsentArtifact({
      citizenId: citizenId || 'CIT-1001',
      citizenName: citizenName || 'Citizen Applicant',
      purposeCode: 'RATION_CARD_WELFARE_VERIFICATION',
      purposeDescription: 'Verification of NFSA / BPL Ration Card status and family members for JanSetu welfare eligibility',
      dataProviderId: 'in.gov.fcs.up',
      documentType: 'ratcr'
    });

    const payload = {
      txnId,
      format: 'json',
      certificateParameters: {
        FullName: citizenName || 'Citizen Applicant',
        UID: rationCardNo
      },
      consentArtifact
    };

    const maskedParams = {
      rationCardNo: `${rationCardNo.substring(0, 2)}****${rationCardNo.slice(-4)}`,
      citizenId,
      state
    };

    const endpoint = `/fcs/v3/ratcr/certificate`;

    return await apiSetuClient.post(endpoint, payload, {
      serviceName: this.serviceId,
      operation: 'VERIFY_RATION_CARD',
      actorId,
      actorRole,
      maskedParams,
      mockHandler: () => mockAdapter.mockVerifyRationCard({
        rationCardNo,
        fullName: citizenName,
        state,
        consentId: consentArtifact.consent.consentId
      })
    });
  }
}

module.exports = new EpdsRationClient();
