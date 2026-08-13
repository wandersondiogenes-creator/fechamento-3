import { RulePreset } from '@/types/spreadsheet';

const PRESETS_STORAGE_KEY = 'trataexcel_rule_presets_v1';

export const DEFAULT_PRESETS: RulePreset[] = [
  {
    id: 'preset_dealer',
    name: 'Modelo DEALER',
    description: 'Aplica automaticamente exclusão de colunas indesejadas (Conta Classificação, Dias, Parc., Histórico, Dep., Dat Acon), remoção de registros sem data/entrada e formatação BRL (R$) para Entrada e Saída',
    createdAt: '2026-01-01T00:00:00.000Z',
    columnRulesMatch: [
      {
        columnNameMatch: 'entrada|saida|saída|valor|montante|saldo',
        rules: [
          { id: 'rd1', type: 'format_currency_brl', enabled: true },
        ],
      },
      {
        columnNameMatch: 'data|dt_|emissao|vencimento',
        rules: [
          {
            id: 'rd2',
            type: 'convert_date',
            enabled: true,
            dateFormatConfig: { targetFormat: 'DD/MM/YYYY' },
          },
        ],
      },
      {
        columnNameMatch: 'entrada',
        rules: [
          { id: 'rd3', type: 'remove_null_rows', enabled: true },
        ],
      },
    ],
  },
];

export function getSavedPresets(): RulePreset[] {
  if (typeof window === 'undefined') return DEFAULT_PRESETS;
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRESETS;
    const custom: RulePreset[] = JSON.parse(raw);
    return [...DEFAULT_PRESETS, ...custom];
  } catch (e) {
    console.error('Error loading presets', e);
    return DEFAULT_PRESETS;
  }
}

export function saveUserPreset(preset: Omit<RulePreset, 'id' | 'createdAt'>): RulePreset {
  const newPreset: RulePreset = {
    ...preset,
    id: `preset_custom_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    const current = getSavedPresets().filter(p => p.id.startsWith('preset_custom_'));
    const updated = [...current, newPreset];
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
  }

  return newPreset;
}

export function deleteUserPreset(presetId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedPresets().filter(p => p.id.startsWith('preset_custom_') && p.id !== presetId);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Error deleting preset', e);
  }
}
