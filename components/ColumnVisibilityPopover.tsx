'use client';

import React, { useState } from 'react';
import { ColumnConfig } from '@/types/spreadsheet';
import { Eye, EyeOff, CheckSquare, Square, Search } from 'lucide-react';

interface ColumnVisibilityPopoverProps {
  columns: ColumnConfig[];
  onToggleVisibility: (columnId: string) => void;
  onSetAllVisibility: (visible: boolean) => void;
}

export function ColumnVisibilityPopover({
  columns,
  onToggleVisibility,
  onSetAllVisibility,
}: ColumnVisibilityPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const hiddenCount = columns.filter((c) => !c.visible).length;
  const filteredCols = columns.filter((c) =>
    (c.customHeader || c.originalHeader).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-xs"
        title="Gerenciar colunas visíveis"
      >
        <Eye className="w-3.5 h-3.5 text-slate-500" />
        <span>Colunas</span>
        {hiddenCount > 0 && (
          <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
            {hiddenCount} oculta{hiddenCount > 1 ? 's' : ''}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-md shadow-lg z-30 p-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <span className="font-semibold text-slate-800">Visibilidade de Colunas</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onSetAllVisibility(true)}
                  className="text-[11px] text-blue-600 hover:underline font-medium"
                >
                  Todas
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => onSetAllVisibility(false)}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Ocultar Todas
                </button>
              </div>
            </div>

            <div className="relative mb-2">
              <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar coluna..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredCols.map((col) => (
                <button
                  key={col.id}
                  onClick={() => onToggleVisibility(col.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-50 text-left transition-colors text-slate-700"
                >
                  <span className="truncate pr-2 font-medium">
                    {col.customHeader || col.originalHeader}
                  </span>
                  {col.visible ? (
                    <Eye className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
              ))}
              {filteredCols.length === 0 && (
                <div className="p-2 text-center text-slate-400 italic text-[11px]">
                  Nenhuma coluna encontrada
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
