/**
 * Utility functions for validating and formatting Brazilian data types
 * (CPF, CNPJ, Phone, Currency, Dates, Strings)
 */

export function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  
  // Reject repetitive sequences like 11111111111
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  let remainder: number;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10), 10)) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(10, 11), 10)) return false;

  return true;
}

export function formatCPF(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val).replace(/\D/g, '');
  if (str.length === 0) return '';
  const pad = str.padStart(11, '0').slice(-11);
  return `${pad.slice(0, 3)}.${pad.slice(3, 6)}.${pad.slice(6, 9)}-${pad.slice(9, 11)}`;
}

export function isValidCNPJ(cnpj: string): boolean {
  if (!cnpj) return false;
  const clean = cnpj.replace(/\D/g, '');
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

export function formatCNPJ(val: any): string {
  if (!val) return '';
  const str = String(val).replace(/\D/g, '');
  if (!str) return '';
  const pad = str.padStart(14, '0').slice(-14);
  return `${pad.slice(0, 2)}.${pad.slice(2, 5)}.${pad.slice(5, 8)}/${pad.slice(8, 12)}-${pad.slice(12, 14)}`;
}

export function formatPhone(val: any): string {
  if (!val) return '';
  const str = String(val).replace(/\D/g, '');
  if (str.length === 11) {
    return `(${str.slice(0, 2)}) ${str.slice(2, 7)}-${str.slice(7)}`;
  } else if (str.length === 10) {
    return `(${str.slice(0, 2)}) ${str.slice(2, 6)}-${str.slice(6)}`;
  }
  return String(val);
}

export function parseCurrencyToNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;

  let str = String(val).trim();
  // Remove currency symbols (R$, $, USD, etc)
  str = str.replace(/[R$USD\s]/gi, '');

  if (!str) return null;

  // Handle BR format "1.250,50" vs US format "1,250.50"
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // BR format 1.250,50 -> 1250.50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US format 1,250.50 -> 1250.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma "1250,50" -> "1250.50"
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

export function formatCurrencyBRL(val: any): string {
  const num = parseCurrencyToNumber(val);
  if (num === null) return val !== undefined && val !== null ? String(val) : '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

export function removeAccents(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function toTitleCase(str: string): string {
  if (!str) return '';
  const minorWords = ['de', 'da', 'do', 'dos', 'das', 'e'];
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (!word) return '';
      if (index > 0 && minorWords.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function parseAndFormatDate(val: any, targetFormat: string): string {
  if (val === null || val === undefined || val === '') return '';

  let dayStr = '';
  let monthStr = '';
  let yearNum = 0;
  let hoursStr = '00';
  let minutesStr = '00';

  if (typeof val === 'number') {
    // Excel serial number date using UTC methods to avoid local timezone offset
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    dayStr = String(dateObj.getUTCDate()).padStart(2, '0');
    monthStr = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    yearNum = dateObj.getUTCFullYear();
    hoursStr = String(dateObj.getUTCHours()).padStart(2, '0');
    minutesStr = String(dateObj.getUTCMinutes()).padStart(2, '0');
  } else if (val instanceof Date) {
    dayStr = String(val.getDate()).padStart(2, '0');
    monthStr = String(val.getMonth() + 1).padStart(2, '0');
    yearNum = val.getFullYear();
    hoursStr = String(val.getHours()).padStart(2, '0');
    minutesStr = String(val.getMinutes()).padStart(2, '0');
  } else {
    const str = String(val).trim();
    if (!str) return '';

    // Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (e.g. 1992-07-22 or 2026/03/03 14:30)
    const isoMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
    // Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (e.g. 15/03/1988 or 01.11.1995)
    const brMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);

    if (isoMatch) {
      yearNum = parseInt(isoMatch[1], 10);
      monthStr = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
      dayStr = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
      hoursStr = isoMatch[4] ? String(parseInt(isoMatch[4], 10)).padStart(2, '0') : '00';
      minutesStr = isoMatch[5] ? String(parseInt(isoMatch[5], 10)).padStart(2, '0') : '00';
    } else if (brMatch) {
      dayStr = String(parseInt(brMatch[1], 10)).padStart(2, '0');
      monthStr = String(parseInt(brMatch[2], 10)).padStart(2, '0');
      yearNum = parseInt(brMatch[3], 10);
      if (yearNum < 100) yearNum += 2000;
      hoursStr = brMatch[4] ? String(parseInt(brMatch[4], 10)).padStart(2, '0') : '00';
      minutesStr = brMatch[5] ? String(parseInt(brMatch[5], 10)).padStart(2, '0') : '00';
    } else {
      const parsed = Date.parse(str);
      if (isNaN(parsed)) {
        return String(val);
      }
      const dateObj = new Date(parsed);
      if (str.includes('Z') || str.includes('T')) {
        dayStr = String(dateObj.getUTCDate()).padStart(2, '0');
        monthStr = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        yearNum = dateObj.getUTCFullYear();
        hoursStr = String(dateObj.getUTCHours()).padStart(2, '0');
        minutesStr = String(dateObj.getUTCMinutes()).padStart(2, '0');
      } else {
        dayStr = String(dateObj.getDate()).padStart(2, '0');
        monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
        yearNum = dateObj.getFullYear();
        hoursStr = String(dateObj.getHours()).padStart(2, '0');
        minutesStr = String(dateObj.getMinutes()).padStart(2, '0');
      }
    }
  }

  switch (targetFormat) {
    case 'DD/MM/YYYY':
      return `${dayStr}/${monthStr}/${yearNum}`;
    case 'YYYY-MM-DD':
      return `${yearNum}-${monthStr}-${dayStr}`;
    case 'DD/MM/YYYY HH:mm':
      return `${dayStr}/${monthStr}/${yearNum} ${hoursStr}:${minutesStr}`;
    case 'MM/DD/YYYY':
      return `${monthStr}/${dayStr}/${yearNum}`;
    default:
      return `${dayStr}/${monthStr}/${yearNum}`;
  }
}

export function isValidDateValue(val: any): boolean {
  if (val === null || val === undefined) return false;

  if (val instanceof Date) {
    return !isNaN(val.getTime());
  }

  if (typeof val === 'number') {
    // Excel serial dates range from ~10000 (1927) to ~80000 (2119)
    return val >= 10000 && val <= 80000;
  }

  const str = String(val).trim();
  if (!str) return false;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  if (/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/.test(str)) {
    return true;
  }

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2}/.test(str)) {
    return true;
  }

  // Portuguese or English month names (e.g. "15 de março de 2023", "22 Jul 1992")
  if (/^\d{1,2}\s+(de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(str)) {
    return true;
  }

  // ISO timestamp with T or Z
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
    return true;
  }

  // Pure digits or alphabetic text without date patterns are not dates
  if (/^\d+$/.test(str) || /^[a-zA-Z\s]+$/.test(str)) {
    return false;
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const yr = d.getFullYear();
    return yr >= 1900 && yr <= 2100;
  }

  return false;
}

export const SITEF_EMPRESA_MAP: Record<string, string> = {
  'BYD ARRUDA': 'BYD - ARRUDA',
  'BYD CAMINHO DAS ARVORES': 'BYD - CAMINHO DAS ARVORES',
  'BYD W SOARES': 'BYD - WASHINGTON SOARES',
  'EUROVIA AUTO LTDA': 'GEELY MADALENA',
  'EUROVIA AUTO LTDA - GEELY ACM': 'GEELY ACM',
  'EUROVIA AUTO LTDA - GEELY IMBIRIBEIRA': 'GEELY IMBIRIBEIRA',
  'EUROVIA AUTO LTDA - GEELY OFICINA': 'GEELY IGUATEMI - OFICINA',
  'EUROVIA EPITACIO PESSOA': 'RENAULT EPITACIO PESSOA',
  'EUROVIA FILIAL CABEDELO': 'RENAULT CABEDELO',
  'EUROVIA GEELY PB ANT. GA': 'GEELY ANTO. GAMA CTA - OFICINA',
  'EUROVIA GEELY PB EPITACIO': 'GEELY EPITACIO PESSOA',
  'EUROVIA NISSAN PIEDADE': 'NISSAN PIEDADE COMPLEXO',
  'EUROVIA VEICULOS S/A CTA': 'RENAULT ANTONIO GAMA CTA',
  'GRANVIA CARUARU': 'FORD CARUARU',
  'GRANVIA IMBIRIBEIRA': 'FORD IMBIRIBEIRA',
  'INTERVIA IMBIRIBEIRA': 'KIA IMBIRIBEIRA',
  'JEEP ACM': 'CJDR ACM',
  'JEEP DUNAS': 'JEEP DUNAS',
  'JEEP IMBIRIBEIRA': 'JEEP IMBIRIBEIRA',
  'JEEP JABOATAO': 'JEEP JABOATAO',
  'JEEP PARQUELANDIA': 'JEEP PARQUELANDIA',
  'JEEP RIO VERMELHO': 'JEEP RIO VERMELHO',
  'NEWVIA BONOCO': 'NEWVIA BONOCO',
  'NEWVIA CARUARU': 'NEWVIA CARUARU',
  'NEWVIA IMBIRIBEIRA': 'NEWVIA IMBIRIBEIRA',
  'NEWVIA LAURO': 'NEWVIA LAURO',
  'NEWVIA MOTOS CAMBEBA': 'NEWVIA WASH. SOARES',
  'NEWVIA MOTOS LTDA': 'NEWVIA PIEDADE',
  'NEWVIA MOTOS PARQUELANDI': 'NEWVIA PARQUELANDIA',
  'NISSAN AFOGADOS': 'NISSAN AFOGADOS',
  'NISSAN CAXANGA': 'NISSAN CAXANGA',
  'NISSAN IGUATEMI': 'NISSAN IGUATEMI',
  'NISSAN IMBIRIBEIRA': 'NISSAN IMBIRIBEIRA',
  'NISSAN LAURO': 'NISSAN LAURO',
  'NISSAN PARALELA': 'NISSAN PARALELA',
  'NISSAN RIO VERMELHO': 'NISSAN RIO VERMELHO',
  'OMODA ABDIAS': 'OMODA ABDIAS',
  'OMODA ALDEOTA': 'OMODA ALDEOTA',
  'OMODA PARALELA': 'OMODA PARALELA',
  'RENAULT AFOGADOS': 'RENAULT AFOGADOS',
  'RENAULT IGUATEMI': 'RENAULT IGUATEMI',
  'RENAULT IMBIRIBEIRA': 'RENAULT IMBIRIBEIRA',
  'RENAULT IMBIRIBEIRA SEMINOVOS': 'RENAULT IMBIRIBEIRA SEMINOVOS',
  'RENAULT LAURO': 'RENAULT LAURO',
  'RENAULT OLINDA': 'RENAULT OLINDA',
  'RENAULT PIEDADE': 'RENAULT PIEDADE',
  'RENAULT PRADO SEMINOVOS': 'RENAULT PRADO SEMINOVOS',
  'VIA SUL VEICULOS S/A - LEAP IMBIRIBEIRA': 'LEAP IMBIRIBEIRA',
  'VIASUL ARRUDA': 'VIA SUL ARRUDA',
  'VIASUL AV NORTE': 'VIA SUL AV. NORTE SEMINOVOS',
  'VIASUL DUNAS': 'VIA SUL DUNAS',
  'VIASUL MATRIZ': 'VIA SUL MATRIZ',
};

export function mapSitefEmpresa(val: any): string {
  if (val === null || val === undefined) return '';
  const strVal = String(val).trim();
  if (!strVal) return '';

  const uppercaseClean = strVal.toUpperCase().replace(/\s+/g, ' ');

  if (SITEF_EMPRESA_MAP[uppercaseClean]) {
    return SITEF_EMPRESA_MAP[uppercaseClean];
  }

  const normInput = uppercaseClean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, target] of Object.entries(SITEF_EMPRESA_MAP)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normKey === normInput) {
      return target;
    }
  }

  return strVal;
}
