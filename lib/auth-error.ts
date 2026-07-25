type AuthAction = 'login' | 'register' | 'reset';

const FALLBACK_MESSAGES: Record<AuthAction, string> = {
  login: 'Nie udało się zalogować. Spróbuj ponownie za chwilę.',
  register: 'Nie udało się utworzyć konta. Spróbuj ponownie za chwilę.',
  reset: 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.',
};

export function getAuthErrorMessage(error: unknown, action: AuthAction) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error || '').toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Nieprawidłowy email lub hasło.';
  }
  if (message.includes('email not confirmed')) {
    return 'Najpierw potwierdź adres email, korzystając z otrzymanej wiadomości.';
  }
  if (
    message.includes('already registered') ||
    message.includes('user already exists')
  ) {
    return 'Konto z tym adresem email już istnieje.';
  }
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('over_email_send_rate_limit')
  ) {
    return 'Wykonano zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.';
  }

  return FALLBACK_MESSAGES[action];
}
