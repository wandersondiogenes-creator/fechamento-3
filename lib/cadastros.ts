/**
 * Cadastro Oficial de Empresas e Departamentos
 * Conforme tabelas do sistema financeiro Dealer / SiTef
 */

export const CADASTRO_EMPRESAS: string[] = [
  'BYD - ARRUDA',
  'BYD - CAMINHO DAS ARVORES',
  'BYD - WASHINGTON SOARES',
  'GEELY MADALENA',
  'GEELY ACM',
  'GEELY IMBIRIBEIRA',
  'GEELY IGUATEMI - OFICINA',
  'RENAULT EPITACIO PESSOA',
  'RENAULT CABEDELO',
  'GEELY ANTO. GAMA CTA - OFICINA',
  'GEELY EPITACIO PESSOA',
  'NISSAN PIEDADE COMPLEXO',
  'RENAULT ANTONIO GAMA CTA',
  'FORD CARUARU',
  'FORD IMBIRIBEIRA',
  'KIA IMBIRIBEIRA',
  'CJDR ACM',
  'JEEP DUNAS',
  'JEEP IMBIRIBEIRA',
  'JEEP JABOATAO',
  'JEEP PARQUELANDIA',
  'JEEP RIO VERMELHO',
  'NEWVIA BONOCO',
  'NEWVIA CARUARU',
  'NEWVIA IMBIRIBEIRA',
  'NEWVIA LAURO',
  'NEWVIA WASH. SOARES',
  'NEWVIA PIEDADE',
  'NEWVIA PARQUELANDIA',
  'NISSAN AFOGADOS',
  'NISSAN CAXANGA',
  'NISSAN IGUATEMI',
  'NISSAN IMBIRIBEIRA',
  'NISSAN LAURO',
  'NISSAN PARALELA',
  'NISSAN RIO VERMELHO',
  'OMODA ABDIAS',
  'OMODA ALDEOTA',
  'OMODA PARALELA',
  'RENAULT AFOGADOS',
  'RENAULT IGUATEMI',
  'RENAULT IMBIRIBEIRA',
  'RENAULT IMBIRIBEIRA SEMINOVOS',
  'RENAULT LAURO',
  'RENAULT OLINDA',
  'RENAULT PIEDADE',
  'RENAULT PRADO SEMINOVOS',
  'LEAP IMBIRIBEIRA',
  'VIA SUL ARRUDA',
  'VIA SUL AV. NORTE SEMINOVOS',
  'VIA SUL DUNAS',
  'VIA SUL MATRIZ',
];

export const CADASTRO_DEPARTAMENTOS: string[] = [
  '30129-CAIXA LOJA - DEPTO.OFICINA',
  '30132-CAIXA LOJA - DEPTO. SEMINOVOS',
  '30133-CAIXA LOJA - DEPTO. V. NOVOS',
  '30135-CAIXA LOJA - DEPTO. PEÇAS',
  '30138-CAIXA LOJA - DEPARTAMENTO FUNILARIA',
];

export const CADASTRO_CONTAS_GERENCIAIS: string[] = [
  '30129-CAIXA LOJA - DEPTO.OFICINA',
  '30132-CAIXA LOJA - DEPTO. SEMINOVOS',
  '30133-CAIXA LOJA - DEPTO. V. NOVOS',
  '30135-CAIXA LOJA - DEPTO. PEÇAS',
  '30138-CAIXA LOJA - DEPARTAMENTO FUNILARIA',
];

/**
 * Verifica se um cabeçalho de coluna refere-se a Empresa / Filial / Loja
 */
export function isEmpresaColumn(headerName: string): boolean {
  if (!headerName) return false;
  const norm = headerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    norm.includes('empresa') ||
    norm.includes('filial') ||
    norm.includes('loja') ||
    norm.includes('unidade') ||
    norm.includes('concessionaria')
  );
}

/**
 * Verifica se um cabeçalho de coluna refere-se a Departamento / Depto / Setor
 */
export function isDepartamentoColumn(headerName: string): boolean {
  if (!headerName) return false;
  const norm = headerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    norm.includes('departamento') ||
    norm.includes('depto') ||
    norm.includes('setor') ||
    norm.includes('dep.') ||
    norm.includes('centro de custo')
  );
}

/**
 * Verifica se um cabeçalho de coluna refere-se a Conta Gerencial
 */
export function isContaGerencialColumn(headerName: string): boolean {
  if (!headerName) return false;
  const norm = headerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    norm.includes('conta gerencial') ||
    norm.includes('conta_gerencial') ||
    norm.includes('cta gerencial') ||
    norm.includes('cta. gerencial') ||
    norm.includes('cta_gerencial') ||
    norm.includes('plano de contas') ||
    (norm.includes('conta') && !norm.includes('contato'))
  );
}

/**
 * Verifica se um cabeçalho de coluna refere-se a Data / Data do Cx
 */
export function isDateColumn(headerName: string): boolean {
  if (!headerName) return false;
  const norm = headerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    norm.includes('data') ||
    norm.includes('dt_') ||
    norm.includes('dt ') ||
    norm.includes('cx') ||
    norm.includes('caixa') ||
    norm.includes('date') ||
    norm.includes('periodo') ||
    norm.includes('emissao') ||
    norm.includes('vencimento')
  );
}

/**
 * Converte data em formato DD/MM/AAAA para YYYY-MM-DD (para <input type="date">)
 */
export function toInputDateFormat(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length <= 2 && parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Converte YYYY-MM-DD para DD/MM/AAAA
 */
export function toDisplayDateFormat(isoDateStr: string): string {
  if (!isoDateStr) return new Date().toLocaleDateString('pt-BR');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoDateStr)) return isoDateStr;
  const parts = isoDateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return isoDateStr;
}
