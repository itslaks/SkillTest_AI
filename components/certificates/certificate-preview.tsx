type CertificatePreviewProps = {
  employeeName: string
  topic: string
  message?: string | null
  certificateTitle?: string
  issueDate?: string
  score?: number | string
  employeeId?: string | null
  templateImageUrl?: string | null
  presenter?: string
  accent?: string
  compact?: boolean
}

export function CertificatePreview({
  employeeName,
  topic,
  message,
  certificateTitle = 'Certificate of Achievement',
  issueDate,
  score,
  employeeId,
  templateImageUrl,
  presenter = 'Hexaware Technologies',
  accent = '#6f5ab8',
  compact = false,
}: CertificatePreviewProps) {
  const scoreLabel = score === undefined || score === null || score === '' ? 'Verified' : `${score}%`

  return (
    <div className={`relative mx-auto aspect-[1.414/1] w-full overflow-hidden rounded-xl border border-zinc-300 bg-[#fbfaf7] shadow-sm ${compact ? 'max-w-xl' : 'max-w-6xl'}`}>
      {templateImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url("${templateImageUrl}")` }}
        />
      )}
      <div className="absolute inset-4 border border-zinc-300" />
      <div className="absolute inset-7 border" style={{ borderColor: accent }} />
      <div className="absolute left-0 top-0 h-1.5 w-full" style={{ backgroundColor: accent }} />

      <div className={`relative flex h-full flex-col px-[8%] py-[5.5%] text-center ${compact ? 'gap-3' : 'gap-5'}`}>
        <header className="flex items-start justify-between gap-4 text-left">
          <div>
            <p className={`font-semibold uppercase tracking-[0.28em] text-zinc-500 ${compact ? 'text-[9px]' : 'text-xs'}`}>{presenter}</p>
            <p className={`mt-1 font-medium text-zinc-500 ${compact ? 'text-[10px]' : 'text-sm'}`}>SkillTest_AI Verified Credential</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/75 px-3 py-1.5 text-left shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
            <span className={`font-semibold uppercase tracking-[0.16em] text-zinc-600 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>Verified</span>
          </div>
        </header>

        <div className="mx-auto mt-1 w-full max-w-4xl flex-1">
          <p className={`font-semibold uppercase tracking-[0.34em] ${compact ? 'text-[10px]' : 'text-sm'}`} style={{ color: accent }}>
            {certificateTitle}
          </p>
          <h1 className={`mt-3 font-serif font-semibold leading-none text-zinc-950 ${compact ? 'text-3xl' : 'text-6xl md:text-7xl'}`}>
            Certificate
          </h1>
          <p className={`mt-2 uppercase tracking-[0.42em] text-zinc-500 ${compact ? 'text-[9px]' : 'text-xs'}`}>presented to</p>

          <div className="mx-auto mt-4 max-w-[82%] border-b border-zinc-300 px-4 pb-2">
            <h2
              className={`break-words font-serif font-semibold leading-tight ${compact ? 'text-2xl' : 'text-5xl md:text-6xl'}`}
              style={{ color: accent }}
            >
              {employeeName}
            </h2>
          </div>

          <p className={`mx-auto mt-5 max-w-3xl leading-relaxed text-zinc-700 ${compact ? 'text-[11px]' : 'text-base md:text-lg'}`}>
            {message || `has successfully completed ${topic} and demonstrated the required proficiency for this credential.`}
          </p>
          <p className={`mt-3 font-semibold text-zinc-950 ${compact ? 'text-xs' : 'text-base'}`}>{topic}</p>
        </div>

        <footer className="grid grid-cols-2 items-end gap-4 border-t border-zinc-200 pt-4 text-left">
          <Meta label="Issue Date" value={issueDate || 'On completion'} compact={compact} />
          <div className="text-right">
            <Meta label="Score" value={scoreLabel} compact={compact} align="right" />
            {employeeId && <p className={`mt-1 text-zinc-500 ${compact ? 'text-[9px]' : 'text-[11px]'}`}>Employee ID: {employeeId}</p>}
          </div>
        </footer>
      </div>
    </div>
  )
}

function Meta({ label, value, compact, align = 'left' }: { label: string; value: string; compact: boolean; align?: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <p className={`font-semibold uppercase tracking-[0.22em] text-zinc-400 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>{label}</p>
      <p className={`mt-1 font-semibold text-zinc-950 ${compact ? 'text-[11px]' : 'text-sm'}`}>{value}</p>
    </div>
  )
}
