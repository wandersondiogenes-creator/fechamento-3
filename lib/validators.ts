import { CADASTRO_EMPRESAS } from './cadastros';

export function removeAccents(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function toTitleCase(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (['de', 'da', 'do', 'das', 'dos', 'e', 'em'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function isValidCPF(cpf: any): boolean {
  if (!cpf) return false;
  const clean = String(cpf).replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

export function isValidCNPJ(cnpj: any): boolean {
  if (!cnpj) return false;
  const clean = String(cnpj).replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

export function formatCPF(val: any): string {
  if (!val) return '';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return String(val);
}

export function formatCNPJ(val: any): string {
  if (!val) return '';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return String(val);
}

export function formatPhone(val: any): string {
  if (!val) return '';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return String(val);
}

export function formatCurrencyBRL(val: any): string {
  if (val === null || val === undefined || val === '') return 'R$ 0,00';
  const num = typeof val === 'number' ? val : parseCurrencyToNumber(val);
  if (num === null || isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseCurrencyToNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  if (!str) return null;
  const cleaned = str.replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      return isNaN(n) ? null : n;
    } else {
      const n = parseFloat(cleaned.replace(/,/g, ''));
      return isNaN(n) ? null : n;
    }
  }

  if (cleaned.includes(',')) {
    const n = parseFloat(cleaned.replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function isValidDateValue(val: any): boolean {
  if (!val) return false;
  if (val instanceof Date && !isNaN(val.getTime())) return true;
  const str = String(val).trim();
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(str)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
  if (!isNaN(Date.parse(str)) && str.length >= 8 && (str.includes('/') || str.includes('-'))) return true;
  return false;
}

export function parseAndFormatDate(val: any, targetFormat: string = 'DD/MM/YYYY'): string {
  if (!val) return '';
  let d: Date | null = null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    d = val;
  } else {
    const str = String(val).trim();
    const slashParts = str.split(/[/.-]/);
    if (slashParts.length === 3) {
      if (slashParts[0].length === 4) {
        // YYYY-MM-DD
        d = new Date(parseInt(slashParts[0]), parseInt(slashParts[1]) - 1, parseInt(slashParts[2]));
      } else if (slashParts[2].length === 4 || slashParts[2].length === 2) {
        // DD/MM/YYYY
        let yr = parseInt(slashParts[2]);
        if (yr < 100) yr += 2000;
        d = new Date(yr, parseInt(slashParts[1]) - 1, parseInt(slashParts[0]));
      }
    }
    if (!d || isNaN(d.getTime())) {
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) d = new Date(parsed);
    }
  }

  if (!d || isNaN(d.getTime())) return String(val);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (targetFormat === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  return `${day}/${month}/${year}`;
}

export function mapSitefEmpresa(sitefValue: string): string {
  if (!sitefValue || typeof sitefValue !== 'string') return sitefValue || '';
  const cleanInput = removeAccents(sitefValue.trim().toUpperCase());

  // Direct match in CADASTRO_EMPRESAS
  for (const emp of CADASTRO_EMPRESAS) {
    const normEmp = removeAccents(emp.toUpperCase());
    if (normEmp === cleanInput) return emp;
  }

  // Substring match
  for (const emp of CADASTRO_EMPRESAS) {
    const normEmp = removeAccents(emp.toUpperCase());
    const words = normEmp.split(/[\s-]+/).filter((w) => w.length > 2);
    const matchesAll = words.length > 0 && words.every((w) => cleanInput.includes(w));
    if (matchesAll) return emp;
  }

  // Partial match
  for (const emp of CADASTRO_EMPRESAS) {
    const normEmp = removeAccents(emp.toUpperCase());
    if (cleanInput.includes(normEmp) || normEmp.includes(cleanInput)) {
      return emp;
    }
  }

  return sitefValue;
}
