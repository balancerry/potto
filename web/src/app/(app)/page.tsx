import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { formatMoney } from '@/lib/core/money';
import { listMyPots } from '@/lib/queries/pots';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: 'Your pots' };

export default async function HomePage() {
  const pots = await listMyPots();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Your pots</h1>
          <p className="mt-1 text-ink-soft">Group funds for trips, events, and shared expenses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/join" variant="outline">
            Join a pot
          </ButtonLink>
          <ButtonLink href="/pots/new">
            <Plus className="size-4" />
            Create pot
          </ButtonLink>
        </div>
      </div>

      {pots.length === 0 ? (
        <EmptyState
          title="No pots yet"
          description="Create a pot for your next trip, or join one with a code."
          action={<ButtonLink href="/pots/new">Create your first pot</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pots.map(({ pot, poolBalance }) => {
            const activeMembers = pot.members.filter((m) => m.status === 'active').length;
            return (
              <li key={pot.id}>
                <Link href={`/pots/${pot.id}`} className="block h-full">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2">{pot.name}</CardTitle>
                      {pot.status === 'archived' ? <Badge tone="gold">Archived</Badge> : null}
                    </div>
                    {pot.description ? (
                      <CardDescription className="line-clamp-2">{pot.description}</CardDescription>
                    ) : null}
                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-ink-soft">Pool</p>
                        <p className="font-display text-2xl font-semibold text-accent">
                          {formatMoney(poolBalance)}
                        </p>
                      </div>
                      <p className="flex items-center gap-1 text-sm text-ink-soft">
                        <Users className="size-3.5" />
                        {activeMembers}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
