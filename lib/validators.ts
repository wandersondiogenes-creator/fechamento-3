export function parseCurrencyToNumber(val: any): string {
  if (val === null || val === undefined || val === '') return '0.00';
  if (typeof val === 'number') return isNaN(val) ? '0.00' : val.toFixed(2);
  const str = String(val).trim().replace(/[^\d.,-]/g, '');
  if (str.includes(',') && str.includes('.')) {
    const parsed = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
  }
  if (str.includes(',')) {
    const parsed = parseFloat(str.replace(',', '.'));
    return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
}
