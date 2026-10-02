import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/potto/AmountInput';
import { Button, PrimaryButton } from '@/components/potto/Button';
import { Chip } from '@/components/potto/Chip';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { getActiveCategories } from '@/logic/categories';
import { canEditPot } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import { toPaise, toRupees } from '@/utils/money';

export default function PotSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getCurrentMember, updatePotDetails, archivePot, getPoolManagerMemberId, assignPoolManager, getCategories } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const me = getCurrentMember(id);

  const [name, setName] = useState(pot?.name ?? '');
  const [description, setDescription] = useState(pot?.description ?? '');
  const [expectedContribution, setExpectedContribution] = useState(
    pot?.expectedContributionPerMember ? String(toRupees(pot.expectedContributionPerMember)) : '',
  );
  const [confirmArchiveVisible, setConfirmArchiveVisible] = useState(false);
  const managerId = getPoolManagerMemberId(id);
  const manager = pot?.members.find((m) => m.id === managerId);
  const [nextManager, setNextManager] = useState(managerId ?? '');
  const activeCategoryCount = getActiveCategories(getCategories(id)).length;

  if (!pot) return null;

  if (!canEditPot(me)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Pot Settings" onBack={() => router.back()} />
        <View style={styles.scroll}>
          <Text style={[styles.label, { color: colors.inkSoft }]}>POOL MANAGER</Text>
          <Text style={{ color: colors.ink, fontSize: 16 }}>{manager?.name ?? 'Not assigned'}</Text>
          <Text style={{ color: colors.inkSoft, marginTop: 8 }}>Pool Bank and Pool Cash hold this pot&apos;s money.</Text>
          <CategoriesLink potId={id} count={activeCategoryCount} />
          <ShareLink potId={id} />
        </View>
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
        <Field label="Expected contribution per member">
          <AmountInput value={expectedContribution} onChangeText={setExpectedContribution} />
          <Text style={[styles.hint, { color: colors.inkSoft }]}>
            Optional target for the group. It does not require every member to contribute this amount.
          </Text>
        </Field>
        <View style={styles.actions}>
          <PrimaryButton label="Save Changes" onPress={saveDetails} fullWidth disabled={!name.trim()} />
        </View>

        <CategoriesLink potId={id} count={activeCategoryCount} />
        <ShareLink potId={id} />

        <View style={{ marginTop: 24 }}>
          <Text style={[styles.label, { color: colors.inkSoft }]}>POOL MANAGEMENT</Text>
          <Text style={{ color: colors.ink, marginBottom: 8 }}>
            Who is managing the pool? {manager?.name ?? 'Not assigned'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {pot.members.filter((m) => m.status === 'active').map((m) => (
              <Chip key={m.id} label={m.name} selected={nextManager === m.id} onPress={() => setNextManager(m.id)} />
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            <Button
              label="Change pool manager"
              variant="secondary"
              onPress={async () => {
                try {
                  await assignPoolManager(pot.id, nextManager);
                  showToast('Pool manager updated');
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Could not update pool manager');
                }
              }}
            />
          </View>
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

/** Entry point to the Categories screen. Everyone can open it; only admins can change anything there. */
function CategoriesLink({ potId, count }: { potId: string; count: number }) {
  const colors = usePottoColors();
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>CATEGORIES</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/pot/${potId}/categories`)}
        style={[styles.linkRow, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>Categories</Text>
          <Text style={{ color: colors.inkSoft, fontSize: 12.5, marginTop: 2 }}>
            {count} active · Customize how expenses are organized
          </Text>
        </View>
        <Text style={{ color: colors.inkSoft, fontSize: 18 }}>{'›'}</Text>
      </Pressable>
    </View>
  );
}

/** Entry point to the Share Pot screen: the public read-only link. Everyone can open it; only admins can change it. */
function ShareLink({ potId }: { potId: string }) {
  const colors = usePottoColors();
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>SHARING</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/pot/${potId}/share`)}
        style={[styles.linkRow, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>Public link</Text>
          <Text style={{ color: colors.inkSoft, fontSize: 12.5, marginTop: 2 }}>
            Let anyone view this pot, read-only, without joining
          </Text>
        </View>
        <Text style={{ color: colors.inkSoft, fontSize: 18 }}>{'›'}</Text>
      </Pressable>
    </View>
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
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1, minHeight: 56 },
  actions: { paddingTop: 8 },
  dangerZone: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, gap: 12 },
  dangerLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6 },
  dangerHelp: { fontSize: 12, lineHeight: 17 },
});
