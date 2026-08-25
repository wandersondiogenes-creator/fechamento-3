import * as XLSX from 'xlsx';
import { FechamentoItem, FechamentoSummary, calculateSummaryMetrics, deduplicateItems } from './fechamento-utils';
import { SpreadsheetState } from '@/types/spreadsheet';
import { ConciliationDetail } from './shared-fechamento-service';

export interface FechamentoBackupPayload {
  version: string;
  format: 'WANFINANCE_FECHAMENTO_BACKUP_V1';
  exportedAt: string;
  dataMovimento: string;
  operador: string;
  observacoes?: string;
  summary: FechamentoSummary;
  items: FechamentoItem[];
  conciliatedEmpresas: Record<string, boolean | ConciliationDetail>;
  dealerState?: SpreadsheetState;
  sitefState?: SpreadsheetState;
  pendenteCdcState?: SpreadsheetState;
}

export interface ExportFechamentoOptions {
  items: FechamentoItem[];
  conciliatedEmpresas: Record<string, boolean | ConciliationDetail>;
  dealerState?: SpreadsheetState;
  sitefState?: SpreadsheetState;
  pendenteCdcState?: SpreadsheetState;
  summary?: FechamentoSummary;
  dataMovimento?: string;
  operador?: string;
  observacoes?: string;
}

export interface ImportFechamentoResult {
  success: boolean;
  data?: {
    items: FechamentoItem[];
    conciliatedEmpresas: Record<string, boolean | ConciliationDetail>;
    dealerState?: SpreadsheetState;
    sitefState?: SpreadsheetState;
    pendenteCdcState?: SpreadsheetState;
    summary: FechamentoSummary;
    dataMovimento: string;
    operador?: string;
    observacoes?: string;
    exportedAt?: string;
  };
  error?: string;
}

const BACKUP_META_SHEET_NAME = '_WANFINANCE_BACKUP_';

/**
 * Exporta todo o estado do Fechamento, Planilhas Dealer/SiTef e status das 52 empresas
 * para um arquivo Excel (.xlsx) 100% restaurável e legível por humanos.
 */
export function exportFechamentoToExcel(options: ExportFechamentoOptions): void {
  const {
    items = [],
    conciliatedEmpresas = {},
    dealerState,
    sitefState,
    pendenteCdcState,
    dataMovimento = new Date().toLocaleDateString('pt-BR'),
    operador = 'Operador',
    observacoes = '',
  } = options;

  const sanitizedItems = deduplicateItems(items);
  const calculatedSummary = options.summary || calculateSummaryMetrics(sanitizedItems);

  const wb = XLSX.utils.book_new();

  // 1. Aba Visual 1: Lançamentos de Fechamento
  const sheetItemsData = sanitizedItems.map((item, idx) => ({
    '#': idx + 1,
    'Empresa (Dealer)': item.empresa || '',
    'Departamento': item.departamento || '',
    'Conta Gerencial': item.contaGerencial || '',
    'Caixa / Loja': item.caixaLoja || '',
    'Data': item.data || '',
    'NSU': item.nsu || '',
    'Tipo / Forma': item.tipoPagamento || '',
    'Bandeira Dealer': item.bandeiraDealer || '—',
    'Bandeira SiTef': item.bandeiraSitef || '—',
    'Divergência Bandeira?': item.divergenciaBandeira ? 'SIM' : 'NÃO',
    'Valor Dealer (R$)': Number(item.valorDealer) || 0,
    'Valor SiTef (R$)': Number(item.valorSitef) || 0,
    'Diferença (R$)': Number(item.diferenca) || 0,
    'Status Conciliação': item.status || 'PENDENTE',
    'Divergência?': item.temDivergencia ? 'SIM' : 'NÃO',
    'Validação PIX?': item.isPixValidationNeeded ? 'SIM' : 'NÃO',
    'Origem': item.origem || 'auto',
    'Detalhes / Motivo': item.detalhes || item.motivoDivergencia || '',
  }));

  const wsItems = XLSX.utils.json_to_sheet(sheetItemsData);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Fechamento_Conciliacao');

  // 2. Aba Visual 2: Status das 52 Empresas
  const empresasList = Object.keys(conciliatedEmpresas);
  const sheetEmpresasData = empresasList.map((emp) => {
    const detail = conciliatedEmpresas[emp];
    const isReconciled = typeof detail === 'boolean' ? detail : detail?.reconciled || false;
    const reconciledBy = typeof detail === 'object' && detail ? detail.reconciledBy || '' : '';
    const reconciledAt = typeof detail === 'object' && detail ? detail.reconciledAt || '' : '';

    return {
      'Empresa': emp,
      'Status': isReconciled ? 'CONCILIADO' : 'PENDENTE',
      'Conciliado Por': reconciledBy,
      'Data / Hora Conciliação': reconciledAt,
    };
  });

  const wsEmpresas = XLSX.utils.json_to_sheet(sheetEmpresasData);
  XLSX.utils.book_append_sheet(wb, wsEmpresas, 'Status_Empresas');

  // 3. Aba Visual 3: Resumo Financeiro
  const resumoFinanceiro = [
    { Indicador: 'Data do Movimento', Valor: dataMovimento },
    { Indicador: 'Operador Responsável', Valor: operador },
    { Indicador: 'Data da Exportação', Valor: new Date().toLocaleString('pt-BR') },
    { Indicador: 'Total Dealer (R$)', Valor: calculatedSummary.totalDealer },
    { Indicador: 'Total SiTef (R$)', Valor: calculatedSummary.totalSitef },
    { Indicador: 'Diferença Total (R$)', Valor: calculatedSummary.diferencaTotal },
    { Indicador: 'Total de Lançamentos', Valor: calculatedSummary.countTotal },
    { Indicador: 'Lançamentos Conciliados', Valor: calculatedSummary.countConciliados },
    { Indicador: 'Divergências Pendentes', Valor: calculatedSummary.countDivergencias },
    { Indicador: 'Validações PIX', Valor: calculatedSummary.countPixValidacao },
    { Indicador: 'Observações', Valor: observacoes },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoFinanceiro);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo_Geral');

  // 4. Aba Visual 4: Dealer Original (se houver dados)
  if (dealerState && dealerState.rawData && dealerState.rawData.length > 0) {
    try {
      const dealerRows = dealerState.rawData.slice(0, 10000).map((row) => {
        const obj: Record<string, any> = {};
        dealerState.columns.forEach((col) => {
          obj[col.name] = row[col.key] ?? '';
        });
        return obj;
      });
      const wsDealer = XLSX.utils.json_to_sheet(dealerRows);
      XLSX.utils.book_append_sheet(wb, wsDealer, 'Dealer_Origem');
    } catch {
      // ignore
    }
  }

  // 5. Aba Visual 5: SiTef Original (se houver dados)
  if (sitefState && sitefState.rawData && sitefState.rawData.length > 0) {
    try {
      const sitefRows = sitefState.rawData.slice(0, 10000).map((row) => {
        const obj: Record<string, any> = {};
        sitefState.columns.forEach((col) => {
          obj[col.name] = row[col.key] ?? '';
        });
        return obj;
      });
      const wsSitef = XLSX.utils.json_to_sheet(sitefRows);
      XLSX.utils.book_append_sheet(wb, wsSitef, 'SiTef_Origem');
    } catch {
      // ignore
    }
  }

  // 6. Aba Especial: Payload de Restauração 100% Fiel (_WANFINANCE_BACKUP_)
  // Contém o JSON serializado dividido em chunks de texto para não exceder limites de célula do Excel (32k chars)
  const fullPayload: FechamentoBackupPayload = {
    version: '1.0.0',
    format: 'WANFINANCE_FECHAMENTO_BACKUP_V1',
    exportedAt: new Date().toISOString(),
    dataMovimento,
    operador,
    observacoes,
    summary: calculatedSummary,
    items: sanitizedItems,
    conciliatedEmpresas,
    dealerState,
    sitefState,
    pendenteCdcState,
  };

  const jsonStr = JSON.stringify(fullPayload);
  const CHUNK_SIZE = 25000;
  const chunks: { chunk_index: number; total_chunks: number; data_part: string }[] = [];
  const totalChunks = Math.ceil(jsonStr.length / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    chunks.push({
      chunk_index: i,
      total_chunks: totalChunks,
      data_part: jsonStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    });
  }

  const wsMeta = XLSX.utils.json_to_sheet(chunks);
  XLSX.utils.book_append_sheet(wb, wsMeta, BACKUP_META_SHEET_NAME);

  // Download do arquivo .xlsx
  const dateClean = (dataMovimento || 'Fechamento').replace(/[^a-zA-Z0-9]/g, '_');
  const nowTime = new Date().toTimeString().slice(0, 5).replace(':', 'h');
  const fileName = `Fechamento_Conciliacao_BACKUP_${dateClean}_${nowTime}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Importa e restaura o Fechamento completo a partir de um arquivo Excel (.xlsx).
 * Prioriza a leitura da aba de backup fiel (_WANFINANCE_BACKUP_).
 * Caso seja um arquivo exportado padrão, faz o fallback inteligente.
 */
export async function importFechamentoFromExcel(file: File): Promise<ImportFechamentoResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });

    // 1. Tentar ler a aba de metadados completa
    if (wb.SheetNames.includes(BACKUP_META_SHEET_NAME)) {
      const metaSheet = wb.Sheets[BACKUP_META_SHEET_NAME];
      const rawRows: any[] = XLSX.utils.sheet_to_json(metaSheet);

      if (rawRows && rawRows.length > 0) {
        rawRows.sort((a, b) => (Number(a.chunk_index) || 0) - (Number(b.chunk_index) || 0));
        const assembledJson = rawRows.map((r) => r.data_part || '').join('');

        try {
          const payload: FechamentoBackupPayload = JSON.parse(assembledJson);
          if (payload.items && Array.isArray(payload.items)) {
            return {
              success: true,
              data: {
                items: payload.items,
                conciliatedEmpresas: payload.conciliatedEmpresas || {},
                dealerState: payload.dealerState,
                sitefState: payload.sitefState,
                pendenteCdcState: payload.pendenteCdcState,
                summary: payload.summary || calculateSummaryMetrics(payload.items),
                dataMovimento: payload.dataMovimento || new Date().toLocaleDateString('pt-BR'),
                operador: payload.operador,
                observacoes: payload.observacoes,
                exportedAt: payload.exportedAt,
              },
            };
          }
        } catch (jsonErr) {
          console.warn('Erro ao decodificar JSON dos metadados do Excel:', jsonErr);
        }
      }
    }

    // 2. Fallback: Parse das abas padrão (Fechamento_Conciliacao ou Lançamentos Fechamento)
    const targetSheetName =
      wb.SheetNames.find((s) => s.toLowerCase().includes('fechamento') || s.toLowerCase().includes('lançamentos') || s.toLowerCase().includes('lancamentos')) ||
      wb.SheetNames[0];

    if (!targetSheetName) {
      return { success: false, error: 'O arquivo Excel não contém nenhuma planilha de fechamento válida.' };
    }

    const sheet = wb.Sheets[targetSheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!rows || rows.length === 0) {
      return { success: false, error: 'A planilha de fechamento selecionada está vazia.' };
    }

    const importedItems: FechamentoItem[] = [];
    const conciliatedEmpresas: Record<string, boolean> = {};

    rows.forEach((row, idx) => {
      const empresa = String(row['Empresa (Dealer)'] || row['Empresa'] || row['empresa'] || '').trim();
      const departamento = String(row['Departamento'] || row['departamento'] || '').trim();
      const contaGerencial = String(row['Conta Gerencial'] || row['contaGerencial'] || '').trim();
      const caixaLoja = String(row['Caixa / Loja'] || row['caixaLoja'] || '').trim();
      const data = String(row['Data'] || row['data'] || '').trim();
      const nsu = String(row['NSU'] || row['NSU Dealer / NSU Host SiTef'] || row['nsu'] || '').trim();
      const tipoPagamento = String(row['Tipo / Forma'] || row['tipoPagamento'] || '').trim();
      const bandeiraDealer = String(row['Bandeira Dealer'] || '').trim();
      const bandeiraSitef = String(row['Bandeira SiTef'] || '').trim();

      const valorDealer = Number(row['Valor Dealer (R$)'] || row['Coluna Dealer (R$)'] || row['valorDealer'] || 0);
      const valorSitef = Number(row['Valor SiTef (R$)'] || row['Coluna Sitef (R$)'] || row['valorSitef'] || 0);
      const diferenca = Number(row['Diferença (R$)'] || row['diferenca'] || (valorDealer - valorSitef));

      const status = String(row['Status Conciliação'] || row['Status'] || row['status'] || 'PENDENTE').trim();
      const temDivergencia =
        String(row['Divergência?'] || '').toUpperCase() === 'SIM' ||
        Math.abs(diferenca) >= 0.01 ||
        status.includes('DIVERGENTE');
      const divergenciaBandeira = String(row['Divergência Bandeira?'] || '').toUpperCase() === 'SIM';
      const isPixValidationNeeded = String(row['Validação PIX?'] || '').toUpperCase() === 'SIM' || status.includes('PIX');
      const detalhes = String(row['Detalhes / Motivo'] || row['Motivo da Divergência / Conciliação'] || '').trim();

      if (empresa) {
        importedItems.push({
          id: `imp_excel_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          empresa,
          departamento,
          contaGerencial,
          caixaLoja,
          data,
          nsu,
          tipoPagamento,
          bandeiraDealer,
          bandeiraSitef,
          valorDealer,
          valorSitef,
          diferenca,
          status,
          temDivergencia,
          divergenciaBandeira,
          isPixValidationNeeded,
          detalhes,
          origem: 'import_excel',
        });
      }
    });

    // Ler Status_Empresas se existir
    if (wb.SheetNames.includes('Status_Empresas')) {
      const statusSheet = wb.Sheets['Status_Empresas'];
      const statusRows: any[] = XLSX.utils.sheet_to_json(statusSheet);
      statusRows.forEach((r) => {
        const emp = String(r['Empresa'] || '').trim();
        const st = String(r['Status'] || '').toUpperCase();
        if (emp) {
          conciliatedEmpresas[emp] = st === 'CONCILIADO';
        }
      });
    }

    const calculatedSummary = calculateSummaryMetrics(importedItems);

    return {
      success: true,
      data: {
        items: importedItems,
        conciliatedEmpresas,
        summary: calculatedSummary,
        dataMovimento: new Date().toLocaleDateString('pt-BR'),
      },
    };
  } catch (err: any) {
    console.error('Erro ao importar arquivo Excel de fechamento:', err);
    return { success: false, error: `Falha ao ler o arquivo Excel: ${err.message || 'Formato inválido'}` };
  }
}
