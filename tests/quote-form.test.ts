import assert from 'node:assert/strict';
import { test } from 'vitest';
import { formatQuotePrice, quoteSchema, serviceNotes } from '../lib/quote-form';

const validQuote = {
  material_id: 'material-id',
  color: 'filament-id',
  infill: '20' as const,
  quantity: 2,
  priority: 'standard' as const,
  notes: 'Bez podpór',
  delivery_type: 'courier',
};

test('formularz wyceny akceptuje kompletne parametry klienta', () => {
  assert.equal(quoteSchema.safeParse(validQuote).success, true);
});

test('formularz wyceny odrzuca niedozwolone wypełnienie i ilości graniczne', () => {
  assert.equal(quoteSchema.safeParse({ ...validQuote, infill: '15' }).success, false);
  assert.equal(quoteSchema.safeParse({ ...validQuote, quantity: 0 }).success, false);
  assert.equal(quoteSchema.safeParse({ ...validQuote, quantity: 1001 }).success, false);
  assert.equal(quoteSchema.safeParse({ ...validQuote, quantity: 1.5 }).success, false);
});

test('formularz wyceny ogranicza uwagi i wymaga materiału, filamentu oraz dostawy', () => {
  assert.equal(quoteSchema.safeParse({ ...validQuote, notes: 'x'.repeat(2001) }).success, false);
  assert.equal(quoteSchema.safeParse({ ...validQuote, material_id: '' }).success, false);
  assert.equal(quoteSchema.safeParse({ ...validQuote, color: '' }).success, false);
  assert.equal(quoteSchema.safeParse({ ...validQuote, delivery_type: '' }).success, false);
});

test('format ceny i notatki usługowe są stabilne dla interfejsu', () => {
  assert.equal(formatQuotePrice(12.5), '12.50 zł');
  assert.equal(formatQuotePrice(null), '0.00 zł');
  assert.match(serviceNotes['czesci-inzynieryjne'], /inżynieryjnej/);
});
