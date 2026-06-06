import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEmployee } from '@/lib/rbac'
import { submitTrainingFeedback } from '@/lib/actions/training'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquareText, ShieldCheck } from 'lucide-react'

async function submitDirectFeedbackAction(formData: FormData) {
  'use server'
  const result = await submitTrainingFeedback(formData)
  if (result?.error) {
    redirect(`/employee/training/feedback/${formData.get('feedback_window_id')}?error=${encodeURIComponent(result.error)}`)
  }
  redirect('/employee/training?feedback=submitted')
}

export default async function TrainingFeedbackFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const { userId } = await requireEmployee()
  const admin = createAdminClient()

  const { data: window, error } = await admin
    .from('training_feedback_windows')
    .select('*, batch:batch_id(id, title, description), session:session_id(id, title, session_date)')
    .eq('id', id)
    .maybeSingle()

  if (error || !window) {
    return <FeedbackState title="Feedback form not found" body="The feedback link is invalid or the form was removed." />
  }

  const { data: membership } = await admin
    .from('batch_members')
    .select('id')
    .eq('batch_id', window.batch_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return <FeedbackState title="Feedback form unavailable" body="This feedback form is only available to learners in the linked training batch." />
  }

  const now = Date.now()
  const isOpen = window.status === 'open' && new Date(window.opens_at).getTime() <= now && new Date(window.closes_at).getTime() >= now
  if (!isOpen) {
    return (
      <FeedbackState
        title="Feedback form is closed"
        body={`This form ${window.status === 'open' ? `closed on ${new Date(window.closes_at).toLocaleString()}` : `is ${window.status}`}.`}
      />
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-[1.75rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">Training Feedback</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">{window.title}</h1>
              <p className="mt-2 text-sm text-zinc-400">{window.batch?.title || 'Training batch'}{window.session?.title ? ` - ${window.session.title}` : ''}</p>
            </div>
            <Badge variant="outline" className="w-fit border-emerald-200/30 bg-emerald-200/10 text-emerald-100">
              Open until {new Date(window.closes_at).toLocaleString()}
            </Badge>
          </div>
        </section>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" />
              Submit Feedback
            </CardTitle>
            <CardDescription>Your response goes to the training manager for quality review.</CardDescription>
          </CardHeader>
          <CardContent>
            {query?.error ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{query.error}</div>
            ) : null}
            <form action={submitDirectFeedbackAction} className="grid gap-4">
              <input type="hidden" name="feedback_window_id" value={window.id} />
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Overall rating</span>
                <select name="rating" defaultValue="5" className="h-11 rounded-xl border border-zinc-200 px-3">
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Good</option>
                  <option value="3">3 - Average</option>
                  <option value="2">2 - Needs Improvement</option>
                  <option value="1">1 - Poor</option>
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Training content quality</span>
                  <select name="content_quality_rating" defaultValue="5" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Average</option>
                    <option value="2">2 - Needs Improvement</option>
                    <option value="1">1 - Poor</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Trainer effectiveness</span>
                  <select name="trainer_effectiveness_rating" defaultValue="5" className="h-11 rounded-xl border border-zinc-200 px-3">
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Average</option>
                    <option value="2">2 - Needs Improvement</option>
                    <option value="1">1 - Poor</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Feedback</span>
                <textarea name="feedback_text" rows={5} required className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="What worked well? What should be improved?" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Suggested action item</span>
                <input name="action_item" className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Example: add more hands-on labs" />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="submit" className="rounded-full bg-black text-white hover:bg-zinc-800">Submit feedback</Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/employee/training">Back to training</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function FeedbackState({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <Card className="mx-auto max-w-xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="rounded-full bg-black text-white hover:bg-zinc-800">
            <Link href="/employee/training">Open training page</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
