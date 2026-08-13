'use client';

import React, { useState } from 'react';
import { ColumnConfig, ColumnRule, DataQualityReport, RuleType, AISuggestion } from '@/types/spreadsheet';
import {
  Sparkles,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Send,
  Zap,
} from 'lucide-react';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  rawData: Record<string, any>[];
  onApplySingleSuggestion: (columnId: string, rule: ColumnRule) => void;
  onApplyAllSuggestions: (suggestions: Array<{ columnId: string; rule: ColumnRule }>) => void;
}

export function AIAssistantDrawer({
  isOpen,
  onClose,
  columns,
  rawData,
  onApplySingleSuggestion,
  onApplyAllSuggestions,
}: AIAssistantDrawerProps) {
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // QA Question Chat state
  const [userQuery, setUserQuery] = useState('');
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [appliedAll, setAppliedAll] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setLoading(true);
    setErrorMessage(null);
    setAppliedIds([]);
    setAppliedAll(false);

    try {
      const sampleRows = rawData.slice(0, 30);
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: columns.map((c) => ({
            id: c.id,
            header: c.customHeader || c.originalHeader,
            type: c.type,
          })),
          sampleRows,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao analisar com a IA Gemini');
      }

      const data: DataQualityReport = await res.json();
      setReport(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar análise da IA.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!userQuery.trim()) return;
    setChatLoading(true);
    setChatAnswer(null);

    try {
      const sampleRows = rawData.slice(0, 30);
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: columns.map((c) => ({
            id: c.id,
            header: c.customHeader || c.originalHeader,
            type: c.type,
          })),
          sampleRows,
          userQuery: userQuery.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao consultar IA');
      }

      const data = await res.json();
      setChatAnswer(data.answer);
    } catch (err: any) {
      setChatAnswer(`Erro: ${err.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  const mapSuggestionToRule = (sug: AISuggestion): ColumnRule => {
    if (sug.suggestedRule) return sug.suggestedRule;
    const ruleType = (sug.ruleType || 'trim') as RuleType;
    return {
      id: `ai_rule_${sug.id}`,
      type: ruleType,
      enabled: true,
      dateFormatConfig: ruleType === 'convert_date' ? { targetFormat: 'DD/MM/YYYY' } : undefined,
      fillNullsConfig: ruleType === 'fill_nulls' ? { value: '-' } : undefined,
    };
  };

  const handleApplySingle = (sug: AISuggestion) => {
    onApplySingleSuggestion(sug.columnId, mapSuggestionToRule(sug));
    setAppliedIds((prev) => (prev.includes(sug.id) ? prev : [...prev, sug.id]));
  };

  const handleApplyAll = () => {
    if (!report || !report.suggestions) return;
    const payload = report.suggestions.map((sug) => ({
      columnId: sug.columnId,
      rule: mapSuggestionToRule(sug),
    }));
    onApplyAllSuggestions(payload);
    setAppliedAll(true);
    setAppliedIds(report.suggestions.map((s) => s.id));
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col text-slate-800 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Assistente Inteligente</h3>
            <p className="text-[11px] text-slate-300">Análise diagnóstica e sugestões de limpeza</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Trigger Analysis Button */}
        {!report && !loading && (
          <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Diagnóstico da Planilha</h4>
              <p className="text-slate-500 text-[11px] mt-1">
                A IA analisará as colunas e os dados para detectar CPFs desformatados, datas inconsistentes, espaços em branco e sugerir correções imediatas.
              </p>
            </div>
            <button
              onClick={handleAnalyze}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analisar Planilha Agora</span>
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="p-8 text-center space-y-3 border border-slate-200 rounded-xl bg-slate-50">
            <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin" />
            <p className="font-semibold text-slate-700">Analisando padrão dos dados com Gemini IA...</p>
            <p className="text-[11px] text-slate-400">Verificando consistência, datas e formatos</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 border border-red-200 bg-red-50 text-red-800 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <span className="font-bold block">Erro na Análise</span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Quality Report Results */}
        {report && (
          <div className="space-y-4">
            {/* Score & Re-analyze Header */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base ${
                    report.score >= 80
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : report.score >= 60
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  {report.score}%
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Saúde dos Dados
                  </span>
                  <p className="font-bold text-slate-800 text-xs">{report.summaryText}</p>
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                className="p-2 text-slate-500 hover:text-blue-700 hover:bg-slate-200/60 rounded transition-colors"
                title="Reanalisar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
              <div className="p-2 bg-slate-100/70 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Valores em Branco</span>
                <span className="font-bold text-slate-800 text-xs">
                  {report.issuesCount?.missing ?? 0}
                </span>
              </div>
              <div className="p-2 bg-slate-100/70 border border-slate-200 rounded-lg">
                <span className="text-slate-500 block text-[10px]">Espaços Extras / Formatos</span>
                <span className="font-bold text-slate-800 text-xs">
                  {report.issuesCount?.spaces ?? 0}
                </span>
              </div>
            </div>

            {/* Apply All Action */}
            {report.suggestions && report.suggestions.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-900 text-xs block">
                    {report.suggestions.length} Sugestões de Correção
                  </span>
                  <span className="text-[10px] text-blue-700">
                    {appliedAll ? 'Todas as regras aplicadas com sucesso!' : 'Aplique todas as regras recomendadas'}
                  </span>
                </div>
                <button
                  onClick={handleApplyAll}
                  disabled={appliedAll}
                  className={`px-3 py-1.5 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 ${
                    appliedAll
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{appliedAll ? 'Aplicadas ✓' : 'Aplicar Todas'}</span>
                </button>
              </div>
            )}

            {/* Suggestions Cards List in Geometric Balance AI card styling */}
            <div className="space-y-3">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block text-[11px]">
                Sugestões Detalhadas por Coluna
              </span>
              {report.suggestions?.map((sug) => {
                const isWarning = sug.suggestedRule?.type === 'format_cpf' || sug.issueType === 'invalid_data' || sug.title.toLowerCase().includes('inválido') || sug.title.toLowerCase().includes('cpf');
                const isApplied = appliedAll || appliedIds.includes(sug.id);

                return (
                  <div
                    key={sug.id}
                    className={`p-3.5 rounded-lg border space-y-2 transition-colors ${
                      isApplied
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : isWarning
                        ? 'bg-[#fff7ed] border-[#ffedd5]'
                        : 'bg-[#eff6ff] border-[#bfdbfe]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 font-bold rounded text-[10px] border ${
                        isApplied
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                          : isWarning
                          ? 'bg-amber-100 text-amber-900 border-amber-200'
                          : 'bg-blue-100 text-blue-900 border-blue-200'
                      }`}>
                        Coluna: {sug.columnName}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        isApplied
                          ? 'text-emerald-800 bg-emerald-100/50 border-emerald-200'
                          : isWarning
                          ? 'text-amber-800 bg-amber-100/50 border-amber-200'
                          : 'text-blue-800 bg-blue-100/50 border-blue-200'
                      }`}>
                        Confiança: {sug.confidence}
                      </span>
                    </div>

                    <div>
                      <h5 className={`font-bold text-xs ${
                        isApplied ? 'text-emerald-900' : isWarning ? 'text-[#9a3412]' : 'text-[#1e40af]'
                      }`}>
                        {sug.title}
                      </h5>
                      <p className={`text-[11px] mt-0.5 leading-relaxed ${
                        isApplied ? 'text-emerald-800/90' : isWarning ? 'text-[#9a3412]/90' : 'text-[#1e40af]/90'
                      }`}>
                        {sug.description}
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleApplySingle(sug)}
                        disabled={isApplied}
                        className={`px-3 py-1.5 font-semibold rounded text-[11px] border transition-colors flex items-center gap-1 ${
                          isApplied
                            ? 'bg-emerald-600 text-white border-emerald-600 cursor-default'
                            : isWarning
                            ? 'bg-white hover:bg-amber-100 text-amber-900 border-[#fdba74]'
                            : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Aplicado ✓</span>
                          </>
                        ) : (
                          <>
                            <span>Aplicar Correção</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* QA Question Box */}
        <div className="border-t border-slate-200 pt-4 space-y-2">
          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Perguntar à IA sobre a Planilha</span>
          </span>

          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Ex: Quais linhas possuem valores zerados?"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAskQuestion}
              disabled={chatLoading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center"
            >
              {chatLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {chatAnswer && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[11px] whitespace-pre-wrap leading-relaxed mt-2">
              {chatAnswer}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
