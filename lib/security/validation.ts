/**
 * Zod-based input validation schemas for all user-facing inputs.
 *
 * Rules applied consistently:
 * - Maximum 397 characters on all string fields (as specified)
 * - Strict schemas: extra / unknown fields are rejected
 * - Explicit type checks and length limits
 * - No HTML / script injection via regex refinements where applicable
 */

import { z } from 'zod'

// ─── Shared helpers ───────────────────────────────────────────────────

const MAX_LEN = 397

/** A trimmed, non-empty string with max length */
const safeString = (maxLen = MAX_LEN) =>
  z
    .string()
    .trim()
    .min(1, 'This field is required')
    .max(maxLen, `Must be at most ${maxLen} characters`)

/** A string that rejects common script injection patterns */
const sanitizedString = (maxLen = MAX_LEN) =>
  safeString(maxLen).refine(
    (val) => !/<script[\s>]|javascript:|on\w+\s*=/i.test(val),
    'Input contains disallowed content'
  )

/** Safe email: trimmed, lowered, max-length, valid format */
const safeEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(MAX_LEN, `Must be at most ${MAX_LEN} characters`)
  .email('Invalid email address')

/** Safe password */
const safePassword = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(MAX_LEN, `Must be at most ${MAX_LEN} characters`)

/** Safe URL */
const safeUrl = z
  .string()
  .trim()
  .max(MAX_LEN, `Must be at most ${MAX_LEN} characters`)
  .url('Invalid URL')
  .refine(
    (val) => /^https?:\/\//i.test(val),
    'URL must start with http:// or https://'
  )

/** Optional safe URL */
const optionalSafeUrl = z
  .string()
  .trim()
  .max(MAX_LEN)
  .url('Invalid URL')
  .refine((val) => /^https?:\/\//i.test(val), 'URL must start with http:// or https://')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

// ─── Role enum ────────────────────────────────────────────────────────

const userRoleSchema = z.enum(['employee', 'manager'])

// ─── Auth schemas ─────────────────────────────────────────────────────

/** Sign-up schema – only 'employee' role is accepted via self-registration */
export const signUpSchema = z
  .object({
    email: safeEmail,
    password: safePassword,
    fullName: sanitizedString(150),
    employeeId: sanitizedString(50).optional().nullable().or(z.literal('').transform(() => null)),
    role: z.literal('employee').default('employee'),
    department: sanitizedString(150).optional().nullable().or(z.literal('').transform(() => null)),
  })
  .strict()

export const signInSchema = z
  .object({
    email: safeEmail.or(sanitizedString(MAX_LEN)),
    password: safePassword,
    redirect: z
      .string()
      .max(MAX_LEN)
      .regex(/^\/[a-zA-Z0-9\-_/]*$/, 'Invalid redirect path')
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
  })
  .strict()

export const magicLinkSchema = z
  .object({
    email: safeEmail,
    redirect: z
      .string()
      .max(MAX_LEN)
      .regex(/^\/[a-zA-Z0-9\-_/]*$/, 'Invalid redirect path')
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
  })
  .strict()

export const updateProfileSchema = z
  .object({
    fullName: sanitizedString(150),
    department: sanitizedString(150).optional().nullable().or(z.literal('').transform(() => null)),
    avatarUrl: optionalSafeUrl,
  })
  .strict()

// ─── Quiz schemas ─────────────────────────────────────────────────────

const difficultyLevelSchema = z.enum([
  'easy',
  'medium',
  'hard',
  'advanced',
  'hardcore',
])

const questionStatusSchema = z.enum(['pending', 'approved', 'rejected'])

export const createQuizSchema = z
  .object({
    title: sanitizedString(200),
    description: sanitizedString(MAX_LEN).optional().nullable().or(z.literal('').transform(() => null)),
    topic: sanitizedString(200),
    difficulty: difficultyLevelSchema,
    time_limit_minutes: z.number().int().min(1).max(480),
    question_count: z.number().int().min(1).max(500),
    passing_score: z.number().int().min(0).max(100),
    feedback_form_url: optionalSafeUrl,
    starts_at: z.string().datetime().optional().nullable().or(z.literal('').transform(() => null)),
    ends_at: z.string().datetime().optional().nullable().or(z.literal('').transform(() => null)),
  })
  .strict()

export const updateQuizSchema = createQuizSchema.partial().strict()

export const createQuestionSchema = z
  .object({
    quiz_id: z.string().uuid('Invalid quiz ID'),
    question_text: sanitizedString(MAX_LEN),
    options: z
      .array(z.object({ text: z.string().max(MAX_LEN), isCorrect: z.boolean() }))
      .min(2, 'At least 2 options required')
      .max(10, 'At most 10 options allowed'),
    difficulty: difficultyLevelSchema,
    explanation: sanitizedString(MAX_LEN).optional().nullable().or(z.literal('').transform(() => null)),
    is_ai_generated: z.boolean().optional().default(false),
    is_approved: z.boolean().optional().default(true),
    order_index: z.number().int().min(0).optional(),
    status: questionStatusSchema.optional(),
  })
  .strict()

export const updateQuestionSchema = createQuestionSchema
  .omit({ quiz_id: true })
  .partial()
  .strict()

export const bulkCreateQuestionsSchema = z
  .array(createQuestionSchema)
  .min(1, 'At least 1 question required')
  .max(200, 'At most 200 questions per batch')

export const submitQuizSchema = z
  .object({
    quiz_id: z.string().uuid('Invalid quiz ID'),
    answers: z.array(z.object({
      questionId: z.string().uuid(),
      selectedOption: z.number().int().min(0),
      isCorrect: z.boolean(),
      timeSpent: z.number().int().min(0),
    })),
    time_taken_seconds: z.number().int().min(0).max(86400),
  })
  .strict()

// ─── ID validation ────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Invalid ID format')

// ─── Auth callback schema ─────────────────────────────────────────────

export const authCallbackSchema = z.object({
  code: z.string().min(1).max(MAX_LEN).optional().nullable(),
  next: z
    .string()
    .max(MAX_LEN)
    .regex(/^\/[a-zA-Z0-9\-_/]*$/, 'Invalid redirect path')
    .optional()
    .default('/'),
})

// ─── Helper to parse FormData against a schema ────────────────────────

export function parseFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const raw: Record<string, unknown> = {}
  formData.forEach((value, key) => {
    // Only accept string values from FormData (reject File objects etc.)
    if (typeof value === 'string') {
      raw[key] = value
    }
  })

  const result = schema.safeParse(raw)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return {
      success: false,
      error: firstError
        ? `${firstError.path.join('.')}: ${firstError.message}`
        : 'Invalid input',
    }
  }

  return { success: true, data: result.data }
}
