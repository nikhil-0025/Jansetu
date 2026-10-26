# JanSetu (जनसेतु) — Render PaaS Deployment & Architecture Guide

## 1. Overview & Architecture Strategy

JanSetu is designed as a unified Node.js/Express application that directly serves the vanilla HTML, CSS, JavaScript, and SVG assets from `frontend/` while hosting the RESTful API endpoints from `backend/`. It connects over TLS to an external managed **MongoDB Atlas** cluster.

**Deployment Strategy:**
- **Primary Hosting:** **Render PaaS** (Web Service, native Node.js runtime without Docker).
- **Database:** MongoDB Atlas (M0/Shared for Staging, M10+ Dedicated with Continuous Backups for Production).

```
+-----------------------------------------------------------------------------------+
|                        JANSETU ENVIRONMENT TAXONOMY                              |
+-----------------------------------------------------------------------------------+
| 1. DEVELOPMENT (Local)                                                            |
|    • NODE_ENV=development                                                         |
|    • Local / dev MongoDB Atlas cluster                                            |
|    • Demo reset enabled with x-reset-key                                          |
+-----------------------------------------------------------------------------------+
| 2. STAGING (Render Web Service)                                                   |
|    • NODE_ENV=staging                                                             |
|    • Render Service Name: jansetu-staging.onrender.com                            |
|    • Dedicated staging MongoDB Atlas database (jansetu_staging)                   |
|    • Automated SSL/HTTPS certificate termination                                  |
|    • Full test suite execution and pilot validation                               |
+-----------------------------------------------------------------------------------+
| 3. PRODUCTION (Render Web Service / Custom Domain)                                |
|    • NODE_ENV=production                                                          |
|    • Production Service Name: jansetu.gov.in (or jansetu-prod.onrender.com)        |
|    • Dedicated production MongoDB Atlas cluster (jansetu_prod)                    |
|    • Demo reset endpoint PERMANENTLY BLOCKED on all HTTP methods (HTTP 403)       |
|    • Strict Content-Security-Policy and Rate Limiting active                      |
|    • Authorized MeitY DigiLocker Partner Credentials & CERT-In Audit Required     |
+-----------------------------------------------------------------------------------+
```

---

## 2. Render PaaS Step-by-Step Staging Setup (Non-Docker)

### Step 1: Connect Repository to Render
1. Log in to [render.com](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository containing the JanSetu project.

### Step 2: Configure Service Parameters
- **Name:** `jansetu-staging`
- **Region:** Choose the region closest to your target audience (e.g., *Singapore* or *Frankfurt*).
- **Branch:** `main` (or dedicated `staging` branch).
- **Runtime:** `Node` *(Native Node.js runtime, zero Docker)*.
- **Build Command:** `npm install`
- **Start Command:** `node backend/server.js` (or `npm start`)
- **Plan:** `Free` or `Starter`.

### Step 3: Configure Environment Variables in Render Dashboard
Under the **Environment** tab, add the following variables:

| Variable Key | Staging Value | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `staging` | Enables staging mode security controls |
| `MONGODB_URI` | `mongodb+srv://.../jansetu_staging` | Staging database connection string from Atlas |
| `JWT_SECRET` | *(Render Auto-Generate or 64-char hex)* | Cryptographic key for citizen/officer tokens |
| `ALLOWED_ORIGINS` | `https://jansetu-staging.onrender.com` | Strict CORS allowlist |
| `RESET_DEMO_KEY` | *(Secret string for test wipes)* | Staging-only test reset key |
| `GOV_API_FORCE_MOCK` | `false` | Enables live gateway logic / sandbox adapters |
| `APISETU_ENV` | `sandbox` | API Setu / DigiLocker sandbox mode |

> [!NOTE]
> Render automatically injects the `PORT` variable (typically `10000`). JanSetu's `backend/server.js` automatically binds to `process.env.PORT || 5000`.

### Step 4: Health Check Path
Under **Advanced Settings** in Render:
- Set **Health Check Path** to: `/api/health`
- Render will poll this endpoint during deployment and only route traffic after `/api/health` returns HTTP 200 with status `healthy`.

---

## 3. Storage Considerations on Render

1. **Ephemeral File Storage (Free/Starter Plans):**
   - On standard Render Web Services, the local filesystem is ephemeral (persists across requests, but is refreshed on new deployments).
   - The application automatically creates `backend/uploads` and `backend/secure_uploads/corrections` on startup.
   - For temporary testing and pilot evaluations, local disk storage functions smoothly.
2. **Persistent Document Storage (Production Upgrade):**
   - **Render Persistent Disks:** You can attach a Persistent Disk mounted at `/app/backend/uploads` via the Render dashboard.
   - **Cloud Object Storage (S3 / GCS):** For multi-instance horizontal scaling, uploaded documents can be routed to an encrypted AWS S3 or Google Cloud Storage bucket with presigned URLs.

---

## 4. Production Security Controls Active on Render

1. **Helmet & Content Security Policy (CSP)**:
   - Configured in `backend/server.js`.
   - Protects against cross-site scripting (XSS), clickjacking, and MIME sniffing.
   - Allows Google Fonts, Lucide icons (`unpkg.com`), and preview images.
2. **Brute-Force & Rate Limiting**:
   - General API: 600 requests per 15-minute window per IP.
   - Sensitive Auth (`/login`, `/signup`, `/verify-reference`): 40 requests per 15-minute window per IP.
3. **Demo Reset Guard**:
   - `/api/auth/reset-demo` is permanently blocked across all HTTP methods (GET, POST, PUT, DELETE, OPTIONS) returning `HTTP 403 Forbidden` whenever `NODE_ENV=production`.
4. **Automated SSL/TLS Termination**:
   - Render automatically provisions and renews Let's Encrypt SSL/TLS certificates. All HTTP traffic is automatically upgraded to HTTPS.

---

## 5. Automated Blueprint Deployment (`render.yaml`)

As an alternative to manual dashboard configuration, you can use the provided [`render.yaml`](file:///c:/Users/savan/Desktop/Techtrix/render.yaml) file:
1. In Render Dashboard, click **New +** -> **Blueprint**.
2. Select your repository.
3. Render reads `render.yaml` and auto-provisions the Web Service with the exact build commands, start commands, health check path, and environment variables.
4. Input your `MONGODB_URI` when prompted.
