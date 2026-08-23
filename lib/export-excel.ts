import * as XLSX from 'xlsx';
import { FechamentoItem } from './fechamento-utils';

export function exportFechamentoToExcel(items: FechamentoItem[], fileName: string = 'Fechamento_Caixa.xlsx') {
  const rows = items.map((item) => ({
    Data: item.data || '',
    Empresa: item.empresa || '',
    Banco: item.banco || '',
    Tipo: item.tipo === 'entrada' ? 'Entrada' : 'Saída',
    Valor: item.valor,
    Status: item.status,
    Motivo: item.motivoDivergencia || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fechamento');
  XLSX.writeFile(workbook, fileName);
}
