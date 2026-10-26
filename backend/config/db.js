const mongoose = require('mongoose');
const { seedBaselineData } = require('./seedBaseline');

let isMongoConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jansetu';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    isMongoConnected = true;
    console.log('[JanSetu DB] Connected successfully to MongoDB Atlas');
    await seedBaselineData();
  } catch (err) {
    isMongoConnected = false;
    console.warn(`[JanSetu DB] MongoDB connection could not be established (${err.message}).`);
    console.log(`[JanSetu DB] Operating in high-performance DEMO IN-MEMORY / JSON STORE mode with full persistence for active session.`);
  }
};

const getMongoStatus = () => ({
  connected: isMongoConnected,
  mode: isMongoConnected ? 'MongoDB (Live Cluster/Instance)' : 'JanSetu Demo Mode (Local In-Memory / File Store)'
});

module.exports = { connectDB, getMongoStatus };

