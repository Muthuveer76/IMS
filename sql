-- ============================================================
-- IMS - Internship Management System
-- Supabase PostgreSQL Schema  (safe to re-run)
-- ============================================================

-- ============================================================
-- STEP 1 — Create Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('student', 'mentor', 'hod', 'tpo', 'coordinator', 'company')),
    mentor_email TEXT DEFAULT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    email             TEXT DEFAULT '',
    state_current     TEXT NOT NULL DEFAULT 'Pending'
                          CHECK (state_current IN ('Pending', 'Verified', 'Rejected')),
    state_history     JSONB DEFAULT '[]',
    doc_url           TEXT DEFAULT '',
    submitted_by_role TEXT DEFAULT 'student',
    submitted_by      TEXT,
    website           TEXT DEFAULT '',
    linkedin          TEXT DEFAULT '',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS internships (
    id           TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    title        TEXT NOT NULL,
    location     TEXT DEFAULT '',
    stipend      TEXT DEFAULT '',
    job_type     TEXT DEFAULT '',
    description  TEXT DEFAULT '',
    apply_link   TEXT DEFAULT '',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
    id            TEXT PRIMARY KEY,
    student_id    TEXT NOT NULL,
    student_name  TEXT NOT NULL,
    company_name  TEXT NOT NULL,
    duration      TEXT DEFAULT '',
    state_current TEXT NOT NULL DEFAULT 'Pending Mentor'
                      CHECK (state_current IN (
                          'Pending Mentor', 'Pending HOD',
                          'Pending TPO', 'OD Granted', 'Rejected'
                      )),
    state_history JSONB DEFAULT '[]',
    doc_name      TEXT DEFAULT '',
    doc_data      TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    msg         TEXT NOT NULL,
    type        TEXT DEFAULT 'info'
                    CHECK (type IN ('info', 'success', 'danger', 'warning')),
    target_role TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 2 — Enable Row Level Security
-- ============================================================

ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE internships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3 — RLS Policies (drop first to avoid duplicates)
-- ============================================================

-- companies
DROP POLICY IF EXISTS "Allow public read"    ON companies;
DROP POLICY IF EXISTS "Allow all mutations"  ON companies;
CREATE POLICY "Allow public read"   ON companies FOR SELECT USING (true);
CREATE POLICY "Allow all mutations" ON companies FOR ALL    USING (true) WITH CHECK (true);

-- internships
DROP POLICY IF EXISTS "Allow public read"    ON internships;
DROP POLICY IF EXISTS "Allow all mutations"  ON internships;
CREATE POLICY "Allow public read"   ON internships FOR SELECT USING (true);
CREATE POLICY "Allow all mutations" ON internships FOR ALL    USING (true) WITH CHECK (true);

-- applications
DROP POLICY IF EXISTS "Allow public read"    ON applications;
DROP POLICY IF EXISTS "Allow all mutations"  ON applications;
CREATE POLICY "Allow public read"   ON applications FOR SELECT USING (true);
CREATE POLICY "Allow all mutations" ON applications FOR ALL    USING (true) WITH CHECK (true);

-- notifications
DROP POLICY IF EXISTS "Allow public read"    ON notifications;
DROP POLICY IF EXISTS "Allow all mutations"  ON notifications;
CREATE POLICY "Allow public read"   ON notifications FOR SELECT USING (true);
CREATE POLICY "Allow all mutations" ON notifications FOR ALL    USING (true) WITH CHECK (true);

-- users
DROP POLICY IF EXISTS "Allow public read"    ON users;
DROP POLICY IF EXISTS "Allow all mutations"  ON users;
CREATE POLICY "Allow public read"   ON users FOR SELECT USING (true);
CREATE POLICY "Allow all mutations" ON users FOR ALL    USING (true) WITH CHECK (true);

-- ============================================================
-- STEP 4 — Seed Data  (mirrors app.js defaults, safe re-run)
-- ============================================================

INSERT INTO companies (id, name, email, state_current, state_history,
                       doc_url, submitted_by_role, website, linkedin, submitted_by)
VALUES (
    'C01', 'NVIDIA', 'careers@nvidia.com', 'Verified', '[]',
    'NVIDIA_PROFILE.pdf', 'tpo',
    'https://www.nvidia.com',
    'https://www.linkedin.com/company/nvidia',
    NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO internships (id, company_name, title, location, stipend,
                         job_type, description, apply_link)
VALUES (
    'INT-01', 'NVIDIA', 'Deep Learning Intern', 'Remote', '$2000/mo',
    'Full-time', 'Working on CUDA kernel optimizations.',
    'https://nvidia.com/careers'
)
ON CONFLICT (id) DO NOTHING;
