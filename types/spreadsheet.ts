export type DataType = 'text' | 'number' | 'currency' | 'date' | 'boolean';

export interface ColumnDef {
  id: string;
  name: string;
  type: DataType;
  width?: number;
  formula?: string;
  isVisible?: boolean;
}

export interface CellPosition {
  row: number;
  col: number;
}

export interface SpreadsheetState {
  columns: ColumnDef[];
  rows: Record<string, any>[];
  rawData?: Record<string, any>[];
  fileName?: string;
  selectedCell?: CellPosition | null;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc';
  filterText?: string;
  activeSheet?: string;
  sheetNames?: string[];
  history?: {
    past: Record<string, any>[][];
    future: Record<string, any>[][];
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName?: string;
  operacao: string;
  descricao: string;
  empresa?: string;
  banco?: string;
  registro?: string;
  valor?: number;
  situacao_anterior?: string;
  situacao_nova?: string;
  lote_id?: string;
  meta_data?: Record<string, any>;
}
