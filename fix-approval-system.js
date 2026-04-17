#!/usr/bin/env node

/**
 * Fix Approval System - Remove Question Approval from Database
 * 
 * This script removes the approval system from the questions table
 * and updates RLS policies to allow employees to see all questions
 * for active quizzes.
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Your Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixApprovalSystem() {
  console.log('🔧 Starting approval system removal...\n')

  try {
    // Step 1: Drop old policies that reference approval columns
    console.log('📝 Step 1: Dropping old RLS policies...')
    
    const oldPolicies = [
      'Users can view approved questions',
      'Users can view questions',
      'Employees can view approved questions'
    ]
    
    for (const policy of oldPolicies) {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `DROP POLICY IF EXISTS "${policy}" ON public.questions;`
      })
      if (error) {
        console.log(`  ⚠️  Warning dropping policy "${policy}": ${error.message}`)
      } else {
        console.log(`  ✅ Dropped policy: ${policy}`)
      }
    }

    // Step 2: Drop indexes
    console.log('\n📝 Step 2: Dropping indexes...')
    const indexes = ['idx_questions_is_approved', 'idx_questions_status']
    
    for (const index of indexes) {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `DROP INDEX IF EXISTS ${index};`
      })
      if (error) {
        console.log(`  ⚠️  Warning dropping index "${index}": ${error.message}`)
      } else {
        console.log(`  ✅ Dropped index: ${index}`)
      }
    }

    // Step 3: Drop approval columns
    console.log('\n📝 Step 3: Dropping approval columns...')
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE public.questions 
            DROP COLUMN IF EXISTS status CASCADE,
            DROP COLUMN IF EXISTS is_approved CASCADE;`
    })
    
    if (dropError) {
      console.error(`  ❌ Error dropping columns: ${dropError.message}`)
    } else {
      console.log('  ✅ Dropped approval columns')
    }

    // Step 4: Create new simplified policy
    console.log('\n📝 Step 4: Creating new RLS policy...')
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "Users can view questions for active quizzes" ON public.questions
            FOR SELECT USING (
              EXISTS (
                SELECT 1 FROM public.quizzes q 
                WHERE q.id = quiz_id AND q.is_active = true
              )
            );`
    })
    
    if (policyError) {
      console.error(`  ❌ Error creating new policy: ${policyError.message}`)
    } else {
      console.log('  ✅ Created new RLS policy')
    }

    // Step 5: Verify the fix
    console.log('\n🔍 Step 5: Verifying fix...')
    
    // Check that columns are gone
    const { data: columns } = await supabase.rpc('exec_sql', {
      sql: `SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'questions' AND table_schema = 'public'
            AND column_name IN ('is_approved', 'status');`
    })
    
    if (!columns || columns.length === 0) {
      console.log('  ✅ Approval columns successfully removed')
    } else {
      console.log('  ⚠️  Some approval columns may still exist')
    }

    // Check policy exists
    const { data: newPoliciesData } = await supabase.rpc('exec_sql', {
      sql: `SELECT policyname FROM pg_policies 
            WHERE tablename = 'questions' AND schemaname = 'public'
            AND policyname = 'Users can view questions for active quizzes';`
    })
    
    if (newPoliciesData && newPoliciesData.length > 0) {
      console.log('  ✅ New RLS policy is active')
    } else {
      console.log('  ⚠️  New RLS policy may not be active')
    }

    console.log('\n🎉 Approval system removal completed!')
    console.log('\n📋 What this fixed:')
    console.log('  • Removed approval workflow entirely')
    console.log('  • Employees can now see all questions for active quizzes')
    console.log('  • No more "approved questions" filtering')
    console.log('\n✨ Try taking a quiz now - it should work!')

  } catch (error) {
    console.error('\n❌ Error during migration:', error.message)
    console.error('\n🔧 Manual fix required:')
    console.error('1. Go to Supabase Dashboard → SQL Editor')
    console.error('2. Run the contents of scripts/IMMEDIATE_FIX.sql')
    console.error('3. This will remove the approval system manually')
  }
}

// Alternative: Simple SQL execution function
async function executeSqlScript() {
  console.log('🔧 Executing SQL fix directly...\n')
  
  const sqlScript = `
    -- Remove approval system from questions table
    DROP POLICY IF EXISTS "Users can view approved questions" ON public.questions;
    DROP POLICY IF EXISTS "Users can view questions" ON public.questions;
    DROP POLICY IF EXISTS "Employees can view approved questions" ON public.questions;
    
    DROP INDEX IF EXISTS idx_questions_is_approved;
    DROP INDEX IF EXISTS idx_questions_status;
    
    ALTER TABLE public.questions 
    DROP COLUMN IF EXISTS is_approved CASCADE,
    DROP COLUMN IF EXISTS status CASCADE;
    
    DROP POLICY IF EXISTS "Users can view questions for active quizzes" ON public.questions;
    CREATE POLICY "Users can view questions for active quizzes" ON public.questions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.quizzes q 
          WHERE q.id = quiz_id AND q.is_active = true
        )
      );
    
    SELECT 'Approval system removed successfully!' AS result;
  `
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlScript })
    
    if (error) {
      console.error('❌ SQL execution failed:', error.message)
      console.error('\n🔧 Please run scripts/IMMEDIATE_FIX.sql manually in Supabase SQL Editor')
    } else {
      console.log('✅ SQL fix executed successfully!')
      console.log('🎉 Employees should now be able to take quizzes!')
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    console.error('\n🔧 Please run scripts/IMMEDIATE_FIX.sql manually in Supabase SQL Editor')
  }
}

// Check if exec_sql function exists in Supabase (some instances don't have it)
async function checkAndFix() {
  try {
    // Try the safer RPC method first
    await executeSqlScript()
  } catch (error) {
    console.log('\n🔄 RPC method failed, trying alternative approach...')
    // Fallback to step-by-step approach
    await fixApprovalSystem()
  }
}

if (require.main === module) {
  checkAndFix()
}

module.exports = { fixApprovalSystem, executeSqlScript }
