import { NextResponse } from 'next/server';
import { getDb } from '@/src/db';
import { importedFiles, dealerRecords } from '@/src/db/schema';
import { parseCurrencyToNumber } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: false, message: 'DATABASE_URL not configured' }, { status: 200 });
    }
    const body = await request.json();
    const { fileName, headers, records } = body;

    const db = getDb();
    const [fileResult] = await db
      .insert(importedFiles)
      .values({
        fileName: fileName || 'DEALER.xlsx',
        headers: headers || [],
        totalRows: records ? records.length : 0,
      })
      .returning({ id: importedFiles.id });

    if (records && records.length > 0) {
      const dbRecords = records.map((r: any) => ({
        fileId: fileResult.id,
        data: r.Data || r.data || r.col_0 || null,
        entrada: parseCurrencyToNumber(r.Entrada ?? r.entrada),
        saida: parseCurrencyToNumber(r['Saída'] ?? r.Saida ?? r.saida),
        contaClassificacao: r['CONTA CLASSIFICAÇÃO'] || r.contaClassificacao || null,
        historico: r.HISTÓRICO || r.historico || null,
        rawContent: r,
      }));

      await db.insert(dealerRecords).values(dbRecords);
    }

    return NextResponse.json({ success: true, fileId: fileResult.id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
