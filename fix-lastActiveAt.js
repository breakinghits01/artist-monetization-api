const mongoose = require('mongoose');

mongoose.connect('mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin')
  .then(async () => {
    const User = require('./dist/models/User.model').default;
    
    console.log('🔧 Fixing lastActiveAt timestamps for inactive users...\n');
    
    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users\n`);
    
    let fixed = 0;
    const problematicTime = new Date('2026-03-06T08:12:07.000Z'); // 4:12 PM today
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    for (const user of users) {
      // If lastActiveAt is around 4:12 PM today AND user has lastLogin
      // Set lastActiveAt to lastLogin (when they actually last logged in)
      const lastActiveTime = new Date(user.lastActiveAt).getTime();
      const problematicTimeMs = problematicTime.getTime();
      const diff = Math.abs(lastActiveTime - problematicTimeMs);
      
      if (diff < 60000) { // Within 1 minute of 4:12 PM
        if (user.lastLogin) {
          // Set to their last login time
          await User.findByIdAndUpdate(user._id, {
            lastActiveAt: user.lastLogin,
            isOnline: false,
          });
          console.log(`✅ Fixed ${user.username}: set lastActiveAt to lastLogin (${user.lastLogin})`);
          fixed++;
        } else {
          // Never logged in - set to created date
          await User.findByIdAndUpdate(user._id, {
            lastActiveAt: user.createdAt,
            isOnline: false,
          });
          console.log(`✅ Fixed ${user.username}: set lastActiveAt to createdAt (${user.createdAt})`);
          fixed++;
        }
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} users`);
    
    // Show updated data
    console.log('\n📊 Updated user activity (top 10):\n');
    const updated = await User.find({})
      .select('username lastActiveAt isOnline')
      .sort({ lastActiveAt: -1 })
      .limit(10);
    
    const now = new Date();
    updated.forEach(u => {
      const diffMinutes = Math.floor((now - new Date(u.lastActiveAt)) / 60000);
      console.log(`${u.username}: isOnline=${u.isOnline}, lastActive=${diffMinutes}min ago`);
    });
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
