import { z } from 'zod';

const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength, `Maksymalnie ${maxLength} znaków`);

export const profileUpdateSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, 'Imię i nazwisko musi mieć co najmniej 2 znaki')
      .max(100, 'Imię i nazwisko może mieć maksymalnie 100 znaków'),
    phone: optionalText(32).refine(
      (value) => !value || /^[+0-9() -]{6,32}$/.test(value),
      'Nieprawidłowy numer telefonu'
    ),
    company: optionalText(160),
    nip: optionalText(10).refine(
      (value) => !value || /^[0-9]{10}$/.test(value),
      'NIP musi zawierać 10 cyfr'
    ),
    address_street: optionalText(160),
    address_city: optionalText(100),
    address_zip: optionalText(6).refine(
      (value) => !value || /^[0-9]{2}-[0-9]{3}$/.test(value),
      'Kod pocztowy musi mieć format 00-000'
    ),
    address_country: z
      .string()
      .trim()
      .min(2, 'Podaj kraj')
      .max(80, 'Nazwa kraju może mieć maksymalnie 80 znaków'),
  })
  .strict();

export type ProfileUpdateValues = z.infer<typeof profileUpdateSchema>;

export function normalizeProfileUpdate(values: ProfileUpdateValues) {
  return {
    full_name: values.full_name,
    phone: values.phone || null,
    company: values.company || null,
    nip: values.nip || null,
    address_street: values.address_street || null,
    address_city: values.address_city || null,
    address_zip: values.address_zip || null,
    address_country: values.address_country,
  };
}
