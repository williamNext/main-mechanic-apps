import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TimeSlot } from '@/types/models';
import { BorderRadius, FontSize, FontWeight, Spacing, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-theme';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlotId?: string;
  onSelect: (slot: TimeSlot) => void;
}

export function TimeSlotPicker({ slots, selectedSlotId, onSelect }: TimeSlotPickerProps) {
  const { colors, theme } = useAppTheme();
  const availableSlots = slots.filter((s) => s.isAvailable);

  if (availableSlots.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="time-outline" size={32} color={colors.gray300} />
        <Text style={[styles.emptyText, { color: colors.gray400 }]}>Nenhum horário disponível</Text>
      </View>
    );
  }

  // Render as rows of 3 without FlatList (avoids nesting issues)
  const rows: TimeSlot[][] = [];
  for (let i = 0; i < availableSlots.length; i += 3) {
    rows.push(availableSlots.slice(i, i + 3));
  }

  const isDark = theme === 'dark';

  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((item) => {
            const isSelected = item.id === selectedSlotId;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
                style={[
                  styles.slot,
                  { backgroundColor: colors.surface, borderColor: colors.gray200 },
                  isDark ? { borderWidth: 1 } : Shadow.sm,
                  isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
                ]}
              >
                <Text
                  style={[
                    styles.slotText,
                    { color: colors.gray700 },
                    isSelected && { color: colors.primary, fontWeight: FontWeight.bold },
                  ]}
                >
                  {item.startTime.substring(0, 5)} {/* Display only HH:mm */}
                </Text>
              </TouchableOpacity>
            );
          })}
          {/* Fill remaining cells to keep alignment */}
          {row.length < 3 &&
            Array.from({ length: 3 - row.length }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.slotPlaceholder} />
            ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  slot: {
    flex: 1,
    paddingVertical: Spacing.md,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  slotText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  slotPlaceholder: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
});
