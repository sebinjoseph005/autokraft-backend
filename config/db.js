const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30s timeout
      socketTimeoutMS: 45000, // Close idle connections after 45s
    });

    console.log(`✅ MongoDB Connected to database: "${conn.connection.name}"`);
    console.log(`📍 Host: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('🚀 Mongoose reconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose error:', err.message);
    });

  } catch (error) {
    console.error('\n❌ FATAL DB CONNECTION ERROR:');
    console.error('1. Verify your credentials in .env');
    console.error('2. Check IP whitelist in MongoDB Atlas');
    console.error('3. Ensure "autokraft" database exists\n');
    console.error('Full error:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 MongoDB disconnected (app termination)');
  process.exit(0);
});

module.exports = connectDB;