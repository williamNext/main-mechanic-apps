import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Mechanic } from '@/types/models';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface MechanicCardProps {
  mechanic: Mechanic;
  onPress?: () => void;
  showRating?: boolean;
}

export function MechanicCard({ mechanic, onPress, showRating = true }: MechanicCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar name={mechanic.name} imageUrl={mechanic.avatarUrl} size="lg" />
          <View style={styles.info}>
            <Text style={styles.name}>{mechanic.name}</Text>
            <Badge label={mechanic.specialty} />
            {showRating && mechanic.rating != null && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={Colors.warning} />
                <Text style={styles.rating}>{mechanic.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>
          {onPress && (
            <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
          )}
        </View>
      </Card>
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
    color: Colors.gray900,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.gray600,
  },
});
