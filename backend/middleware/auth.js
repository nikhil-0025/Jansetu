const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jansetu_super_secure_jwt_secret_key_2026';

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.userId,
      role: user.role,
      status: user.status || (user.isActive ? 'active' : 'pending'),
      familyId: user.familyId || null,
      officerName: user.officerName || null,
      designation: user.designation || null
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const requireAuth = (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required. Please sign in to access this JanSetu service.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Reject pending registrations from accessing protected citizen services
    if (decoded.status === 'pending') {
      return res.status(403).json({
        success: false,
        accountStatus: 'pending',
        message: 'Access denied: Account registration is pending officer verification. Protected citizen services cannot be accessed until approved.'
      });
    }

    if (decoded.status === 'rejected') {
      return res.status(403).json({
        success: false,
        accountStatus: 'rejected',
        message: 'Access denied: Account registration was rejected during verification.'
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Session has expired or is invalid. Please sign in again.'
    });
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to authorized roles [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`
      });
    }
    next();
  };
};

const requireHouseholdAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  // Officers and Admins can access any household
  if (['officer', 'admin'].includes(req.user.role)) {
    return next();
  }

  // Citizens can only access their own household
  const requestedFamilyId = req.params.familyId || req.query.familyId || req.body.familyId;
  if (requestedFamilyId && requestedFamilyId !== req.user.familyId) {
    return res.status(403).json({
      success: false,
      message: `Access denied. You are authenticated under Family ID '${req.user.familyId}' and cannot access records belonging to '${requestedFamilyId}'.`
    });
  }
  next();
};

module.exports = {
  generateToken,
  requireAuth,
  requireRole,
  requireHouseholdAccess
};
