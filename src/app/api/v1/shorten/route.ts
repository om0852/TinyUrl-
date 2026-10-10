import { NextResponse } from 'next/server';
import { generateBase62Code, normalizeUrl, buildUtmUrl, RESERVED_SLUGS } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination_url, custom_slug, title, tags, utm_source, utm_medium, utm_campaign } = body;

    if (!destination_url) {
      return NextResponse.json({ error: 'destination_url parameter is required' }, { status: 400 });
    }

    const normUrl = normalizeUrl(destination_url);

    let code = custom_slug ? custom_slug.trim() : '';
    if (code) {
      if (RESERVED_SLUGS.has(code.toLowerCase())) {
        return NextResponse.json({ error: `Custom slug "${code}" is reserved` }, { status: 422 });
      }
    } else {
      code = generateBase62Code(6);
    }

    const finalUrl = buildUtmUrl(normUrl, {
      source: utm_source,
      medium: utm_medium,
      campaign: utm_campaign
    });

    const mockShortLink = {
      id: `link_${Date.now()}`,
      short_code: code,
      short_url: `https://short.link/r/${code}`,
      destination_url: finalUrl,
      title: title || `Short Link /${code}`,
      tags: tags || ['api'],
      status: 'active',
      clicks_count: 0,
      created_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Short URL created successfully',
      data: mockShortLink
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
