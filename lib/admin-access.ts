export type AdminPanelRole = 'admin' | 'employee' | 'customer' | null | undefined;

const EMPLOYEE_ADMIN_PATH_PREFIXES = [
  '/admin/zamowienia',
  '/admin/sklep-zamowienia',
  '/admin/wyceny',
  '/admin/produkcja',
  '/admin/filamenty',
  '/admin/historia',
] as const;

export const EMPLOYEE_ADMIN_HOME = '/admin/zamowienia';

export function isStaffRole(
  role: AdminPanelRole
): role is 'admin' | 'employee' {
  return role === 'admin' || role === 'employee';
}

export function canAccessAdminPath(
  role: AdminPanelRole,
  pathname: string
) {
  if (role === 'admin') return true;
  if (role !== 'employee') return false;

  return EMPLOYEE_ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getAdminHomePath(role: AdminPanelRole) {
  return role === 'employee' ? EMPLOYEE_ADMIN_HOME : '/admin';
}
