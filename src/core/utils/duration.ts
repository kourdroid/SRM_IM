export interface DurationPart {
  value: string;
  unit: string;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const UNKNOWN: DurationPart[] = [{ value: '—', unit: '' }];

/** Hours are the default unit: minutes below one hour, days only from 48 hours. */
export function durationPartsFromMinutes(minutes: number): DurationPart[] {
  if (!Number.isFinite(minutes) || minutes < 0) return UNKNOWN;
  const total = Math.round(minutes);
  if (total < 1) return [{ value: '< 1', unit: 'min' }];
  if (total < MINUTES_PER_HOUR) return [{ value: String(total), unit: 'min' }];

  if (total < 2 * MINUTES_PER_DAY) {
    const hours = Math.floor(total / MINUTES_PER_HOUR);
    const rest = total % MINUTES_PER_HOUR;
    if (hours >= 10) return [{ value: String(Math.round(total / MINUTES_PER_HOUR)), unit: 'h' }];
    return rest > 0
      ? [{ value: String(hours), unit: 'h' }, { value: String(rest), unit: 'min' }]
      : [{ value: String(hours), unit: 'h' }];
  }

  let days = Math.floor(total / MINUTES_PER_DAY);
  let hours = Math.round((total % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  if (hours === 24) {
    days += 1;
    hours = 0;
  }
  return hours > 0
    ? [{ value: String(days), unit: 'j' }, { value: String(hours), unit: 'h' }]
    : [{ value: String(days), unit: 'j' }];
}

/** Zero means no closed incident in the period, so it shows as no data. */
export function durationPartsFromDays(days: number): DurationPart[] {
  return days > 0 ? durationPartsFromMinutes(days * MINUTES_PER_DAY) : UNKNOWN;
}

export function formatDurationBetween(startValue: string, endValue: string): string {
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Durée inconnue';
  return durationPartsFromMinutes(Math.max(0, (end - start) / 60000))
    .map(part => `${part.value} ${part.unit}`)
    .join(' ');
}
