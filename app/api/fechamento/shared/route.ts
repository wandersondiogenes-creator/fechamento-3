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

// Resilient in-memory storage for high-speed multi-user synchronization
const inMemorySessions = new Map<string, SharedFechamentoSession>();

function cleanParticipantList(participants: SessionParticipant[], kickedUserIds: string[] = []): SessionParticipant[] {
  const now = Date.now();
  const kickedSet = new Set(kickedUserIds || []);
  return (participants || []).filter((p) => {
    if (kickedSet.has(p.id)) return false;
    const last = new Date(p.lastSeen).getTime();
    return now - last < 1000 * 60 * 60 * 12; // 12 hours retention in list
  });
}

function deduplicateItems(items: FechamentoItem[]): FechamentoItem[] {
  if (!items || !Array.isArray(items)) return [];
  const map = new Map<string, FechamentoItem>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

function computeSessionSummary(items: FechamentoItem[]): FechamentoSummary {
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
            activeParticipants: cleanParticipantList(s.activeParticipants, s.kickedUserIds),
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
                kickedUserIds: (row.kickedUserIds as any) || [],
                activeParticipants: (row.activeParticipants as any) || [],
                chatMessages: (row.chatMessages as any) || [],
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
            kickedUserIds: (row.kickedUserIds as any) || [],
            activeParticipants: (row.activeParticipants as any) || [],
            chatMessages: (row.chatMessages as any) || [],
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

    // Check if session is deleted
    if (session && session.status === 'deleted') {
      return NextResponse.json({
        success: false,
        deleted: true,
        error: 'Esta sala foi encerrada e excluída pelo administrador.',
      });
    }

    // Check if user was kicked
    if (session && userId && session.kickedUserIds?.includes(userId)) {
      return NextResponse.json({
        success: false,
        kicked: true,
        error: 'Você foi removido desta sala pelo administrador.',
      });
    }

    if (!session) {
      // Auto-bootstrap room on valid room pattern
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
          kickedUserIds: [],
          activeParticipants: [],
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
                dealerState: session.dealerState,
                sitefState: session.sitefState,
                pendenteCdcState: session.pendenteCdcState,
                kickedUserIds: session.kickedUserIds || [],
                activeParticipants: session.activeParticipants,
                chatMessages: session.chatMessages || [],
                updatedAt: new Date(),
              })
              .onConflictDoNothing();
          } catch (dbErr) {
            console.warn('DB auto-provision error:', dbErr);
          }
        }
      } else {
        return NextResponse.json({ success: false, error: `Sala de Fechamento "${id}" não encontrada ou expirada.` }, { status: 404 });
      }
    }

    // Register participant heartbeat
    if (userId && userName) {
      const nowIso = new Date().toISOString();
      const existingPartIdx = session.activeParticipants.findIndex((p) => p.id === userId || p.email === userEmail);
      const isHost = session.createdBy.id === userId || session.createdBy.email === userEmail;

      if (existingPartIdx >= 0) {
        session.activeParticipants[existingPartIdx].lastSeen = nowIso;
        if (userName) session.activeParticipants[existingPartIdx].name = userName;
        if (userEmpresa) session.activeParticipants[existingPartIdx].empresa = userEmpresa;
        session.activeParticipants[existingPartIdx].isHost = isHost;
      } else {
        session.activeParticipants.push({
          id: userId,
          name: userName,
          email: userEmail || '',
          empresa: userEmpresa || 'Geral',
          role: userRole || 'operador',
          lastSeen: nowIso,
          isHost,
        });
      }
      session.activeParticipants = cleanParticipantList(session.activeParticipants, session.kickedUserIds);
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
    const action = body.action;

    // 1. Action: Leave Room
    if (action === 'leave') {
      const { sessionId, user } = body;
      const cleanSessionId = extractRoomCode(sessionId);
      if (!cleanSessionId || !user) {
        return NextResponse.json({ success: false, error: 'Dados inválidos para sair da sala' }, { status: 400 });
      }

      let session = inMemorySessions.get(cleanSessionId);
      if (!session && process.env.DATABASE_URL) {
        const db = getDb();
        const rows = await db.select().from(sharedFechamentos).where(eq(sharedFechamentos.id, cleanSessionId)).limit(1);
        if (rows.length > 0) {
          session = rows[0] as any;
        }
      }

      if (session) {
        session.activeParticipants = (session.activeParticipants || []).filter(
          (p) => p.id !== user.id && p.email !== user.email && p.name !== user.name
        );
        session.updatedAt = new Date().toISOString();
        session.version = (session.version || 1) + 1;
        inMemorySessions.set(cleanSessionId, session);

        if (process.env.DATABASE_URL) {
          try {
            const db = getDb();
            await db
              .update(sharedFechamentos)
              .set({ activeParticipants: session.activeParticipants, updatedAt: new Date() })
              .where(eq(sharedFechamentos.id, cleanSessionId));
          } catch (dbErr) {
            console.warn('DB leave update error:', dbErr);
          }
        }
      }

      return NextResponse.json({ success: true, message: 'Usuário desconectado da sala' });
    }

    // 2. Action: Delete Room (Admin / Host)
    if (action === 'delete_room') {
      const { sessionId, user } = body;
      const cleanSessionId = extractRoomCode(sessionId);
      if (!cleanSessionId || !user) {
        return NextResponse.json({ success: false, error: 'Dados inválidos para excluir a sala' }, { status: 400 });
      }

      let session = inMemorySessions.get(cleanSessionId);
      if (!session && process.env.DATABASE_URL) {
        const db = getDb();
        const rows = await db.select().from(sharedFechamentos).where(eq(sharedFechamentos.id, cleanSessionId)).limit(1);
        if (rows.length > 0) {
          session = rows[0] as any;
        }
      }

      if (!session) {
        // If session not found, treat as already deleted
        return NextResponse.json({ success: true, message: 'Sala já não existe' });
      }

      const isHost =
        session.createdBy?.id === user.id ||
        session.createdBy?.email === user.email ||
        session.createdBy?.name === user.name ||
        user.role === 'admin' ||
        user.role === 'administrador' ||
        session.activeParticipants?.some((p) => (p.id === user.id || p.email === user.email) && p.isHost) ||
        (session.activeParticipants || []).length <= 1;

      if (!isHost) {
        return NextResponse.json({ success: false, error: 'Apenas o anfitrião ou administrador pode excluir a sala' }, { status: 403 });
      }

      // Mark session as deleted
      session.status = 'deleted';
      session.deletedAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      session.activeParticipants = [];
      session.version = (session.version || 1) + 1;
      inMemorySessions.set(cleanSessionId, session);

      if (process.env.DATABASE_URL) {
        try {
          const db = getDb();
          await db
            .update(sharedFechamentos)
            .set({ status: 'deleted', updatedAt: new Date(), activeParticipants: [] })
            .where(eq(sharedFechamentos.id, cleanSessionId));
        } catch (dbErr) {
          console.warn('DB delete update error:', dbErr);
        }
      }

      return NextResponse.json({ success: true, message: 'Sala excluída com sucesso' });
    }

    // 3. Action: Kick Participant (Admin only)
    if (action === 'kick_participant') {
      const { sessionId, targetUserId, user } = body;
      const cleanSessionId = extractRoomCode(sessionId);
      if (!cleanSessionId || !targetUserId || !user) {
        return NextResponse.json({ success: false, error: 'Dados inválidos para remover usuário' }, { status: 400 });
      }

      let session = inMemorySessions.get(cleanSessionId);
      if (!session) {
        return NextResponse.json({ success: false, error: 'Sessão não encontrada' }, { status: 404 });
      }

      const isHost =
        session.createdBy.id === user.id ||
        session.createdBy.email === user.email ||
        user.role === 'admin' ||
        user.role === 'administrador';

      if (!isHost) {
        return NextResponse.json({ success: false, error: 'Apenas o anfitrião pode remover participantes da sala' }, { status: 403 });
      }

      if (!session.kickedUserIds) session.kickedUserIds = [];
      if (!session.kickedUserIds.includes(targetUserId)) {
        session.kickedUserIds.push(targetUserId);
      }

      session.activeParticipants = session.activeParticipants.filter((p) => p.id !== targetUserId);
      session.updatedAt = new Date().toISOString();
      session.version = (session.version || 1) + 1;
      inMemorySessions.set(cleanSessionId, session);

      if (process.env.DATABASE_URL) {
        try {
          const db = getDb();
          await db
            .update(sharedFechamentos)
            .set({
              kickedUserIds: session.kickedUserIds,
              activeParticipants: session.activeParticipants,
              updatedAt: new Date(),
            })
            .where(eq(sharedFechamentos.id, cleanSessionId));
        } catch (dbErr) {
          console.warn('DB kick participant error:', dbErr);
        }
      }

      return NextResponse.json({ success: true, session });
    }

    // 4. Action: Chat Message
    if (action === 'chat') {
      const { sessionId, user, message } = body;
      const cleanSessionId = extractRoomCode(sessionId);
      if (!cleanSessionId || !message || !user) {
        return NextResponse.json({ success: false, error: 'Dados inválidos para mensagem' }, { status: 400 });
      }

      let session = inMemorySessions.get(cleanSessionId);
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

    // 5. Create or Update Session (including full dealerState and sitefState)
    const { session: incomingSession, user } = body;
    if (!incomingSession || !incomingSession.id) {
      return NextResponse.json({ success: false, error: 'ID da sessão é obrigatório' }, { status: 400 });
    }

    const roomId = extractRoomCode(incomingSession.id);
    const existing = inMemorySessions.get(roomId);
    const nowIso = new Date().toISOString();

    const updatedParticipants: SessionParticipant[] = existing ? [...existing.activeParticipants] : [];

    if (user) {
      const userIdx = updatedParticipants.findIndex((p) => p.id === user.id || p.email === user.email);
      const isHost = existing
        ? existing.createdBy?.id === user.id || existing.createdBy?.email === user.email
        : true;

      if (userIdx >= 0) {
        updatedParticipants[userIdx].lastSeen = nowIso;
        updatedParticipants[userIdx].name = user.name;
        updatedParticipants[userIdx].empresa = user.empresa;
        updatedParticipants[userIdx].isHost = isHost;
      } else {
        updatedParticipants.push({
          id: user.id,
          name: user.name,
          email: user.email,
          empresa: user.empresa,
          role: user.role,
          lastSeen: nowIso,
          isHost,
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

    // Spreadsheets states
    const dealerState =
      incomingSession.dealerState !== undefined ? incomingSession.dealerState : existing?.dealerState;
    const sitefState =
      incomingSession.sitefState !== undefined ? incomingSession.sitefState : existing?.sitefState;
    const pendenteCdcState =
      incomingSession.pendenteCdcState !== undefined
        ? incomingSession.pendenteCdcState
        : existing?.pendenteCdcState;

    const kickedUserIds =
      incomingSession.kickedUserIds !== undefined
        ? incomingSession.kickedUserIds
        : (existing?.kickedUserIds || []);

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
      dealerState,
      sitefState,
      pendenteCdcState,
      kickedUserIds,
      activeParticipants: cleanParticipantList(updatedParticipants, kickedUserIds),
      chatMessages: incomingSession.chatMessages || existing?.chatMessages || [],
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
            kickedUserIds: fullSession.kickedUserIds,
            activeParticipants: fullSession.activeParticipants,
            chatMessages: fullSession.chatMessages || [],
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
              kickedUserIds: fullSession.kickedUserIds,
              activeParticipants: fullSession.activeParticipants,
              chatMessages: fullSession.chatMessages || [],
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
      session.status = 'deleted';
      session.deletedAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      session.version = (session.version || 1) + 1;
      inMemorySessions.set(id, session);
    }

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db.update(sharedFechamentos).set({ status: 'deleted', updatedAt: new Date() }).where(eq(sharedFechamentos.id, id));
      } catch (dbErr) {
        console.warn('DB delete error:', dbErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Sessão excluída com sucesso' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

