const axios = require('axios');

// Test the admin/users endpoint
async function testAPI() {
  try {
    // First, login to get token
    console.log('🔑 Logging in as admin...\n');
    const loginResponse = await axios.post('https://artistmonetization.xyz/api/v1/admin/login', {
      email: 'admin@artistmonetization.xyz',
      password: 'Admin@2024Secure!'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Got token:', token.substring(0, 20) + '...\n');
    
    // Now fetch users
    console.log('👥 Fetching users from API...\n');
    const usersResponse = await axios.get('https://artistmonetization.xyz/api/v1/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        status: 'all',
        page: 1,
        limit: 5
      }
    });
    
    const users = usersResponse.data.data.users;
    console.log(`📊 Got ${users.length} users from API:\n`);
    
    users.forEach(user => {
      console.log(`User: ${user.username}`);
      console.log(`  lastActiveAt: ${user.lastActiveAt || 'null'}`);
      console.log(`  isOnline: ${user.isOnline}`);
      console.log(`  deviceType: ${user.deviceType || 'null'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAPI();
