import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SecondaryButton } from '@/components/potto/Button';
import { PottoFonts, usePottoColors } from '@/constants/potto-theme';
import { usePottoStore } from '@/store/PottoStore';

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

  for (const person of splitMemberNames(incoming)) {
    if (person.length > MEMBER_NAME_LIMIT) {
      tooLong = true;
      continue;
    }
    const key = memberKey(person);
    if (creatorKey && key === creatorKey) {
      includesCreator = true;
      continue;
    }
    if (keys.has(key)) {
      duplicates.push(person);
      continue;
    }
    keys.add(key);
    next.push(person);
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

export default function CreatePotScreen() {
  const colors = usePottoColors();
  const { createPot, state } = usePottoStore();
  const creatorName = state.currentUser.name;

  const [name, setName] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [peopleNotice, setPeopleNotice] = useState<string | undefined>();
  const [purpose, setPurpose] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && trimmedName.length <= NAME_LIMIT && !submitting;

  const submit = async () => {
    if (!trimmedName) {
      setNameError('Enter a pot name');
      return;
    }
    if (trimmedName.length > NAME_LIMIT) {
      setNameError(`Use ${NAME_LIMIT} characters or fewer`);
      return;
    }
    const pending = draft.trim() ? addMemberNames(people, draft, creatorName) : { next: people, notice: null };
    if (draft.trim()) {
      setPeople(pending.next);
      setPeopleNotice(pending.notice ?? undefined);
      setDraft('');
    }
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const potId = await createPot({
        name: trimmedName,
        description: composeDescription(purpose, description),
        memberNames: pending.next,
      });
      router.replace(`/pot/${potId}`);
    } catch {
      setSubmitError("We couldn't create this Pot. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to your pots"
            onPress={() => router.replace('/')}
            style={styles.back}>
            <Text style={{ color: colors.inkSoft, fontSize: 15, fontWeight: '600' }}>← Your pots</Text>
          </Pressable>

          <Text style={[styles.title, { color: colors.ink, fontFamily: Platform.OS === 'web' ? undefined : PottoFonts.display }]}>
            Create a pot
          </Text>
          <Text style={[styles.support, { color: colors.inkSoft }]}>
            Start a shared space for your trip, event, or group.
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.ink }]}>Pot name *</Text>
            <TextInput
              value={name}
              onChangeText={(value) => {
                setName(value);
                if (value.trim()) setNameError(undefined);
              }}
              onBlur={() => {
                if (!name.trim()) setNameError('Enter a pot name');
              }}
              maxLength={NAME_LIMIT}
              placeholder="Goa Trip 2026"
              placeholderTextColor={colors.inkSoft}
              accessibilityLabel="Pot name"
              style={[
                styles.nameInput,
                {
                  borderColor: nameError ? colors.neg : colors.line,
                  backgroundColor: colors.surface,
                  color: colors.ink,
                },
              ]}
            />
            {!!nameError && <Text style={[styles.error, { color: colors.neg }]}>{nameError}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.ink }]}>Add people</Text>
            <Text style={[styles.help, { color: colors.inkSoft }]}>
              Add the people who belong to this Pot. You can invite them later and link their account when they join.
            </Text>
            <TextInput
              value={draft}
              onChangeText={(value) => {
                if (/[,;\n]/.test(value)) {
                  const parts = value.split(/[,;\n]/);
                  const trailing = parts.pop() ?? '';
                  const result = addMemberNames(people, parts.join(','), creatorName);
                  setPeople(result.next);
                  setPeopleNotice(result.notice ?? undefined);
                  setDraft(trailing.replace(/^\s+/, ''));
                  return;
                }
                setDraft(value);
                if (peopleNotice) setPeopleNotice(undefined);
              }}
              onSubmitEditing={() => {
                if (!draft.trim()) return;
                const result = addMemberNames(people, draft, creatorName);
                setPeople(result.next);
                setPeopleNotice(result.notice ?? undefined);
                setDraft('');
              }}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && draft === '' && people.length > 0) {
                  setPeople(people.slice(0, -1));
                  setPeopleNotice(undefined);
                }
              }}
              blurOnSubmit={false}
              placeholder="Rahul, Akash, Sunil..."
              placeholderTextColor={colors.inkSoft}
              accessibilityLabel="Add people"
              style={[styles.nameInput, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }]}
            />
            {!!peopleNotice && <Text style={[styles.error, { color: colors.neg }]}>{peopleNotice}</Text>}
            {people.length > 0 ? (
              <>
                <View style={[styles.purposes, { marginTop: 10 }]}>
                  {people.map((person) => (
                    <Pressable
                      key={memberKey(person)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${person}`}
                      onPress={() => {
                        setPeople(people.filter((item) => memberKey(item) !== memberKey(person)));
                        setPeopleNotice(undefined);
                      }}
                      style={[styles.personChip, { borderColor: colors.line, backgroundColor: colors.surface }]}>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{person}</Text>
                      <Text style={{ color: colors.inkSoft, fontSize: 16, marginLeft: 6 }}>×</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.count, { color: colors.ink }]}>
                  {people.length} {people.length === 1 ? 'person' : 'people'} will be added · {people.length + 1} people in this Pot
                </Text>
                <Text style={[styles.help, { color: colors.inkSoft, marginTop: 4 }]}>
                  People can join this Pot later. Their Potto account will be linked to their existing member record.
                </Text>
              </>
            ) : null}
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.ink, marginBottom: 0 }]}>What is this Pot for?</Text>
              <Text style={[styles.optional, { color: colors.inkSoft }]}>Optional</Text>
            </View>
            <View style={styles.purposes}>
              {PURPOSES.map((option) => {
                const selected = purpose === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setPurpose(selected ? '' : option)}
                    style={[
                      styles.purpose,
                      {
                        borderColor: selected ? colors.accent : colors.line,
                        backgroundColor: selected ? colors.accentSoft : colors.surface,
                      },
                    ]}>
                    <Text style={{ color: selected ? colors.accent : colors.ink, fontSize: 14, fontWeight: '600' }}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.ink, marginBottom: 0 }]}>Description</Text>
              <Text style={[styles.optional, { color: colors.inkSoft }]}>Optional</Text>
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={NOTE_LIMIT}
              placeholder="Add a short note about this Pot"
              placeholderTextColor={colors.inkSoft}
              multiline
              accessibilityLabel="Description"
              style={[
                styles.noteInput,
                { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink },
              ]}
            />
          </View>

          {!!submitError && <Text style={[styles.error, { color: colors.neg, marginBottom: 12 }]}>{submitError}</Text>}

          <Button
            label={submitting ? 'Creating…' : 'Create pot'}
            onPress={submit}
            variant="accent"
            loading={submitting}
            disabled={!canSubmit}
            fullWidth
          />
          <View style={styles.cancel}>
            <SecondaryButton label="Cancel" onPress={() => router.replace('/')} fullWidth />
          </View>
          <Text style={[styles.reassurance, { color: colors.inkSoft }]}>
            You can invite people and start adding money after creating your Pot.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 32, fontWeight: '700', marginTop: 8 },
  support: { fontSize: 16, lineHeight: 24, marginTop: 8, marginBottom: 24 },
  field: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  optional: { fontSize: 12, fontWeight: '400' },
  nameInput: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, fontSize: 16 },
  noteInput: {
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  purposes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  purpose: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  count: { fontSize: 14, fontWeight: '600', marginTop: 10 },
  personChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  error: { fontSize: 13, marginTop: 6 },
  cancel: { marginTop: 10 },
  reassurance: { fontSize: 14, lineHeight: 20, marginTop: 16 },
});
