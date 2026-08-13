// Matches web's frontend/src/utils/validators.ts exactly, for parity.
export const isValidPhone = (phone: string): boolean =>
  /^(\+234|0)[789]\d{9}$/.test(phone.replace(/\s/g, ''));

export const isValidDateOfBirth = (dob: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return false;
  const ageYears = (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return ageYears >= 16;
};
