require('dotenv').config();

const mongoose = require('mongoose');

async function testConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000
    });

    console.log('SUCCESS: Connected to MongoDB Atlas');
  } catch (error) {
    console.log('FAILED:', error.code || error.name);
    console.log('Message:', error.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

testConnection();