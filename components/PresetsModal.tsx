'use client';

import React, { useState } from 'react';
import { ColumnConfig, RulePreset } from '@/types/spreadsheet';
import { getSavedPresets, saveUserPreset, deleteUserPreset } from '@/lib/preset-store';
import { X, Bookmark, Plus, Trash2, Check, Sparkles, FolderDown } from 'lucide-react';

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onApplyPreset: (preset: RulePreset) => void;
}

export function PresetsModal({
  isOpen,
  onClose,
  columns,
  onApplyPreset,
}: PresetsModalProps) {
  const [presets, setPresets] = useState<RulePreset[]>(() => getSavedPresets());
  const [isCreating, setIsCreating] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');

  if (!isOpen) return null;

  const refreshPresets = () => {
    setPresets(getSavedPresets());
  };

  const handleCreatePreset = () => {
    if (!newPresetName.trim()) return;

    // Map active column rules into match rules
    const columnRulesMatch = columns
      .filter((c) => c.rules.some((r) => r.enabled))
      .map((c) => ({
        columnNameMatch: c.originalHeader || c.customHeader,
        customHeader: c.customHeader,
        rules: c.rules.filter((r) => r.enabled),
      }));

    if (columnRulesMatch.length === 0) {
      alert('Adicione pelo menos uma regra ativa às colunas antes de salvar um preset.');
      return;
    }

    saveUserPreset({
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || 'Preset personalizado criado pelo usuário',
      columnRulesMatch,
    });

    setNewPresetName('');
    setNewPresetDesc('');
    setIsCreating(false);
    refreshPresets();
  };

  const handleDeletePreset = (id: string) => {
    deleteUserPreset(id);
    refreshPresets();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col text-slate-800 max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Presets de Regras Salvas</h3>
              <p className="text-[11px] text-slate-500">
                Reutilize conjuntos de regras frequentes com 1 clique
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Create New Preset Section */}
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-2.5 px-3 border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 rounded-lg text-blue-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Salvar Regras Atuais da Planilha como Novo Preset</span>
            </button>
          ) : (
            <div className="p-3.5 border border-blue-200 bg-blue-50/40 rounded-lg space-y-2 text-xs">
              <span className="font-bold text-blue-900 block">Novo Preset Personalizado</span>
              <input
                type="text"
                placeholder="Nome do Preset (ex: Modelo Folha Pagamento RH)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Descrição opcional..."
                value={newPresetDesc}
                onChange={(e) => setNewPresetDesc(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreatePreset}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-2xs"
                >
                  Salvar Preset
                </button>
              </div>
            </div>
          )}

          {/* Preset Cards List */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-700 block">
              Presets Disponíveis ({presets.length})
            </span>

            {presets.map((preset) => {
              const isCustom = preset.id.startsWith('preset_custom_');
              return (
                <div
                  key={preset.id}
                  className="p-3.5 rounded-lg border border-slate-200 hover:border-blue-300 bg-white hover:bg-slate-50/50 transition-all flex items-center justify-between text-xs"
                >
                  <div className="space-y-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-xs">{preset.name}</span>
                      {!isCustom ? (
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">
                          Padrão
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-medium">
                          Meu Preset
                        </span>
                      )}
                    </div>
                    {preset.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {preset.description}
                      </p>
                    )}
                    <div className="text-[10px] text-slate-400 font-medium">
                      Mapeia {preset.columnRulesMatch.length} tipos de coluna
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isCustom && (
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onApplyPreset(preset);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <FolderDown className="w-3.5 h-3.5" />
                      <span>Aplicar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-lg text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
