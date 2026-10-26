const bcrypt = require('bcryptjs');
const {
  UserAccount,
  Household,
  Citizen,
  FamilyRelationship,
  HouseholdMembershipHistory,
  Document,
  Scheme,
  Application,
  BenefitRecord
} = require('../models/schemaDefinitions');

/**
 * Idempotently seeds baseline demo data to MongoDB Atlas if not already present.
 * Ensures the database contains all core records on startup.
 */
async function seedBaselineData() {
  try {
    const existingHousehold = await Household.findOne({ familyId: 'FAM-1001' }).lean();
    if (!existingHousehold) {
      console.log('[JanSetu Seeder] Seeding initial baseline citizen records into MongoDB Atlas...');

    const salt = bcrypt.genSaltSync(10);
    const citizenHash = bcrypt.hashSync('citizen123', salt);
    const officerHash = bcrypt.hashSync('officer123', salt);
    const adminHash = bcrypt.hashSync('admin123', salt);

    // 1. User Accounts
    const users = [
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
    ];

    for (const u of users) {
      await UserAccount.updateOne({ userId: u.userId }, { $setOnInsert: u }, { upsert: true });
    }

    // 2. Households
    const households = [
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
    ];

    for (const h of households) {
      await Household.updateOne({ familyId: h.familyId }, { $setOnInsert: h }, { upsert: true });
    }

    // 3. Citizens
    const citizens = [
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
    ];

    for (const c of citizens) {
      await Citizen.updateOne({ citizenId: c.citizenId }, { $setOnInsert: c }, { upsert: true });
    }

    // 4. Family Relationships
    const relationships = [
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
    ];

    for (const r of relationships) {
      await FamilyRelationship.updateOne({ relationshipId: r.relationshipId }, { $setOnInsert: r }, { upsert: true });
    }

    // 5. Membership History
    const histories = [
      {
        historyId: 'HIST-001',
        citizenId: 'CIT-1001',
        familyId: 'FAM-1001',
        startDate: new Date('2024-01-15'),
        endDate: null
      },
      {
        historyId: 'HIST-002',
        citizenId: 'CIT-1002',
        familyId: 'FAM-1001',
        startDate: new Date('2024-01-15'),
        endDate: null
      },
      {
        historyId: 'HIST-003',
        citizenId: 'CIT-1003',
        familyId: 'FAM-1001',
        startDate: new Date('2024-01-15'),
        endDate: null
      },
      {
        historyId: 'HIST-004',
        citizenId: 'CIT-1004',
        familyId: 'FAM-1001',
        startDate: new Date('2024-01-15'),
        endDate: null
      },
      {
        historyId: 'HIST-005',
        citizenId: 'CIT-2001',
        familyId: 'FAM-2001',
        startDate: new Date('2024-02-01'),
        endDate: null
      }
    ];

    for (const h of histories) {
      await HouseholdMembershipHistory.updateOne({ historyId: h.historyId }, { $setOnInsert: h }, { upsert: true });
    }
  }

  // 6. Verified Real Government Welfare Schemes (Always kept in sync with verified data)
  const schemes = [
      {
        schemeId: 'SCH-PMAY-G',
        name: 'Pradhan Mantri Awas Yojana - Gramin (PMAY-G)',
        nameHindi: 'प्रधानमंत्री आवास योजना - ग्रामीण',
        category: 'Housing',
        department: 'Department of Rural Development',
        ministry: 'Ministry of Rural Development, Government of India',
        description: 'Financial assistance of ₹1,20,000 in plain areas and ₹1,30,000 in hilly/difficult areas provided to houseless families and those residing in kutcha or dilapidated dwellings to construct a permanent pucca house with hygienic cooking space.',
        benefitType: 'Household',
        benefitAmount: '₹1,20,000 construction grant',
        requiredDocuments: ['Ration Card', 'Income Certificate', 'Residence Proof', 'Land Ownership Record (Khatauni)'],
        imageUrl: '/assets/schemes/pmay-g.svg',
        imageAlt: 'Pradhan Mantri Awas Yojana Gramin rural housing construction scheme',
        eligibilityPreview: 'For houseless rural households or living in kutcha/semi-pucca houses. Max income ₹3,00,000/yr.',
        stateCoverage: 'All India (Rural Areas)',
        targetBeneficiaries: 'Rural families living in kutcha/dilapidated homes and SECC deprived households',
        applicationProcess: 'Gram Panchayat identification & Awassoft verification via Block Development Office',
        officialUrl: 'https://pmayg.nic.in/',
        sourceUrl: 'https://www.myscheme.gov.in/schemes/pmay-g',
        lastVerifiedDate: '2026-03-15',
        verificationStatus: 'Verified Official',
        unverifiedFields: [],
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
        department: 'Department of Agriculture and Farmers Welfare',
        ministry: 'Ministry of Agriculture and Farmers Welfare, Government of India',
        description: 'Direct income support of ₹6,000 per year transferred in three equal four-monthly installments of ₹2,000 directly into the Aadhaar-linked bank accounts of all landholding farmer families across India.',
        benefitType: 'Individual',
        benefitAmount: '₹6,000 per year (3 x ₹2,000)',
        requiredDocuments: ['Land Ownership Record (Khatauni)', 'Income Certificate', 'Aadhaar Card'],
        imageUrl: '/assets/schemes/pm-kisan.svg',
        imageAlt: 'PM Kisan Samman Nidhi farmer direct income support scheme',
        eligibilityPreview: 'For landholding farmer families. Requires verified land record (Khatauni) & Age 18+.',
        stateCoverage: 'All India (National)',
        targetBeneficiaries: 'Small and marginal landholding farmer families',
        applicationProcess: 'Self-registration through PM-KISAN portal or Common Service Centres (CSCs)',
        officialUrl: 'https://pmkisan.gov.in/',
        sourceUrl: 'https://www.myscheme.gov.in/schemes/pm-kisan',
        lastVerifiedDate: '2026-03-15',
        verificationStatus: 'Verified Official',
        unverifiedFields: [],
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
        department: 'National Health Authority (NHA)',
        ministry: 'Ministry of Health and Family Welfare, Government of India',
        description: 'World’s largest health assurance scheme providing comprehensive cashless hospitalization cover of up to ₹5,00,000 per family per year for secondary and tertiary care across empaneled public and private hospitals nationwide.',
        benefitType: 'Household',
        benefitAmount: '₹5,00,000 cashless health cover / year',
        requiredDocuments: ['Ration Card', 'Income Certificate', 'Aadhaar Card'],
        imageUrl: '/assets/schemes/pm-jay.svg',
        imageAlt: 'Ayushman Bharat PM-JAY cashless hospital healthcare insurance scheme',
        eligibilityPreview: 'For low-income and vulnerable households. ₹5,00,000/yr hospitalization cover per family.',
        stateCoverage: 'All India (National)',
        targetBeneficiaries: 'Bottom 40% vulnerable and economically deprived households',
        applicationProcess: 'Ayushman Card creation at empaneled hospitals or Ayushman Mitra kiosks',
        officialUrl: 'https://pmjay.gov.in/',
        sourceUrl: 'https://www.myscheme.gov.in/schemes/ab-pmjay',
        lastVerifiedDate: '2026-03-15',
        verificationStatus: 'Verified Official',
        unverifiedFields: [],
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
        department: 'Department of Food and Public Distribution',
        ministry: 'Ministry of Consumer Affairs, Food and Public Distribution, Government of India',
        description: 'Statutory monthly entitlement of subsidized/free foodgrains to eligible households (35 kg per month for Antyodaya Anna Yojana families and 5 kg per person per month for Priority Households) distributed through Fair Price Shops.',
        benefitType: 'Household',
        benefitAmount: 'Subsidized Foodgrains (Wheat/Rice)',
        requiredDocuments: ['Ration Card', 'Residence Proof', 'Income Certificate'],
        imageUrl: '/assets/schemes/nfsa-ration.svg',
        imageAlt: 'National Food Security Act subsidized grains and ration card scheme',
        eligibilityPreview: 'For Antyodaya Anna Yojana & Priority households. Max income ₹1,80,000/yr.',
        stateCoverage: 'All India (National)',
        targetBeneficiaries: 'Vulnerable and low-income rural and urban households',
        applicationProcess: 'State Food and Civil Supplies Department portal or Block Supply Office',
        officialUrl: 'https://nfsa.gov.in/',
        sourceUrl: 'https://www.myscheme.gov.in/schemes/nfsa-aay',
        lastVerifiedDate: '2026-03-15',
        verificationStatus: 'Verified Official',
        unverifiedFields: [],
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
        department: 'Ministry of Petroleum and Natural Gas',
        ministry: 'Ministry of Petroleum and Natural Gas, Government of India',
        description: 'Provision of deposit-free LPG connections along with a free first LPG refill and a hotplate (gas stove) issued exclusively in the name of an adult woman member of poor and deprived rural households.',
        benefitType: 'Household',
        benefitAmount: 'Deposit-Free LPG Connection + First Refill + Stove',
        requiredDocuments: ['Ration Card', 'Income Certificate', 'Residence Proof', 'Aadhaar Card'],
        imageUrl: '/assets/schemes/pmuy-ujjwala.svg',
        imageAlt: 'Pradhan Mantri Ujjwala Yojana clean LPG cooking fuel connection scheme',
        eligibilityPreview: 'For adult women (Age 18+) in low-income/BPL households without an active LPG connection.',
        stateCoverage: 'All India (National)',
        targetBeneficiaries: 'Adult women in poor households without prior LPG connection',
        applicationProcess: 'Online application via PMUY portal or enrollment at authorized LPG distributorships',
        officialUrl: 'https://pmuy.gov.in/',
        sourceUrl: 'https://www.myscheme.gov.in/schemes/pmuy',
        lastVerifiedDate: '2026-03-15',
        verificationStatus: 'Verified Official',
        unverifiedFields: [],
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
        department: 'National Skill Development Corporation (NSDC)',
        ministry: 'Ministry of Skill Development and Entrepreneurship, Government of India',
        description: 'Flagship skill certification and technical training scheme offering industry-aligned skill courses, soft-skills training, assessment certification, and monetary rewards/placement assistance for Indian youth.',
        benefitType: 'Individual',
        benefitAmount: 'Free Certified Training + Stipend + Placement Support',
        requiredDocuments: ['Birth Certificate', 'Income Certificate', 'Aadhaar Card'],
        imageUrl: '/assets/schemes/pmkvy-skills.svg',
        imageAlt: 'Pradhan Mantri Kaushal Vikas Yojana youth skill certification & stipend scheme',
        eligibilityPreview: 'For Indian citizens aged 18 to 35 seeking certified technical skills and vocational training.',
        stateCoverage: 'All India (National)',
        targetBeneficiaries: 'School/college dropouts and unemployed youth seeking employability skills',
        applicationProcess: 'Skill India Digital Hub enrollment and enrollment at accredited PMKVY training centers',
        officialUrl: 'https://www.skillindiadigital.gov.in/',
        sourceUrl: 'https://www.myscheme.gov.in/schemes/pmkvy-4',
        lastVerifiedDate: '2026-03-15',
        verificationStatus: 'Verified Official',
        unverifiedFields: [],
        rules: {
          minAge: 18,
          maxAge: 35
        },
        isActive: true
      },
      {
        schemeId: 'SCH-APY',
        name: 'Atal Pension Yojana (APY)',
        nameHindi: 'अटल पेंशन योजना',
        category: 'Social Security',
        department: 'Pension Fund Regulatory and Development Authority (PFRDA)',
        ministry: 'Ministry of Finance, Government of India',
        description: 'Guaranteed government-backed pension scheme for unorganized sector workers providing a fixed monthly pension of ₹1,000, ₹2,000, ₹3,000, ₹4,000, or ₹5,000 after attaining 60 years of age, based on contributions made.',
        benefitType: 'Individual',
        benefitAmount: 'Guaranteed Monthly Pension ₹1,000 to ₹5,000 (after age 60)',
        requiredDocuments: ['Aadhaar Card', 'Residence Proof'],
        imageUrl: '/assets/schemes/apy-pension.svg',
        imageAlt: 'Atal Pension Yojana unorganized sector guaranteed retirement pension scheme',
        eligibilityPreview: 'For Indian citizens aged 18 to 40 having a savings bank account and not income-tax payers.',
        stateCoverage: 'All India (National)',
        targetBeneficiaries: 'Unorganized sector workers and self-employed individuals',
        applicationProcess: 'Enrolled through bank branch or net banking auto-debit facility',
        officialUrl: 'https://www.npscra.nsdl.co.in/scheme-details.php',
        sourceUrl: 'https://www.myscheme.gov.in/schemes/apy',
        lastVerifiedDate: '2026-03-15',
        verificationStatus: 'Verified Official',
        unverifiedFields: [],
        rules: {
          minAge: 18,
          maxAge: 40,
          maxBenefitsPerHousehold: 4
        },
        isActive: true
      },
      {
        schemeId: 'SCH-PMSVANIDHI',
        name: 'PM Street Vendor\'s AtmaNirbhar Nidhi (PM SVANidhi)',
        nameHindi: 'पीएम स्वनिधि योजना',
        category: 'Financial Inclusion',
        department: 'Ministry of Housing and Urban Affairs',
        ministry: 'Ministry of Housing and Urban Affairs, Government of India',
        description: 'Micro-credit facility providing collateral-free working capital loans of ₹10,000 (first tranche), ₹20,000 (second tranche), and ₹50,000 (third tranche) with a 7% interest subsidy to street vendors operating in urban areas.',
        benefitType: 'Individual',
        benefitAmount: 'Collateral-free working capital loan up to ₹50,000 + 7% interest subsidy',
        requiredDocuments: ['Residence Proof', 'Aadhaar Card', 'Income Certificate'],
        imageUrl: '/assets/schemes/pm-svanidhi.svg',
        imageAlt: 'PM SVANidhi urban street vendor micro-credit working capital loan scheme',
        eligibilityPreview: 'For urban street vendors and micro-hawkers with Vending Certificate or Urban Livelihood endorsement.',
        stateCoverage: 'All India (Urban & Peri-Urban Areas)',
        targetBeneficiaries: 'Street vendors, hawkers, thelawalas, and roadside artisans',
        applicationProcess: 'Online application on pmsvanidhi.mohua.gov.in or via Urban Local Bodies / CSCs',
        officialUrl: 'https://pmsvanidhi.mohua.gov.in/',
        sourceUrl: 'https://www.myscheme.gov.in/schemes/pmsvanidhi',
        lastVerifiedDate: '2026-03-15',
        verificationStatus: 'Verified Official',
        unverifiedFields: [],
        rules: {
          minAge: 18,
          maxBenefitsPerHousehold: 2
        },
        isActive: true
      }
    ];

    for (const s of schemes) {
      await Scheme.updateOne({ schemeId: s.schemeId }, { $set: s }, { upsert: true });
    }

    if (!existingHousehold) {
      // 7. Initial Application & Benefit
      const initialApp = {
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
            'Household annual income (₹1,20,000) is within permissible limit',
            'Applicant is a registered cultivator with 1.2 Hectares of landholding',
            'Age criteria satisfied (36 years)'
          ],
          failedConditions: [],
          missingDocuments: []
        },
        duplicateCheckResult: {
          isPotentialDuplicate: false,
          flagType: null,
          matchedRecordId: null,
          requiresOfficerReview: false
        },
        officerReview: {
          officerId: 'OFFICER-01',
          officerName: 'Vikramaditya Verma',
          decision: 'Approved',
          remarks: 'Land records verified against Bhulekh / Khatauni database. Cultivator criteria verified.',
          reviewedAt: new Date('2024-02-15')
        },
        submittedAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-02-15')
      };
      await Application.updateOne({ applicationId: initialApp.applicationId }, { $setOnInsert: initialApp }, { upsert: true });

      const initialBenefit = {
        benefitRecordId: 'BEN-2024-089',
        schemeId: 'SCH-PM-KISAN',
        schemeName: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
        benefitType: 'Individual',
        familyId: 'FAM-1001',
        citizenId: 'CIT-1001',
        dwellingReference: 'D-104',
        disbursedAmount: '₹6,000 (3 Installments of ₹2,000)',
        financialYear: '2024-25',
        disbursedDate: new Date('2024-02-20'),
        status: 'Disbursed'
      };
      await BenefitRecord.updateOne({ benefitRecordId: initialBenefit.benefitRecordId }, { $setOnInsert: initialBenefit }, { upsert: true });

      console.log('[JanSetu Seeder] Baseline records successfully seeded into MongoDB Atlas.');
    }
  } catch (err) {
    console.error('[JanSetu Seeder] Error seeding baseline data:', err.message);
  }
}

module.exports = { seedBaselineData };
