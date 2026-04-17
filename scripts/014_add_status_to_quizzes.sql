-- Add 'status' column to quizzes table for quiz workflow state
ALTER TABLE quizzes
ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active';
