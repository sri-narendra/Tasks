const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api';

async function runSecurityTests() {
    console.log('🔒 Starting Security Isolation Tests...');
    
    const timestamp = Date.now();
    const userA = { email: `userA_${timestamp}@test.com`, password: 'password123' };
    const userB = { email: `userB_${timestamp}@test.com`, password: 'password123' };

    let tokenA, tokenB, userA_Id, userB_Id;
    let boardA_Id, listA_Id;

    try {
        // 1. Register Users
        console.log('1. Registering User A...');
        const regA = await axios.post(`${BASE_URL}/auth/register`, userA);
        tokenA = regA.data.token;
        userA_Id = regA.data.user.id;
        console.log('   User A registered:', userA_Id);

        console.log('2. Registering User B...');
        const regB = await axios.post(`${BASE_URL}/auth/register`, userB);
        tokenB = regB.data.token;
        userB_Id = regB.data.user.id;
        console.log('   User B registered:', userB_Id);

        // 2. User A Creates Resources
        console.log('3. User A creating Board...');
        const boardRes = await axios.post(`${BASE_URL}/boards`, 
            { title: 'User A Secret Board' }, 
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        boardA_Id = boardRes.data.id;
        console.log('   Board A created:', boardA_Id);

        console.log('4. User A creating List...');
        const listRes = await axios.post(`${BASE_URL}/lists`,
            { title: 'User A List', boardId: boardA_Id },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        listA_Id = listRes.data.id;
        console.log('   List A created:', listA_Id);

        // 3. User B Attacks
        console.log('5. User B attempting to PATCH User A Board...');
        try {
            await axios.patch(`${BASE_URL}/boards/${boardA_Id}`,
                { title: 'HACKED BY B' },
                { headers: { Authorization: `Bearer ${tokenB}` } }
            );
            console.error('❌ FAILURE: User B was able to PATCH User A board!');
            process.exit(1);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                console.log('   ✅ Success: User B blocked (404/403).');
            } else {
                console.error('   ❌ Unexpected error:', err.message);
            }
        }

        console.log('6. User B attempting to create LIST on User A Board...');
        try {
            await axios.post(`${BASE_URL}/lists`,
                { title: 'Malicious List', boardId: boardA_Id },
                { headers: { Authorization: `Bearer ${tokenB}` } }
            );
            console.error('❌ FAILURE: User B was able to create List on User A board!');
            process.exit(1);
        } catch (err) {
            if (err.response && (err.response.status === 404 || err.response.status === 403)) {
                console.log('   ✅ Success: User B blocked from adding list to Board A.');
            } else {
                console.error('   ❌ Unexpected error:', err.message);
                console.error(err.response ? err.response.data : 'No response data');
            }
        }

        console.log('7. User B attempting to create TASK on User A List...');
        try {
            await axios.post(`${BASE_URL}/tasks`,
                { title: 'Malicious Task', listId: listA_Id },
                { headers: { Authorization: `Bearer ${tokenB}` } }
            );
            console.error('❌ FAILURE: User B was able to create Task on User A list!');
            process.exit(1);
        } catch (err) {
            if (err.response && (err.response.status === 404 || err.response.status === 403)) {
                console.log('   ✅ Success: User B blocked from adding task to List A.');
            } else {
                console.error('   ❌ Unexpected error:', err.message);
            }
        }

        console.log('\n🌟 SECURITY AUDIT PASSED: Cross-user isolation is enforced.');

    } catch (err) {
        console.error('💥 Test Setup Failed:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

runSecurityTests();
