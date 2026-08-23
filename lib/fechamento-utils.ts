import { ColumnConfig } from '@/types/spreadsheet';
import { mapSitefEmpresa } from './validators';

export interface FechamentoItem {
  id: string;
  empresa: string;
  departamento: string;
  contaGerencial: string;
  caixaLoja: string;
  data: string;
  nsu: string;
  tipoPagamento: string;
  bandeiraDealer?: string;
  bandeiraSitef?: string;
  divergenciaBandeira?: boolean;
  isPix?: boolean;
  isPixValidationNeeded?: boolean;
  criterioConciliacao?: string;
  valorDealer: number;
  valorSitef: number;
  diferenca: number;
  status: string;
  temDivergencia: boolean;
  detalhes?: string;
  origem: 'auto' | 'manual';
  isManual?: boolean;
}

export interface FechamentoSummary {
  totalDealer: number;
  totalSitef: number;
  diferencaTotal: number;
  countTotal: number;
  countDivergencias: number;
  countConciliados: number;
  countPixValidacao: number;
}

export function parseNumericValue(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  const isNegative = str.includes('-') || str.includes('(');
  let cleaned = str.replace(/[^0-9.,]/g, '');
  if (!cleaned) return 0;

  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

export function extractNSU(strVal: any): string {
  if (strVal === null || strVal === undefined) return '';
  const str = String(strVal).trim();
  if (!str) return '';

  const match = str.match(/\b\d{4,15}\b/);
  if (match) {
    return match[0].replace(/^0+/, '') || match[0];
  }
  return str.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function normalizeBandeira(strVal: any): string {
  if (!strVal) return '';
  const s = String(strVal).trim().toUpperCase();
  if (!s) return '';
  if (s.includes('VISA')) return 'VISA';
  if (s.includes('MASTER') || s.includes('MC')) return 'MASTERCARD';
  if (s.includes('ELO')) return 'ELO';
  if (s.includes('AMEX') || s.includes('AMERICAN')) return 'AMEX';
  if (s.includes('HIPER')) return 'HIPERCARD';
  if (s.includes('DINERS')) return 'DINERS';
  if (s.includes('PIX')) return 'PIX';
  if (s.includes('ALELO')) return 'ALELO';
  if (s.includes('SODEXO') || s.includes('PLUXEE')) return 'SODEXO';
  if (s.includes('VR')) return 'VR';
  if (s.includes('TICKET')) return 'TICKET';
  return s;
}

export function cleanEmpresaKey(emp: string): string {
  if (!emp) return '01';
  const digits = emp.match(/\d+/);
  if (digits) {
    return digits[0].replace(/^0+/, '') || digits[0];
  }
  return emp.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseDateToTimestamp(dateVal: any): number | null {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  if (!str) return null;

  // DD/MM/YYYY or DD/MM/YY
  const brMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (brMatch) {
    let day = parseInt(brMatch[1], 10);
    let month = parseInt(brMatch[2], 10) - 1;
    let year = parseInt(brMatch[3], 10);
    if (year < 100) year += 2000;
    const dt = new Date(year, month, day);
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    let month = parseInt(isoMatch[2], 10) - 1;
    let day = parseInt(isoMatch[3], 10);
    const dt = new Date(year, month, day);
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  return null;
}

export function getDateDifferenceInDays(d1: any, d2: any): number | null {
  const ts1 = parseDateToTimestamp(d1);
  const ts2 = parseDateToTimestamp(d2);
  if (ts1 === null || ts2 === null) return null;

  const diffMs = Math.abs(ts1 - ts2);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function extractTimeStr(val: any): string | null {
  if (!val) return null;
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  const m = str.match(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/);
  return m ? m[0] : null;
}

export function extractDocTokens(val: any): string[] {
  if (!val) return [];
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  const matches = str.match(/\b\d{4,18}\b/g);
  return matches ? matches.map((m) => m.replace(/^0+/, '')) : [];
}

export function generateAutoFechamento(
  dealerRows: Record<string, any>[],
  dealerCols: ColumnConfig[],
  sitefRows: Record<string, any>[],
  sitefCols: ColumnConfig[]
): FechamentoItem[] {
  const findColId = (cols: ColumnConfig[], keywords: string[]): string | null => {
    for (const kw of keywords) {
      const match = cols.find((c) => {
        const h = (c.customHeader || c.originalHeader)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        return h.includes(kw);
      });
      if (match) return match.id;
    }
    return null;
  };

  // Column identifiers for Dealer
  const dealerEmpresaCol = findColId(dealerCols, ['empresa', 'filial', 'comp', 'loja']);
  const dealerDepartCol = findColId(dealerCols, ['departamento', 'dep', 'setor']);
  const dealerContaCol = findColId(dealerCols, ['conta', 'classificacao', 'plano']);
  const dealerCaixaCol = findColId(dealerCols, ['caixa', 'loja', 'terminal']);
  const dealerDataCol = findColId(dealerCols, ['data', 'dt_']);
  const dealerNsuCol = findColId(dealerCols, ['nsu', 'doc', 'historico', 'num', 'autorizacao']);
  const dealerBandeiraCol = findColId(dealerCols, ['bandeira', 'operadora', 'cartao']);
  const dealerTipoCol = findColId(dealerCols, ['tipo', 'forma', 'pagamento', 'historico']);
  const dealerValorCol = findColId(dealerCols, ['entrada', 'valor bruto', 'bruto', 'valor', 'vlr']);

  // Column identifiers for SiTef (Prioritizing NSU HOST)
  const sitefEmpresaCol = findColId(sitefCols, ['empresa', 'loja', 'filial', 'comp']);
  const sitefDepartCol = findColId(sitefCols, ['departamento', 'dep', 'setor']);
  const sitefContaCol = findColId(sitefCols, ['conta']);
  const sitefCaixaCol = findColId(sitefCols, ['caixa', 'loja', 'terminal']);
  const sitefDataCol = findColId(sitefCols, ['data', 'dt_']);
  const sitefNsuCol = findColId(sitefCols, [
    'nsu host',
    'nsu_host',
    'nsuhost',
    'host_nsu',
    'nsu sitef',
    'host nsu',
    'nsu',
    'autorizacao',
    'cod',
    'doc',
  ]);
  const sitefBandeiraCol = findColId(sitefCols, ['bandeira', 'operadora', 'rede', 'cartao']);
  const sitefTipoCol = findColId(sitefCols, ['tipo', 'forma', 'bandeira']);
  const sitefValorCol = findColId(sitefCols, ['bruto', 'liquido', 'valor', 'vlr']);
  const sitefStatusCol = findColId(sitefCols, ['estado', 'status', 'situacao']);

  // Structured parsed Dealer rows
  interface ParsedDealerRow {
    index: number;
    row: Record<string, any>;
    empresaStr: string;
    empKey: string;
    departamento: string;
    conta: string;
    caixa: string;
    data: string;
    rawNsu: any;
    nsu: string;
    valDealer: number;
    rawTipo: string;
    rawBand: string;
    bandeiraNorm: string;
    isPix: boolean;
    used: boolean;
  }

  const parsedDealerRows: ParsedDealerRow[] = dealerRows.map((dRow, idx) => {
    const rawEmp = String(
      dealerEmpresaCol ? dRow[dealerEmpresaCol] || '' : ''
    ).trim();
    const empresaStr = rawEmp || 'Empresa 01';
    const empKey = cleanEmpresaKey(empresaStr);

    const rawDep = String(
      dealerDepartCol ? dRow[dealerDepartCol] || '' : dealerContaCol ? dRow[dealerContaCol] || '' : ''
    ).trim();
    const departamento = rawDep || 'Lançamentos Dealer';

    const conta = String(
      dealerContaCol ? dRow[dealerContaCol] || '' : '1.01.02 - Cartões de Crédito'
    ).trim() || '1.01.02 - Cartões de Crédito';

    const caixa = String(
      dealerCaixaCol ? dRow[dealerCaixaCol] || '' : 'Caixa Central'
    ).trim() || 'Caixa Central';

    const data = String(dealerDataCol ? dRow[dealerDataCol] || '' : '').trim();
    const rawNsu = dealerNsuCol ? dRow[dealerNsuCol] : Object.values(dRow).join(' ');
    const nsu = extractNSU(rawNsu);
    const valDealer = dealerValorCol ? parseNumericValue(dRow[dealerValorCol]) : 0;

    const rawTipo = dealerTipoCol ? String(dRow[dealerTipoCol] || '') : '';
    const rawBand = dealerBandeiraCol ? String(dRow[dealerBandeiraCol] || '') : rawTipo;
    const bandeiraNorm = normalizeBandeira(rawBand || rawTipo);

    const checkPix = (tipo: string, band: string, nsuStr: any, obj: Record<string, any>): boolean => {
      const combined = `${tipo} ${band} ${nsuStr || ''}`.toLowerCase();
      if (
        combined.includes('pix') ||
        combined.includes('pagamento instantaneo') ||
        combined.includes('qr code') ||
        combined.includes('qrc')
      ) {
        return true;
      }
      return Object.values(obj).some((v) => {
        const s = String(v || '').toLowerCase();
        return s.includes('pix') || s.includes('pagamento instantaneo');
      });
    };

    const isPix = checkPix(rawTipo, rawBand, rawNsu, dRow);

    return {
      index: idx,
      row: dRow,
      empresaStr,
      empKey,
      departamento,
      conta,
      caixa,
      data,
      rawNsu,
      nsu,
      valDealer,
      rawTipo,
      rawBand,
      bandeiraNorm,
      isPix,
      used: false,
    };
  });

  // Structured parsed SiTef rows
  interface ParsedSitefRow {
    index: number;
    row: Record<string, any>;
    rawEmp: string;
    mappedEmp: string;
    empKey: string;
    departamento: string;
    conta: string;
    caixa: string;
    data: string;
    rawNsu: any;
    nsu: string;
    valSitef: number;
    rawTipo: string;
    rawBand: string;
    bandeiraNorm: string;
    sStatus: string;
    isStatusProblem: boolean;
    isPix: boolean;
    used: boolean;
  }

  const parsedSitefRows: ParsedSitefRow[] = sitefRows.map((sRow, idx) => {
    const rawEmp = String(
      sitefEmpresaCol ? sRow[sitefEmpresaCol] || '' : ''
    ).trim();
    const mappedEmp = rawEmp ? mapSitefEmpresa(rawEmp) : 'Empresa 01';
    const empKey = cleanEmpresaKey(mappedEmp);

    const rawDep = String(
      sitefDepartCol ? sRow[sitefDepartCol] || '' : sitefContaCol ? sRow[sitefContaCol] || '' : ''
    ).trim();
    const departamento = rawDep || 'Extrato SiTef';

    const conta = String(
      sitefContaCol ? sRow[sitefContaCol] || '' : '1.01.02 - Cartões de Crédito'
    ).trim() || '1.01.02 - Cartões de Crédito';

    const caixa = String(
      sitefCaixaCol ? sRow[sitefCaixaCol] || '' : 'Caixa / Loja SiTef'
    ).trim() || 'Caixa / Loja SiTef';

    const data = String(sitefDataCol ? sRow[sitefDataCol] || '' : '').trim();
    const rawNsu = sitefNsuCol ? sRow[sitefNsuCol] : Object.values(sRow).join(' ');
    const nsu = extractNSU(rawNsu);
    const valSitef = sitefValorCol ? parseNumericValue(sRow[sitefValorCol]) : 0;

    const rawTipo = sitefTipoCol ? String(sRow[sitefTipoCol] || '') : '';
    const rawBand = sitefBandeiraCol ? String(sRow[sitefBandeiraCol] || '') : rawTipo;
    const bandeiraNorm = normalizeBandeira(rawBand || rawTipo);

    const sStatus = sitefStatusCol ? String(sRow[sitefStatusCol] || '').toUpperCase() : 'APROVADA';
    const isStatusProblem =
      sStatus.includes('CANCELAD') || sStatus.includes('NEGAD') || sStatus.includes('ESTORN');

    const checkPix = (tipo: string, band: string, nsuStr: any, obj: Record<string, any>): boolean => {
      const combined = `${tipo} ${band} ${nsuStr || ''}`.toLowerCase();
      if (
        combined.includes('pix') ||
        combined.includes('pagamento instantaneo') ||
        combined.includes('qr code') ||
        combined.includes('qrc')
      ) {
        return true;
      }
      return Object.values(obj).some((v) => {
        const s = String(v || '').toLowerCase();
        return s.includes('pix') || s.includes('pagamento instantaneo');
      });
    };

    const isPix = checkPix(rawTipo, rawBand, rawNsu, sRow);

    return {
      index: idx,
      row: sRow,
      rawEmp,
      mappedEmp,
      empKey,
      departamento,
      conta,
      caixa,
      data,
      rawNsu,
      nsu,
      valSitef,
      rawTipo,
      rawBand,
      bandeiraNorm,
      sStatus,
      isStatusProblem,
      isPix,
      used: false,
    };
  });

  // Index SiTef rows by clean NSU Host
  const sitefByNsuMap = new Map<string, ParsedSitefRow[]>();
  parsedSitefRows.forEach((s) => {
    if (s.nsu) {
      const list = sitefByNsuMap.get(s.nsu) || [];
      list.push(s);
      sitefByNsuMap.set(s.nsu, list);
    }
  });

  const fechamentoItems: FechamentoItem[] = [];

  // PASS 1: Match by NSU Host and EXACT VALUE only.
  // USER MANDATE: "não conciliar lançamentos com valores divergentes do dealer e o sitef"
  // If values are equal (diferenca < 0.01), conciliate them together.
  // If NSU matches but values diverge, DO NOT conciliate them into a single line; keep each in its company as unconciliated.
  parsedDealerRows.forEach((d) => {
    if (d.nsu && d.nsu !== 'PIX' && d.nsu !== 'S/N' && sitefByNsuMap.has(d.nsu)) {
      const candidates = sitefByNsuMap.get(d.nsu)!;
      // Find candidate with SAME NSU and SAME EXACT VALUE
      const exactCandidate = candidates.find(
        (c) => !c.used && Math.abs(d.valDealer - c.valSitef) < 0.01 && (c.empKey === d.empKey || !c.rawEmp)
      ) || candidates.find(
        (c) => !c.used && Math.abs(d.valDealer - c.valSitef) < 0.01
      );

      if (exactCandidate && !exactCandidate.isStatusProblem) {
        d.used = true;
        exactCandidate.used = true;

        const isPixMatch = d.isPix || exactCandidate.isPix;
        const hasBandDivergence =
          !isPixMatch &&
          Boolean(d.bandeiraNorm) &&
          Boolean(exactCandidate.bandeiraNorm) &&
          d.bandeiraNorm !== exactCandidate.bandeiraNorm;

        const statusStr = hasBandDivergence
          ? 'DIVERGÊNCIA DE BANDEIRA'
          : isPixMatch
          ? 'CONCILIADO (PIX)'
          : 'CONCILIADO';

        fechamentoItems.push({
          id: `auto_d_${d.index}_s_${exactCandidate.index}`,
          empresa: d.empresaStr || exactCandidate.mappedEmp,
          departamento: d.departamento,
          contaGerencial: d.conta,
          caixaLoja: d.caixa,
          data: d.data || exactCandidate.data,
          nsu: d.nsu || exactCandidate.nsu,
          tipoPagamento: isPixMatch ? 'PIX' : (d.bandeiraNorm || exactCandidate.bandeiraNorm || 'Cartão de Crédito'),
          bandeiraDealer: isPixMatch ? 'PIX' : (d.bandeiraNorm || 'Cartão'),
          bandeiraSitef: isPixMatch ? 'PIX' : (exactCandidate.bandeiraNorm || 'Cartão'),
          divergenciaBandeira: hasBandDivergence,
          isPix: isPixMatch,
          valorDealer: d.valDealer,
          valorSitef: exactCandidate.valSitef,
          diferenca: 0,
          status: statusStr,
          temDivergencia: hasBandDivergence,
          criterioConciliacao: isPixMatch ? 'Mesmo NSU e Valor (PIX)' : 'NSU Host e Valor Idênticos',
          detalhes: hasBandDivergence
            ? `Valores iguais (R$ ${d.valDealer.toFixed(2)}), mas bandeiras divergentes: ${d.bandeiraNorm} (Dealer) vs ${exactCandidate.bandeiraNorm} (SiTef)`
            : `Lançamento conciliado com sucesso (NSU ${d.nsu} e Valor R$ ${d.valDealer.toFixed(2)})`,
          origem: 'auto',
        });
      }
    }
  });

  // PASS 2: Match PIX Transactions with EXACT VALUE within the SAME Empresa
  parsedSitefRows.forEach((s) => {
    if (s.used || !s.isPix) return;

    const exactCandidates = parsedDealerRows.filter((d) => {
      if (d.used || !d.isPix) return false;
      const sameEmpresa = d.empKey === s.empKey;
      const sameValue = Math.abs(d.valDealer - s.valSitef) < 0.01;
      return sameEmpresa && sameValue;
    });

    if (exactCandidates.length > 0) {
      let winner = exactCandidates[0];
      let minDateDiff = getDateDifferenceInDays(winner.data, s.data) ?? 999;

      for (let i = 1; i < exactCandidates.length; i++) {
        const dDiff = getDateDifferenceInDays(exactCandidates[i].data, s.data) ?? 999;
        if (dDiff < minDateDiff) {
          minDateDiff = dDiff;
          winner = exactCandidates[i];
        }
      }

      s.used = true;
      winner.used = true;

      fechamentoItems.push({
        id: `auto_d_${winner.index}_s_${s.index}`,
        empresa: winner.empresaStr || s.mappedEmp,
        departamento: winner.departamento,
        contaGerencial: winner.conta,
        caixaLoja: winner.caixa,
        data: winner.data || s.data,
        nsu: winner.nsu || s.nsu || 'PIX',
        tipoPagamento: 'PIX',
        bandeiraDealer: 'PIX',
        bandeiraSitef: 'PIX',
        divergenciaBandeira: false,
        isPix: true,
        isPixValidationNeeded: false,
        valorDealer: winner.valDealer,
        valorSitef: s.valSitef,
        diferenca: 0,
        status: 'CONCILIADO (PIX)',
        temDivergencia: false,
        criterioConciliacao: minDateDiff === 0 ? 'Mesma Empresa, Valor Exato e Data' : 'Mesma Empresa e Valor Exato',
        detalhes: `Lançamento Pix conciliado com sucesso na empresa ${winner.empresaStr} (Valor R$ ${winner.valDealer.toFixed(2)})`,
        origem: 'auto',
      });
    }
  });

  // PASS 3: Remaining Unconciliated Dealer Rows
  // USER MANDATE: Do not create 'departamento diversos'; keep directly inside the company and show as unconciliated
  parsedDealerRows.forEach((d) => {
    if (d.used) return;
    d.used = true;

    // Check if there is a sitef transaction with same NSU but different value
    const matchingNsuSitef = d.nsu && d.nsu !== 'PIX' && d.nsu !== 'S/N'
      ? parsedSitefRows.find((s) => s.nsu === d.nsu)
      : null;

    let statusStr = 'NÃO CONCILIADO (DEALER)';
    let detalhesStr = 'Lançamento presente no Dealer sem correspondência exata no SiTef';

    if (matchingNsuSitef) {
      statusStr = 'DIVERGÊNCIA DE VALOR (NÃO CONCILIADO)';
      detalhesStr = `NSU ${d.nsu} localizado no SiTef com valor divergente: Dealer R$ ${d.valDealer.toFixed(2)} vs SiTef R$ ${matchingNsuSitef.valSitef.toFixed(2)}. Não conciliado.`;
    } else if (d.isPix) {
      statusStr = 'PIX NÃO CONCILIADO (DEALER)';
      detalhesStr = `Lançamento Pix de R$ ${d.valDealer.toFixed(2)} registrado no Dealer, não localizado no extrato SiTef desta empresa.`;
    }

    fechamentoItems.push({
      id: `auto_d_${d.index}`,
      empresa: d.empresaStr,
      departamento: d.departamento,
      contaGerencial: d.conta,
      caixaLoja: d.caixa,
      data: d.data,
      nsu: d.nsu || (d.isPix ? 'PIX' : 'S/N'),
      tipoPagamento: d.isPix ? 'PIX' : (d.bandeiraNorm || 'Cartão de Crédito'),
      bandeiraDealer: d.isPix ? 'PIX' : (d.bandeiraNorm || 'Cartão'),
      bandeiraSitef: '—',
      divergenciaBandeira: false,
      isPix: d.isPix,
      valorDealer: d.valDealer,
      valorSitef: 0,
      diferenca: d.valDealer,
      status: statusStr,
      temDivergencia: true,
      detalhes: detalhesStr,
      origem: 'auto',
    });
  });

  // PASS 4: Remaining Unconciliated SiTef Rows
  // USER MANDATE: Do not create 'departamento diversos'; keep directly inside the company and show as unconciliated
  parsedSitefRows.forEach((s) => {
    if (s.used) return;
    s.used = true;

    // Check if there is a dealer transaction with same NSU but different value
    const matchingNsuDealer = s.nsu && s.nsu !== 'PIX' && s.nsu !== 'S/N'
      ? parsedDealerRows.find((d) => d.nsu === s.nsu)
      : null;

    let statusStr = 'NÃO CONCILIADO (SITEF)';
    let detalhesStr = 'Lançamento no extrato SiTef sem correspondência exata no Dealer';

    if (s.isStatusProblem) {
      statusStr = `STATUS SITEF: ${s.sStatus}`;
      detalhesStr = `Transação com status ${s.sStatus} no SiTef. Não conciliada.`;
    } else if (matchingNsuDealer) {
      statusStr = 'DIVERGÊNCIA DE VALOR (NÃO CONCILIADO)';
      detalhesStr = `NSU ${s.nsu} localizado no Dealer com valor divergente: SiTef R$ ${s.valSitef.toFixed(2)} vs Dealer R$ ${matchingNsuDealer.valDealer.toFixed(2)}. Não conciliado.`;
    } else if (s.isPix) {
      statusStr = 'PIX NÃO CONCILIADO (SITEF)';
      detalhesStr = `Lançamento Pix de R$ ${s.valSitef.toFixed(2)} no extrato SiTef não localizado no Dealer desta empresa.`;
    }

    fechamentoItems.push({
      id: `auto_s_${s.index}`,
      empresa: s.mappedEmp,
      departamento: s.departamento,
      contaGerencial: s.conta,
      caixaLoja: s.caixa,
      data: s.data,
      nsu: s.nsu || (s.isPix ? 'PIX' : 'S/N'),
      tipoPagamento: s.isPix ? 'PIX' : (s.bandeiraNorm || 'Cartão de Crédito'),
      bandeiraDealer: '—',
      bandeiraSitef: s.isPix ? 'PIX' : (s.bandeiraNorm || 'Cartão'),
      divergenciaBandeira: false,
      isPix: s.isPix,
      valorDealer: 0,
      valorSitef: s.valSitef,
      diferenca: -s.valSitef,
      status: statusStr,
      temDivergencia: true,
      detalhes: detalhesStr,
      origem: 'auto',
    });
  });

  return fechamentoItems;
}
