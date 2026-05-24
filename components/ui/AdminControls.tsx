import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Search } from 'lucide-react-native';

export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function MetricCard({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'good' | 'warn' | 'danger' }) {
  const color = tone === 'good' ? '#067647' : tone === 'warn' ? '#b54708' : tone === 'danger' ? '#b42318' : '#101828';
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}) {
  const style = variant === 'danger' ? styles.buttonDanger : variant === 'secondary' ? styles.buttonSecondary : styles.buttonPrimary;
  const textStyle = variant === 'secondary' ? styles.buttonSecondaryText : styles.buttonPrimaryText;

  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.button, style, (disabled || loading) && styles.disabled]}>
      {loading ? <ActivityIndicator color={variant === 'secondary' ? '#344054' : '#ffffff'} /> : icon}
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function SearchField({ value, onChangeText, placeholder = 'Buscar' }: { value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  return (
    <View style={styles.searchBox}>
      <Search size={16} color="#667085" />
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.slice(0, 120))}
        placeholder={placeholder}
        placeholderTextColor="#98a2b3"
        style={styles.searchInput}
      />
    </View>
  );
}

export function DateInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.slice(0, 10))}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#98a2b3"
        style={styles.fieldInput}
      />
    </View>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentRoot}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }) {
  const palette = {
    good: ['#ecfdf3', '#067647'],
    warn: ['#fffaeb', '#b54708'],
    danger: ['#fef3f2', '#b42318'],
    neutral: ['#f2f4f7', '#344054'],
  } as const;
  const [backgroundColor, color] = palette[tone];

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function DataTable({
  columns,
  rows,
  keyExtractor,
}: {
  columns: { key: string; label: string; width?: number; flex?: number }[];
  rows: Record<string, ReactNode>[];
  keyExtractor: (row: Record<string, ReactNode>, index: number) => string;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {columns.map((column) => (
          <Text key={column.key} style={[styles.th, { width: column.width, flex: column.flex }]}>
            {column.label}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={keyExtractor(row, index)} testID={`row-${index}`} style={styles.tableRow}>
          {columns.map((column) => (
            <View key={column.key} style={[styles.td, { width: column.width, flex: column.flex }]}>
              {typeof row[column.key] === 'string' || typeof row[column.key] === 'number' ? (
                <Text style={styles.tdText} numberOfLines={2}>
                  {row[column.key]}
                </Text>
              ) : (
                row[column.key]
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color="#101828" />
      <Text style={styles.loadingText}>Carregando</Text>
    </View>
  );
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <View style={styles.pagination}>
      <Text style={styles.paginationText}>
        Página {page} de {maxPage} · {total} registros
      </Text>
      <View style={styles.paginationActions}>
        <ActionButton label="Anterior" variant="secondary" disabled={page <= 1} onPress={() => onPageChange(page - 1)} />
        <ActionButton label="Próxima" variant="secondary" disabled={page >= maxPage} onPress={() => onPageChange(page + 1)} />
      </View>
    </View>
  );
}

export function MiniBarChart({ values }: { values: { label: string; value: number }[] }) {
  const width = 480;
  const height = 150;
  const max = Math.max(1, ...values.map((item) => item.value));
  const barWidth = Math.max(12, (width - 32) / Math.max(values.length, 1) - 5);

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {values.map((item, index) => {
          const barHeight = Math.max(2, (item.value / max) * 102);
          const x = 16 + index * (barWidth + 5);
          const y = 118 - barHeight;
          return <Rect key={`${item.label}-${index}`} x={x} y={y} width={barWidth} height={barHeight} rx={3} fill="#344054" />;
        })}
      </Svg>
      <View style={styles.chartLabels}>
        {values.slice(0, 8).map((item) => (
          <Text key={item.label} style={styles.chartLabel}>
            {item.label.slice(5)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '800',
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 8,
  },
  metricLabel: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  button: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: '#101828',
  },
  buttonDanger: {
    backgroundColor: '#b42318',
  },
  buttonSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  buttonSecondaryText: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
  searchBox: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 220,
  },
  searchInput: {
    flex: 1,
    color: '#101828',
    fontSize: 14,
    fontWeight: '600',
    outlineStyle: 'none' as never,
  },
  fieldBlock: {
    gap: 5,
    minWidth: 132,
  },
  fieldLabel: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  fieldInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#101828',
    fontSize: 13,
    fontWeight: '700',
    outlineStyle: 'none' as never,
  },
  segmentRoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segment: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  segmentActive: {
    backgroundColor: '#101828',
    borderColor: '#101828',
  },
  segmentText: {
    color: '#344054',
    fontSize: 12,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  table: {
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#eaecf0',
  },
  th: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableRow: {
    minHeight: 54,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
    backgroundColor: '#ffffff',
  },
  td: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  tdText: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 6,
  },
  emptyTitle: {
    color: '#101828',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyBody: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '600',
  },
  loading: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
  },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  paginationText: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
  },
  paginationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chartWrap: {
    gap: 8,
  },
  chartLabels: {
    flexDirection: 'row',
    gap: 8,
  },
  chartLabel: {
    flex: 1,
    color: '#667085',
    fontSize: 10,
    fontWeight: '700',
  },
});
