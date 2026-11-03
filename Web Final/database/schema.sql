-- ==============================================================================
-- HostelCare - Hostel Maintenance Portal
-- Database Schema: hostel_portal (PostgreSQL 14+)
-- ==============================================================================

-- Drop tables if they already exist (cascade to clean foreign keys)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS maintenance_issues CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ------------------------------------------------------------------------------
-- Table 3.1: users
-- Stores user accounts, authentication hashes, and roles (STUDENT or ADMIN)
-- ------------------------------------------------------------------------------
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'ADMIN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 3.2: maintenance_issues
-- Stores maintenance problem reports submitted by students
-- ------------------------------------------------------------------------------
CREATE TABLE maintenance_issues (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(120) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
    attachment_path TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 3.3: audit_logs
-- Records status transitions, actor, timestamp, and administrator remarks
-- ------------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    issue_id BIGINT NOT NULL REFERENCES maintenance_issues(id) ON DELETE CASCADE,
    actor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    remarks TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 3.4: Indexes for performance
-- ------------------------------------------------------------------------------
CREATE INDEX idx_issues_user ON maintenance_issues(user_id);
CREATE INDEX idx_issues_status ON maintenance_issues(status);
CREATE INDEX idx_audit_issue ON audit_logs(issue_id);

-- ------------------------------------------------------------------------------
-- Seed Initial Demo Data (Matches Report Screenshots Figures 6.1 - 6.8)
-- Default passwords: 'password123' (hash generated via password_hash('password123', PASSWORD_BCRYPT))
-- ------------------------------------------------------------------------------

-- Insert Demo Users
-- 1: Rahul Sharma (Student)
-- 2: Demo Student (Student)
-- 3: Prof. S. Rao (Chief Warden - Admin)
-- 4: Test Student (Student)
INSERT INTO users (id, full_name, email, password_hash, role, created_at) VALUES
(1, 'Rahul Sharma', 'student@hostel.edu', '$2y$10$e7K4yA4mO9hV1n2Z0x/Uquv8jEw1pP3k1g6F8rL2a0T6mD2u1K0eO', 'STUDENT', '2026-10-30 09:00:00+00'),
(2, 'Demo Student', 'student_demo@gmail.com', '$2y$10$e7K4yA4mO9hV1n2Z0x/Uquv8jEw1pP3k1g6F8rL2a0T6mD2u1K0eO', 'STUDENT', '2026-11-01 10:00:00+00'),
(3, 'Prof. S. Rao (Chief Warden)', 'admin@hostel.edu', '$2y$10$e7K4yA4mO9hV1n2Z0x/Uquv8jEw1pP3k1g6F8rL2a0T6mD2u1K0eO', 'ADMIN', '2026-10-25 08:00:00+00'),
(4, 'Test Student', 'test.student@hostel.edu', '$2y$10$e7K4yA4mO9hV1n2Z0x/Uquv8jEw1pP3k1g6F8rL2a0T6mD2u1K0eO', 'STUDENT', '2026-10-28 11:30:00+00');

SELECT setval('users_id_seq', 4, true);

-- Insert Demo Issues (Reflecting Fig 6.4, 6.7, 6.8)
INSERT INTO maintenance_issues (id, user_id, title, category, description, location, priority, status, created_at, updated_at) VALUES
(1, 1, 'Wi-Fi router dead / no signal on floor', 'Internet', 'Corridor Wi-Fi access point LED is solid red and not transmitting SSID since yesterday morning.', 'Block C - 2nd Floor Corridor', 'HIGH', 'IN_PROGRESS', '2026-10-31 09:15:00+00', '2026-10-31 11:30:00+00'),
(2, 1, 'Study chair backrest broken', 'Furniture', 'Left bolt has sheared off the backrest bracket, chair is unstable to sit on.', 'Block B - Room 215', 'LOW', 'SUBMITTED', '2026-10-31 10:45:00+00', '2026-10-31 10:45:00+00'),
(3, 1, 'Ceiling fan regulator broken & vibrating', 'Electrical', 'Regulator switch knob came off and sparks when adjusted.', 'Block B - Room 204', 'MEDIUM', 'RESOLVED', '2026-10-31 14:00:00+00', '2026-11-01 16:30:00+00'),
(4, 1, 'Water leakage under washbasin', 'Plumbing', 'Water pressure caused the shower pipe valve to crack, causing continuous water flow on the bathroom floor.', 'Block A - Room 104', 'HIGH', 'IN_PROGRESS', '2026-10-31 16:20:00+00', '2026-11-01 09:00:00+00'),
(5, 2, 'Ceiling fan making strange noise', 'Electrical', 'The fan in room 302 vibrates heavily and emits a burnt smell when turned on.', 'Block C - Room 302', 'HIGH', 'RESOLVED', '2026-11-02 22:15:00+00', '2026-11-02 22:47:00+00'),
(6, 4, 'Water leakage in bathroom', 'Plumbing', 'Bathroom tap valve leaking continuously, water overflowing onto door sill.', 'Block A - Room 101', 'HIGH', 'RESOLVED', '2026-11-01 08:30:00+00', '2026-11-01 17:15:00+00');

SELECT setval('maintenance_issues_id_seq', 6, true);

-- Insert Demo Audit Logs (Reflecting Table 4.2 and Fig 6.8)
INSERT INTO audit_logs (id, issue_id, actor_user_id, old_status, new_status, remarks, created_at) VALUES
(1, 1, 3, 'SUBMITTED', 'IN_PROGRESS', 'Network team technician assigned to test cable connectivity and PoE switch port.', '2026-10-31 11:30:00+00'),
(2, 3, 3, 'SUBMITTED', 'IN_PROGRESS', 'Electrician sent with replacement stepped regulator module.', '2026-10-31 15:00:00+00'),
(3, 3, 3, 'IN_PROGRESS', 'RESOLVED', 'Replaced modular rotary regulator switch and verified speeds 1-5.', '2026-11-01 16:30:00+00'),
(4, 4, 3, 'SUBMITTED', 'IN_PROGRESS', 'Plumber notified to inspect washbasin drainage pipe and replace teflon seal.', '2026-11-01 09:00:00+00'),
(5, 5, 3, 'SUBMITTED', 'IN_PROGRESS', 'Electrician Ramesh assigned to inspect the motor', '2026-11-02 22:22:00+00'),
(6, 5, 3, 'IN_PROGRESS', 'RESOLVED', 'Replaced capacitor and tightened fan mounting bracket. Verified working.', '2026-11-02 22:47:00+00'),
(7, 6, 3, 'SUBMITTED', 'IN_PROGRESS', 'Plumbing contractor team assigned to inspect main valve.', '2026-11-01 10:00:00+00'),
(8, 6, 3, 'IN_PROGRESS', 'RESOLVED', 'Technician Ramesh replaced the leaking pipe valve and washer. Tested under full pressure and verified operational.', '2026-11-01 17:15:00+00');

SELECT setval('audit_logs_id_seq', 8, true);

