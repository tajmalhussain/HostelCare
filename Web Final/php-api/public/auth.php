<?php
// ==============================================================================
// HostelCare - Authentication Endpoints (Registration & Login)
// ==============================================================================

require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../config/db.php';

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

if (empty($action) && isset($input['action'])) {
    $action = $input['action'];
}

// ------------------------------------------------------------------------------
// Action: REGISTER
// ------------------------------------------------------------------------------
if ($action === 'register') {
    $fullName = trim($input['name'] ?? $input['full_name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    // Validation matching Table 6.1 Test Case 2
    if ($fullName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
        respond(['error' => 'Enter a name, valid email and password (minimum 6 characters).'], 422);
    }

    try {
        $pdo = db();
        // Check for duplicate email (Table 6.1 Test Case 3)
        $checkStmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)');
        $checkStmt->execute([$email]);
        if ($checkStmt->fetch()) {
            respond(['error' => 'Email already registered'], 409);
        }

        // Hash password securely (Chapter 4.1)
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id, full_name, email, role');
        $stmt->execute([$fullName, $email, $passwordHash, 'STUDENT']);
        $user = $stmt->fetch();

        $token = make_token($user);

        respond([
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'full_name' => $user['full_name'],
                'email' => $user['email'],
                'role' => $user['role']
            ],
            'message' => 'Registration successful'
        ], 201);
    } catch (PDOException $e) {
        respond(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// ------------------------------------------------------------------------------
// Action: LOGIN
// ------------------------------------------------------------------------------
if ($action === 'login') {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    if ($email === '' || $password === '') {
        respond(['error' => 'Invalid email or password'], 401);
    }

    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id, full_name, email, password_hash, role FROM users WHERE LOWER(email) = LOWER(?)');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        // Password verification (Table 6.1 Test Case 4)
        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(['error' => 'Invalid email or password'], 401);
        }

        $token = make_token($user);

        respond([
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'full_name' => $user['full_name'],
                'email' => $user['email'],
                'role' => $user['role']
            ],
            'message' => 'Login successful'
        ]);
    } catch (PDOException $e) {
        respond(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// ------------------------------------------------------------------------------
// Action: ME (Profile verification)
// ------------------------------------------------------------------------------
if ($action === 'me') {
    $userToken = require_auth();
    try {
        $stmt = db()->prepare('SELECT id, full_name, email, role FROM users WHERE id = ?');
        $stmt->execute([$userToken['id']]);
        $user = $stmt->fetch();
        if (!$user) {
            respond(['error' => 'User not found'], 404);
        }
        respond(['user' => $user]);
    } catch (PDOException $e) {
        respond(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

respond(['error' => 'Invalid action specified. Supported actions: login, register, me'], 400);

