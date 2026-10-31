// Built-in Brand & Utility Logos as optimized Base64 SVG Data URLs

export interface QrThemePreset {
  id: string;
  name: string;
  fgColor: string;
  bgColor: string;
  accentColor: string;
  category: 'dark' | 'light' | 'vibrant' | 'luxury';
  description: string;
}

export interface PresetBrandLogo {
  id: string;
  name: string;
  category: 'social' | 'tech' | 'utility';
  svgDataUri: string;
  brandColor: string;
  suggestedFg: string;
  suggestedBg: string;
}

export type QrFrameStyle = 'none' | 'bottom-badge' | 'top-header' | 'phone-mockup' | 'glass-card';

// Optimized SVG Data URIs for preset logos
export const PRESET_BRAND_LOGOS: PresetBrandLogo[] = [
  {
    id: 'link',
    name: 'Link',
    category: 'utility',
    brandColor: '#3F6212',
    suggestedFg: '#3F6212',
    suggestedBg: '#ECFCCB',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233F6212" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
  },
  {
    id: 'google',
    name: 'Google',
    category: 'tech',
    brandColor: '#4285F4',
    suggestedFg: '#1A73E8',
    suggestedBg: '#FFFFFF',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="%234285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/><path fill="%23FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/><path fill="%2334A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/></svg>`
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'social',
    brandColor: '#E1306C',
    suggestedFg: '#C13584',
    suggestedBg: '#FFF1F2',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23E1306C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>`
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'social',
    brandColor: '#25D366',
    suggestedFg: '#075E54',
    suggestedBg: '#F0FDF4',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2325D366"><path d="M20.52 3.48A11.93 11.93 0 0 0 12.06 0C5.46 0 .09 5.37.09 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.21-1.63a11.93 11.93 0 0 0 5.85 1.51h.01c6.6 0 11.97-5.37 11.97-11.97 0-3.2-1.25-6.21-3.52-8.43zm-8.46 18.39h-.01a9.9 9.9 0 0 1-5.05-1.39l-.36-.21-3.75.98 1-3.65-.24-.38a9.92 9.92 0 0 1-1.52-5.25c0-5.48 4.46-9.94 9.94-9.94 2.65 0 5.15 1.03 7.03 2.91 1.88 1.88 2.91 4.38 2.91 7.03 0 5.48-4.46 9.9-9.95 9.9z"/></svg>`
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'social',
    brandColor: '#FF0000',
    suggestedFg: '#CC0000',
    suggestedBg: '#FFF1F2',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    category: 'social',
    brandColor: '#000000',
    suggestedFg: '#000000',
    suggestedBg: '#FFFFFF',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23000000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'tech',
    brandColor: '#24292F',
    suggestedFg: '#24292F',
    suggestedBg: '#F6F8FA',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2324292F"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'social',
    brandColor: '#0A66C2',
    suggestedFg: '#0A66C2',
    suggestedBg: '#F0F7FF',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%230A66C2"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`
  },
  {
    id: 'wifi',
    name: 'WiFi',
    category: 'utility',
    brandColor: '#059669',
    suggestedFg: '#047857',
    suggestedBg: '#ECFDF5',
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>`
  }
];

// Curated Amazing QR Code Themes & Color Palettes
export const QR_THEME_PRESETS: QrThemePreset[] = [
  {
    id: 'midnight-neon',
    name: 'Midnight Neon',
    fgColor: '#00F0FF',
    bgColor: '#0B0F19',
    accentColor: '#00F0FF',
    category: 'dark',
    description: 'Electric cyan against deep cyber slate'
  },
  {
    id: 'royal-indigo',
    name: 'Royal Velvet',
    fgColor: '#6366F1',
    bgColor: '#0F172A',
    accentColor: '#818CF8',
    category: 'dark',
    description: 'Vibrant indigo on midnight noir'
  },
  {
    id: 'champagne-noir',
    name: 'Obsidian Gold',
    fgColor: '#F59E0B',
    bgColor: '#18181B',
    accentColor: '#FBBF24',
    category: 'luxury',
    description: 'Polished warm gold on matte carbon'
  },
  {
    id: 'emerald-eco',
    name: 'Emerald Mint',
    fgColor: '#059669',
    bgColor: '#F0FDF4',
    accentColor: '#10B981',
    category: 'light',
    description: 'Fresh crisp eco-green on soft mint'
  },
  {
    id: 'sunset-blaze',
    name: 'Sunset Horizon',
    fgColor: '#EA580C',
    bgColor: '#FFF7ED',
    accentColor: '#F97316',
    category: 'vibrant',
    description: 'Warm glowing amber and tangerine'
  },
  {
    id: 'berry-crimson',
    name: 'Velvet Rose',
    fgColor: '#BE185D',
    bgColor: '#FDF2F8',
    accentColor: '#DB2777',
    category: 'vibrant',
    description: 'Rich royal berry with clean contrast'
  },
  {
    id: 'sapphire-ocean',
    name: 'Ocean Sapphire',
    fgColor: '#0284C7',
    bgColor: '#F0F9FF',
    accentColor: '#38BDF8',
    category: 'light',
    description: 'Modern maritime blue on sky wash'
  },
  {
    id: 'classic-pure',
    name: 'Carbon Pure',
    fgColor: '#0F172A',
    bgColor: '#FFFFFF',
    accentColor: '#475569',
    category: 'light',
    description: 'Maximum contrast, universally scannable'
  }
];

/**
 * Extracts the primary and secondary branding colors from any user-uploaded image (PNG, JPEG, SVG)
 * using an offscreen canvas.
 */
export function extractColorsFromImage(dataUrl: string): Promise<{ primary: string; secondary: string; background: string }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ primary: '#3F6212', secondary: '#65A30D', background: '#FFFFFF' });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ primary: '#3F6212', secondary: '#65A30D', background: '#FFFFFF' });
          return;
        }

        const sampleSize = 64;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        const colorBuckets: { r: number; g: number; b: number; count: number }[] = [];

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Skip transparent or near-white / near-black pixels
          if (a < 120) continue;
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness > 245 || brightness < 15) continue;

          const match = colorBuckets.find(bucket => 
            Math.abs(bucket.r - r) < 35 && 
            Math.abs(bucket.g - g) < 35 && 
            Math.abs(bucket.b - b) < 35
          );

          if (match) {
            match.count++;
          } else {
            colorBuckets.push({ r, g, b, count: 1 });
          }
        }

        colorBuckets.sort((a, b) => b.count - a.count);

        if (colorBuckets.length > 0) {
          const top = colorBuckets[0];
          const hexPrimary = `#${((1 << 24) + (top.r << 16) + (top.g << 8) + top.b).toString(16).slice(1)}`;
          const sec = colorBuckets[1] || top;
          const hexSecondary = `#${((1 << 24) + (sec.r << 16) + (sec.g << 8) + sec.b).toString(16).slice(1)}`;

          // If primary is light, suggest a dark background, or vice versa
          const topBrightness = (top.r * 299 + top.g * 587 + top.b * 114) / 1000;
          const background = topBrightness > 150 ? '#0B0F19' : '#FFFFFF';

          resolve({ primary: hexPrimary, secondary: hexSecondary, background });
        } else {
          resolve({ primary: '#3F6212', secondary: '#65A30D', background: '#FFFFFF' });
        }
      } catch {
        resolve({ primary: '#3F6212', secondary: '#65A30D', background: '#FFFFFF' });
      }
    };

    img.onerror = () => {
      resolve({ primary: '#3F6212', secondary: '#65A30D', background: '#FFFFFF' });
    };

    img.src = dataUrl;
  });
}
