const apiSetuClient = require('./apiSetuClient');
const consentService = require('../services/consentService');
const mockAdapter = require('../adapters/mockAdapter');
const { getGovApiConfig } = require('../config/govApiConfig');

/**
 * State Electricity Utility (DISCOM) Dwelling Verification Client
 * Used during Household Separation (Scenario A) to verify that an independent
 * dwelling premises has a separate electrical meter & connection.
 */
class DiscomElectricityClient {
  constructor() {
    this.serviceId = 'APISETU-DISCOM-ELECTRICITY';
  }

  getConnectionState() {
    return apiSetuClient.getConnectionState();
  }

  /**
   * Verifies an electricity connection for dwelling independence.
   */
  async verifyElectricityDwelling({
    consumerNumber,
    premisesAddress,
    citizenId,
    citizenName,
    actorId = 'CITIZEN',
    actorRole = 'citizen'
  }) {
    if (!consumerNumber) {
      throw new Error('Electricity Consumer Number is required for verification.');
    }

    const config = getGovApiConfig();
    const utilityCode = config.discom.utilityCode.toLowerCase();

    // 1. Generate mandatory electronic consent artifact
    const { txnId, consentArtifact } = consentService.generateConsentArtifact({
      citizenId: citizenId || 'CIT-1002',
      citizenName: citizenName || 'Citizen Applicant',
      purposeCode: 'INDEPENDENT_DWELLING_VERIFICATION',
      purposeDescription: 'Verification of independent meter connection and physical premises for JanSetu household separation',
      dataProviderId: `in.gov.${utilityCode}`,
      documentType: 'elctc'
    });

    const payload = {
      txnId,
      format: 'json',
      certificateParameters: {
        ConsumerNo: consumerNumber
      },
      consentArtifact
    };

    const maskedParams = {
      consumerNumber: `${consumerNumber.substring(0, 3)}****${consumerNumber.slice(-3)}`,
      premisesAddress: premisesAddress ? `${premisesAddress.slice(0, 15)}...` : 'N/A',
      citizenId
    };

    const endpoint = `/${utilityCode}/v3/elctc/certificate`;

    return await apiSetuClient.post(endpoint, payload, {
      serviceName: this.serviceId,
      operation: 'VERIFY_ELECTRICITY_DWELLING',
      actorId,
      actorRole,
      maskedParams,
      mockHandler: () => mockAdapter.mockVerifyElectricityConnection({
        consumerNumber,
        premisesAddress,
        consentId: consentArtifact.consent.consentId
      })
    });
  }
}

module.exports = new DiscomElectricityClient();
