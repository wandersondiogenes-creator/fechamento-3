import { FechamentoItem } from './fechamento-utils';
import * as XLSX from 'xlsx';

export interface FechamentoCaixaRecord {
  id: string;
  dataMovimento: string; // e.g. "13/08/2026" or "2026-08-13"
  dataFechamento: string; // ISO string or formatted date/time
  operador: string;
  observacoes?: string;
  totalDealer: number;
  totalSitef: number;
  diferencaTotal: number;
  countTotal: number;
  countEmpresas: number;
  empresasNomes: string[];
  breakdownPorBandeira: Record<string, { count: number; totalDealer: number; totalSitef: number }>;
  status: string; // "100% CONCILIADO - FECHADO"
  items: FechamentoItem[];
}

const STORAGE_KEY = 'fechamento_caixa_historico_v1';

export function getHistoricoFechamento(): FechamentoCaixaRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: FechamentoCaixaRecord[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Erro ao ler histórico de fechamento:', err);
    return [];
  }
}

export function saveFechamentoCaixa(record: FechamentoCaixaRecord): FechamentoCaixaRecord[] {
  if (typeof window === 'undefined') return [record];
  try {
    const current = getHistoricoFechamento();
    // Replace if exists, else prepend
    const existingIdx = current.findIndex((r) => r.id === record.id || r.dataMovimento === record.dataMovimento);
    let updated: FechamentoCaixaRecord[];
    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = record;
    } else {
      updated = [record, ...current];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Erro ao salvar fechamento:', err);
    return [];
  }
}

export function deleteFechamentoCaixa(id: string): FechamentoCaixaRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getHistoricoFechamento();
    const updated = current.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Erro ao excluir fechamento:', err);
    return [];
  }
}

export function clearHistoricoFechamento(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Erro ao limpar histórico:', err);
  }
}

const formatBRL = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
};

// Export to Excel XLSX
export function exportFechamentoCaixaExcel(record: FechamentoCaixaRecord): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary Comprovante
  const summaryRows = [
    ['COMPROVANTE OFICIAL DE FECHAMENTO DE CAIXA DO DIA'],
    ['SISTEMA DE CONCILIAÇÃO FINANCEIRA DEALER x SITEF'],
    [''],
    ['DATA DO MOVIMENTO:', record.dataMovimento],
    ['DATA/HORA DO FECHAMENTO:', new Date(record.dataFechamento).toLocaleString('pt-BR')],
    ['OPERADOR / RESPONSÁVEL:', record.operador || 'Financeiro'],
    ['OBSERVAÇÕES:', record.observacoes || 'Nenhuma'],
    ['STATUS:', record.status],
    [''],
    ['--- RESUMO DOS TOTAIS DA CONCILIAÇÃO ---'],
    ['Total Dealer (R$):', formatBRL(record.totalDealer)],
    ['Total SiTef (R$):', formatBRL(record.totalSitef)],
    ['Diferença Apurada (R$):', formatBRL(record.diferencaTotal)],
    ['Qtd. Lançamentos Conciliados:', record.countTotal],
    ['Qtd. Empresas Conciliadas:', record.countEmpresas],
    ['Empresas:', record.empresasNomes.join(', ')],
    [''],
    ['--- RESUMO POR BANDEIRA / FORMA DE PAGAMENTO ---'],
    ['Bandeira / Tipo', 'Qtd. Lançamentos', 'Total Dealer (R$)', 'Total SiTef (R$)'],
  ];

  Object.entries(record.breakdownPorBandeira).forEach(([band, data]) => {
    summaryRows.push([
      band,
      String(data.count),
      formatBRL(data.totalDealer),
      formatBRL(data.totalSitef),
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo do Fechamento');

  // Sheet 2: Resumo por Empresa e Conta Gerencial
  const resumoEmpresaContaMap: Record<
    string,
    {
      empresa: string;
      contaGerencial: string;
      count: number;
      totalDealer: number;
      totalSitef: number;
      diferenca: number;
    }
  > = {};

  record.items.forEach((item) => {
    const emp = item.empresa || 'Empresa Geral';
    const cta = item.contaGerencial || item.departamento || 'Conta Não Especificada';
    const key = `${emp}__${cta}`;

    if (!resumoEmpresaContaMap[key]) {
      resumoEmpresaContaMap[key] = {
        empresa: emp,
        contaGerencial: cta,
        count: 0,
        totalDealer: 0,
        totalSitef: 0,
        diferenca: 0,
      };
    }

    resumoEmpresaContaMap[key].count += 1;
    resumoEmpresaContaMap[key].totalDealer += item.valorDealer || 0;
    resumoEmpresaContaMap[key].totalSitef += item.valorSitef || 0;
    resumoEmpresaContaMap[key].diferenca += (item.valorDealer || 0) - (item.valorSitef || 0);
  });

  // Sort by Empresa then Conta Gerencial
  const sortedResumoList = Object.values(resumoEmpresaContaMap).sort((a, b) => {
    if (a.empresa !== b.empresa) return a.empresa.localeCompare(b.empresa);
    return a.contaGerencial.localeCompare(b.contaGerencial);
  });

  const resumoEmpresaContaRows = [
    ['RESUMO DE CONCILIAÇÃO POR EMPRESA E CONTA GERENCIAL'],
    ['DATA DO MOVIMENTO:', record.dataMovimento],
    ['DATA/HORA FECHAMENTO:', new Date(record.dataFechamento).toLocaleString('pt-BR')],
    ['OPERADOR:', record.operador || 'Financeiro'],
    [''],
    [
      'Empresa',
      'Conta Gerencial / Departamento',
      'Qtd. Lançamentos',
      'Total Dealer (R$)',
      'Total SiTef (R$)',
      'Diferença (R$)',
      'Situação',
    ],
  ];

  let sumQtd = 0;
  let sumDealer = 0;
  let sumSitef = 0;
  let sumDif = 0;

  sortedResumoList.forEach((r) => {
    sumQtd += r.count;
    sumDealer += r.totalDealer;
    sumSitef += r.totalSitef;
    sumDif += r.diferenca;

    resumoEmpresaContaRows.push([
      r.empresa,
      r.contaGerencial,
      String(r.count),
      formatBRL(r.totalDealer),
      formatBRL(r.totalSitef),
      formatBRL(r.diferenca),
      Math.abs(r.diferenca) < 0.01 ? 'CONCILIADO' : 'DIVERGENTE',
    ]);
  });

  // Add Grand Total Row
  resumoEmpresaContaRows.push([
    'TOTAL GERAL CONSOLIDADO',
    'TODAS AS CONTAS GERENCIAIS',
    String(sumQtd),
    formatBRL(sumDealer),
    formatBRL(sumSitef),
    formatBRL(sumDif),
    Math.abs(sumDif) < 0.01 ? '100% CONCILIADO' : 'DIVERGENTE',
  ]);

  const wsResumoEmpresaConta = XLSX.utils.aoa_to_sheet(resumoEmpresaContaRows);
  XLSX.utils.book_append_sheet(wb, wsResumoEmpresaConta, 'Resumo Empresa e Conta');

  // Sheet 3: Itemized List
  const itemRows = [
    [
      'Empresa',
      'Departamento',
      'Conta Gerencial',
      'Caixa / Loja',
      'Data',
      'NSU',
      'Tipo / Bandeira Dealer',
      'Bandeira SiTef',
      'Valor Dealer (R$)',
      'Valor SiTef (R$)',
      'Diferença (R$)',
      'Status Conciliação',
      'Critério / Detalhes',
    ],
  ];

  record.items.forEach((item) => {
    itemRows.push([
      item.empresa || '',
      item.departamento || '',
      item.contaGerencial || '',
      item.caixaLoja || '',
      item.data || '',
      item.nsu || '',
      item.bandeiraDealer || item.tipoPagamento || '',
      item.bandeiraSitef || '',
      formatBRL(item.valorDealer),
      formatBRL(item.valorSitef),
      formatBRL(item.diferenca),
      item.status || 'CONCILIADO',
      item.detalhes || item.criterioConciliacao || '',
    ]);
  });

  const wsItems = XLSX.utils.aoa_to_sheet(itemRows);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Lançamentos Conciliados');

  const safeDateStr = record.dataMovimento.replace(/[/\\?%*:|"<>]/g, '-');
  XLSX.writeFile(wb, `Comprovante_Fechamento_Caixa_${safeDateStr}.xlsx`);
}

// Export to PDF using jsPDF & autoTable
export async function exportFechamentoCaixaPDF(record: FechamentoCaixaRecord): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Colors
  const primaryColor = [15, 23, 42]; // Slate 900
  const emeraldColor = [5, 150, 105]; // Emerald 600
  const lightBg = [248, 250, 252]; // Slate 50

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('COMPROVANTE OFICIAL DE FECHAMENTO DE CAIXA', 14, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SISTEMA INTEGRADO DE CONCILIAÇÃO FINANCEIRA DEALER x SITEF', 14, 22);

  // Status Badge on Header
  doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.roundedRect(138, 8, 58, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('100% CONCILIADO', 142, 17);

  // Info Box
  let currentY = 38;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(14, currentY, 182, 28, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, currentY, 182, 28, 'S');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DATA DO MOVIMENTO:', 18, currentY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(record.dataMovimento, 60, currentY + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('OPERADOR / CAIXA:', 110, currentY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(record.operador || 'Financeiro', 148, currentY + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('DATA DO FECHAMENTO:', 18, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(record.dataFechamento).toLocaleString('pt-BR'), 60, currentY + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('QTD. EMPRESAS:', 110, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(String(record.countEmpresas), 148, currentY + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('EMPRESAS:', 18, currentY + 23);
  doc.setFont('helvetica', 'normal');
  const empListText = record.empresasNomes.join(', ');
  doc.text(empListText.length > 70 ? empListText.substring(0, 70) + '...' : empListText, 60, currentY + 23);

  currentY += 34;

  // Totals Summary Box
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.rect(14, currentY, 182, 22, 'F');
  doc.setDrawColor(167, 243, 208); // Emerald 200
  doc.rect(14, currentY, 182, 22, 'S');

  doc.setTextColor(6, 95, 70); // Emerald 800
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO FINANCEIRO DA CONCILIAÇÃO:', 18, currentY + 8);

  doc.setFontSize(11);
  doc.text(`Total Dealer: ${formatBRL(record.totalDealer)}`, 18, currentY + 16);
  doc.text(`Total SiTef: ${formatBRL(record.totalSitef)}`, 82, currentY + 16);
  doc.text(`Diferença: R$ 0,00 (0.00%)`, 142, currentY + 16);

  currentY += 28;

  // Breakdown by Bandeira Table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RESUMO POR TIPO / BANDEIRA DE PAGAMENTO', 14, currentY);
  currentY += 4;

  const bandTableBody = Object.entries(record.breakdownPorBandeira).map(([band, data]) => [
    band,
    String(data.count),
    formatBRL(data.totalDealer),
    formatBRL(data.totalSitef),
    'R$ 0,00',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Bandeira / Tipo', 'Qtd. Itens', 'Total Dealer', 'Total SiTef', 'Diferença']],
    body: bandTableBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error autoTable adds lastAutoTable to doc
  currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : currentY + 40;

  // Itemized Table Header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`RELAÇÃO DE LANÇAMENTOS CONCILIADOS (${record.countTotal} ITENS)`, 14, currentY);
  currentY += 4;

  const itemTableBody = record.items.map((item) => [
    item.empresa || '',
    item.departamento || '',
    item.data || '',
    item.nsu || '',
    item.bandeiraDealer || item.tipoPagamento || '',
    formatBRL(item.valorDealer),
    formatBRL(item.valorSitef),
    'CONCILIADO',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Empresa', 'Departamento', 'Data', 'NSU', 'Bandeira', 'Val. Dealer', 'Val. SiTef', 'Status']],
    body: itemTableBody,
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error autoTable adds lastAutoTable to doc
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : currentY + 50;

  // Ensure signatures fit on page
  const pageHeight = doc.internal.pageSize.getHeight();
  let sigY = finalY;
  if (sigY + 30 > pageHeight) {
    doc.addPage();
    sigY = 30;
  }

  // Signatures Line
  doc.setDrawColor(148, 163, 184);
  doc.line(20, sigY, 90, sigY);
  doc.line(120, sigY, 190, sigY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Assinatura do Operador / Caixa', 32, sigY + 5);
  doc.text('Conferência Financeira / Controladoria', 130, sigY + 5);

  const safeDateStr = record.dataMovimento.replace(/[/\\?%*:|"<>]/g, '-');
  doc.save(`Comprovante_Fechamento_Caixa_${safeDateStr}.pdf`);
}
