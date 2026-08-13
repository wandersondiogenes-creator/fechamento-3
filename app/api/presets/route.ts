import { NextResponse } from 'next/server';
import { getDb } from '@/src/db';
import { rulePresets } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: false, message: 'DATABASE_URL not configured' }, { status: 200 });
    }
    const db = getDb();
    const presets = await db.select().from(rulePresets);
    return NextResponse.json({ success: true, presets });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: false, message: 'DATABASE_URL not configured' }, { status: 200 });
    }
    const body = await request.json();
    const { id, name, description, rulesConfig } = body;

    if (!id || !name || !rulesConfig) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    await db
      .insert(rulePresets)
      .values({
        id,
        name,
        description: description || '',
        rulesConfig,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: rulePresets.id,
        set: {
          name,
          description: description || '',
          rulesConfig,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
