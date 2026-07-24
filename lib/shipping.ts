export type DeliveryOption = {
  value: string;
  label: string;
  price: number;
};

export const DEFAULT_DELIVERY_OPTIONS: DeliveryOption[] = [
  { value: 'pickup', label: 'Odbiór osobisty', price: 0 },
  { value: 'courier', label: 'Kurier', price: 15 },
  { value: 'paczkomat', label: 'Paczkomat', price: 12 },
];

export const IGNORED_SHIPPING_SETTING_KEYS = new Set(['free_shipping_threshold']);
