const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// MongoDB connection string from environment
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/artist_monetization';

// Admin user data
const adminUser = {
  email: 'admin@artistmonetization.xyz',
  username: 'admin',
  password: 'Admin@123456', // Change this after first login!
  role: 'admin',
  tokens: 0,
  isVerified: true,
  loginAttempts: 0,
};

async function createAdminUser() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Define User schema inline
    const UserSchema = new mongoose.Schema({
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      username: { type: String, unique: true, sparse: true },
      role: { type: String, enum: ['artist', 'fan', 'admin'], default: 'fan' },
      tokens: { type: Number, default: 0 },
      isVerified: { type: Boolean, default: false },
      loginAttempts: { type: Number, default: 0 },
    }, { timestamps: true });

    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:');
      console.log('   Email:', existingAdmin.email);
      console.log('   Username:', existingAdmin.username);
      console.log('\n💡 Use this account to login to CMS');
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    adminUser.password = await bcrypt.hash(adminUser.password, salt);

    // Create admin user
    const admin = await User.create(adminUser);

    console.log('\n✅ Admin user created successfully!');
    console.log('\n📧 Login Credentials:');
    console.log('   Email:', 'admin@artistmonetization.xyz');
    console.log('   Password:', 'Admin@123456');
    console.log('\n🔗 CMS Login:', 'https://cms.artistmonetization.xyz/login');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('\n👤 User ID:', admin._id);

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
createAdminUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
