<?php
// ==============================================================================
// HostelCare - Configuration Settings
// ==============================================================================

define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '5432');
define('DB_NAME', getenv('DB_NAME') ?: 'hostel_portal');
define('DB_USER', getenv('DB_USER') ?: 'postgres');
define('DB_PASS', getenv('DB_PASS') ?: 'postgres');

// Shared HS256 secret key between PHP service and Java Servlet service
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'hostelcare_super_secret_jwt_key_2026_hs256_kpriet_lab');

