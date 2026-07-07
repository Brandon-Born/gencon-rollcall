export type MemberStatus =
  | 'at-event'
  | 'vendor-hall'
  | 'gaming'
  | 'food-drinks'
  | 'hotel-resting'
  | 'heading-somewhere'
  | 'available'
  | 'need-break'
  | 'offline';

export interface StatusOption {
  value: MemberStatus;
  label: string;
  tone: 'green' | 'blue' | 'gold' | 'orange' | 'red' | 'gray';
}

export const STATUS_OPTIONS: readonly StatusOption[] = [
  { value: 'at-event', label: 'At an event', tone: 'blue' },
  { value: 'vendor-hall', label: 'Vendor Hall', tone: 'gold' },
  { value: 'gaming', label: 'Gaming', tone: 'blue' },
  { value: 'food-drinks', label: 'Food / drinks', tone: 'orange' },
  { value: 'hotel-resting', label: 'Hotel / resting', tone: 'gray' },
  { value: 'heading-somewhere', label: 'Heading somewhere', tone: 'gold' },
  { value: 'available', label: 'Available', tone: 'green' },
  { value: 'need-break', label: 'Need a break', tone: 'orange' },
  { value: 'offline', label: 'Offline', tone: 'gray' }
];

export function statusLabel(status: MemberStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}
