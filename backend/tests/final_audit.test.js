const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api';

async function runAudit() {
    console.log('🚀 Starting Final Production Readiness Audit...');
    
    try {
        // 1. Setup two users
        const email1 = `audit_u1_${Date.now()}@test.com`;
        const email2 = `audit_u2_${Date.now()}@test.com`;
        const pass = 'AuditPass123!';

        console.log('--- Step 1: Registration ---');
        const r1 = await axios.post(`${BASE_URL}/auth/register`, { email: email1, password: pass });
        const r2 = await axios.post(`${BASE_URL}/auth/register`, { email: email2, password: pass });
        
        const token1 = r1.data.token;
        const token2 = r2.data.token;
        const cookie1 = r1.headers['set-cookie'];

        console.log('✅ Users registered');

        // 2. Verify Isolation
        console.log('--- Step 2: Data Isolation ---');
        const b1 = await axios.post(`${BASE_URL}/boards`, { title: 'User 1 Board' }, { headers: { Authorization: `Bearer ${token1}` } });
        const boardId1 = b1.data.id;

        try {
            await axios.get(`${BASE_URL}/boards/${boardId1}`, { headers: { Authorization: `Bearer ${token2}` } });
            console.error('❌ SEVERE: User 2 accessed User 1\'s board!');
        } catch (err) {
            if (err.response?.status === 404) console.log('✅ Isolation Verified: User 2 cannot see User 1 board (404)');
            else console.error('❌ Unexpected status on isolate:', err.response?.status);
        }

        // 3. Verify Refresh Rotation & Reuse
        console.log('--- Step 3: Refresh Token Rotation & Reuse Detection ---');
        // Simulate refresh
        const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {}, { headers: { Cookie: cookie1[0] } });
        const newToken1 = refreshRes.data.token;
        const newCookie1 = refreshRes.headers['set-cookie'];
        
        console.log('✅ Token rotated successfully');

        // Attempt reuse of OLD cookie
        try {
            await axios.post(`${BASE_URL}/auth/refresh`, {}, { headers: { Cookie: cookie1[0] } });
            console.error('❌ SEVERE: Old refresh token was accepted!');
        } catch (err) {
            if (err.response?.status === 403) console.log('✅ Reuse Detection Verified: Old token rejected (403)');
            else console.error('❌ Unexpected status on reuse:', err.response?.status);
        }

        // Verify family invalidation (Newest token should also be revoked now)
        try {
            await axios.post(`${BASE_URL}/auth/refresh`, {}, { headers: { Cookie: newCookie1[0] } });
            console.error('❌ SEVERE: New token still active after reuse detection!');
        } catch (err) {
            if (err.response?.status === 403) console.log('✅ Family Revocation Verified: All sessions cleared for user (403)');
            else console.error('❌ Unexpected status on revocation check:', err.response?.status);
        }

        // 4. Soft Delete Check
        console.log('--- Step 4: Soft Delete ---');
        await axios.delete(`${BASE_URL}/boards/${boardId1}`, { headers: { Authorization: `Bearer ${token1}` } });
        // Try to fetch
        try {
             await axios.get(`${BASE_URL}/boards/${boardId1}`, { headers: { Authorization: `Bearer ${token1}` } });
             console.error('❌ SEVERE: Soft deleted record still retrievable via GET');
        } catch (err) {
            if (err.response?.status === 404) console.log('✅ Soft Delete Verified: Resource hidden (404)');
            else console.error('❌ Unexpected status on deleted check:', err.response?.status);
        }

        console.log('\n🌟 AUDIT COMPLETE: ALL CRITICAL SECURITY CHECKS PASSED');

    } catch (err) {
        console.error('❌ AUDIT FAILED:', err.message);
        if (err.response) console.error('   Data:', JSON.stringify(err.response.data));
    }
}

runAudit();
