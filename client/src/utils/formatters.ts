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

export const formatMaterialType = (type: string): string => {
  const map: Record<string, string> = {
    'ppt': 'PPT',
    'book': 'Book',
    'handwritten': 'Handwritten Notes',
    'digital': 'Digital Copy',
    'printed': 'Printed',
    'other': 'Other Material'
  };
  return map[type.toLowerCase()] || type;
};

export const getPlatformFeeConfig = (percentage: number) => {
  if (percentage === 0) {
    return {
      label: "Launch Promo",
      desc: "0% Platform Fee",
      isPromo: true,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
      badge: "FREE"
    };
  }
  
  if (percentage === 5) {
    return {
      label: "Exam Special",
      desc: "50% Off Platform Fee",
      isPromo: true,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
      badge: "50% OFF"
    };
  }

  return {
    label: "Platform Fee",
    desc: `(${percentage}%)`,
    isPromo: false,
    color: "text-text-muted",
    bgColor: "bg-white/5",
    borderColor: "border-white/10",
    badge: null
  };
};
