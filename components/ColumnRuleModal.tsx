'use client';

import React, { useState } from 'react';
import { ColumnConfig, ColumnRule, RuleType } from '@/types/spreadsheet';
import {
  X,
  Plus,
  Trash2,
  Check,
  Calendar,
  DollarSign,
  FileText,
  Search,
  Filter,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface ColumnRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  selectedColumnId: string | null;
  onUpdateColumn: (updatedColumn: ColumnConfig) => void;
  onApplyRulesToAll?: (ruleType: RuleType) => void;
}

const RULE_LABELS: Record<RuleType, { label: string; desc: string; category: string }> = {
  none: { label: 'Sem Regra', desc: 'Nenhuma ação aplicada', category: 'Geral' },
  trim: { label: 'Remover Espaços (Trim)', desc: 'Remove espaços extras no início e fim do texto', category: 'Texto' },
  uppercase: { label: 'TUDO MAIÚSCULO', desc: 'Converte todas as letras para MAIÚSCULAS', category: 'Texto' },
  lowercase: { label: 'tudo minúsculo', desc: 'Converte todas as letras para minúsculas', category: 'Texto' },
  titlecase: { label: 'Primeira Letra Maiúscula', desc: 'Converte para Nome Próprio (ex: Carlos Alberto)', category: 'Texto' },
  remove_accents: { label: 'Remover Acentos', desc: 'Remove acentuação e caracteres com til/agudo', category: 'Texto' },
  remove_special_chars: { label: 'Remover Caracteres Especiais', desc: 'Mantém apenas letras, números e espaços', category: 'Texto' },
  format_cpf: { label: 'Formatar CPF (000.000.000-00)', desc: 'Valida e formata CPFs brasileiros com 11 dígitos', category: 'Documentos' },
  format_cnpj: { label: 'Formatar CNPJ (00.000.000/0000-00)', desc: 'Valida e formata CNPJs brasileiros', category: 'Documentos' },
  format_phone: { label: 'Formatar Telefone', desc: 'Formata telefones com DDD (ex: (11) 98765-4321)', category: 'Documentos' },
  format_currency_brl: { label: 'Formatar Moeda BRL (R$)', desc: 'Converte números/texto para Moeda R$', category: 'Números' },
  clean_currency_number: { label: 'Converter Moeda em Número', desc: 'Extrai valor decimal numérico de texto com R$', category: 'Números' },
  convert_date: { label: 'Padronizar Data', desc: 'Converte datas diversas para um formato único', category: 'Data' },
  round_number: { label: 'Arredondar Decimais', desc: 'Arredonda valores para N casas decimais', category: 'Números' },
  find_replace: { label: 'Localizar e Substituir', desc: 'Substitui determinado texto por outro', category: 'Texto' },
  fill_nulls: { label: 'Preencher Vazios', desc: 'Preenche células em branco com texto padrão', category: 'Filtro' },
  remove_null_rows: { label: 'Remover Linhas Vazias', desc: 'Exclui da visualização linhas sem valor nesta coluna', category: 'Filtro' },
};

export function ColumnRuleModal({
  isOpen,
  onClose,
  columns,
  selectedColumnId,
  onUpdateColumn,
}: ColumnRuleModalProps) {
  const [currentColId, setCurrentColId] = useState<string>(
    selectedColumnId || (columns[0]?.id ?? '')
  );

  const currentCol = columns.find((c) => c.id === currentColId) || columns[0];

  if (!isOpen || !currentCol) return null;

  const handleCustomHeaderChange = (val: string) => {
    onUpdateColumn({ ...currentCol, customHeader: val });
  };

  const handleTypeChange = (type: ColumnConfig['type']) => {
    onUpdateColumn({ ...currentCol, type });
  };

  const handleToggleVisible = () => {
    onUpdateColumn({ ...currentCol, visible: !currentCol.visible });
  };

  const handleAddRule = (type: RuleType) => {
    const newRule: ColumnRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      enabled: true,
      dateFormatConfig: type === 'convert_date' ? { targetFormat: 'DD/MM/YYYY' } : undefined,
      findReplaceConfig: type === 'find_replace' ? { findText: '', replaceText: '', matchCase: false } : undefined,
      roundConfig: type === 'round_number' ? { decimals: 2 } : undefined,
      fillNullsConfig: type === 'fill_nulls' ? { value: 'N/A' } : undefined,
    };

    onUpdateColumn({
      ...currentCol,
      rules: [...currentCol.rules, newRule],
    });
  };

  const handleRemoveRule = (ruleId: string) => {
    onUpdateColumn({
      ...currentCol,
      rules: currentCol.rules.filter((r) => r.id !== ruleId),
    });
  };

  const handleToggleRule = (ruleId: string) => {
    onUpdateColumn({
      ...currentCol,
      rules: currentCol.rules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    });
  };

  const handleUpdateRuleConfig = (ruleId: string, partial: Partial<ColumnRule>) => {
    onUpdateColumn({
      ...currentCol,
      rules: currentCol.rules.map((r) => (r.id === ruleId ? { ...r, ...partial } : r)),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs border border-blue-200">
              {currentCol.id.replace('col_', 'Col ')}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Regras de Transformação da Coluna</h3>
              <p className="text-[11px] text-slate-500">
                Ajuste nome, tipo de dado e ative regras em cadeia para esta coluna
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Column Selector Sidebar */}
          <div className="w-52 border-r border-slate-200 bg-slate-50/50 p-2 overflow-y-auto space-y-1 flex-shrink-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Colunas ({columns.length})
            </div>
            {columns.map((col) => {
              const activeRules = col.rules.filter((r) => r.enabled).length;
              const isSelected = col.id === currentCol.id;
              return (
                <button
                  key={col.id}
                  onClick={() => setCurrentColId(col.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white font-medium shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  <span className="truncate pr-1">
                    {col.customHeader || col.originalHeader}
                  </span>
                  <div className="flex items-center gap-1">
                    {activeRules > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected ? 'bg-blue-800 text-blue-100' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {activeRules}
                      </span>
                    )}
                    {!col.visible && (
                      <EyeOff className={`w-3 h-3 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Column Settings Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Field Settings Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nome do Cabeçalho
                </label>
                <input
                  type="text"
                  value={currentCol.customHeader}
                  onChange={(e) => handleCustomHeaderChange(e.target.value)}
                  placeholder={currentCol.originalHeader}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tipo de Dado
                </label>
                <select
                  value={currentCol.type}
                  onChange={(e) => handleTypeChange(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                  <option value="currency">Moeda (R$)</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Exibição
                </label>
                <button
                  onClick={handleToggleVisible}
                  className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 border rounded font-medium transition-colors ${
                    currentCol.visible
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  {currentCol.visible ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Visível na Tabela</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                      <span>Oculta na Tabela</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Add Preset Rule Shortcuts */}
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Ações Rápidas Populares</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <button
                  onClick={() => handleAddRule('trim')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 text-slate-700 border border-slate-200 rounded font-medium transition-all"
                >
                  + Trim (Espaços)
                </button>
                <button
                  onClick={() => handleAddRule('titlecase')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 text-slate-700 border border-slate-200 rounded font-medium transition-all"
                >
                  + Nome Próprio
                </button>
                <button
                  onClick={() => handleAddRule('format_cpf')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 text-slate-700 border border-slate-200 rounded font-medium transition-all"
                >
                  + Formatar CPF
                </button>
                <button
                  onClick={() => handleAddRule('convert_date')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 text-slate-700 border border-slate-200 rounded font-medium transition-all"
                >
                  + Data DD/MM/YYYY
                </button>
                <button
                  onClick={() => handleAddRule('format_currency_brl')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 text-slate-700 border border-slate-200 rounded font-medium transition-all"
                >
                  + Moeda (R$)
                </button>
              </div>
            </div>

            {/* Configured Rules List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Regras Ativas Sequenciais ({currentCol.rules.length})
                </span>
                <span className="text-[11px] text-slate-400 italic">
                  Serão executadas na ordem abaixo
                </span>
              </div>

              {currentCol.rules.length === 0 ? (
                <div className="p-6 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                  Nenhuma regra aplicada a esta coluna. Escolha uma ação rápida acima ou adicione no menu abaixo.
                </div>
              ) : (
                <div className="space-y-2">
                  {currentCol.rules.map((rule, index) => {
                    const info = RULE_LABELS[rule.type] || RULE_LABELS.none;
                    return (
                      <div
                        key={rule.id}
                        className={`p-3 rounded-lg border text-xs transition-all ${
                          rule.enabled
                            ? 'bg-white border-slate-300 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                              {index + 1}
                            </span>
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={() => handleToggleRule(rule.id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                            />
                            <div>
                              <span className="font-bold text-slate-800">{info.label}</span>
                              <p className="text-[11px] text-slate-500">{info.desc}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveRule(rule.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remover regra"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Extra Config Details per Rule Type */}
                        {rule.type === 'convert_date' && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">
                              Formato de Destino:
                            </span>
                            <select
                              value={rule.dateFormatConfig?.targetFormat || 'DD/MM/YYYY'}
                              onChange={(e) =>
                                handleUpdateRuleConfig(rule.id, {
                                  dateFormatConfig: {
                                    targetFormat: e.target.value as any,
                                  },
                                })
                              }
                              className="px-2 py-1 border border-slate-200 rounded text-xs bg-white font-medium focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="DD/MM/YYYY">DD/MM/YYYY (ex: 25/12/2026)</option>
                              <option value="YYYY-MM-DD">YYYY-MM-DD (ex: 2026-12-25)</option>
                              <option value="DD/MM/YYYY HH:mm">DD/MM/YYYY HH:mm</option>
                              <option value="MM/DD/YYYY">MM/DD/YYYY (EUA)</option>
                            </select>
                          </div>
                        )}

                        {rule.type === 'find_replace' && (
                          <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] font-semibold text-slate-500">Localizar:</span>
                              <input
                                type="text"
                                placeholder="Texto a encontrar"
                                value={rule.findReplaceConfig?.findText || ''}
                                onChange={(e) =>
                                  handleUpdateRuleConfig(rule.id, {
                                    findReplaceConfig: {
                                      ...rule.findReplaceConfig!,
                                      findText: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-slate-500">Substituir por:</span>
                              <input
                                type="text"
                                placeholder="Novo texto"
                                value={rule.findReplaceConfig?.replaceText || ''}
                                onChange={(e) =>
                                  handleUpdateRuleConfig(rule.id, {
                                    findReplaceConfig: {
                                      ...rule.findReplaceConfig!,
                                      replaceText: e.target.value,
                                    },
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                              />
                            </div>
                          </div>
                        )}

                        {rule.type === 'round_number' && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">Casas Decimais:</span>
                            <input
                              type="number"
                              min="0"
                              max="6"
                              value={rule.roundConfig?.decimals ?? 2}
                              onChange={(e) =>
                                handleUpdateRuleConfig(rule.id, {
                                  roundConfig: {
                                    decimals: parseInt(e.target.value, 10) || 0,
                                  },
                                })
                              }
                              className="w-16 px-2 py-1 border border-slate-200 rounded text-xs bg-white text-center font-bold"
                            />
                          </div>
                        )}

                        {rule.type === 'fill_nulls' && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">Valor Substituto:</span>
                            <input
                              type="text"
                              value={rule.fillNullsConfig?.value || ''}
                              onChange={(e) =>
                                handleUpdateRuleConfig(rule.id, {
                                  fillNullsConfig: { value: e.target.value },
                                })
                              }
                              className="px-2 py-1 border border-slate-200 rounded text-xs bg-white font-medium"
                              placeholder="ex: Não informado"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dropdown to add all other rules */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Adicionar Outra Regra
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value !== 'none') {
                    handleAddRule(e.target.value as RuleType);
                    e.target.value = 'none';
                  }
                }}
                defaultValue="none"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="none" disabled>
                  -- Escolha uma regra para adicionar --
                </option>
                {Object.entries(RULE_LABELS).map(([key, item]) => {
                  if (key === 'none') return null;
                  return (
                    <option key={key} value={key}>
                      [{item.category}] {item.label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Regras são aplicadas em tempo real na tabela principal.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-2xs transition-colors"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
