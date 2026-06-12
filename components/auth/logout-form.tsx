'use client'

import { signOut } from '@/lib/actions/auth'
import type { ReactNode } from 'react'

/**
 * Single shared logout wrapper (OWASP session-management hygiene).
 *
 * The server action clears the Supabase session cookies and redirects to
 * /auth/login; this wrapper additionally wipes client-side state BEFORE the
 * action runs, so nothing user-specific survives on a shared device:
 *  - quiz draft answers cached in localStorage (quiz-draft:*)
 *  - everything in sessionStorage
 *
 * Protected pages themselves are served with Cache-Control: no-store (see
 * proxy.ts), so pressing Back after logout revalidates and redirects to login.
 */
export function LogoutForm({ children, className }: { children: ReactNode; className?: string }) {
  function clearClientState() {
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index)
        if (key && key.startsWith('quiz-draft:')) localStorage.removeItem(key)
      }
    } catch {
      // storage unavailable (private mode / blocked) — nothing to clear
    }
    try {
      sessionStorage.clear()
    } catch {
      // ignore
    }
  }

  return (
    <form action={signOut} onSubmit={clearClientState} className={className}>
      {children}
    </form>
  )
}
