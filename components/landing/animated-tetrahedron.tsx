export function AnimatedTetrahedron() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="motion-safe-3d relative h-[68%] w-[68%] max-w-28"
        style={{
          animation: "float 7s ease-in-out infinite",
          willChange: "transform",
        }}
      >
        <div className="absolute left-1/2 top-1 h-px w-[70%] origin-left rotate-[58deg] bg-black/20" />
        <div className="absolute right-1/2 top-1 h-px w-[70%] origin-right rotate-[-58deg] bg-black/20" />
        <div className="absolute bottom-3 left-[14%] h-px w-[72%] bg-black/20" />
        <div className="absolute inset-x-[22%] bottom-[20%] h-px rotate-[-18deg] bg-black/10" />
        <div className="absolute inset-x-[24%] top-[42%] h-px rotate-[18deg] bg-black/10" />
        {/* inner glow dot */}
        <div
          className="absolute left-1/2 top-[38%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-sky-400/60"
          style={{ animation: "float-delayed 5s ease-in-out infinite", willChange: "transform" }}
        />
      </div>
    </div>
  )
}
