export function AnimatedWave() {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden">
      <div className="grid w-full gap-2 px-2">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="h-2 rounded-full bg-[linear-gradient(90deg,rgba(14,165,233,0.08),rgba(14,165,233,0.5),rgba(15,23,42,0.12))]"
            style={{ width: `${92 - row * 12}%`, marginLeft: `${row * 8}%` }}
          />
        ))}
      </div>
    </div>
  )
}
