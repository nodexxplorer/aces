export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isValidPhone = (phone: string): boolean =>
  /^(\+234|0)[789]\d{9}$/.test(phone.replace(/\s/g, ''));

export const isValidMatricNumber = (matric: string): boolean =>
  /^[A-Z]{3}\/\d{4}\/\d{3,4}$/i.test(matric);

export const isValidStaffId = (id: string): boolean =>
  /^[A-Z]{2,5}\/\d{3,6}$/i.test(id);

export const isStrongPassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 8) return { valid: false, message: 'Must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: 'Must contain an uppercase letter' };
  if (!/[a-z]/.test(password)) return { valid: false, message: 'Must contain a lowercase letter' };
  if (!/\d/.test(password)) return { valid: false, message: 'Must contain a number' };
  return { valid: true, message: 'Strong password' };
};

export const isValidScore = (score: number, max: number): boolean =>
  score >= 0 && score <= max;

export const isValidCreditUnit = (cu: number): boolean =>
  cu >= 1 && cu <= 6 && Number.isInteger(cu);
