/**
 * Formats internal semester code (e.g., "1-1", "4-2") to a human-readable format.
 * Mapping logic:
 * - 1-1 -> Sem 1
 * - 1-2 -> Sem 2
 * - 2-1 -> Sem 3
 * - 2-2 -> Sem 4
 * - 3-1 -> Sem 5
 * - 3-2 -> Sem 6
 * - 4-1 -> Sem 7
 * - 4-2 -> Sem 8
 */
export const formatSemester = (semCode: string): string => {
  if (semCode.startsWith('Sem')) return semCode;
  
  const parts = semCode.split('-');
  if (parts.length !== 2) return semCode; // Fallback to raw value
  
  const year = parseInt(parts[0]);
  const sem = parseInt(parts[1]);
  
  if (isNaN(year) || isNaN(sem)) return semCode;
  
  // Logic: (Year - 1) * 2 + Sem
  const totalSem = (year - 1) * 2 + sem;
  return `Sem${totalSem}`;
};
