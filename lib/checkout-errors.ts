export function normalizeCheckoutError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('koszyk został zaktualizowany')) return message;
  if (lower.includes('niedostępny') || lower.includes('koszyk')) {
    return 'Jeden z produktów nie jest już dostępny w wybranej ilości. Wróć do koszyka, odśwież pozycje i spróbuj ponownie.';
  }
  if (lower.includes('dane kontaktowe') || lower.includes('adres')) {
    return 'Sprawdź dane kontaktowe i adres dostawy. Kod pocztowy powinien mieć format 00-000.';
  }
  return message || 'Nie udało się złożyć zamówienia. Spróbuj ponownie.';
}
