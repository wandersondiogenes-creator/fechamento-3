-- SQL SCRIPT DE INICIALIZAÇÃO DO BANCO DE DADOS SUPABASE PARA O TRATAEXCEL PRO
-- Este script cria todas as tabelas, índices e políticas de segurança RLS (Row Level Security)

-- 1. Tabela de Auditoria Imutável (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    empresa TEXT,
    banco TEXT,
    operacao TEXT NOT NULL,
    descricao TEXT NOT NULL,
    registro TEXT,
    valor NUMERIC(15, 2),
    situacao_anterior TEXT,
    situacao_nova TEXT,
    lote_id TEXT,
    meta_data JSONB
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_empresa ON public.audit_logs(empresa);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operacao ON public.audit_logs(operacao);
CREATE INDEX IF NOT EXISTS idx_audit_logs_registro ON public.audit_logs(registro);
CREATE INDEX IF NOT EXISTS idx_audit_logs_lote_id ON public.audit_logs(lote_id);

-- 2. Tabela de Lançamentos Sincronizados (lancamentos)
CREATE TABLE IF NOT EXISTS public.lancamentos (
    id TEXT PRIMARY KEY,
    tab TEXT NOT NULL, -- 'dealer' | 'sitef' | 'pendente_cdc'
    empresa TEXT NOT NULL,
    departamento TEXT,
    conta_gerencial TEXT,
    nsu TEXT,
    data TEXT,
    valor NUMERIC(15, 2),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_tab ON public.lancamentos(tab);
CREATE INDEX IF NOT EXISTS idx_lancamentos_empresa ON public.lancamentos(empresa);
CREATE INDEX IF NOT EXISTS idx_lancamentos_nsu ON public.lancamentos(nsu);

-- 3. Tabela de Fechamentos de Caixa e Lotes (fechamentos)
CREATE TABLE IF NOT EXISTS public.fechamentos (
    id TEXT PRIMARY KEY,
    data_movimento TEXT NOT NULL,
    data_fechamento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operador TEXT NOT NULL,
    user_id TEXT,
    status TEXT NOT NULL,
    total_dealer NUMERIC(15, 2),
    total_sitef NUMERIC(15, 2),
    diferenca_total NUMERIC(15, 2),
    count_total INTEGER,
    count_empresas INTEGER,
    empresas_nomes JSONB,
    breakdown_por_bandeira JSONB,
    items JSONB,
    reaberto_por TEXT,
    reaberto_em TIMESTAMPTZ,
    motivo_reabertura TEXT
);

CREATE INDEX IF NOT EXISTS idx_fechamentos_data_movimento ON public.fechamentos(data_movimento);

-- 4. Tabela de Perfis e Permissões de Usuários (users_profiles)
CREATE TABLE IF NOT EXISTS public.users_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'operador',
    empresa TEXT,
    permissions JSONB,
    avatar TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Habilitar RLS e Permissões Públicas/Anon
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para permitir leitura e escrita pública/autenticada
DROP POLICY IF EXISTS "Permitir leitura de audit_logs" ON public.audit_logs;
CREATE POLICY "Permitir leitura de audit_logs" ON public.audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de audit_logs" ON public.audit_logs;
CREATE POLICY "Permitir inserção de audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo em lancamentos" ON public.lancamentos;
CREATE POLICY "Permitir tudo em lancamentos" ON public.lancamentos FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir tudo em fechamentos" ON public.fechamentos;
CREATE POLICY "Permitir tudo em fechamentos" ON public.fechamentos FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir tudo em users_profiles" ON public.users_profiles;
CREATE POLICY "Permitir tudo em users_profiles" ON public.users_profiles FOR ALL USING (true);

-- Habilitar Publicação no Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lancamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fechamentos;
