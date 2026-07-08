import { useCallback } from 'react';
import { usePreferencesStore } from '@/src/store/preferencesStore';

export function usePhoneMasking() {
  const maskPhoneNumbers = usePreferencesStore((state) => state.maskPhoneNumbers);

  const formatPhone = useCallback((phone: string | undefined | null) => {
    if (!maskPhoneNumbers || !phone) return phone || '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return phone;
    const visible = digits.slice(-4);
    const masked = Array(digits.length - 4).fill('•').join('');
    return `+${masked}${visible}`;
  }, [maskPhoneNumbers]);

  return { maskPhoneNumbers, formatPhone };
}
