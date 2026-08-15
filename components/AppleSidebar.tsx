'use client';

import React, { useState } from 'react';
import { WanfinanceLogo } from './WanfinanceLogo';
import { UserProfile } from '@/types/audit';
import {
  FileText,
  FileSpreadsheet,
  PlusCircle,
  FolderOpen,
  Layers,
  Clock,
  Scale,
  ShieldCheck,
  Table,
  Sparkles,
  LogOut,
  Upload,
  Bookmark,
  Building2,
  Wallet,
  Settings,
  CreditCard,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

interface AppleSidebarProps {
  activeTab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento' | 'auditoria';
  onTabChange: (tab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento' | 'auditoria') => void;
  tabCounts: {
    dealer: number;
    sitef: number;
    pendente_cdc: number;
    fechamento?: number;
    auditoria?: number;
  };
  currentUser: UserProfile;
  onOpenUserModal: () => void;
  onOpenAIDrawer: () => void;
  onTriggerFileImport: () => void;
  onOpenPresetsModal: () => void;
  isOpen: boolean;
  onToggleSidebar?: () => void;
}

export function AppleSidebar({
  activeTab,
  onTabChange,
  tabCounts,
  currentUser,
  onOpenUserModal,
  onOpenAIDrawer,
  onTriggerFileImport,
  onOpenPresetsModal,
  isOpen,
}: AppleSidebarProps) {
  if (!isOpen) return null;

  return (
    <aside
      id="apple-macos-sidebar"
      className="w-72 bg-[#F8F9FD] border-r border-slate-200/90 flex flex-col justify-between h-screen sticky top-0 z-30 select-none shadow-[2px_0_12px_rgba(0,0,0,0.02)] flex-shrink-0 transition-all font-sans"
    >
      {/* Top Header: Traffic Lights & Wanfinance Pro Logo */}
      <div className="p-4 border-b border-slate-200/70">
        <WanfinanceLogo size="md" showTrafficLights={true} showSubtitle={true} theme="light" />
      </div>

      {/* Action CTA Button: Extrair PDF por IA (matching the blue pill in screenshot) */}
      <div className="px-4 pt-3.5 pb-2">
        <button
          onClick={onOpenAIDrawer}
          id="sidebar-btn-ai-extract"
          className="w-full py-2.5 px-4 bg-gradient-to-r from-[#0066FF] to-[#0080FF] hover:from-[#0055EE] hover:to-[#0070EE] active:scale-[0.98] text-white font-semibold rounded-2xl shadow-md shadow-blue-500/25 border border-blue-400/30 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-blue-100 animate-pulse" />
          <span>Extrair PDF por IA</span>
        </button>
      </div>

      {/* Navigation Menu Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
        {/* GROUP 1: PRINCIPAL */}
        <div>
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Principal
          </div>
          <div className="mt-1 space-y-0.5">
            {/* Boletos a Pagar / DEALER */}
            <button
              onClick={() => onTabChange('dealer')}
              id="sidebar-tab-dealer"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'dealer'
                  ? 'bg-[#007AFF] text-white shadow-sm shadow-blue-500/20 font-bold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText
                  className={`w-4 h-4 ${
                    activeTab === 'dealer' ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span>Boletos a Pagar (DEALER)</span>
              </div>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'dealer'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {tabCounts.dealer}
              </span>
            </button>

            {/* Inserir / Importar Planilha */}
            <button
              onClick={onTriggerFileImport}
              id="sidebar-btn-import-sheet"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-slate-400" />
              <span>Inserir / Importar</span>
            </button>
          </div>
        </div>

        {/* GROUP 2: FINANCEIRO & REMESSAS (CONCILIAÇÃO) */}
        <div>
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Financeiro & Remessas
          </div>
          <div className="mt-1 space-y-0.5">
            {/* SITEF / Extrato & DDA */}
            <button
              onClick={() => onTabChange('sitef')}
              id="sidebar-tab-sitef"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'sitef'
                  ? 'bg-[#007AFF] text-white shadow-sm shadow-blue-500/20 font-bold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers
                  className={`w-4 h-4 ${
                    activeTab === 'sitef' ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span>Extrato & DDA (SITEF)</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    activeTab === 'sitef'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  OFX/PDF
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === 'sitef'
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tabCounts.sitef}
                </span>
              </div>
            </button>

            {/* PENDENTE DE CDC */}
            <button
              onClick={() => onTabChange('pendente_cdc')}
              id="sidebar-tab-pendente"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'pendente_cdc'
                  ? 'bg-[#007AFF] text-white shadow-sm shadow-blue-500/20 font-bold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock
                  className={`w-4 h-4 ${
                    activeTab === 'pendente_cdc' ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span>Pendentes de CDC</span>
              </div>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'pendente_cdc'
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {tabCounts.pendente_cdc}
              </span>
            </button>

            {/* FECHAMENTO DE CONCILIAÇÃO */}
            <button
              onClick={() => onTabChange('fechamento')}
              id="sidebar-tab-fechamento"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'fechamento'
                  ? 'bg-[#007AFF] text-white shadow-sm shadow-blue-500/20 font-bold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Scale
                  className={`w-4 h-4 ${
                    activeTab === 'fechamento' ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span>Fechamento de Caixa</span>
              </div>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'fechamento'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {tabCounts.fechamento ?? 0}
              </span>
            </button>
          </div>
        </div>

        {/* GROUP 3: FERRAMENTAS & INTEGRAÇÕES */}
        <div>
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Ferramentas & Integrações
          </div>
          <div className="mt-1 space-y-0.5">
            {/* AUDITORIA SUPABASE */}
            <button
              onClick={() => onTabChange('auditoria')}
              id="sidebar-tab-auditoria"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'auditoria'
                  ? 'bg-[#007AFF] text-white shadow-sm shadow-blue-500/20 font-bold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    activeTab === 'auditoria' ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span>Auditoria Supabase</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981] animate-pulse" />
            </button>

            {/* Regras Prontas (Presets) */}
            <button
              onClick={onOpenPresetsModal}
              id="sidebar-btn-presets"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-all cursor-pointer"
            >
              <Bookmark className="w-4 h-4 text-slate-400" />
              <span>Regras Prontas (Presets)</span>
            </button>
          </div>
        </div>
      </div>

      {/* User Profile Card at the Bottom (Matching screenshot: wandersondiogenes / Administrador) */}
      <div className="p-3 border-t border-slate-200/80 bg-[#FFFFFF]">
        <div
          onClick={onOpenUserModal}
          id="sidebar-user-card"
          className="flex items-center justify-between p-2 rounded-2xl bg-[#F8F9FD] border border-slate-200/80 hover:bg-slate-100 transition-all cursor-pointer group shadow-2xs"
          title="Clique para gerenciar permissões ou trocar operador"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            {/* Squircle Avatar with 'W' */}
            <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] text-white font-black text-xs flex items-center justify-center shadow-xs border border-white/40 flex-shrink-0">
              {currentUser.avatar_initials || 'W'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-slate-800 leading-tight truncate">
                {currentUser.name || 'wandersondiogenes'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium truncate">
                {currentUser.role === 'admin'
                  ? 'Administrador (Supabase Auth)'
                  : currentUser.role === 'auditor'
                  ? 'Auditor Financeiro'
                  : 'Operador / Caixa'}
              </span>
            </div>
          </div>

          {/* Switch icon */}
          <div className="p-1.5 text-slate-400 group-hover:text-slate-700 transition-colors flex-shrink-0">
            <LogOut className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </aside>
  );
}
