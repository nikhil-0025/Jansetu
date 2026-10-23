const dataStore = require('../models/dataStore');

/**
 * JanSetu Explainable Duplicate Benefit Detection Service
 * Core logic: Distinguishes between Household vs Individual benefits,
 * considers historical household changes, dwelling references, and provides human-readable explanations.
 */
const detectDuplicateBenefit = (schemeId, citizenId, familyId) => {
  const scheme = dataStore.findScheme(schemeId);
  const household = dataStore.findHousehold(familyId);
  const citizen = dataStore.findCitizen(citizenId);

  if (!scheme || !household || !citizen) {
    return {
      isPotentialDuplicate: false,
      flagType: null,
      matchedRecordId: null,
      explanation: 'Incomplete parameters for duplicate verification.',
      requiresOfficerReview: false
    };
  }

  const existingBenefits = dataStore.getAllBenefits();
  const existingApplications = dataStore.getAllApplications();

  // CASE 1: HOUSEHOLD-LEVEL SCHEMES (e.g. PMAY-G, Ration, Ujjwala)
  if (scheme.benefitType === 'Household') {
    // 1.1 Check if this exact Household (Family ID) already received this benefit
    const householdPriorBenefit = existingBenefits.find(b => 
      b.schemeId === schemeId && 
      b.familyId === familyId && 
      b.status === 'Disbursed'
    );

    if (householdPriorBenefit) {
      return {
        isPotentialDuplicate: true,
        flagType: 'HOUSEHOLD_DUPLICATE',
        matchedRecordId: householdPriorBenefit.benefitRecordId,
        explanation: `Potential duplicate: Household ${familyId} was already granted benefits under ${scheme.name} (Record: ${householdPriorBenefit.benefitRecordId}, Disbursed: ${householdPriorBenefit.financialYear || 'Prior Year'}). Household schemes permit only one benefit per family.`,
        officerActionRecommended: 'Verify whether this is an erroneous repeat application or if there are exceptional disaster/rehabilitation provisions applicable.',
        requiresOfficerReview: true
      };
    }

    // 1.2 Check if an active application for this household is already pending
    const pendingHouseholdApp = existingApplications.find(a => 
      a.schemeId === schemeId && 
      a.familyId === familyId && 
      ['Submitted', 'Pending Verification', 'Additional Information Required', 'Approved'].includes(a.status)
    );

    if (pendingHouseholdApp) {
      return {
        isPotentialDuplicate: true,
        flagType: 'HOUSEHOLD_DUPLICATE',
        matchedRecordId: pendingHouseholdApp.applicationId,
        explanation: `Duplicate claim in progress: Household ${familyId} already has an active application ${pendingHouseholdApp.applicationId} under ${scheme.name} submitted by ${pendingHouseholdApp.applicantName}.`,
        officerActionRecommended: 'Merge with existing active application or inform applicant of pending status.',
        requiresOfficerReview: true
      };
    }

    // 1.3 Check Dwelling Reference Overlap (Single physical dwelling claim)
    if (household.dwellingReference) {
      const dwellingBenefit = existingBenefits.find(b => 
        b.schemeId === schemeId && 
        b.dwellingReference === household.dwellingReference
      );

      if (dwellingBenefit && dwellingBenefit.familyId !== familyId) {
        return {
          isPotentialDuplicate: true,
          flagType: 'DWELLING_BENEFIT_OVERLAP',
          matchedRecordId: dwellingBenefit.benefitRecordId,
          explanation: `Cross-household dwelling overlap: Dwelling reference '${household.dwellingReference}' was already awarded housing assistance under record ${dwellingBenefit.benefitRecordId} (awarded to ${dwellingBenefit.familyId}). Even if households have separated, public housing grants cannot be awarded twice to the same physical dwelling structure without verified independent new construction.`,
          officerActionRecommended: 'Conduct field inspection to verify if the applicant has constructed a separate independent dwelling unit or is claiming assistance on the ancestral unit.',
          requiresOfficerReview: true
        };
      }
    }

    // 1.4 Check Historical Household Membership for Newly Separated Citizens
    // If a citizen was in a household that received a household benefit within the last 3 years:
    const citizenHistories = dataStore.getMembershipHistory(null, citizenId);
    for (const hist of citizenHistories) {
      if (hist.familyId !== familyId) {
        // Look up benefits the prior household received while citizen was a member
        const priorFamilyBenefits = existingBenefits.filter(b => 
          b.schemeId === schemeId && 
          b.familyId === hist.familyId
        );

        if (priorFamilyBenefits.length > 0) {
          const priorRecord = priorFamilyBenefits[0];
          return {
            isPotentialDuplicate: true,
            flagType: 'ANCESTRAL_HOUSEHOLD_HISTORY',
            matchedRecordId: priorRecord.benefitRecordId,
            explanation: `Notice for Officer Review: Citizen ${citizen.fullName} (${citizenId}) previously belonged to household ${hist.familyId}, which received ${scheme.name} (Record ${priorRecord.benefitRecordId}). Citizen has since moved to new household ${familyId} via approved separation.`,
            officerActionRecommended: 'Confirm that applicant is establishing a completely new independent household unit with distinct dwelling and does not share hearth/dwelling with ancestral family.',
            requiresOfficerReview: true
          };
        }
      }
    }
  }

  // CASE 2: INDIVIDUAL-LEVEL SCHEMES (e.g. PM-KISAN, PMKVY)
  if (scheme.benefitType === 'Individual') {
    // 2.1 Check if this individual citizen already received the benefit
    const citizenPriorBenefit = existingBenefits.find(b => 
      b.schemeId === schemeId && 
      b.citizenId === citizenId
    );

    if (citizenPriorBenefit) {
      return {
        isPotentialDuplicate: true,
        flagType: 'INDIVIDUAL_DUPLICATE',
        matchedRecordId: citizenPriorBenefit.benefitRecordId,
        explanation: `Citizen ${citizen.fullName} (${citizenId}) is already a registered active beneficiary of ${scheme.name} (Benefit Record: ${citizenPriorBenefit.benefitRecordId}). Repeated enrolment is restricted.`,
        officerActionRecommended: 'Direct citizen to grievance portal if payments were interrupted; reject duplicate new registration.',
        requiresOfficerReview: true
      };
    }

    // 2.2 Check if active application is already in review for this citizen
    const pendingCitizenApp = existingApplications.find(a => 
      a.schemeId === schemeId && 
      a.applicantCitizenId === citizenId && 
      ['Submitted', 'Pending Verification', 'Additional Information Required', 'Approved'].includes(a.status)
    );

    if (pendingCitizenApp) {
      return {
        isPotentialDuplicate: true,
        flagType: 'INDIVIDUAL_DUPLICATE',
        matchedRecordId: pendingCitizenApp.applicationId,
        explanation: `An active application (${pendingCitizenApp.applicationId}) is already under administrative review for ${citizen.fullName}.`,
        officerActionRecommended: 'Inform citizen of active application status.',
        requiresOfficerReview: true
      };
    }

    // Note: Sibling or other family members having received the individual benefit does NOT block this citizen!
    // Example: Rahul received PM-KISAN. Amit applying for PMKVY or PM-KISAN is evaluated on his OWN credentials.
  }

  // Clear - No Duplicate Detected
  return {
    isPotentialDuplicate: false,
    flagType: null,
    matchedRecordId: null,
    explanation: `No conflicting prior claims or duplicate applications detected for this ${scheme.benefitType.toLowerCase()} scheme.`,
    officerActionRecommended: null,
    requiresOfficerReview: false
  };
};

module.exports = { detectDuplicateBenefit };
