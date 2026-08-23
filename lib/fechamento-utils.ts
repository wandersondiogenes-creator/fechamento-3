import { parseNumber } from './utils';

export interface FechamentoItem {
  id: string;
  empresa: string;
  banco: string;
  data: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  status: 'consolidado' | 'divergente' | 'pendente' | 'pix_validado';
  motivoDivergencia?: string;
  registroDealer?: any;
  registroSitef?: any;
  metaData?: Record<string, any>;
  isManual?: boolean;
}

export function deduplicateItems(items: FechamentoItem[]): FechamentoItem[] {
  const map = new Map<string, FechamentoItem>();
  items.forEach((item) => {
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

export function calculateSummaryMetrics(items: FechamentoItem[]) {
  let totalEntradas = 0;
  let totalSaidas = 0;
  let divergencias = 0;
  let validadosPix = 0;

  items.forEach((item) => {
    if (item.tipo === 'entrada') {
      totalEntradas += item.valor;
    } else {
      totalSaidas += item.valor;
    }
    if (item.status === 'divergente') {
      divergencias++;
    }
    if (item.status === 'pix_validado') {
      validadosPix++;
    }
  });

  return {
    totalEntradas,
    totalSaidas,
    saldoLiquido: totalEntradas - totalSaidas,
    totalRegistros: items.length,
    divergencias,
    validadosPix,
  };
}
