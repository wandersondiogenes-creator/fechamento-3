export type RuleType = 
  | 'none'
  | 'trim'
  | 'uppercase'
  | 'lowercase'
  | 'titlecase'
  | 'remove_accents'
  | 'remove_special_chars'
  | 'format_cpf'
  | 'format_cnpj'
  | 'format_phone'
  | 'format_currency_brl'
  | 'clean_currency_number'
  | 'convert_date'
  | 'round_number'
  | 'find_replace'
  | 'fill_nulls'
  | 'remove_null_rows';

export interface DateFormatConfig {
  targetFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY HH:mm' | 'MM/DD/YYYY';
}

export interface FindReplaceConfig {
  findText: string;
  replaceText: string;
  matchCase: boolean;
}

export interface RoundNumberConfig {
  decimals: number;
}

export interface FillNullsConfig {
  value: string;
}

export interface ColumnRule {
  id: string;
  type: RuleType;
  dateFormatConfig?: DateFormatConfig;
  findReplaceConfig?: FindReplaceConfig;
  roundConfig?: RoundNumberConfig;
  fillNullsConfig?: FillNullsConfig;
  enabled: boolean;
}

export interface ColumnConfig {
  id: string; // unique internal key e.g. "col_0"
  originalHeader: string;
  customHeader: string;
  visible: boolean;
  type: 'text' | 'number' | 'date' | 'currency' | 'cpf' | 'cnpj';
  rules: ColumnRule[];
}

export interface CellPosition {
  rowIndex: number;
  colId: string;
}

export interface RulePreset {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  columnRulesMatch: Array<{
    columnNameMatch: string; // matches header name (regex or substring)
    customHeader?: string;
    rules: ColumnRule[];
  }>;
}

export interface AISuggestion {
  id: string;
  title: string;
  description: string;
  columnId: string;
  columnName: string;
  suggestedRule?: ColumnRule;
  ruleType?: RuleType;
  confidence: 'high' | 'medium' | 'low';
  issueType: 'formatting' | 'invalid_data' | 'missing_values' | 'standardization';
  affectedRowsCount?: number;
}

export interface DataQualityReport {
  score: number; // 0-100
  totalRows: number;
  totalCols: number;
  summaryText: string;
  issuesCount: {
    missing: number;
    invalidCpf: number;
    dateFormatMix: number;
    spaces: number;
  };
  suggestions: AISuggestion[];
}

export interface SpreadsheetState {
  fileName: string;
  headers: string[];
  columns: ColumnConfig[];
  rawData: Record<string, any>[]; // keyed by column.id
  processedData: Record<string, any>[]; // data with rules applied
  hasHeaderRow: boolean;
}
