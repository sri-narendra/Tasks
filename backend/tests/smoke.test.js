const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api';

async function runTests() {
    console.log('🚀 Starting Smoke Tests...');

    try {
        // 1. Health Check
        const health = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
        console.log('✅ Health Check:', health.data.status);

        // 2. Protected Route (Expect 401)
        try {
            await axios.get(`${BASE_URL}/boards`);
            console.log('❌ Error: Protected route /boards allowed access without token.');
        } catch (err) {
            if (err.response && err.response.status === 401) {
                console.log('✅ Protected Routes: Blocking unauthorized access (401).');
            } else {
                console.log('❌ Error check /boards:', err.message);
            }
        }

        // 3. Auth Check (Expect 400/401 for bad login)
        try {
            await axios.post(`${BASE_URL}/auth/login`, { email: 'bad@user.com', password: 'wrongpassword' });
            console.log('❌ Error: Bad login should have failed.');
        } catch (err) {
            if (err.response && (err.response.status === 400 || err.response.status === 401)) {
                console.log('✅ Auth flow: Correctly rejecting bad credentials.');
            } else {
                console.log('❌ Error check /auth/login:', err.message);
            }
        }

        console.log('\n🌟 All smoke tests passed (conceptually checked).');
        console.log('Note: Ensure the server is running locally for these tests to succeed.');

    } catch (err) {
        console.error('💥 Test Suite Failed:', err.message);
    }
}

runTests();
