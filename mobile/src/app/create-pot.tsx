import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/potto/AmountInput';
import { PrimaryButton } from '@/components/potto/Button';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { usePottoStore } from '@/store/PottoStore';
import { toPaise } from '@/utils/money';

export default function CreatePotScreen() {
  const colors = usePottoColors();
  const { createPot } = usePottoStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [membersText, setMembersText] = useState('');
  const [contribution, setContribution] = useState('');
  const [expectedContribution, setExpectedContribution] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a pot name');
      return;
    }
    const memberNames = membersText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const potId = createPot({
      name: trimmed,
      description: description.trim() || undefined,
      memberNames,
      startingContribution: contribution ? toPaise(parseFloat(contribution) || 0) : undefined,
      expectedContributionPerMember: expectedContribution ? toPaise(parseFloat(expectedContribution) || 0) : undefined,
    });
    router.replace(`/pot/${potId}`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Create Pot" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Pot name">
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (v.trim()) setNameError(undefined);
              }}
              placeholder="e.g. Goa 2026"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: nameError ? colors.neg : colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
            {!!nameError && <Text style={[styles.error, { color: colors.neg }]}>{nameError}</Text>}
          </Field>

          <Field label="Description (optional)">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What's this pot for?"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </Field>

          <Field label="Members (comma separated, optional)">
            <TextInput
              value={membersText}
              onChangeText={setMembersText}
              placeholder="Amit, Neha, Karan"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </Field>

          <Field label="Your starting contribution (optional)">
            <AmountInput value={contribution} onChangeText={setContribution} />
          </Field>

          <Field label="Expected contribution per member (optional)">
            <AmountInput value={expectedContribution} onChangeText={setExpectedContribution} />
            <Text style={[styles.hint, { color: colors.inkSoft }]}>
              Used only to flag who’s below the target on the Contributions tab — never affects balances or settlement.
            </Text>
          </Field>

          <View style={styles.actions}>
            <PrimaryButton label="Create Pot" onPress={submit} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = usePottoColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15 },
  error: { fontSize: 12, marginTop: 5 },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  actions: { paddingTop: 8 },
});
