import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/src/db';
import { sharedFechamentos } from '@/src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { SharedFechamentoSession, SessionParticipant, SessionChatMessage } from '@/lib/shared-fechamento-service';

export const dynamic = 'force-dynamic';

// Resilient in-memory storage for high-speed multi-user synchronization
const inMemorySessions = new Map<string, SharedFechamentoSession>();

function cleanParticipantList(participants: SessionParticipant[]): SessionParticipant[] {
  const now = Date.now();
  // Keep users seen in last 45 seconds as active, or recent
  return (participants || []).filter((p) => {
    const last = new Date(p.lastSeen).getTime();
    return now - last < 1000 * 60 * 60 * 12; // 12 hours retention in list
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listAll = searchParams.get('list') === 'true';
    const id = searchParams.get('id')?.trim().toUpperCase();

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

    // If not in memory, check database
    if (!session && process.env.DATABASE_URL) {
      try {
        const db = getDb();
        const rows = await db.select().from(sharedFechamentos).where(eq(sharedFechamentos.id, id)).limit(1);
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
            activeParticipants: (row.activeParticipants as any) || [],
            chatMessages: (row.chatMessages as any) || [],
            version: row.version || 1,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          };
          inMemorySessions.set(id, session);
        }
      } catch (dbErr) {
        console.warn('DB lookup error:', dbErr);
      }
    }

    if (!session) {
      return NextResponse.json({ success: false, error: `Sala de Fechamento "${id}" não encontrada.` }, { status: 404 });
    }

    // Register participant heartbeat if user query params provided
    const userId = searchParams.get('userId');
    const userName = searchParams.get('userName');
    const userEmail = searchParams.get('userEmail');
    const userEmpresa = searchParams.get('userEmpresa');
    const userRole = searchParams.get('userRole');

    if (userId && userName) {
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

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Action: Chat Message
    if (body.action === 'chat') {
      const { sessionId, user, message } = body;
      if (!sessionId || !message || !user) {
        return NextResponse.json({ success: false, error: 'Dados inválidos para mensagem' }, { status: 400 });
      }

      const session = inMemorySessions.get(sessionId.toUpperCase());
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

    // Create or Update Session
    const { session: incomingSession, user } = body;
    if (!incomingSession || !incomingSession.id) {
      return NextResponse.json({ success: false, error: 'ID da sessão é obrigatório' }, { status: 400 });
    }

    const roomId = incomingSession.id.toUpperCase().trim();
    const existing = inMemorySessions.get(roomId);
    const nowIso = new Date().toISOString();

    const updatedParticipants: SessionParticipant[] = existing ? [...existing.activeParticipants] : [];

    if (user) {
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

    const fullSession: SharedFechamentoSession = {
      id: roomId,
      title: incomingSession.title || `Fechamento ${incomingSession.dataMovimento || 'Hoje'}`,
      dataMovimento: incomingSession.dataMovimento || new Date().toLocaleDateString('pt-BR'),
      createdBy: existing?.createdBy || {
        id: user?.id || 'usr_host',
        name: user?.name || 'Operador',
        email: user?.email || 'operador@trataexcel.com.br',
        empresa: user?.empresa || 'Matriz',
        role: user?.role || 'operador',
      },
      status: incomingSession.status || 'active',
      items: incomingSession.items || existing?.items || [],
      conciliatedEmpresas: incomingSession.conciliatedEmpresas || existing?.conciliatedEmpresas || {},
      summary: incomingSession.summary || existing?.summary || {
        totalDealer: 0,
        totalSitef: 0,
        diferencaTotal: 0,
        countTotal: 0,
        countDivergencias: 0,
        countConciliados: 0,
        countPixValidacao: 0,
      },
      activeParticipants: cleanParticipantList(updatedParticipants),
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
    const id = searchParams.get('id')?.trim().toUpperCase();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID da sala não informado' }, { status: 400 });
    }

    inMemorySessions.delete(id);

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db.delete(sharedFechamentos).where(eq(sharedFechamentos.id, id));
      } catch (dbErr) {
        console.warn('DB delete error:', dbErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Sala encerrada com sucesso' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
