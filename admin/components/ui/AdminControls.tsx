import { ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { addDays, addMonths, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateDisplay, parseISODateSafe, toISODate } from '@/utils/date';

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
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  testID?: string;
}) {
  const style = variant === 'danger' ? styles.buttonDanger : variant === 'secondary' ? styles.buttonSecondary : styles.buttonPrimary;
  const textStyle = variant === 'secondary' ? styles.buttonSecondaryText : styles.buttonPrimaryText;

  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled || loading} style={[styles.button, style, (disabled || loading) && styles.disabled]}>
      {loading ? <ActivityIndicator color={variant === 'secondary' ? '#344054' : '#ffffff'} /> : icon}
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Buscar',
  onSubmitEditing,
  testID,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Search size={16} color="#667085" />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={(text) => onChangeText(text.slice(0, 120))}
        placeholder={placeholder}
        placeholderTextColor="#98a2b3"
        style={styles.searchInput}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

export function CalendarDateInput({ label, value, onChangeDate }: { label: string; value: string; onChangeDate: (value: string) => void }) {
  const selectedDate = parseISODateSafe(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? new Date());
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth));
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [visibleMonth]);
  const monthLabel = format(visibleMonth, 'MMMM yyyy', { locale: ptBR });

  const openCalendar = () => {
    setVisibleMonth(selectedDate ?? new Date());
    setOpen(true);
  };

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={openCalendar} style={styles.fieldButton}>
        <CalendarDays size={15} color="#667085" />
        <Text style={[styles.fieldButtonText, !selectedDate && styles.fieldPlaceholder]}>{formatDateDisplay(value) || 'dd/mm/aaaa'}</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.calendarBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Pressable accessibilityRole="button" onPress={() => setVisibleMonth((current) => subMonths(current, 1))} style={styles.calendarNavButton}>
                <ChevronLeft size={18} color="#344054" />
              </Pressable>
              <Text style={styles.calendarTitle}>{monthLabel}</Text>
              <Pressable accessibilityRole="button" onPress={() => setVisibleMonth((current) => addMonths(current, 1))} style={styles.calendarNavButton}>
                <ChevronRight size={18} color="#344054" />
              </Pressable>
            </View>
            <View style={styles.calendarWeekRow}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => (
                <Text key={day} style={styles.calendarWeekText}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day, visibleMonth);
                const selected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <Pressable
                    key={day.toISOString()}
                    accessibilityRole="button"
                    onPress={() => {
                      onChangeDate(toISODate(day));
                      setOpen(false);
                    }}
                    style={[styles.calendarDay, selected && styles.calendarDaySelected]}
                  >
                    <Text style={[styles.calendarDayText, !inMonth && styles.calendarDayMuted, selected && styles.calendarDayTextSelected]}>{format(day, 'd')}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  columns: { key: string; label: ReactNode; width?: number; flex?: number }[];
  rows: Record<string, ReactNode>[];
  keyExtractor: (row: Record<string, ReactNode>, index: number) => string;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {columns.map((column) => (
          <View key={column.key} style={[styles.th, { width: column.width, flex: column.flex }]}>
            {typeof column.label === 'string' || typeof column.label === 'number' ? <Text style={styles.thText}>{column.label}</Text> : column.label}
          </View>
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
  const valueCount = Math.max(values.length, 1);
  const gap = Math.min(5, (width - 32) / (valueCount * 3));
  const barWidth = (width - 32 - gap * (valueCount - 1)) / valueCount;

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {values.map((item, index) => {
          const barHeight = item.value === 0 ? 0 : Math.max(2, (item.value / max) * 102);
          const x = 16 + index * (barWidth + gap);
          const y = 118 - barHeight;
          return <Rect key={`${item.label}-${index}`} x={x} y={y} width={barWidth} height={barHeight} rx={3} fill="#344054" />;
        })}
      </Svg>
      <View style={styles.chartLabels}>
        {values.slice(0, 8).map((item) => (
          <Text key={item.label} style={styles.chartLabel}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function FinanceBarChart({
  values,
  valueFormatter = (value: number) => String(value),
  color = '#067647',
  emptyLabel = 'Sem dados no periodo.',
}: {
  values: { label: string; value: number; meta?: string | number }[];
  valueFormatter?: (value: number) => string;
  color?: string;
  emptyLabel?: string;
}) {
  const width = 640;
  const height = 168;
  const displayValues = values;
  const hasData = displayValues.length > 0;
  const max = Math.max(1, ...displayValues.map((item) => item.value));
  const valueCount = Math.max(displayValues.length, 1);
  const gap = Math.min(5, (width - 36) / (valueCount * 3));
  const barWidth = (width - 36 - gap * (valueCount - 1)) / valueCount;
  const labelStep = Math.max(1, Math.ceil(displayValues.length / 8));

  if (!hasData) {
    return (
      <View style={styles.financeChartEmpty}>
        <Text style={styles.financeChartEmptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.financeChartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {displayValues.map((item, index) => {
          const barHeight = item.value === 0 ? 0 : Math.max(3, (item.value / max) * 118);
          const x = 18 + index * (barWidth + gap);
          const y = 132 - barHeight;
          return <Rect key={`${item.label}-${index}`} x={x} y={y} width={barWidth} height={barHeight} rx={3} fill={color} />;
        })}
      </Svg>
      <View style={styles.financeChartLabels}>
        {displayValues.map((item, index) => {
          if (index !== 0 && index !== displayValues.length - 1 && index % labelStep !== 0) return null;
          return (
            <Text key={`${item.label}-${index}`} style={styles.financeChartLabel}>
              {item.label}
            </Text>
          );
        })}
      </View>
      <View style={styles.financeChartLegend}>
        {values.slice(0, 6).map((item, index) => (
          <View key={`${item.label}-${index}`} style={styles.financeChartLegendRow}>
            <Text style={styles.financeChartLegendLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.financeChartLegendValue}>{valueFormatter(item.value)}</Text>
          </View>
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
  fieldButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
  },
  fieldButtonText: {
    color: '#101828',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  fieldPlaceholder: {
    color: '#98a2b3',
  },
  calendarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 12,
    boxShadow: '0 12px 28px rgba(16, 24, 40, 0.18)',
  },
  calendarHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  calendarTitle: {
    flex: 1,
    color: '#101828',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  calendarWeekText: {
    flex: 1,
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  calendarDay: {
    width: '13.25%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: '#101828',
  },
  calendarDayText: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  calendarDayMuted: {
    color: '#98a2b3',
  },
  calendarDayTextSelected: {
    color: '#ffffff',
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  thText: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
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
  financeChartWrap: {
    gap: 10,
  },
  financeChartLabels: {
    minHeight: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  financeChartLabel: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '800',
  },
  financeChartLegend: {
    gap: 6,
  },
  financeChartLegendRow: {
    minHeight: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  financeChartLegendLabel: {
    flex: 1,
    color: '#344054',
    fontSize: 12,
    fontWeight: '700',
  },
  financeChartLegendValue: {
    color: '#101828',
    fontSize: 12,
    fontWeight: '800',
  },
  financeChartEmpty: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  financeChartEmptyText: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
  },
});
