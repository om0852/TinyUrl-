import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const title = searchParams.get('title') || 'Enterprise Link Operations';
    const slug = searchParams.get('slug') || 'lmk.to/link';
    const clicks = searchParams.get('clicks') || '24.8k';
    const theme = searchParams.get('theme') || 'indigo';

    // Gradients
    const bgGradient =
      theme === 'emerald'
        ? 'linear-gradient(135deg, #002113 0%, #005338 60%, #003723 100%)'
        : theme === 'purple'
        ? 'linear-gradient(135deg, #25005a 0%, #712ae2 60%, #3b0764 100%)'
        : 'linear-gradient(135deg, #0f0069 0%, #3525cd 50%, #4f46e5 100%)';

    const accentColor =
      theme === 'emerald' ? '#4edea3' : theme === 'purple' ? '#d2bbff' : '#c3c0ff';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px 70px',
            background: bgGradient,
            fontFamily: 'sans-serif',
            color: '#ffffff',
            position: 'relative',
          }}
        >
          {/* Subtle accent circles */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.08)',
              filter: 'blur(60px)',
            }}
          />

          {/* Top Brand & Verified Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '14px',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: '#3525cd',
                  }}
                >
                  L
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '26px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>
                  Loomlink
                </span>
                <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.75)' }}>
                  Enterprise Link Infrastructure
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                fontSize: '15px',
                fontWeight: '600',
                color: accentColor,
              }}
            >
              <span>SafeBrowsing Verified</span>
            </div>
          </div>

          {/* Center Main Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px' }}>
            <div
              style={{
                fontSize: '48px',
                fontWeight: '800',
                lineHeight: 1.15,
                letterSpacing: '-1.5px',
                textShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              {title}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '24px',
                fontWeight: '600',
                fontFamily: 'monospace',
                color: accentColor,
              }}
            >
              <span>{slug}</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>·</span>
              <span style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.8)' }}>
                Zero-Latency 24ms
              </span>
            </div>
          </div>

          {/* Bottom Telemetry Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
                  Total Real-time Visits
                </span>
                <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{clicks}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
                  Edge SLA
                </span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#6ffbbe' }}>
                  99.99%
                </span>
              </div>
            </div>

            <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.65)' }}>
              Powered by Loomlink Autonomous Routing
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate the image: ${e.message}`, {
      status: 500,
    });
  }
}
