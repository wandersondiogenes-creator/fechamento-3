import { NextResponse, NextRequest } from 'next/server';
import { getDb } from '@/src/db';
import { fechamentoRecords } from '@/src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { FechamentoCaixaRecord } from '@/lib/fechamento-caixa-service';

export const dynamic = 'force-dynamic';

const inMemoryRecords = new Map<string, FechamentoCaixaRecord>();

export async function GET() {
  try {
    const list: FechamentoCaixaRecord[] = [];
    inMemoryRecords.forEach((r) => list.push(r));

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        const dbRows = await db.select().from(fechamentoRecords).orderBy(desc(fechamentoRecords.createdAt)).limit(100);
        dbRows.forEach((row) => {
          if (!inMemoryRecords.has(row.id)) {
            list.push({
              id: row.id,
              dataMovimento: row.dataMovimento,
              dataFechamento: row.dataFechamento,
              operador: row.operador,
              observacoes: row.observacoes || undefined,
              totalDealer: Number(row.totalDealer) || 0,
              totalSitef: Number(row.totalSitef) || 0,
              diferencaTotal: Number(row.diferencaTotal) || 0,
              countTotal: row.countTotal || 0,
              countEmpresas: row.countEmpresas || 0,
              empresasNomes: row.empresasNomes || [],
              breakdownPorBandeira: (row.breakdownPorBandeira as any) || {},
              status: row.status,
              items: (row.items as any) || [],
            });
          }
        });
      } catch (dbErr) {
        console.warn('DB read error for records:', dbErr);
      }
    }

    list.sort((a, b) => new Date(b.dataFechamento).getTime() - new Date(a.dataFechamento).getTime());

    return NextResponse.json({ success: true, records: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const record: FechamentoCaixaRecord = await req.json();
    if (!record || !record.id) {
      return NextResponse.json({ success: false, error: 'Dados do fechamento inválidos' }, { status: 400 });
    }

    inMemoryRecords.set(record.id, record);

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db
          .insert(fechamentoRecords)
          .values({
            id: record.id,
            dataMovimento: record.dataMovimento,
            dataFechamento: record.dataFechamento,
            operador: record.operador,
            observacoes: record.observacoes || '',
            totalDealer: String(record.totalDealer || 0),
            totalSitef: String(record.totalSitef || 0),
            diferencaTotal: String(record.diferencaTotal || 0),
            empresasNomes: record.empresasNomes || [],
            breakdownPorBandeira: record.breakdownPorBandeira || {},
            status: record.status,
            items: record.items || [],
          })
          .onConflictDoUpdate({
            target: fechamentoRecords.id,
            set: {
              dataMovimento: record.dataMovimento,
              dataFechamento: record.dataFechamento,
              operador: record.operador,
              observacoes: record.observacoes || '',
              totalDealer: String(record.totalDealer || 0),
              totalSitef: String(record.totalSitef || 0),
              diferencaTotal: String(record.diferencaTotal || 0),
              empresasNomes: record.empresasNomes || [],
              breakdownPorBandeira: record.breakdownPorBandeira || {},
              status: record.status,
              items: record.items || [],
            },
          });
      } catch (dbErr) {
        console.warn('DB upsert error for record:', dbErr);
      }
    }

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID não fornecido' }, { status: 400 });
    }

    inMemoryRecords.delete(id);

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        await db.delete(fechamentoRecords).where(eq(fechamentoRecords.id, id));
      } catch (dbErr) {
        console.warn('DB delete error for record:', dbErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
