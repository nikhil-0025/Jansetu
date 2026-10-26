const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env')
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB, getMongoStatus } = require('./config/db');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// 1. Security Headers via Helmet (Configured for compatibility with frontend assets & icons)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline modal scripts and event handlers
          "https://unpkg.com" // Lucide icons library
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline UI styles and animations
          "https://fonts.googleapis.com" // Google Fonts
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:" // Required for QR code preview blobs and local image rendering
        ],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// 2. Environment-Based CORS Configuration
const rawAllowed = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawAllowed
  ? rawAllowed.split(',').map(s => s.trim().toLowerCase())
  : [
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server tests)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.toLowerCase().trim();
    if (!isProd || allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: Access from origin '${origin}' is not permitted.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-reset-key', 'X-Requested-With', 'Accept']
};
app.use(cors(corsOptions));

// 3. Body Parsing Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Rate Limiting Middleware
// General API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // 600 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please wait 15 minutes before retrying.'
  }
});

// Stricter Rate Limiter for Sensitive Auth / Onboarding Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 40 : 500, // 40 in production, 500 in dev/test to accommodate continuous automated test suites
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes before retrying.'
  }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/verify-reference', authLimiter);

// 5. Serve static frontend assets (HTML, CSS, JS, UI icons only)
// Note: Private uploaded documents are NOT served statically; they require authenticated streaming via /api/documents
app.use(express.static(path.join(__dirname, '../frontend')));

// 6. Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/households', require('./routes/householdRoutes'));
app.use('/api/citizens', require('./routes/citizenRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/schemes', require('./routes/schemeRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/separation-requests', require('./routes/separationRoutes'));
app.use('/api/profile-corrections', require('./routes/profileCorrectionRoutes'));
app.use('/api/admin', require('./routes/officerRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/api/government-services', require('./routes/govIntegrationRoutes'));

// 7. Comprehensive Health & System Readiness Check
const startTime = Date.now();
app.get('/api/health', (req, res) => {
  const mongoStatus = getMongoStatus();
  const isHealthy = mongoStatus.connected !== false;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    platform: 'JanSetu (जनसेतु) National Welfare Portal',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    database: mongoStatus,
    security: {
      rateLimitingActive: true,
      helmetProtection: true,
      privateStorageIsolated: true,
      demoResetAllowed: !isProd
    }
  });
});

// 8. Frontend Navigation Fallbacks
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/signup.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});
app.get('/officer', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/officer.html'));
});
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/assets/favicon.svg'));
});

// 9. Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS policy violation')) {
    return res.status(403).json({
      success: false,
      message: err.message
    });
  }

  if (isProd) {
    console.error(`[JanSetu Production Error] ${err.message}`);
  } else {
    console.error('[JanSetu Error]', err.stack || err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: isProd && !err.status
      ? 'An unexpected internal error occurred on the JanSetu platform.'
      : (err.message || 'An unexpected error occurred.')
  });
});

// 10. Server Boot
async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`   JANSETU (जनसेतु) - National Welfare Portal          `);
    console.log(`   Tagline: "Har Parivaar, Har Haq, Ek Setu."          `);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Server running on: http://localhost:${PORT}         `);
    console.log(`   Citizen Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`   Officer Dashboard: http://localhost:${PORT}/officer.html  `);
    console.log(`   Database Mode: ${getMongoStatus().mode}             `);
    console.log(`=======================================================`);
  });
}

startServer();
