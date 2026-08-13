'use client';

import React, { useEffect, useState } from 'react';
import { AuditLogEntry } from '@/types/audit';
import { getItemAuditTimeline } from '@/lib/audit-service';
import {
  History,
  X,
  User,
  Clock,
  Building2,
  Tag,
  ArrowRight,
  CheckCircle2,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ItemTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemIdentifier: string; // NSU or ID or description
  itemTitle?: string;
  itemAmount?: number;
}

export function ItemTimelineModal({
  isOpen,
  onClose,
  itemIdentifier,
  itemTitle,
  itemAmount,
}: ItemTimelineModalProps) {
  const [timeline, setTimeline] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && itemIdentifier) {
      setLoading(true);
      getItemAuditTimeline(itemIdentifier).then((logs) => {
        setTimeline(logs);
        setLoading(false);
      });
    }
  }, [isOpen, itemIdentifier]);

  if (!isOpen) return null;

  const formatBRL = (val?: number) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                <span>Histórico Rastreável do Lançamento</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                NSU / Registro: <strong className="text-amber-400">{itemIdentifier}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subheader info card */}
        {(itemTitle || itemAmount !== undefined) && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>{itemTitle || 'Detalhes do Registro'}</span>
            </div>
            {itemAmount !== undefined && (
              <div className="font-extrabold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full font-mono text-sm border border-emerald-200">
                {formatBRL(itemAmount)}
              </div>
            )}
          </div>
        )}

        {/* Timeline Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs font-semibold">Consultando trilha de auditoria no Supabase...</span>
            </div>
          ) : timeline.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 gap-3 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <AlertCircle className="w-8 h-8 text-slate-400" />
              <div>
                <p className="font-bold text-sm text-slate-700">Nenhum histórico rastreado individualmente</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Este registro foi importado em lote ou ainda não sofreu alterações manuais registradas na trilha de auditoria.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative border-l-2 border-emerald-500/30 ml-4 pl-6 space-y-6">
              {timeline.map((log) => {
                const dateObj = new Date(log.created_at);
                const formattedDate = dateObj.toLocaleDateString('pt-BR');
                const formattedTime = dateObj.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div key={log.id} className="relative group">
                    {/* Circle Node on Timeline */}
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white ring-4 ring-emerald-100 shadow-xs flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-300 transition-all space-y-2.5">
                      {/* Top bar of timeline entry */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-slate-900 text-white font-black text-[10px] rounded-md tracking-wider uppercase">
                            {log.operacao}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{log.descricao}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {formattedDate} às {formattedTime}
                          </span>
                        </div>
                      </div>

                      {/* User & Company info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-semibold text-slate-700">Responsável:</span>
                          <span className="font-bold text-slate-900">{log.user_name}</span>
                        </div>

                        {log.empresa && (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-semibold text-slate-700">Empresa:</span>
                            <span className="font-bold text-slate-900 truncate">{log.empresa}</span>
                          </div>
                        )}
                      </div>

                      {/* Before / After status transition */}
                      {(log.situacao_anterior !== '-' || log.situacao_nova !== '-') && (
                        <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-500">Situação:</span>
                          <span className="font-mono bg-slate-200/80 px-2 py-0.5 rounded text-slate-700 line-through">
                            {log.situacao_anterior}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                            {log.situacao_nova}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Auditoria mantida de forma imutável no Supabase</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
