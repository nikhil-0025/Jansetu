const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const dataStore = require('../models/dataStore');
const { generateToken, requireAuth } = require('../middleware/auth');
const { getMongoStatus } = require('../config/db');
const { verifyCertificate } = require('../services/identityVerificationService');
const { UserAccount, Household, Citizen, AuditLog } = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// In-memory sliding window rate limiter for signup & verification attempts
const ipSignupTracker = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_SIGNUPS_PER_WINDOW = 20;

function checkSignupRateLimit(ip) {
  const now = Date.now();
  const timestamps = (ipSignupTracker.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_SIGNUPS_PER_WINDOW) {
    return false;
  }
  timestamps.push(now);
  ipSignupTracker.set(ip, timestamps);
  return true;
}

// POST /api/auth/verify-certificate - Instant pre-verification against synthetic test dataset
router.post('/verify-certificate', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkSignupRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many verification requests. Please wait a minute before trying again.'
    });
  }

  try {
    const { certificateType, certificateId, fullName, dateOfBirth, familyReferenceId } = req.body;

    if (!certificateType || !certificateId || !fullName || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'Please provide certificate type, certificate reference, full name, and date of birth.'
      });
    }

    const result = await verifyCertificate({
      certificateType,
      certificateId,
      fullName,
      dateOfBirth,
      familyReferenceId
    });

    if (result.status === 'UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        status: result.status,
        message: result.message,
        isSimulated: false
      });
    }

    if (!result.success) {
      return res.status(400).json({
        success: false,
        status: result.status,
        message: result.message
      });
    }

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    if (err.code === 'DB_UNAVAILABLE' || err.status === 503) {
      return res.status(503).json({
        success: false,
        status: 'DB_UNAVAILABLE',
        message: 'Verification database is currently unreachable. Please try again later.'
      });
    }
    console.error('Verify certificate error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during certificate verification.' });
  }
});

// POST /api/auth/signup - Citizen registration flow with strict synthetic verification
router.post('/signup', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkSignupRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please wait a minute before trying again.'
    });
  }

  try {
    const {
      fullName,
      dateOfBirth,
      certificateType,
      certificateId,
      password,
      mobile,
      email,
      familyReferenceId
    } = req.body;

    // 1. Validate required fields
    if (!fullName || !dateOfBirth || !certificateType || !certificateId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fullName, dateOfBirth, certificateType, certificateId, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const cleanCertId = String(certificateId).trim();

    // 2. Prevent duplicate registrations
    let existingAccount = null;
    if (isMongoReady()) {
      try {
        existingAccount = await UserAccount.findOne({
          'verificationDetails.certificateId': cleanCertId
        }).lean();
      } catch (e) {}
    } else {
      const allUsers = dataStore.getAllUsers ? dataStore.getAllUsers() : [];
      existingAccount = allUsers.find(u =>
        u.verificationDetails && u.verificationDetails.certificateId === cleanCertId
      );
    }

    if (existingAccount) {
      return res.status(409).json({
        success: false,
        message: 'An account with this certificate reference is already registered. Please sign in or contact a verification officer.'
      });
    }

    // 3. Verify certificate against MongoDB Atlas verification_records
    let verification;
    try {
      verification = await verifyCertificate({
        certificateType,
        certificateId: cleanCertId,
        fullName,
        dateOfBirth,
        familyReferenceId
      });
    } catch (verifyErr) {
      if (verifyErr.code === 'DB_UNAVAILABLE' || verifyErr.status === 503) {
        return res.status(503).json({
          success: false,
          status: 'DB_UNAVAILABLE',
          message: 'Verification database is currently unreachable. Please try again later.'
        });
      }
      throw verifyErr;
    }

    if (verification.status === 'UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        status: 'UNAVAILABLE',
        message: verification.message,
        isSimulated: false
      });
    }

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        status: verification.status,
        message: verification.message
      });
    }

    // 4. Generate stable unique IDs
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const familyId = `FAM-${randomSuffix}`;
    const citizenId = `CIT-${randomSuffix}`;
    const userId = familyId;

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // SECURITY GUARANTEE: Never trust client-submitted role, status, or verified flag
    const newAccountData = {
      userId,
      passwordHash,
      role: 'citizen', // Strictly enforced
      status: 'pending', // Strictly enforced: new accounts always pending
      verificationStatus: verification.status === 'REVIEW_REQUIRED' ? 'review_required' : 'pending_officer_approval',
      familyId,
      email: email || `${userId.toLowerCase()}@jansetu.local`,
      phone: mobile || '',
      verificationSource: verification.verificationSource,
      verificationDetails: {
        recordId: verification.recordId,
        certificateType: verification.certificateType,
        certificateId: verification.certificateId,
        certificateStatus: verification.certificateStatus,
        requiresManualReview: Boolean(verification.requiresManualReview),
        verifiedAt: new Date(),
        isSimulated: true
      },
      isActive: true,
      createdAt: new Date()
    };

    const newHouseholdData = {
      familyId,
      headCitizenId: citizenId,
      address: {
        line1: verification.address || 'Registered Address',
        district: verification.district || 'District',
        state: verification.state || 'State',
        pincode: '221001'
      },
      dwellingReference: `D-${randomSuffix}`,
      dwellingType: 'Kutcha',
      annualIncome: 120000,
      incomeCategory: 'BPL',
      verificationStatus: 'Pending',
      createdAt: new Date()
    };

    const newCitizenData = {
      citizenId,
      currentFamilyId: familyId,
      fullName: fullName.trim(),
      gender: 'Other',
      dob: dateOfBirth,
      isHeadOfFamily: true,
      createdAt: new Date()
    };

    // Save to MongoDB Atlas if connected
    if (isMongoReady()) {
      try {
        await UserAccount.create(newAccountData);
        await Household.create(newHouseholdData);
        await Citizen.create(newCitizenData);
        await AuditLog.create({
          logId: `AUD-${Date.now()}`,
          actorId: userId,
          actorRole: 'citizen',
          action: 'CITIZEN_SIGNUP',
          targetEntity: 'UserAccount',
          targetEntityId: userId,
          details: `Citizen self-registration submitted in pending state (simulated verification with ${verification.certificateType} ${verification.certificateId}).`,
          ipAddress: clientIp,
          timestamp: new Date()
        });
      } catch (dbErr) {
        console.error('[JanSetu Signup] MongoDB write failed:', dbErr);
        return res.status(500).json({
          success: false,
          message: 'Failed to complete registration due to database error. Please try again.'
        });
      }
    }

    // Always keep dataStore updated
    dataStore.createUser(newAccountData);
    dataStore.createHousehold(newHouseholdData);
    dataStore.createCitizen(newCitizenData);
    if (dataStore.getDB && dataStore.getDB().auditLogs) {
      dataStore.getDB().auditLogs.push({
        logId: `AUD-${Date.now()}`,
        actorId: userId,
        actorRole: 'citizen',
        action: 'CITIZEN_SIGNUP',
        targetEntity: 'UserAccount',
        targetEntityId: userId,
        details: `Citizen self-registration submitted in pending state.`,
        timestamp: new Date()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Citizen registration submitted successfully. Your account has been created in a pending state awaiting officer verification.',
      accountStatus: 'pending',
      userId,
      familyId,
      citizenId,
      fullName: fullName.trim(),
      certificateType: verification.certificateType,
      certificateId: verification.certificateId,
      verificationStatus: newAccountData.verificationStatus,
      requiresManualReview: Boolean(verification.requiresManualReview),
      isSimulated: true,
      disclaimer: 'Simulated verification using fictional test records. Not official government verification.'
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({
      success: false,
      message: 'An unexpected internal error occurred during registration.'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { userId, password, expectedRole } = req.body;

    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both User Identifier (Family ID / Officer ID) and password.'
      });
    }

    // Look up user from MongoDB Atlas first if connected, then dataStore
    let user = null;
    if (isMongoReady()) {
      try {
        user = await UserAccount.findOne({
          userId: { $regex: new RegExp(`^${userId.trim()}$`, 'i') }
        }).lean();
      } catch (dbErr) {
        console.warn('[Auth] Mongo lookup failed, checking in-memory store:', dbErr.message);
      }
    }
    if (!user) {
      user = dataStore.findUserByUserId(userId);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `Account '${userId}' not found. Verify your credentials or use the provided demo accounts.`
      });
    }

    // Role check if client explicitly expects an officer vs citizen portal
    if (expectedRole && user.role !== expectedRole) {
      if (expectedRole === 'officer' && user.role === 'citizen') {
        return res.status(403).json({
          success: false,
          message: 'This is a Citizen Family account. Please use the Citizen Portal to sign in.'
        });
      }
      if (expectedRole === 'citizen' && user.role !== 'citizen') {
        return res.status(403).json({
          success: false,
          message: 'This is an Officer/Admin account. Please use the Government Officer Portal to sign in.'
        });
      }
    }

    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. For demo accounts, use password "citizen123" or "officer123".'
      });
    }

    // RESTRICTION: Do not allow pending accounts to access protected citizen services
    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        accountStatus: 'pending',
        message: 'Your JanSetu account registration is pending officer verification. Access to protected citizen services is restricted until approved.'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        accountStatus: 'rejected',
        message: 'Your account registration was rejected during verification review. Please contact your local administrative office.'
      });
    }

    const token = generateToken(user);

    // Fetch associated citizen head details if citizen
    let citizenInfo = null;
    let householdInfo = null;
    if (user.role === 'citizen' && user.familyId) {
      householdInfo = dataStore.findHousehold(user.familyId);
      if (householdInfo) {
        citizenInfo = dataStore.findCitizen(householdInfo.headCitizenId);
      }
    }

    res.json({
      success: true,
      message: 'Authentication successful. Welcome to JanSetu.',
      token,
      user: {
        userId: user.userId,
        role: user.role,
        status: user.status || 'active',
        familyId: user.familyId,
        officerName: user.officerName,
        designation: user.designation,
        email: user.email,
        phone: user.phone,
        headName: citizenInfo ? citizenInfo.fullName : null,
        headCitizenId: citizenInfo ? citizenInfo.citizenId : null,
        householdStatus: householdInfo ? householdInfo.verificationStatus : null
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  let user = null;
  if (isMongoReady()) {
    try {
      user = await UserAccount.findOne({ userId: req.user.userId }).lean();
    } catch (e) {}
  }
  if (!user) {
    user = dataStore.findUserByUserId(req.user.userId);
  }

  if (!user) {
    return res.status(404).json({ success: false, message: 'User record not found.' });
  }

  let citizenInfo = null;
  let householdInfo = null;
  if (user.role === 'citizen' && user.familyId) {
    householdInfo = dataStore.findHousehold(user.familyId);
    if (householdInfo) {
      citizenInfo = dataStore.findCitizen(householdInfo.headCitizenId);
    }
  }

  res.json({
    success: true,
    user: {
      userId: user.userId,
      role: user.role,
      status: user.status || 'active',
      familyId: user.familyId,
      officerName: user.officerName,
      designation: user.designation,
      email: user.email,
      phone: user.phone,
      headName: citizenInfo ? citizenInfo.fullName : null,
      headCitizenId: citizenInfo ? citizenInfo.citizenId : null,
      householdStatus: householdInfo ? householdInfo.verificationStatus : null
    }
  });
});

// POST /api/auth/reset-demo
router.post('/reset-demo', async (req, res) => {
  const result = dataStore.resetToInitialDemo();
  if (isMongoReady()) {
    try {
      const { FamilyRelationship, HouseholdSeparationRequest } = require('../models/schemaDefinitions');
      await Citizen.deleteMany({ citizenId: { $nin: ['CIT-1001', 'CIT-1002', 'CIT-1003', 'CIT-1004', 'CIT-2001'] } });
      await Household.deleteMany({ familyId: { $nin: ['FAM-1001', 'FAM-2001'] } });
      await UserAccount.deleteMany({ userId: { $nin: ['FAM-1001', 'FAM-2001', 'OFFICER-01', 'ADMIN-01'] } });
      await FamilyRelationship.deleteMany({ relationshipId: { $nin: ['REL-001', 'REL-002', 'REL-003'] } });
      await HouseholdSeparationRequest.deleteMany({});
    } catch (dbErr) {
      console.warn('[reset-demo] MongoDB cleanup notice:', dbErr.message);
    }
  }
  res.json(result);
});

// GET /api/auth/system-status
router.get('/system-status', (req, res) => {
  res.json({
    success: true,
    platform: 'JanSetu (जनसेतु)',
    tagline: 'Har Parivaar, Har Haq, Ek Setu.',
    hackathon: 'TechTrix’26',
    dbStatus: getMongoStatus(),
    verificationMode: process.env.IDENTITY_VERIFICATION_MODE || 'synthetic',
    demoCredentials: {
      citizenFamily1: { id: 'FAM-1001', pass: 'citizen123', label: 'Rahul Sharma & Family (Initial Combined Household)' },
      citizenFamily2: { id: 'FAM-2001', pass: 'citizen123', label: 'Amit Sharma (Available post-separation)' },
      officer: { id: 'OFFICER-01', pass: 'officer123', label: 'Vikramaditya Verma (Verification Officer)' },
      admin: { id: 'ADMIN-01', pass: 'admin123', label: 'Sanjay Deshmukh (Portal Admin)' }
    }
  });
});

module.exports = router;
