const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin';

async function findRawAge1() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    // Search for RawAge1 user
    const user = await User.findOne({ username: /rawage1/i }).lean();
    
    if (user) {
      console.log('\n✅ Found RawAge1 user:');
      console.log('   UserId:', user._id);
      console.log('   Username:', user.username);
      console.log('   Email:', user.email);
    } else {
      console.log('\n❌ RawAge1 user not found');
      console.log('\nSearching for all users:');
      const users = await User.find({}).select('username email _id').limit(20).lean();
      users.forEach(u => {
        console.log(`  - ${u.username} | ${u.email} | ID: ${u._id}`);
      });
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

findRawAge1();
