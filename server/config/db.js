import mongoose from 'mongoose';
import dns from 'dns';

// Force Node.js to use Google DNS for MongoDB connections
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4
      retryWrites: true,
      w: 'majority'
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
