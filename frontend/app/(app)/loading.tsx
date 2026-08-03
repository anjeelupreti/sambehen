export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-muted h-24 animate-pulse rounded-xl" />
        ))}
      </div>

      <div className="bg-muted h-96 animate-pulse rounded-xl" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
