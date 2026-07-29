import assert from 'node:assert/strict';
import { test } from 'vitest';
import { normalizeCheckoutError } from '../lib/checkout-errors';
import {
  createProductSlug,
  parseProductDecimal,
} from '../lib/admin/product-form';

test('checkout zachowuje komunikat o automatycznej aktualizacji koszyka', () => {
  const message = 'Koszyk został zaktualizowany po zmianie ceny lub dostępności.';
  assert.equal(normalizeCheckoutError(message), message);
});

test('checkout zamienia techniczne błędy koszyka i adresu na czytelne instrukcje', () => {
  assert.match(normalizeCheckoutError('Produkt niedostępny'), /Wróć do koszyka/);
  assert.match(normalizeCheckoutError('Niepoprawny adres'), /00-000/);
  assert.equal(normalizeCheckoutError('Błąd operatora płatności'), 'Błąd operatora płatności');
});

test('slug produktu normalizuje polskie znaki i usuwa znaki specjalne', () => {
  assert.equal(createProductSlug('  Żółta Łódź – PETG  '), 'zolta-lodz-petg');
  assert.equal(createProductSlug('---'), '');
});

test('wartości dziesiętne produktu obsługują przecinek i odrzucają tekst', () => {
  assert.equal(parseProductDecimal('19,99'), 19.99);
  assert.equal(parseProductDecimal(' 20 '), 20);
  assert.equal(Number.isNaN(parseProductDecimal('brak')), true);
});
