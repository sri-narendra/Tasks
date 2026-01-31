/**
 * Google Tasks Clone - Complete Database Schema
 * Run this in Supabase SQL Editor to set up the database from scratch.
 * 
 * Includes tables: boards, lists, tasks
 */

-- 1. Create Boards Table
create table if not exists boards (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  background text, -- Color hex, DataURL, or Image URL
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Lists Table
create table if not exists lists (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  position integer default 0,
  board_id uuid references boards(id) on delete cascade,
  color text, -- Header color
  task_color text, -- Default color for tasks in this list
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Tasks Table
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  completed boolean default false,
  description text,
  due_date timestamp with time zone,
  recurrence text, -- recurrence string (e.g., 'daily', 'weekly:1,3,5')
  is_starred boolean default false,
  position integer default 0,
  list_id uuid references lists(id) on delete cascade,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Indexes for Performance
create index if not exists idx_lists_board on lists(board_id);
create index if not exists idx_tasks_list on tasks(list_id);
create index if not exists idx_tasks_list_position on tasks(list_id, position);

-- --- UPGRADE SCRIPTS (Run if you have existing tables) ---
-- ALTER TABLE boards ADD COLUMN IF NOT EXISTS background TEXT;
-- ALTER TABLE lists ADD COLUMN IF NOT EXISTS task_color TEXT;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT;
