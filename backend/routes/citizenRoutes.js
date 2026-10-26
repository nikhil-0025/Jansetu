const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dataStore = require('../models/dataStore');
const { requireAuth } = require('../middleware/auth');
const {
  Citizen,
  Household,
  FamilyRelationship,
  HouseholdMembershipHistory
} = require('../models/schemaDefinitions');

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// GET /api/citizens/:citizenId
router.get('/:citizenId', requireAuth, async (req, res) => {
  const { citizenId } = req.params;
  let citizen = null;
  let household = null;
  let relationships = [];

  if (isMongoReady()) {
    try {
      citizen = await Citizen.findOne({ citizenId }).lean();
      if (citizen) {
        household = await Household.findOne({ familyId: citizen.currentFamilyId }).lean();
        relationships = await FamilyRelationship.find({
          $or: [{ citizenId1: citizenId }, { citizenId2: citizenId }],
          isActive: { $ne: false }
        }).lean();
      }
    } catch (dbErr) {
      console.warn('[Citizen] Mongo lookup warning:', dbErr.message);
    }
  }

  if (!citizen) {
    citizen = dataStore.findCitizen(citizenId);
    if (citizen) {
      household = dataStore.findHousehold(citizen.currentFamilyId);
      relationships = dataStore.getRelationshipsForCitizens([citizenId]);
    }
  }

  if (!citizen) {
    return res.status(404).json({ success: false, message: `Citizen ${citizenId} not found.` });
  }

  // Cross-household security check for citizens
  if (req.user.role === 'citizen' && citizen.currentFamilyId !== req.user.familyId) {
    let isHistorical = false;
    let isRelated = false;

    if (isMongoReady()) {
      try {
        const hist = await HouseholdMembershipHistory.findOne({ familyId: req.user.familyId, citizenId });
        isHistorical = !!hist;
        const rel = await FamilyRelationship.findOne({
          $or: [{ citizenId1: citizenId }, { citizenId2: citizenId }],
          isActive: { $ne: false }
        });
        isRelated = !!rel;
      } catch (e) {}
    }

    if (!isHistorical && !isRelated) {
      isHistorical = dataStore.getMembershipHistory(req.user.familyId, citizenId).length > 0;
      isRelated = dataStore.getRelationshipsForCitizens([citizenId]).length > 0;
    }

    if (!isHistorical && !isRelated) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: You may only view members of your current or related household.'
      });
    }
  }

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
router.get('/:citizenId/relationships', requireAuth, async (req, res) => {
  const { citizenId } = req.params;
  let citizen = null;
  let rawRelationships = [];

  if (isMongoReady()) {
    try {
      citizen = await Citizen.findOne({ citizenId }).lean();
      if (citizen) {
        rawRelationships = await FamilyRelationship.find({
          $or: [{ citizenId1: citizenId }, { citizenId2: citizenId }],
          isActive: { $ne: false }
        }).lean();
      }
    } catch (dbErr) {
      console.warn('[Citizen] Mongo relationships warning:', dbErr.message);
    }
  }

  if (!citizen) {
    citizen = dataStore.findCitizen(citizenId);
    if (citizen) {
      rawRelationships = dataStore.getRelationshipsForCitizens([citizenId]);
    }
  }

  if (!citizen) {
    return res.status(404).json({ success: false, message: `Citizen ${citizenId} not found.` });
  }

  // Format with relative names and current family IDs to demonstrate stability across separation
  const formatted = await Promise.all(rawRelationships.map(async rel => {
    const otherCitizenId = rel.citizenId1 === citizenId ? rel.citizenId2 : rel.citizenId1;
    let otherCitizen = null;
    if (isMongoReady()) {
      try {
        otherCitizen = await Citizen.findOne({ citizenId: otherCitizenId }).lean();
      } catch (e) {}
    }
    if (!otherCitizen) {
      otherCitizen = dataStore.findCitizen(otherCitizenId);
    }

    return {
      relationshipId: rel.relationshipId,
      relationshipType: rel.relationshipType,
      targetCitizenId: otherCitizenId,
      targetCitizenName: otherCitizen ? otherCitizen.fullName : otherCitizenId,
      targetCurrentFamilyId: otherCitizen ? otherCitizen.currentFamilyId : null,
      sharesHousehold: otherCitizen ? otherCitizen.currentFamilyId === citizen.currentFamilyId : false,
      notes: rel.notes
    };
  }));

  res.json({
    success: true,
    citizenId,
    citizenName: citizen.fullName,
    currentFamilyId: citizen.currentFamilyId,
    relationships: formatted
  });
});

// GET /api/citizens/:citizenId/history
router.get('/:citizenId/history', requireAuth, async (req, res) => {
  const { citizenId } = req.params;
  let history = [];

  if (isMongoReady()) {
    try {
      history = await HouseholdMembershipHistory.find({ citizenId }).lean();
    } catch (dbErr) {
      console.warn('[Citizen] Mongo history warning:', dbErr.message);
    }
  }

  if (history.length === 0) {
    history = dataStore.getMembershipHistory(null, citizenId);
  }

  res.json({
    success: true,
    citizenId,
    history
  });
});

module.exports = router;
