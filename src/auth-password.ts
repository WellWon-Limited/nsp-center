/** Shared registration guard for both server-backed and browser-only accounts. */
export function registrationPasswordError(password: string, confirmation: string): string {
  if (password.length < 8) return 'Пароль должен содержать не меньше 8 символов.';
  if (password.length > 200) return 'Пароль должен содержать не больше 200 символов.';
  if (!confirmation) return 'Повторите пароль.';
  if (password !== confirmation) return 'Пароли не совпадают.';
  return '';
}
