<?php
// ==============================================================================
// HostelCare - Issue Management API
// ==============================================================================

require_once __DIR__ . '/../config/http.php';
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$user = require_auth(); // Requires valid JWT token

// ------------------------------------------------------------------------------
// GET: List Issues (or single issue with audit trail)
// ------------------------------------------------------------------------------
if ($method === 'GET') {
    $issueId = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $pdo = db();

    // If specific issue details requested
    if ($issueId) {
        $stmt = $pdo->prepare('SELECT i.*, u.full_name AS student_name, u.email AS student_email 
                               FROM maintenance_issues i 
                               JOIN users u ON i.user_id = u.id 
                               WHERE i.id = ?');
        $stmt->execute([$issueId]);
        $issue = $stmt->fetch();

        if (!$issue) {
            respond(['error' => 'Issue not found'], 404);
        }

        // Check permission: student can only view their own issue unless ADMIN
        if ($user['role'] !== 'ADMIN' && (int)$issue['user_id'] !== $user['id']) {
            respond(['error' => 'Forbidden'], 403);
        }

        // Fetch audit logs
        $auditStmt = $pdo->prepare('SELECT a.*, u.full_name AS actor_name, u.role AS actor_role 
                                   FROM audit_logs a 
                                   JOIN users u ON a.actor_user_id = u.id 
                                   WHERE a.issue_id = ? 
                                   ORDER BY a.created_at ASC');
        $auditStmt->execute([$issueId]);
        $issue['audit_logs'] = $auditStmt->fetchAll();

        respond($issue);
    }

    // Role-based issue listing (Chapter 4.3)
    if ($user['role'] === 'ADMIN') {
        $stmt = $pdo->prepare('SELECT i.*, u.full_name AS student_name, u.email AS student_email 
                               FROM maintenance_issues i 
                               JOIN users u ON i.user_id = u.id 
                               ORDER BY i.created_at DESC');
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare('SELECT i.*, u.full_name AS student_name, u.email AS student_email 
                               FROM maintenance_issues i 
                               JOIN users u ON i.user_id = u.id 
                               WHERE i.user_id = ? 
                               ORDER BY i.created_at DESC');
        $stmt->execute([$user['id']]);
    }

    $issues = $stmt->fetchAll();
    respond($issues);
}

// ------------------------------------------------------------------------------
// POST: Submit a new maintenance issue (or PHP fallback status update)
// ------------------------------------------------------------------------------
if ($method === 'POST') {
    $action = $_GET['action'] ?? '';

    // Handle JSON or Form-Data
    $input = [];
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($contentType, 'application/json')) {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
    } else {
        $input = $_POST;
    }

    // Status update fallback (if called via PHP API)
    if ($action === 'status' || isset($input['status_update'])) {
        require_admin();
        $issueId = (int)($input['issue_id'] ?? 0);
        $newStatus = trim($input['status'] ?? '');
        $remarks = trim($input['remarks'] ?? 'Updated via PHP maintenance service');

        if ($issueId <= 0 || !in_array($newStatus, ['IN_PROGRESS', 'RESOLVED', 'REJECTED', 'SUBMITTED'], true)) {
            respond(['error' => 'Invalid issue id or status'], 422);
        }

        $pdo = db();
        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare('SELECT status FROM maintenance_issues WHERE id = ? FOR UPDATE');
            $stmt->execute([$issueId]);
            $current = $stmt->fetch();

            if (!$current) {
                $pdo->rollBack();
                respond(['error' => 'Issue not found'], 404);
            }

            $oldStatus = $current['status'];

            $updStmt = $pdo->prepare('UPDATE maintenance_issues SET status = ?, updated_at = NOW() WHERE id = ?');
            $updStmt->execute([$newStatus, $issueId]);

            $auditStmt = $pdo->prepare('INSERT INTO audit_logs (issue_id, actor_user_id, old_status, new_status, remarks) VALUES (?, ?, ?, ?, ?)');
            $auditStmt->execute([$issueId, $user['id'], $oldStatus, $newStatus, $remarks]);

            $pdo->commit();
            respond(['message' => 'Status updated successfully', 'old_status' => $oldStatus, 'new_status' => $newStatus]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            respond(['error' => 'Transaction failed: ' . $e->getMessage()], 500);
        }
    }

    // New Request Submission
    $title = trim($input['title'] ?? '');
    $category = trim($input['category'] ?? '');
    $description = trim($input['description'] ?? '');
    $location = trim($input['location'] ?? '');
    $priority = strtoupper(trim($input['priority'] ?? 'MEDIUM'));

    // Validation (Chapter 4.3 & Table 6.1 Test Case 5)
    if ($title === '' || $category === '' || $description === '' || $location === '') {
        respond(['error' => 'All fields are required'], 422);
    }

    if (!in_array($priority, ['LOW', 'MEDIUM', 'HIGH'], true)) {
        respond(['error' => 'Invalid priority'], 422);
    }

    // Handle File Attachment (Optional)
    $attachmentPath = null;
    if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['attachment'];
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if (!in_array($ext, $allowedExtensions, true)) {
            respond(['error' => 'Invalid file format. Allowed: JPG, PNG, GIF, WEBP, PDF'], 422);
        }

        if ($file['size'] > 10 * 1024 * 1024) { // 10MB limit
            respond(['error' => 'File size exceeds maximum limit of 10MB'], 422);
        }

        $uploadsDir = __DIR__ . '/../../uploads';
        if (!is_dir($uploadsDir)) {
            mkdir($uploadsDir, 0777, true);
        }

        $filename = uniqid('attach_', true) . '.' . $ext;
        $destPath = $uploadsDir . '/' . $filename;
        if (move_uploaded_file($file['tmp_name'], $destPath)) {
            $attachmentPath = 'uploads/' . $filename;
        }
    }

    $pdo = db();
    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('INSERT INTO maintenance_issues (user_id, title, category, description, location, priority, status, attachment_path) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *');
        $stmt->execute([$user['id'], $title, $category, $description, $location, $priority, 'SUBMITTED', $attachmentPath]);
        $newIssue = $stmt->fetch();

        // Record initial submission entry in audit_logs
        $auditStmt = $pdo->prepare('INSERT INTO audit_logs (issue_id, actor_user_id, old_status, new_status, remarks) VALUES (?, ?, NULL, ?, ?)');
        $auditStmt->execute([$newIssue['id'], $user['id'], 'SUBMITTED', 'Issue submitted by student']);

        $pdo->commit();

        respond([
            'message' => 'Request submitted successfully.',
            'issue' => $newIssue
        ], 201);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        respond(['error' => 'Failed to save request: ' . $e->getMessage()], 500);
    }
}

// ------------------------------------------------------------------------------
// DELETE: Remove a student's own SUBMITTED request
// ------------------------------------------------------------------------------
if ($method === 'DELETE') {
    $issueId = (int)($_GET['id'] ?? 0);
    if ($issueId <= 0) {
        respond(['error' => 'Invalid issue id'], 400);
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM maintenance_issues WHERE id = ?');
    $stmt->execute([$issueId]);
    $issue = $stmt->fetch();

    if (!$issue) {
        respond(['error' => 'Issue not found'], 404);
    }

    // Role check: non-admin can only delete their own SUBMITTED request
    if ($user['role'] !== 'ADMIN') {
        if ((int)$issue['user_id'] !== $user['id']) {
            respond(['error' => 'Forbidden'], 403);
        }
        if ($issue['status'] !== 'SUBMITTED') {
            respond(['error' => 'Cannot delete an issue that is already ' . $issue['status']], 422);
        }
    }

    $delStmt = $pdo->prepare('DELETE FROM maintenance_issues WHERE id = ?');
    $delStmt->execute([$issueId]);

    respond(['message' => 'Issue deleted successfully']);
}

respond(['error' => 'Method not allowed'], 405);

