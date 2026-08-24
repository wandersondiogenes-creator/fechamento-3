import { ColumnConfig } from '@/types/spreadsheet';
import { parseCurrencyToNumber, parseAndFormatDate, mapSitefEmpresa, removeAccents } from './validators';
import { formatCurrency, parseNumber } from './utils';

export interface FechamentoItem {
  id: string;
  empresa: string;
  departamento?: string;
  contaGerencial?: string;
  caixaLoja?: string;
  nsu?: string;
  data: string;
  dataDealer?: string;
  dataSitef?: string;
  tipoPagamento?: string;
  bandeiraDealer?: string;
  bandeiraSitef?: string;
  valorDealer: number;
  valorSitef: number;
  diferenca: number;
  status: string; // 'CONCILIADO' | 'DIVERGENTE' | 'VALIDAÇÃO NECESSÁRIA (PIX)' | 'PENDENTE'
  motivoDivergencia?: string;
  criterioConciliacao?: string;
  temDivergencia: boolean;
  isPixValidationNeeded?: boolean;
  registroDealer?: any;
  registroSitef?: any;
  isManual?: boolean;
  tipo?: 'entrada' | 'saida';
  valor?: number;
  banco?: string;
  metaData?: Record<string, any>;
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

export function deduplicateItems(items: FechamentoItem[]): FechamentoItem[] {
  if (!items || !Array.isArray(items)) return [];
  const map = new Map<string, FechamentoItem>();
  items.forEach((item) => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

export function calculateSummaryMetrics(items: FechamentoItem[]): FechamentoSummary {
  let totalDealer = 0;
  let totalSitef = 0;
  let countDivergencias = 0;
  let countConciliados = 0;
  let countPixValidacao = 0;

  (items || []).forEach((item) => {
    const vd = Number(item.valorDealer || item.valor || 0);
    const vs = Number(item.valorSitef || 0);
    totalDealer += vd;
    totalSitef += vs;

    if (item.isPixValidationNeeded || (item.status && item.status.includes('VALIDAÇÃO NECESSÁRIA'))) {
      countPixValidacao++;
    }

    if (item.temDivergencia || item.status === 'divergente' || (item.status && item.status.includes('DIVERGENTE'))) {
      countDivergencias++;
    } else {
      countConciliados++;
    }
  });

  const diferencaTotal = Math.round((totalDealer - totalSitef) * 100) / 100;

  return {
    totalDealer: Math.round(totalDealer * 100) / 100,
    totalSitef: Math.round(totalSitef * 100) / 100,
    diferencaTotal,
    countTotal: items.length,
    countDivergencias,
    countConciliados,
    countPixValidacao,
  };
}

function findColumnId(
  columns: ColumnConfig[],
  matcher: (headerNorm: string, type?: string) => boolean
): string | null {
  for (const col of columns) {
    const h = (col.customHeader || col.originalHeader || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (matcher(h, col.type)) {
      return col.id;
    }
  }
  return null;
}

export function generateAutoFechamento(
  dealerRows: Record<string, any>[],
  dealerCols: ColumnConfig[],
  sitefRows: Record<string, any>[],
  sitefCols: ColumnConfig[]
): FechamentoItem[] {
  if ((!dealerRows || dealerRows.length === 0) && (!sitefRows || sitefRows.length === 0)) {
    return [];
  }

  // Identify column IDs in Dealer
  const dealerEmpresaCol = findColumnId(dealerCols, (h) =>
    h.includes('empresa') || h.includes('filial') || h.includes('loja') || h.includes('concessionaria')
  );
  const dealerDeptoCol = findColumnId(dealerCols, (h) =>
    h.includes('departamento') || h.includes('depto') || h.includes('setor') || h.includes('dep.')
  );
  const dealerContaCol = findColumnId(dealerCols, (h) =>
    h.includes('conta') || h.includes('cta') || h.includes('gerencial')
  );
  const dealerCaixaCol = findColumnId(dealerCols, (h) =>
    h.includes('caixa') || h.includes('cx')
  );
  const dealerDataCol = findColumnId(dealerCols, (h, type) =>
    type === 'date' || h.includes('data') || h.includes('dt_') || h.includes('emissao') || h.includes('movimento')
  );
  const dealerNsuCol = findColumnId(dealerCols, (h) =>
    h.includes('nsu') || h.includes('doc') || h.includes('documento') || h.includes('autorizacao') || h.includes('tid') || h.includes('comprovante')
  );
  const dealerBandeiraCol = findColumnId(dealerCols, (h) =>
    h.includes('bandeira') || h.includes('cartao') || h.includes('operacao') || h.includes('historico') || h.includes('descricao') || h.includes('tipo')
  );
  const dealerValorCol = findColumnId(dealerCols, (h, type) =>
    h.includes('entrada') || h.includes('vlr entrada') || (type === 'currency' && !h.includes('saida') && !h.includes('taxa')) || h.includes('valor') || h.includes('bruto')
  );

  // Identify column IDs in SiTef
  const sitefEmpresaCol = findColumnId(sitefCols, (h) =>
    h.includes('empresa') || h.includes('loja') || h.includes('filial') || h.includes('comp') || h.includes('estabelecimento') || h.includes('rede')
  );
  const sitefDataCol = findColumnId(sitefCols, (h, type) =>
    type === 'date' || h.includes('data') || h.includes('dt') || h.includes('transacao') || h.includes('venda')
  );
  const sitefNsuCol = findColumnId(sitefCols, (h) =>
    h.includes('nsu') || h.includes('aut') || h.includes('cupom') || h.includes('comprovante') || h.includes('doc')
  );
  const sitefBandeiraCol = findColumnId(sitefCols, (h) =>
    h.includes('bandeira') || h.includes('rede') || h.includes('produto') || h.includes('modalidade') || h.includes('tipo')
  );
  const sitefValorCol = findColumnId(sitefCols, (h, type) =>
    h.includes('bruto') || h.includes('liquido') || h.includes('valor') || type === 'currency'
  );

  // Parse Sitef rows
  const parsedSitef = (sitefRows || []).map((row, idx) => {
    const rawEmpresa = sitefEmpresaCol ? row[sitefEmpresaCol] : row.col_0 || '';
    const empresa = mapSitefEmpresa(String(rawEmpresa || 'Empresa 01'));
    const dataRaw = sitefDataCol ? row[sitefDataCol] : row.col_1 || '';
    const data = parseAndFormatDate(dataRaw, 'DD/MM/YYYY');
    const nsu = sitefNsuCol ? String(row[sitefNsuCol] || '').trim() : '';
    const bandeira = sitefBandeiraCol ? String(row[sitefBandeiraCol] || '').trim().toUpperCase() : 'CARTÃO';
    const rawValor = sitefValorCol ? row[sitefValorCol] : row.col_2;
    const valor = typeof rawValor === 'number' ? rawValor : (parseCurrencyToNumber(rawValor) || 0);

    return {
      index: idx,
      empresa,
      data,
      nsu,
      bandeira,
      valor: Math.round(valor * 100) / 100,
      matched: false,
      raw: row,
    };
  });

  const resultItems: FechamentoItem[] = [];

  // Reconcile Dealer rows against parsed Sitef
  (dealerRows || []).forEach((row, idx) => {
    const rawEmpresa = dealerEmpresaCol ? row[dealerEmpresaCol] : row.col_0 || '';
    const empresa = mapSitefEmpresa(String(rawEmpresa || 'Empresa 01'));
    const departamento = dealerDeptoCol ? String(row[dealerDeptoCol] || '').trim() : '';
    const contaGerencial = dealerContaCol ? String(row[dealerContaCol] || '').trim() : departamento;
    const caixaLoja = dealerCaixaCol ? String(row[dealerCaixaCol] || '').trim() : '';
    const dataRaw = dealerDataCol ? row[dealerDataCol] : row.col_1 || '';
    const data = parseAndFormatDate(dataRaw, 'DD/MM/YYYY');
    const nsu = dealerNsuCol ? String(row[dealerNsuCol] || '').trim() : '';
    const bandeiraDealer = dealerBandeiraCol ? String(row[dealerBandeiraCol] || '').trim().toUpperCase() : 'CARTÃO';
    const rawValor = dealerValorCol ? row[dealerValorCol] : row.col_2;
    const valorDealer = typeof rawValor === 'number' ? rawValor : (parseCurrencyToNumber(rawValor) || 0);
    const roundedValorDealer = Math.round(valorDealer * 100) / 100;

    const isPix = bandeiraDealer.includes('PIX') || contaGerencial.toUpperCase().includes('PIX') || departamento.toUpperCase().includes('PIX');
    const tipoPagamento = isPix ? 'PIX' : (bandeiraDealer.includes('DEB') ? 'DEBITO' : 'CREDITO');

    // Find best match in SiTef
    let matchedSitef: (typeof parsedSitef)[0] | null = null;
    let matchType = '';

    // Match 1: Same NSU (if non-empty) + same empresa
    if (nsu && nsu.length >= 3) {
      matchedSitef = parsedSitef.find(
        (s) => !s.matched && s.nsu && (s.nsu === nsu || s.nsu.endsWith(nsu) || nsu.endsWith(s.nsu)) && (s.empresa === empresa || !empresa)
      ) || null;
      if (matchedSitef) matchType = 'NSU / Autorização';
    }

    // Match 2: Same Empresa + same data + same exact value
    if (!matchedSitef) {
      matchedSitef = parsedSitef.find(
        (s) => !s.matched && s.empresa === empresa && (s.data === data || !data) && Math.abs(s.valor - roundedValorDealer) < 0.01
      ) || null;
      if (matchedSitef) matchType = 'Empresa, Data e Valor Exato';
    }

    // Match 3: Same Empresa + same exact value (tolerance +/- 0.05)
    if (!matchedSitef) {
      matchedSitef = parsedSitef.find(
        (s) => !s.matched && s.empresa === empresa && Math.abs(s.valor - roundedValorDealer) <= 0.05
      ) || null;
      if (matchedSitef) matchType = 'Empresa e Valor Próximo';
    }

    // Match 4: Same Data + exact value
    if (!matchedSitef && parsedSitef.length > 0) {
      matchedSitef = parsedSitef.find(
        (s) => !s.matched && (s.data === data || !data) && Math.abs(s.valor - roundedValorDealer) < 0.01
      ) || null;
      if (matchedSitef) matchType = 'Data e Valor';
    }

    if (matchedSitef) {
      matchedSitef.matched = true;
      const valorSitef = matchedSitef.valor;
      const diferenca = Math.round((roundedValorDealer - valorSitef) * 100) / 100;
      const temDivergencia = Math.abs(diferenca) >= 0.01;

      let status = 'CONCILIADO';
      let motivo = '';
      if (temDivergencia) {
        status = 'DIVERGENTE';
        motivo = `Diferença de valor: Dealer R$ ${roundedValorDealer.toFixed(2)} vs SiTef R$ ${valorSitef.toFixed(2)}`;
      } else if (isPix) {
        status = 'CONCILIADO';
      }

      resultItems.push({
        id: `fech_d_${idx}_${Date.now()}`,
        empresa,
        departamento: departamento || '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        contaGerencial: contaGerencial || departamento || '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        caixaLoja: caixaLoja || '01',
        nsu: nsu || matchedSitef.nsu || `NSU-${1000 + idx}`,
        data: data || matchedSitef.data || new Date().toLocaleDateString('pt-BR'),
        dataDealer: data,
        dataSitef: matchedSitef.data,
        tipoPagamento,
        bandeiraDealer,
        bandeiraSitef: matchedSitef.bandeira,
        valorDealer: roundedValorDealer,
        valorSitef,
        diferenca,
        status,
        motivoDivergencia: motivo || undefined,
        criterioConciliacao: matchType || 'Automático',
        temDivergencia,
        isPixValidationNeeded: isPix && temDivergencia,
        registroDealer: row,
        registroSitef: matchedSitef.raw,
        tipo: 'entrada',
        valor: roundedValorDealer,
      });
    } else {
      // Unmatched Dealer entry
      const temDivergencia = true;
      let status = isPix ? 'VALIDAÇÃO NECESSÁRIA (PIX)' : 'DIVERGENTE';
      let motivo = isPix
        ? 'Lançamento PIX no Dealer aguardando confirmação bancária / extrato'
        : 'Lançamento no Dealer sem correspondente localizado no SiTef';

      resultItems.push({
        id: `fech_d_unmatched_${idx}_${Date.now()}`,
        empresa,
        departamento: departamento || '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        contaGerencial: contaGerencial || departamento || '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        caixaLoja: caixaLoja || '01',
        nsu: nsu || `NSU-${1000 + idx}`,
        data: data || new Date().toLocaleDateString('pt-BR'),
        dataDealer: data,
        tipoPagamento,
        bandeiraDealer,
        valorDealer: roundedValorDealer,
        valorSitef: 0,
        diferenca: roundedValorDealer,
        status,
        motivoDivergencia: motivo,
        criterioConciliacao: 'Não localizado no SiTef',
        temDivergencia,
        isPixValidationNeeded: isPix,
        registroDealer: row,
        tipo: 'entrada',
        valor: roundedValorDealer,
      });
    }
  });

  // Remaining unmatched SiTef entries
  parsedSitef
    .filter((s) => !s.matched)
    .forEach((s, idx) => {
      const diferenca = -s.valor;
      resultItems.push({
        id: `fech_s_unmatched_${s.index}_${Date.now()}`,
        empresa: s.empresa,
        departamento: '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        contaGerencial: '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        caixaLoja: '01',
        nsu: s.nsu || `NSU-S-${2000 + idx}`,
        data: s.data || new Date().toLocaleDateString('pt-BR'),
        dataSitef: s.data,
        tipoPagamento: s.bandeira.includes('DEB') ? 'DEBITO' : 'CREDITO',
        bandeiraSitef: s.bandeira,
        valorDealer: 0,
        valorSitef: s.valor,
        diferenca,
        status: 'DIVERGENTE',
        motivoDivergencia: 'Transação capturada no SiTef sem lançamento correspondente no Dealer',
        criterioConciliacao: 'Não localizado no Dealer',
        temDivergencia: true,
        isPixValidationNeeded: false,
        registroSitef: s.raw,
        tipo: 'entrada',
        valor: s.valor,
      });
    });

  return deduplicateItems(resultItems);
}
