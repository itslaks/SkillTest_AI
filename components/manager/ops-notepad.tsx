'use client'

import { useState, useEffect } from 'react'
import { StickyNote, Plus, X, NotebookPen } from 'lucide-react'

interface Note {
  id: string
  text: string
  createdAt: string
}

export function OpsNotepad() {
  const [notes, setNotes] = useState<Note[]>([])
  const [input, setInput] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('ops-admin-notepad')
      if (saved) setNotes(JSON.parse(saved))
    } catch {}
  }, [])

  const persist = (updated: Note[]) => {
    setNotes(updated)
    try { localStorage.setItem('ops-admin-notepad', JSON.stringify(updated)) } catch {}
  }

  const add = () => {
    const text = input.trim()
    if (!text) return
    persist([
      { id: Date.now().toString(), text, createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ...notes,
    ])
    setInput('')
  }

  const remove = (id: string) => persist(notes.filter((n) => n.id !== id))

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() }
  }

  return (
    <div className="flex h-full flex-col rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50/60 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-amber-200/70">
          <NotebookPen className="h-3.5 w-3.5 text-amber-700" />
        </span>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Quick Notes</p>
        {mounted && notes.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            {notes.length}
          </span>
        )}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Add a reminder…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-amber-200 bg-white/80 px-3 text-sm placeholder:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400 text-white shadow-sm transition hover:bg-amber-500 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Notes list */}
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {!mounted || notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
            <StickyNote className="h-8 w-8 text-amber-200" />
            <p className="text-xs text-amber-400">No reminders yet.</p>
            <p className="text-[10px] text-amber-300">Type above and press Enter.</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="group flex items-start gap-2 rounded-xl border border-amber-100 bg-white/70 px-3 py-2.5 shadow-sm"
            >
              <p className="min-w-0 flex-1 text-sm leading-snug text-slate-800">{note.text}</p>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button
                  onClick={() => remove(note.id)}
                  className="grid h-5 w-5 place-items-center rounded-full text-amber-300 opacity-0 transition hover:bg-rose-100 hover:text-rose-500 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
                <span className="text-[9px] text-amber-300">{note.createdAt}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
