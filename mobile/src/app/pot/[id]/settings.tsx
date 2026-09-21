import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/potto/AmountInput';
import { Button, PrimaryButton } from '@/components/potto/Button';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { canEditPot } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import { toPaise, toRupees } from '@/utils/money';

export default function PotSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getCurrentMember, updatePotDetails, archivePot } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const me = getCurrentMember(id);

  const [name, setName] = useState(pot?.name ?? '');
  const [description, setDescription] = useState(pot?.description ?? '');
  const [expectedContribution, setExpectedContribution] = useState(
    pot?.expectedContributionPerMember ? String(toRupees(pot.expectedContributionPerMember)) : '',
  );
  const [confirmArchiveVisible, setConfirmArchiveVisible] = useState(false);

  if (!pot) return null;

  if (!canEditPot(me)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Pot Settings" onBack={() => router.back()} />
        <EmptyState icon="🔒" title="Admins only" subtitle="Only Pot admins can change these settings." />
      </SafeAreaView>
    );
  }

  const saveDetails = async () => {
    if (!name.trim()) return;
    try {
      await updatePotDetails(pot.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        expectedContributionPerMember: expectedContribution.trim()
          ? toPaise(parseFloat(expectedContribution) || 0)
          : null,
      });
      showToast('Pot updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update pot');
    }
  };

  const confirmArchive = async () => {
    try {
      await archivePot(pot.id);
      setConfirmArchiveVisible(false);
      showToast('Pot archived');
      router.replace('/');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not archive pot');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Pot Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Field label="Pot name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.inkSoft}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
          />
        </Field>
        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What's this pot for?"
            placeholderTextColor={colors.inkSoft}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
          />
        </Field>
        <Field label="Expected contribution per member (optional)">
          <AmountInput value={expectedContribution} onChangeText={setExpectedContribution} />
          <Text style={[styles.hint, { color: colors.inkSoft }]}>
            Used only to flag who’s below the target on the Contributions tab — never affects balances or settlement. Leave blank to remove it.
          </Text>
        </Field>
        <View style={styles.actions}>
          <PrimaryButton label="Save Changes" onPress={saveDetails} fullWidth disabled={!name.trim()} />
        </View>

        <View style={[styles.dangerZone, { borderTopColor: colors.line }]}>
          <Text style={[styles.dangerLabel, { color: colors.inkSoft }]}>DANGER ZONE</Text>
          <Button label="Archive Pot" onPress={() => setConfirmArchiveVisible(true)} variant="danger" fullWidth />
          <Text style={[styles.dangerHelp, { color: colors.inkSoft }]}>
            Archiving stops new invites and edits but keeps all history. This can be reversed by contacting support in a future version.
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmArchiveVisible}
        title="Archive this Pot?"
        message={`"${pot.name}" will move out of active use. Members will keep read access to its history, but no new activity, invites, or join requests will be accepted.`}
        confirmLabel="Archive"
        destructive
        onConfirm={confirmArchive}
        onCancel={() => setConfirmArchiveVisible(false)}
      />
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
  scroll: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15 },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  actions: { paddingTop: 8 },
  dangerZone: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, gap: 12 },
  dangerLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6 },
  dangerHelp: { fontSize: 12, lineHeight: 17 },
});
