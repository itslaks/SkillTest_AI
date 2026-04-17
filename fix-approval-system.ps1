# Fix Quiz Approval System - PowerShell Script
# This script provides the SQL commands to fix the employee quiz access issue

Write-Host "🔧 SkillTest AI - Approval System Fix" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Issue: Employees see 'no approved questions' error when trying to take quizzes" -ForegroundColor Yellow
Write-Host ""

Write-Host "🎯 Solution: Remove the approval system from the database" -ForegroundColor Green
Write-Host ""

Write-Host "📝 Steps to fix:" -ForegroundColor White
Write-Host "  1. Go to your Supabase Dashboard" -ForegroundColor Gray
Write-Host "  2. Navigate to: SQL Editor" -ForegroundColor Gray  
Write-Host "  3. Copy and paste the SQL below" -ForegroundColor Gray
Write-Host "  4. Click 'Run' to execute" -ForegroundColor Gray
Write-Host ""

Write-Host "💾 SQL Fix Script:" -ForegroundColor Magenta
Write-Host "==================" -ForegroundColor Magenta

$sqlFix = @"
-- SkillTest AI: Remove Question Approval System
-- This fixes the employee quiz access issue

-- Step 1: Drop old policies that filter by approval
DROP POLICY IF EXISTS "Users can view approved questions" ON public.questions;
DROP POLICY IF EXISTS "Users can view questions" ON public.questions;
DROP POLICY IF EXISTS "Employees can view approved questions" ON public.questions;

-- Step 2: Drop approval-related indexes
DROP INDEX IF EXISTS idx_questions_is_approved;
DROP INDEX IF EXISTS idx_questions_status;

-- Step 3: Remove approval columns from questions table
ALTER TABLE public.questions 
DROP COLUMN IF EXISTS is_approved CASCADE,
DROP COLUMN IF EXISTS status CASCADE;

-- Step 4: Create new policy that allows all questions for active quizzes
DROP POLICY IF EXISTS "Users can view questions for active quizzes" ON public.questions;
CREATE POLICY "Users can view questions for active quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND q.is_active = true
    )
  );

-- Success message
SELECT 'Approval system removed! Employees can now take quizzes.' AS result;
"@

Write-Host $sqlFix -ForegroundColor Yellow

Write-Host ""
Write-Host "📋 Copy the SQL above and run it in Supabase SQL Editor" -ForegroundColor White
Write-Host ""

# Optionally copy to clipboard if possible
try {
    $sqlFix | Set-Clipboard
    Write-Host "📄 SQL has been copied to your clipboard!" -ForegroundColor Green
} catch {
    Write-Host "📄 Please manually copy the SQL above" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 After running the SQL:" -ForegroundColor Green
Write-Host "  ✅ Employees will see all questions for active quizzes" -ForegroundColor Green
Write-Host "  ✅ No more approval workflow needed" -ForegroundColor Green  
Write-Host "  ✅ AI-generated questions work immediately" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Test the fix:" -ForegroundColor Cyan
Write-Host "  1. Create or assign a quiz to an employee" -ForegroundColor Gray
Write-Host "  2. Employee logs in and navigates to quizzes" -ForegroundColor Gray
Write-Host "  3. Employee should now be able to take the quiz!" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"
