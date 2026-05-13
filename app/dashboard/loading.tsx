export default function DashboardLoading() {
  return (
    <div className="flex h-full min-h-screen flex-col bg-zinc-950">
      {/* Skeleton header */}
      <div className="border-b border-zinc-800/60 bg-zinc-950/90 px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-800/60" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-800" />
            <div className="h-6 w-6 animate-pulse rounded-lg bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* Skeleton body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center */}
        <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* AI cockpit skeleton */}
          <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />

          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>

          {/* Opportunity cards row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </main>

        {/* Right panel skeleton */}
        <aside className="hidden w-80 shrink-0 border-l border-zinc-800/60 p-4 xl:flex xl:flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </aside>
      </div>
    </div>
  )
}
