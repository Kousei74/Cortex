-- 00_infrastructure.sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Departments
DROP TABLE IF EXISTS departments CASCADE;
CREATE TABLE IF NOT EXISTS departments (
    dept_id TEXT PRIMARY KEY,
    dept_name TEXT UNIQUE NOT NULL
);

ALTER TABLE departments DISABLE ROW LEVEL SECURITY;


-- Seeding Departments handled in 06_seed_data.sql

