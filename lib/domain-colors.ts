const palette = [
  { gradient: 'from-cyan-500 to-blue-600', badge: 'bg-cyan-50 text-cyan-800 border border-cyan-200' },
  { gradient: 'from-violet-500 to-fuchsia-600', badge: 'bg-violet-50 text-violet-800 border border-violet-200' },
  { gradient: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  { gradient: 'from-amber-500 to-orange-600', badge: 'bg-amber-50 text-amber-800 border border-amber-200' },
  { gradient: 'from-rose-500 to-red-600', badge: 'bg-rose-50 text-rose-800 border border-rose-200' },
  { gradient: 'from-indigo-500 to-sky-600', badge: 'bg-indigo-50 text-indigo-800 border border-indigo-200' },
  { gradient: 'from-lime-500 to-green-600', badge: 'bg-lime-50 text-lime-800 border border-lime-200' },
  { gradient: 'from-pink-500 to-purple-600', badge: 'bg-pink-50 text-pink-800 border border-pink-200' },
  { gradient: 'from-slate-600 to-zinc-900', badge: 'bg-slate-100 text-slate-800 border border-slate-200' },
]

export function getDomainColor(domain: string) {
  const key = domain.trim().toLowerCase() || 'general'
  const hash = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}
