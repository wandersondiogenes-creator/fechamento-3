import { UserProfile, UserPermission } from '@/types/audit';

export const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'usr_admin_1',
    name: 'João Silva',
    email: 'joao.silva@trataexcel.com.br',
    role: 'admin',
    empresa: 'BYD - ARRUDA',
    permissions: [
      'visualizar_historico',
      'visualizar_lancamentos_outros',
      'criar_lancamentos',
      'alterar_lancamentos',
      'excluir_lancamentos',
      'fechar_lote',
      'reabrir_fechamento',
      'visualizar_auditoria_completa',
      'administrar_usuarios',
    ],
  },
  {
    id: 'usr_operador_1',
    name: 'Maria Santos',
    email: 'maria.santos@trataexcel.com.br',
    role: 'operador',
    empresa: 'RENAULT EPITACIO PESSOA',
    permissions: [
      'visualizar_historico',
      'visualizar_lancamentos_outros',
      'criar_lancamentos',
      'alterar_lancamentos',
    ],
  },
  {
    id: 'usr_gerente_1',
    name: 'Carlos Oliveira',
    email: 'carlos.oliveira@trataexcel.com.br',
    role: 'gerente',
    empresa: 'GEELY MADALENA',
    permissions: [
      'visualizar_historico',
      'visualizar_lancamentos_outros',
      'criar_lancamentos',
      'alterar_lancamentos',
      'excluir_lancamentos',
      'fechar_lote',
      'reabrir_fechamento',
      'visualizar_auditoria_completa',
    ],
  },
  {
    id: 'usr_auditor_1',
    name: 'Roberto Santos',
    email: 'roberto.auditoria@trataexcel.com.br',
    role: 'auditor',
    empresa: 'VIA SUL MATRIZ',
    permissions: [
      'visualizar_historico',
      'visualizar_lancamentos_outros',
      'visualizar_auditoria_completa',
    ],
  },
];

const CURRENT_USER_STORAGE_KEY = 'trataexcel_active_user_v1';
const ALL_USERS_STORAGE_KEY = 'trataexcel_all_users_v1';
export const AUTH_SESSION_KEY = 'wanfinance_gmail_session_v1';

export interface AuthSession {
  user: UserProfile;
  loginAt: string;
  rememberMe: boolean;
  authProvider: 'google' | 'gmail_direct';
}

export function isUserLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return false;
    const session: AuthSession = JSON.parse(raw);
    return Boolean(session && session.user && session.user.email);
  } catch (err) {
    console.error('Erro ao verificar sessão:', err);
    return false;
  }
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function loginWithGmail(
  email: string,
  name?: string,
  rememberMe: boolean = true,
  provider: 'google' | 'gmail_direct' = 'google'
): UserProfile {
  const cleanEmail = email.trim().toLowerCase();
  
  // Format default display name from email if not provided
  let displayName = name?.trim();
  if (!displayName) {
    const namePart = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
    displayName = namePart
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // Check if this user already exists in all users list
  const users = getAllUsers();
  let existingUser = users.find((u) => u.email.toLowerCase() === cleanEmail);

  let userProfile: UserProfile;
  if (existingUser) {
    userProfile = {
      ...existingUser,
      name: displayName || existingUser.name,
    };
  } else {
    // Determine default role: admin for the primary authorized user or admin patterns
    const isAdmin = cleanEmail.includes('admin') || cleanEmail.includes('infroberto') || cleanEmail.includes('roberto');
    userProfile = {
      id: `usr_${Date.now()}`,
      name: displayName || 'Operador Financeiro',
      email: cleanEmail,
      role: isAdmin ? 'admin' : 'operador',
      empresa: 'VIA SUL MATRIZ',
      permissions: isAdmin
        ? [
            'visualizar_historico',
            'visualizar_lancamentos_outros',
            'criar_lancamentos',
            'alterar_lancamentos',
            'excluir_lancamentos',
            'fechar_lote',
            'reabrir_fechamento',
            'visualizar_auditoria_completa',
            'administrar_usuarios',
          ]
        : [
            'visualizar_historico',
            'visualizar_lancamentos_outros',
            'criar_lancamentos',
            'alterar_lancamentos',
          ],
    };
    saveUser(userProfile);
  }

  setCurrentUser(userProfile);

  const sessionData: AuthSession = {
    user: userProfile,
    loginAt: new Date().toISOString(),
    rememberMe,
    authProvider: provider,
  };

  if (typeof window !== 'undefined') {
    if (rememberMe) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
    } else {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  }

  return userProfile;
}

export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch (err) {
    console.error('Erro ao encerrar sessão:', err);
  }
}

export function getAllUsers(): UserProfile[] {
  if (typeof window === 'undefined') return DEFAULT_USERS;
  try {
    const raw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USERS;
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    return DEFAULT_USERS;
  }
}

export function getCurrentUser(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_USERS[0];
  try {
    // First priority: get user from active auth session
    const session = getAuthSession();
    if (session && session.user && session.user.id) {
      return session.user;
    }

    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id) return user;
    }
  } catch (err) {
    console.error('Erro ao ler usuário ativo:', err);
  }
  return DEFAULT_USERS[0];
}

export function setCurrentUser(user: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Erro ao salvar usuário ativo:', err);
  }
}

export function saveUser(user: UserProfile): UserProfile[] {
  const users = getAllUsers();
  const existingIdx = users.findIndex((u) => u.id === user.id);
  let updated: UserProfile[];
  if (existingIdx >= 0) {
    updated = [...users];
    updated[existingIdx] = user;
  } else {
    updated = [...users, user];
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function deleteUser(userId: string): UserProfile[] {
  const users = getAllUsers().filter((u) => u.id !== userId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(users));
  }
  return users;
}

export function hasPermission(permission: UserPermission, user?: UserProfile): boolean {
  const u = user || getCurrentUser();
  if (!u) return false;
  if (u.role === 'admin') return true;
  return u.permissions ? u.permissions.includes(permission) : false;
}
