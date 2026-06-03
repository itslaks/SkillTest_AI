/**
 * Shared AI utility — single source of truth for all OpenAI/Gemini calls.
 * Keeps prompts lean to minimise token consumption.
 */

export type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface AIOptions {
  maxTokens?: number
  temperature?: number
  model?: string
}

const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'
const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions'
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'
const GEMINI_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

/** Call OpenAI chat completions. Throws on network/API error. */
export async function callOpenAI(
  messages: AIMessage[],
  opts: AIOptions = {}
): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch(OPENAI_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: opts.model ?? OPENAI_DEFAULT_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.5,
    }),
  })

  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `OpenAI ${res.status}`)
  return json.choices?.[0]?.message?.content ?? ''
}

/** Call Gemini 1.5-flash. Throws on network/API error. */
export async function callGemini(prompt: string, opts: AIOptions = {}): Promise<string> {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY not configured')

  const res = await fetch(`${GEMINI_BASE}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: opts.temperature ?? 0.5, maxOutputTokens: opts.maxTokens ?? 800 },
    }),
  })

  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Gemini ${res.status}`)
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/** Call Groq's OpenAI-compatible chat completions endpoint. Throws on network/API error. */
export async function callGroq(
  messages: AIMessage[],
  opts: AIOptions = {}
): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not configured')

  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: opts.model ?? process.env.GROQ_MODEL ?? GROQ_DEFAULT_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.4,
    }),
  })

  const json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Groq ${res.status}`)
  return json.choices?.[0]?.message?.content ?? ''
}

/** Pick whichever AI provider is configured, OpenAI preferred. */
export async function callAI(
  messages: AIMessage[],
  opts: AIOptions = {}
): Promise<{ text: string; provider: 'openai' | 'groq' | 'gemini' }> {
  if (process.env.OPENAI_API_KEY) {
    const text = await callOpenAI(messages, opts)
    return { text, provider: 'openai' }
  }
  if (process.env.GROQ_API_KEY) {
    const text = await callGroq(messages, opts)
    return { text, provider: 'groq' }
  }
  if (process.env.GOOGLE_GEMINI_API_KEY) {
    // Flatten messages into a single prompt for Gemini
    const prompt = messages.map((m) => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')
    const text = await callGemini(prompt, opts)
    return { text, provider: 'gemini' }
  }
  throw new Error('No AI provider configured. Set OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GEMINI_API_KEY.')
}

/**
 * Strip a raw AI response of markdown code fences and trim whitespace.
 * Safe to call even when the response is already clean JSON.
 */
export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```[a-z]*\n?/gm, '')
    .replace(/^```\n?/gm, '')
    .trim()
}

/**
 * Build a compact, token-efficient assessment context string (≈ 60 % fewer tokens
 * than full JSON.stringify). Caps at 60 rows.
 */
export function buildCompactAssessmentContext(data: any[]): string {
  if (!data?.length) return ''

  const cap = data.slice(0, 60)
  const scores = cap.map((d) => d.percentage ?? 0).filter(Boolean)
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0
  const passed = cap.filter((d) => (d.performance_category ?? '').toLowerCase() === 'cleared').length
  const passRate = ((passed / cap.length) * 100).toFixed(0)

  const rows = cap
    .map(
      (d) =>
        `${d.candidate_name ?? d.candidate_email ?? 'Unknown'}|${d.percentage ?? 0}%|${d.time_taken_minutes ?? '?'}min|${d.performance_category ?? '-'}`
    )
    .join('\n')

  return `SUMMARY: n=${cap.length}, avg=${avg}%, passed=${passed}(${passRate}%)
COLUMNS: name|score|time|status
DATA:
${rows}`
}
