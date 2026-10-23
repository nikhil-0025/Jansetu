const { GOV_API_INVENTORY } = require('./inventory');
const { CONNECTION_STATES, STATE_DESCRIPTIONS } = require('./types/connectionStates');
const { getGovApiConfig, getMaskedGovConfig } = require('./config/govApiConfig');
const auditLogger = require('./services/auditLogger');
const consentService = require('./services/consentService');

const epdsRationClient = require('./clients/epdsRationClient');
const discomElectricityClient = require('./clients/discomElectricityClient');
const digilockerClient = require('./clients/digilockerClient');
const ogdDataGovClient = require('./clients/ogdDataGovClient');
const mySchemeClient = require('./clients/mySchemeClient');

/**
 * JanSetu Unified Government Integration Layer
 * Central entry point for all Indian Government Service APIs.
 */
class GovIntegrationManager {
  constructor() {
    this.inventory = GOV_API_INVENTORY;
  }

  /**
   * Health and connection status of all integrated services.
   */
  async getStatusReport() {
    const config = getMaskedGovConfig();

    const services = [
      {
        id: 'APISETU-EPDS-RATION',
        name: 'National / State e-PDS Ration Card API',
        portal: 'API Setu (apisetu.gov.in)',
        category: 'Sensitive PII Verification',
        connectionState: epdsRationClient.getConnectionState(),
        endpoint: 'https://apisetu.gov.in/fcs/v3/ratcr/certificate',
        requiresConsent: true
      },
      {
        id: 'APISETU-DISCOM-ELECTRICITY',
        name: 'DISCOM Electricity Dwelling Verification API',
        portal: 'API Setu / UPPCL (apisetu.gov.in)',
        category: 'Sensitive PII Verification',
        connectionState: discomElectricityClient.getConnectionState(),
        endpoint: 'https://apisetu.gov.in/uppcl/v3/elctc/certificate',
        requiresConsent: true
      },
      {
        id: 'DIGILOCKER-PULL-DOCUMENT',
        name: 'DigiLocker Document Pull & URI Resolution',
        portal: 'DigiLocker Partner Portal (api.apisetu.gov.in)',
        category: 'Sensitive PII Verification',
        connectionState: digilockerClient.getConnectionState(),
        endpoint: 'https://api.apisetu.gov.in/v1/digilocker/pull-doc',
        requiresConsent: true
      },
      {
        id: 'OGD-DATA-GOV-PUBLIC-SCHEMES',
        name: 'Open Government Data (OGD) Platform India',
        portal: 'data.gov.in',
        category: 'Public Open Dataset (Zero PII)',
        connectionState: ogdDataGovClient.getConnectionState(),
        endpoint: 'https://api.data.gov.in/resource',
        requiresConsent: false
      },
      {
        id: 'MYSCHEME-NATIONAL-CATALOG',
        name: 'myScheme National Welfare Marketplace',
        portal: 'myscheme.gov.in',
        category: 'Public Open Dataset (Zero PII)',
        connectionState: mySchemeClient.getConnectionState(),
        endpoint: 'https://api.myscheme.gov.in/api/v1/schemes',
        requiresConsent: false
      }
    ];

    // Count states
    const stateSummary = {
      total: services.length,
      connected: services.filter(s => s.connectionState === CONNECTION_STATES.CONNECTED).length,
      sandbox: services.filter(s => s.connectionState === CONNECTION_STATES.SANDBOX).length,
      awaitingApproval: services.filter(s => s.connectionState === CONNECTION_STATES.AWAITING_APPROVAL).length,
      unavailable: services.filter(s => s.connectionState === CONNECTION_STATES.UNAVAILABLE).length,
      demoMode: services.filter(s => s.connectionState === CONNECTION_STATES.DEMO_MODE).length
    };

    return {
      success: true,
      timestamp: new Date().toISOString(),
      platform: 'JanSetu (जनसेतु) Indian Government Integration Gateway',
      tagline: 'Har Parivaar, Har Haq, Ek Setu.',
      stateSummary,
      stateDescriptions: STATE_DESCRIPTIONS,
      configuration: config,
      services,
      recentAuditLogs: auditLogger.getRecentLogs(10)
    };
  }

  getInventory() {
    return {
      success: true,
      count: this.inventory.length,
      inventory: this.inventory
    };
  }

  // Service Methods
  async verifyRationCard(params) {
    return await epdsRationClient.verifyRationCard(params);
  }

  async verifyElectricityDwelling(params) {
    return await discomElectricityClient.verifyElectricityDwelling(params);
  }

  async pullDigiLockerDoc(params) {
    return await digilockerClient.pullDocument(params);
  }

  async fetchOgdStats(params) {
    return await ogdDataGovClient.fetchResource(params);
  }

  async fetchMySchemeCatalog(params) {
    return await mySchemeClient.fetchSchemesCatalog(params);
  }

  getAuditLogs(limit = 50, filter = {}) {
    return auditLogger.getRecentLogs(limit, filter);
  }

  validateConsent(artifact) {
    return consentService.validateConsentArtifact(artifact);
  }
}

module.exports = new GovIntegrationManager();
