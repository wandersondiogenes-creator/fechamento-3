import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/src/db';
import { userPendingFiles } from '@/src/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { PendingFileRecord, cleanEmailKey } from '@/lib/pending-files-service';
import { inMemoryPendingFiles } from '@/lib/server-workspace-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');
    if (!emailParam) {
      return NextResponse.json({ success: false, error: 'Email é obrigatório' }, { status: 400 });
    }

    const cleanEmail = cleanEmailKey(emailParam);
    const inMemList = inMemoryPendingFiles.get(cleanEmail) || [];

    const map = new Map<string, PendingFileRecord>();
    inMemList.forEach((f) => map.set(f.id, f));

    // Also read from DB if available
    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        const rows = await db
          .select()
          .from(userPendingFiles)
          .where(eq(userPendingFiles.userEmail, cleanEmail))
          .orderBy(desc(userPendingFiles.createdAt))
          .limit(100);

        rows.forEach((r) => {
          if (!map.has(r.id)) {
            map.set(r.id, {
              ...(r.payload as any),
              id: r.id,
              userEmail: cleanEmail,
              title: r.title,
              source: r.source as any,
              metrics: r.metrics as any,
              createdAt: r.createdAt.toISOString(),
            });
          }
        });
      } catch (dbErr) {
        console.warn('DB read error for user pending files:', dbErr);
      }
    }

    const list = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ success: true, pendingFiles: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const file: PendingFileRecord = await req.json();
    if (!file || !file.id || !file.userEmail) {
      return NextResponse.json({ success: false, error: 'Dados do arquivo pendente inválidos' }, { status: 400 });
    }

    const cleanEmail = cleanEmailKey(file.userEmail);
    const record: PendingFileRecord = {
      ...file,
      userEmail: cleanEmail,
      createdAt: file.createdAt || new Date().toISOString(),
    };

    // Store in memory
    const existingList = inMemoryPendingFiles.get(cleanEmail) || [];
    const idx = existingList.findIndex((f) => f.id === record.id);
    if (idx >= 0) {
      existingList[idx] = record;
    } else {
      existingList.unshift(record);
    }
    inMemoryPendingFiles.set(cleanEmail, existingList);

    // Store in DB if available
    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db
          .insert(userPendingFiles)
          .values({
            id: record.id,
            userEmail: cleanEmail,
            title: record.title || 'Arquivo Pendente',
            source: record.source || 'manual_save',
            payload: record as any,
            metrics: record.metrics || ({} as any),
          })
          .onConflictDoUpdate({
            target: userPendingFiles.id,
            set: {
              title: record.title,
              source: record.source,
              payload: record as any,
              metrics: record.metrics || ({} as any),
            },
          });
      } catch (dbErr) {
        console.warn('DB write error for user pending file:', dbErr);
      }
    }

    return NextResponse.json({ success: true, file: record });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const emailParam = searchParams.get('email');

    if (!id || !emailParam) {
      return NextResponse.json({ success: false, error: 'ID e Email são obrigatórios' }, { status: 400 });
    }

    const cleanEmail = cleanEmailKey(emailParam);
    const existingList = inMemoryPendingFiles.get(cleanEmail) || [];
    inMemoryPendingFiles.set(
      cleanEmail,
      existingList.filter((f) => f.id !== id)
    );

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db.delete(userPendingFiles).where(and(eq(userPendingFiles.id, id), eq(userPendingFiles.userEmail, cleanEmail)));
      } catch (dbErr) {
        console.warn('DB delete error for pending file:', dbErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
