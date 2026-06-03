type CertificatePreviewProps = {
  employeeName: string
  topic: string
  message?: string | null
  presenter?: string
  accent?: string
  compact?: boolean
}

export function CertificatePreview({
  employeeName,
  topic,
  message,
  presenter = 'Hexaware Technologies',
  accent = '#6f5ab8',
  compact = false,
}: CertificatePreviewProps) {
  return (
    <div className={`relative mx-auto aspect-[1.414/1] w-full overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm ${compact ? 'max-w-xl' : 'max-w-6xl'}`}>
      <div className="absolute inset-3 rounded-lg border-2 border-zinc-500/80" />
      <Confetti />
      <div className={`absolute inset-x-8 flex flex-col items-center text-center ${compact ? 'top-8' : 'top-14'}`}>
        <h1 className={`font-black tracking-[0.02em] text-black ${compact ? 'text-4xl' : 'text-6xl md:text-7xl'}`}>Certificate</h1>
        <p className={`mt-1 font-medium uppercase tracking-[0.42em] text-black ${compact ? 'text-xs' : 'text-xl'}`}>Of Achievement</p>
        <div className="mt-5 flex items-center gap-2">
          <span className="h-px w-20 bg-black" />
          <span className="h-5 w-5 rotate-45 border-2 border-black" style={{ backgroundColor: accent }} />
          <span className="h-5 w-5 rotate-45 border-2 border-black bg-indigo-200" />
          <span className="h-px w-20 bg-black" />
        </div>
      </div>

      <div className={`absolute inset-x-8 flex flex-col items-center text-center ${compact ? 'top-[43%]' : 'top-[41%]'}`}>
        <p className={`tracking-[0.22em] text-zinc-950 ${compact ? 'text-xs' : 'text-base'}`}>This is to certify that</p>
        <h2
          className={`mt-3 max-w-[80%] border-b border-zinc-500 px-6 pb-1 font-black leading-tight ${compact ? 'text-3xl' : 'text-5xl md:text-6xl'}`}
          style={{ color: accent }}
        >
          {employeeName}
        </h2>
        <p className={`mt-4 max-w-3xl leading-relaxed text-black ${compact ? 'text-xs' : 'text-lg'}`}>
          {message || `has been awarded this certificate in recognition of outstanding performance in the quiz on ${topic}`}
        </p>
        <p className={`mt-3 font-bold text-black ${compact ? 'text-xs' : 'text-base'}`}>Presented by {presenter}</p>
      </div>
    </div>
  )
}

function Confetti() {
  return (
    <>
      <div className="absolute left-9 top-8 h-4 w-4 rotate-45 border-[5px] border-[#6f5ab8]" />
      <div className="absolute right-9 top-8 h-4 w-4 rotate-45 border-[5px] border-[#6f5ab8]" />
      <div className="absolute left-14 top-24 h-4 w-12 -rotate-45 rounded-full bg-[#8ba0ef]" />
      <div className="absolute right-14 top-24 h-4 w-12 rotate-45 rounded-full bg-[#8ba0ef]" />
      <div className="absolute left-24 top-10 h-2 w-2 rounded-full bg-[#8ba0ef]" />
      <div className="absolute right-28 top-12 h-2 w-2 rounded-full bg-[#8ba0ef]" />
      <div className="absolute left-24 top-20 h-12 w-8 rounded-full border-8 border-[#a8bbff] border-r-transparent border-b-transparent" />
      <div className="absolute right-28 top-20 h-12 w-16 rounded-full border-8 border-[#a8bbff] border-r-transparent border-b-transparent" />
      <div className="absolute left-0 bottom-14 h-0 w-0 border-b-[56px] border-l-[72px] border-t-[56px] border-b-transparent border-l-[#8ba0ef] border-t-transparent" />
      <div className="absolute right-0 bottom-14 h-0 w-0 border-b-[56px] border-r-[72px] border-t-[56px] border-b-transparent border-r-[#6f5ab8] border-t-transparent" />
      <div className="absolute left-20 bottom-2 h-0 w-0 border-b-[42px] border-l-[48px] border-r-[48px] border-b-[#efe2ff] border-l-transparent border-r-transparent" />
      <div className="absolute right-20 bottom-2 h-0 w-0 border-b-[42px] border-l-[48px] border-r-[48px] border-b-[#efe2ff] border-l-transparent border-r-transparent" />
      <div className="absolute left-12 top-16 h-14 w-4 rotate-45 rounded-full bg-[#d7c8ff]" />
      <div className="absolute right-12 top-16 h-14 w-4 -rotate-45 rounded-full bg-[#d7c8ff]" />
    </>
  )
}
