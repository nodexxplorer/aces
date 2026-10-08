/** The department's name without its "Department of" prefix, for example "Computer Engineering". */
export function departmentShortName(name?: string): string | undefined {
  const short = name?.trim().replace(/^Department of\s+/i, '').trim();
  return short || undefined;
}

/** The chatbot's name for a department: "Computer Engineering Assistant", or "Admin Pack Assistant" without one. */
export function assistantName(departmentName?: string): string {
  const short = departmentShortName(departmentName);
  return short ? `${short} Assistant` : 'Admin Pack Assistant';
}
