/**
 * Government API Configuration Module
 * Loads environment variables for Indian Government Services.
 * Secrets are strictly isolated on the backend and masked before any exposure.
 */

const getGovApiConfig = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const forceMock = process.env.GOV_API_FORCE_MOCK === 'true';

  return {
    mode: {
      isProduction: isProd,
      forceMock: forceMock,
      timeoutMs: parseInt(process.env.GOV_API_TIMEOUT_MS || '6000', 10),
      retryAttempts: parseInt(process.env.GOV_API_RETRY_ATTEMPTS || '2', 10)
    },

    // 1. API Setu / DigiLocker Issuer Integration
    apiSetu: {
      baseUrl: process.env.APISETU_BASE_URL || 'https://apisetu.gov.in',
      sandboxUrl: process.env.APISETU_SANDBOX_URL || 'https://apisetu.gov.in/developer/sandbox',
      clientId: process.env.APISETU_CLIENT_ID || '',
      apiKey: process.env.APISETU_API_KEY || '',
      isSandbox: process.env.APISETU_ENV === 'sandbox' || !process.env.APISETU_ENV,
      statusOverride: process.env.APISETU_STATUS_OVERRIDE || null // 'Connected', 'Awaiting Approval', etc.
    },

    // 2. DigiLocker Partner Gateway
    digilocker: {
      partnerId: process.env.DIGILOCKER_PARTNER_ID || '',
      apiSecret: process.env.DIGILOCKER_API_SECRET || '',
      callbackUrl: process.env.DIGILOCKER_CALLBACK_URL || 'http://localhost:5000/api/government-services/digilocker/callback',
      consentValidityHours: parseInt(process.env.DIGILOCKER_CONSENT_VALIDITY_HOURS || '24', 10)
    },

    // 3. Open Government Data (OGD) Platform India (data.gov.in)
    ogdDataGov: {
      baseUrl: process.env.DATA_GOV_BASE_URL || 'https://api.data.gov.in/resource',
      apiKey: process.env.DATA_GOV_API_KEY || '',
      // Official Open Data resource ID for Public Distribution / Welfare Statistics
      nfsaResourceId: process.env.DATA_GOV_NFSA_RESOURCE_ID || '9a22a518-5a33-4bab-8d12-1a3c3e6f5c8e',
      pmayResourceId: process.env.DATA_GOV_PMAY_RESOURCE_ID || '8c13b246-4a21-4fca-9e23-2b4c5d6e7f8a'
    },

    // 4. myScheme Integration
    myScheme: {
      baseUrl: process.env.MYSCHEME_BASE_URL || 'https://www.myscheme.gov.in',
      catalogApiUrl: process.env.MYSCHEME_CATALOG_URL || 'https://api.myscheme.gov.in/api/v1',
      apiKey: process.env.MYSCHEME_API_KEY || ''
    },

    // 5. State Utility Providers (e.g. UPPCL Electricity DISCOM for dwelling verification)
    discom: {
      state: process.env.STATE_CODE || 'UP',
      utilityCode: process.env.DISCOM_UTILITY_CODE || 'UPPCL',
      baseUrl: process.env.DISCOM_BASE_URL || 'https://apisetu.gov.in/uppcl/v3'
    }
  };
};

/**
 * Returns sanitized config safe for JSON responses (masks all secret keys).
 */
const getMaskedGovConfig = () => {
  const config = getGovApiConfig();

  const maskSecret = (secret) => {
    if (!secret || typeof secret !== 'string') return 'Not Configured';
    if (secret.length <= 4) return '****';
    return `${secret.substring(0, 3)}...${secret.slice(-3)} (${secret.length} chars)`;
  };

  return {
    environment: process.env.NODE_ENV || 'development',
    timeoutMs: config.mode.timeoutMs,
    forceMock: config.mode.forceMock,
    services: {
      apiSetu: {
        baseUrl: config.apiSetu.baseUrl,
        isSandbox: config.apiSetu.isSandbox,
        clientId: config.apiSetu.clientId ? `${config.apiSetu.clientId.slice(0, 5)}***` : 'Not Configured',
        apiKeyStatus: maskSecret(config.apiSetu.apiKey)
      },
      digilocker: {
        partnerId: config.digilocker.partnerId ? `${config.digilocker.partnerId.slice(0, 4)}***` : 'Not Configured',
        secretStatus: maskSecret(config.digilocker.apiSecret)
      },
      ogdDataGov: {
        baseUrl: config.ogdDataGov.baseUrl,
        apiKeyStatus: maskSecret(config.ogdDataGov.apiKey)
      },
      myScheme: {
        baseUrl: config.myScheme.baseUrl,
        apiKeyStatus: maskSecret(config.myScheme.apiKey)
      },
      discom: {
        state: config.discom.state,
        utilityCode: config.discom.utilityCode,
        baseUrl: config.discom.baseUrl
      }
    }
  };
};

module.exports = {
  getGovApiConfig,
  getMaskedGovConfig
};
