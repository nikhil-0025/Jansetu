/**
 * JanSetu Government API Integration Inventory
 *
 * Detailed registry of verified candidate Indian Government APIs across:
 * - API Setu (apisetu.gov.in)
 * - DigiLocker Partner Gateway (api.apisetu.gov.in)
 * - Open Government Data Platform India (data.gov.in)
 * - myScheme Marketplace (myscheme.gov.in)
 *
 * Implements strict separation between Public Open Datasets and PII/Sensitive Verification APIs.
 */

const GOV_API_INVENTORY = [
  // =========================================================================
  // 1. CONFIDENTIAL / PII DOCUMENT VERIFICATION & ISSUER APIS (API Setu / DigiLocker)
  // =========================================================================
  {
    id: 'APISETU-EPDS-RATION',
    name: 'National / State e-PDS Ration Card Verification API',
    category: 'CITIZEN_SENSITIVE_PII',
    purpose: 'Verifies authentic ration card status, scheme category (AAY, BPL, PHH), family head, and listed household members for food security & dwelling subsidy verification.',
    publisher: 'Department of Food and Public Distribution / State Civil Supplies Departments (e.g., FCS UP, Civil Supplies Kerala)',
    portalSource: 'API Setu (apisetu.gov.in)',
    liveEndpoint: 'https://apisetu.gov.in/fcs/v3/ratcr/certificate',
    sandboxEndpoint: 'https://apisetu.gov.in/developer/sandbox/fcs/v3/ratcr/certificate',
    httpMethod: 'POST',
    authentication: {
      type: 'Header-based API Key & Client ID',
      headers: {
        'X-APISETU-CLIENTID': 'Required (Assigned upon institutional onboarding on partners.apisetu.gov.in)',
        'X-APISETU-APIKEY': 'Required (Generated via partner security dashboard; secret kept on backend)',
        'Content-Type': 'application/json'
      }
    },
    consentRequirements: {
      isMandatory: true,
      legalFramework: 'Digital Personal Data Protection (DPDP) Act, 2023 & API Setu Consent Architecture v3',
      consentStructure: 'Electronic Consent Artifact containing citizen identifier, purpose description, timestamp, and SHA-256 digest'
    },
    approvalRequirements: {
      entityType: 'Registered Government/Semi-Gov entity or authorized consumer organisation',
      process: '1. Register on partners.apisetu.gov.in with Org PAN/GST. 2. Submit formal use case for Welfare Scheme Delivery. 3. Sign MoU/Agreement with Civil Supplies Department. 4. Complete sandbox integration certification.',
      statusInJanSetu: 'Awaiting Department Onboarding / Sandbox Ready'
    },
    sandboxAvailability: {
      available: true,
      url: 'https://apisetu.gov.in/developer/sandbox',
      mockFallbackEnabled: true
    },
    requestPayloadSchema: {
      txnId: 'UUIDv4 string',
      format: 'json | xml | pdf',
      certificateParameters: {
        FullName: 'Citizen Name (as on card)',
        UID: 'Masked Aadhaar or Ration Card Number'
      },
      consentArtifact: 'Object (Standard API Setu v3 consent schema)'
    },
    dataReturned: {
      type: 'Structured Citizen Household Record',
      fields: [
        'rationCardNumber',
        'cardCategory (Antyodaya AAY / BPL / Priority Household PHH)',
        'headOfFamilyName',
        'fpsCode (Fair Price Shop dealer reference)',
        'numberOfMembers',
        'memberList: [{ name, relationship, age, gender, uidStatus }]',
        'allotmentStatus (Active / Suspended / Cancelled)',
        'digitalSignatureStatus'
      ]
    },
    governanceRules: [
      'JanSetu must never use Ration Card data alone to split or merge legal families.',
      'Separation in JanSetu triggers a request for Ration Card bifurcation to State FCS, but does not overwrite official state PDS databases.',
      'Raw Aadhaar/UID is never stored unmasked in JanSetu database.'
    ]
  },

  {
    id: 'APISETU-DISCOM-ELECTRICITY',
    name: 'State Electricity Distribution Utility (DISCOM) Dwelling Verification API',
    category: 'CITIZEN_SENSITIVE_PII',
    purpose: 'Authoritatively verifies independent electrical service connection, consumer account, meter number, and physical dwelling address for household separation and dwelling proof.',
    publisher: 'State Electricity Boards / DISCOMs (e.g. UPPCL Uttar Pradesh, Mahadiscom Maharashtra, TANGEDCO Tamil Nadu)',
    portalSource: 'API Setu (apisetu.gov.in)',
    liveEndpoint: 'https://apisetu.gov.in/uppcl/v3/elctc/certificate',
    sandboxEndpoint: 'https://apisetu.gov.in/developer/sandbox/uppcl/v3/elctc/certificate',
    httpMethod: 'POST',
    authentication: {
      type: 'Header-based API Key & Client ID',
      headers: {
        'X-APISETU-CLIENTID': 'Required (in.gov.jansetu partner id)',
        'X-APISETU-APIKEY': 'Required (Cryptographic API key)',
        'Content-Type': 'application/json'
      }
    },
    consentRequirements: {
      isMandatory: true,
      legalFramework: 'Informed electronic citizen consent required for dwelling verification',
      consentStructure: 'API Setu Consent Artifact with utility billing verification purpose'
    },
    approvalRequirements: {
      entityType: 'Authorized public platform / e-District consumer',
      process: 'DISCOM service subscription approval via API Setu Partners Portal',
      statusInJanSetu: 'Awaiting Department Onboarding / Sandbox Ready'
    },
    sandboxAvailability: {
      available: true,
      mockFallbackEnabled: true
    },
    requestPayloadSchema: {
      txnId: 'UUIDv4 string',
      format: 'json',
      certificateParameters: {
        ConsumerNo: 'DISCOM Consumer ID (e.g. 10-digit account no)',
        BillNo: 'Optional latest bill reference'
      },
      consentArtifact: 'Object'
    },
    dataReturned: {
      type: 'Dwelling & Connection Verification Certificate',
      fields: [
        'consumerNumber',
        'consumerName',
        'premisesAddress',
        'connectionType (Domestic / Commercial / Agricultural)',
        'connectionStatus (Live / Disconnected)',
        'meterSerialNumber',
        'supplyVoltage',
        'billPeriod',
        'verificationDigest'
      ]
    },
    governanceRules: [
      'Used as independent dwelling proof in Household Separation (Scenario A).',
      'If independent meter connection is verified, confidence score for physical separation is elevated for Officer Review.',
      'Absence of separate meter does not automatically disqualify poor households (officer field inspection fallback is supported).'
    ]
  },

  {
    id: 'DIGILOCKER-PULL-DOCUMENT',
    name: 'DigiLocker Partner Gateway Document Pull & URI Resolution API',
    category: 'CITIZEN_SENSITIVE_PII',
    purpose: 'Permits citizens to authenticate and pull digitally signed, tamper-evident certificates (Income, Caste, Domicile, Land Records) directly into JanSetu Document Vault.',
    publisher: 'National e-Governance Division (NeGD) / Ministry of Electronics & IT (MeitY)',
    portalSource: 'DigiLocker Partner Portal (api.apisetu.gov.in / partners.digitallocker.gov.in)',
    liveEndpoint: 'https://api.apisetu.gov.in/v1/digilocker/pull-doc',
    sandboxEndpoint: 'https://api.apisetu.gov.in/sandbox/v1/digilocker/pull-doc',
    httpMethod: 'POST',
    authentication: {
      type: 'OAuth 2.0 / Requester Token + Partner Secret',
      headers: {
        'X-APISETU-CLIENTID': 'Required',
        'X-APISETU-APIKEY': 'Required',
        'Authorization': 'Bearer <User_Access_Token_or_Consent_Token>'
      }
    },
    consentRequirements: {
      isMandatory: true,
      legalFramework: 'Information Technology (Preservation and Retention of Information by Intermediaries Providing Digital Locker Facilities) Rules, 2016',
      consentStructure: 'OAuth 2.0 User Consent Scope & Time-bounded Token'
    },
    approvalRequirements: {
      entityType: 'Whitelisted DigiLocker Requester Application',
      process: '1. Register as Requester on DigiLocker Partners. 2. Define document scopes. 3. Complete security audit. 4. Production whitelisting.',
      statusInJanSetu: 'Sandbox & Demo Adapter Configured'
    },
    sandboxAvailability: {
      available: true,
      mockFallbackEnabled: true
    },
    dataReturned: {
      type: 'Authentic Digitally Signed Certificate',
      fields: [
        'documentUri (e.g. in.gov.up.edistrict-INC-9281729)',
        'mimeType (application/pdf, application/xml)',
        'issuerAuthority',
        'issuedDate',
        'digitalSignatureStatus (VALID_GOVERNMENT_SEAL)',
        'documentPayloadBase64'
      ]
    },
    governanceRules: [
      'Certificates pulled via DigiLocker have legal equivalence to original physical documents under Section 9A of IT Act, 2000.',
      'JanSetu marks these with "Authoritative Government Verified" seal.',
      'Manual uploads without DigiLocker verification remain "Pending Officer Review".'
    ]
  },

  // =========================================================================
  // 2. PUBLIC WELFARE DATASETS & SCHEME CATALOG APIS (No PII / Public Domain)
  // =========================================================================
  {
    id: 'OGD-DATA-GOV-PUBLIC-SCHEMES',
    name: 'Open Government Data (OGD) Platform India - Public Scheme Datasets',
    category: 'PUBLIC_OPEN_DATASET',
    purpose: 'Queries public datasets for scheme enrollment statistics, state-level allocations, National Food Security Act (NFSA) distribution benchmarks, and PMAY completion reports.',
    publisher: 'National Informatics Centre (NIC) / Government of India',
    portalSource: 'Open Government Data Platform India (data.gov.in)',
    liveEndpoint: 'https://api.data.gov.in/resource/{RESOURCE_ID}',
    sandboxEndpoint: 'https://api.data.gov.in/resource/{RESOURCE_ID}?api-key=TEST_KEY',
    httpMethod: 'GET',
    authentication: {
      type: 'URL Query Parameter `api-key`',
      headers: {
        'Accept': 'application/json'
      },
      credentialLocation: 'Backend DATA_GOV_API_KEY environment variable (Free registration on data.gov.in)'
    },
    consentRequirements: {
      isMandatory: false,
      legalFramework: 'National Data Sharing and Accessibility Policy (NDSAP), 2012. Completely public aggregated data; contains zero Personally Identifiable Information (PII).'
    },
    approvalRequirements: {
      entityType: 'Any registered developer or citizen',
      process: 'Create free account on data.gov.in and generate API key instantly from user dashboard.',
      statusInJanSetu: 'Active Client with Public Dataset Integration'
    },
    sandboxAvailability: {
      available: true,
      mockFallbackEnabled: true
    },
    dataReturned: {
      type: 'Aggregated Public Statistics & Scheme Allocation Tables',
      fields: [
        'state_name',
        'district_name',
        'scheme_name',
        'total_beneficiaries_enrolled',
        'total_funds_disbursed_crores',
        'completion_percentage',
        'updated_date'
      ]
    },
    governanceRules: [
      'Used strictly for public macro-analytics, scheme benchmarks, and administrative district quotas.',
      'Never used to verify individual citizen eligibility or track individual citizens.'
    ]
  },

  {
    id: 'MYSCHEME-NATIONAL-CATALOG',
    name: 'myScheme National Welfare Marketplace & Eligibility Taxonomy API',
    category: 'PUBLIC_OPEN_DATASET',
    purpose: 'Discovers verified Central and State government welfare schemes, criteria taxonomy, application instructions, required documents, and benefit categories.',
    publisher: 'Ministry of Electronics & Information Technology (MeitY) / NeGD / Digital India Corporation',
    portalSource: 'myScheme Portal (myscheme.gov.in)',
    liveEndpoint: 'https://api.myscheme.gov.in/api/v1/schemes',
    sandboxEndpoint: 'https://sandbox.myscheme.gov.in/api/v1/schemes',
    httpMethod: 'GET',
    authentication: {
      type: 'API Key or Public Discovery Headers',
      headers: {
        'Accept': 'application/json'
      }
    },
    consentRequirements: {
      isMandatory: false,
      legalFramework: 'Public government scheme information intended for citizen accessibility.'
    },
    approvalRequirements: {
      entityType: 'Partnership via API Setu / Open catalog query',
      process: 'Open schema discovery for cataloging; full application submission requires MeitY department integration.',
      statusInJanSetu: 'Catalog Discovery Client Configured'
    },
    sandboxAvailability: {
      available: true,
      mockFallbackEnabled: true
    },
    dataReturned: {
      type: 'Official Welfare Scheme Catalogue & Rule Criteria',
      fields: [
        'schemeId',
        'schemeName',
        'schemeNameHindi',
        'nodalMinistry',
        'benefitType (Household / Individual)',
        'financialAssistanceAmount',
        'eligibilityCriteria: { minAge, maxAge, maxIncome, landHolding, dwellingType, casteCategory }',
        'requiredDocuments',
        'officialApplicationUrl'
      ]
    },
    governanceRules: [
      'Synchronizes scheme guidelines into JanSetu rule repository.',
      'JanSetu eligibility engine uses these rules to render explainable criteria results to citizens and officers.'
    ]
  }
];

module.exports = {
  GOV_API_INVENTORY
};
