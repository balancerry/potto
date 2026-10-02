'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { addMoney, updateContribution } from '@/lib/actions/transactions';
import { todayISO } from '@/lib/dates';
import { defaultAccountFor } from '@/lib/core/logic/pool-money';
import { formatDate, formatMoney, initials, toPaise } from '@/lib/core/money';
import type { Member, PoolAccount, ReceivedVia, Transaction } from '@/lib/core/models';
import { CancelLink, useWarnUnsaved } from '@/components/navigation/unsaved-changes';
import { safePotReturn } from '@/lib/navigation/pot-trail';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Mode = 'one' | 'many';
type AmountStyle = 'same' | 'different';

type SuccessState = {
  lines: { name: string; amountPaise: number }[];
  totalPaise: number;
  poolAfterPaise: number;
};

function parseRupees(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned.endsWith('.') ? cleaned.slice(0, -1) : cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function accountFor(accounts: PoolAccount[], via: ReceivedVia, selectedId: string): PoolAccount | undefined {
  return accounts.find((account) => account.id === selectedId) ?? defaultAccountFor(accounts, via);
}

export function AddMoneyForm({
  potId,
  members,
  poolAccounts,
  defaultMemberId,
  editingTx,
  poolBalance,
}: {
  potId: string;
  members: Member[];
  poolAccounts: PoolAccount[];
  defaultMemberId?: string;
  editingTx?: Transaction;
  poolBalance: number;
}) {
  const router = useRouter();
  const returnTo = safePotReturn(
    potId,
    useSearchParams().get('from'),
    editingTx ? `/pots/${potId}/transactions/${editingTx.id}` : `/pots/${potId}/transactions`,
  );
  const [dirty, setDirty] = useState(false);
  const active = members.filter((member) => member.status === 'active');
  const activeAccounts = poolAccounts.filter((account) => account.active);
  const isEdit = !!editingTx;
  const startingMember =
    (isEdit ? editingTx?.paidBy : defaultMemberId && active.some((member) => member.id === defaultMemberId) ? defaultMemberId : '') ??
    '';

  const [mode, setMode] = useState<Mode>('one');
  const [amountStyle, setAmountStyle] = useState<AmountStyle>('same');
  const [memberId, setMemberId] = useState(startingMember);
  const [amountRaw, setAmountRaw] = useState(isEdit ? String(editingTx!.amount / 100) : '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [memberQuery, setMemberQuery] = useState('');
  const [receivedVia, setReceivedVia] = useState<ReceivedVia>(editingTx?.receivedVia ?? 'online');
  const [poolAccountId, setPoolAccountId] = useState(
    editingTx?.poolAccountId ?? defaultAccountFor(activeAccounts, editingTx?.receivedVia ?? 'online')?.id ?? '',
  );
  const [changingAccount, setChangingAccount] = useState(false);
  const [date, setDate] = useState(editingTx?.date ?? todayISO());
  const [changingDate, setChangingDate] = useState(false);
  const [note, setNote] = useState(editingTx?.note ?? '');
  const [showNote, setShowNote] = useState(!!editingTx?.note);
  const [showMore, setShowMore] = useState(isEdit && (!!editingTx?.note || editingTx?.date !== todayISO()));
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  useWarnUnsaved(dirty && !success);

  const amount = parseRupees(amountRaw);
  const account = accountFor(activeAccounts, receivedVia, poolAccountId);
  const selectedMembers = active.filter((member) => selectedIds.includes(member.id));

  const differentRows = active
    .map((member) => ({ member, rupees: parseRupees(amounts[member.id] ?? '') }))
    .filter((row) => row.rupees !== null) as { member: Member; rupees: number }[];

  const invalidDifferent = active.some((member) => {
    const raw = (amounts[member.id] ?? '').trim();
    return raw !== '' && raw !== '0' && parseRupees(raw) === null;
  });

  const bulkLines =
    amountStyle === 'same'
      ? amount
        ? selectedMembers.map((member) => ({ member, rupees: amount }))
        : []
      : differentRows;

  const bulkTotalPaise = bulkLines.reduce((sum, line) => sum + toPaise(line.rupees), 0);
  const singlePaise = amount ? toPaise(amount) : 0;
  const previewPaise = mode === 'one' || isEdit ? singlePaise : bulkTotalPaise;
  const basePool = isEdit ? poolBalance - (editingTx?.amount ?? 0) : poolBalance;
  const poolAfter = basePool + previewPaise;

  function chooseVia(via: ReceivedVia) {
    setReceivedVia(via);
    const next = defaultAccountFor(activeAccounts, via);
    if (next) setPoolAccountId(next.id);
    setChangingAccount(false);
  }

  function toggleMember(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAll() {
    setSelectedIds(selectedIds.length === active.length ? [] : active.map((member) => member.id));
  }

  function switchAmountStyle(next: AmountStyle) {
    if (next === 'different' && amountStyle === 'same') {
      const filled: Record<string, string> = {};
      if (amountRaw.trim()) {
        for (const id of selectedIds) filled[id] = amountRaw;
      }
      setAmounts(filled);
    }
    if (next === 'same' && amountStyle === 'different') {
      const positive = active.filter((member) => parseRupees(amounts[member.id] ?? ''));
      setSelectedIds(positive.map((member) => member.id));
      const first = positive[0] ? parseRupees(amounts[positive[0].id] ?? '') : null;
      const uniform = first !== null && positive.every((member) => parseRupees(amounts[member.id] ?? '') === first);
      if (uniform && first !== null) setAmountRaw(String(first));
    }
    setAmountStyle(next);
    setAttempted(false);
  }

  const oneMemberError = attempted && !memberId ? 'Choose who paid.' : null;
  const oneAmountError =
    (attempted || amountRaw.trim() !== '') && parseRupees(amountRaw) === null
      ? amountRaw.trim() === ''
        ? attempted
          ? 'Enter an amount greater than 0.'
          : null
        : 'Enter an amount greater than 0.'
      : null;
  const sameAmountError =
    amountStyle === 'same' && (attempted || amountRaw.trim() !== '') && amount === null
      ? 'Enter an amount greater than 0.'
      : null;
  const samePeopleError = amountStyle === 'same' && attempted && selectedIds.length === 0 ? 'Choose at least one member.' : null;
  const differentError =
    amountStyle === 'different' && attempted && (invalidDifferent || differentRows.length === 0)
      ? invalidDifferent
        ? 'Fix the amounts that are not valid. Leave a row blank if that person did not pay.'
        : 'Enter an amount for at least one member.'
      : null;
  const accountError = attempted && !account ? 'Choose where this money was added.' : null;

  function readyToSave(): boolean {
    if (!account || !date) return false;
    if (isEdit || mode === 'one') return !!memberId && amount !== null;
    if (amountStyle === 'same') return selectedIds.length > 0 && amount !== null;
    return differentRows.length > 0 && !invalidDifferent;
  }

  async function save() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error("You're offline. Changes will not be saved until you're back online.");
      return;
    }
    if (!account) return;

    const lines =
      isEdit || mode === 'one'
        ? [{ memberId, rupees: amount! }]
        : bulkLines.map((line) => ({ memberId: line.member.id, rupees: line.rupees }));

    setLoading(true);
    if (isEdit) {
      const result = await updateContribution(potId, editingTx!.id, {
        memberId: lines[0].memberId,
        amount: toPaise(lines[0].rupees),
        date,
        note: note.trim() || undefined,
        receivedVia,
        poolAccountId: account.id,
      });
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Contribution updated');
      setDirty(false);
      router.push(returnTo);
      return;
    }

    const result = await addMoney(potId, {
      date,
      note: note.trim() || undefined,
      receivedVia,
      poolAccountId: account.id,
      entries: lines.map((line) => ({ memberId: line.memberId, amount: toPaise(line.rupees) })),
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const named = lines.map((line) => ({
      name: active.find((member) => member.id === line.memberId)?.name ?? 'Member',
      amountPaise: toPaise(line.rupees),
    }));
    setDirty(false);
    setSuccess({
      lines: named,
      totalPaise: named.reduce((sum, line) => sum + line.amountPaise, 0),
      poolAfterPaise: poolBalance + named.reduce((sum, line) => sum + line.amountPaise, 0),
    });
    setConfirming(false);
    router.refresh();
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (!readyToSave()) return;
    if (!isEdit && mode === 'many') {
      setConfirming(true);
      return;
    }
    void save();
  }

  function addAnother() {
    setDirty(false);
    setSuccess(null);
    setAmountRaw('');
    setAmounts({});
    setSelectedIds([]);
    setNote('');
    setShowNote(false);
    setAttempted(false);
    setConfirming(false);
    setMemberId(startingMember);
  }

  const submitLabel = (() => {
    if (loading) return 'Saving…';
    if (isEdit) return amount ? `Update ${formatMoney(singlePaise)} contribution` : 'Update contribution';
    if (mode === 'one') return amount ? `Add ${formatMoney(singlePaise)} contribution` : 'Add contribution';
    if (bulkLines.length === 0) return 'Record contributions';
    const noun = bulkLines.length === 1 ? 'contribution' : 'contributions';
    return `Record ${bulkLines.length} ${noun} · ${formatMoney(bulkTotalPaise)}`;
  })();

  if (success) {
    const single = success.lines.length === 1;
    return (
      <section className="max-w-lg space-y-4">
        <h2 className="font-sans text-2xl font-semibold text-ink">
          {single ? '✓ Contribution added' : '✓ Contributions added'}
        </h2>
        <p className="text-sm text-ink-soft">
          {single
            ? `${success.lines[0].name} contributed ${formatMoney(success.lines[0].amountPaise)} to the Pot.`
            : `${success.lines.length} members contributed ${formatMoney(success.totalPaise)} to the Pot.`}
        </p>
        {!single ? (
          <ul className="divide-y divide-line text-sm">
            {success.lines.map((line) => (
              <li key={`${line.name}-${line.amountPaise}`} className="flex justify-between gap-4 py-2">
                <span className="text-ink">{line.name}</span>
                <span className="font-medium text-ink">{formatMoney(line.amountPaise)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <p className="text-sm text-ink-soft">Pool balance</p>
          <p className="font-money text-3xl font-bold text-accent">{formatMoney(success.poolAfterPaise)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={returnTo}>Done</ButtonLink>
          <Button type="button" variant="outline" onClick={addAnother}>
            Add another
          </Button>
        </div>
      </section>
    );
  }

  if (confirming) {
    return (
      <section className="max-w-lg space-y-4">
        <h2 className="font-sans text-2xl font-semibold text-ink">Record these contributions?</h2>
        <ul className="divide-y divide-line text-sm">
          {bulkLines.map((line) => (
            <li key={line.member.id} className="flex justify-between gap-4 py-2">
              <span className="text-ink">{line.member.name}</span>
              <span className="font-medium text-ink">{formatMoney(toPaise(line.rupees))}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Total</dt>
            <dd className="font-medium text-ink">{formatMoney(bulkTotalPaise)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Received as</dt>
            <dd className="font-medium text-ink">{receivedVia === 'cash' ? 'Cash' : 'Online'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Added to</dt>
            <dd className="font-medium text-ink">{account?.name ?? '—'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={loading}>
            {loading ? 'Saving…' : `Record ${formatMoney(bulkTotalPaise)}`}
          </Button>
        </div>
      </section>
    );
  }

  const filtered = active.filter((member) => member.name.toLowerCase().includes(memberQuery.trim().toLowerCase()));
  const wide = !isEdit && mode === 'many';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-2xl font-semibold text-ink">
          {isEdit ? 'Edit contribution' : mode === 'one' ? 'Add money to the Pot' : 'Record multiple contributions'}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {isEdit
            ? 'Update who paid and how much was received.'
            : mode === 'one'
              ? 'Record money received from a member.'
              : 'Record money received from several members at once.'}
        </p>
      </div>

      {!isEdit ? (
        <fieldset>
          <legend className="text-sm font-medium text-ink">How would you like to record contributions?</legend>
          <Segmented
            value={mode}
            onChange={(next) => {
              setMode(next);
              setAttempted(false);
              setConfirming(false);
            }}
            options={[
              { value: 'one', label: 'One member' },
              { value: 'many', label: 'Multiple members' },
            ]}
          />
        </fieldset>
      ) : null}

      <form onSubmit={onSubmit} onChange={() => setDirty(true)} className={cn('grid items-start gap-8', wide ? 'lg:grid-cols-[minmax(0,42rem)_18rem]' : 'lg:grid-cols-[minmax(0,36rem)_17.5rem]')}>
        <div className="space-y-6">
          {isEdit || mode === 'one' ? (
            <>
              <MemberPicker members={active} value={memberId} onChange={setMemberId} error={oneMemberError} />
              <AmountField id="amount" label="Amount" value={amountRaw} onChange={setAmountRaw} error={oneAmountError} />
            </>
          ) : (
            <>
              <fieldset>
                <legend className="text-sm font-medium text-ink">How much did they contribute?</legend>
                <Segmented
                  value={amountStyle}
                  onChange={switchAmountStyle}
                  options={[
                    { value: 'same', label: 'Same amount' },
                    { value: 'different', label: 'Different amounts' },
                  ]}
                />
              </fieldset>
              {amountStyle === 'same' ? (
                <AmountField
                  id="amount-each"
                  label="Amount per member"
                  value={amountRaw}
                  onChange={setAmountRaw}
                  error={sameAmountError}
                />
              ) : null}
              <div>
                <Label htmlFor="member-search">{amountStyle === 'same' ? 'Who paid?' : 'Record contributions'}</Label>
                <Input
                  id="member-search"
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder="Search members..."
                  autoComplete="off"
                  aria-label="Search members"
                />
                {amountStyle === 'same' ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={selectAll}>
                      {selectedIds.length === active.length ? 'Clear' : 'Select all'}
                    </button>
                    <p className="text-sm text-ink-soft">
                      Selected: {selectedIds.length} {selectedIds.length === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ink-soft">
                    {differentRows.length} {differentRows.length === 1 ? 'contribution' : 'contributions'}
                    {bulkTotalPaise > 0 ? ` · ${formatMoney(bulkTotalPaise)} total` : ''}
                  </p>
                )}
                <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-surface">
                  {filtered.length === 0 ? (
                    <li className="px-3 py-4 text-sm text-ink-soft">No members match that search.</li>
                  ) : (
                    filtered.map((member) =>
                      amountStyle === 'same' ? (
                        <li key={member.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-sunk/60">
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--color-accent)]"
                              checked={selectedIds.includes(member.id)}
                              onChange={() => toggleMember(member.id)}
                            />
                            <MemberFace member={member} />
                          </label>
                        </li>
                      ) : (
                        <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                          <MemberFace member={member} />
                          <div className="relative w-32 shrink-0">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₹</span>
                            <Input
                              inputMode="decimal"
                              aria-label={`Amount from ${member.name}`}
                              value={amounts[member.id] ?? ''}
                              onChange={(event) => setAmounts((current) => ({ ...current, [member.id]: event.target.value }))}
                              className="pl-7"
                              placeholder="0"
                            />
                          </div>
                        </li>
                      ),
                    )
                  )}
                </ul>
                {samePeopleError ? <FieldError>{samePeopleError}</FieldError> : null}
                {differentError ? <FieldError>{differentError}</FieldError> : null}
              </div>
            </>
          )}

          <ReceivedAs
            via={receivedVia}
            onChange={chooseVia}
            accountName={account?.name}
            accounts={activeAccounts}
            accountId={account?.id ?? ''}
            changing={changingAccount}
            onToggleChange={() => setChangingAccount((open) => !open)}
            onAccount={(id) => {
              setPoolAccountId(id);
              setChangingAccount(false);
            }}
            error={accountError}
          />

          <OptionalDetails
            open={showMore}
            onToggle={() => setShowMore((open) => !open)}
            date={date}
            changingDate={changingDate || date !== todayISO()}
            onEditDate={() => setChangingDate(true)}
            onDate={setDate}
            showNote={showNote}
            onShowNote={() => setShowNote(true)}
            note={note}
            onNote={setNote}
          />

        </div>

        <aside className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Contribution summary</h3>
          {isEdit || mode === 'one' ? (
            <SingleSummary
              name={active.find((member) => member.id === memberId)?.name}
              amountPaise={singlePaise}
              poolAfter={poolAfter}
            />
          ) : (
            <BulkSummary
              style={amountStyle}
              count={bulkLines.length}
              eachPaise={amountStyle === 'same' ? singlePaise : 0}
              totalPaise={bulkTotalPaise}
              poolAfter={poolAfter}
            />
          )}
        </aside>
        <div className="lg:col-start-1">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {submitLabel}
            </Button>
            <CancelLink href={returnTo} dirty={dirty}>
              Cancel
            </CancelLink>
          </div>
        </div>
      </form>
    </div>
  );
}

function SingleSummary({ name, amountPaise, poolAfter }: { name?: string; amountPaise: number; poolAfter: number }) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-ink">{name ?? 'No member yet'}</span>
        <span className="font-medium text-ink">{amountPaise > 0 ? formatMoney(amountPaise) : '—'}</span>
      </div>
      <div>
        <p className="text-ink-soft">Pool after contribution</p>
        <p className="font-money text-2xl font-bold text-accent">{formatMoney(poolAfter)}</p>
      </div>
    </div>
  );
}

function BulkSummary({
  style,
  count,
  eachPaise,
  totalPaise,
  poolAfter,
}: {
  style: AmountStyle;
  count: number;
  eachPaise: number;
  totalPaise: number;
  poolAfter: number;
}) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-ink">
        {count} {count === 1 ? 'member' : 'members'}
        {style === 'same' && eachPaise > 0 ? ` · ${formatMoney(eachPaise)} each` : ''}
      </p>
      <div>
        <p className="text-ink-soft">Total</p>
        <p className="font-money text-2xl font-bold text-ink">{formatMoney(totalPaise)}</p>
      </div>
      <div>
        <p className="text-ink-soft">Pool after contribution</p>
        <p className="font-money font-semibold text-accent">{formatMoney(poolAfter)}</p>
      </div>
    </div>
  );
}

function MemberFace({ member }: { member: Member }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
        {initials(member.name)}
      </span>
      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{member.name}</span>
        {!member.userId ? <span className="block text-xs text-ink-soft">Unlinked</span> : null}
      </span>
    </span>
  );
}

function MemberPicker({
  members,
  value,
  onChange,
  error,
}: {
  members: Member[];
  value: string;
  onChange: (id: string) => void;
  error: string | null;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = members.find((member) => member.id === value);
  const filtered = useMemo(
    () => members.filter((member) => member.name.toLowerCase().includes(query.trim().toLowerCase())),
    [members, query],
  );

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && filtered[highlight]) {
      event.preventDefault();
      choose(filtered[highlight].id);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Label id={`${listId}-label`}>Who paid?</Label>
      {open ? (
        <Input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-labelledby={`${listId}-label`}
          aria-activedescendant={filtered[highlight] ? `${listId}-${filtered[highlight].id}` : undefined}
          placeholder="Search member..."
          value={query}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKey}
        />
      ) : (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={false}
          aria-labelledby={`${listId}-label`}
          onClick={() => {
            setQuery('');
            setHighlight(0);
            setOpen(true);
          }}
          className="flex h-11 w-full items-center justify-between rounded-[var(--radius-md)] border border-line bg-surface px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className={selected ? 'text-ink' : 'text-ink-soft'}>{selected?.name ?? 'Search member...'}</span>
          <span aria-hidden className="text-ink-soft">▾</span>
        </button>
      )}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={`${listId}-label`}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[var(--radius-md)] border border-line bg-surface p-1 shadow-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-ink-soft">No members match that search.</li>
          ) : (
            filtered.map((member, index) => (
              <li key={member.id} id={`${listId}-${member.id}`} role="option" aria-selected={member.id === value}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center rounded-[var(--radius-sm)] px-2 py-2 text-left hover:bg-surface-sunk',
                    index === highlight && 'bg-surface-sunk',
                  )}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(member.id)}
                >
                  <MemberFace member={member} />
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

function AmountField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">₹</span>
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pl-7"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

function ReceivedAs({
  via,
  onChange,
  accountName,
  accounts,
  accountId,
  changing,
  onToggleChange,
  onAccount,
  error,
}: {
  via: ReceivedVia;
  onChange: (via: ReceivedVia) => void;
  accountName?: string;
  accounts: PoolAccount[];
  accountId: string;
  changing: boolean;
  onToggleChange: () => void;
  onAccount: (id: string) => void;
  error: string | null;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">Received as</legend>
      <div className="mt-1.5 flex gap-2">
        {(['online', 'cash'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={via === option}
            onClick={() => onChange(option)}
            className={cn(
              'h-11 flex-1 rounded-[var(--radius-md)] border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              via === option ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink',
            )}
          >
            {option === 'online' ? 'Online' : 'Cash'}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Added to <span className="font-medium text-ink">{accountName ?? 'a pool account'}</span>
      </p>
      {accounts.length > 1 ? (
        changing ? (
          <select
            aria-label="Pool account"
            className="mt-2 flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
            value={accountId}
            onChange={(event) => onAccount(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        ) : (
          <button type="button" className="mt-1 text-sm font-medium text-accent hover:underline" onClick={onToggleChange}>
            Change account
          </button>
        )
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </fieldset>
  );
}

function OptionalDetails({
  open,
  onToggle,
  date,
  changingDate,
  onEditDate,
  onDate,
  showNote,
  onShowNote,
  note,
  onNote,
}: {
  open: boolean;
  onToggle: () => void;
  date: string;
  changingDate: boolean;
  onEditDate: () => void;
  onDate: (value: string) => void;
  showNote: boolean;
  onShowNote: () => void;
  note: string;
  onNote: (value: string) => void;
}) {
  return (
    <div>
      <button type="button" className="text-sm font-medium text-accent hover:underline" aria-expanded={open} onClick={onToggle}>
        {open ? 'Hide details' : '+ More details'}
      </button>
      {open ? (
        <div className="mt-3 space-y-4">
          <div>
            <Label htmlFor="contribution-date">Date</Label>
            {changingDate ? (
              <Input id="contribution-date" type="date" value={date} onChange={(event) => onDate(event.target.value)} required />
            ) : (
              <p className="text-sm text-ink">
                {date === todayISO() ? 'Today' : formatDate(date)}{' '}
                <button type="button" className="font-medium text-accent hover:underline" onClick={onEditDate}>
                  Change
                </button>
              </p>
            )}
          </div>
          {showNote ? (
            <div>
              <Label htmlFor="contribution-note">Note</Label>
              <Textarea id="contribution-note" value={note} onChange={(event) => onNote(event.target.value)} rows={2} />
            </div>
          ) : (
            <button type="button" className="text-sm font-medium text-ink-soft hover:text-ink hover:underline" onClick={onShowNote}>
              + Add note
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="mt-1.5 flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-11 flex-1 rounded-[var(--radius-md)] border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            value === option.value ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FieldError({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-neg" role="alert">
      {children}
    </p>
  );
}
