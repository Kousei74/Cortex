-- Migration Script for Multi-Team Support
-- Run this in your Supabase SQL Editor

-- 1. Alter the issues table to replace assigned_dept_id with assigned_dept_ids array
ALTER TABLE issues 
  ADD COLUMN IF NOT EXISTS assigned_dept_ids TEXT[] DEFAULT '{}';

-- Optional: If you want to migrate existing single assignments to the array
UPDATE issues 
  SET assigned_dept_ids = ARRAY[assigned_dept_id] 
  WHERE assigned_dept_id IS NOT NULL;

-- 2. Drop the old policies BEFORE dropping the column they depend on
DROP POLICY IF EXISTS "View team or own issues" ON issues;
DROP POLICY IF EXISTS "Update own or team issues" ON issues;

-- 3. Now we can safely drop the old column
ALTER TABLE issues DROP COLUMN IF EXISTS assigned_dept_id;

-- 4. Recreate the policies to use the new array
CREATE POLICY "View team or own issues" ON issues
FOR SELECT
USING (
   created_by_emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id'
   OR 
   dept_id = current_setting('request.jwt.claims', true)::json->>'dept_id'
   OR
   current_setting('request.jwt.claims', true)::json->>'dept_id' = ANY(assigned_dept_ids)
);

CREATE POLICY "Update own or team issues" ON issues
FOR UPDATE
USING (
   created_by_emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id'
   OR 
   dept_id = current_setting('request.jwt.claims', true)::json->>'dept_id'
   OR
   current_setting('request.jwt.claims', true)::json->>'dept_id' = ANY(assigned_dept_ids)
);

