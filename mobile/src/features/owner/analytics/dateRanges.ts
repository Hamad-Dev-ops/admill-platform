export type DateRangePreset = 'today' | 'week' | 'month';

export const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export function resolveDateRange(preset: DateRangePreset): { startDate: string; endDate: string } {
  const now = new Date();
  let start: Date;

  if (preset === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (preset === 'week') {
    const dayOfWeek = now.getDay();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { startDate: start.toISOString(), endDate: now.toISOString() };
}
