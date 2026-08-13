'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FechamentoCaixaRecord,
  getHistoricoFechamento,
  deleteFechamentoCaixa,
  exportFechamentoCaixaExcel,
  exportFechamentoCaixaPDF,
  clearHistoricoFechamento,
} from '@/lib/fechamento-caixa-service';
import { getCurrentUser, hasPermission } from '@/lib/auth-service';
import { logAuditAction } from '@/lib/audit-service';
import {
  History,
  X,
  FileSpreadsheet,
  FileText,
  Trash2,
  Search,
  CheckCircle2,
  Calendar,
  User,
  Building2,
  Eye,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  RotateCcw,
  Unlock,
} from 'lucide-react';

interface HistoricoFechamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreRecord?: (record: FechamentoCaixaRecord) => void;
}

export function HistoricoFechamentoModal({ isOpen, onClose, onRestoreRecord }: HistoricoFechamentoModalProps) {
  const [records, setRecords] = useState<FechamentoCaixaRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordDetails, setSelectedRecordDetails] = useState<FechamentoCaixaRecord | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Reopen Modal State
  const [reopenRecord, setReopenRecord] = useState<FechamentoCaixaRecord | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const currentUser = getCurrentUser();
  const canReopen = hasPermission('reabrir_fechamento', currentUser);

  const loadHistory = () => {
    const list = getHistoricoFechamento();
    setRecords(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      setSelectedRecordDetails(null);
      setConfirmClear(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteRecord = (id: string) => {
    const updated = deleteFechamentoCaixa(id);
    setRecords(updated);
    if (selectedRecordDetails?.id === id) {
      setSelectedRecordDetails(null);
    }
  };

  const handleClearAll = () => {
    clearHistoricoFechamento();
    setRecords([]);
    setSelectedRecordDetails(null);
    setConfirmClear(false);
  };

  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.dataMovimento.toLowerCase().includes(q) ||
      r.operador.toLowerCase().includes(q) ||
      (r.observacoes && r.observacoes.toLowerCase().includes(q)) ||
      r.empresasNomes.some((e) => e.toLowerCase().includes(q))
    );
  });

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30 text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Histórico de Fechamentos do Caixa</h3>
              <p className="text-xs text-slate-400">
                Registro permanente dos caixas encerrados com 100% de conciliação
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

        {/* Toolbar & Search */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Data, Operador ou Empresa..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">
              Total de Fechamentos: <span className="text-slate-900">{records.length}</span>
            </span>
            {records.length > 0 && (
              <button
                onClick={() => setConfirmClear(!confirmClear)}
                className="px-2.5 py-1.5 text-rose-700 hover:bg-rose-100 font-bold rounded-lg transition-colors border border-rose-200"
              >
                Limpar Histórico
              </button>
            )}
          </div>
        </div>

        {/* Clear Confirmation Prompt */}
        {confirmClear && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Tem certeza que deseja apagar todo o histórico de fechamentos salvos?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAll}
                className="px-3 py-1 bg-rose-600 text-white font-bold rounded-md hover:bg-rose-700"
              >
                Sim, Limpar Tudo
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1 bg-slate-200 text-slate-800 font-bold rounded-md"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Content Table / Cards */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                <History className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                Nenhum fechamento registrado no histórico
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Quando você realizar o encerramento do caixa do dia 100% conciliado, os comprovantes e dados ficarão salvos nesta tela para emissão futura de PDF/Excel.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((rec) => {
                const isSelected = selectedRecordDetails?.id === rec.id;

                return (
                  <div
                    key={rec.id}
                    className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
                  >
                    {/* Item Card Header */}
                    <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-black border border-emerald-200">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900">
                              Movimento: {rec.dataMovimento}
                            </span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                              100% CONCILIADO
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              {rec.operador}
                            </span>
                            <span>•</span>
                            <span>{rec.countTotal} lançamentos</span>
                            <span>•</span>
                            <span>{rec.countEmpresas} empresa(s)</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Totals & Actions */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase text-slate-500 block font-bold">
                            Total Conciliado
                          </span>
                          <span className="font-extrabold text-emerald-700 text-base">
                            {formatBRL(rec.totalDealer)}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {canReopen && (
                            <button
                              onClick={() => {
                                setReopenRecord(rec);
                                setReopenReason('');
                              }}
                              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer hover:scale-102"
                              title="Reabrir este fechamento com justificativa gravada na auditoria"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Reabrir Lote</span>
                            </button>
                          )}

                          {onRestoreRecord && (
                            <button
                              onClick={() => {
                                onRestoreRecord(rec);
                                onClose();
                              }}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                              title="Reexibir este fechamento no painel de conciliação"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                              <span>Reexibir</span>
                            </button>
                          )}

                          <button
                            onClick={() => exportFechamentoCaixaExcel(rec)}
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="Baixar Planilha Excel"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="hidden sm:inline">Excel</span>
                          </button>

                          <button
                            onClick={() => exportFechamentoCaixaPDF(rec)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="Baixar Comprovante PDF"
                          >
                            <FileText className="w-4 h-4 text-slate-700" />
                            <span className="hidden sm:inline">PDF</span>
                          </button>

                          <button
                            onClick={() =>
                              setSelectedRecordDetails(isSelected ? null : rec)
                            }
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 font-bold text-xs transition-colors cursor-pointer"
                            title="Ver Detalhes do Fechamento"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="p-2 hover:bg-rose-100 text-rose-600 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title="Excluir do Histórico"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details Section */}
                    {isSelected && (
                      <div className="p-4 bg-white border-t border-slate-200 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div>
                            <span className="text-slate-500 font-bold block text-[10px]">
                              Data/Hora da Gravação:
                            </span>
                            <span className="text-slate-800 font-semibold">
                              {new Date(rec.dataFechamento).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-bold block text-[10px]">
                              Empresas do Movimento:
                            </span>
                            <span className="text-slate-800 font-semibold">
                              {rec.empresasNomes.join(', ')}
                            </span>
                          </div>
                          {rec.observacoes && (
                            <div className="col-span-2">
                              <span className="text-slate-500 font-bold block text-[10px]">
                                Observações:
                              </span>
                              <span className="text-slate-800">{rec.observacoes}</span>
                            </div>
                          )}
                        </div>

                        {/* Breakdown por Bandeira Table */}
                        <div className="space-y-1">
                          <span className="font-extrabold text-slate-800 text-[11px] block">
                            Resumo por Bandeira / Forma de Pagamento:
                          </span>
                          <div className="overflow-x-auto border border-slate-200 rounded-lg">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-slate-100 text-slate-700 font-bold">
                                <tr>
                                  <th className="p-2">Bandeira / Tipo</th>
                                  <th className="p-2">Qtd Itens</th>
                                  <th className="p-2">Total Dealer</th>
                                  <th className="p-2">Total SiTef</th>
                                  <th className="p-2">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {Object.entries(rec.breakdownPorBandeira).map(([band, data]) => (
                                  <tr key={band} className="hover:bg-slate-50">
                                    <td className="p-2 font-bold text-slate-800">{band}</td>
                                    <td className="p-2 text-slate-600">{data.count}</td>
                                    <td className="p-2 font-extrabold text-emerald-700">
                                      {formatBRL(data.totalDealer)}
                                    </td>
                                    <td className="p-2 font-extrabold text-blue-700">
                                      {formatBRL(data.totalSitef)}
                                    </td>
                                    <td className="p-2 text-emerald-700 font-bold">100% OK</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>
      </div>

      {/* Modal Confirmar Reabertura do Fechamento */}
      {reopenRecord && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                <Unlock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Reabrir Fechamento do Caixa</h4>
                <p className="text-xs text-slate-500 font-mono">Movimento: {reopenRecord.dataMovimento}</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              Esta ação reabrirá o fechamento de R$ <strong>{formatBRL(reopenRecord.totalDealer)}</strong> para edições e correções. Uma ocorrência de <strong>REABERTURA_LOTE</strong> será gravada permanentemente na auditoria do Supabase.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Motivo / Justificativa da Reabertura *
              </label>
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Ex: Ajuste de divergência encontrada pela auditoria no depto de oficina..."
                className="w-full p-3 text-xs border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReopenRecord(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!reopenReason.trim()}
                onClick={() => {
                  if (!reopenReason.trim()) return;

                  // Registra na Auditoria
                  logAuditAction({
                    operacao: 'REABERTURA_LOTE',
                    descricao: `Fechamento do movimento ${reopenRecord.dataMovimento} reaberto por ${currentUser.name}. Motivo: ${reopenReason.trim()}`,
                    empresa: reopenRecord.empresasNomes.join(', '),
                    valor: reopenRecord.totalDealer,
                    situacao_anterior: '100% CONCILIADO - FECHADO',
                    situacao_nova: 'REABERTO PARA AJUSTES',
                    lote_id: reopenRecord.id,
                  });

                  if (onRestoreRecord) {
                    onRestoreRecord(reopenRecord);
                  }

                  setReopenRecord(null);
                  onClose();
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5"
              >
                <Unlock className="w-4 h-4" />
                <span>Confirmar Reabertura</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
