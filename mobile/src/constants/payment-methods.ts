import type { PaymentMethod } from '@/types/models';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'bank_transfer', 'other'];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
};

export function paymentMethodLabel(method?: PaymentMethod): string {
  return method ? PAYMENT_METHOD_LABEL[method] : 'Not specified';
}
