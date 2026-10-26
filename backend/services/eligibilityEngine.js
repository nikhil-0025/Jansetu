const mongoose = require('mongoose');
const dataStore = require('../models/dataStore');
const { Scheme, Citizen, Household, Document } = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

/**
 * JanSetu Rule-Based Scheme Eligibility Engine
 * Evaluates individual and household eligibility with complete transparency,
 * explicit distinction between unmet vs unknown criteria, and clear statutory disclaimers.
 */
const evaluateEligibility = async (schemeId, citizenId, familyId, customAnswers = null) => {
  let scheme = null;
  let citizen = null;
  let household = null;
  let allAvailableDocs = [];

  if (isMongoReady()) {
    try {
      scheme = await Scheme.findOne({ schemeId }).lean();
      if (citizenId) citizen = await Citizen.findOne({ citizenId }).lean();
      if (familyId) household = await Household.findOne({ familyId }).lean();
      if (familyId || citizenId) {
        allAvailableDocs = await Document.find({
          $or: [
            ...(familyId ? [{ familyId }] : []),
            ...(citizenId ? [{ citizenId }] : [])
          ]
        }).lean();
      }
    } catch (e) {
      console.warn('[EligibilityEngine] Mongo query fallback:', e.message);
    }
  }

  if (!scheme) scheme = dataStore.findScheme(schemeId);
  if (!scheme) {
    return {
      status: 'Error',
      explanation: `Scheme with ID '${schemeId}' was not found in the verified catalogue.`,
      passedConditions: [],
      failedConditions: [`Invalid scheme identifier: ${schemeId}`],
      unknownConditions: [],
      missingDocuments: [],
      disclaimer: 'Preliminary automated guidance only. Does not guarantee government benefit.'
    };
  }

  if (!citizen && citizenId) citizen = dataStore.findCitizen(citizenId);
  if (!household && familyId) household = dataStore.findHousehold(familyId);
  if (allAvailableDocs.length === 0 && (familyId || citizenId)) {
    const householdDocs = familyId ? dataStore.getDocuments(familyId, null) : [];
    const citizenDocs = citizenId ? dataStore.getDocuments(null, citizenId) : [];
    allAvailableDocs = [...householdDocs, ...citizenDocs];
  }

  const passedConditions = [];
  const failedConditions = [];
  const unknownConditions = [];
  const missingDocuments = [];

  const rules = scheme.rules || {};

  // 1. Evaluate Household Income Limit
  const incomeValue = customAnswers?.annualIncome !== undefined 
    ? Number(customAnswers.annualIncome) 
    : household?.annualIncome;

  if (rules.maxIncome) {
    if (incomeValue !== undefined && !isNaN(incomeValue)) {
      if (incomeValue <= rules.maxIncome) {
        passedConditions.push(`Annual income (₹${incomeValue.toLocaleString('en-IN')}) is within the permissible limit of ₹${rules.maxIncome.toLocaleString('en-IN')}`);
      } else {
        failedConditions.push(`Annual income (₹${incomeValue.toLocaleString('en-IN')}) exceeds the scheme threshold of ₹${rules.maxIncome.toLocaleString('en-IN')}`);
      }
    } else {
      unknownConditions.push(`Annual income not specified (Scheme threshold: ₹${rules.maxIncome.toLocaleString('en-IN')}/year)`);
    }
  }

  // 2. Evaluate Dwelling Type Requirement
  const dwellingValue = customAnswers?.dwellingType || household?.dwellingType;
  if (rules.requiredDwellingType && rules.requiredDwellingType.length > 0) {
    if (dwellingValue) {
      if (rules.requiredDwellingType.includes(dwellingValue)) {
        passedConditions.push(`Current dwelling structure '${dwellingValue}' satisfies the requirement for housing grant`);
        if (schemeId === 'SCH-PMAY-G') {
          unknownConditions.push('Gram Sabha priority ranking & local physical verification required');
        }
      } else {
        failedConditions.push(`Current dwelling structure '${dwellingValue}' does not qualify (Household already has a pucca dwelling. Required: ${rules.requiredDwellingType.join(' or ')})`);
      }
    } else {
      unknownConditions.push(`Dwelling type not recorded (Required: ${rules.requiredDwellingType.join(' or ')})`);
    }
  }

  // 3. Evaluate Age Criteria
  const ageValue = customAnswers?.age !== undefined
    ? Number(customAnswers.age)
    : citizen?.age;

  if (rules.minAge !== undefined) {
    if (ageValue !== undefined && !isNaN(ageValue)) {
      if (ageValue >= rules.minAge) {
        passedConditions.push(`Applicant age (${ageValue} years) satisfies the minimum age requirement of ${rules.minAge} years`);
      } else {
        failedConditions.push(`Applicant age (${ageValue} years) is below the minimum age requirement of ${rules.minAge} years`);
      }
    } else {
      unknownConditions.push(`Applicant age not verified (Minimum age requirement: ${rules.minAge} years)`);
    }
  }

  if (rules.maxAge !== undefined) {
    if (ageValue !== undefined && !isNaN(ageValue)) {
      if (ageValue <= rules.maxAge) {
        passedConditions.push(`Applicant age (${ageValue} years) is within the maximum age threshold of ${rules.maxAge} years`);
      } else {
        failedConditions.push(`Applicant age (${ageValue} years) exceeds the maximum age threshold of ${rules.maxAge} years (Age must be between 18 and 40 years)`);
      }
    } else {
      unknownConditions.push(`Applicant age not verified (Maximum age threshold: ${rules.maxAge} years)`);
    }
  }

  // 4. Evaluate Gender Requirement
  const genderValue = customAnswers?.gender || citizen?.gender;
  if (rules.genderRequirement) {
    if (genderValue) {
      if (genderValue.toLowerCase() === rules.genderRequirement.toLowerCase()) {
        passedConditions.push(`Applicant gender (${genderValue}) matches the scheme priority target (${rules.genderRequirement})`);
      } else {
        failedConditions.push(`Applicant gender (${genderValue}) does not match scheme rule (Targeted exclusively for: ${rules.genderRequirement})`);
      }
    } else {
      unknownConditions.push(`Gender requirement (${rules.genderRequirement}) not confirmed`);
    }
  }

  // 5. Evaluate Farmer / Landholding Requirement
  const isFarmerValue = customAnswers?.isFarmer !== undefined 
    ? Boolean(customAnswers.isFarmer) 
    : (customAnswers?.occupation?.toLowerCase().includes('farmer') || citizen?.isFarmer);
  const landholdingValue = customAnswers?.landholdingHectares !== undefined
    ? Number(customAnswers.landholdingHectares)
    : citizen?.landholdingHectares;

  if (rules.requiresFarmer) {
    if (isFarmerValue !== undefined) {
      if (isFarmerValue || customAnswers?.occupation?.toLowerCase().includes('farmer')) {
        passedConditions.push(`Applicant is a registered Farmer / Cultivator with cultivable landholding`);
        unknownConditions.push(`Land record khatauni title mutation to be verified against Bhulekh database`);
      } else {
        failedConditions.push(`Applicant is not recorded as an active landholding farmer`);
      }
    } else {
      unknownConditions.push(`Agricultural landholding status not verified (Required: Active landholding cultivator)`);
    }
  }

  // Specific Scheme Rule: PM SVANidhi (Urban Street Vendors)
  if (schemeId === 'SCH-PMSVANIDHI') {
    const occ = (customAnswers?.occupation || '').toLowerCase();
    if (occ) {
      if (occ.includes('vendor') || occ.includes('hawker') || occ.includes('informal')) {
        passedConditions.push(`Applicant is a recognized Urban Street Vendor / micro-hawker`);
        unknownConditions.push(`Urban Local Body (ULB) vending certificate / LOR endorsement required`);
      } else {
        failedConditions.push(`Targeted exclusively for urban street vendors and micro-hawkers`);
      }
    }
  }

  // Specific Scheme Rule: PM Ujjwala Yojana (LPG Connection)
  if (schemeId === 'SCH-PMUY') {
    if (customAnswers?.hasLpgConnection !== undefined) {
      if (!customAnswers.hasLpgConnection) {
        passedConditions.push(`Household does not hold an existing LPG cooking gas connection`);
      } else {
        failedConditions.push(`Household already holds an active LPG cooking gas connection`);
      }
    }
  }

  // 6. Check Required Supporting Documents Inventory (only when citizen/family profile is provided)
  if (!customAnswers && scheme.requiredDocuments && scheme.requiredDocuments.length > 0) {
    scheme.requiredDocuments.forEach(docType => {
      const match = allAvailableDocs.find(d => d.documentType === docType);
      if (!match) {
        missingDocuments.push(`Missing: ${docType}`);
      } else if (match.verificationStatus === 'Verified') {
        passedConditions.push(`Document '${docType}' is uploaded and verified by authorized officer`);
      } else {
        missingDocuments.push(`Pending Verification: ${docType} (Current status: ${match.verificationStatus})`);
      }
    });
  }

  // Determine Overall Status
  let status = 'Potentially Eligible';
  let explanation = '';

  if (failedConditions.length > 0) {
    status = 'Not Currently Eligible';
    explanation = `The applicant does not meet ${failedConditions.length} verified criteria for ${scheme.name}. Review unmet conditions below.`;
  } else if (!customAnswers && unknownConditions.length > 0) {
    status = 'Additional Profile Data Required';
    explanation = `Applicant may be eligible, but ${unknownConditions.length} criteria require profile confirmation before a recommendation can be made.`;
  } else if (!customAnswers && missingDocuments.length > 0) {
    status = 'Documents Required';
    explanation = `Applicant satisfies core criteria, but ${missingDocuments.length} mandatory supporting document(s) are either missing or pending officer verification.`;
  } else {
    status = 'Potentially Eligible';
    explanation = `All evaluated criteria have been satisfied for ${scheme.name}. Preliminary advisory guidance indicates potential eligibility.`;
  }

  return {
    schemeId,
    schemeName: scheme.name,
    benefitType: scheme.benefitType,
    department: scheme.department,
    ministry: scheme.ministry,
    officialUrl: scheme.officialUrl,
    sourceUrl: scheme.sourceUrl,
    lastVerifiedDate: scheme.lastVerifiedDate,
    status,
    passedConditions,
    failedConditions,
    unknownConditions,
    missingDocuments,
    explanation,
    disclaimer: 'Preliminary automated guidance based on verified scheme criteria. Final benefit sanctions are subject to official verification by the competent statutory authority.'
  };
};

module.exports = { evaluateEligibility };
