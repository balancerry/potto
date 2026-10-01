'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createPot } from '@/lib/actions/pots';
import { Button } from '@/components/ui/button';
import { CancelLink, useWarnUnsaved } from '@/components/navigation/unsaved-changes';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const NAME_LIMIT = 80;
const NOTE_LIMIT = 240;
const MEMBER_NAME_LIMIT = 60;
const PURPOSES = ['Trip', 'Event', 'Group fund', 'Other'] as const;

function normalizeMemberName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function memberKey(name: string): string {
  return normalizeMemberName(name).toLocaleLowerCase();
}

function splitMemberNames(raw: string): string[] {
  return raw.split(/[,;\n]+/).map(normalizeMemberName).filter(Boolean);
}

function addMemberNames(existing: string[], incoming: string, creatorName: string): { next: string[]; notice: string | null } {
  const keys = new Set(existing.map(memberKey));
  const creatorKey = memberKey(creatorName);
  const next = [...existing];
  const duplicates: string[] = [];
  let includesCreator = false;
  let tooLong = false;

  for (const name of splitMemberNames(incoming)) {
    if (name.length > MEMBER_NAME_LIMIT) {
      tooLong = true;
      continue;
    }
    const key = memberKey(name);
    if (creatorKey && key === creatorKey) {
      includesCreator = true;
      continue;
    }
    if (keys.has(key)) {
      duplicates.push(name);
      continue;
    }
    keys.add(key);
    next.push(name);
  }

  let notice: string | null = null;
  if (tooLong) notice = `Use ${MEMBER_NAME_LIMIT} characters or fewer for each name.`;
  else if (includesCreator) notice = "You're already in this Pot as the owner.";
  else if (duplicates.length > 0) notice = `${duplicates[0]} is already added to this Pot.`;

  return { next, notice };
}

function composeDescription(purpose: string, note: string): string | undefined {
  const trimmed = note.trim();
  const purposeNote = purpose && purpose !== 'Other' ? purpose : '';
  const combined = [purposeNote, trimmed].filter(Boolean).join('. ');
  return combined || undefined;
}

export function CreatePotForm({ creatorName }: { creatorName: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [peopleNotice, setPeopleNotice] = useState<string | null>(null);
  const [purpose, setPurpose] = useState('');
  const [description, setDescription] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedName = name.trim();
  const nameError = !trimmedName
    ? 'Enter a pot name'
    : trimmedName.length > NAME_LIMIT
      ? `Use ${NAME_LIMIT} characters or fewer`
      : null;
  const canSubmit = !nameError && !loading;
  const dirty = Boolean(trimmedName || people.length || draft.trim() || purpose || description.trim());
  useWarnUnsaved(dirty && !loading);

  function commitDraft(raw: string) {
    const { next, notice } = addMemberNames(people, raw, creatorName);
    setPeople(next);
    setPeopleNotice(notice);
    return next;
  }

  function onPeopleChange(value: string) {
    if (/[,;\n]/.test(value)) {
      const parts = value.split(/[,;\n]/);
      const trailing = parts.pop() ?? '';
      commitDraft(parts.join(','));
      setDraft(trailing.replace(/^\s+/, ''));
      return;
    }
    setDraft(value);
    if (peopleNotice) setPeopleNotice(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameTouched(true);
    setError(null);
    if (nameError || !trimmedName) return;

    const memberNames = draft.trim() ? commitDraft(draft) : people;
    if (draft.trim()) setDraft('');

    setLoading(true);
    const result = await createPot({
      name: trimmedName,
      description: composeDescription(purpose, description),
      memberNames,
    });
    setLoading(false);

    if (!result.ok) {
      setError("We couldn't create this Pot. Please try again.");
      return;
    }
    toast.success('Pot created');
    router.push(`/pots/${result.data.potId}`);
  }

  const potSize = people.length + 1;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div>
        <Label htmlFor="name" className="font-semibold">
          Pot name *
        </Label>
        <Input
          id="name"
          required
          value={name}
          maxLength={NAME_LIMIT}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onBlur={() => setNameTouched(true)}
          placeholder="Goa Trip 2026"
          autoFocus
          autoComplete="off"
          aria-invalid={nameTouched && !!nameError}
          aria-describedby={nameTouched && nameError ? 'name-error' : undefined}
          className="h-12 text-base"
        />
        {nameTouched && nameError ? (
          <p id="name-error" className="mt-1.5 text-sm text-neg">
            {nameError}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="people" className="font-semibold">
          Add people
        </Label>
        <p id="people-help" className="mb-2 text-sm text-ink-soft">
          Add the people who belong to this Pot. You can invite them later and link their account when they join.
        </p>
        <Input
          id="people"
          value={draft}
          onChange={(e) => onPeopleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (draft.trim()) {
                commitDraft(draft);
                setDraft('');
              }
            } else if (e.key === 'Backspace' && draft === '' && people.length > 0) {
              setPeople(people.slice(0, -1));
              setPeopleNotice(null);
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              commitDraft(draft);
              setDraft('');
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (/[,;\n]/.test(text)) {
              e.preventDefault();
              commitDraft(`${draft}${text}`);
              setDraft('');
            }
          }}
          placeholder="Rahul, Akash, Sunil..."
          autoComplete="off"
          aria-describedby="people-help people-count"
          className="h-12 text-base"
        />
        {peopleNotice ? (
          <p role="status" className="mt-1.5 text-sm text-neg">
            {peopleNotice}
          </p>
        ) : null}
        {people.length > 0 ? (
          <>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="People who will be added">
              {people.map((person) => (
                <li key={memberKey(person)}>
                  <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 font-sans text-sm font-medium text-ink">
                    {person}
                    <button
                      type="button"
                      aria-label={`Remove ${person}`}
                      onClick={() => {
                        setPeople(people.filter((item) => memberKey(item) !== memberKey(person)));
                        setPeopleNotice(null);
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p id="people-count" className="mt-2 text-sm font-medium text-ink">
              {people.length} {people.length === 1 ? 'person' : 'people'} will be added · {potSize} people in this Pot
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              People can join this Pot later. Their Potto account will be linked to their existing member record.
            </p>
          </>
        ) : (
          <p id="people-count" className="sr-only">
            No additional people yet. You will be added as the owner.
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p id="purpose-label" className="font-sans text-sm font-medium text-ink">
            What is this Pot for?
          </p>
          <span className="text-xs text-ink-soft">Optional</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="purpose-label">
          {PURPOSES.map((option) => {
            const selected = purpose === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setPurpose(selected ? '' : option)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border px-4 font-sans text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  selected
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink hover:bg-surface-sunk',
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <Label htmlFor="description" className="mb-0">
            Description
          </Label>
          <span className="text-xs text-ink-soft">Optional</span>
        </div>
        <Textarea
          id="description"
          value={description}
          maxLength={NOTE_LIMIT}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a short note about this Pot"
          rows={2}
          className="min-h-16"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-neg">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
          {loading ? 'Creating…' : 'Create pot'}
        </Button>
        <CancelLink href="/" dirty={dirty} className="w-full sm:w-auto">
          Cancel
        </CancelLink>
      </div>
      <p className="text-sm text-ink-soft">You can invite people and start adding money after creating your Pot.</p>
    </form>
  );
}
