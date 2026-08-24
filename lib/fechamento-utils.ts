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
  isPix?: boolean;
  isPixValidationNeeded?: boolean;
  divergenciaBandeira?: boolean;
  origem?: string;
  detalhes?: string;
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

export function normalizeNsu(nsu: any): string {
  if (nsu === null || nsu === undefined) return '';
  const str = String(nsu).trim().replace(/[^a-zA-Z0-9]/g, '');
  if (!str) return '';
  // Strip leading zeros for numeric or alphanumeric values
  const stripped = str.replace(/^0+/, '');
  return stripped || '0';
}

export function isNsuMatch(nsuA: any, nsuB: any): boolean {
  if (!nsuA || !nsuB) return false;
  const strA = String(nsuA).trim();
  const strB = String(nsuB).trim();
  if (!strA || !strB) return false;

  const normA = normalizeNsu(strA);
  const normB = normalizeNsu(strB);
  if (!normA || !normB || normA === '0' || normB === '0') return false;

  // Exact normalized match (e.g. "000123" == "123")
  if (normA === normB) return true;

  // Suffix matching for terminal prefix differences (if at least 3 digits)
  if (normA.length >= 3 && normB.length >= 3) {
    if (normA.endsWith(normB) || normB.endsWith(normA)) return true;
  }
  return false;
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
    h.includes('nsu') || h.includes('doc') || h.includes('documento') || h.includes('autorizacao') || h.includes('tid') || h.includes('comprovante') || h.includes('docto')
  );
  const dealerBandeiraCol = findColumnId(dealerCols, (h) =>
    h.includes('bandeira') || h.includes('cartao') || h.includes('operacao') || h.includes('historico') || h.includes('descricao') || h.includes('tipo') || h.includes('forma')
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
  
  // Specific NSU Host column for Credit/Debit Cards
  const sitefNsuHostCol = findColumnId(sitefCols, (h) =>
    h.includes('nsu host') ||
    h.includes('nsu_host') ||
    h.includes('nsuhost') ||
    h.includes('host') ||
    h.includes('rede nsu') ||
    h.includes('aut host') ||
    h.includes('autorizacao host') ||
    h.includes('autorização host')
  );

  // Specific NSU SiTef / Doc column for PIX
  const sitefNsuSitefCol = findColumnId(sitefCols, (h) =>
    (h.includes('sitef') && h.includes('nsu')) ||
    h.includes('nsu_sitef') ||
    h.includes('nsusitef') ||
    (h.includes('nsu') && !h.includes('host')) ||
    h.includes('doc') ||
    h.includes('cupom') ||
    h.includes('controle') ||
    h.includes('comprovante')
  );

  const sitefNsuCol = sitefNsuSitefCol || findColumnId(sitefCols, (h) =>
    h.includes('nsu') || h.includes('aut') || h.includes('cupom') || h.includes('comprovante') || h.includes('doc')
  );

  const sitefProdutoCol = findColumnId(sitefCols, (h) =>
    h.includes('produto') || h.includes('modalidade') || h.includes('servico') || h.includes('tipo') || h.includes('forma') || h.includes('pagamento')
  );
  const sitefBandeiraCol = findColumnId(sitefCols, (h) =>
    h.includes('bandeira') || h.includes('rede') || h.includes('operadora') || h.includes('cartao')
  ) || sitefProdutoCol;
  const sitefValorCol = findColumnId(sitefCols, (h, type) =>
    h.includes('bruto') || h.includes('liquido') || h.includes('valor') || type === 'currency'
  );

  // Extract unique active Dealer companies directly from Dealer rows (The absolute source of truth)
  const activeDealerEmpresas = Array.from(
    new Set(
      (dealerRows || [])
        .map((row) => {
          const val = dealerEmpresaCol ? row[dealerEmpresaCol] : row.col_0;
          return val ? String(val).trim() : '';
        })
        .filter(Boolean)
    )
  );

  // Parse Sitef rows with Dealer company priority and PIX detection
  const parsedSitef = (sitefRows || []).map((row, idx) => {
    const rawEmpresa = sitefEmpresaCol ? row[sitefEmpresaCol] : row.col_0 || '';
    // Map SiTef company name using Dealer companies priority
    const empresa = mapSitefEmpresa(String(rawEmpresa || 'Empresa 01'), activeDealerEmpresas);
    const dataRaw = sitefDataCol ? row[sitefDataCol] : row.col_1 || '';
    const data = parseAndFormatDate(dataRaw, 'DD/MM/YYYY');

    // Extract NSU Host (primary for credit card)
    let nsuHost = '';
    if (sitefNsuHostCol && row[sitefNsuHostCol] !== undefined && row[sitefNsuHostCol] !== null) {
      nsuHost = String(row[sitefNsuHostCol]).trim();
    }
    if (!nsuHost) {
      for (const [k, v] of Object.entries(row)) {
        const kLow = k.toLowerCase();
        if ((kLow.includes('host') || kLow.includes('rede_nsu') || kLow.includes('aut_host')) && v !== undefined && v !== null && String(v).trim() !== '') {
          nsuHost = String(v).trim();
          break;
        }
      }
    }

    // Extract NSU SiTef (primary for PIX)
    let nsuSitef = '';
    if (sitefNsuSitefCol && row[sitefNsuSitefCol] !== undefined && row[sitefNsuSitefCol] !== null) {
      nsuSitef = String(row[sitefNsuSitefCol]).trim();
    } else if (sitefNsuCol && row[sitefNsuCol] !== undefined && row[sitefNsuCol] !== null) {
      nsuSitef = String(row[sitefNsuCol]).trim();
    }
    if (!nsuSitef) {
      for (const [k, v] of Object.entries(row)) {
        const kLow = k.toLowerCase();
        if ((kLow.includes('nsu') || kLow.includes('doc') || kLow.includes('cupom') || kLow.includes('controle')) && !kLow.includes('host') && v !== undefined && v !== null && String(v).trim() !== '') {
          nsuSitef = String(v).trim();
          break;
        }
      }
    }

    const nsu = nsuHost || nsuSitef || '';

    const rawBandeira = sitefBandeiraCol ? String(row[sitefBandeiraCol] || '').trim().toUpperCase() : '';
    const rawProduto = sitefProdutoCol ? String(row[sitefProdutoCol] || '').trim().toUpperCase() : '';
    const rawRowValues = Object.values(row).map((v) => String(v || '').toUpperCase());

    const isPix =
      rawBandeira.includes('PIX') ||
      rawProduto.includes('PIX') ||
      rawRowValues.some(
        (v) =>
          v.includes('PIX') ||
          v.includes('QR CODE') ||
          v.includes('QRCODE') ||
          v.includes('CARTEIRA DIGITAL')
      );

    const bandeira = isPix ? 'PIX' : (rawBandeira || rawProduto || 'CARTÃO');
    const rawValor = sitefValorCol ? row[sitefValorCol] : row.col_2;
    const valor = typeof rawValor === 'number' ? rawValor : (parseCurrencyToNumber(rawValor) || 0);

    return {
      index: idx,
      empresa,
      rawEmpresa: String(rawEmpresa || ''),
      data,
      nsu,
      nsuHost,
      nsuSitef,
      bandeira,
      isPix,
      valor: Math.round(valor * 100) / 100,
      matched: false,
      raw: row,
    };
  });

  const resultItems: FechamentoItem[] = [];

  // Reconcile Dealer rows against parsed Sitef
  (dealerRows || []).forEach((row, idx) => {
    const rawEmpresa = dealerEmpresaCol ? row[dealerEmpresaCol] : row.col_0 || '';
    // Dealer company is canonical
    const empresa = mapSitefEmpresa(String(rawEmpresa || 'Empresa 01'), activeDealerEmpresas);
    const departamento = dealerDeptoCol ? String(row[dealerDeptoCol] || '').trim() : '';
    const contaGerencial = dealerContaCol ? String(row[dealerContaCol] || '').trim() : departamento;
    const caixaLoja = dealerCaixaCol ? String(row[dealerCaixaCol] || '').trim() : '';
    const dataRaw = dealerDataCol ? row[dealerDataCol] : row.col_1 || '';
    const data = parseAndFormatDate(dataRaw, 'DD/MM/YYYY');
    
    // Extract Dealer NSU
    let nsu = dealerNsuCol ? String(row[dealerNsuCol] || '').trim() : '';
    if (!nsu) {
      for (const [k, v] of Object.entries(row)) {
        const kLow = k.toLowerCase();
        if ((kLow.includes('nsu') || kLow.includes('doc') || kLow.includes('autoriza') || kLow.includes('tid') || kLow.includes('comprovante') || kLow.includes('docto')) && v !== undefined && v !== null && String(v).trim() !== '') {
          nsu = String(v).trim();
          break;
        }
      }
    }

    const rawBandeiraDealer = dealerBandeiraCol ? String(row[dealerBandeiraCol] || '').trim().toUpperCase() : 'CARTÃO';
    const rawValor = dealerValorCol ? row[dealerValorCol] : row.col_2;
    const valorDealer = typeof rawValor === 'number' ? rawValor : (parseCurrencyToNumber(rawValor) || 0);
    const roundedValorDealer = Math.round(valorDealer * 100) / 100;

    const rawDealerRowValues = Object.values(row).map((v) => String(v || '').toUpperCase());
    const isDealerPix =
      rawBandeiraDealer.includes('PIX') ||
      contaGerencial.toUpperCase().includes('PIX') ||
      departamento.toUpperCase().includes('PIX') ||
      rawDealerRowValues.some(
        (v) =>
          v.includes('PIX') ||
          v.includes('QR CODE') ||
          v.includes('QRCODE') ||
          v.includes('CARTEIRA DIGITAL')
      );

    const bandeiraDealer = isDealerPix ? 'PIX' : rawBandeiraDealer;
    const tipoPagamento = isDealerPix ? 'PIX' : (bandeiraDealer.includes('DEB') ? 'DEBITO' : 'CREDITO');

    // Multi-tier matching algorithm
    let matchedSitef: (typeof parsedSitef)[0] | null = null;
    let matchType = '';

    if (isDealerPix) {
      // ==========================================
      // ===== PIX MATCHING SPECIFIC RULES ========
      // ==========================================
      // Rule 1: NSU SiTef matches Dealer NSU + Same Empresa + Same Exact Value
      if (nsu) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.isPix &&
              s.empresa === empresa &&
              (isNsuMatch(nsu, s.nsuSitef) || isNsuMatch(nsu, s.nsu)) &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'PIX: NSU SiTef, Empresa e Valor Casados';
      }

      // Rule 2: NSU SiTef matches Dealer NSU + Same Empresa (value checked later)
      if (!matchedSitef && nsu) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.isPix &&
              s.empresa === empresa &&
              (isNsuMatch(nsu, s.nsuSitef) || isNsuMatch(nsu, s.nsu))
          ) || null;
        if (matchedSitef) matchType = 'PIX: NSU SiTef e Empresa Casados';
      }

      // Rule 3: User Mandate: Same Empresa + SiTef is PIX + Same Exact Value -> Casar e Conciliar Sem Divergência
      if (!matchedSitef) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.isPix &&
              s.empresa === empresa &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'PIX: Empresa, Produto SiTef e Valor Casados';
      }

      // Rule 4: Global NSU SiTef matches Dealer NSU + Same Exact Value
      if (!matchedSitef && nsu) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.isPix &&
              (isNsuMatch(nsu, s.nsuSitef) || isNsuMatch(nsu, s.nsu)) &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'PIX: NSU SiTef e Valor Global';
      }

      // Rule 5: Same Empresa + Same Exact Value (Independent of SiTef explicitly flagged as PIX)
      if (!matchedSitef) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.empresa === empresa &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'PIX / SiTef: Empresa e Valor Casados';
      }

      // Rule 6: Same Empresa + SiTef is PIX + Value within 5 centavos tolerance
      if (!matchedSitef) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.isPix &&
              s.empresa === empresa &&
              Math.abs(s.valor - roundedValorDealer) <= 0.05
          ) || null;
        if (matchedSitef) matchType = 'PIX: Empresa e Valor Próximo';
      }

      // Rule 7: Global NSU SiTef match
      if (!matchedSitef && nsu) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              (isNsuMatch(nsu, s.nsuSitef) || isNsuMatch(nsu, s.nsu))
          ) || null;
        if (matchedSitef) matchType = 'PIX: NSU SiTef Global';
      }

      // Rule 8: Global PIX exact value
      if (!matchedSitef) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.isPix &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'PIX: Valor Exato Global';
      }
    } else {
      // ==========================================
      // ===== CARTÃO (CRÉDITO / DÉBITO) RULES ====
      // ==========================================
      // User Mandate: Para cartão de crédito/débito, casar NSU Host do SiTef com NSU do Dealer
      
      // Tier 1: NSU Host matches Dealer NSU + Same Empresa + Same Exact Value
      if (nsu) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              !s.isPix &&
              s.empresa === empresa &&
              (isNsuMatch(nsu, s.nsuHost) || (!s.nsuHost && isNsuMatch(nsu, s.nsuSitef || s.nsu))) &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'Cartão: NSU Host, Empresa e Valor Exato';
      }

      // Tier 2: NSU Host matches Dealer NSU + Same Empresa (value checked later)
      if (!matchedSitef && nsu) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              !s.isPix &&
              s.empresa === empresa &&
              (isNsuMatch(nsu, s.nsuHost) || (!s.nsuHost && isNsuMatch(nsu, s.nsuSitef || s.nsu)))
          ) || null;
        if (matchedSitef) matchType = 'Cartão: NSU Host e Empresa';
      }

      // Tier 3: NSU Host matches Dealer NSU Global + Same Exact Value
      if (!matchedSitef && nsu) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              (isNsuMatch(nsu, s.nsuHost) || (!s.nsuHost && isNsuMatch(nsu, s.nsuSitef || s.nsu))) &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'Cartão: NSU Host e Valor Global';
      }

      // Tier 4: NSU Host matches Dealer NSU Global
      if (!matchedSitef && nsu) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              (isNsuMatch(nsu, s.nsuHost) || (!s.nsuHost && isNsuMatch(nsu, s.nsuSitef || s.nsu)))
          ) || null;
        if (matchedSitef) matchType = 'Cartão: NSU Host Global';
      }

      // Tier 5: Same Empresa + non-PIX + same data + same exact value
      if (!matchedSitef) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              !s.isPix &&
              s.empresa === empresa &&
              (s.data === data || !data) &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'Cartão: Empresa, Data e Valor Exato';
      }

      // Tier 6: Same Empresa + non-PIX + same exact value (independent of date)
      if (!matchedSitef) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              !s.isPix &&
              s.empresa === empresa &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'Cartão: Empresa e Valor Exato';
      }

      // Tier 7: Same Empresa + any SiTef item + same exact value
      if (!matchedSitef) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.empresa === empresa &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'Empresa e Valor Exato';
      }

      // Tier 8: Same Empresa + value within 5 centavos tolerance
      if (!matchedSitef) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              s.empresa === empresa &&
              Math.abs(s.valor - roundedValorDealer) <= 0.05
          ) || null;
        if (matchedSitef) matchType = 'Empresa e Valor Próximo';
      }

      // Tier 9: Same Data + exact value global
      if (!matchedSitef && parsedSitef.length > 0) {
        matchedSitef =
          parsedSitef.find(
            (s) =>
              !s.matched &&
              (s.data === data || !data) &&
              Math.abs(s.valor - roundedValorDealer) < 0.01
          ) || null;
        if (matchedSitef) matchType = 'Data e Valor Global';
      }
    }

    if (matchedSitef) {
      matchedSitef.matched = true;
      const valorSitef = matchedSitef.valor;
      const diferenca = Math.round((roundedValorDealer - valorSitef) * 100) / 100;
      const isPix = isDealerPix || matchedSitef.isPix;
      const temDivergencia = Math.abs(diferenca) >= 0.01;

      let status = 'CONCILIADO';
      let motivo = '';
      if (temDivergencia) {
        status = 'DIVERGENTE';
        motivo = `Diferença de valor: Dealer R$ ${roundedValorDealer.toFixed(2)} vs SiTef R$ ${valorSitef.toFixed(2)}`;
      } else {
        status = 'CONCILIADO';
      }

      const displayNsu = isPix
        ? (nsu || matchedSitef.nsuSitef || matchedSitef.nsu || 'PIX')
        : (nsu || matchedSitef.nsuHost || matchedSitef.nsuSitef || matchedSitef.nsu || `NSU-${1000 + idx}`);

      resultItems.push({
        id: `fech_d_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        empresa,
        departamento: departamento || '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        contaGerencial: contaGerencial || departamento || '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        caixaLoja: caixaLoja || '01',
        nsu: displayNsu,
        data: data || matchedSitef.data || new Date().toLocaleDateString('pt-BR'),
        dataDealer: data,
        dataSitef: matchedSitef.data,
        tipoPagamento: isPix ? 'PIX' : tipoPagamento,
        bandeiraDealer: isPix ? 'PIX' : bandeiraDealer,
        bandeiraSitef: isPix ? 'PIX' : matchedSitef.bandeira,
        valorDealer: roundedValorDealer,
        valorSitef,
        diferenca,
        status,
        motivoDivergencia: motivo || undefined,
        criterioConciliacao: matchType || (isPix ? 'PIX: Casado por Empresa e Valor' : 'Automático'),
        temDivergencia,
        isPix,
        isPixValidationNeeded: false,
        registroDealer: row,
        registroSitef: matchedSitef.raw,
        tipo: 'entrada',
        valor: roundedValorDealer,
      });
    } else {
      // Unmatched Dealer entry
      const temDivergencia = true;
      const status = isDealerPix ? 'VALIDAÇÃO NECESSÁRIA (PIX)' : 'DIVERGENTE';
      const motivo = isDealerPix
        ? 'Lançamento PIX no Dealer sem correspondente localizado no SiTef'
        : 'Lançamento no Dealer sem correspondente localizado no SiTef';

      resultItems.push({
        id: `fech_d_unmatched_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        empresa,
        departamento: departamento || '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        contaGerencial: contaGerencial || departamento || '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        caixaLoja: caixaLoja || '01',
        nsu: nsu || (isDealerPix ? 'PIX' : `NSU-${1000 + idx}`),
        data: data || new Date().toLocaleDateString('pt-BR'),
        dataDealer: data,
        tipoPagamento: isDealerPix ? 'PIX' : tipoPagamento,
        bandeiraDealer: isDealerPix ? 'PIX' : bandeiraDealer,
        valorDealer: roundedValorDealer,
        valorSitef: 0,
        diferenca: roundedValorDealer,
        status,
        motivoDivergencia: motivo,
        criterioConciliacao: 'Não localizado no SiTef',
        temDivergencia,
        isPix: isDealerPix,
        isPixValidationNeeded: isDealerPix,
        registroDealer: row,
        tipo: 'entrada',
        valor: roundedValorDealer,
      });
    }
  });

  // Remaining unmatched SiTef entries (adopting the normalized Dealer company name)
  parsedSitef
    .filter((s) => !s.matched)
    .forEach((s, idx) => {
      const diferenca = -s.valor;
      const displayNsu = s.isPix
        ? (s.nsuSitef || s.nsu || 'PIX')
        : (s.nsuHost || s.nsuSitef || s.nsu || `NSU-S-${2000 + idx}`);

      resultItems.push({
        id: `fech_s_unmatched_${s.index}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        empresa: s.empresa,
        departamento: '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        contaGerencial: '30133-CAIXA LOJA - DEPTO. V. NOVOS',
        caixaLoja: '01',
        nsu: displayNsu,
        data: s.data || new Date().toLocaleDateString('pt-BR'),
        dataSitef: s.data,
        tipoPagamento: s.isPix ? 'PIX' : (s.bandeira.includes('DEB') ? 'DEBITO' : 'CREDITO'),
        bandeiraSitef: s.isPix ? 'PIX' : s.bandeira,
        valorDealer: 0,
        valorSitef: s.valor,
        diferenca,
        status: 'DIVERGENTE',
        motivoDivergencia: s.isPix
          ? 'Transação PIX capturada no SiTef sem lançamento correspondente no Dealer'
          : 'Transação capturada no SiTef sem lançamento correspondente no Dealer',
        criterioConciliacao: 'Não localizado no Dealer',
        temDivergencia: true,
        isPix: s.isPix,
        isPixValidationNeeded: false,
        registroSitef: s.raw,
        tipo: 'entrada',
        valor: s.valor,
      });
    });

  return deduplicateItems(resultItems);
}
