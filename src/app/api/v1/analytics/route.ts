import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  return NextResponse.json({
    success: true,
    code: code || 'all',
    metrics: {
      total_clicks: 27852,
      unique_visitors: 20110,
      bot_clicks_filtered: 1140,
      avg_latency_ms: 21.4,
      top_countries: [
        { country: 'United States', code: 'US', clicks: 12400 },
        { country: 'India', code: 'IN', clicks: 6800 },
        { country: 'United Kingdom', code: 'GB', clicks: 4200 },
        { country: 'Germany', code: 'DE', clicks: 2500 }
      ],
      devices: { mobile: '54%', desktop: '41%', tablet: '5%' }
    }
  });
}
