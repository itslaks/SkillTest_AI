import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Verify manager role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized: Only managers can use AI chat' }, { status: 403 })
  }

  try {
    const { message, sessionId, quizId, assessmentData } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    // Create or get session
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('ai_chat_sessions')
        .insert({
          user_id: user.id,
          quiz_id: quizId || null,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        })
        .select()
        .single()

      if (sessionError) {
        console.error('Session creation error:', sessionError)
        return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 })
      }
      currentSessionId = newSession.id
    }

    // Save user message
    await supabase.from('ai_chat_messages').insert({
      session_id: currentSessionId,
      role: 'user',
      content: message,
    })

    // Build context from assessment data if provided
    let context = ''
    if (assessmentData && Array.isArray(assessmentData) && assessmentData.length > 0) {
      context = buildAssessmentContext(assessmentData)
    } else if (quizId) {
      // Fetch assessment data for this quiz
      const { data: results } = await supabase
        .from('assessment_results')
        .select('*')
        .eq('quiz_id', quizId)
        .order('percentage', { ascending: false })
        .limit(100)

      if (results && results.length > 0) {
        context = buildAssessmentContext(results)
      }
    }

    // Call OpenAI
    const systemPrompt = `You are an intelligent assistant helping managers analyze employee assessment and quiz data. 
You have access to assessment results data including scores, completion times, performance categories, and more.

${context ? `Here is the current assessment data context:\n${context}\n` : 'No assessment data is currently loaded. Ask the user to upload assessment data first.'}

Provide helpful, data-driven insights. When analyzing:
- Identify top performers and those needing improvement
- Calculate statistics like averages, medians, and distributions
- Highlight trends and patterns
- Suggest actionable recommendations
- Be concise but thorough

If asked about specific employees, search the data by name or email.
Always format numbers nicely and use percentages where appropriate.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI error:', errorText)
      return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 })
    }

    const data = await response.json()
    const assistantMessage = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    // Save assistant message
    await supabase.from('ai_chat_messages').insert({
      session_id: currentSessionId,
      role: 'assistant',
      content: assistantMessage,
    })

    return NextResponse.json({
      message: assistantMessage,
      sessionId: currentSessionId,
    })

  } catch (error: any) {
    console.error('AI Chat error:', error)
    return NextResponse.json({ error: error.message || 'Chat failed' }, { status: 500 })
  }
}

function buildAssessmentContext(data: any[]): string {
  if (!data || data.length === 0) return ''

  const totalParticipants = data.length
  const scores = data.map(d => d.percentage || 0).filter(s => s > 0)
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0
  const maxScore = Math.max(...scores, 0)
  const minScore = Math.min(...scores.filter(s => s > 0), 0)

  const cleared = data.filter(d => d.performance_category?.toLowerCase() === 'cleared').length
  const passRate = ((cleared / totalParticipants) * 100).toFixed(1)

  const times = data.map(d => d.time_taken_minutes || 0).filter(t => t > 0)
  const avgTime = times.length > 0 ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : 0

  let context = `
ASSESSMENT DATA SUMMARY:
- Total Participants: ${totalParticipants}
- Average Score: ${avgScore}%
- Highest Score: ${maxScore}%
- Lowest Score: ${minScore}%
- Pass Rate: ${passRate}% (${cleared} cleared)
- Average Time Taken: ${avgTime} minutes

TOP 10 PERFORMERS:
${data.slice(0, 10).map((d, i) => 
  `${i + 1}. ${d.candidate_name} (${d.candidate_email}) - ${d.percentage}% - ${d.time_taken_minutes}min - ${d.performance_category || 'N/A'}`
).join('\n')}

${data.length > 10 ? `\nAND ${data.length - 10} MORE PARTICIPANTS...` : ''}

DETAILED DATA (for analysis):
${JSON.stringify(data.slice(0, 50).map(d => ({
  name: d.candidate_name,
  email: d.candidate_email,
  score: d.percentage,
  correct: d.correct,
  wrong: d.wrong,
  total: d.total_questions,
  time: d.time_taken_minutes,
  status: d.performance_category,
  percentile: d.percentile,
  feedback: d.candidate_feedback,
})), null, 2)}
`
  return context
}

// GET endpoint to fetch chat history
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  try {
    if (sessionId) {
      // Get messages for a specific session
      const { data: messages, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return NextResponse.json({ messages })
    } else {
      // Get all sessions for user
      const { data: sessions, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (error) throw error
      return NextResponse.json({ sessions })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
