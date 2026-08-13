'use client';

import React, { useState } from 'react';
import { UserProfile, UserRole, UserPermission } from '@/types/audit';
import {
  getAllUsers,
  getCurrentUser,
  setCurrentUser,
  saveUser,
  hasPermission,
} from '@/lib/auth-service';
import { logAuditAction } from '@/lib/audit-service';
import {
  Users,
  X,
  CheckCircle2,
  UserPlus,
  ShieldCheck,
  Building2,
  Mail,
  User,
  Check,
  ShieldAlert,
} from 'lucide-react';

interface UserSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChanged: (user: UserProfile) => void;
}

const ALL_PERMISSIONS: { id: UserPermission; label: string; description: string }[] = [
  {
    id: 'visualizar_historico',
    label: 'Visualizar Histórico e Trilha',
    description: 'Permite consultar a aba de auditoria e históricos de lançamentos',
  },
  {
    id: 'visualizar_lancamentos_outros',
    label: 'Visualizar Lançamentos de Outros Usuários',
    description: 'Acesso total aos registros criados por qualquer operador',
  },
  {
    id: 'criar_lancamentos',
    label: 'Criar Novos Lançamentos',
    description: 'Adicionar novos registros nas abas DEALER, SiTef e Fechamento',
  },
  {
    id: 'alterar_lancamentos',
    label: 'Alterar e Editar Lançamentos',
    description: 'Modificar valores e dados de lançamentos existentes',
  },
  {
    id: 'excluir_lancamentos',
    label: 'Excluir Lançamentos',
    description: 'Remover registros e movimentações do sistema',
  },
  {
    id: 'fechar_lote',
    label: 'Realizar Fechamento de Caixa / Lote',
    description: 'Concluir conciliações diárias e emitir comprovantes oficiais',
  },
  {
    id: 'reabrir_fechamento',
    label: 'Reabrir Fechamento Concluído',
    description: 'Reabrir fechamentos anteriores para ajustes (requer justificativa)',
  },
  {
    id: 'visualizar_auditoria_completa',
    label: 'Visualizar Painel de Auditoria Completo',
    description: 'Acesso ao Dashboard de Atividades e relatórios estratégicos',
  },
  {
    id: 'administrar_usuarios',
    label: 'Administrar Usuários e Permissões',
    description: 'Cadastrar novos operadores e definir perfis de acesso',
  },
];

export function UserSelectorModal({ isOpen, onClose, onUserChanged }: UserSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<'switch' | 'create'>('switch');
  const [users, setUsers] = useState<UserProfile[]>(() => getAllUsers());
  const [selectedUser, setSelectedUser] = useState<UserProfile>(() => getCurrentUser());

  // Form State for new User
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('operador');
  const [newUserEmpresa, setNewUserEmpresa] = useState('BYD - ARRUDA');
  const [newUserPermissions, setNewUserPermissions] = useState<UserPermission[]>([
    'visualizar_historico',
    'visualizar_lancamentos_outros',
    'criar_lancamentos',
    'alterar_lancamentos',
  ]);

  if (!isOpen) return null;

  const handleSelectUser = (user: UserProfile) => {
    const previousUser = selectedUser;
    setCurrentUser(user);
    setSelectedUser(user);
    onUserChanged(user);

    // Registra auditoria do Login/Troca de perfil
    logAuditAction({
      operacao: 'LOGIN',
      descricao: `Sessão alterada para o usuário ${user.name} (${user.role.toUpperCase()})`,
      empresa: user.empresa,
      situacao_anterior: previousUser.name,
      situacao_nova: user.name,
    });

    onClose();
  };

  const togglePermission = (perm: UserPermission) => {
    if (newUserPermissions.includes(perm)) {
      setNewUserPermissions(newUserPermissions.filter((p) => p !== perm));
    } else {
      setNewUserPermissions([...newUserPermissions, perm]);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    const created: UserProfile = {
      id: 'usr_' + Date.now(),
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      empresa: newUserEmpresa,
      permissions: newUserPermissions,
      created_at: new Date().toISOString(),
    };

    const updated = saveUser(created);
    setUsers(updated);

    // Registra auditoria
    logAuditAction({
      operacao: 'CADASTRO_USUARIO',
      descricao: `Novo usuário cadastrado: ${created.name} (${created.role.toUpperCase()})`,
      empresa: created.empresa,
      registro: created.id,
      situacao_nova: created.role.toUpperCase(),
    });

    // Reset form
    setNewUserName('');
    setNewUserEmail('');
    setActiveTab('switch');
  };

  const canAdminUsers = hasPermission('administrar_usuarios', selectedUser);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white">
                Controle de Usuários e Permissões
              </h3>
              <p className="text-xs text-slate-400">
                Selecione seu perfil ativo ou cadastre novos operadores com regras RLS
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

        {/* Navigation Tabs in Modal */}
        <div className="px-6 pt-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('switch')}
              className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t border-x ${
                activeTab === 'switch'
                  ? 'bg-white text-slate-900 border-slate-200 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <User className="w-4 h-4 text-emerald-600" />
              <span>Alternar Usuário Ativo ({users.length})</span>
            </button>

            {canAdminUsers && (
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 font-bold text-xs rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t border-x ${
                  activeTab === 'create'
                    ? 'bg-white text-slate-900 border-slate-200 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 border-transparent'
                }`}
              >
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>+ Cadastrar Novo Usuário</span>
              </button>
            )}
          </div>

          <span className="text-[11px] font-bold text-slate-500 bg-slate-200/80 px-2.5 py-1 rounded-full uppercase">
            Usuário Atual: <strong className="text-slate-900">{selectedUser.name}</strong>
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'switch' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Selecione o operador abaixo para simular ações no sistema. Todas as movimentações, fechamentos e auditorias ficarão associadas ao perfil escolhido:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {users.map((u) => {
                  const isSelected = u.id === selectedUser.id;
                  const roleBadgeColor =
                    u.role === 'admin'
                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                      : u.role === 'gerente'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : u.role === 'auditor'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300';

                  return (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                        isSelected
                          ? 'bg-emerald-50/60 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border ${roleBadgeColor}`}
                        >
                          {u.role}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 border-t border-slate-100 pt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 font-semibold truncate max-w-[160px]">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{u.empresa || 'Matriz'}</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {u.permissions?.length || 0} Permissões
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Nome Completo</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Ex: Ana Paula Ferreira"
                    className="w-full px-3.5 py-2 text-sm font-semibold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    <span>E-mail Corporativo</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="ana.ferreira@trataexcel.com.br"
                    className="w-full px-3.5 py-2 text-sm font-semibold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Perfil / Cargo</span>
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 text-sm font-bold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="operador">OPERADOR (Operações de rotina)</option>
                    <option value="gerente">GERENTE (Supervisão & Fechamento)</option>
                    <option value="auditor">AUDITOR (Somente Leitura e Relatórios)</option>
                    <option value="admin">ADMINISTRADOR (Acesso Total)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Empresa de Origem</span>
                  </label>
                  <input
                    type="text"
                    value={newUserEmpresa}
                    onChange={(e) => setNewUserEmpresa(e.target.value)}
                    placeholder="Ex: BYD - ARRUDA"
                    className="w-full px-3.5 py-2 text-sm font-semibold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Specific Permissions Grid */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">
                  Permissões Personalizadas no Sistema
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {ALL_PERMISSIONS.map((p) => {
                    const isChecked = newUserPermissions.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(p.id)}
                          className="mt-0.5 rounded text-indigo-600 bg-white border-slate-300"
                        />
                        <div>
                          <div className="text-xs">{p.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{p.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('switch')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Cadastrar Usuário</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>As permissões do Supabase regem os acessos com RLS em tempo real</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
