<?php
// ==============================================================================
// HostelCare - HTTP Helpers, CORS & JWT Verification
// ==============================================================================

require_once __DIR__ . '/config.php';

// Enable Cross-Origin Resource Sharing (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function respond(mixed $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function b64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64urldecode(string $data): string|false {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function make_token(array $user): string {
    $header = b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = b64url(json_encode([
        'sub' => (string)$user['id'],
        'name' => $user['full_name'],
        'role' => $user['role'],
        'iat' => time(),
        'exp' => time() + 86400 // 24 hours validity
    ]));
    $sig = b64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function current_user(): ?array {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($authHeader) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }

    if (!preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        return null;
    }

    $token = $matches[1];
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$header64, $payload64, $sig64] = $parts;

    $expectedSig = b64url(hash_hmac('sha256', "$header64.$payload64", JWT_SECRET, true));
    if (!hash_equals($expectedSig, $sig64)) {
        respond(['error' => 'Invalid token signature'], 401);
    }

    $payloadJson = b64urldecode($payload64);
    if (!$payloadJson) {
        respond(['error' => 'Malformed token payload'], 401);
    }

    $payload = json_decode($payloadJson, true);
    if (!$payload || !isset($payload['sub'], $payload['exp'])) {
        respond(['error' => 'Invalid token claims'], 401);
    }

    if ($payload['exp'] < time()) {
        respond(['error' => 'Token has expired'], 401);
    }

    return [
        'id' => (int)$payload['sub'],
        'full_name' => $payload['name'] ?? '',
        'role' => $payload['role'] ?? 'STUDENT'
    ];
}

function require_auth(): array {
    $user = current_user();
    if (!$user) {
        respond(['error' => 'Missing bearer token'], 401);
    }
    return $user;
}

function require_admin(): array {
    $user = require_auth();
    if ($user['role'] !== 'ADMIN') {
        respond(['error' => 'Admin access required'], 403);
    }
    return $user;
}

