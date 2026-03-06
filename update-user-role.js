const mongoose = require('mongoose');
const User = require('./dist/models/User.model').default;
const ArtistProfile = require('./dist/models/ArtistProfile.model').default;

const MONGODB_URI = 'mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin';

mongoose.connect(MONGODB_URI).then(async () => {
  const user = await User.findOne({ username: 'RawAge1' });
  
  if (!user) {
    console.log('❌ User not found');
    await mongoose.connection.close();
    return;
  }
  
  // Update user role
  user.role = 'artist';
  await user.save();
  console.log('✅ Updated user role to artist');
  
  // Create artist profile
  const artistProfile = new ArtistProfile({
    userId: user._id,
    bio: '',
    genres: [],
    socialLinks: {},
    status: 'active',
    isVerified: false
  });
  await artistProfile.save();
  console.log('✅ Created artist profile');
  console.log('Artist Profile ID:', artistProfile._id.toString());
  
  await mongoose.connection.close();
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
