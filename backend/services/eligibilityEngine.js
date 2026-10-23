const dataStore = require('../models/dataStore');

/**
 * JanSetu Rule-Based Scheme Eligibility Engine
 * Evaluates individual and household eligibility with complete transparency and explanation.
 */
const evaluateEligibility = (schemeId, citizenId, familyId) => {
  const scheme = dataStore.findScheme(schemeId);
  if (!scheme) {
    return {
      status: 'Error',
      explanation: `Scheme with ID '${schemeId}' was not found in the catalogue.`,
      passedConditions: [],
      failedConditions: [`Invalid scheme identifier: ${schemeId}`],
      missingDocuments: []
    };
  }

  const citizen = dataStore.findCitizen(citizenId);
  const household = dataStore.findHousehold(familyId);

  if (!citizen) {
    return {
      status: 'Error',
      explanation: `Citizen record for '${citizenId}' not found.`,
      passedConditions: [],
      failedConditions: ['Citizen record missing'],
      missingDocuments: []
    };
  }

  if (!household) {
    return {
      status: 'Error',
      explanation: `Household record for '${familyId}' not found.`,
      passedConditions: [],
      failedConditions: ['Household record missing'],
      missingDocuments: []
    };
  }

  const passedConditions = [];
  const failedConditions = [];
  const missingDocuments = [];

  const rules = scheme.rules || {};
  const isHouseholdScheme = scheme.benefitType === 'Household';

  // 1. Evaluate Household Income Limit
  if (rules.maxIncome) {
    if (household.annualIncome <= rules.maxIncome) {
      passedConditions.push(`Household annual income (₹${household.annualIncome.toLocaleString('en-IN')}) is within the permissible limit of ₹${rules.maxIncome.toLocaleString('en-IN')}`);
    } else {
      failedConditions.push(`Household annual income (₹${household.annualIncome.toLocaleString('en-IN')}) exceeds the scheme threshold of ₹${rules.maxIncome.toLocaleString('en-IN')}`);
    }
  }

  // 2. Evaluate Dwelling Type Requirement (e.g., PMAY housing)
  if (rules.requiredDwellingType && rules.requiredDwellingType.length > 0) {
    if (rules.requiredDwellingType.includes(household.dwellingType)) {
      passedConditions.push(`Current dwelling structure '${household.dwellingType}' satisfies the requirement for housing improvement/grant`);
    } else {
      failedConditions.push(`Current dwelling structure '${household.dwellingType}' does not qualify. Required dwelling type: ${rules.requiredDwellingType.join(' or ')}`);
    }
  }

  // 3. Evaluate Age Criteria
  if (rules.minAge !== undefined) {
    if (citizen.age >= rules.minAge) {
      passedConditions.push(`Applicant age (${citizen.age} years) satisfies the minimum age requirement of ${rules.minAge} years`);
    } else {
      failedConditions.push(`Applicant age (${citizen.age} years) is below the minimum age requirement of ${rules.minAge} years`);
    }
  }

  if (rules.maxAge !== undefined) {
    if (citizen.age <= rules.maxAge) {
      passedConditions.push(`Applicant age (${citizen.age} years) is within the maximum age threshold of ${rules.maxAge} years`);
    } else {
      failedConditions.push(`Applicant age (${citizen.age} years) exceeds the maximum age threshold of ${rules.maxAge} years`);
    }
  }

  // 4. Evaluate Gender Requirement (e.g. Ujjwala for adult women)
  if (rules.genderRequirement) {
    if (citizen.gender.toLowerCase() === rules.genderRequirement.toLowerCase()) {
      passedConditions.push(`Applicant gender (${citizen.gender}) matches the scheme priority target (${rules.genderRequirement})`);
    } else {
      failedConditions.push(`Applicant gender (${citizen.gender}) does not match scheme rule (Targeted for: ${rules.genderRequirement} members)`);
    }
  }

  // 5. Evaluate Farmer / Landholding Requirement (e.g., PM-KISAN)
  if (rules.requiresFarmer) {
    if (citizen.isFarmer && citizen.landholdingHectares > 0) {
      passedConditions.push(`Applicant is a registered cultivator with ${citizen.landholdingHectares} Hectares of cultivable landholding`);
    } else {
      failedConditions.push(`Applicant is not recorded as an active landholding farmer (Current landholding: ${citizen.landholdingHectares} Ha)`);
    }
  }

  // 6. Check Required Supporting Documents Inventory
  const householdDocs = dataStore.getDocuments(familyId, null);
  const citizenDocs = dataStore.getDocuments(null, citizenId);
  const allAvailableDocs = [...householdDocs, ...citizenDocs];

  if (scheme.requiredDocuments && scheme.requiredDocuments.length > 0) {
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
    status = 'Not Eligible Under Demo Rules';
    explanation = `The applicant does not meet ${failedConditions.length} criteria for ${scheme.name}. Review unsatisfied conditions below.`;
  } else if (missingDocuments.length > 0) {
    status = 'More Information Required';
    explanation = `Applicant meets core statutory conditions, but ${missingDocuments.length} mandatory document(s) are either missing or pending administrative verification.`;
  } else {
    status = 'Potentially Eligible';
    explanation = `All eligibility rules and required document verifications have been satisfied for ${scheme.name}.`;
  }

  return {
    schemeId,
    schemeName: scheme.name,
    benefitType: scheme.benefitType,
    status,
    passedConditions,
    failedConditions,
    missingDocuments,
    explanation
  };
};

module.exports = { evaluateEligibility };
