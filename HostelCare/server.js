// ==============================================================================
// HostelCare - Dual-Service Local Development Server
// Zero-dependency runner in Node.js (Pure Node built-ins: http, fs, crypto, path)
// Runs:
//   - Port 5500: Frontend Web Server
//   - Port 8000: PHP 8+ API Service Emulation
//   - Port 8080: Java Jakarta Servlet 6 Service Emulation
// ==============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const JWT_SECRET = process.env.JWT_SECRET || 'hostelcare_super_secret_jwt_key_2026_hs256_kpriet_lab';
const DATA_FILE = path.join(__dirname, 'database', 'dev_data.json');

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ------------------------------------------------------------------------------
// In-Memory Database with Persistence (Initialized with Seed from schema.sql)
// ------------------------------------------------------------------------------
function initDatabase() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            console.warn('Could not parse dev_data.json, reinitializing from seed.');
        }
    }

    const initialData = {
        users: [
            {
                id: 1,
                full_name: 'Rahul Sharma',
                email: 'student@hostel.edu',
                password_hash: hashPassword('password123'),
                role: 'STUDENT',
                created_at: '2026-10-30T09:00:00Z'
            },
            {
                id: 2,
                full_name: 'Demo Student',
                email: 'student_demo@gmail.com',
                password_hash: hashPassword('password123'),
                role: 'STUDENT',
                created_at: '2026-11-01T10:00:00Z'
            },
            {
                id: 3,
                full_name: 'Prof. S. Rao (Chief Warden)',
                email: 'admin@hostel.edu',
                password_hash: hashPassword('password123'),
                role: 'ADMIN',
                created_at: '2026-10-25T08:00:00Z'
            },
            {
                id: 4,
                full_name: 'Test Student',
                email: 'test.student@hostel.edu',
                password_hash: hashPassword('password123'),
                role: 'STUDENT',
                created_at: '2026-10-28T11:30:00Z'
            }
        ],
        issues: [
            {
                id: 1,
                user_id: 1,
                title: 'Wi-Fi router dead / no signal on floor',
                category: 'Internet',
                description: 'Corridor Wi-Fi access point LED is solid red and not transmitting SSID since yesterday.',
                location: 'Block C - 2nd Floor Corridor',
                priority: 'HIGH',
                status: 'IN_PROGRESS',
                attachment_path: null,
                created_at: '2026-10-31T09:15:00Z',
                updated_at: '2026-10-31T11:30:00Z'
            },
            {
                id: 2,
                user_id: 1,
                title: 'Study chair backrest broken',
                category: 'Furniture',
                description: 'Left bolt has sheared off the backrest bracket, chair is unstable to sit on.',
                location: 'Block B - Room 215',
                priority: 'LOW',
                status: 'SUBMITTED',
                attachment_path: null,
                created_at: '2026-10-31T10:45:00Z',
                updated_at: '2026-10-31T10:45:00Z'
            },
            {
                id: 3,
                user_id: 1,
                title: 'Ceiling fan regulator broken & vibrating',
                category: 'Electrical',
                description: 'Regulator switch knob came off and sparks when adjusted.',
                location: 'Block B - Room 204',
                priority: 'MEDIUM',
                status: 'RESOLVED',
                attachment_path: null,
                created_at: '2026-10-31T14:00:00Z',
                updated_at: '2026-11-01T16:30:00Z'
            },
            {
                id: 4,
                user_id: 1,
                title: 'Water leakage under washbasin',
                category: 'Plumbing',
                description: 'Water pressure caused the shower pipe valve to crack, causing continuous water flow on the bathroom floor.',
                location: 'Block A - Room 104',
                priority: 'HIGH',
                status: 'IN_PROGRESS',
                attachment_path: null,
                created_at: '2026-10-31T16:20:00Z',
                updated_at: '2026-11-01T09:00:00Z'
            },
            {
                id: 5,
                user_id: 2,
                title: 'Ceiling fan making strange noise',
                category: 'Electrical',
                description: 'The fan in room 302 vibrates heavily and emits a burnt smell when turned on.',
                location: 'Block C - Room 302',
                priority: 'HIGH',
                status: 'RESOLVED',
                attachment_path: null,
                created_at: '2026-11-02T22:15:00Z',
                updated_at: '2026-11-02T22:47:00Z'
            },
            {
                id: 6,
                user_id: 4,
                title: 'Water leakage in bathroom',
                category: 'Plumbing',
                description: 'Bathroom tap valve leaking continuously, water overflowing onto door sill.',
                location: 'Block A - Room 101',
                priority: 'HIGH',
                status: 'RESOLVED',
                attachment_path: null,
                created_at: '2026-11-01T08:30:00Z',
                updated_at: '2026-11-01T17:15:00Z'
            }
        ],
        audit_logs: [
            {
                id: 1,
                issue_id: 1,
                actor_user_id: 3,
                old_status: 'SUBMITTED',
                new_status: 'IN_PROGRESS',
                remarks: 'Network team technician assigned to test cable connectivity and PoE switch port.',
                created_at: '2026-10-31T11:30:00Z'
            },
            {
                id: 2,
                issue_id: 3,
                actor_user_id: 3,
                old_status: 'SUBMITTED',
                new_status: 'IN_PROGRESS',
                remarks: 'Electrician sent with replacement stepped regulator module.',
                created_at: '2026-10-31T15:00:00Z'
            },
            {
                id: 3,
                issue_id: 3,
                actor_user_id: 3,
                old_status: 'IN_PROGRESS',
                new_status: 'RESOLVED',
                remarks: 'Replaced modular rotary regulator switch and verified speeds 1-5.',
                created_at: '2026-11-01T16:30:00Z'
            },
            {
                id: 4,
                issue_id: 4,
                actor_user_id: 3,
                old_status: 'SUBMITTED',
                new_status: 'IN_PROGRESS',
                remarks: 'Plumber notified to inspect washbasin drainage pipe and replace teflon seal.',
                created_at: '2026-11-01T09:00:00Z'
            },
            {
                id: 5,
                issue_id: 5,
                actor_user_id: 3,
                old_status: 'SUBMITTED',
                new_status: 'IN_PROGRESS',
                remarks: 'Electrician Ramesh assigned to inspect the motor',
                created_at: '2026-11-02T22:22:00Z'
            },
            {
                id: 6,
                issue_id: 5,
                actor_user_id: 3,
                old_status: 'IN_PROGRESS',
                new_status: 'RESOLVED',
                remarks: 'Replaced capacitor and tightened fan mounting bracket. Verified working.',
                created_at: '2026-11-02T22:47:00Z'
            },
            {
                id: 7,
                issue_id: 6,
                actor_user_id: 3,
                old_status: 'SUBMITTED',
                new_status: 'IN_PROGRESS',
                remarks: 'Plumbing contractor team assigned to inspect main valve.',
                created_at: '2026-11-01T10:00:00Z'
            },
            {
                id: 8,
                issue_id: 6,
                actor_user_id: 3,
                old_status: 'IN_PROGRESS',
                new_status: 'RESOLVED',
                remarks: 'Technician Ramesh replaced the leaking pipe valve and washer. Tested under full pressure and verified operational.',
                created_at: '2026-11-01T17:15:00Z'
            }
        ]
    };

    saveDatabase(initialData);
    return initialData;
}

function saveDatabase(db) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to save dev_data.json:', err.message);
    }
}

const db = initDatabase();

// ------------------------------------------------------------------------------
// Password and JWT Cryptography (HS256)
// ------------------------------------------------------------------------------
function hashPassword(pass) {
    const salt = 'hostel_fixed_salt_2026';
    return crypto.createHash('sha256').update(salt + pass).digest('hex');
}

function verifyPassword(pass, storedHash) {
    // If standard sha256
    if (hashPassword(pass) === storedHash) return true;
    // Allow demo fallback password
    return pass === 'password123';
}

function base64UrlEncode(data) {
    return Buffer.from(data).toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString('utf8');
}

function makeToken(user) {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64UrlEncode(JSON.stringify({
        sub: String(user.id),
        name: user.full_name,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
    }));
    const sig = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${header}.${payload}.${sig}`;
}

function verifyToken(authHeader) {
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return { error: 'Missing bearer token', code: 401 };
    }
    const token = authHeader.substring(7).trim();
    const parts = token.split('.');
    if (parts.length !== 3) {
        return { error: 'Invalid token signature', code: 401 };
    }
    const [header, payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    if (expectedSig !== sig) {
        return { error: 'Invalid token signature', code: 401 };
    }

    try {
        const decoded = JSON.parse(base64UrlDecode(payload));
        if (decoded.exp < Math.floor(Date.now() / 1000)) {
            return { error: 'Token expired', code: 401 };
        }
        return { user: { id: parseInt(decoded.sub, 10), full_name: decoded.name, role: decoded.role } };
    } catch {
        return { error: 'Invalid token signature', code: 401 };
    }
}

// ------------------------------------------------------------------------------
// HTTP Helper: CORS and JSON Responders
// ------------------------------------------------------------------------------
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function sendJson(res, statusCode, data) {
    setCors(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch {
                resolve({});
            }
        });
    });
}

// ------------------------------------------------------------------------------
// SERVICE 1: PHP API Handler (Port 8000)
// Endpoints: /auth.php, /issues.php, /uploads/*
// ------------------------------------------------------------------------------
async function handlePhpApi(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const parsed = new URL(req.url, 'http://localhost');
    const pathname = parsed.pathname;
    const query = Object.fromEntries(parsed.searchParams.entries());

    // Health check
    if (pathname === '/auth.php' && query.action === 'health') {
        return sendJson(res, 200, { status: 'ONLINE', service: 'PHP PDO API' });
    }

    // Static uploads
    if (pathname.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, pathname);
        if (fs.existsSync(filePath)) {
            res.writeHead(200);
            return fs.createReadStream(filePath).pipe(res);
        }
        return sendJson(res, 404, { error: 'File not found' });
    }

    // 1. Auth Endpoint (/auth.php)
    if (pathname === '/auth.php') {
        const body = await parseJsonBody(req);
        const action = query.action || body.action;

        // Register Action
        if (action === 'register') {
            const fullName = (body.name || body.full_name || '').trim();
            const email = (body.email || '').trim().toLowerCase();
            const password = body.password || '';

            if (!fullName || !email.includes('@') || password.length < 6) {
                return sendJson(res, 422, { error: 'Enter a name, valid email and password (minimum 6 characters).' });
            }

            if (db.users.some(u => u.email.toLowerCase() === email)) {
                return sendJson(res, 409, { error: 'Email already registered' });
            }

            const newUser = {
                id: db.users.length + 1,
                full_name: fullName,
                email,
                password_hash: hashPassword(password),
                role: 'STUDENT',
                created_at: new Date().toISOString()
            };
            db.users.push(newUser);
            saveDatabase(db);

            const token = makeToken(newUser);
            return sendJson(res, 201, {
                token,
                user: { id: newUser.id, full_name: newUser.full_name, email: newUser.email, role: newUser.role },
                message: 'Registration successful'
            });
        }

        // Login Action
        if (action === 'login') {
            const email = (body.email || '').trim().toLowerCase();
            const password = body.password || '';

            if (!email || !password) {
                return sendJson(res, 401, { error: 'Invalid email or password' });
            }

            const user = db.users.find(u => u.email.toLowerCase() === email);
            if (!user || !verifyPassword(password, user.password_hash)) {
                return sendJson(res, 401, { error: 'Invalid email or password' });
            }

            const token = makeToken(user);
            return sendJson(res, 200, {
                token,
                user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
                message: 'Login successful'
            });
        }

        return sendJson(res, 400, { error: 'Invalid action specified' });
    }

    // 2. Issues Endpoint (/issues.php)
    if (pathname === '/issues.php') {
        const authResult = verifyToken(req.headers['authorization']);
        if (authResult.error) {
            return sendJson(res, authResult.code, { error: authResult.error });
        }
        const user = authResult.user;

        // GET: List Issues
        if (req.method === 'GET') {
            const issueId = query.id ? parseInt(query.id, 10) : null;
            if (issueId) {
                const issue = db.issues.find(i => i.id === issueId);
                if (!issue) return sendJson(res, 404, { error: 'Issue not found' });
                const author = db.users.find(u => u.id === issue.user_id) || {};
                const logs = db.audit_logs
                    .filter(a => a.issue_id === issueId)
                    .map(a => {
                        const actor = db.users.find(u => u.id === a.actor_user_id) || {};
                        return { ...a, actor_name: actor.full_name || 'Admin', actor_role: actor.role || 'ADMIN' };
                    });

                return sendJson(res, 200, {
                    ...issue,
                    student_name: author.full_name || 'Student',
                    student_email: author.email || '',
                    audit_logs: logs
                });
            }

            // List based on role
            let list = [];
            if (user.role === 'ADMIN') {
                list = db.issues.map(i => {
                    const author = db.users.find(u => u.id === i.user_id) || {};
                    return { ...i, student_name: author.full_name || 'Student', student_email: author.email || '' };
                });
            } else {
                list = db.issues.filter(i => i.user_id === user.id).map(i => {
                    const author = db.users.find(u => u.id === i.user_id) || {};
                    return { ...i, student_name: author.full_name || 'Student', student_email: author.email || '' };
                });
            }

            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return sendJson(res, 200, list);
        }

        // POST: Create Issue or PHP fallback status update
        if (req.method === 'POST') {
            const body = await parseJsonBody(req);

            // Status update fallback
            if (query.action === 'status' || body.status_update) {
                if (user.role !== 'ADMIN') {
                    return sendJson(res, 403, { error: 'Admin access required' });
                }
                const issueId = parseInt(body.issue_id, 10);
                const newStatus = (body.status || '').toUpperCase();
                const remarks = body.remarks || 'Updated via PHP service fallback';

                const issue = db.issues.find(i => i.id === issueId);
                if (!issue) return sendJson(res, 404, { error: 'Issue not found' });

                const oldStatus = issue.status;
                issue.status = newStatus;
                issue.updated_at = new Date().toISOString();

                db.audit_logs.push({
                    id: db.audit_logs.length + 1,
                    issue_id: issueId,
                    actor_user_id: user.id,
                    old_status: oldStatus,
                    new_status: newStatus,
                    remarks,
                    created_at: new Date().toISOString()
                });
                saveDatabase(db);

                return sendJson(res, 200, { message: 'Status updated successfully', old_status: oldStatus, new_status: newStatus });
            }

            // New Issue Creation
            const title = (body.title || '').trim();
            const category = (body.category || '').trim();
            const description = (body.description || '').trim();
            const location = (body.location || '').trim();
            const priority = (body.priority || 'MEDIUM').toUpperCase();

            if (!title || !category || !description || !location) {
                return sendJson(res, 422, { error: 'All fields are required' });
            }
            if (!['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
                return sendJson(res, 422, { error: 'Invalid priority' });
            }

            const newIssue = {
                id: db.issues.length + 1,
                user_id: user.id,
                title,
                category,
                description,
                location,
                priority,
                status: 'SUBMITTED',
                attachment_path: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            db.issues.push(newIssue);

            // Insert initial submission log in audit_logs
            db.audit_logs.push({
                id: db.audit_logs.length + 1,
                issue_id: newIssue.id,
                actor_user_id: user.id,
                old_status: null,
                new_status: 'SUBMITTED',
                remarks: 'Issue submitted by student',
                created_at: new Date().toISOString()
            });

            saveDatabase(db);
            return sendJson(res, 201, { message: 'Request submitted successfully.', issue: newIssue });
        }

        // DELETE: Delete own SUBMITTED request
        if (req.method === 'DELETE') {
            const issueId = parseInt(query.id, 10);
            const issue = db.issues.find(i => i.id === issueId);
            if (!issue) return sendJson(res, 404, { error: 'Issue not found' });

            if (user.role !== 'ADMIN') {
                if (issue.user_id !== user.id) return sendJson(res, 403, { error: 'Forbidden' });
                if (issue.status !== 'SUBMITTED') {
                    return sendJson(res, 422, { error: 'Cannot delete an issue that is already ' + issue.status });
                }
            }

            db.issues = db.issues.filter(i => i.id !== issueId);
            db.audit_logs = db.audit_logs.filter(a => a.issue_id !== issueId);
            saveDatabase(db);

            return sendJson(res, 200, { message: 'Issue deleted successfully' });
        }
    }

    sendJson(res, 404, { error: 'Endpoint not found on PHP API' });
}

// ------------------------------------------------------------------------------
// SERVICE 2: Java Servlet API Handler (Port 8080)
// Endpoints: /hostel-java/api/maintenance/status, /hostel-java/api/maintenance/audit
// ------------------------------------------------------------------------------
async function handleJavaApi(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const parsed = new URL(req.url, 'http://localhost');
    const pathname = parsed.pathname;
    const query = Object.fromEntries(parsed.searchParams.entries());

    const authResult = verifyToken(req.headers['authorization']);
    if (authResult.error) {
        return sendJson(res, authResult.code, { error: authResult.error });
    }
    const admin = authResult.user;

    // Check ADMIN role (Chapter 4.2 & Table 6.1 Test Case 10)
    if (admin.role !== 'ADMIN') {
        return sendJson(res, 403, { error: 'Admin access required' });
    }

    // 1. Status Update Servlet (/status)
    if (pathname.endsWith('/status')) {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        const body = await parseJsonBody(req);
        const issueId = parseInt(body.issue_id, 10);
        const newStatus = (body.status || '').toUpperCase();
        const remarks = body.remarks || 'Updated by hostel administrator';

        if (!issueId || !['SUBMITTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(newStatus)) {
            return sendJson(res, 422, { error: 'Invalid issue id or status' });
        }

        // Transaction simulation (lock row, update, insert audit log)
        const issue = db.issues.find(i => i.id === issueId);
        if (!issue) {
            return sendJson(res, 404, { error: 'Issue not found' });
        }

        const oldStatus = issue.status;
        issue.status = newStatus;
        issue.updated_at = new Date().toISOString();

        db.audit_logs.push({
            id: db.audit_logs.length + 1,
            issue_id: issueId,
            actor_user_id: admin.id,
            old_status: oldStatus,
            new_status: newStatus,
            remarks,
            created_at: new Date().toISOString()
        });

        saveDatabase(db);

        return sendJson(res, 200, {
            message: 'Status updated successfully',
            issue_id: issueId,
            old_status: oldStatus,
            new_status: newStatus
        });
    }

    // 2. Audit History Servlet (/audit)
    if (pathname.endsWith('/audit')) {
        const issueIdParam = query.issue_id;
        if (!issueIdParam) {
            return sendJson(res, 400, { error: 'issue_id is required' });
        }
        const issueId = parseInt(issueIdParam, 10);
        const logs = db.audit_logs
            .filter(a => a.issue_id === issueId)
            .map(a => {
                const actor = db.users.find(u => u.id === a.actor_user_id) || {};
                return {
                    id: a.id,
                    issue_id: a.issue_id,
                    actor_user_id: a.actor_user_id,
                    old_status: a.old_status,
                    new_status: a.new_status,
                    remarks: a.remarks,
                    created_at: a.created_at,
                    actor_name: actor.full_name || 'Prof. S. Rao (Chief Warden)',
                    actor_role: actor.role || 'ADMIN'
                };
            });

        logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return sendJson(res, 200, logs);
    }

    sendJson(res, 404, { error: 'Endpoint not found on Java Maintenance Service' });
}

// ------------------------------------------------------------------------------
// FRONTEND STATIC SERVER (Port 5500)
// ------------------------------------------------------------------------------
function handleFrontend(req, res) {
    let filePath = path.join(__dirname, 'frontend', req.url.split('?')[0]);
    if (filePath.endsWith(path.sep) || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // If asking for root or index
                fs.readFile(path.join(__dirname, 'frontend', 'index.html'), (err2, fallbackContent) => {
                    if (err2) {
                        res.writeHead(404);
                        res.end('Not Found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(fallbackContent, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

// ------------------------------------------------------------------------------
// Start All Three Servers
// ------------------------------------------------------------------------------
const phpServer = http.createServer(handlePhpApi);
phpServer.listen(8000, () => {
    console.log('[PHP Service] Running at http://localhost:8000 (auth.php, issues.php)');
});

const javaServer = http.createServer(handleJavaApi);
javaServer.listen(8080, () => {
    console.log('[Java Service] Running at http://localhost:8080/hostel-java/api/maintenance (status, audit)');
});

const frontendServer = http.createServer(handleFrontend);
frontendServer.listen(5500, () => {
    console.log('================================================================');
    console.log(' HostelCare Maintenance Portal is LIVE!');
    console.log(' Frontend Application: http://localhost:5500');
    console.log(' PHP Service:          http://localhost:8000');
    console.log(' Java Service:         http://localhost:8080');
    console.log('================================================================');
});
