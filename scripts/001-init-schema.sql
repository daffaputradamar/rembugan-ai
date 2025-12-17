-- RembuganAI Database Schema
-- Run this script to initialize the database

-- Create enums
CREATE TYPE user_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE template_visibility AS ENUM ('public', 'division', 'department', 'custom');
CREATE TYPE template_type AS ENUM ('mom', 'urd', 'analysis_design', 'test_scenario', 'custom');

-- Users table (synced from portal API)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY,
  npk VARCHAR(50),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  status user_status NOT NULL DEFAULT 'PENDING',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_npk ON users(npk);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type template_type NOT NULL DEFAULT 'custom',
  markdown TEXT NOT NULL,
  raw_text TEXT,
  file_name VARCHAR(255),
  visibility template_visibility NOT NULL DEFAULT 'public',
  division_id INTEGER,
  department_id INTEGER,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_visibility ON templates(visibility);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_division_id ON templates(division_id);
CREATE INDEX IF NOT EXISTS idx_templates_department_id ON templates(department_id);

-- Template users junction table (for custom visibility)
CREATE TABLE IF NOT EXISTS template_users (
  id SERIAL PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_template_users_template_id ON template_users(template_id);
CREATE INDEX IF NOT EXISTS idx_template_users_user_id ON template_users(user_id);

-- Add unique constraint to prevent duplicate user-template assignments
ALTER TABLE template_users ADD CONSTRAINT unique_template_user UNIQUE (template_id, user_id);
