// The department (tenant) a person signs in to is chosen on the sign-in and
// sign-up pages and remembered in this browser. An empty value means "the
// server's default department", which is also what the mobile app uses.
const STORAGE_KEY = 'aces_department';

export function getStoredDepartment(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeDepartment(slug: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // Storage can be unavailable (for example in some private modes). The
    // choice then lasts only for the current page.
  }
}
