import Link from 'next/link';

export function HelpFrame({
  title,
  lede,
  back = true,
  children,
}: {
  title: string;
  lede?: string;
  back?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1040px] space-y-8">
      {back ? (
        <Link
          href="/help"
          aria-label="Back to Help"
          className="inline-flex min-h-11 items-center text-sm font-medium text-ink-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          ← Help
        </Link>
      ) : (
        <Link
          href="/"
          aria-label="Back to your pots"
          className="inline-flex min-h-11 items-center text-sm font-medium text-ink-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          ← Your pots
        </Link>
      )}
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {lede ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{lede}</p> : null}
      </div>
      {children}
    </div>
  );
}
