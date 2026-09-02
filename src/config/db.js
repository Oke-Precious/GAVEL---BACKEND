const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  try {
    if (!env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    const conn = await mongoose.connect(env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
