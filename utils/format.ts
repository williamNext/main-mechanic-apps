export function formatPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length > 11) digits = digits.slice(0, 11);
  if (digits.length > 2) {
    if (digits.length > 7) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length > 0) {
    return `(${digits}`;
  }
  return digits;
}

export function toBrazilWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return null;
}

export function toPseudoEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `55${digits}@oficina.app`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}
