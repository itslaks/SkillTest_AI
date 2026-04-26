import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    // Mock data representing what would come from your database
    const comprehensiveLeaderboardData = [
      {
        rank: 1,
        employee_name: 'John Smith',
        email: 'john.smith@company.com',
        employee_id: 'EMP001',
        department: 'Engineering',
        total_points: 2450,
        total_quizzes_completed: 8,
        average_score: 92,
        total_correct_answers: 156,
        total_questions_attempted: 170,
        total_time_spent: '39m 0s',
        first_quiz_completed: '2024-04-10 10:00:00',
        last_quiz_completed: '2024-04-16 14:20:00',
        fastest_completion_time: '4m 30s',
        slowest_completion_time: '8m 45s',
        quiz_completion_rate: '100%',
        performance_trend: 'Improving',
        total_attempts: 8,
        average_attempts_per_quiz: 1.0
      },
      {
        rank: 2,
        employee_name: 'Sarah Johnson',
        email: 'sarah.johnson@company.com',
        employee_id: 'EMP002',
        department: 'Marketing',
        total_points: 2380,
        total_quizzes_completed: 7,
        average_score: 89,
        total_correct_answers: 142,
        total_questions_attempted: 160,
        total_time_spent: '35m 0s',
        first_quiz_completed: '2024-04-12 11:15:00',
        last_quiz_completed: '2024-04-16 16:30:00',
        fastest_completion_time: '3m 45s',
        slowest_completion_time: '7m 20s',
        quiz_completion_rate: '87.5%',
        performance_trend: 'Stable',
        total_attempts: 8,
        average_attempts_per_quiz: 1.14
      },
      {
        rank: 3,
        employee_name: 'Michael Chen',
        email: 'michael.chen@company.com',
        employee_id: 'EMP003',
        department: 'Sales',
        total_points: 2200,
        total_quizzes_completed: 6,
        average_score: 85,
        total_correct_answers: 128,
        total_questions_attempted: 150,
        total_time_spent: '31m 30s',
        first_quiz_completed: '2024-04-11 09:30:00',
        last_quiz_completed: '2024-04-16 13:45:00',
        fastest_completion_time: '4m 15s',
        slowest_completion_time: '6m 45s',
        quiz_completion_rate: '75%',
        performance_trend: 'Improving',
        total_attempts: 7,
        average_attempts_per_quiz: 1.17
      },
      {
        rank: 4,
        employee_name: 'Emily Davis',
        email: 'emily.davis@company.com',
        employee_id: 'EMP004',
        department: 'HR',
        total_points: 1950,
        total_quizzes_completed: 5,
        average_score: 78,
        total_correct_answers: 98,
        total_questions_attempted: 125,
        total_time_spent: '28m 15s',
        first_quiz_completed: '2024-04-13 14:20:00',
        last_quiz_completed: '2024-04-16 10:30:00',
        fastest_completion_time: '5m 00s',
        slowest_completion_time: '7m 30s',
        quiz_completion_rate: '62.5%',
        performance_trend: 'Stable',
        total_attempts: 6,
        average_attempts_per_quiz: 1.2
      },
      {
        rank: 5,
        employee_name: 'David Wilson',
        email: 'david.wilson@company.com',
        employee_id: 'EMP005',
        department: 'Finance',
        total_points: 1800,
        total_quizzes_completed: 4,
        average_score: 75,
        total_correct_answers: 75,
        total_questions_attempted: 100,
        total_time_spent: '22m 0s',
        first_quiz_completed: '2024-04-14 16:45:00',
        last_quiz_completed: '2024-04-16 12:15:00',
        fastest_completion_time: '4m 45s',
        slowest_completion_time: '6m 30s',
        quiz_completion_rate: '50%',
        performance_trend: 'Needs Improvement',
        total_attempts: 5,
        average_attempts_per_quiz: 1.25
      }
    ]

    // Create detailed quiz completion data
    const detailedCompletions = [
      {
        completion_id: 'C001',
        employee_name: 'John Smith',
        employee_id: 'EMP001',
        department: 'Engineering',
        quiz_title: 'Advanced JavaScript Concepts',
        quiz_topic: 'Programming',
        quiz_difficulty: 'Hard',
        score_percentage: 95,
        correct_answers: 19,
        total_questions: 20,
        time_taken: '4m 30s',
        points_earned: 380,
        completion_date: '2024-04-16',
        completion_time: '14:20:00',
        attempt_number: 1,
        pass_status: 'PASSED'
      },
      {
        completion_id: 'C002',
        employee_name: 'Sarah Johnson',
        employee_id: 'EMP002',
        department: 'Marketing',
        quiz_title: 'Digital Marketing Fundamentals',
        quiz_topic: 'Marketing',
        quiz_difficulty: 'Medium',
        score_percentage: 88,
        correct_answers: 22,
        total_questions: 25,
        time_taken: '6m 20s',
        points_earned: 352,
        completion_date: '2024-04-16',
        completion_time: '16:30:00',
        attempt_number: 1,
        pass_status: 'PASSED'
      },
      {
        completion_id: 'C003',
        employee_name: 'Michael Chen',
        employee_id: 'EMP003',
        department: 'Sales',
        quiz_title: 'Sales Strategy Basics',
        quiz_topic: 'Sales',
        quiz_difficulty: 'Easy',
        score_percentage: 92,
        correct_answers: 23,
        total_questions: 25,
        time_taken: '5m 15s',
        points_earned: 368,
        completion_date: '2024-04-16',
        completion_time: '13:45:00',
        attempt_number: 1,
        pass_status: 'PASSED'
      }
    ]

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new()

    // Summary Leaderboard Sheet
    const summaryWs = XLSX.utils.json_to_sheet(comprehensiveLeaderboardData)
    summaryWs['!cols'] = [
      { wch: 6 },  // Rank
      { wch: 20 }, // Employee Name
      { wch: 30 }, // Email
      { wch: 12 }, // Employee ID
      { wch: 15 }, // Department
      { wch: 12 }, // Total Points
      { wch: 18 }, // Total Quizzes
      { wch: 12 }, // Average Score
      { wch: 18 }, // Total Correct
      { wch: 20 }, // Total Questions
      { wch: 15 }, // Total Time
      { wch: 22 }, // First Quiz
      { wch: 22 }, // Last Quiz
      { wch: 18 }, // Fastest Time
      { wch: 18 }, // Slowest Time
      { wch: 18 }, // Completion Rate
      { wch: 16 }, // Trend
      { wch: 14 }, // Total Attempts
      { wch: 20 }, // Avg Attempts
    ]
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Leaderboard Summary')

    // Detailed Completions Sheet
    const detailsWs = XLSX.utils.json_to_sheet(detailedCompletions)
    detailsWs['!cols'] = [
      { wch: 12 }, // Completion ID
      { wch: 20 }, // Employee Name
      { wch: 12 }, // Employee ID
      { wch: 15 }, // Department
      { wch: 30 }, // Quiz Title
      { wch: 15 }, // Quiz Topic
      { wch: 12 }, // Difficulty
      { wch: 12 }, // Score %
      { wch: 14 }, // Correct
      { wch: 14 }, // Total Questions
      { wch: 12 }, // Time Taken
      { wch: 12 }, // Points
      { wch: 15 }, // Date
      { wch: 12 }, // Time
      { wch: 12 }, // Attempt #
      { wch: 12 }, // Status
    ]
    XLSX.utils.book_append_sheet(wb, detailsWs, 'Quiz Completions')

    // Performance Analytics Sheet
    const analyticsData = [
      { metric: 'Total Employees', value: 5 },
      { metric: 'Total Quizzes Available', value: 8 },
      { metric: 'Total Completions', value: 30 },
      { metric: 'Average Score Across All Quizzes', value: '83.8%' },
      { metric: 'Total Points Distributed', value: 10780 },
      { metric: 'Average Completion Time', value: '5m 24s' },
      { metric: 'Highest Individual Score', value: '95%' },
      { metric: 'Most Active Employee', value: 'John Smith (8 quizzes)' },
      { metric: 'Most Popular Quiz Topic', value: 'Programming' },
      { metric: 'Department with Highest Avg Score', value: 'Engineering (92%)' }
    ]
    const analyticsWs = XLSX.utils.json_to_sheet(analyticsData)
    XLSX.utils.book_append_sheet(wb, analyticsWs, 'Performance Analytics')

    // Department Summary Sheet
    const departmentSummary = [
      {
        department: 'Engineering',
        total_employees: 1,
        participants: 1,
        participation_rate: '100%',
        average_score: 92,
        total_completions: 8,
        total_points: 2450
      },
      {
        department: 'Marketing',
        total_employees: 1,
        participants: 1,
        participation_rate: '100%',
        average_score: 89,
        total_completions: 7,
        total_points: 2380
      },
      {
        department: 'Sales',
        total_employees: 1,
        participants: 1,
        participation_rate: '100%',
        average_score: 85,
        total_completions: 6,
        total_points: 2200
      },
      {
        department: 'HR',
        total_employees: 1,
        participants: 1,
        participation_rate: '100%',
        average_score: 78,
        total_completions: 5,
        total_points: 1950
      },
      {
        department: 'Finance',
        total_employees: 1,
        participants: 1,
        participation_rate: '100%',
        average_score: 75,
        total_completions: 4,
        total_points: 1800
      }
    ]
    const deptWs = XLSX.utils.json_to_sheet(departmentSummary)
    XLSX.utils.book_append_sheet(wb, deptWs, 'Department Analysis')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `comprehensive-leaderboard-report-${timestamp}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString()
      },
    })
  } catch (e: any) {
    console.error('Export error:', e)
    return NextResponse.json({ error: 'Failed to generate comprehensive report' }, { status: 500 })
  }
}
