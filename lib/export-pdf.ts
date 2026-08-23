import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FechamentoItem } from './fechamento-utils';
import { formatCurrency } from './utils';

export function exportFechamentoToPDF(items: FechamentoItem[], title: string = 'Relatório de Fechamento de Caixa') {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('WAN Finance - Relatório Consolidado', 14, 20);
  doc.setFontSize(11);
  doc.text(title, 14, 28);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 34);

  const tableData = items.map((item) => [
    item.data || '-',
    item.empresa || '-',
    item.banco || '-',
    item.tipo === 'entrada' ? 'Entrada' : 'Saída',
    formatCurrency(item.valor),
    item.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Data', 'Empresa', 'Banco', 'Tipo', 'Valor', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    styles: { fontSize: 8 },
  });

  doc.save(`Fechamento_Caixa_${Date.now()}.pdf`);
}
