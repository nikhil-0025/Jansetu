# DigiLocker & MeriPehchaan Integration Specification (JanSetu)

## 1. Overview & Official Governance Architecture
DigiLocker is an initiative of the Ministry of Electronics & IT (MeitY) under the Digital India Programme, operated by the Digital India Corporation (DIC). JanSetu integrates with DigiLocker as a **Requester / Consumer Service (Relying Party)** to verify citizen certificates (such as Ration Cards, Income Certificates, and Electricity connections) directly against authoritative government issuer repositories.

Official Reference Portals:
- **DigiLocker Partner Portal:** [https://partners.digitallocker.gov.in/](https://partners.digitallocker.gov.in/)
- **API Setu (National API Exchange):** [https://apisetu.gov.in/](https://apisetu.gov.in/)
- **MeriPehchaan (National SSO):** [https://meripehchaan.gov.in/](https://meripehchaan.gov.in/)

---

## 2. Onboarding & Registration Process

### 2.1 Requester Registration
1. **Entity Verification**: The deploying organization registers on the DigiLocker Partner Portal using authorized organizational credentials and a Digital Signature Certificate (DSC) of a designated Nodal Officer.
2. **Application Profile**:
   - Application Name: `JanSetu Citizen Services Platform`
   - Purpose of Access: Public welfare scheme eligibility verification, household documentation, and dwelling verification.
   - Redirect / Callback URI: `https://<domain>/api/government-services/digilocker/callback` (production) or `http://localhost:5000/api/government-services/digilocker/callback` (sandbox).
   - Server Public IP: Static outbound IP whitelisting is required by MeitY firewalls.
3. **Sandbox Provisioning**:
   - Partner Portal provides a sandbox `client_id`, `client_secret`, and sandbox gateway URLs (`https://apisetu.gov.in/developer/sandbox`).
   - Mock Aadhaar/Ration card records are provisioned in the sandbox test registry.
4. **Production Clearance**:
   - Production access requires:
     - Third-party Application Security Audit Certificate by a **CERT-In Empaneled Auditor**.
     - Data Localization and Non-Disclosure declaration adhering to the **Digital Personal Data Protection (DPDP) Act, 2023**.
     - Signed Memorandum of Understanding (MOU) / Service Level Agreement (SLA) with Digital India Corporation.
     - Production IP whitelisting.

---

## 3. Informed Citizen Consent Requirements
Per the DPDP Act 2023 and API Setu Consent Architecture v3, every document retrieval or verification request requires an electronic Consent Artifact containing:
- **Citizen Identifier**: Unique ID (`citizenId` or masked reference).
- **Purpose Code**: Specific purpose string (e.g. `WELFARE_ELIGIBILITY_VERIFICATION`, `DWELLING_PROOF_VERIFICATION`).
- **Data Consumer**: `in.gov.jansetu.portal` (Data Fiduciary).
- **Data Provider**: Target department (e.g. `in.gov.fcs` for Ration Card, `in.gov.uppcl` for Electricity).
- **Retention Policy**: `EPHEMERAL_VERIFICATION_CACHE` or `VAULT_SECURE_STORAGE`.
- **Permission Window**: Ephemeral (default: 24 hours), un-repeatable one-time pull.
- **Cryptographic Digest**: SHA-256 digest ensuring artifact tamper-evidence.

---

## 4. OAuth 2.0 Authorization Code Flow

### Step 1: Authorization URL Generation
- **Endpoint**: `GET /api/government-services/digilocker/auth-url?docType={docType}&redirectUri={redirectUri}`
- Backend creates a cryptographically secure 256-bit random nonce (`state`), stores it with a 15-minute expiration time, and returns:
  ```json
  {
    "success": true,
    "authUrl": "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize?response_type=code&client_id=...&state=...&redirect_uri=...",
    "state": "a3f1...",
    "expiresAt": "2026-10-26T12:00:00.000Z",
    "integrationStatus": "SANDBOX_STANDBY"
  }
  ```

### Step 2: Citizen Consent on MeriPehchaan
- Citizen logs into MeriPehchaan / DigiLocker via OTP or biometric authentication.
- Citizen approves the specific consent items requested by JanSetu.

### Step 3: Callback Handling & CSRF Verification
- **Endpoint**: `GET /api/government-services/digilocker/callback?code={code}&state={state}` or `POST /api/government-services/digilocker/callback`
- Backend validates:
  1. `state` presence and matching active stored nonce. If invalid or expired, immediately aborts with `HTTP 400` ("Invalid or expired OAuth state parameter; potential CSRF detected").
  2. One-time consumption: `state` is deleted immediately upon receipt.
- Backend exchanges `code` for an access token via DigiLocker token endpoint:
  ```http
  POST https://digilocker.meripehchaan.gov.in/public/oauth2/1/token
  Authorization: Basic base64(client_id:client_secret)
  Content-Type: application/x-www-form-urlencoded

  grant_type=authorization_code&code={AUTH_CODE}&redirect_uri={CALLBACK_URL}
  ```

### Step 4: Token Management & Secret Isolation
- `client_secret` and access tokens are strictly stored on the backend.
- Tokens are held in-memory or securely encrypted; tokens are NEVER exposed to the frontend or browser `localStorage`.
- All credentials are read from `process.env.DIGILOCKER_PARTNER_ID` and `process.env.DIGILOCKER_API_SECRET`.

---

## 5. Security Safeguards & Production Boundary
1. **Zero Fake Verifications**: In the absence of production credentials or before MeitY authorization is granted, JanSetu operates in `SANDBOX_STANDBY` or `DEMO_MODE`.
2. **Transparent Labeling**: Every response indicates `isAuthoritative: false` and `isSimulated: true` unless verified through live, authenticated DigiLocker channels.
3. **No Credential Exposure**: API keys, HMAC secrets, and tokens are scrubbed from all client-facing responses and server logs.
