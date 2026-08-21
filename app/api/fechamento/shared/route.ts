import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/src/db';
import { sharedFechamentos } from '@/src/db/schema';
import { eq, desc, or } from 'drizzle-orm';
import {
  SharedFechamentoSession,
  SessionParticipant,
  SessionChatMessage,
  extractRoomCode,
} from '@/lib/shared-fechamento-service';
import { FechamentoItem, FechamentoSummary } from '@/lib/fechamento-utils';

export const dynamic = 'force-dynamic';

// In-memory storage for low-latency multi-user synchronization
const inMemorySessions = new Map<string, SharedFechamentoSession>();

function cleanParticipantList(participants: SessionParticipant[]): SessionParticipant[] {
  const now = Date.now();
  // Keep users seen in last 3 minutes as active
  return (participants || []).filter((p) => {
    const last = new Date(p.lastSeen).getTime();
    return now - last < 1000 * 60 * 60 * 12; // 12 hours retention in list
  });
}

export function deduplicateItems(items: FechamentoItem[]): FechamentoItem[] {
  if (!items || !Array.isArray(items)) return [];
  const map = new Map<string, FechamentoItem>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function computeSessionSummary(items: FechamentoItem[]): FechamentoSummary {
  let totalDealer = 0;
  let totalSitef = 0;
  let countDivergencias = 0;
  let countConciliados = 0;
  let countPixValidacao = 0;

  for (const item of items) {
    totalDealer += Number(item.valorDealer) || 0;
    totalSitef += Number(item.valorSitef) || 0;
    if (item.isPixValidationNeeded || item.status?.includes('VALIDAÇÃO NECESSÁRIA')) {
      countPixValidacao++;
    }
    if (item.temDivergencia) {
      countDivergencias++;
    } else {
      countConciliados++;
    }
  }

  return {
    totalDealer: Math.round(totalDealer * 100) / 100,
    totalSitef: Math.round(totalSitef * 100) / 100,
    diferencaTotal: Math.round((totalDealer - totalSitef) * 100) / 100,
    countTotal: items.length,
    countDivergencias,
    countConciliados,
    countPixValidacao,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listAll = searchParams.get('list') === 'true';
    const rawId =
      searchParams.get('id') ||
      searchParams.get('sala') ||
      searchParams.get('code') ||
      searchParams.get('shared') ||
      searchParams.get('fechamento');
    const id = extractRoomCode(rawId);

    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    const userEmail = searchParams.get('userEmail');
    const userEmpresa = searchParams.get('userEmpresa');
    const userRole = searchParams.get('userRole');

    // 1. List active shared sessions
    if (listAll) {
      const allSessions: SharedFechamentoSession[] = [];
      inMemorySessions.forEach((s) => {
        if (s.status === 'active') {
          allSessions.push({
            ...s,
            activeParticipants: cleanParticipantList(s.activeParticipants),
          });
        }
      });

      // Try reading DB as well
      if (process.env.DATABASE_URL) {
        try {
          const db = getDb();
          const dbRows = await db
            .select()
            .from(sharedFechamentos)
            .where(eq(sharedFechamentos.status, 'active'))
            .orderBy(desc(sharedFechamentos.updatedAt))
            .limit(20);

          dbRows.forEach((row) => {
            if (!inMemorySessions.has(row.id)) {
              allSessions.push({
                id: row.id,
                title: row.title,
                dataMovimento: row.dataMovimento,
                createdBy: row.createdBy as any,
                status: row.status as any,
                items: row.items as any,
                conciliatedEmpresas: (row.conciliatedEmpresas as any) || {},
                summary: row.summary as any,
                dealerState: (row.dealerState as any) || undefined,
                sitefState: (row.sitefState as any) || undefined,
                pendenteCdcState: (row.pendenteCdcState as any) || undefined,
                activeParticipants: (row.activeParticipants as any) || [],
                kickedUserIds: (row.kickedUserIds as any) || [],
                chatMessages: (row.chatMessages as any) || [],
                lastAction: (row.lastAction as any) || undefined,
                version: row.version || 1,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
              });
            }
          });
        } catch (dbErr) {
          console.warn('DB read error in shared list (fallback to memory):', dbErr);
        }
      }

      // Sort by updatedAt desc
      allSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return NextResponse.json({ success: true, sessions: allSessions });
    }

    // 2. Fetch specific session
    if (!id) {
      return NextResponse.json({ success: false, error: 'Código ou ID da sala não informado' }, { status: 400 });
    }

    let session = inMemorySessions.get(id);

    // Fallback: search in memory by case-insensitive or stripped hyphen
    if (!session) {
      const cleanKey = id.replace(/[^A-Z0-9]/gi, '');
      for (const [k, s] of inMemorySessions.entries()) {
        if (k.toUpperCase() === id.toUpperCase() || k.replace(/[^A-Z0-9]/gi, '') === cleanKey) {
          session = s;
          break;
        }
      }
    }

    // If not in memory, check database
    if (!session && process.env.DATABASE_URL) {
      try {
        const db = getDb();
        const stripped = id.replace(/[^A-Z0-9]/gi, '');
        const rows = await db
          .select()
          .from(sharedFechamentos)
          .where(
            or(
              eq(sharedFechamentos.id, id),
              eq(sharedFechamentos.id, id.toLowerCase()),
              eq(sharedFechamentos.id, stripped)
            )
          )
          .limit(1);

        if (rows.length > 0) {
          const row = rows[0];
          session = {
            id: row.id,
            title: row.title,
            dataMovimento: row.dataMovimento,
            createdBy: row.createdBy as any,
            status: row.status as any,
            items: row.items as any,
            conciliatedEmpresas: (row.conciliatedEmpresas as any) || {},
            summary: row.summary as any,
            dealerState: (row.dealerState as any) || undefined,
            sitefState: (row.sitefState as any) || undefined,
            pendenteCdcState: (row.pendenteCdcState as any) || undefined,
            activeParticipants: (row.activeParticipants as any) || [],
            kickedUserIds: (row.kickedUserIds as any) || [],
            chatMessages: (row.chatMessages as any) || [],
            lastAction: (row.lastAction as any) || undefined,
            version: row.version || 1,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          };
          inMemorySessions.set(session.id, session);
        }
      } catch (dbErr) {
        console.warn('DB lookup error:', dbErr);
      }
    }

    // Check if session was closed or deleted
    if (session && session.status === 'closed') {
      return NextResponse.json(
        { success: false, closed: true, error: 'A sala compartilhada foi encerrada pelo anfitrião.' },
        { status: 200 }
      );
    }

    // Check if requesting user was kicked by the host
    if (session && userId && session.kickedUserIds && session.kickedUserIds.includes(userId)) {
      return NextResponse.json(
        { success: false, kicked: true, error: 'Você foi desconectado da sala pelo anfitrião.' },
        { status: 200 }
      );
    }

    if (!session) {
      // Auto-bootstrap a collaborative room on-the-fly for valid room code patterns
      const isRoomCodePattern = /^FC-?\d{4,8}$/i.test(id);
      if (isRoomCodePattern) {
        const nowIso = new Date().toISOString();
        const dateStr = new Date().toLocaleDateString('pt-BR');
        session = {
          id: id,
          title: `Fechamento de Caixa - ${dateStr}`,
          dataMovimento: dateStr,
          createdBy: {
            id: userId || 'usr_host',
            name: userName || 'Operador',
            email: userEmail || 'operador@trataexcel.com.br',
            empresa: userEmpresa || 'Matriz',
            role: userRole || 'operador',
          },
          status: 'active',
          items: [],
          conciliatedEmpresas: {},
          summary: {
            totalDealer: 0,
            totalSitef: 0,
            diferencaTotal: 0,
            countTotal: 0,
            countDivergencias: 0,
            countConciliados: 0,
            countPixValidacao: 0,
          },
          activeParticipants: [],
          kickedUserIds: [],
          chatMessages: [],
          version: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        inMemorySessions.set(id, session);

        if (process.env.DATABASE_URL) {
          try {
            const db = getDb();
            await db
              .insert(sharedFechamentos)
              .values({
                id: session.id,
                title: session.title,
                dataMovimento: session.dataMovimento,
                createdBy: session.createdBy,
                status: session.status,
                items: session.items,
                conciliatedEmpresas: session.conciliatedEmpresas,
                summary: session.summary,
                activeParticipants: session.activeParticipants,
                kickedUserIds: session.kickedUserIds || [],
                chatMessages: session.chatMessages || [],
                updatedAt: new Date(),
              })
              .onConflictDoNothing();
          } catch (dbErr) {
            console.warn('DB auto-provision error:', dbErr);
          }
        }
      } else {
        return NextResponse.json(
          { success: false, error: `Sala de Fechamento "${id}" não encontrada ou expirada.` },
          { status: 404 }
        );
      }
    }

    // Register participant heartbeat if user query params provided and not kicked
    if (userId && userName && (!session.kickedUserIds || !session.kickedUserIds.includes(userId))) {
      const nowIso = new Date().toISOString();
      const existingPartIdx = session.activeParticipants.findIndex((p) => p.id === userId || p.email === userEmail);
      if (existingPartIdx >= 0) {
        session.activeParticipants[existingPartIdx].lastSeen = nowIso;
        if (userName) session.activeParticipants[existingPartIdx].name = userName;
        if (userEmpresa) session.activeParticipants[existingPartIdx].empresa = userEmpresa;
      } else {
        session.activeParticipants.push({
          id: userId,
          name: userName,
          email: userEmail || '',
          empresa: userEmpresa || 'Geral',
          role: userRole || 'operador',
          lastSeen: nowIso,
          isHost: session.createdBy.id === userId || session.createdBy.email === userEmail,
        });
      }
      session.activeParticipants = cleanParticipantList(session.activeParticipants);
    }

    if (session) {
      const sanitizedItems = deduplicateItems(session.items || []);
      const accurateSummary = computeSessionSummary(sanitizedItems);
      session = {
        ...session,
        items: sanitizedItems,
        summary: accurateSummary,
      };
      inMemorySessions.set(session.id, session);
    }

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Action 1: Leave Room (Participant Disconnect)
    if (body.action === 'leave') {
      const { sessionId, user } = body;
      const cleanSessionId = extractRoomCode(sessionId);
      if (!cleanSessionId || !user?.id) {
        return NextResponse.json({ success: true });
      }

      const session = inMemorySessions.get(cleanSessionId);
      if (session) {
        session.activeParticipants = session.activeParticipants.filter(
          (p) => p.id !== user.id && p.email !== user.email
        );
        session.version = (session.version || 1) + 1;
        session.updatedAt = new Date().toISOString();
        inMemorySessions.set(cleanSessionId, session);

        if (process.env.DATABASE_URL) {
          try {
            const db = getDb();
            await db
              .update(sharedFechamentos)
              .set({ activeParticipants: session.activeParticipants, updatedAt: new Date() })
              .where(eq(sharedFechamentos.id, cleanSessionId));
          } catch {}
        }
      }
      return NextResponse.json({ success: true });
    }

    // Action 2: Kick User (Host Admin kicking participant)
    if (body.action === 'kick') {
      const { sessionId, adminUser, targetUserId } = body;
      const cleanSessionId = extractRoomCode(sessionId);
      if (!cleanSessionId || !targetUserId) {
        return NextResponse.json({ success: false, error: 'Parâmetros inválidos para remoção de participante' }, { status: 400 });
      }

      let session = inMemorySessions.get(cleanSessionId);
      if (!session && process.env.DATABASE_URL) {
        const db = getDb();
        const rows = await db.select().from(sharedFechamentos).where(eq(sharedFechamentos.id, cleanSessionId)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          session = {
            id: row.id,
            title: row.title,
            dataMovimento: row.dataMovimento,
            createdBy: row.createdBy as any,
            status: row.status as any,
            items: (row.items as any) || [],
            conciliatedEmpresas: (row.conciliatedEmpresas as any) || {},
            summary: (row.summary as any) || computeSessionSummary([]),
            dealerState: (row.dealerState as any) || undefined,
            sitefState: (row.sitefState as any) || undefined,
            pendenteCdcState: (row.pendenteCdcState as any) || undefined,
            activeParticipants: (row.activeParticipants as any) || [],
            kickedUserIds: (row.kickedUserIds as any) || [],
            chatMessages: (row.chatMessages as any) || [],
            lastAction: (row.lastAction as any) || undefined,
            version: row.version || 1,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          };
          inMemorySessions.set(cleanSessionId, session);
        }
      }

      if (!session) {
        return NextResponse.json({ success: false, error: 'Sessão não encontrada' }, { status: 404 });
      }

      // Add target to kicked list and remove from active participants
      const currentKicked = new Set(session.kickedUserIds || []);
      currentKicked.add(targetUserId);
      session.kickedUserIds = Array.from(currentKicked);
      session.activeParticipants = session.activeParticipants.filter((p) => p.id !== targetUserId);
      session.version = (session.version || 1) + 1;
      session.updatedAt = new Date().toISOString();
      session.lastAction = {
        userId: adminUser?.id || 'admin',
        userName: adminUser?.name || 'Anfitrião',
        description: 'Usuário removido da sala pelo anfitrião',
        timestamp: new Date().toISOString(),
      };

      inMemorySessions.set(cleanSessionId, session);

      if (process.env.DATABASE_URL) {
        try {
          const db = getDb();
          await db
            .update(sharedFechamentos)
            .set({
              kickedUserIds: session.kickedUserIds,
              activeParticipants: session.activeParticipants,
              lastAction: session.lastAction,
              updatedAt: new Date(),
            })
            .where(eq(sharedFechamentos.id, cleanSessionId));
        } catch (dbErr) {
          console.warn('DB kick update error:', dbErr);
        }
      }

      return NextResponse.json({ success: true, session });
    }

    // Action 3: Delete Room
    if (body.action === 'delete_room') {
      const { sessionId } = body;
      const cleanSessionId = extractRoomCode(sessionId);
      if (cleanSessionId) {
        const session = inMemorySessions.get(cleanSessionId);
        if (session) {
          session.status = 'closed';
          session.activeParticipants = [];
          session.version = (session.version || 1) + 1;
          session.updatedAt = new Date().toISOString();
        }
        inMemorySessions.delete(cleanSessionId);

        if (process.env.DATABASE_URL) {
          try {
            const db = getDb();
            await db
              .update(sharedFechamentos)
              .set({ status: 'closed', updatedAt: new Date() })
              .where(eq(sharedFechamentos.id, cleanSessionId));
          } catch {}
        }
      }
      return NextResponse.json({ success: true });
    }

    // Action 4: Chat Message
    if (body.action === 'chat') {
      const { sessionId, user, message } = body;
      const cleanSessionId = extractRoomCode(sessionId);
      if (!cleanSessionId || !message || !user) {
        return NextResponse.json({ success: false, error: 'Dados inválidos para mensagem' }, { status: 400 });
      }

      let session = inMemorySessions.get(cleanSessionId);
      if (!session && process.env.DATABASE_URL) {
        const db = getDb();
        const rows = await db.select().from(sharedFechamentos).where(eq(sharedFechamentos.id, cleanSessionId)).limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          const rawItems = (row.items as any) || [];
          const deduped = deduplicateItems(rawItems);
          session = {
            id: row.id,
            title: row.title,
            dataMovimento: row.dataMovimento,
            createdBy: row.createdBy as any,
            status: row.status as any,
            items: deduped,
            conciliatedEmpresas: (row.conciliatedEmpresas as any) || {},
            summary: computeSessionSummary(deduped),
            dealerState: (row.dealerState as any) || undefined,
            sitefState: (row.sitefState as any) || undefined,
            pendenteCdcState: (row.pendenteCdcState as any) || undefined,
            activeParticipants: (row.activeParticipants as any) || [],
            kickedUserIds: (row.kickedUserIds as any) || [],
            chatMessages: (row.chatMessages as any) || [],
            lastAction: (row.lastAction as any) || undefined,
            version: row.version || 1,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          };
          inMemorySessions.set(cleanSessionId, session);
        }
      }

      if (!session) {
        return NextResponse.json({ success: false, error: 'Sessão não encontrada' }, { status: 404 });
      }

      const chatItem: SessionChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: user.id,
        userName: user.name,
        empresa: user.empresa,
        text: message.trim(),
        timestamp: new Date().toISOString(),
      };

      if (!session.chatMessages) session.chatMessages = [];
      session.chatMessages.push(chatItem);
      session.updatedAt = new Date().toISOString();
      session.version = (session.version || 1) + 1;

      return NextResponse.json({ success: true, session });
    }

    // Action 5: Create or Update Session (Full collaborative sync)
    const { session: incomingSession, user, actionDescription, actionTab } = body;
    if (!incomingSession || !incomingSession.id) {
      return NextResponse.json({ success: false, error: 'ID da sessão é obrigatório' }, { status: 400 });
    }

    const roomId = extractRoomCode(incomingSession.id);
    const existing = inMemorySessions.get(roomId);
    const nowIso = new Date().toISOString();

    const updatedParticipants: SessionParticipant[] = existing ? [...existing.activeParticipants] : [];

    if (user && (!existing?.kickedUserIds || !existing.kickedUserIds.includes(user.id))) {
      const userIdx = updatedParticipants.findIndex((p) => p.id === user.id || p.email === user.email);
      if (userIdx >= 0) {
        updatedParticipants[userIdx].lastSeen = nowIso;
        updatedParticipants[userIdx].name = user.name;
        updatedParticipants[userIdx].empresa = user.empresa;
      } else {
        updatedParticipants.push({
          id: user.id,
          name: user.name,
          email: user.email,
          empresa: user.empresa,
          role: user.role,
          lastSeen: nowIso,
          isHost: existing ? existing.createdBy?.id === user.id : true,
        });
      }
    }

    // Sanitize and deduplicate items
    const rawItems = incomingSession.items !== undefined ? incomingSession.items : (existing?.items || []);
    const sanitizedItems = deduplicateItems(rawItems);
    const accurateSummary = computeSessionSummary(sanitizedItems);

    const mergedConciliatedEmpresas =
      incomingSession.conciliatedEmpresas !== undefined
        ? incomingSession.conciliatedEmpresas
        : (existing?.conciliatedEmpresas || {});

    // Maintain spreadsheet datasets
    const dealerState = incomingSession.dealerState !== undefined ? incomingSession.dealerState : existing?.dealerState;
    const sitefState = incomingSession.sitefState !== undefined ? incomingSession.sitefState : existing?.sitefState;
    const pendenteCdcState = incomingSession.pendenteCdcState !== undefined ? incomingSession.pendenteCdcState : existing?.pendenteCdcState;

    const fullSession: SharedFechamentoSession = {
      id: roomId,
      title: incomingSession.title || existing?.title || `Fechamento ${incomingSession.dataMovimento || 'Hoje'}`,
      dataMovimento: incomingSession.dataMovimento || existing?.dataMovimento || new Date().toLocaleDateString('pt-BR'),
      createdBy: existing?.createdBy || {
        id: user?.id || 'usr_host',
        name: user?.name || 'Operador',
        email: user?.email || 'operador@trataexcel.com.br',
        empresa: user?.empresa || 'Matriz',
        role: user?.role || 'operador',
      },
      status: incomingSession.status || existing?.status || 'active',
      items: sanitizedItems,
      conciliatedEmpresas: mergedConciliatedEmpresas,
      summary: accurateSummary,
      dealerState: dealerState || undefined,
      sitefState: sitefState || undefined,
      pendenteCdcState: pendenteCdcState || undefined,
      activeParticipants: cleanParticipantList(updatedParticipants),
      kickedUserIds: existing?.kickedUserIds || [],
      chatMessages: incomingSession.chatMessages || existing?.chatMessages || [],
      lastAction: actionDescription
        ? {
            userId: user?.id || 'sys',
            userName: user?.name || 'Operador',
            description: actionDescription,
            tab: actionTab,
            timestamp: nowIso,
          }
        : existing?.lastAction,
      version: (existing?.version || 0) + 1,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    inMemorySessions.set(roomId, fullSession);

    // Save to Database if configured
    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db
          .insert(sharedFechamentos)
          .values({
            id: roomId,
            title: fullSession.title,
            dataMovimento: fullSession.dataMovimento,
            createdBy: fullSession.createdBy,
            status: fullSession.status,
            items: fullSession.items,
            conciliatedEmpresas: fullSession.conciliatedEmpresas,
            summary: fullSession.summary,
            dealerState: fullSession.dealerState,
            sitefState: fullSession.sitefState,
            pendenteCdcState: fullSession.pendenteCdcState,
            activeParticipants: fullSession.activeParticipants,
            kickedUserIds: fullSession.kickedUserIds || [],
            chatMessages: fullSession.chatMessages || [],
            lastAction: fullSession.lastAction,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: sharedFechamentos.id,
            set: {
              title: fullSession.title,
              dataMovimento: fullSession.dataMovimento,
              status: fullSession.status,
              items: fullSession.items,
              conciliatedEmpresas: fullSession.conciliatedEmpresas,
              summary: fullSession.summary,
              dealerState: fullSession.dealerState,
              sitefState: fullSession.sitefState,
              pendenteCdcState: fullSession.pendenteCdcState,
              activeParticipants: fullSession.activeParticipants,
              kickedUserIds: fullSession.kickedUserIds || [],
              chatMessages: fullSession.chatMessages || [],
              lastAction: fullSession.lastAction,
              updatedAt: new Date(),
            },
          });
      } catch (dbErr) {
        console.warn('DB upsert error in shared session (in-memory preserved):', dbErr);
      }
    }

    return NextResponse.json({ success: true, session: fullSession });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get('id') || searchParams.get('sala') || searchParams.get('code');
    const id = extractRoomCode(rawId);

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID da sala não informado' }, { status: 400 });
    }

    const session = inMemorySessions.get(id);
    if (session) {
      session.status = 'closed';
      session.activeParticipants = [];
      session.version = (session.version || 1) + 1;
      session.updatedAt = new Date().toISOString();
    }
    inMemorySessions.delete(id);

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db
          .update(sharedFechamentos)
          .set({ status: 'closed', updatedAt: new Date() })
          .where(eq(sharedFechamentos.id, id));
      } catch (dbErr) {
        console.warn('DB close error:', dbErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Sessão encerrada com sucesso' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
