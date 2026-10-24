# JanSetu (जनसेतु) — Har Parivaar, Har Haq, Ek Setu.

> **Unified Digital Platform for Accessible Public Documentation & Welfare Verification**  
> **National Citizen Welfare & Public Documentation Initiative**  
> *Tagline:* Har Parivaar, Har Haq, Ek Setu (हर परिवार, हर हक, एक सेतु।)

---

## 🌟 Executive Summary

Public welfare delivery often suffers from siloed government records: separate departments maintain citizen profiles, family relationships, household accounts, supporting documents, and scheme disbursements. This leads to duplicate claims on ancestral dwellings, inaccurate household welfare exclusions, and administrative confusion when family members marry or move into independent homes.

**JanSetu (जनसेतु)** resolves this by establishing a unified digital bridge connecting citizens, households, family relationship graphs, supporting certificates, welfare schemes, and administrative verification queues.

---

## 🏛️ Core Architectural Distinctions

| Feature | Household / Family Account | Individual Citizen Record |
| :--- | :--- | :--- |
| **Identifier** | **Family ID** (e.g. `FAM-1001`) | **Citizen ID** (e.g. `CIT-1001`, `CIT-1002`) |
| **Scope** | Shared dwelling, cooking hearth, ration unit | Permanent individual identity |
| **Stability** | Changes upon approved separation | **Never changes** across a citizen's lifetime |
| **Relationships** | Represents current co-residence | Biological relationships (Brothers, Parent-Child) remain **permanently recorded** |
| **Welfare Schemes** | Evaluates household income, dwelling type, prior housing grants (e.g., PMAY-G, Ration, Ujjwala) | Evaluates individual farmer status, skill age criteria (e.g., PM-KISAN, PMKVY) |

---

## 🚀 Key Features

1. **SmartSeva Reference Layout Adapted for JanSetu:**  
   Clean Indian public-service portal aesthetics (Deep Navy `#0f284e`, Subtle Saffron `#e65100`, Accessible status badges).
2. **Interactive SVG Family Tree & Relationship Graph:**  
   Visualizes biological relationships across household boundary lines, clearly proving that sibling relationships survive household separation.
3. **Household Separation Workflow (Core Feature):**  
   Citizens initiate a 4-step separation request; verifying officers review dwelling independence and approve, creating a new `Family ID` (e.g., `FAM-2001`) without altering individual `Citizen IDs`.
4. **Explainable Duplicate Benefit Detection Engine:**  
   Detects repeat claims on identical dwelling references (`D-104`) or shared households, returning human-readable findings for authorized officer adjudication.
5. **Rule-Based Scheme Eligibility Engine:**  
   Evaluates income thresholds, dwelling materials, age criteria, farmer status, and document verification checklists.
6. **Verified Document Vault:**  
   Categorizes household vs. individual certificates (Khatauni land records, Ration cards, Income certificates) with officer verification workflows.
7. **Profile & Legal Name Correction:**  
   Audit-trailed name and DOB change requests updated only upon officer authorization.
8. **JanSetu AI Saathi:**  
   Conversational bilingual assistant (English and हिंदी) answering citizen welfare inquiries.
9. **Dual Persistence Layer:**  
   Operates seamlessly with live MongoDB or out-of-the-box in-memory / file demo storage mode with zero manual setup.
10. **Authorized Government API Integration Layer (API Setu, DigiLocker, data.gov.in, myScheme):**  
    Features an Indian Government API gateway with electronic consent artifacts (DPDP Act 2023), real-time connection state monitoring (Connected, Sandbox, Awaiting Approval, Unavailable, Demo Mode), candidate inventory, circuit breakers, and zero-credential mock adapters. Complete guide in [`GOVERNMENT_API_INTEGRATION.md`](./GOVERNMENT_API_INTEGRATION.md).

---

## 🔑 Demonstration Credentials

| Role | User Identifier | Password | Associated Profile |
| :--- | :--- | :--- | :--- |
| **Citizen Family (Combined)** | `FAM-1001` | `citizen123` | **Rahul Sharma (Head)**, Amit (Brother), Sunita (Spouse), Aarav (Son) |
| **Citizen Family (Separated)** | `FAM-2001` | `citizen123` | **Amit Sharma** *(Available once Scenario A separation is approved)* |
| **Verification Officer** | `OFFICER-01` | `officer123` | **Vikramaditya Verma** (Senior Block Development Officer) |
| **Portal Administrator** | `ADMIN-01` | `admin123` | **Sanjay Deshmukh** (State Portal Admin) |

*(Quick 1-click login autofill buttons are built directly into the login page.)*

---

## 🛠️ Quick Start & Running Instructions

### Prerequisites
- **Node.js** (v18+ or v24+ recommended)
- **npm** (v9+)
- *(Optional)* MongoDB running on `mongodb://localhost:27017/jansetu`

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env` (already preconfigured with safe defaults):
```bash
PORT=5000
MONGODB_URI=mongodb://localhost:27017/jansetu
JWT_SECRET=jansetu_super_secure_jwt_secret_key_2026
NODE_ENV=development
```

### Step 3: Start Application Server
```bash
npm start
```
The application will launch on `http://localhost:5000`.

- **Landing Page:** [http://localhost:5000/](http://localhost:5000/)
- **Citizen Portal:** [http://localhost:5000/dashboard.html](http://localhost:5000/dashboard.html)
- **Government Officer Portal:** [http://localhost:5000/officer.html](http://localhost:5000/officer.html)
- **Login Portal:** [http://localhost:5000/login.html](http://localhost:5000/login.html)

---

## 📋 Feature & Workflow Demonstration Walkthrough (Scenarios A — F)

### Scenario A — Household Separation & Relationship Persistence
1. Sign in as Citizen (`FAM-1001` / `citizen123`).
2. Click **"Household Separation"** tab &rarr; click **"Initiate Separation Request"**.
3. Select **Amit Sharma (CIT-1002)** moving to proposed dwelling `D-201` at Ward 3, Rampur.
4. Submit the request (assigned tracking ID `SEP-2026-XXX`).
5. Open the **Officer Portal** (`OFFICER-01` / `officer123`) &rarr; **Household Separation Requests Queue**.
6. Inspect the side-by-side comparison and click **"Approve Separation"**.
7. Enter mandatory officer findings and confirm.
8. **Result:** New Family account `FAM-2001` is generated. Amit's Citizen ID remains `CIT-1002`. In the Family Registry Tree, the biological connection between Rahul and Amit remains displayed as **"Brother (BOND PRESERVED)"**!

### Scenario B — Duplicate Household Benefit Detection
1. Sign in as Citizen `FAM-1001`.
2. Locate **Pradhan Mantri Awas Yojana (PMAY-G)** (Dwelling `D-104` already received a housing grant in FY 2023-24).
3. Click **"Check Eligibility"**.
4. **Result:** The system triggers an alert:  
   *`"POTENTIAL DUPLICATE CLAIM WARNING (HOUSEHOLD_DUPLICATE): Household FAM-1001 was already granted benefits under PMAY-G (Record: BEN-2023-014)."`*  
   The application is flagged for authorized human review rather than being arbitrarily deleted.

### Scenario C — Individual Welfare Schemes (PM-KISAN)
1. Sign in as Citizen `FAM-1001`.
2. Run eligibility for **PM-KISAN** for **Rahul Sharma** (Farmer with 1.2 Ha) &rarr; Status: **Potentially Eligible**.
3. Run eligibility for **PM-KISAN** for **Amit Sharma** (Electrician, 0 Ha) &rarr; Status: **Not Eligible (No Landholding)**.
4. **Result:** Demonstrates that individual welfare benefits evaluate each person on their own merits and do not falsely flag siblings as duplicate fraudsters.

### Scenario D — Document Vault & Verification
1. Click **"Document Vault"** &rarr; **"Upload New Document"**.
2. Select **"Certified Electrician ITI Skill Certificate"** for Amit Sharma.
3. Switch to Officer Portal &rarr; **"Document Verification Queue"**.
4. Click **"Verify"** and enter verification remarks.
5. **Result:** Citizen sees updated verified badge and officer timestamp.

### Scenario E — Application Tracking & Disbursement
1. Apply for a welfare scheme from the portal.
2. Tracking ID (`APP-2026-XXX`) displays real-time status: `Submitted` &rarr; `Approved / Disbursed`.
3. An immutable audit log records the officer decision and timestamp.

### Scenario F — Profile Correction with Supporting PDF Documents
1. Sign in as Citizen (`FAM-1001` / `citizen123`).
2. Go to **"Profile Corrections"** tab &rarr; Click **"Request New Correction"**.
3. Select household member, target field (e.g., `Full Name`, `Date of Birth`, `Gender`, `Address`, `Occupation`, `Education`, or `Category`), and enter the requested legal value.
4. Provide a mandatory reason explaining why the change is legally necessary.
5. Select the supporting document type:
   - Aadhaar Card
   - Voter ID Card
   - Passport
   - Matriculation / Class 10 Certificate
   - Birth Certificate
   - Driving Licence
   - PAN Card
   - Other *(triggers required "Specify Document Type" input)*
6. Attach an authentic supporting PDF certificate (max 5 MB). File name and size preview appear with remove/replace options.
7. Submit the request &rarr; Assigned reference `COR-2026-XXXX`, stored as `Pending Officer Review`.
8. Sign in to the **Officer Portal** (`OFFICER-01` / `officer123`) &rarr; Click **"Name & Profile Corrections"** tab.
9. Click **"Inspect Evidence & Record Decision"** on the pending request.
10. The officer examines the side-by-side comparison, stated reason, and embedded PDF document preview (with option to open/download in a new tab).
11. Officer selects determination:
    - **Approved:** Authenticates certificate and updates the citizen's JanSetu profile field atomically.
    - **Additional Evidence Required:** Mandates review remarks; notifies citizen to upload replacement/higher-tier PDF.
    - **Rejected:** Mandates review remarks; preserves existing profile value unchanged.
    - **Under Review:** Flags for administrative inquiry.
12. Check System Audit Trail to verify immutable recording of the action, actor, timestamp, and review remarks.

---

## 🔒 Security & Privacy Practices

- **Role-Based Access Control (RBAC):** Server-side enforcement prevents citizens from accessing records outside their verified household. Ordinary citizens are blocked from officer verification endpoints (HTTP 403).
- **Private Document Storage:** Supporting PDF proof files are stored strictly outside the publicly served frontend directory in `backend/secure_uploads/corrections/`. Files are never exposed via public static URLs.
- **Strict Authorization for Uploaded Documents:** `GET /api/profile-corrections/:requestId/document` verifies JWT token ownership. Only the document owner citizen and authorized reviewing officers can view or download evidence.
- **Triple-Layer PDF Validation:** File extension (`.pdf`), MIME type (`application/pdf`), and server-side magic byte inspection (`%PDF-` header signature) prevent upload of disguised executables or malformed files.
- **Configurable File Size Limits:** Default 5 MB maximum upload limit configured via `MAX_PDF_SIZE_BYTES` environment variable. Empty (0 bytes) and oversized files are rejected with friendly errors.
- **Credential Protection:** Passwords securely hashed using `bcryptjs`.
- **JWT Authorization:** Tamper-proof session tokens with strict expiry.
- **Privacy Masking:** Sensitive references and Aadhaar numbers are masked (`XXXX-XXXX-8921`).
- **Immutable Audit Logging:** Every document verification, separation approval, profile correction, and application review records actor ID, timestamp, and before/after states.

---

## 🧪 Automated Testing

JanSetu includes an end-to-end automated test suite verifying all 10 Profile Correction requirements:

```bash
node tests/test_profile_corrections.js
```

### Verified Test Cases (18/18 Passed):
1. **Citizen Authentication:** Citizen logs in and receives verified JWT token.
2. **Officer Authentication:** Officer logs in and receives verified JWT token.
3. **Missing PDF Rejection:** Server rejects requests submitted without supporting PDF proof.
4. **Magic Byte Signature Inspection:** Server rejects fake PDFs lacking the authentic `%PDF-` file header signature.
5. **Valid Submission:** Genuine PDF upload is accepted, uniquely renamed on disk, and persisted to MongoDB Atlas and `dataStore`.
6. **Owner Document Access:** Citizen owner successfully streams/downloads their uploaded PDF.
7. **Officer Document Access:** Reviewing officer successfully streams/downloads citizen evidence for inspection.
8. **Unauthenticated Access Block:** Unauthenticated users are denied document access (HTTP 401).
9. **Additional Evidence Workflow:** Officer requests additional evidence with mandatory review remarks.
10. **Citizen Resubmission:** Citizen resubmits replacement PDF; request returns to Pending review.
11. **RBAC Endpoint Protection:** Citizen is blocked from officer-only review endpoints (HTTP 403).
12. **Controlled Profile Update:** Officer approval updates the authorized citizen profile field (`fullName`) atomically.
13. **Rejection Integrity:** Officer rejection preserves the original profile value intact.
14. **Custom Document Type Enforcement:** Selecting "Other" requires specifying the custom document name.
15. **Sensitive Field Protection:** Direct tampering with sensitive system fields (`role`, `citizenId`, `familyId`) is rejected.
16. **Oversized Upload Protection:** Files exceeding the 5 MB limit are rejected.

---

## 📢 Transparent Disclosure

- **Seed Data:** Synthetic fictional records designed specifically for demonstration purposes (Varanasi, UP jurisdiction).
- **Integrations:** External interfaces (UIDAI Aadhaar biometric, State Bhulekh Land Registry) are realistically simulated for demonstration and evaluation purposes.
