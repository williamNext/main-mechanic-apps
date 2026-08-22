import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Clock3 } from 'lucide-react-native';
import { Mechanic } from '@main-mechanic/types';
import { AppCard } from '@/components/app/AppCard';
import { Avatar } from '@/components/app/Avatar';
import { Badge } from '@/components/app/Badge';
import { FontSize, FontWeight, Spacing , useAppTheme } from '@main-mechanic/theme';

interface MechanicCardProps {
  mechanic: Mechanic;
  onPress?: () => void;
}

export function MechanicCard({ mechanic, onPress }: MechanicCardProps) {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <AppCard style={styles.card}>
        <View style={styles.row}>
          <Avatar name={mechanic.name} size={52} />
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.gray900 }]}>{mechanic.name}</Text>
            <Badge label={mechanic.specialty} />
            <View style={styles.metaRow}>
              <Clock3 size={14} color={colors.success} />
              <Text style={[styles.metaText, { color: colors.success }]}>Disponível</Text>
            </View>
          </View>
          {onPress && (
            <ChevronRight size={20} color={colors.gray400} />
          )}
        </View>
      </AppCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: Spacing.md,
    gap: Spacing.xs,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
