'use client'

import { useFormStatus } from 'react-dom'

type Decision = 'approved' | 'rejected' | 'retest_required' | 'escalated'

interface ReviewButtonProps {
  value: Decision
  label: string
  className: string
}

function ReviewButton({ value, label, className }: ReviewButtonProps) {
  const { pending } = useFormStatus()
  return (
    <button
      name="review_decision"
      value={value}
      disabled={pending}
      className={`${className} disabled:opacity-60 disabled:cursor-not-allowed transition-opacity`}
    >
      {pending ? 'Saving…' : label}
    </button>
  )
}

export function SuspiciousReviewButtons({ attemptId }: { attemptId: string }) {
  return (
    <>
      <input type="hidden" name="attempt_id" value={attemptId} />
      <ReviewButton value="approved" label="Approve" className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold text-white" />
      <ReviewButton value="approved" label="Dismiss" className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200" />
      <ReviewButton value="rejected" label="Reject" className="rounded-full bg-red-700 px-3 py-2 text-xs font-semibold text-white" />
      <ReviewButton value="retest_required" label="Require retest" className="rounded-full bg-amber-700 px-3 py-2 text-xs font-semibold text-white" />
    </>
  )
}

export function CandidateReviewButtons() {
  const DECISIONS = [
    { status: 'approved' as Decision, label: 'Approve / clear attempt', className: 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white hover:text-black' },
    { status: 'approved' as Decision, label: 'Dismiss violations', className: 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white hover:text-black' },
    { status: 'rejected' as Decision, label: 'Confirm suspicious', className: 'rounded-full border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-700 hover:text-white' },
    { status: 'retest_required' as Decision, label: 'Request retest', className: 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white hover:text-black' },
    { status: 'escalated' as Decision, label: 'Escalate', className: 'rounded-full border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-700 hover:text-white' },
  ]

  return (
    <>
      {DECISIONS.map((d) => (
        <ReviewButton key={`${d.status}-${d.label}`} value={d.status} label={d.label} className={d.className} />
      ))}
    </>
  )
}
