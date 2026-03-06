const axios = require('axios');

async function testActivityTracking() {
  try {
    console.log('🔐 Logging in as dekzblaster2...\n');
    
    const loginResponse = await axios.post('https://artistmonetization.xyz/api/v1/auth/login', {
      email: 'frederick@breakinghits.com',
      password: 'Breakinghits123@'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Logged in successfully!\n');
    
    // Wait a moment for the activity tracking to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check database for updated activity
    const mongoose = require('mongoose');
    await mongoose.connect('mongodb://admin:adminpassword@localhost:27017/artist_monetization?authSource=admin');
    
    const User = require('./dist/models/User.model').default;
    const user = await User.findOne({ username: 'dekzblaster2' }).select('username lastActiveAt isOnline deviceType');
    
    console.log('📊 dekzblaster2 activity after login:');
    console.log('  lastActiveAt:', user.lastActiveAt);
    console.log('  isOnline:', user.isOnline);
    console.log('  deviceType:', user.deviceType);
    console.log('  Time now:', new Date());
    console.log('  Seconds ago:', Math.floor((new Date() - new Date(user.lastActiveAt)) / 1000));
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testActivityTracking();
