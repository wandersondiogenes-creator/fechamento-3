import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/src/db';
import { userWorkspaces, userPendingFiles } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import {
  UserWorkspaceSession,
  PendingFileRecord,
  cleanEmailKey,
  isSessionExpired,
  extractMetricsFromSession,
} from '@/lib/pending-files-service';

export const dynamic = 'force-dynamic';

// Resilient In-Memory store for fast cross-device sync & server-side retention
const inMemoryWorkspaces = new Map<string, UserWorkspaceSession>();
const inMemoryPendingFiles = new Map<string, PendingFileRecord[]>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');
    if (!emailParam) {
      return NextResponse.json({ success: false, error: 'Email é obrigatório' }, { status: 400 });
    }

    const cleanEmail = cleanEmailKey(emailParam);
    let workspace: UserWorkspaceSession | null = inMemoryWorkspaces.get(cleanEmail) || null;

    // Try database if available
    if (!workspace && process.env.DATABASE_URL) {
      try {
        const db = getDb();
        const rows = await db.select().from(userWorkspaces).where(eq(userWorkspaces.userEmail, cleanEmail)).limit(1);
        if (rows.length > 0) {
          workspace = {
            ...(rows[0].workspacePayload as any),
            userEmail: cleanEmail,
            lastActiveAt: rows[0].lastActiveAt,
          };
          if (workspace) inMemoryWorkspaces.set(cleanEmail, workspace);
        }
      } catch (dbErr) {
        console.warn('DB read error for user workspace:', dbErr);
      }
    }

    if (!workspace) {
      return NextResponse.json({ success: true, activeWorkspace: null, wasAutoArchived: false });
    }

    // Check 8-Hour Expiration Rule
    const hasData =
      (workspace.dealerState?.rawData && workspace.dealerState.rawData.length > 0) ||
      (workspace.sitefState?.rawData && workspace.sitefState.rawData.length > 0) ||
      (workspace.manualFechamentoItems && workspace.manualFechamentoItems.length > 0);

    if (isSessionExpired(workspace.lastActiveAt)) {
      let archivedFile: PendingFileRecord | undefined;
      if (hasData) {
        const metrics = extractMetricsFromSession(
          workspace.dealerState,
          workspace.sitefState,
          workspace.pendenteCdcState,
          workspace.manualFechamentoItems
        );
        const dateFormatted = new Date(workspace.lastActiveAt).toLocaleString('pt-BR');
        archivedFile = {
          id: `pend_auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          userEmail: cleanEmail,
          userName: workspace.userName,
          createdAt: new Date().toISOString(),
          title: `Arquivado Automaticamente (+8h) - ${dateFormatted}`,
          description: `Sessão de trabalho iniciada em ${dateFormatted} arquivada automaticamente por atingir o limite de 8 horas.`,
          source: 'auto_expired',
          dealerState: workspace.dealerState,
          sitefState: workspace.sitefState,
          pendenteCdcState: workspace.pendenteCdcState,
          manualFechamentoItems: workspace.manualFechamentoItems || [],
          deletedFechamentoIds: workspace.deletedFechamentoIds || [],
          conciliatedEmpresas: workspace.conciliatedEmpresas || {},
          tabFilters: workspace.tabFilters,
          activeTab: workspace.activeTab,
          metrics,
        };

        // Store to pending files list
        const existingList = inMemoryPendingFiles.get(cleanEmail) || [];
        inMemoryPendingFiles.set(cleanEmail, [archivedFile, ...existingList]);

        if (process.env.DATABASE_URL) {
          try {
            const db = getDb();
            await db.insert(userPendingFiles).values({
              id: archivedFile.id,
              userEmail: cleanEmail,
              title: archivedFile.title,
              source: archivedFile.source,
              payload: archivedFile as any,
              metrics: metrics as any,
            });
          } catch (dbErr) {
            console.warn('DB write error for auto-archived file:', dbErr);
          }
        }
      }

      // Clear workspace from memory & DB
      inMemoryWorkspaces.delete(cleanEmail);
      if (process.env.DATABASE_URL) {
        try {
          const db = getDb();
          await db.delete(userWorkspaces).where(eq(userWorkspaces.userEmail, cleanEmail));
        } catch {}
      }

      return NextResponse.json({
        success: true,
        activeWorkspace: null,
        wasAutoArchived: Boolean(hasData),
        archivedFile,
      });
    }

    return NextResponse.json({
      success: true,
      activeWorkspace: workspace,
      wasAutoArchived: false,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: UserWorkspaceSession = await req.json();
    if (!body || !body.userEmail) {
      return NextResponse.json({ success: false, error: 'Email e dados do workspace são obrigatórios' }, { status: 400 });
    }

    const cleanEmail = cleanEmailKey(body.userEmail);
    const updatedWorkspace: UserWorkspaceSession = {
      ...body,
      userEmail: cleanEmail,
      lastActiveAt: new Date().toISOString(),
    };

    inMemoryWorkspaces.set(cleanEmail, updatedWorkspace);

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db
          .insert(userWorkspaces)
          .values({
            userEmail: cleanEmail,
            lastActiveAt: updatedWorkspace.lastActiveAt,
            workspacePayload: updatedWorkspace as any,
          })
          .onConflictDoUpdate({
            target: userWorkspaces.userEmail,
            set: {
              lastActiveAt: updatedWorkspace.lastActiveAt,
              workspacePayload: updatedWorkspace as any,
              updatedAt: new Date(),
            },
          });
      } catch (dbErr) {
        console.warn('DB upsert error for user workspace:', dbErr);
      }
    }

    return NextResponse.json({ success: true, lastActiveAt: updatedWorkspace.lastActiveAt });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');
    if (!emailParam) {
      return NextResponse.json({ success: false, error: 'Email é obrigatório' }, { status: 400 });
    }

    const cleanEmail = cleanEmailKey(emailParam);
    inMemoryWorkspaces.delete(cleanEmail);

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db.delete(userWorkspaces).where(eq(userWorkspaces.userEmail, cleanEmail));
      } catch (dbErr) {
        console.warn('DB delete error for workspace:', dbErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
