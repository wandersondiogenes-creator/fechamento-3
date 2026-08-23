import { PendingFileRecord } from '@/lib/pending-files-service';
import { SpreadsheetState } from '@/types/spreadsheet';
import { FechamentoItem } from '@/lib/fechamento-utils';

export interface UserWorkspaceSession {
  userEmail: string;
  lastActiveAt: string;
  dealerState: SpreadsheetState;
  sitefState: SpreadsheetState;
  pendenteCdcState: SpreadsheetState;
  manualFechamentoItems: FechamentoItem[];
  deletedFechamentoIds: string[];
  activeTab?: string;
  tabFilters?: any;
}

// Global server in-memory stores for fast sync
const globalStore = globalThis as unknown as {
  _inMemoryWorkspaces?: Map<string, UserWorkspaceSession>;
  _inMemoryPendingFiles?: Map<string, PendingFileRecord[]>;
};

if (!globalStore._inMemoryWorkspaces) {
  globalStore._inMemoryWorkspaces = new Map<string, UserWorkspaceSession>();
}
if (!globalStore._inMemoryPendingFiles) {
  globalStore._inMemoryPendingFiles = new Map<string, PendingFileRecord[]>();
}

export const inMemoryWorkspaces = globalStore._inMemoryWorkspaces;
export const inMemoryPendingFiles = globalStore._inMemoryPendingFiles;
