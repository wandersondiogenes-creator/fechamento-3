import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ColumnConfig, ColumnRule, SpreadsheetState } from '@/types/spreadsheet';
import {
  formatCNPJ,
  formatCPF,
  formatCurrencyBRL,
  formatPhone,
  isValidDateValue,
  mapSitefEmpresa,
  parseAndFormatDate,
  parseCurrencyToNumber,
  removeAccents,
  toTitleCase,
} from './validators';

export function parseFileToSpreadsheet(
  file: File
): Promise<{ headers: string[]; rawData: Record<string, any>[]; fileName: string }> {
  return new Promise((resolve, reject) => {
    const fileName = file.name;
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    if (isCsv) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][];
          if (!rows || rows.length === 0) {
            reject(new Error('Arquivo CSV está vazio.'));
            return;
          }

          const headerRow = rows[0].map((h, i) => String(h || `Coluna_${i + 1}`).trim());
          const dataRows = rows.slice(1);

          const rawData: Record<string, any>[] = dataRows.map((row) => {
            const rowObj: Record<string, any> = {};
            headerRow.forEach((_, colIndex) => {
              const key = `col_${colIndex}`;
              rowObj[key] = row[colIndex] !== undefined ? row[colIndex] : '';
            });
            return rowObj;
          });

          resolve({ headers: headerRow, rawData, fileName });
        },
        error: (err) => reject(err),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          if (!buffer) {
            reject(new Error('Não foi possível ler o arquivo.'));
            return;
          }

          let workbook: XLSX.WorkBook | null = null;
          try {
            const data = new Uint8Array(buffer as ArrayBuffer);
            workbook = XLSX.read(data, { type: 'array', cellDates: true });
          } catch (err) {
            try {
              const str = new TextDecoder('latin1').decode(buffer as ArrayBuffer);
              workbook = XLSX.read(str, { type: 'binary', cellDates: true });
            } catch (err2) {
              const binary = Array.from(new Uint8Array(buffer as ArrayBuffer))
                .map((b) => String.fromCharCode(b))
                .join('');
              workbook = XLSX.read(binary, { type: 'binary', cellDates: true });
            }
          }

          if (!workbook) {
            reject(new Error('Não foi possível processar a estrutura do arquivo Excel.'));
            return;
          }

          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            reject(new Error('Nenhuma planilha encontrada no arquivo.'));
            return;
          }
          const worksheet = workbook.Sheets[firstSheetName];

          // Read sheet as 2D array of raw values
          const sheetData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
            header: 1,
            defval: '',
            blankrows: false,
          });

          if (!sheetData || sheetData.length === 0) {
            reject(new Error('Planilha está vazia.'));
            return;
          }

          const rawHeaders = (sheetData[0] || []) as any[];
          const headers = rawHeaders.map((h, idx) =>
            h !== undefined && String(h).trim() !== '' ? String(h).trim() : `Coluna_${idx + 1}`
          );

          const dataRows = sheetData.slice(1);
          const rawData: Record<string, any>[] = dataRows.map((row) => {
            const rowObj: Record<string, any> = {};
            headers.forEach((_, colIndex) => {
              const key = `col_${colIndex}`;
              rowObj[key] = row[colIndex] !== undefined ? row[colIndex] : '';
            });
            return rowObj;
          });

          resolve({ headers, rawData, fileName });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    }
  });
}

export function applyRuleToValue(value: any, rule: ColumnRule): any {
  if (!rule.enabled) return value;

  const strVal = value !== null && value !== undefined ? String(value) : '';

  switch (rule.type) {
    case 'trim':
      return strVal.trim();

    case 'uppercase':
      return strVal.toUpperCase();

    case 'lowercase':
      return strVal.toLowerCase();

    case 'titlecase':
      return toTitleCase(strVal);

    case 'remove_accents':
      return removeAccents(strVal);

    case 'remove_special_chars':
      return strVal.replace(/[^a-zA-Z0-9\s,.-]/g, '');

    case 'format_cpf':
      return formatCPF(value);

    case 'format_cnpj':
      return formatCNPJ(value);

    case 'format_phone':
      return formatPhone(value);

    case 'format_currency_brl':
      return formatCurrencyBRL(value);

    case 'clean_currency_number': {
      const num = parseCurrencyToNumber(value);
      return num !== null ? num : value;
    }

    case 'convert_date': {
      const fmt = rule.dateFormatConfig?.targetFormat || 'DD/MM/YYYY';
      return parseAndFormatDate(value, fmt);
    }

    case 'round_number': {
      const num = typeof value === 'number' ? value : parseFloat(strVal);
      if (isNaN(num)) return value;
      const decimals = rule.roundConfig?.decimals ?? 2;
      return Number(num.toFixed(decimals));
    }

    case 'find_replace': {
      if (!rule.findReplaceConfig || !rule.findReplaceConfig.findText) return value;
      const { findText, replaceText, matchCase } = rule.findReplaceConfig;
      if (!matchCase) {
        const regex = new RegExp(escapeRegExp(findText), 'gi');
        return strVal.replace(regex, replaceText || '');
      }
      return strVal.split(findText).join(replaceText || '');
    }

    case 'fill_nulls': {
      if (strVal.trim() === '' || value === null || value === undefined) {
        return rule.fillNullsConfig?.value || '';
      }
      return value;
    }

    default:
      return value;
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function processSpreadsheetData(
  rawData: Record<string, any>[],
  columns: ColumnConfig[]
): Record<string, any>[] {
  if (!rawData || rawData.length === 0) return [];

  // Filter out columns or check row level filters
  let processed = rawData.map((row) => ({ ...row }));

  // Check if any column has 'remove_null_rows' enabled
  const nullFilterCols = columns.filter((c) =>
    c.rules.some((r) => r.enabled && r.type === 'remove_null_rows')
  );

  if (nullFilterCols.length > 0) {
    processed = processed.filter((row) => {
      for (const col of nullFilterCols) {
        const val = row[col.id];
        if (val === null || val === undefined || String(val).trim() === '') {
          return false;
        }
      }
      return true;
    });
  }

  // Apply column rules sequentially
  processed = processed.map((row) => {
    const updatedRow = { ...row };

    columns.forEach((col) => {
      let currentVal = updatedRow[col.id];

      col.rules.forEach((rule) => {
        if (rule.enabled && rule.type !== 'remove_null_rows') {
          currentVal = applyRuleToValue(currentVal, rule);
        }
      });

      updatedRow[col.id] = currentVal;
    });

    return updatedRow;
  });

  return processed;
}

export function exportProcessedData(
  state: SpreadsheetState,
  format: 'xlsx' | 'csv' | 'json',
  includeHidden: boolean = false
): void {
  const activeCols = state.columns.filter((c) => includeHidden || c.visible);

  if (format === 'json') {
    const jsonData = state.processedData.map((row) => {
      const obj: Record<string, any> = {};
      activeCols.forEach((col) => {
        obj[col.customHeader || col.originalHeader] = row[col.id];
      });
      return obj;
    });

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    downloadBlob(blob, getExportFileName(state.fileName, 'json'));
    return;
  }

  // Build rows array with custom headers
  const exportHeaders = activeCols.map((c) => c.customHeader || c.originalHeader);
  const rowsArray = state.processedData.map((row) =>
    activeCols.map((col) => row[col.id] ?? '')
  );

  if (format === 'csv') {
    // Generate CSV with Portuguese semicolon ';' delimiter option for Excel compatibility
    const csvContent = Papa.unparse(
      {
        fields: exportHeaders,
        data: rowsArray,
      },
      {
        delimiter: ';',
      }
    );

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, getExportFileName(state.fileName, 'csv'));
    return;
  }

  if (format === 'xlsx') {
    const sheetData = [exportHeaders, ...rowsArray];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados_Tratados');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, getExportFileName(state.fileName, 'xlsx'));
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getExportFileName(originalName: string, ext: string): string {
  const baseName = originalName.replace(/\.[^/.]+$/, '') || 'planilha';
  return `${baseName}_tratada.${ext}`;
}

export interface CleaningReport {
  cleanedHeaders: string[];
  cleanedRawData: Record<string, any>[];
  zeroValueRawData: Record<string, any>[];
  removedEmptyRowsCount: number;
  removedEmptyColsCount: number;
  removedNoDateRowsCount: number;
  removedNoEntradaRowsCount: number;
  removedIgnoredColsCount: number;
  removedCanceledRowsCount: number;
}

export function isIgnoredColumnHeader(header: string): boolean {
  if (!header) return false;
  const norm = header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Columns requested to be automatically excluded:
  // 1. CONTA CLASSIFICAÇÃO
  if (
    norm.includes('conta classificacao') ||
    norm.includes('conta classif') ||
    norm === 'classificacao' ||
    norm === 'classificac'
  ) {
    return true;
  }

  // 2. DIAS
  if (
    norm === 'dias' ||
    norm === 'dia' ||
    norm.startsWith('dias ') ||
    norm.endsWith(' dias')
  ) {
    return true;
  }

  // 3. PARC.
  if (
    norm === 'parc' ||
    norm === 'parc.' ||
    norm.startsWith('parc.') ||
    norm.startsWith('parc ') ||
    norm.includes('parcela')
  ) {
    return true;
  }

  // 4. HISTÓRICO
  if (norm.includes('historico')) {
    return true;
  }

  // 5. DEP.
  if (
    norm === 'dep' ||
    norm === 'dep.' ||
    norm.startsWith('dep.') ||
    norm.startsWith('dep ') ||
    norm.includes('departamento')
  ) {
    return true;
  }

  // 6. DAT ACON
  if (
    norm.includes('dat acon') ||
    norm.includes('data con') ||
    norm.includes('datacon') ||
    norm.includes('dat_acon') ||
    norm.includes('data contab')
  ) {
    return true;
  }

  return false;
}

export function cleanAndOrganizeRawData(
  headers: string[],
  rawData: Record<string, any>[]
): CleaningReport {
  if (!rawData || rawData.length === 0) {
    return {
      cleanedHeaders: headers.filter((h) => !isIgnoredColumnHeader(h)),
      cleanedRawData: [],
      zeroValueRawData: [],
      removedEmptyRowsCount: 0,
      removedEmptyColsCount: 0,
      removedNoDateRowsCount: 0,
      removedNoEntradaRowsCount: 0,
      removedIgnoredColsCount: headers.filter((h) => isIgnoredColumnHeader(h)).length,
      removedCanceledRowsCount: 0,
    };
  }

  // 1. Remove completely empty rows
  const initialCount = rawData.length;
  const nonRowEmptyData = rawData.filter((row) => {
    return Object.values(row).some(
      (val) => val !== null && val !== undefined && String(val).trim() !== ''
    );
  });
  const removedEmptyRowsCount = initialCount - nonRowEmptyData.length;

  // 2. Remove rows that do NOT contain any valid date (with exception of the title/header row)
  const rowsWithDate = nonRowEmptyData.filter((row) => {
    return Object.values(row).some((val) => isValidDateValue(val));
  });

  let dateFilteredData = nonRowEmptyData;
  let removedNoDateRowsCount = 0;
  if (rowsWithDate.length > 0) {
    removedNoDateRowsCount = nonRowEmptyData.length - rowsWithDate.length;
    dateFilteredData = rowsWithDate;
  }

  // 3. Separate rows where value columns ("Valor", "Valor Bruto", "Valor Líquido", "Entrada") are zero or blank
  const valueColIndices = headers
    .map((h, i) => {
      if (!h) return -1;
      const norm = h
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (
        norm.includes('entrada') ||
        norm.includes('valor') ||
        norm.includes('bruto') ||
        norm.includes('liquido')
      ) {
        return i;
      }
      return -1;
    })
    .filter((i) => i !== -1);

  let valueFilteredData = dateFilteredData;
  let zeroValueRawDataList: Record<string, any>[] = [];
  let removedNoEntradaRowsCount = 0;

  if (valueColIndices.length > 0) {
    const validValueRows: Record<string, any>[] = [];
    const zeroValueRows: Record<string, any>[] = [];

    dateFilteredData.forEach((row) => {
      const isZeroOrBlank = valueColIndices.every((idx) => {
        const val = row[`col_${idx}`];
        if (val === null || val === undefined || String(val).trim() === '') return true;
        const num = parseCurrencyToNumber(val);
        return num === 0 || num === null;
      });

      if (isZeroOrBlank) {
        zeroValueRows.push(row);
      } else {
        validValueRows.push(row);
      }
    });

    removedNoEntradaRowsCount = zeroValueRows.length;
    valueFilteredData = validValueRows;
    zeroValueRawDataList = zeroValueRows;
  }

  // 4. Remove rows where "ESTADO TRANSAÇÃO" or "STATUS" is canceled or denied ("negada", "cancelada", "rejeitada", etc.)
  let statusFilteredData = valueFilteredData;
  let removedCanceledRowsCount = 0;

  const statusColIndices = headers
    .map((h, i) => {
      if (!h) return -1;
      const norm = h
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (
        norm.includes('estado') ||
        norm.includes('status') ||
        norm.includes('situacao') ||
        norm.includes('conciliacao')
      ) {
        return i;
      }
      return -1;
    })
    .filter((i) => i !== -1);

  if (statusColIndices.length > 0) {
    const activeStatusRows = valueFilteredData.filter((row) => {
      return !statusColIndices.some((idx) => {
        const val = row[`col_${idx}`];
        if (val === null || val === undefined) return false;
        const normVal = String(val)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();

        return (
          normVal.includes('negad') ||
          normVal.includes('cancelad') ||
          normVal.includes('rejeit') ||
          normVal === 'failed' ||
          normVal === 'denied' ||
          normVal === 'recusad'
        );
      });
    });

    removedCanceledRowsCount = valueFilteredData.length - activeStatusRows.length;
    statusFilteredData = activeStatusRows;
  }

  // 5. Exclude specific unwanted columns (CONTA CLASSIFICAÇÃO, DIAS, PARC., HISTÓRICO, DEP., DAT ACON) & empty columns
  const activeColIndices: number[] = [];
  let removedIgnoredColsCount = 0;

  headers.forEach((header, colIndex) => {
    if (isIgnoredColumnHeader(header)) {
      removedIgnoredColsCount++;
      return;
    }

    const key = `col_${colIndex}`;
    const hasAnyContent = statusFilteredData.some((row) => {
      const val = row[key];
      return val !== null && val !== undefined && String(val).trim() !== '';
    });
    // Keep column if it has at least one cell content or if it has a non-default header
    if (hasAnyContent || (header && !header.startsWith('Coluna_'))) {
      activeColIndices.push(colIndex);
    }
  });

  const removedEmptyColsCount = headers.length - removedIgnoredColsCount - activeColIndices.length;

  // Re-map headers and row keys
  const cleanedHeaders = activeColIndices.map((i) => headers[i]);
  const cleanedRawData = statusFilteredData.map((row) => {
    const newRow: Record<string, any> = {};
    activeColIndices.forEach((origIdx, newIdx) => {
      newRow[`col_${newIdx}`] = row[`col_${origIdx}`] ?? '';
    });
    return newRow;
  });

  const cleanedZeroValueRawData = zeroValueRawDataList.map((row) => {
    const newRow: Record<string, any> = {};
    activeColIndices.forEach((origIdx, newIdx) => {
      newRow[`col_${newIdx}`] = row[`col_${origIdx}`] ?? '';
    });
    return newRow;
  });

  return {
    cleanedHeaders,
    cleanedRawData,
    zeroValueRawData: cleanedZeroValueRawData,
    removedEmptyRowsCount,
    removedEmptyColsCount,
    removedNoDateRowsCount,
    removedNoEntradaRowsCount,
    removedIgnoredColsCount,
    removedCanceledRowsCount,
  };
}

/**
 * Check if a row has zero or blank value in its main value column(s)
 */
export function isZeroValueDealerRow(
  row: Record<string, any>,
  columns: ColumnConfig[]
): boolean {
  if (!columns || columns.length === 0) return false;

  let valueCols = columns.filter((c) => {
    const h = (c.customHeader || c.originalHeader)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return (
      h.includes('entrada') ||
      h.includes('valor bruto') ||
      h.includes('bruto') ||
      (h.includes('valor') && !h.includes('saida') && !h.includes('taxa'))
    );
  });

  if (valueCols.length === 0) {
    valueCols = columns.filter((c) => c.type === 'currency');
  }

  if (valueCols.length === 0) {
    return false;
  }

  return valueCols.every((col) => {
    const val = row[col.id];
    if (val === null || val === undefined || String(val).trim() === '') {
      return true;
    }
    const num = parseCurrencyToNumber(val);
    return num === 0 || num === null;
  });
}

/**
 * Filter rawData into non-zero dealer rows and zero-value pendente CDC rows
 */
export function separateZeroValueDealerRows(
  rawData: Record<string, any>[],
  columns: ColumnConfig[]
): {
  dealerRows: Record<string, any>[];
  pendenteCdcRows: Record<string, any>[];
} {
  const dealerRows: Record<string, any>[] = [];
  const pendenteCdcRows: Record<string, any>[] = [];

  rawData.forEach((row) => {
    if (isZeroValueDealerRow(row, columns)) {
      pendenteCdcRows.push(row);
    } else {
      dealerRows.push(row);
    }
  });

  return { dealerRows, pendenteCdcRows };
}

export function createSmartColumnConfigs(
  headers: string[],
  rawData: Record<string, any>[]
): ColumnConfig[] {
  return headers.map((header, idx) => {
    const colId = `col_${idx}`;
    const lowerHeader = header.toLowerCase();

    // Collect non-empty sample values for this column
    const sampleValues = rawData
      .slice(0, 30)
      .map((r) => r[colId])
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');

    let type: ColumnConfig['type'] = 'text';
    const rules: ColumnRule[] = [];

    const dateSampleCount = sampleValues.filter((v) => isValidDateValue(v)).length;
    const isDateByHeader =
      lowerHeader.includes('data') ||
      lowerHeader.includes('dt_') ||
      lowerHeader.includes('nasc') ||
      lowerHeader.includes('vencimento') ||
      lowerHeader.includes('emissao') ||
      lowerHeader.includes('date') ||
      lowerHeader.includes('periodo');

    const isCpfByHeader = lowerHeader.includes('cpf');
    const isCnpjByHeader = lowerHeader.includes('cnpj');
    const isPhoneByHeader =
      lowerHeader.includes('tel') ||
      lowerHeader.includes('fone') ||
      lowerHeader.includes('celular') ||
      lowerHeader.includes('phone') ||
      lowerHeader.includes('contato');

    const isCurrencyByHeader =
      lowerHeader.includes('valor') ||
      lowerHeader.includes('preco') ||
      lowerHeader.includes('saldo') ||
      lowerHeader.includes('custo') ||
      lowerHeader.includes('total') ||
      lowerHeader.includes('fatura') ||
      lowerHeader.includes('pagamento') ||
      lowerHeader.includes('receita') ||
      lowerHeader.includes('despesa') ||
      lowerHeader.includes('bruto') ||
      lowerHeader.includes('liquido') ||
      lowerHeader.includes('entrada') ||
      lowerHeader.includes('saida') ||
      lowerHeader.includes('saída');

    const isNameOrText =
      lowerHeader.includes('nome') ||
      lowerHeader.includes('cliente') ||
      lowerHeader.includes('cidade') ||
      lowerHeader.includes('bairro') ||
      lowerHeader.includes('rua') ||
      lowerHeader.includes('endereco') ||
      lowerHeader.includes('razao') ||
      lowerHeader.includes('funcionario') ||
      lowerHeader.includes('usuario') ||
      lowerHeader.includes('produto') ||
      lowerHeader.includes('descricao');

    if (isCpfByHeader) {
      type = 'cpf';
      rules.push(
        { id: `r_trim_${idx}`, type: 'trim', enabled: true },
        { id: `r_cpf_${idx}`, type: 'format_cpf', enabled: true }
      );
    } else if (isCnpjByHeader) {
      type = 'cnpj';
      rules.push(
        { id: `r_trim_${idx}`, type: 'trim', enabled: true },
        { id: `r_cnpj_${idx}`, type: 'format_cnpj', enabled: true }
      );
    } else if (
      isDateByHeader ||
      (sampleValues.length > 0 && dateSampleCount / sampleValues.length >= 0.4)
    ) {
      type = 'date';
      rules.push({
        id: `r_date_${idx}`,
        type: 'convert_date',
        enabled: true,
        dateFormatConfig: { targetFormat: 'DD/MM/YYYY' },
      });
    } else if (isPhoneByHeader) {
      type = 'text';
      rules.push(
        { id: `r_trim_${idx}`, type: 'trim', enabled: true },
        { id: `r_phone_${idx}`, type: 'format_phone', enabled: true }
      );
    } else if (isCurrencyByHeader) {
      type = 'currency';
      rules.push({ id: `r_curr_${idx}`, type: 'format_currency_brl', enabled: true });
    } else if (isNameOrText) {
      type = 'text';
      rules.push(
        { id: `r_trim_${idx}`, type: 'trim', enabled: true },
        { id: `r_title_${idx}`, type: 'titlecase', enabled: true }
      );
    } else {
      type = 'text';
      rules.push({ id: `r_trim_${idx}`, type: 'trim', enabled: true });
    }

    if (lowerHeader.includes('entrada')) {
      if (!rules.some((r) => r.type === 'remove_null_rows')) {
        rules.push({ id: `r_rem_null_${idx}`, type: 'remove_null_rows', enabled: true });
      }
    }

    return {
      id: colId,
      originalHeader: header,
      customHeader: header,
      visible: true,
      type,
      rules,
    };
  });
}

/**
 * Automatically normalizes SiTef company/store names according to the official mapping table
 */
export function normalizeSitefRawData(
  rawData: Record<string, any>[],
  headersOrCols: string[] | ColumnConfig[]
): Record<string, any>[] {
  if (!rawData || rawData.length === 0) return rawData;

  const matchingColKeys: string[] = [];

  if (headersOrCols.length > 0 && typeof headersOrCols[0] === 'string') {
    (headersOrCols as string[]).forEach((h, idx) => {
      const lower = h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (
        lower.includes('empresa') ||
        lower.includes('loja') ||
        lower.includes('filial') ||
        lower.includes('comp') ||
        lower.includes('estabelecimento')
      ) {
        matchingColKeys.push(`col_${idx}`);
      }
    });
  } else {
    (headersOrCols as ColumnConfig[]).forEach((c) => {
      const h = (c.customHeader || c.originalHeader)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (
        h.includes('empresa') ||
        h.includes('loja') ||
        h.includes('filial') ||
        h.includes('comp') ||
        h.includes('estabelecimento')
      ) {
        matchingColKeys.push(c.id);
      }
    });
  }

  // Fallback: check columns where values match any key in mapping table
  if (matchingColKeys.length === 0 && rawData[0]) {
    Object.keys(rawData[0]).forEach((k) => {
      const sampleVal = String(rawData[0][k] || '').trim();
      if (sampleVal && mapSitefEmpresa(sampleVal) !== sampleVal) {
        matchingColKeys.push(k);
      }
    });
  }

  if (matchingColKeys.length === 0) {
    matchingColKeys.push('col_0', 'col_1', 'col_2');
  }

  return rawData.map((row) => {
    const newRow = { ...row };
    matchingColKeys.forEach((key) => {
      if (newRow[key] !== undefined && newRow[key] !== null) {
        const mapped = mapSitefEmpresa(newRow[key]);
        if (mapped && mapped !== String(newRow[key]).trim()) {
          newRow[key] = mapped;
        }
      }
    });
    return newRow;
  });
}

