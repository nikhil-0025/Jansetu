const apiSetuClient = require('./apiSetuClient');
const consentService = require('../services/consentService');
const mockAdapter = require('../adapters/mockAdapter');
const { getGovApiConfig } = require('../config/govApiConfig');
const { CONNECTION_STATES } = require('../types/connectionStates');

/**
 * DigiLocker Partner Gateway Document Pull Client
 * Used to fetch tamper-evident certificates directly into the Document Vault.
 */
class DigiLockerClient {
  constructor() {
    this.serviceId = 'DIGILOCKER-PULL-DOCUMENT';
  }

  getConnectionState() {
    const config = getGovApiConfig();
    if (config.mode.forceMock) return CONNECTION_STATES.DEMO_MODE;
    if (!config.digilocker.partnerId || !config.digilocker.apiSecret) {
      return CONNECTION_STATES.DEMO_MODE;
    }
    return CONNECTION_STATES.SANDBOX;
  }

  /**
   * Pulls a digital document via DigiLocker.
   */
  async pullDocument({
    docType,
    referenceNo,
    citizenId,
    citizenName,
    actorId = 'CITIZEN',
    actorRole = 'citizen'
  }) {
    if (!docType) {
      throw new Error('Document Type is mandatory (e.g. ratcr, incme, caste, elctc).');
    }

    const { txnId, consentArtifact } = consentService.generateConsentArtifact({
      citizenId: citizenId || 'CIT-1001',
      citizenName: citizenName || 'Rahul Sharma',
      purposeCode: 'DIGILOCKER_DOCUMENT_PULL',
      purposeDescription: `Pulling official ${docType} certificate into JanSetu Document Vault`,
      dataProviderId: 'in.gov.digilocker',
      documentType: docType
    });

    const payload = {
      txnId,
      format: 'pdf',
      docType,
      referenceNo,
      consentArtifact
    };

    const maskedParams = {
      docType,
      referenceNo: referenceNo ? `${referenceNo.substring(0, 2)}****${referenceNo.slice(-3)}` : 'AUTO_DISCOVERY',
      citizenId
    };

    const endpoint = `/v1/digilocker/pull-doc`;

    return await apiSetuClient.post(endpoint, payload, {
      serviceName: this.serviceId,
      operation: 'PULL_DIGILOCKER_CERTIFICATE',
      actorId,
      actorRole,
      maskedParams,
      mockHandler: () => mockAdapter.mockPullDigiLockerDoc({
        docType,
        referenceNo,
        citizenName,
        consentId: consentArtifact.consent.consentId
      })
    });
  }
}

module.exports = new DigiLockerClient();
