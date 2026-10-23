const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env')
});

const express = require('express');
const cors = require('cors');
const { connectDB, getMongoStatus } = require('./config/db');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database (with automatic fallback to in-memory/file demo store)
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API Routes
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'JanSetu (जनसेतु)',
    tagline: 'Har Parivaar, Har Haq, Ek Setu.',
    timestamp: new Date(),
    database: getMongoStatus()
  });
});

// Fallback route for SPA / direct navigation to frontend pages
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[JanSetu Error]', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected internal error occurred on the JanSetu platform.'
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`   JANSETU (जनसेतु) - TechTrix'26                      `);
  console.log(`   Tagline: "Har Parivaar, Har Haq, Ek Setu."          `);
  console.log(`   Server running on: http://localhost:${PORT}         `);
  console.log(`   Citizen Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`   Officer Dashboard: http://localhost:${PORT}/officer.html  `);
  console.log(`   Database Mode: ${getMongoStatus().mode}             `);
  console.log(`=======================================================`);
});
