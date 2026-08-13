'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FechamentoCaixaRecord,
  saveFechamentoCaixa,
  exportFechamentoCaixaExcel,
  exportFechamentoCaixaPDF,
} from '@/lib/fechamento-caixa-service';
import { getCurrentUser } from '@/lib/auth-service';
import { logAuditAction } from '@/lib/audit-service';
import { FechamentoItem } from '@/lib/fechamento-utils';
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
  FileSpreadsheet,
  FileText,
  Calendar,
  User,
  Building2,
  DollarSign,
  Download,
  Check,
  RotateCcw,
} from 'lucide-react';

interface FechamentoCaixaModalProps {
  isOpen: boolean;
  onClose: () => void;
  fechamentoItems: FechamentoItem[];
  onSuccessClosure: (record: FechamentoCaixaRecord) => void;
  onFilterDivergences?: () => void;
}

export function FechamentoCaixaModal({
  isOpen,
  onClose,
  fechamentoItems,
  onSuccessClosure,
  onFilterDivergences,
}: FechamentoCaixaModalProps) {
  // Extract default date from items or fallback to today
  const defaultDateStr = useMemo(() => {
    if (fechamentoItems.length > 0 && fechamentoItems[0].data) {
      const rawDate = fechamentoItems[0].data;
      if (rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          let year = parts[2];
          if (year.length === 2) year = '20' + year;
          return `${year}-${month}-${day}`;
        }
      }
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [fechamentoItems]);

  const [dataMovimentoInput, setDataMovimentoInput] = useState(defaultDateStr);
  const [operador, setOperador] = useState('Operador do Caixa');
  const [observacoes, setObservacoes] = useState('');
  const [downloadExcel, setDownloadExcel] = useState(true);
  const [downloadPdf, setDownloadPdf] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastRecord, setLastRecord] = useState<FechamentoCaixaRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDataMovimentoInput(defaultDateStr);
      setIsSuccess(false);
      setLastRecord(null);
    }
  }, [isOpen, defaultDateStr]);

  if (!isOpen) return null;

  // Calculate summary metrics
  let totalDealer = 0;
  let totalSitef = 0;
  let countDivergencias = 0;
  const empresasSet = new Set<string>();
  const breakdownPorBandeira: Record<string, { count: number; totalDealer: number; totalSitef: number }> = {};

  fechamentoItems.forEach((item) => {
    totalDealer += item.valorDealer || 0;
    totalSitef += item.valorSitef || 0;
    if (item.temDivergencia) countDivergencias++;
    if (item.empresa) empresasSet.add(item.empresa);

    const bandKey = item.bandeiraDealer || item.bandeiraSitef || item.tipoPagamento || 'Geral';
    if (!breakdownPorBandeira[bandKey]) {
      breakdownPorBandeira[bandKey] = { count: 0, totalDealer: 0, totalSitef: 0 };
    }
    breakdownPorBandeira[bandKey].count++;
    breakdownPorBandeira[bandKey].totalDealer += item.valorDealer || 0;
    breakdownPorBandeira[bandKey].totalSitef += item.valorSitef || 0;
  });

  const diferencaTotal = Math.abs(Math.round((totalDealer - totalSitef) * 100) / 100);
  const countTotal = fechamentoItems.length;
  const is100PercentConciliated = countTotal > 0 && countDivergencias === 0 && diferencaTotal === 0;

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const formattedDateMovimentoStr = (() => {
    if (!dataMovimentoInput) return new Date().toLocaleDateString('pt-BR');
    const [y, m, d] = dataMovimentoInput.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return dataMovimentoInput;
  })();

  const handleConfirmClosure = async () => {
    if (!is100PercentConciliated) return;

    setIsSubmitting(true);

    const record: FechamentoCaixaRecord = {
      id: `FECH-${Date.now()}`,
      dataMovimento: formattedDateMovimentoStr,
      dataFechamento: new Date().toISOString(),
      operador: operador.trim() || 'Operador do Caixa',
      observacoes: observacoes.trim(),
      totalDealer,
      totalSitef,
      diferencaTotal: 0,
      countTotal,
      countEmpresas: empresasSet.size,
      empresasNomes: Array.from(empresasSet),
      breakdownPorBandeira,
      status: '100% CONCILIADO - FECHADO',
      items: fechamentoItems,
    };

    saveFechamentoCaixa(record);
    setLastRecord(record);

    // Audit Logging to Supabase
    logAuditAction({
      operacao: 'FECHAMENTO_LOTE',
      descricao: `Fechamento do caixa concluído com 100% de conciliação para o movimento ${formattedDateMovimentoStr}`,
      empresa: record.empresasNomes.join(', '),
      valor: totalDealer,
      situacao_anterior: 'EM CONCILIACAO',
      situacao_nova: '100% CONCILIADO - FECHADO',
      lote_id: record.id,
      meta_data: {
        operador: record.operador,
        qtd_itens: countTotal,
        qtd_empresas: record.countEmpresas,
      },
    });

    // Downloads
    if (downloadExcel) {
      exportFechamentoCaixaExcel(record);
    }
    if (downloadPdf) {
      await exportFechamentoCaixaPDF(record);
    }

    setIsSubmitting(false);
    setIsSuccess(true);
    onSuccessClosure(record);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Fechamento de Caixa do Dia</h3>
              <p className="text-xs text-slate-400">
                Encerrar movimento e emitir comprovante 100% conciliado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {isSuccess && lastRecord ? (
            /* Success View */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-300 shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900">
                  Caixa Fechado com Sucesso!
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  O movimento do dia <strong>{lastRecord.dataMovimento}</strong> foi registrado no histórico como 100% conciliado.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Operador:</span>
                  <span className="font-bold text-slate-800">{lastRecord.operador}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Conciliado:</span>
                  <span className="font-extrabold text-emerald-700">
                    {formatBRL(lastRecord.totalDealer)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Qtd. Lançamentos:</span>
                  <span className="font-bold text-slate-800">{lastRecord.countTotal} itens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> 100% Conciliado
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  onClick={() => exportFechamentoCaixaExcel(lastRecord)}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-2xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Baixar Excel Novamente</span>
                </button>
                <button
                  onClick={() => exportFechamentoCaixaPDF(lastRecord)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-2xs"
                >
                  <FileText className="w-4 h-4" />
                  <span>Baixar PDF Novamente</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          ) : countTotal === 0 ? (
            /* Empty State */
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                Nenhum lançamento no movimento
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Importe planilhas do Dealer e do SiTef para gerar os dados de conciliação antes de realizar o fechamento do caixa.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg text-xs"
              >
                Voltar
              </button>
            </div>
          ) : !is100PercentConciliated ? (
            /* Divergence Warning View */
            <div className="space-y-4">
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span>Atenção: Não é possível fechar o caixa ainda!</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Existem <strong>{countDivergencias} divergência(s)</strong> pendentes de resolução no movimento atual. O caixa só pode ser encerrado quando 100% dos lançamentos estiverem conciliados (Divergências = 0).
                </p>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Total Dealer
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {formatBRL(totalDealer)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Total SiTef
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {formatBRL(totalSitef)}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-amber-800 block text-[10px] uppercase font-bold">
                    Divergências
                  </span>
                  <span className="font-black text-amber-900 text-sm">
                    {countDivergencias} item(ns)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 leading-snug">
                💡 <strong>Dica:</strong> Clique no botão abaixo para filtrar as divergências na tela principal e efetuar os ajustes ou exclusões necessários.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                {onFilterDivergences && (
                  <button
                    onClick={() => {
                      onFilterDivergences();
                      onClose();
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs shadow-2xs flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Ver e Filtrar Divergências</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* 100% Conciliated Ready View */
            <div className="space-y-5">
              {/* Green Banner */}
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center gap-3 text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <h5 className="font-black text-xs uppercase tracking-wider text-emerald-950">
                    100% Conciliado - Caixa Pronto para Fechamento
                  </h5>
                  <p className="text-xs text-emerald-800">
                    Todos os <strong>{countTotal} lançamentos</strong> estão em conformidade perfeita entre o Dealer e o SiTef.
                  </p>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Data do Movimento */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Data do Movimento:</span>
                  </label>
                  <input
                    type="date"
                    value={dataMovimentoInput}
                    onChange={(e) => setDataMovimentoInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-slate-50 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Data a qual pertence a conciliação
                  </span>
                </div>

                {/* Operador / Responsável */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span>Operador / Responsável:</span>
                  </label>
                  <input
                    type="text"
                    value={operador}
                    onChange={(e) => setOperador(e.target.value)}
                    placeholder="Ex: Carlos - Financeiro"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações adicionais (opcional):
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Caixa conferido e fechado sem alterações..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Movement Totals Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <span className="font-black text-slate-800 uppercase tracking-wider text-[10px] block">
                  Resumo Financeiro a Ser Encerrado
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-800">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Total Dealer</span>
                    <strong className="text-emerald-700 font-extrabold text-sm">
                      {formatBRL(totalDealer)}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Total SiTef</span>
                    <strong className="text-blue-700 font-extrabold text-sm">
                      {formatBRL(totalSitef)}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Diferença</span>
                    <strong className="text-emerald-600 font-extrabold text-sm">R$ 0,00</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Lançamentos</span>
                    <strong className="text-slate-900 font-extrabold text-sm">
                      {countTotal} itens
                    </strong>
                  </div>
                </div>
              </div>

              {/* Checkbox Options for Automatic Export */}
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                <span className="text-xs font-extrabold text-amber-900 block">
                  Ações automáticas ao fechar:
                </span>
                <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={downloadExcel}
                      onChange={(e) => setDownloadExcel(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Baixar Planilha Excel (.xlsx)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={downloadPdf}
                      onChange={(e) => setDownloadPdf(e.target.checked)}
                      className="rounded border-slate-300 text-slate-800 focus:ring-slate-800"
                    />
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-slate-800" />
                      Baixar Comprovante PDF Oficial (.pdf)
                    </span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClosure}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isSubmitting ? 'Encerrando Caixa...' : 'Confirmar Fechamento de Caixa'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
