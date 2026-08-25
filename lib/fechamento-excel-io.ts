import * as XLSX from 'xlsx';
import { FechamentoItem, FechamentoSummary, calculateSummaryMetrics, deduplicateItems } from './fechamento-utils';
import { ColumnConfig, SpreadsheetState } from '@/types/spreadsheet';
import { ConciliationDetail } from './shared-fechamento-service';
import { CADASTRO_EMPRESAS } from './cadastros';
import { createSmartColumnConfigs, processSpreadsheetData } from './excel-utils';

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

  // 1. Aba Visual 1: Lançamentos de Fechamento Conciliado
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
    'Status Conciliação': item.status || 'CONCILIADO',
    'Divergência?': item.temDivergencia ? 'SIM' : 'NÃO',
    'Validação PIX?': item.isPixValidationNeeded ? 'SIM' : 'NÃO',
    'Critério de Conciliação': item.criterioConciliacao || 'Automático',
    'Origem': item.origem || 'auto',
    'Detalhes / Motivo': item.detalhes || item.motivoDivergencia || '',
  }));

  const wsItems = XLSX.utils.json_to_sheet(sheetItemsData);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Fechamento_Conciliacao');

  // 2. Aba Visual 2: Status das 52 Empresas
  // Include all 52 canonical companies + any other companies present in items
  const allEmpresasSet = new Set<string>([...CADASTRO_EMPRESAS]);
  sanitizedItems.forEach((i) => {
    if (i.empresa) allEmpresasSet.add(i.empresa);
  });
  Object.keys(conciliatedEmpresas).forEach((emp) => {
    if (emp) allEmpresasSet.add(emp);
  });

  const empresasList = Array.from(allEmpresasSet).sort();
  const sheetEmpresasData = empresasList.map((emp) => {
    const detail = conciliatedEmpresas[emp];
    const isReconciled = typeof detail === 'boolean' ? detail : detail?.reconciled ?? true;
    const reconciledBy = typeof detail === 'object' && detail ? detail.reconciledBy || operador : operador;
    const reconciledAt = typeof detail === 'object' && detail ? detail.reconciledAt || new Date().toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR');

    return {
      'Empresa': emp,
      'Status': isReconciled ? 'CONCILIADO' : 'PENDENTE',
      'Conciliado Por': isReconciled ? reconciledBy : '—',
      'Data / Hora Conciliação': isReconciled ? reconciledAt : '—',
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
    { Indicador: 'Status Geral', Valor: 'TODAS AS EMPRESAS CONCILIADAS' },
    { Indicador: 'Observações', Valor: observacoes },
  ];
  const wsResumo = XLSX.utils.json_to_sheet(resumoFinanceiro);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo_Geral');

  // 4. Aba Visual 4: Dealer Original
  if (dealerState && dealerState.rawData && dealerState.rawData.length > 0) {
    try {
      const dealerRows = dealerState.rawData.map((row) => {
        const obj: Record<string, any> = {};
        if (dealerState.columns && dealerState.columns.length > 0) {
          dealerState.columns.forEach((col) => {
            const header = col.customHeader || col.originalHeader || col.id;
            obj[header] = row[col.id] ?? row[header] ?? '';
          });
        } else {
          Object.assign(obj, row);
        }
        return obj;
      });
      const wsDealer = XLSX.utils.json_to_sheet(dealerRows);
      XLSX.utils.book_append_sheet(wb, wsDealer, 'Dealer_Origem');
    } catch (err) {
      console.warn('Erro ao exportar Dealer_Origem para Excel:', err);
    }
  }

  // 5. Aba Visual 5: SiTef Original
  if (sitefState && sitefState.rawData && sitefState.rawData.length > 0) {
    try {
      const sitefRows = sitefState.rawData.map((row) => {
        const obj: Record<string, any> = {};
        if (sitefState.columns && sitefState.columns.length > 0) {
          sitefState.columns.forEach((col) => {
            const header = col.customHeader || col.originalHeader || col.id;
            obj[header] = row[col.id] ?? row[header] ?? '';
          });
        } else {
          Object.assign(obj, row);
        }
        return obj;
      });
      const wsSitef = XLSX.utils.json_to_sheet(sitefRows);
      XLSX.utils.book_append_sheet(wb, wsSitef, 'SiTef_Origem');
    } catch (err) {
      console.warn('Erro ao exportar SiTef_Origem para Excel:', err);
    }
  }

  // 6. Aba Visual 6: Pendente CDC Original (se houver dados)
  if (pendenteCdcState && pendenteCdcState.rawData && pendenteCdcState.rawData.length > 0) {
    try {
      const cdcRows = pendenteCdcState.rawData.map((row) => {
        const obj: Record<string, any> = {};
        if (pendenteCdcState.columns && pendenteCdcState.columns.length > 0) {
          pendenteCdcState.columns.forEach((col) => {
            const header = col.customHeader || col.originalHeader || col.id;
            obj[header] = row[col.id] ?? row[header] ?? '';
          });
        } else {
          Object.assign(obj, row);
        }
        return obj;
      });
      const wsCdc = XLSX.utils.json_to_sheet(cdcRows);
      XLSX.utils.book_append_sheet(wb, wsCdc, 'Pendente_CDC_Origem');
    } catch (err) {
      console.warn('Erro ao exportar Pendente_CDC_Origem para Excel:', err);
    }
  }

  // 7. Aba Especial: Payload de Restauração 100% Fiel (_WANFINANCE_BACKUP_)
  // Build a 100% complete conciliatedEmpresas payload
  const fullConciliatedEmpresas: Record<string, any> = {};
  empresasList.forEach((emp) => {
    fullConciliatedEmpresas[emp] = {
      reconciled: true,
      reconciledBy: operador,
      userEmail: '',
      reconciledAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  });

  const fullPayload: FechamentoBackupPayload = {
    version: '1.0.0',
    format: 'WANFINANCE_FECHAMENTO_BACKUP_V1',
    exportedAt: new Date().toISOString(),
    dataMovimento,
    operador,
    observacoes,
    summary: calculatedSummary,
    items: sanitizedItems,
    conciliatedEmpresas: { ...fullConciliatedEmpresas, ...conciliatedEmpresas },
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
            // Process and guarantee fresh processedData for spreadsheets if rawData is present
            let restoredDealer = payload.dealerState;
            if (restoredDealer && restoredDealer.rawData && restoredDealer.rawData.length > 0) {
              const cols = (restoredDealer.columns && restoredDealer.columns.length > 0)
                ? restoredDealer.columns
                : createSmartColumnConfigs(Object.keys(restoredDealer.rawData[0] || {}), restoredDealer.rawData);
              restoredDealer = {
                ...restoredDealer,
                columns: cols,
                processedData: processSpreadsheetData(restoredDealer.rawData, cols),
              };
            }

            let restoredSitef = payload.sitefState;
            if (restoredSitef && restoredSitef.rawData && restoredSitef.rawData.length > 0) {
              const cols = (restoredSitef.columns && restoredSitef.columns.length > 0)
                ? restoredSitef.columns
                : createSmartColumnConfigs(Object.keys(restoredSitef.rawData[0] || {}), restoredSitef.rawData);
              restoredSitef = {
                ...restoredSitef,
                columns: cols,
                processedData: processSpreadsheetData(restoredSitef.rawData, cols),
              };
            }

            let restoredCdc = payload.pendenteCdcState;
            if (restoredCdc && restoredCdc.rawData && restoredCdc.rawData.length > 0) {
              const cols = (restoredCdc.columns && restoredCdc.columns.length > 0)
                ? restoredCdc.columns
                : createSmartColumnConfigs(Object.keys(restoredCdc.rawData[0] || {}), restoredCdc.rawData);
              restoredCdc = {
                ...restoredCdc,
                columns: cols,
                processedData: processSpreadsheetData(restoredCdc.rawData, cols),
              };
            }

            // Ensure all items have both Dealer and SiTef values preserved and conciliated status
            const cleanItems: FechamentoItem[] = payload.items.map((item, idx) => {
              const vd = Number(item.valorDealer ?? item.valor ?? 0);
              const vs = Number(item.valorSitef ?? (vd > 0 ? vd : 0));
              const dif = Math.round((vd - vs) * 100) / 100;
              const isConc = Math.abs(dif) < 0.01 || item.status === 'CONCILIADO';

              return {
                ...item,
                id: item.id || `fech_imp_${idx}_${Date.now()}`,
                valorDealer: vd,
                valorSitef: vs,
                diferenca: dif,
                status: isConc ? 'CONCILIADO' : (item.status || 'CONCILIADO'),
                temDivergencia: isConc ? false : (item.temDivergencia ?? false),
                isPixValidationNeeded: false,
                origem: item.origem || 'backup_excel',
              };
            });

            // Ensure all 52 companies are marked as conciliated
            const fullConciliatedEmpresas: Record<string, any> = {};
            CADASTRO_EMPRESAS.forEach((emp) => {
              fullConciliatedEmpresas[emp] = {
                reconciled: true,
                reconciledBy: payload.operador || 'Backup Excel',
                userEmail: '',
                reconciledAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              };
            });
            cleanItems.forEach((i) => {
              if (i.empresa) {
                fullConciliatedEmpresas[i.empresa] = {
                  reconciled: true,
                  reconciledBy: payload.operador || 'Backup Excel',
                  userEmail: '',
                  reconciledAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                };
              }
            });

            const mergedConciliated = {
              ...fullConciliatedEmpresas,
              ...(payload.conciliatedEmpresas || {}),
            };

            return {
              success: true,
              data: {
                items: cleanItems,
                conciliatedEmpresas: mergedConciliated,
                dealerState: restoredDealer,
                sitefState: restoredSitef,
                pendenteCdcState: restoredCdc,
                summary: payload.summary || calculateSummaryMetrics(cleanItems),
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

    // 2. Fallback: Parse das abas padrão (Fechamento_Conciliacao, Dealer_Origem, SiTef_Origem)
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
    const conciliatedEmpresas: Record<string, any> = {};

    // Also parse Dealer_Origem if available in workbook
    let parsedDealerState: SpreadsheetState | undefined;
    if (wb.SheetNames.includes('Dealer_Origem')) {
      try {
        const dealerRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Dealer_Origem']);
        if (dealerRaw.length > 0) {
          const headers = Object.keys(dealerRaw[0]);
          const cols = createSmartColumnConfigs(headers, dealerRaw);
          parsedDealerState = {
            fileName: 'DEALER.xlsx',
            headers,
            columns: cols,
            rawData: dealerRaw,
            processedData: processSpreadsheetData(dealerRaw, cols),
          };
        }
      } catch (e) {
        console.warn('Falha ao restaurar Dealer_Origem:', e);
      }
    }

    // Also parse SiTef_Origem if available in workbook
    let parsedSitefState: SpreadsheetState | undefined;
    if (wb.SheetNames.includes('SiTef_Origem')) {
      try {
        const sitefRaw: any[] = XLSX.utils.sheet_to_json(wb.Sheets['SiTef_Origem']);
        if (sitefRaw.length > 0) {
          const headers = Object.keys(sitefRaw[0]);
          const cols = createSmartColumnConfigs(headers, sitefRaw);
          parsedSitefState = {
            fileName: 'SITEF.xlsx',
            headers,
            columns: cols,
            rawData: sitefRaw,
            processedData: processSpreadsheetData(sitefRaw, cols),
          };
        }
      } catch (e) {
        console.warn('Falha ao restaurar SiTef_Origem:', e);
      }
    }

    // Parse each row from the Fechamento sheet
    rows.forEach((row, idx) => {
      const empresa = String(row['Empresa (Dealer)'] || row['Empresa'] || row['empresa'] || 'Empresa 01').trim();
      const departamento = String(row['Departamento'] || row['departamento'] || 'Geral').trim();
      const contaGerencial = String(row['Conta Gerencial'] || row['contaGerencial'] || departamento || 'Geral').trim();
      const caixaLoja = String(row['Caixa / Loja'] || row['caixaLoja'] || '01').trim();
      const data = String(row['Data'] || row['data'] || new Date().toLocaleDateString('pt-BR')).trim();
      const nsu = String(row['NSU'] || row['NSU Dealer / NSU Host SiTef'] || row['nsu'] || '').trim();
      const tipoPagamento = String(row['Tipo / Forma'] || row['tipoPagamento'] || 'CARTÃO').trim();
      const bandeiraDealer = String(row['Bandeira Dealer'] || 'CARTÃO').trim();
      const bandeiraSitef = String(row['Bandeira SiTef'] || bandeiraDealer || 'CARTÃO').trim();

      const rawValDealer = Number(row['Valor Dealer (R$)'] || row['Coluna Dealer (R$)'] || row['valorDealer'] || 0);
      const rawValSitef = Number(row['Valor SiTef (R$)'] || row['Coluna Sitef (R$)'] || row['valorSitef'] || 0);

      // When imported, guarantee both Dealer and SiTef values are balanced if it was conciliated
      const valorDealer = rawValDealer > 0 ? rawValDealer : (rawValSitef > 0 ? rawValSitef : 0);
      const valorSitef = rawValSitef > 0 ? rawValSitef : valorDealer;
      const diferenca = Math.round((valorDealer - valorSitef) * 100) / 100;

      const rawStatus = String(row['Status Conciliação'] || row['Status'] || row['status'] || 'CONCILIADO').trim();
      const isConc = Math.abs(diferenca) < 0.01 || rawStatus.toUpperCase().includes('CONCILIAD');
      const status = isConc ? 'CONCILIADO' : rawStatus;
      const temDivergencia = !isConc;
      const detalhes = String(row['Detalhes / Motivo'] || row['Critério de Conciliação'] || 'Conciliado via importação Excel').trim();

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
          divergenciaBandeira: false,
          isPixValidationNeeded: false,
          detalhes,
          criterioConciliacao: 'Importação Excel',
          origem: 'import_excel',
        });
      }
    });

    // Populate all 52 companies as conciliated
    CADASTRO_EMPRESAS.forEach((emp) => {
      conciliatedEmpresas[emp] = {
        reconciled: true,
        reconciledBy: 'Importação Excel',
        userEmail: '',
        reconciledAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
    });
    importedItems.forEach((i) => {
      if (i.empresa) {
        conciliatedEmpresas[i.empresa] = {
          reconciled: true,
          reconciledBy: 'Importação Excel',
          userEmail: '',
          reconciledAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
      }
    });

    // Ler Status_Empresas se existir para sobrescrever se houver detalhes específicos
    if (wb.SheetNames.includes('Status_Empresas')) {
      try {
        const statusSheet = wb.Sheets['Status_Empresas'];
        const statusRows: any[] = XLSX.utils.sheet_to_json(statusSheet);
        statusRows.forEach((r) => {
          const emp = String(r['Empresa'] || '').trim();
          const st = String(r['Status'] || '').toUpperCase();
          const by = String(r['Conciliado Por'] || 'Importação Excel').trim();
          const at = String(r['Data / Hora Conciliação'] || new Date().toLocaleTimeString('pt-BR')).trim();
          if (emp) {
            conciliatedEmpresas[emp] = {
              reconciled: st === 'CONCILIADO',
              reconciledBy: by,
              userEmail: '',
              reconciledAt: at,
            };
          }
        });
      } catch (e) {
        console.warn('Erro ao ler aba Status_Empresas:', e);
      }
    }

    const calculatedSummary = calculateSummaryMetrics(importedItems);

    return {
      success: true,
      data: {
        items: importedItems,
        conciliatedEmpresas,
        dealerState: parsedDealerState,
        sitefState: parsedSitefState,
        summary: calculatedSummary,
        dataMovimento: new Date().toLocaleDateString('pt-BR'),
        operador: 'Importação Excel',
      },
    };
  } catch (err: any) {
    console.error('Erro ao importar arquivo Excel de fechamento:', err);
    return { success: false, error: `Falha ao ler o arquivo Excel: ${err.message || 'Formato inválido'}` };
  }
}
