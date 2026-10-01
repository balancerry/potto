import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-4">
      <Link
        href="/"
        aria-label="Back to your pots"
        className="inline-flex min-h-11 items-center text-sm font-medium text-ink-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        ← Your pots
      </Link>
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">This page could not be found</h1>
        <p className="mt-2 text-sm text-ink-soft">It may have been removed, or the link is out of date.</p>
      </div>
    </div>
  );
}
