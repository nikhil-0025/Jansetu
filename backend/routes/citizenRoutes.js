const express = require('express');
const router = express.Router();
const dataStore = require('../models/dataStore');
const { requireAuth } = require('../middleware/auth');

// GET /api/citizens/:citizenId
router.get('/:citizenId', requireAuth, (req, res) => {
  const { citizenId } = req.params;
  const citizen = dataStore.findCitizen(citizenId);

  if (!citizen) {
    return res.status(404).json({ success: false, message: `Citizen ${citizenId} not found.` });
  }

  // Cross-household security check for citizens
  if (req.user.role === 'citizen' && citizen.currentFamilyId !== req.user.familyId) {
    // Check if citizen was a historical member or has direct family relationship
    const isHistorical = dataStore.getMembershipHistory(req.user.familyId, citizenId).length > 0;
    const isRelated = dataStore.getRelationshipsForCitizens([citizenId]).length > 0;
    if (!isHistorical && !isRelated) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: You may only view members of your current or related household.'
      });
    }
  }

  const household = dataStore.findHousehold(citizen.currentFamilyId);
  const relationships = dataStore.getRelationshipsForCitizens([citizenId]);

  res.json({
    success: true,
    citizen: {
      ...citizen,
      householdAddress: household ? household.address : null,
      householdDwellingReference: household ? household.dwellingReference : null,
      relationships
    }
  });
});

// GET /api/citizens/:citizenId/relationships
router.get('/:citizenId/relationships', requireAuth, (req, res) => {
  const { citizenId } = req.params;
  const citizen = dataStore.findCitizen(citizenId);
  if (!citizen) {
    return res.status(404).json({ success: false, message: `Citizen ${citizenId} not found.` });
  }

  const rawRelationships = dataStore.getRelationshipsForCitizens([citizenId]);
  
  // Format with relative names and current family IDs to demonstrate stability across separation
  const formatted = rawRelationships.map(rel => {
    const otherCitizenId = rel.citizenId1 === citizenId ? rel.citizenId2 : rel.citizenId1;
    const otherCitizen = dataStore.findCitizen(otherCitizenId);
    return {
      relationshipId: rel.relationshipId,
      relationshipType: rel.relationshipType,
      targetCitizenId: otherCitizenId,
      targetCitizenName: otherCitizen ? otherCitizen.fullName : otherCitizenId,
      targetCurrentFamilyId: otherCitizen ? otherCitizen.currentFamilyId : null,
      sharesHousehold: otherCitizen ? otherCitizen.currentFamilyId === citizen.currentFamilyId : false,
      notes: rel.notes
    };
  });

  res.json({
    success: true,
    citizenId,
    citizenName: citizen.fullName,
    currentFamilyId: citizen.currentFamilyId,
    relationships: formatted
  });
});

// GET /api/citizens/:citizenId/history
router.get('/:citizenId/history', requireAuth, (req, res) => {
  const { citizenId } = req.params;
  const history = dataStore.getMembershipHistory(null, citizenId);

  res.json({
    success: true,
    citizenId,
    history
  });
});

module.exports = router;
