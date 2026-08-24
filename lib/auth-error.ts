type AuthAction = 'login' | 'register' | 'reset';

const FALLBACK_MESSAGES: Record<AuthAction, string> = {
  login: 'Nie udało się zalogować. Spróbuj ponownie za chwilę.',
  register: 'Nie udało się utworzyć konta. Spróbuj ponownie za chwilę.',
  reset: 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.',
};

function authErrorText(error: unknown) {
  return (
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error || '')
  ).toLowerCase();
}

export function isEmailNotConfirmedError(error: unknown) {
  return authErrorText(error).includes('email not confirmed');
}

export function getAuthErrorMessage(error: unknown, action: AuthAction) {
  const message = authErrorText(error);

  if (message.includes('invalid login credentials')) {
    return 'Nieprawidłowy email lub hasło.';
  }
  if (isEmailNotConfirmedError(error)) {
    return 'Najpierw potwierdź adres email. Jeśli wiadomość nie dotarła, wyślij link aktywacyjny ponownie.';
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
