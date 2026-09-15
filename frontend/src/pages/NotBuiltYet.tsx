interface NotBuiltYetProps {
  screen?: string
}

// Placeholder for a route whose screen hasn't been built yet. Swapped out for the real page
// component one screen at a time as each is implemented -- keeps the full route table (matching
// BHARATPURE-CLAUDE.md's App.tsx structure) valid and buildable from the very first commit.
export default function NotBuiltYet({ screen }: NotBuiltYetProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="font-display text-xl font-bold text-earth-900">Coming soon</p>
      {screen && <p className="text-sm text-earth-500">{screen}</p>}
    </div>
  )
}
