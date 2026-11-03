// ==============================================================================
// HostelCare - Automated Test Suite for Table 6.1 Test Cases
// ==============================================================================

const http = require('http');

function apiCall(port, path, method = 'GET', body = null, token = null) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        let bodyStr = body ? JSON.stringify(body) : null;
        if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: path,
            method: method,
            headers: headers
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(data); } catch { parsed = data; }
                resolve({ status: res.statusCode, data: parsed });
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function runTests() {
    console.log('--- Starting HostelCare Test Suite (Chapter 6.1) ---');
    let passed = 0;
    let failed = 0;

    function assert(cond, name) {
        if (cond) {
            console.log(`✅ [PASS] ${name}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${name}`);
            failed++;
        }
    }

    try {
        // Test Case 1: Register valid student
        const randEmail = `newstudent_${Date.now()}@hostel.edu`;
        const tc1 = await apiCall(8000, '/auth.php?action=register', 'POST', {
            full_name: 'John Doe',
            email: randEmail,
            password: 'password123'
        });
        assert(tc1.status === 201 && tc1.data.user.role === 'STUDENT' && tc1.data.token, 'Test Case 1: Register valid student (role STUDENT & token returned)');

        // Test Case 2: Register password < 6 chars
        const tc2 = await apiCall(8000, '/auth.php?action=register', 'POST', {
            full_name: 'Short Pass',
            email: 'short@hostel.edu',
            password: '123'
        });
        assert(tc2.status === 422 && tc2.data.error.includes('minimum 6 characters'), 'Test Case 2: Register with password < 6 chars returns 422');

        // Test Case 3: Register duplicate email
        const tc3 = await apiCall(8000, '/auth.php?action=register', 'POST', {
            full_name: 'Duplicate',
            email: randEmail,
            password: 'password123'
        });
        assert(tc3.status === 409 && tc3.data.error.includes('Email already registered'), 'Test Case 3: Register duplicate email returns 409');

        // Test Case 4: Login with wrong password
        const tc4 = await apiCall(8000, '/auth.php?action=login', 'POST', {
            email: randEmail,
            password: 'wrongpassword'
        });
        assert(tc4.status === 401 && tc4.data.error.includes('Invalid email or password'), 'Test Case 4: Login with wrong password returns 401');

        // Login as student
        const studentLogin = await apiCall(8000, '/auth.php?action=login', 'POST', {
            email: 'student@hostel.edu',
            password: 'password123'
        });
        const studentToken = studentLogin.data.token;

        // Login as admin
        const adminLogin = await apiCall(8000, '/auth.php?action=login', 'POST', {
            email: 'admin@hostel.edu',
            password: 'password123'
        });
        const adminToken = adminLogin.data.token;

        // Test Case 5: Submit form with empty field
        const tc5 = await apiCall(8000, '/issues.php', 'POST', {
            title: '',
            category: 'Plumbing',
            location: 'Block A',
            description: ''
        }, studentToken);
        assert(tc5.status === 422 && tc5.data.error.includes('All fields are required'), 'Test Case 5: Submit issue with empty field returns 422');

        // Test Case 6: Submit a valid issue
        const tc6 = await apiCall(8000, '/issues.php', 'POST', {
            title: 'Bathroom shower pipe valve leakage',
            category: 'Plumbing',
            priority: 'HIGH',
            location: 'Block A, Room 104',
            description: 'Water pressure caused the shower pipe valve to crack, causing continuous water flow on the bathroom floor.'
        }, studentToken);
        assert(tc6.status === 201 && tc6.data.issue.status === 'SUBMITTED', 'Test Case 6: Submit valid issue returns 201 and SUBMITTED');
        const createdIssueId = tc6.data.issue.id;

        // Test Case 7: Student opens dashboard (only sees own requests)
        const tc7 = await apiCall(8000, '/issues.php', 'GET', null, studentToken);
        const allOwn = Array.isArray(tc7.data) && tc7.data.every(i => i.user_id === 1);
        assert(tc7.status === 200 && allOwn, 'Test Case 7: Student dashboard only returns student own requests');

        // Test Case 8: Call issues.php without token
        const tc8 = await apiCall(8000, '/issues.php', 'GET', null, null);
        assert(tc8.status === 401 && tc8.data.error.includes('Missing bearer token'), 'Test Case 8: Call issues.php without token returns 401');

        // Test Case 9: Call with tampered token
        const tc9 = await apiCall(8000, '/issues.php', 'GET', null, studentToken + 'tampered');
        assert(tc9.status === 401 && tc9.data.error.includes('Invalid token signature'), 'Test Case 9: Tampered token returns 401');

        // Test Case 10: Student calls Java status endpoint
        const tc10 = await apiCall(8080, '/hostel-java/api/maintenance/status', 'POST', {
            issue_id: createdIssueId,
            status: 'IN_PROGRESS'
        }, studentToken);
        assert(tc10.status === 403 && tc10.data.error.includes('Admin access required'), 'Test Case 10: Student calling Java status endpoint returns 403 Forbidden');

        // Test Case 11: Admin sets request to IN_PROGRESS, then RESOLVED via Java Service
        const tc11a = await apiCall(8080, '/hostel-java/api/maintenance/status', 'POST', {
            issue_id: createdIssueId,
            status: 'IN_PROGRESS',
            remarks: 'Technician assigned to inspect valve.'
        }, adminToken);
        const tc11b = await apiCall(8080, '/hostel-java/api/maintenance/status', 'POST', {
            issue_id: createdIssueId,
            status: 'RESOLVED',
            remarks: 'Replaced leaking valve and washer. Tested under full pressure.'
        }, adminToken);
        assert(tc11a.status === 200 && tc11b.status === 200 && tc11b.data.new_status === 'RESOLVED', 'Test Case 11: Admin updates status via Java service to IN_PROGRESS then RESOLVED');

        // Test Case 12: Admin updates an issue id that does not exist
        const tc12 = await apiCall(8080, '/hostel-java/api/maintenance/status', 'POST', {
            issue_id: 999999,
            status: 'RESOLVED'
        }, adminToken);
        assert(tc12.status === 404 && tc12.data.error.includes('Issue not found'), 'Test Case 12: Update non-existent issue returns 404');

        // Test Case 13: Admin sends invalid status
        const tc13 = await apiCall(8080, '/hostel-java/api/maintenance/status', 'POST', {
            issue_id: createdIssueId,
            status: 'INVALID_STATUS'
        }, adminToken);
        assert(tc13.status === 422 && tc13.data.error.includes('Invalid issue id or status'), 'Test Case 13: Invalid status string returns 422');

        // Test Case 14: Read audit history without issue_id
        const tc14 = await apiCall(8080, '/hostel-java/api/maintenance/audit', 'GET', null, adminToken);
        assert(tc14.status === 400 && tc14.data.error.includes('issue_id is required'), 'Test Case 14: Read audit without issue_id returns 400');

        // Test Case 14b: Read audit history WITH valid issue_id
        const tc14b = await apiCall(8080, `/hostel-java/api/maintenance/audit?issue_id=${createdIssueId}`, 'GET', null, adminToken);
        assert(tc14b.status === 200 && Array.isArray(tc14b.data) && tc14b.data.length >= 2, 'Test Case 14b: Read audit with issue_id returns history rows');

        console.log(`\nResults: ${passed} Passed, ${failed} Failed out of ${passed + failed} Tests.`);
        if (failed === 0) {
            console.log('🎉 ALL PROJECT REPORT TEST CASES PASSED PERFECTLY!');
            process.exit(0);
        } else {
            process.exit(1);
        }
    } catch (e) {
        console.error('Test suite error:', e);
        process.exit(1);
    }
}

// Start server and run tests
require('./server.js');
setTimeout(runTests, 1000);

