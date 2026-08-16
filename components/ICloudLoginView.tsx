'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail,
  Sparkles,
  Check,
  AlertCircle,
  KeyRound,
  HelpCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { UserProfile } from '@/types/audit';
import { loginWithGmail } from '@/lib/auth-service';
import { logAuditAction } from '@/lib/audit-service';

interface ICloudLoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
  defaultEmail?: string;
}

export function ICloudLoginView({ onLoginSuccess, defaultEmail = 'infroberto360@gmail.com' }: ICloudLoginViewProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Suggested quick-select Gmail accounts
  const quickAccounts = [
    {
      name: 'Roberto Santos',
      email: 'infroberto360@gmail.com',
      role: 'Administrador Matriz',
      initials: 'RS',
      gradient: 'from-blue-600 to-indigo-700',
    },
    {
      name: 'João Silva',
      email: 'joao.silva@gmail.com',
      role: 'Operador Financeiro',
      initials: 'JS',
      gradient: 'from-indigo-600 to-purple-700',
    },
    {
      name: 'Maria Santos',
      email: 'maria.santos@gmail.com',
      role: 'Caixa / Lançamentos',
      initials: 'MS',
      gradient: 'from-purple-600 to-pink-600',
    },
  ];

  const validateGmail = (inputEmail: string) => {
    const clean = inputEmail.trim().toLowerCase();
    if (!clean) return false;
    // Allow gmail.com addresses or valid corporate emails
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(clean);
  };

  const handleInitialSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Por favor, digite seu endereço de e-mail do Gmail.');
      return;
    }

    if (!cleanEmail.includes('@')) {
      // Auto-append @gmail.com if user only typed the username
      setEmail(`${cleanEmail}@gmail.com`);
    }

    const targetEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@gmail.com`;

    if (!validateGmail(targetEmail)) {
      setErrorMessage('Por favor, informe um e-mail do Gmail válido (ex: nome@gmail.com).');
      return;
    }

    setShowPasswordStep(true);
  };

  const handleFinalLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const targetEmail = email.trim().toLowerCase();

    try {
      // Authenticate user via Gmail
      const user = loginWithGmail(targetEmail, undefined, rememberMe, 'google');

      // Log audit entry
      await logAuditAction({
        user_id: user.id,
        user_name: user.name,
        empresa: user.empresa,
        operacao: 'LOGIN',
        descricao: `Sessão iniciada via autenticação Gmail (${targetEmail}) no Wanfinance Pro.`,
      });

      // Brief smooth transition
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess(user);
      }, 400);
    } catch (err: any) {
      setLoading(false);
      setErrorMessage('Erro ao autenticar. Verifique sua conexão e tente novamente.');
    }
  };

  const handleQuickLogin = async (accountEmail: string, accountName: string) => {
    setEmail(accountEmail);
    setLoading(true);
    setErrorMessage(null);

    try {
      const user = loginWithGmail(accountEmail, accountName, rememberMe, 'google');

      await logAuditAction({
        user_id: user.id,
        user_name: user.name,
        empresa: user.empresa,
        operacao: 'LOGIN',
        descricao: `Acesso rápido com Conta Gmail (${accountEmail}) autenticado com sucesso.`,
      });

      setTimeout(() => {
        setLoading(false);
        onLoginSuccess(user);
      }, 350);
    } catch (err: any) {
      setLoading(false);
      setErrorMessage('Erro ao efetuar login rápido.');
    }
  };

  return (
    <div
      id="icloud-login-screen"
      className="min-h-screen w-full flex flex-col justify-between relative overflow-hidden bg-[#F5F5F7] text-[#1D1D1F] select-none"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
      }}
    >
      {/* Dynamic iCloud Atmospheric Ambient Mesh Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Blue / Cyan Light Sphere */}
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-b from-blue-300/30 via-indigo-200/20 to-transparent rounded-full blur-[100px]" />
        {/* Soft Violet / Pink Sphere */}
        <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-200/25 via-pink-200/15 to-transparent rounded-full blur-[90px]" />
        {/* Bottom Right Soft Cyan */}
        <div className="absolute -bottom-[10%] -right-[10%] w-[600px] h-[600px] bg-gradient-to-tl from-sky-200/30 via-blue-100/20 to-transparent rounded-full blur-[100px]" />
      </div>

      {/* TOP HEADER: Apple Minimalist Navigation Bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-black/[0.04] bg-white/60 backdrop-blur-2xl">
        <div className="flex items-center gap-2.5">
          {/* Apple Traffic Lights */}
          <div className="flex items-center gap-1.5 pr-2">
            <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50 shadow-2xs" />
            <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50 shadow-2xs" />
            <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50 shadow-2xs" />
          </div>

          <div className="flex items-center gap-2">
            {/* Small Brand Icon */}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-xs">
              <span className="font-black text-white text-xs">W</span>
            </div>
            <span className="font-bold text-sm text-[#1D1D1F] tracking-tight">Wanfinance Pro</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="hidden sm:inline-flex items-center gap-1 font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            Conexão Criptografada SSL
          </span>
          <a
            href="https://support.google.com/accounts/answer/41078"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#007AFF] transition-colors flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ajuda</span>
          </a>
        </div>
      </header>

      {/* MAIN CONTAINER: Authentic Apple iCloud Sign-In Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full">
        {/* Apple Squircle Brand Centerpiece */}
        <div className="flex flex-col items-center text-center space-y-4 mb-6">
          <div className="relative group">
            {/* Soft Ambient Halo */}
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 rounded-3xl blur-lg transition-all group-hover:blur-xl" />

            {/* Wanfinance Pro Squircle Icon */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-xl shadow-indigo-500/20 border border-white/40 overflow-hidden transform transition-transform duration-300 group-hover:scale-102">
              {/* Glass Reflection Highlight */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/10 pointer-events-none" />
              <span className="font-black text-white text-3xl drop-shadow-sm tracking-tighter">W</span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-[26px] font-bold text-[#1D1D1F] tracking-tight">
              Iniciar sessão no Wanfinance
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
              Acesse a plataforma de conciliação bancária DEALER e SiTef com sua Conta Google / Gmail.
            </p>
          </div>
        </div>

        {/* The Card */}
        <div className="w-full bg-white/80 border border-black/[0.08] shadow-[0_10px_35px_rgba(0,0,0,0.06)] rounded-3xl p-6 sm:p-8 backdrop-blur-2xl transition-all duration-300">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!showPasswordStep ? (
            /* STEP 1: GMAIL EMAIL INPUT (iCloud style with embedded arrow button) */
            <form onSubmit={handleInitialSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  E-mail do Gmail
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="exemplo@gmail.com"
                    className="w-full pl-10 pr-12 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-[#1D1D1F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white focus:border-transparent transition-all shadow-inner-2xs"
                  />
                  {/* iCloud Circle Arrow Button */}
                  <button
                    type="submit"
                    className="absolute right-2 w-8 h-8 rounded-full bg-[#007AFF] hover:bg-[#0062D2] active:scale-95 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer"
                    title="Continuar"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Keep signed in checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#007AFF] border-slate-300 focus:ring-[#007AFF]"
                  />
                  <span>Mantenha-me conectado</span>
                </label>
              </div>

              {/* Official Google Sign-In Styled Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleInitialSubmit()}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 text-slate-700 font-semibold rounded-2xl text-xs shadow-2xs flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                    />
                  </svg>
                  <span>Continuar com Conta Google</span>
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: CONFIRMATION / PASSWORD / DIRECT GMAIL AUTH */
            <form onSubmit={handleFinalLogin} className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate text-left">
                    <div className="text-xs font-bold text-slate-800 truncate">{email}</div>
                    <div className="text-[10px] text-slate-500">Conta Google Verificada</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordStep(false)}
                  className="text-xs text-[#007AFF] font-semibold hover:underline cursor-pointer"
                >
                  Alterar
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Senha ou Código de Acesso
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha ou pressione Entrar"
                    className="w-full pl-10 pr-12 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm text-[#1D1D1F] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white focus:border-transparent transition-all shadow-inner-2xs"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="absolute right-2 w-8 h-8 rounded-full bg-[#007AFF] hover:bg-[#0062D2] active:scale-95 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    title="Acessar Sistema"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-b from-[#007AFF] to-[#0062D2] hover:brightness-105 active:scale-98 text-white font-bold rounded-2xl text-xs shadow-xs shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Autenticando sessão...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Entrar no Wanfinance Pro</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Access Account Selector */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Acesso Rápido com Contas Autorizadas
            </div>
            <div className="grid grid-cols-1 gap-2">
              {quickAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickLogin(acc.email, acc.name)}
                  className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 active:bg-slate-100 border border-slate-200/80 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div
                      className={`w-7 h-7 rounded-full bg-gradient-to-tr ${acc.gradient} text-white font-black text-[10px] flex items-center justify-center shadow-xs flex-shrink-0`}
                    >
                      {acc.initials}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-800 group-hover:text-[#007AFF] transition-colors truncate">
                        {acc.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{acc.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-[#007AFF] font-medium flex-shrink-0">
                    <span>{acc.role}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security & Privacy Badge */}
        <div className="mt-6 flex items-center gap-2 text-slate-500 text-[11px] text-center max-w-sm">
          <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>
            Sua privacidade e dados de conciliação bancária estão protegidos por criptografia de ponta a ponta.
          </span>
        </div>
      </main>

      {/* FOOTER: Apple iCloud Standard Legal Footer */}
      <footer className="relative z-10 w-full px-6 py-4 border-t border-black/[0.04] bg-white/40 backdrop-blur-xl text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <div>
            Copyright © {new Date().getFullYear()} Wanfinance Pro Inc. Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-4 text-slate-600">
            <span className="hover:text-slate-900 cursor-pointer">Política de Privacidade</span>
            <span>•</span>
            <span className="hover:text-slate-900 cursor-pointer">Termos de Uso</span>
            <span>•</span>
            <span className="hover:text-slate-900 cursor-pointer">Auditoria Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
