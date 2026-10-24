const mongoose = require('mongoose');

// 1. UserAccount
const UserAccountSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // e.g. FAM-1001 or OFFICER-01
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['citizen', 'officer', 'admin'], default: 'citizen' },
  familyId: { type: String }, // For citizen accounts
  officerName: { type: String }, // For officer accounts
  designation: { type: String },
  email: { type: String },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['pending', 'active', 'rejected', 'suspended'], default: 'pending' },
  verificationStatus: { type: String, default: 'pending' },
  verificationSource: { type: String },
  verificationDetails: {
    recordId: String,
    certificateType: String,
    certificateId: String,
    certificateStatus: String,
    requiresManualReview: { type: Boolean, default: false },
    verifiedAt: Date,
    isSimulated: { type: Boolean, default: true }
  },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  rejectionRemarks: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// 2. Household
const HouseholdSchema = new mongoose.Schema({
  familyId: { type: String, required: true, unique: true }, // e.g. FAM-1001
  headCitizenId: { type: String, required: true },
  address: {
    line1: String,
    line2: String,
    district: String,
    state: String,
    pincode: String
  },
  dwellingReference: { type: String }, // e.g. D-104 (critical for housing benefit checks)
  dwellingType: { type: String, enum: ['Kutcha', 'Semi-Pucca', 'Pucca'], default: 'Kutcha' },
  annualIncome: { type: Number, default: 120000 },
  incomeCategory: { type: String, enum: ['BPL', 'AAY', 'APL'], default: 'BPL' },
  rationCardNumber: { type: String },
  verificationStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected', 'Separated'], default: 'Verified' },
  verifiedBy: { type: String },
  verifiedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 3. Citizen
const CitizenSchema = new mongoose.Schema({
  citizenId: { type: String, required: true, unique: true }, // e.g. CIT-1001 (Stable!)
  currentFamilyId: { type: String, required: true }, // current household link
  fullName: { type: String, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  dob: { type: String, required: true }, // YYYY-MM-DD
  age: { type: Number },
  occupation: { type: String },
  education: { type: String },
  isHeadOfFamily: { type: Boolean, default: false },
  isFarmer: { type: Boolean, default: false },
  landholdingHectares: { type: Number, default: 0 },
  hasDisability: { type: Boolean, default: false },
  category: { type: String, default: 'General' },
  maskedAadhaar: { type: String }, // Masked for privacy (e.g. XXXX-XXXX-4589)
  verificationStatus: { 
    type: String, 
    enum: ['Pending Verification', 'Under Review', 'Verified', 'Rejected'], 
    default: 'Pending Verification' 
  },
  verificationSource: { type: String },
  verificationDetails: {
    recordId: String,
    certificateType: String,
    certificateId: String,
    certificateStatus: String,
    requiresManualReview: { type: Boolean, default: false },
    verifiedAt: Date,
    isSimulated: { type: Boolean, default: true },
    note: String
  },
  status: { type: String, enum: ['active', 'inactive', 'separated'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 4. FamilyRelationship
const FamilyRelationshipSchema = new mongoose.Schema({
  relationshipId: { type: String, required: true, unique: true },
  citizenId1: { type: String, required: true }, // e.g. CIT-1001 (Rahul)
  citizenId2: { type: String, required: true }, // e.g. CIT-1002 (Amit)
  relationshipType: { 
    type: String, 
    enum: ['Brother', 'Sister', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Other', 'Other Relative'], 
    required: true 
  },
  isActive: { type: Boolean, default: true },
  notes: { type: String }
});

// 5. HouseholdMembershipHistory
const HouseholdMembershipHistorySchema = new mongoose.Schema({
  historyId: { type: String, required: true, unique: true },
  citizenId: { type: String, required: true },
  familyId: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date }, // null if current
  exitReason: { type: String }, // e.g., 'Approved Household Separation', 'Marriage'
  separationRequestId: { type: String }
});

// 6. Document
const DocumentSchema = new mongoose.Schema({
  documentId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  documentType: { 
    type: String, 
    enum: [
      'Ration Card', 
      'Income Certificate', 
      'Residence Proof', 
      'Land Ownership Record (Khatauni)', 
      'Caste Certificate', 
      'Birth Certificate', 
      'Disability Certificate', 
      'Separation Order',
      'Other'
    ],
    required: true 
  },
  scope: { type: String, enum: ['Household', 'Individual'], default: 'Individual' },
  familyId: { type: String },
  citizenId: { type: String },
  fileUrl: { type: String },
  originalFilename: { type: String },
  fileSize: { type: String },
  issuingAuthority: { type: String },
  maskedReferenceNo: { type: String },
  verificationStatus: { 
    type: String, 
    enum: ['Not Uploaded', 'Uploaded', 'Pending Verification', 'Verified', 'Rejected', 'Expired'],
    default: 'Pending Verification'
  },
  officerRemarks: { type: String },
  verifiedBy: { type: String },
  verifiedAt: { type: Date },
  uploadedAt: { type: Date, default: Date.now }
});

// 7. Scheme
const SchemeSchema = new mongoose.Schema({
  schemeId: { type: String, required: true, unique: true }, // e.g. SCH-PMAY
  name: { type: String, required: true },
  nameHindi: { type: String },
  category: { type: String, required: true }, // Housing, Agriculture, Healthcare, Food Security, etc.
  description: { type: String, required: true },
  benefitType: { type: String, enum: ['Household', 'Individual'], required: true },
  benefitAmount: { type: String },
  requiredDocuments: [{ type: String }],
  imageUrl: { type: String },
  imageAlt: { type: String },
  eligibilityPreview: { type: String },
  rules: {
    maxIncome: { type: Number },
    minAge: { type: Number },
    maxAge: { type: Number },
    requiredDwellingType: [{ type: String }],
    requiresFarmer: { type: Boolean, default: false },
    genderRequirement: { type: String },
    maxBenefitsPerHousehold: { type: Number, default: 1 }
  },
  isActive: { type: Boolean, default: true }
});

// 8. Application
const ApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true }, // e.g. APP-2026-101
  schemeId: { type: String, required: true },
  schemeName: { type: String, required: true },
  benefitType: { type: String, enum: ['Household', 'Individual'], required: true },
  applicantCitizenId: { type: String, required: true },
  applicantName: { type: String, required: true },
  familyId: { type: String, required: true }, // Household at time of application
  dwellingReference: { type: String },
  status: { 
    type: String, 
    enum: ['Draft', 'Submitted', 'Pending Verification', 'Additional Information Required', 'Approved', 'Rejected', 'Disbursed'],
    default: 'Submitted'
  },
  eligibilityAssessment: {
    status: { type: String },
    passedConditions: [String],
    failedConditions: [String],
    missingDocuments: [String],
    explanation: String
  },
  duplicateCheckResult: {
    isPotentialDuplicate: { type: Boolean, default: false },
    flagType: String, // 'HOUSEHOLD_DUPLICATE', 'INDIVIDUAL_DUPLICATE', 'ANCESTRAL_DWELLING_OVERLAP'
    matchedRecordId: String,
    explanation: String,
    requiresOfficerReview: { type: Boolean, default: false }
  },
  officerReview: {
    officerId: String,
    officerName: String,
    decision: String,
    remarks: String,
    reviewedAt: Date
  },
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    remarks: String,
    actor: String
  }],
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 9. BenefitRecord
const BenefitRecordSchema = new mongoose.Schema({
  benefitRecordId: { type: String, required: true, unique: true },
  schemeId: { type: String, required: true },
  schemeName: { type: String, required: true },
  benefitType: { type: String, enum: ['Household', 'Individual'], required: true },
  familyId: { type: String, required: true },
  citizenId: { type: String, required: true },
  dwellingReference: { type: String },
  disbursedAmount: { type: String },
  financialYear: { type: String },
  disbursedDate: { type: Date },
  status: { type: String, default: 'Disbursed' }
});

// 10. HouseholdSeparationRequest
const HouseholdSeparationRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true }, // e.g. SEP-2026-001
  originalFamilyId: { type: String, required: true },
  initiatorCitizenId: { type: String, required: true },
  movingCitizenIds: [{ type: String, required: true }],
  newAddress: {
    line1: String,
    line2: String,
    district: String,
    state: String,
    pincode: String
  },
  newDwellingReference: { type: String },
  separationDate: { type: String, required: true },
  reason: { type: String, required: true },
  supportingDocuments: [{
    title: String,
    fileUrl: String,
    documentType: String
  }],
  status: { 
    type: String, 
    enum: ['Pending Verification', 'Additional Information Required', 'Approved', 'Rejected'],
    default: 'Pending Verification'
  },
  generatedNewFamilyId: { type: String }, // Assigned upon approval
  officerReview: {
    officerId: String,
    officerName: String,
    decision: String,
    mandatoryReason: String,
    reviewedAt: Date
  },
  requestedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 11. ProfileCorrectionRequest
const ProfileCorrectionRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true }, // e.g. COR-2026-001
  requesterId: { type: String, required: true }, // authenticated user userId
  citizenId: { type: String, required: true },
  familyId: { type: String, required: true },
  fieldToCorrect: { type: String, required: true }, // e.g. 'fullName', 'dob', 'gender', 'address'
  currentValue: { type: String, default: '' },
  requestedValue: { type: String, required: true },
  proposedValue: { type: String }, // maintained for backward compatibility
  reason: { type: String, required: true },
  documentType: {
    type: String,
    required: true,
    enum: [
      'Aadhaar Card',
      'Voter ID Card',
      'Passport',
      'Matriculation / Class 10 Certificate',
      'Birth Certificate',
      'Driving Licence',
      'PAN Card',
      'Other'
    ]
  },
  otherDocumentType: { type: String, default: null },
  originalFilename: { type: String, required: true },
  storedFilename: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, default: 'application/pdf' },
  uploadedAt: { type: Date, default: Date.now },
  supportingDocumentUrl: { type: String }, // maintained for backward compatibility
  status: { 
    type: String, 
    enum: [
      'Pending',
      'Under Review',
      'Approved',
      'Rejected',
      'Additional Evidence Required',
      'Pending Verification',
      'Additional Information Required'
    ],
    default: 'Pending'
  },
  officerComment: { type: String, default: null },
  reviewedBy: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  officerReview: {
    officerId: String,
    officerName: String,
    officerRemarks: String,
    decision: String,
    reviewedAt: Date
  },
  reviewHistory: [{
    action: String,
    actorId: String,
    actorRole: String,
    comments: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 12. Notification
const NotificationSchema = new mongoose.Schema({
  notificationId: { type: String, required: true, unique: true },
  recipientType: { type: String, enum: ['Household', 'Officer', 'Citizen'], required: true },
  recipientId: { type: String, required: true }, // familyId, citizenId, or 'ALL_OFFICERS'
  title: { type: String, required: true },
  message: { type: String, required: true },
  category: { type: String, enum: ['Scheme', 'Separation', 'Document', 'Correction', 'System'], default: 'System' },
  relatedEntityId: { type: String },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// 13. AuditLog
const AuditLogSchema = new mongoose.Schema({
  logId: { type: String, required: true, unique: true },
  actorId: { type: String, required: true },
  actorRole: { type: String, required: true },
  action: { type: String, required: true },
  targetEntity: { type: String, required: true },
  targetEntityId: { type: String, required: true },
  details: { type: String },
  previousState: mongoose.Schema.Types.Mixed,
  newState: mongoose.Schema.Types.Mixed,
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = {
  UserAccount: mongoose.models.UserAccount || mongoose.model('UserAccount', UserAccountSchema),
  Household: mongoose.models.Household || mongoose.model('Household', HouseholdSchema),
  Citizen: mongoose.models.Citizen || mongoose.model('Citizen', CitizenSchema),
  FamilyRelationship: mongoose.models.FamilyRelationship || mongoose.model('FamilyRelationship', FamilyRelationshipSchema),
  HouseholdMembershipHistory: mongoose.models.HouseholdMembershipHistory || mongoose.model('HouseholdMembershipHistory', HouseholdMembershipHistorySchema),
  Document: mongoose.models.Document || mongoose.model('Document', DocumentSchema),
  Scheme: mongoose.models.Scheme || mongoose.model('Scheme', SchemeSchema),
  Application: mongoose.models.Application || mongoose.model('Application', ApplicationSchema),
  BenefitRecord: mongoose.models.BenefitRecord || mongoose.model('BenefitRecord', BenefitRecordSchema),
  HouseholdSeparationRequest: mongoose.models.HouseholdSeparationRequest || mongoose.model('HouseholdSeparationRequest', HouseholdSeparationRequestSchema),
  ProfileCorrectionRequest: mongoose.models.ProfileCorrectionRequest || mongoose.model('ProfileCorrectionRequest', ProfileCorrectionRequestSchema),
  Notification: mongoose.models.Notification || mongoose.model('Notification', NotificationSchema),
  AuditLog: mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)
};
