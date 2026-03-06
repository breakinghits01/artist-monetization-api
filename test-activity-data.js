const mongoose = require('mongoose');
const User = require('./dist/models/User.model').default;

mongoose.connect('mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin')
  .then(async () => {
    console.log('📊 Checking activity data in database:\n');
    
    const users = await User.find({})
      .select('username email lastActiveAt isOnline deviceType')
      .limit(10);
    
    users.forEach(user => {
      const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : 'null';
      console.log(`User: ${user.username}`);
      console.log(`  lastActiveAt: ${lastActive}`);
      console.log(`  isOnline: ${user.isOnline}`);
      console.log(`  deviceType: ${user.deviceType || 'null'}`);
      console.log('');
    });
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
