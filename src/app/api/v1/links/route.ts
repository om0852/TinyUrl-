import { NextResponse } from 'next/server';
import { initialLinks } from '@/lib/db';

export async function GET() {
  return NextResponse.json({
    success: true,
    total: initialLinks.length,
    links: initialLinks.map(l => ({
      id: l.id,
      short_code: l.short_code,
      short_url: `https://short.link/r/${l.short_code}`,
      destination_url: l.destination_url,
      title: l.title,
      tags: l.tags,
      clicks_count: l.clicks_count,
      status: l.status,
      created_at: l.created_at
    }))
  });
}
