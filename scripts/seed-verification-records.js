/**
 * JanSetu local synthetic records seeder.
 * These are fictional test records, not official government data.
 * Run from project root: node scripts/seed-verification-records.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const records = require('../data/verification-records.json');

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from the project-root .env file.');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000
  });

  try {
    const collection = mongoose.connection.collection('verification_records');
    const now = new Date();

    const operations = records.map((record) => ({
      updateOne: {
        filter: { recordId: record.recordId },
        update: {
          $set: {
            ...record,
            fullNameNormalized: record.fullName.trim().toLowerCase(),
            familyReferenceIdNormalized: String(record.familyReferenceId).trim(),
            updatedAt: now
          },
          $setOnInsert: { createdAt: now }
        },
        upsert: true
      }
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });
    console.log('[JanSetu] Synthetic verification records seeded.');
    console.log(`Collection: ${collection.collectionName}`);
    console.log(`Dataset records: ${records.length}`);
    console.log(`Inserted: ${result.upsertedCount}; Updated: ${result.modifiedCount}`);
    console.log('Important: these records are fictional and are not official government verification.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('[JanSetu] Seeding failed:', error.message);
  process.exitCode = 1;
});
