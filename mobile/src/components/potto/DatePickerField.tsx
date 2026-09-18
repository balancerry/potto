import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, usePottoColors } from '@/constants/potto-theme';
import { formatDateFull } from '@/utils/money';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month: month - 1, day };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface DatePickerFieldProps {
  value: string; // ISO "YYYY-MM-DD"
  onChange: (iso: string) => void;
}

export function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const colors = usePottoColors();
  const [visible, setVisible] = useState(false);
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);

  const open = () => {
    const base = parseISO(value || todayISO());
    setViewYear(base.year);
    setViewMonth(base.month);
    setVisible(true);
  };

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const selectDay = (day: number) => {
    onChange(toISO(viewYear, viewMonth, day));
    setVisible(false);
  };

  const today = todayISO();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const cells: (number | null)[] = [];
  const lead = firstWeekdayOfMonth(viewYear, viewMonth);
  for (let i = 0; i < lead; i += 1) cells.push(null);
  const total = daysInMonth(viewYear, viewMonth);
  for (let d = 1; d <= total; d += 1) cells.push(d);

  return (
    <>
      <Pressable
        onPress={open}
        style={[styles.trigger, { borderColor: colors.line, backgroundColor: colors.surfaceSunk }]}>
        <Text style={{ color: colors.ink, fontSize: 15 }}>{formatDateFull(value || today)}</Text>
        <Text style={{ fontSize: 16 }}>{'📅'}</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={styles.navRow}>
              <Pressable
                onPress={() => shiftMonth(-1)}
                style={[styles.navBtn, { borderColor: colors.line, backgroundColor: colors.surfaceSunk }]}>
                <Text style={{ color: colors.ink, fontSize: 16 }}>{'‹'}</Text>
              </Pressable>
              <Text style={[styles.monthLabel, { color: colors.ink }]}>{monthLabel}</Text>
              <Pressable
                onPress={() => shiftMonth(1)}
                style={[styles.navBtn, { borderColor: colors.line, backgroundColor: colors.surfaceSunk }]}>
                <Text style={{ color: colors.ink, fontSize: 16 }}>{'›'}</Text>
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={[styles.weekday, { color: colors.inkSoft }]}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={`e${i}`} style={styles.cell} />;
                const iso = toISO(viewYear, viewMonth, day);
                const selected = iso === value;
                const isToday = iso === today;
                return (
                  <Pressable key={iso} onPress={() => selectDay(day)} style={styles.cell}>
                    <View
                      style={[
                        styles.dayCircle,
                        selected
                          ? { backgroundColor: colors.ink }
                          : isToday
                            ? { borderWidth: 1, borderColor: colors.accent }
                            : null,
                      ]}>
                      <Text style={{ color: selected ? colors.paper : colors.ink, fontSize: 14, fontWeight: selected ? '700' : '500' }}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => {
                onChange(today);
                setVisible(false);
              }}
              style={[styles.todayBtn, { borderColor: colors.line }]}>
              <Text style={{ color: colors.accent, fontSize: 13.5, fontWeight: '600' }}>Today</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,14,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: 18,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 15.5, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  todayBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1 },
});
