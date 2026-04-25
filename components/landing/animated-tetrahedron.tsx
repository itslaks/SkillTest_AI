export function AnimatedTetrahedron() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative h-[68%] w-[68%] max-w-28">
        <div className="absolute left-1/2 top-1 h-px w-[70%] origin-left rotate-[58deg] bg-black/20" />
        <div className="absolute right-1/2 top-1 h-px w-[70%] origin-right rotate-[-58deg] bg-black/20" />
        <div className="absolute bottom-3 left-[14%] h-px w-[72%] bg-black/20" />
        <div className="absolute inset-x-[22%] bottom-[20%] h-px rotate-[-18deg] bg-black/10" />
        <div className="absolute inset-x-[24%] top-[42%] h-px rotate-[18deg] bg-black/10" />
      </div>
    </div>
  )
}
