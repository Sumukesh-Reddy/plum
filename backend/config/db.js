const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Don't crash the server if MongoDB is not configured yet
    console.warn('Running without MongoDB — data will not be persisted');
  }
};

module.exports = connectDB;
