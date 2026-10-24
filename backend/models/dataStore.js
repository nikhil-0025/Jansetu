const path = require('path');
const bcrypt = require('bcryptjs');

// In-Memory state with deep cloneable seed data
let db = null;

const createInitialSeedData = () => {
  const salt = bcrypt.genSaltSync(10);
  const citizenHash = bcrypt.hashSync('citizen123', salt);
  const officerHash = bcrypt.hashSync('officer123', salt);
  const adminHash = bcrypt.hashSync('admin123', salt);

  return {
    userAccounts: [
      {
        userId: 'FAM-1001',
        passwordHash: citizenHash,
        role: 'citizen',
        familyId: 'FAM-1001',
        email: 'rahul.sharma@example.com',
        phone: '9876543210',
        isActive: true,
        status: 'active',
        createdAt: new Date('2024-01-15')
      },
      {
        userId: 'OFFICER-01',
        passwordHash: officerHash,
        role: 'officer',
        officerName: 'Vikramaditya Verma',
        designation: 'Senior Block Development & Verification Officer',
        email: 'vikram.verma@gov.in',
        phone: '9811223344',
        isActive: true,
        status: 'active',
        createdAt: new Date('2023-05-10')
      },
      {
        userId: 'ADMIN-01',
        passwordHash: adminHash,
        role: 'admin',
        officerName: 'Sanjay Deshmukh',
        designation: 'State Portal Administrator',
        email: 'admin.jansetu@gov.in',
        phone: '9800112233',
        isActive: true,
        status: 'active',
        createdAt: new Date('2023-01-01')
      },
      {
        userId: 'FAM-2001',
        passwordHash: citizenHash,
        role: 'citizen',
        familyId: 'FAM-2001',
        email: 'rajesh.verma@example.com',
        phone: '9876543211',
        isActive: true,
        status: 'active',
        createdAt: new Date('2024-02-01')
      }
    ],

    households: [
      {
        familyId: 'FAM-1001',
        identifierType: 'Local JanSetu System Household ID (Not an official National Family ID)',
        headCitizenId: 'CIT-1001',
        address: {
          line1: 'House No. 42, Ward 7',
          line2: 'Rampur Village, Sevapuri Block',
          district: 'Varanasi',
          state: 'Uttar Pradesh',
          pincode: '221001'
        },
        dwellingReference: 'D-104',
        dwellingType: 'Kutcha',
        annualIncome: 120000,
        incomeCategory: 'BPL',
        rationCardNumber: 'RC-UP-2024-98421',
        verificationStatus: 'Verified',
        verifiedBy: 'OFFICER-01',
        verifiedAt: new Date('2024-01-20'),
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20')
      },
      {
        familyId: 'FAM-2001',
        identifierType: 'Local JanSetu System Household ID (Not an official National Family ID)',
        headCitizenId: 'CIT-2001',
        address: {
          line1: 'House No. 18, Ward 3',
          line2: 'Shivpur, Sevapuri Block',
          district: 'Varanasi',
          state: 'Uttar Pradesh',
          pincode: '221002'
        },
        dwellingReference: 'D-201',
        dwellingType: 'Semi-Pucca',
        annualIncome: 150000,
        incomeCategory: 'BPL',
        rationCardNumber: 'RC-UP-2024-77123',
        verificationStatus: 'Verified',
        verifiedBy: 'OFFICER-01',
        verifiedAt: new Date('2024-02-05'),
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-05')
      }
    ],

    citizens: [
      {
        citizenId: 'CIT-2001',
        currentFamilyId: 'FAM-2001',
        fullName: 'Rajesh Verma',
        gender: 'Male',
        dob: '1985-03-14',
        age: 39,
        occupation: 'Carpenter & Artisan',
        education: 'Secondary School',
        isHeadOfFamily: true,
        isFarmer: false,
        landholdingHectares: 0,
        hasDisability: false,
        category: 'OBC',
        maskedAadhaar: 'XXXX-XXXX-1122',
        verificationStatus: 'Verified',
        status: 'active',
        createdAt: new Date('2024-02-01')
      },
      {
        citizenId: 'CIT-1001',
        currentFamilyId: 'FAM-1001',
        fullName: 'Rahul Sharma',
        gender: 'Male',
        dob: '1988-06-12',
        age: 36,
        occupation: 'Farmer & Cultivator',
        education: 'Secondary School',
        isHeadOfFamily: true,
        isFarmer: true,
        landholdingHectares: 1.2,
        hasDisability: false,
        category: 'OBC',
        maskedAadhaar: 'XXXX-XXXX-8921',
        verificationStatus: 'Verified',
        status: 'active',
        createdAt: new Date('2024-01-15')
      },
      {
        citizenId: 'CIT-1002',
        currentFamilyId: 'FAM-1001',
        fullName: 'Amit Sharma',
        gender: 'Male',
        dob: '1992-11-24',
        age: 32,
        occupation: 'Certified Electrician',
        education: 'Higher Secondary & ITI Diploma',
        isHeadOfFamily: false,
        isFarmer: false,
        landholdingHectares: 0,
        hasDisability: false,
        category: 'OBC',
        maskedAadhaar: 'XXXX-XXXX-3342',
        verificationStatus: 'Verified',
        status: 'active',
        createdAt: new Date('2024-01-15')
      },
      {
        citizenId: 'CIT-1003',
        currentFamilyId: 'FAM-1001',
        fullName: 'Sunita Sharma',
        gender: 'Female',
        dob: '1991-03-08',
        age: 33,
        occupation: 'Self-Employed (Tailoring / SHG)',
        education: 'Secondary School',
        isHeadOfFamily: false,
        isFarmer: false,
        landholdingHectares: 0,
        hasDisability: false,
        category: 'OBC',
        maskedAadhaar: 'XXXX-XXXX-7119',
        verificationStatus: 'Verified',
        status: 'active',
        createdAt: new Date('2024-01-15')
      },
      {
        citizenId: 'CIT-1004',
        currentFamilyId: 'FAM-1001',
        fullName: 'Aarav Sharma',
        gender: 'Male',
        dob: '2014-08-19',
        age: 10,
        occupation: 'Primary School Student',
        education: 'Class 5th',
        isHeadOfFamily: false,
        isFarmer: false,
        landholdingHectares: 0,
        hasDisability: false,
        category: 'OBC',
        maskedAadhaar: 'XXXX-XXXX-9904',
        verificationStatus: 'Verified',
        status: 'active',
        createdAt: new Date('2024-01-15')
      }
    ],

    familyRelationships: [
      {
        relationshipId: 'REL-001',
        citizenId1: 'CIT-1001',
        citizenId2: 'CIT-1002',
        relationshipType: 'Brother',
        isActive: true,
        notes: 'Biological Brothers (Share same father: Late Ramswaroop Sharma)'
      },
      {
        relationshipId: 'REL-002',
        citizenId1: 'CIT-1001',
        citizenId2: 'CIT-1003',
        relationshipType: 'Spouse',
        isActive: true,
        notes: 'Legally Married'
      },
      {
        relationshipId: 'REL-003',
        citizenId1: 'CIT-1001',
        citizenId2: 'CIT-1004',
        relationshipType: 'Father',
        isActive: true,
        notes: 'Father - Son'
      },
      {
        relationshipId: 'REL-004',
        citizenId1: 'CIT-1003',
        citizenId2: 'CIT-1004',
        relationshipType: 'Mother',
        isActive: true,
        notes: 'Mother - Son'
      },
      {
        relationshipId: 'REL-005',
        citizenId1: 'CIT-1002',
        citizenId2: 'CIT-1004',
        relationshipType: 'Other',
        isActive: true,
        notes: 'Paternal Uncle (Chacha) - Nephew'
      }
    ],

    membershipHistory: [
      {
        historyId: 'HIST-001',
        citizenId: 'CIT-1001',
        familyId: 'FAM-1001',
        startDate: new Date('2018-04-01'),
        endDate: null,
        exitReason: null
      },
      {
        historyId: 'HIST-002',
        citizenId: 'CIT-1002',
        familyId: 'FAM-1001',
        startDate: new Date('2018-04-01'),
        endDate: null,
        exitReason: null
      },
      {
        historyId: 'HIST-003',
        citizenId: 'CIT-1003',
        familyId: 'FAM-1001',
        startDate: new Date('2018-04-01'),
        endDate: null,
        exitReason: null
      },
      {
        historyId: 'HIST-004',
        citizenId: 'CIT-1004',
        familyId: 'FAM-1001',
        startDate: new Date('2018-04-01'),
        endDate: null,
        exitReason: null
      }
    ],

    documents: [
      {
        documentId: 'DOC-101',
        title: 'Priority Household Ration Card',
        documentType: 'Ration Card',
        scope: 'Household',
        familyId: 'FAM-1001',
        citizenId: null,
        fileUrl: '/uploads/sample_ration_card.pdf',
        originalFilename: 'ration_card_fam1001.pdf',
        fileSize: '1.4 MB',
        issuingAuthority: 'Department of Food & Civil Supplies, Govt. of UP',
        maskedReferenceNo: 'RC-UP-****-98421',
        verificationStatus: 'Verified',
        officerRemarks: 'Verified against State Food Portal records.',
        verifiedBy: 'OFFICER-01',
        verifiedAt: new Date('2024-01-20'),
        uploadedAt: new Date('2024-01-18')
      },
      {
        documentId: 'DOC-102',
        title: 'Tahsildar Income Certificate',
        documentType: 'Income Certificate',
        scope: 'Household',
        familyId: 'FAM-1001',
        citizenId: 'CIT-1001',
        fileUrl: '/uploads/sample_income_cert.pdf',
        originalFilename: 'income_cert_2024.pdf',
        fileSize: '820 KB',
        issuingAuthority: 'Revenue Department / Tahsildar Sevapuri',
        maskedReferenceNo: 'INC-2024-****-4412',
        verificationStatus: 'Verified',
        officerRemarks: 'Certified annual household income: ₹1,20,000.',
        verifiedBy: 'OFFICER-01',
        verifiedAt: new Date('2024-01-20'),
        uploadedAt: new Date('2024-01-18')
      },
      {
        documentId: 'DOC-103',
        title: 'Agricultural Land Record (Khatauni / RoR)',
        documentType: 'Land Ownership Record (Khatauni)',
        scope: 'Individual',
        familyId: 'FAM-1001',
        citizenId: 'CIT-1001',
        fileUrl: '/uploads/sample_land_khatauni.pdf',
        originalFilename: 'khatauni_khasra_78.pdf',
        fileSize: '2.1 MB',
        issuingAuthority: 'Bhulekh UP / Revenue Council',
        maskedReferenceNo: 'KHAT-****-8821',
        verificationStatus: 'Verified',
        officerRemarks: 'Verified 1.20 Hectares agricultural parcel registered to Rahul Sharma.',
        verifiedBy: 'OFFICER-01',
        verifiedAt: new Date('2024-02-05'),
        uploadedAt: new Date('2024-02-01')
      },
      {
        documentId: 'DOC-104',
        title: 'Electricity Connection Bill & Residence Proof',
        documentType: 'Residence Proof',
        scope: 'Household',
        familyId: 'FAM-1001',
        citizenId: null,
        fileUrl: '/uploads/sample_electricity_bill.pdf',
        originalFilename: 'residence_proof_d104.pdf',
        fileSize: '650 KB',
        issuingAuthority: 'UPPCL (Purvanchal Vidyut Vitran Nigam)',
        maskedReferenceNo: 'CA-****-9012',
        verificationStatus: 'Verified',
        officerRemarks: 'Valid residence proof for Dwelling Reference D-104.',
        verifiedBy: 'OFFICER-01',
        verifiedAt: new Date('2024-01-20'),
        uploadedAt: new Date('2024-01-18')
      },
      {
        documentId: 'DOC-105',
        title: 'Birth Certificate - Aarav Sharma',
        documentType: 'Birth Certificate',
        scope: 'Individual',
        familyId: 'FAM-1001',
        citizenId: 'CIT-1004',
        fileUrl: '/uploads/sample_birth_cert.pdf',
        originalFilename: 'birth_cert_aarav.pdf',
        fileSize: '910 KB',
        issuingAuthority: 'Office of Registrar of Births & Deaths, Varanasi',
        maskedReferenceNo: 'BC-2014-****-1002',
        verificationStatus: 'Verified',
        officerRemarks: 'Verified DOB: 19-08-2014.',
        verifiedBy: 'OFFICER-01',
        verifiedAt: new Date('2024-01-22'),
        uploadedAt: new Date('2024-01-20')
      },
      {
        documentId: 'DOC-106',
        title: 'ITI Electrician Skill Certificate - Amit Sharma',
        documentType: 'Other',
        scope: 'Individual',
        familyId: 'FAM-1001',
        citizenId: 'CIT-1002',
        fileUrl: '/uploads/sample_iti_cert.pdf',
        originalFilename: 'iti_diploma_amit.pdf',
        fileSize: '1.1 MB',
        issuingAuthority: 'NCVT / Directorate General of Training',
        maskedReferenceNo: 'NCVT-****-5521',
        verificationStatus: 'Pending Verification',
        officerRemarks: null,
        verifiedBy: null,
        verifiedAt: null,
        uploadedAt: new Date('2024-10-10')
      }
    ],

    schemes: [
      {
        schemeId: 'SCH-PMAY-G',
        name: 'Pradhan Mantri Awas Yojana - Gramin (PMAY-G)',
        nameHindi: 'प्रधानमंत्री आवास योजना - ग्रामीण',
        category: 'Housing',
        description: 'Provision of financial assistance of ₹1,20,000 to houseless households and those living in kutcha and dilapidated houses for constructing a pucca dwelling unit.',
        benefitType: 'Household',
        benefitAmount: '₹1,20,000 one-time grant',
        requiredDocuments: ['Ration Card', 'Income Certificate', 'Residence Proof'],
        imageUrl: '/assets/schemes/pmay-g.svg',
        imageAlt: 'Pradhan Mantri Awas Yojana Gramin rural housing construction scheme',
        eligibilityPreview: 'For houseless families or living in kutcha/semi-pucca houses. Max income ₹3,00,000/yr.',
        rules: {
          maxIncome: 300000,
          requiredDwellingType: ['Kutcha', 'Semi-Pucca'],
          maxBenefitsPerHousehold: 1
        },
        isActive: true
      },
      {
        schemeId: 'SCH-PM-KISAN',
        name: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
        nameHindi: 'प्रधानमंत्री किसान सम्मान निधि',
        category: 'Agriculture',
        description: 'Direct income support of ₹6,000 per year provided in three equal four-monthly installments directly into the Aadhaar-linked bank accounts of landholding farmer families.',
        benefitType: 'Individual',
        benefitAmount: '₹6,000 per year (3 x ₹2,000)',
        requiredDocuments: ['Land Ownership Record (Khatauni)', 'Income Certificate'],
        imageUrl: '/assets/schemes/pm-kisan.svg',
        imageAlt: 'PM Kisan Samman Nidhi farmer direct income support scheme',
        eligibilityPreview: 'For landholding farmer families. Requires verified land ownership (Khatauni) & Age 18+.',
        rules: {
          requiresFarmer: true,
          minAge: 18,
          maxBenefitsPerHousehold: 2
        },
        isActive: true
      },
      {
        schemeId: 'SCH-PM-JAY',
        name: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY)',
        nameHindi: 'आयुष्मान भारत - प्रधानमंत्री जन आरोग्य योजना',
        category: 'Healthcare',
        description: 'Cashless healthcare cover of up to ₹5,00,000 per family per year for secondary and tertiary hospitalization across empaneled public and private hospitals across India.',
        benefitType: 'Household',
        benefitAmount: '₹5,00,000 health cover / year',
        requiredDocuments: ['Ration Card', 'Income Certificate'],
        imageUrl: '/assets/schemes/pm-jay.svg',
        imageAlt: 'Ayushman Bharat PM-JAY cashless hospital healthcare insurance scheme',
        eligibilityPreview: 'For low-income / BPL families. Cashless healthcare cover up to ₹5,00,000/yr per household.',
        rules: {
          maxIncome: 250000,
          maxBenefitsPerHousehold: 1
        },
        isActive: true
      },
      {
        schemeId: 'SCH-NFSA-RATION',
        name: 'National Food Security Act - Antyodaya / Priority Ration',
        nameHindi: 'राष्ट्रीय खाद्य सुरक्षा अधिनियम (राशन योजना)',
        category: 'Food Security',
        description: 'Monthly allocation of essential subsidized food grains (5 kg per person or 35 kg per Antyodaya household) through Fair Price Shops.',
        benefitType: 'Household',
        benefitAmount: 'Monthly Subsidized Grains (Wheat/Rice)',
        requiredDocuments: ['Ration Card', 'Residence Proof'],
        imageUrl: '/assets/schemes/nfsa-ration.svg',
        imageAlt: 'National Food Security Act subsidized grains and ration card scheme',
        eligibilityPreview: 'For Antyodaya & Priority households. Max income ₹1,80,000/yr. Requires Ration Card.',
        rules: {
          maxIncome: 180000,
          maxBenefitsPerHousehold: 1
        },
        isActive: true
      },
      {
        schemeId: 'SCH-PMUY',
        name: 'Pradhan Mantri Ujjwala Yojana (PMUY 2.0)',
        nameHindi: 'प्रधानमंत्री उज्ज्वला योजना 2.0',
        category: 'Energy & Clean Fuel',
        description: 'Deposit-free LPG connection, first refill, and a gas stove provided in the name of an adult woman member of poor/deprived rural households.',
        benefitType: 'Household',
        benefitAmount: 'Free LPG Connection + First Refill',
        requiredDocuments: ['Ration Card', 'Income Certificate', 'Residence Proof'],
        imageUrl: '/assets/schemes/pmuy-ujjwala.svg',
        imageAlt: 'Pradhan Mantri Ujjwala Yojana clean LPG cooking fuel connection scheme',
        eligibilityPreview: 'For adult women in poor/BPL households (Age 18+). Free LPG connection & first refill.',
        rules: {
          genderRequirement: 'Female',
          minAge: 18,
          maxIncome: 200000,
          maxBenefitsPerHousehold: 1
        },
        isActive: true
      },
      {
        schemeId: 'SCH-PMKVY',
        name: 'Pradhan Mantri Kaushal Vikas Yojana (PMKVY 4.0)',
        nameHindi: 'प्रधानमंत्री कौशल विकास योजना',
        category: 'Skill Development',
        description: 'Skill certification, industry-oriented training, and monetary reward to enable Indian youth to secure sustainable livelihood opportunities.',
        benefitType: 'Individual',
        benefitAmount: 'Free Training + Certification + ₹8,000 Stipend',
        requiredDocuments: ['Birth Certificate', 'Income Certificate'],
        imageUrl: '/assets/schemes/pmkvy-skills.svg',
        imageAlt: 'Pradhan Mantri Kaushal Vikas Yojana youth skill certification & stipend scheme',
        eligibilityPreview: 'For Indian youth aged 18 to 35 years seeking certified technical training & livelihood skills.',
        rules: {
          minAge: 18,
          maxAge: 35
        },
        isActive: true
      }
    ],

    applications: [
      {
        applicationId: 'APP-2024-089',
        schemeId: 'SCH-PM-KISAN',
        schemeName: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
        benefitType: 'Individual',
        applicantCitizenId: 'CIT-1001',
        applicantName: 'Rahul Sharma',
        familyId: 'FAM-1001',
        dwellingReference: 'D-104',
        status: 'Approved',
        eligibilityAssessment: {
          status: 'Potentially Eligible',
          passedConditions: [
            'Applicant is verified active farmer with 1.20 Ha landholding',
            'Land ownership Khatauni verified by Revenue Tahsil',
            'Age 36 is within eligible threshold (>= 18 years)',
            'Income is within priority small-farmer bracket'
          ],
          failedConditions: [],
          missingDocuments: [],
          explanation: 'Applicant satisfies all statutory PM-KISAN individual farmer guidelines.'
        },
        duplicateCheckResult: {
          isPotentialDuplicate: false,
          flagType: null,
          matchedRecordId: null,
          explanation: 'No conflicting individual PM-KISAN claim exists for Citizen CIT-1001.',
          requiresOfficerReview: false
        },
        officerReview: {
          officerId: 'OFFICER-01',
          officerName: 'Vikramaditya Verma',
          decision: 'Approved',
          remarks: 'Land record Khatauni verified from UP Bhulekh. Beneficiary approved.',
          reviewedAt: new Date('2024-02-15')
        },
        statusHistory: [
          { status: 'Submitted', timestamp: new Date('2024-02-02'), remarks: 'Application submitted online by citizen', actor: 'Rahul Sharma' },
          { status: 'Approved', timestamp: new Date('2024-02-15'), remarks: 'Approved after field revenue verification', actor: 'OFFICER-01' }
        ],
        submittedAt: new Date('2024-02-02'),
        updatedAt: new Date('2024-02-15')
      }
    ],

    benefitRecords: [
      {
        benefitRecordId: 'BEN-2023-014',
        schemeId: 'SCH-PMAY-G',
        schemeName: 'Pradhan Mantri Awas Yojana - Gramin (PMAY-G)',
        benefitType: 'Household',
        familyId: 'FAM-1001',
        citizenId: 'CIT-1001',
        dwellingReference: 'D-104',
        disbursedAmount: '₹1,20,000 (Installments 1, 2, 3 Complete)',
        financialYear: '2023-24',
        disbursedDate: new Date('2023-11-10'),
        status: 'Disbursed'
      },
      {
        benefitRecordId: 'BEN-2024-099',
        schemeId: 'SCH-PM-KISAN',
        schemeName: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
        benefitType: 'Individual',
        familyId: 'FAM-1001',
        citizenId: 'CIT-1001',
        dwellingReference: 'D-104',
        disbursedAmount: '₹6,000 (FY 2024-25 Installments 1-3)',
        financialYear: '2024-25',
        disbursedDate: new Date('2024-08-15'),
        status: 'Disbursed'
      }
    ],

    separationRequests: [],

    profileCorrections: [
      {
        requestId: 'COR-2026-1001',
        requesterId: 'FAM-1001',
        citizenId: 'CIT-1001',
        familyId: 'FAM-1001',
        fieldToCorrect: 'fullName',
        currentValue: 'Rahul Sharma',
        requestedValue: 'Rahul Kumar Sharma',
        reason: 'Typographical omission in school matriculation certificate; adding middle name as published in State Gazette.',
        documentType: 'Matriculation / Class 10 Certificate',
        otherDocumentType: null,
        originalFilename: 'matriculation_gazette_cert.pdf',
        storedFilename: 'sample_supporting_doc.pdf',
        filePath: path.join(__dirname, '../secure_uploads/corrections/sample_supporting_doc.pdf'),
        fileSize: 148200,
        mimeType: 'application/pdf',
        status: 'Pending',
        createdAt: new Date('2026-10-22T10:30:00Z'),
        updatedAt: new Date('2026-10-22T10:30:00Z')
      },
      {
        requestId: 'COR-2026-1002',
        requesterId: 'FAM-1001',
        citizenId: 'CIT-1002',
        familyId: 'FAM-1001',
        fieldToCorrect: 'occupation',
        currentValue: 'Certified Electrician',
        requestedValue: 'Certified Master Electrician',
        reason: 'Completion of National Trade Certificate from Industrial Training Institute (ITI).',
        documentType: 'Other',
        otherDocumentType: 'National Trade Certificate (NTC)',
        originalFilename: 'iti_trade_certificate.pdf',
        storedFilename: 'sample_supporting_doc.pdf',
        filePath: path.join(__dirname, '../secure_uploads/corrections/sample_supporting_doc.pdf'),
        fileSize: 215400,
        mimeType: 'application/pdf',
        status: 'Approved',
        officerComment: 'Supporting NTC certificate authenticated against NCVT database. Occupation updated.',
        reviewedBy: 'OFFICER-01',
        reviewedAt: new Date('2026-10-23T11:15:00Z'),
        reviewHistory: [
          {
            decision: 'Approved',
            officerRemarks: 'Supporting NTC certificate authenticated against NCVT database. Occupation updated.',
            reviewedBy: 'OFFICER-01',
            reviewedAt: new Date('2026-10-23T11:15:00Z')
          }
        ],
        officerReview: {
          decision: 'Approved',
          officerRemarks: 'Supporting NTC certificate authenticated against NCVT database. Occupation updated.',
          reviewedBy: 'OFFICER-01',
          reviewedAt: new Date('2026-10-23T11:15:00Z')
        },
        createdAt: new Date('2026-10-21T09:00:00Z'),
        updatedAt: new Date('2026-10-23T11:15:00Z')
      }
    ],

    notifications: [
      {
        notificationId: 'NOTIF-001',
        recipientType: 'Household',
        recipientId: 'FAM-1001',
        title: 'Household Registration Verified',
        message: 'Your household FAM-1001 was verified by Block Officer Vikramaditya Verma.',
        category: 'System',
        relatedEntityId: 'FAM-1001',
        isRead: false,
        createdAt: new Date('2024-01-20')
      },
      {
        notificationId: 'NOTIF-002',
        recipientType: 'Household',
        recipientId: 'FAM-1001',
        title: 'PM-KISAN Installment Credited',
        message: 'Application APP-2024-089 for PM-KISAN was approved and benefits disbursed.',
        category: 'Scheme',
        relatedEntityId: 'APP-2024-089',
        isRead: false,
        createdAt: new Date('2024-08-15')
      }
    ],

    auditLogs: [
      {
        logId: 'AUD-001',
        actorId: 'OFFICER-01',
        actorRole: 'officer',
        action: 'VERIFY_HOUSEHOLD',
        targetEntity: 'Household',
        targetEntityId: 'FAM-1001',
        details: 'Initial verification of household records and address D-104.',
        timestamp: new Date('2024-01-20')
      },
      {
        logId: 'AUD-002',
        actorId: 'OFFICER-01',
        actorRole: 'officer',
        action: 'APPROVE_APPLICATION',
        targetEntity: 'Application',
        targetEntityId: 'APP-2024-089',
        details: 'Approved PM-KISAN for Citizen CIT-1001 following land record validation.',
        timestamp: new Date('2024-02-15')
      }
    ]
  };
};

const getDB = () => {
  if (!db) {
    db = createInitialSeedData();
    console.log('[JanSetu DataStore] Initialized demo seed records for FAM-1001, OFFICER-01, ADMIN-01.');
  }
  return db;
};

const resetToInitialDemo = () => {
  db = createInitialSeedData();
  console.log('[JanSetu DataStore] Reset database to fresh pristine demo seed state.');
  return { success: true, message: 'JanSetu demo environment reset to initial state successfully.' };
};

// Data Store Access Methods
const dataStore = {
  getDB,
  resetToInitialDemo,

  // Users
  findUserByUserId: (userId) => {
    const users = getDB().userAccounts;
    return users.find(u => u.userId.toUpperCase() === (userId || '').trim().toUpperCase());
  },
  getAllUsers: () => {
    return getDB().userAccounts;
  },
  createUser: (userData) => {
    const users = getDB().userAccounts;
    users.push(userData);
    return userData;
  },
  updateUser: (userId, updates) => {
    const user = getDB().userAccounts.find(u => u.userId.toUpperCase() === (userId || '').trim().toUpperCase());
    if (user) {
      Object.assign(user, updates);
    }
    return user;
  },
  deleteUser: (userId) => {
    const users = getDB().userAccounts;
    const idx = users.findIndex(u => u.userId.toUpperCase() === (userId || '').trim().toUpperCase());
    if (idx >= 0) {
      users.splice(idx, 1);
      return true;
    }
    return false;
  },

  // Households
  findHousehold: (familyId) => {
    return getDB().households.find(h => h.familyId === familyId);
  },
  getAllHouseholds: () => {
    return getDB().households;
  },
  updateHousehold: (familyId, updates) => {
    const hh = getDB().households.find(h => h.familyId === familyId);
    if (hh) {
      Object.assign(hh, updates, { updatedAt: new Date() });
    }
    return hh;
  },
  createHousehold: (householdData) => {
    getDB().households.push(householdData);
    return householdData;
  },

  // Citizens
  getCitizensByFamilyId: (familyId) => {
    return getDB().citizens.filter(c => c.currentFamilyId === familyId && c.status !== 'inactive');
  },
  findCitizen: (citizenId) => {
    return getDB().citizens.find(c => c.citizenId === citizenId);
  },
  getAllCitizens: () => {
    return getDB().citizens;
  },
  updateCitizen: (citizenId, updates) => {
    const citizen = getDB().citizens.find(c => c.citizenId === citizenId);
    if (citizen) {
      Object.assign(citizen, updates);
    }
    return citizen;
  },
  createCitizen: (citizenData) => {
    getDB().citizens.push(citizenData);
    return citizenData;
  },
  removeCitizenFromHousehold: (citizenId, familyId, reason) => {
    const citizen = getDB().citizens.find(c => c.citizenId === citizenId);
    if (citizen) {
      citizen.status = 'inactive';
      citizen.currentFamilyId = 'REMOVED';
      citizen.updatedAt = new Date();
    }
    // Update active membership history
    const activeHist = getDB().membershipHistory.find(h => h.citizenId === citizenId && h.endDate === null);
    if (activeHist) {
      activeHist.endDate = new Date();
      activeHist.exitReason = reason || 'Removed by Household Owner';
    } else {
      getDB().membershipHistory.push({
        historyId: `HIST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        citizenId,
        familyId,
        startDate: citizen?.createdAt || new Date(),
        endDate: new Date(),
        exitReason: reason || 'Removed by Household Owner'
      });
    }
    // Deactivate relationships
    getDB().familyRelationships.forEach(rel => {
      if (rel.citizenId1 === citizenId || rel.citizenId2 === citizenId) {
        rel.isActive = false;
      }
    });
    return citizen;
  },

  // Family Relationships
  getRelationshipsForCitizens: (citizenIds) => {
    return getDB().familyRelationships.filter(rel => 
      (citizenIds.includes(rel.citizenId1) || citizenIds.includes(rel.citizenId2)) && rel.isActive !== false
    );
  },
  getAllRelationships: () => {
    return getDB().familyRelationships;
  },
  createRelationship: (relData) => {
    getDB().familyRelationships.push(relData);
    return relData;
  },
  updateRelationship: (relationshipId, updates) => {
    const rel = getDB().familyRelationships.find(r => r.relationshipId === relationshipId);
    if (rel) {
      Object.assign(rel, updates);
    }
    return rel;
  },

  // Membership History
  getMembershipHistory: (familyId, citizenId) => {
    let hist = getDB().membershipHistory;
    if (familyId) hist = hist.filter(h => h.familyId === familyId);
    if (citizenId) hist = hist.filter(h => h.citizenId === citizenId);
    return hist;
  },
  addMembershipHistory: (entry) => {
    getDB().membershipHistory.push(entry);
    return entry;
  },

  // Documents
  getDocuments: (familyId, citizenId) => {
    let docs = getDB().documents;
    if (familyId && citizenId) {
      return docs.filter(d => d.familyId === familyId || d.citizenId === citizenId);
    }
    if (familyId) {
      return docs.filter(d => d.familyId === familyId || (d.scope === 'Individual' && getDB().citizens.some(c => c.currentFamilyId === familyId && c.citizenId === d.citizenId)));
    }
    if (citizenId) {
      return docs.filter(d => d.citizenId === citizenId);
    }
    return docs;
  },
  findDocument: (docId) => {
    return getDB().documents.find(d => d.documentId === docId);
  },
  createDocument: (docData) => {
    getDB().documents.push(docData);
    return docData;
  },
  updateDocument: (docId, updates) => {
    const doc = getDB().documents.find(d => d.documentId === docId);
    if (doc) {
      Object.assign(doc, updates);
    }
    return doc;
  },

  // Schemes
  getAllSchemes: () => {
    return getDB().schemes;
  },
  findScheme: (schemeId) => {
    return getDB().schemes.find(s => s.schemeId === schemeId);
  },

  // Applications
  getAllApplications: () => {
    return getDB().applications;
  },
  getApplicationsByFamily: (familyId) => {
    return getDB().applications.filter(a => a.familyId === familyId);
  },
  findApplication: (appId) => {
    return getDB().applications.find(a => a.applicationId === appId);
  },
  createApplication: (appData) => {
    getDB().applications.push(appData);
    return appData;
  },
  updateApplication: (appId, updates) => {
    const app = getDB().applications.find(a => a.applicationId === appId);
    if (app) {
      Object.assign(app, updates, { updatedAt: new Date() });
    }
    return app;
  },

  // Benefit Records
  getAllBenefits: () => {
    return getDB().benefitRecords;
  },
  getBenefitsByFamily: (familyId) => {
    return getDB().benefitRecords.filter(b => b.familyId === familyId);
  },
  getBenefitsByCitizen: (citizenId) => {
    return getDB().benefitRecords.filter(b => b.citizenId === citizenId);
  },
  createBenefitRecord: (record) => {
    getDB().benefitRecords.push(record);
    return record;
  },

  // Separation Requests
  getAllSeparationRequests: () => {
    return getDB().separationRequests;
  },
  getSeparationRequestsByFamily: (familyId) => {
    return getDB().separationRequests.filter(s => s.originalFamilyId === familyId);
  },
  findSeparationRequest: (requestId) => {
    return getDB().separationRequests.find(s => s.requestId === requestId);
  },
  createSeparationRequest: (data) => {
    getDB().separationRequests.push(data);
    return data;
  },
  updateSeparationRequest: (requestId, updates) => {
    const req = getDB().separationRequests.find(s => s.requestId === requestId);
    if (req) {
      Object.assign(req, updates, { updatedAt: new Date() });
    }
    return req;
  },

  // Profile Corrections
  getAllProfileCorrections: () => {
    return getDB().profileCorrections;
  },
  getProfileCorrectionsByFamily: (familyId) => {
    return getDB().profileCorrections.filter(p => p.familyId === familyId);
  },
  findProfileCorrection: (requestId) => {
    return getDB().profileCorrections.find(p => p.requestId === requestId);
  },
  createProfileCorrection: (data) => {
    getDB().profileCorrections.push(data);
    return data;
  },
  updateProfileCorrection: (requestId, updates) => {
    const req = getDB().profileCorrections.find(p => p.requestId === requestId);
    if (req) {
      Object.assign(req, updates, { updatedAt: new Date() });
    }
    return req;
  },

  // Notifications
  getNotifications: (recipientId) => {
    return getDB().notifications
      .filter(n => n.recipientId === recipientId || n.recipientId === 'ALL_OFFICERS')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  createNotification: (data) => {
    getDB().notifications.push(data);
    return data;
  },
  markNotificationRead: (notifId) => {
    const notif = getDB().notifications.find(n => n.notificationId === notifId);
    if (notif) notif.isRead = true;
    return notif;
  },
  markAllNotificationsRead: (recipientId) => {
    const list = getDB().notifications.filter(n => n.recipientId === recipientId || n.recipientId === 'ALL_OFFICERS');
    list.forEach(n => { n.isRead = true; });
    return list;
  },

  // Audit Logs
  getAuditLogs: () => {
    return getDB().auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },
  createAuditLog: (logData) => {
    getDB().auditLogs.push(logData);
    return logData;
  },

  // ATOMIC SEPARATION APPROVAL EXECUTION (Scenario A)
  executeSeparationApproval: (requestId, officerId, officerName, mandatoryReason, customNewFamilyId = null) => {
    const req = getDB().separationRequests.find(s => s.requestId === requestId);
    if (!req) throw new Error('Separation request not found.');
    if (req.status === 'Approved') throw new Error('Request has already been approved.');

    const originalFamily = getDB().households.find(h => h.familyId === req.originalFamilyId);
    if (!originalFamily) throw new Error('Original household not found.');

    // Generate new unique Family ID (e.g., FAM-2001 or FAM-2002)
    const existingFamilies = getDB().households.map(h => h.familyId);
    let nextNum = 2001;
    while (existingFamilies.includes(`FAM-${nextNum}`)) {
      nextNum++;
    }
    const newFamilyId = customNewFamilyId || `FAM-${nextNum}`;

    // Select head for the new family: first moving citizen
    const newHeadCitizenId = req.movingCitizenIds[0];

    // Create new household record
    const newHousehold = {
      familyId: newFamilyId,
      identifierType: 'Local JanSetu System Household ID (Not an official National Family ID)',
      headCitizenId: newHeadCitizenId,
      address: { ...req.newAddress },
      dwellingReference: req.newDwellingReference || `D-${nextNum}`,
      dwellingType: 'Kutcha', // initial dwelling state
      annualIncome: Math.round(originalFamily.annualIncome * 0.6), // estimated initial income
      incomeCategory: originalFamily.incomeCategory || 'BPL',
      rationCardNumber: `RC-UP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      verificationStatus: 'Verified',
      verifiedBy: officerId,
      verifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    getDB().households.push(newHousehold);

    // Create citizen account login for the new family
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('citizen123', salt);
    getDB().userAccounts.push({
      userId: newFamilyId,
      passwordHash: passwordHash,
      role: 'citizen',
      familyId: newFamilyId,
      email: `${newFamilyId.toLowerCase()}@jansetu.gov.in`,
      phone: '9876500000',
      isActive: true,
      createdAt: new Date()
    });

    // Update current household membership for moving citizens while PRESERVING citizen IDs & relationships
    req.movingCitizenIds.forEach(citizenId => {
      const citizen = getDB().citizens.find(c => c.citizenId === citizenId);
      if (citizen) {
        // Record exit in membership history
        const activeHist = getDB().membershipHistory.find(h => h.citizenId === citizenId && h.endDate === null);
        if (activeHist) {
          activeHist.endDate = new Date();
          activeHist.exitReason = `Approved Household Separation (${requestId})`;
          activeHist.separationRequestId = requestId;
        }

        // Add new membership history entry
        getDB().membershipHistory.push({
          historyId: `HIST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          citizenId: citizenId,
          familyId: newFamilyId,
          startDate: new Date(),
          endDate: null,
          exitReason: null
        });

        // Update citizen's currentFamilyId
        citizen.currentFamilyId = newFamilyId;
        if (citizenId === newHeadCitizenId) {
          citizen.isHeadOfFamily = true;
        }
      }
    });

    // Update original family head if original head moved away
    if (req.movingCitizenIds.includes(originalFamily.headCitizenId)) {
      const remainingCitizens = getDB().citizens.filter(c => c.currentFamilyId === originalFamily.familyId);
      if (remainingCitizens.length > 0) {
        originalFamily.headCitizenId = remainingCitizens[0].citizenId;
        remainingCitizens[0].isHeadOfFamily = true;
      }
    }

    // Update separation request record
    req.status = 'Approved';
    req.generatedNewFamilyId = newFamilyId;
    req.officerReview = {
      officerId,
      officerName,
      decision: 'Approved',
      mandatoryReason,
      reviewedAt: new Date()
    };
    req.updatedAt = new Date();

    // Create notifications for both households
    getDB().notifications.push({
      notificationId: `NOTIF-${Date.now()}-1`,
      recipientType: 'Household',
      recipientId: originalFamily.familyId,
      title: 'Household Separation Order Approved',
      message: `Household separation request ${requestId} approved. New Household ${newFamilyId} has been established. Member Citizen IDs and family bonds remain preserved.`,
      category: 'Separation',
      relatedEntityId: requestId,
      isRead: false,
      createdAt: new Date()
    });

    getDB().notifications.push({
      notificationId: `NOTIF-${Date.now()}-2`,
      recipientType: 'Household',
      recipientId: newFamilyId,
      title: 'Welcome to JanSetu - New Family Account Activated',
      message: `Your new household account ${newFamilyId} is active. Login using Family ID '${newFamilyId}' and default password 'citizen123'.`,
      category: 'Separation',
      relatedEntityId: newFamilyId,
      isRead: false,
      createdAt: new Date()
    });

    // Create Audit Log
    getDB().auditLogs.push({
      logId: `AUD-${Date.now()}`,
      actorId: officerId,
      actorRole: 'officer',
      action: 'APPROVE_HOUSEHOLD_SEPARATION',
      targetEntity: 'HouseholdSeparationRequest',
      targetEntityId: requestId,
      details: `Approved separation of citizens [${req.movingCitizenIds.join(', ')}] from ${req.originalFamilyId} into ${newFamilyId}. Reason: ${mandatoryReason}`,
      previousState: { originalFamilyId: req.originalFamilyId, movingCitizens: req.movingCitizenIds },
      newState: { newFamilyId, status: 'Approved' },
      timestamp: new Date()
    });

    return {
      success: true,
      requestId,
      originalFamilyId: req.originalFamilyId,
      newFamilyId,
      movingCitizenIds: req.movingCitizenIds,
      newHeadCitizenId
    };
  }
};

module.exports = dataStore;
