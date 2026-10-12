/**
 * Smart Deep Link Engine (OpeninApp feature)
 * Detects destination platforms and generates native app URI schemes,
 * Android Intents, and in-app browser escape handlers.
 */

export interface DeepLinkDetection {
  isSupported: boolean;
  app: 'youtube' | 'instagram' | 'spotify' | 'amazon' | 'twitter' | 'linkedin' | 'telegram' | 'whatsapp' | 'generic';
  appName: string;
  color: string;
  icon: string;
  iosUri: string;
  androidIntent: string;
  fallbackUrl: string;
}

export function detectAppDeepLink(url: string): DeepLinkDetection | null {
  if (!url) return null;

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;
    const search = parsed.search;

    // 1. YouTube (Videos, Shorts, Channels)
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let videoId = '';
      if (host.includes('youtu.be')) {
        videoId = pathname.replace('/', '').split('?')[0];
      } else if (pathname.includes('/watch')) {
        videoId = parsed.searchParams.get('v') || '';
      } else if (pathname.includes('/shorts/')) {
        videoId = pathname.split('/shorts/')[1]?.split('?')[0] || '';
      }

      const cleanTarget = parsed.href.replace(/^https?:\/\//, '');
      const encodedTarget = encodeURIComponent(parsed.href);
      const androidIntent = `intent://${cleanTarget}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodedTarget};end`;
      const iosUri = videoId ? `vnd.youtube://${videoId}` : `youtube://${cleanTarget}`;

      return {
        isSupported: true,
        app: 'youtube',
        appName: 'YouTube',
        color: '#FF0000',
        icon: 'youtube',
        iosUri,
        androidIntent,
        fallbackUrl: parsed.href
      };
    }

    // 2. Instagram (Profiles, Reels, Posts)
    if (host.includes('instagram.com')) {
      const cleanTarget = parsed.href.replace(/^https?:\/\//, '');
      const encodedTarget = encodeURIComponent(parsed.href);
      const androidIntent = `intent://${cleanTarget}#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodedTarget};end`;
      
      let iosUri = `instagram://url?url=${encodeURIComponent(parsed.href)}`;
      const pathParts = pathname.split('/').filter(Boolean);
      if (pathParts.length === 1 && !['explore', 'direct', 'reels'].includes(pathParts[0])) {
        // Profile link
        iosUri = `instagram://user?username=${pathParts[0]}`;
      }

      return {
        isSupported: true,
        app: 'instagram',
        appName: 'Instagram',
        color: '#E1306C',
        icon: 'instagram',
        iosUri,
        androidIntent,
        fallbackUrl: parsed.href
      };
    }

    // 3. Spotify (Tracks, Albums, Playlists, Artists)
    if (host.includes('spotify.com')) {
      const cleanTarget = parsed.href.replace(/^https?:\/\//, '');
      const encodedTarget = encodeURIComponent(parsed.href);
      const pathParts = pathname.split('/').filter(Boolean);
      let spotifyUri = `spotify://${cleanTarget}`;

      if (pathParts.length >= 2) {
        const [type, id] = pathParts;
        if (['track', 'album', 'playlist', 'artist', 'episode'].includes(type)) {
          spotifyUri = `spotify:${type}:${id}`;
        }
      }

      const androidIntent = `intent://${cleanTarget}#Intent;package=com.spotify.music;scheme=https;S.browser_fallback_url=${encodedTarget};end`;

      return {
        isSupported: true,
        app: 'spotify',
        appName: 'Spotify',
        color: '#1DB954',
        icon: 'music',
        iosUri: spotifyUri,
        androidIntent,
        fallbackUrl: parsed.href
      };
    }

    // 4. Amazon (Products, Storefronts)
    if (host.includes('amazon.') || host.includes('amzn.to')) {
      const cleanTarget = parsed.href.replace(/^https?:\/\//, '');
      const encodedTarget = encodeURIComponent(parsed.href);
      const androidIntent = `intent://${cleanTarget}#Intent;package=com.amazon.mShop.android.shopping;scheme=https;S.browser_fallback_url=${encodedTarget};end`;
      const iosUri = `com.amazon.mobile.shopping.web://${cleanTarget}`;

      return {
        isSupported: true,
        app: 'amazon',
        appName: 'Amazon',
        color: '#FF9900',
        icon: 'shopping-cart',
        iosUri,
        androidIntent,
        fallbackUrl: parsed.href
      };
    }

    // 5. Twitter / X
    if (host.includes('twitter.com') || host.includes('x.com')) {
      const cleanTarget = parsed.href.replace(/^https?:\/\//, '');
      const encodedTarget = encodeURIComponent(parsed.href);
      const androidIntent = `intent://${cleanTarget}#Intent;package=com.twitter.android;scheme=https;S.browser_fallback_url=${encodedTarget};end`;
      
      let iosUri = `twitter://timeline`;
      if (pathname.includes('/status/')) {
        const tweetId = pathname.split('/status/')[1]?.split('?')[0];
        if (tweetId) iosUri = `twitter://status?id=${tweetId}`;
      }

      return {
        isSupported: true,
        app: 'twitter',
        appName: 'X / Twitter',
        color: '#000000',
        icon: 'twitter',
        iosUri,
        androidIntent,
        fallbackUrl: parsed.href
      };
    }

    // 6. LinkedIn
    if (host.includes('linkedin.com')) {
      const cleanTarget = parsed.href.replace(/^https?:\/\//, '');
      const encodedTarget = encodeURIComponent(parsed.href);
      const androidIntent = `intent://${cleanTarget}#Intent;package=com.linkedin.android;scheme=https;S.browser_fallback_url=${encodedTarget};end`;
      const iosUri = `linkedin://${cleanTarget}`;

      return {
        isSupported: true,
        app: 'linkedin',
        appName: 'LinkedIn',
        color: '#0A66C2',
        icon: 'linkedin',
        iosUri,
        androidIntent,
        fallbackUrl: parsed.href
      };
    }

    // 7. Telegram
    if (host.includes('t.me') || host.includes('telegram.me')) {
      const username = pathname.replace('/', '').split('?')[0];
      const encodedTarget = encodeURIComponent(parsed.href);
      const iosUri = username ? `tg://resolve?domain=${username}` : 'tg://';
      const androidIntent = `intent://resolve?domain=${username}#Intent;package=org.telegram.messenger;scheme=tg;S.browser_fallback_url=${encodedTarget};end`;

      return {
        isSupported: true,
        app: 'telegram',
        appName: 'Telegram',
        color: '#24A1DE',
        icon: 'send',
        iosUri,
        androidIntent,
        fallbackUrl: parsed.href
      };
    }

    // 8. WhatsApp
    if (host.includes('wa.me') || host.includes('whatsapp.com')) {
      const cleanTarget = parsed.href.replace(/^https?:\/\//, '');
      const encodedTarget = encodeURIComponent(parsed.href);
      const iosUri = `whatsapp://${cleanTarget}`;
      const androidIntent = `intent://${cleanTarget}#Intent;package=com.whatsapp;scheme=https;S.browser_fallback_url=${encodedTarget};end`;

      return {
        isSupported: true,
        app: 'whatsapp',
        appName: 'WhatsApp',
        color: '#25D366',
        icon: 'message-circle',
        iosUri,
        androidIntent,
        fallbackUrl: parsed.href
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if the current request is inside a restricted In-App Browser
 * (Instagram, TikTok, Facebook, Twitter, LinkedIn, etc.)
 */
export function detectInAppBrowser(userAgent: string): { isInApp: boolean; browserName?: string } {
  if (!userAgent) return { isInApp: false };

  if (/Instagram/i.test(userAgent)) {
    return { isInApp: true, browserName: 'Instagram In-App Browser' };
  }
  if (/FBAN|FBAV/i.test(userAgent)) {
    return { isInApp: true, browserName: 'Facebook In-App Browser' };
  }
  if (/ByteLocale|musical_ly|TikTok/i.test(userAgent)) {
    return { isInApp: true, browserName: 'TikTok In-App Browser' };
  }
  if (/Twitter|TwitterAndroid/i.test(userAgent)) {
    return { isInApp: true, browserName: 'Twitter In-App Browser' };
  }
  if (/LinkedInApp/i.test(userAgent)) {
    return { isInApp: true, browserName: 'LinkedIn In-App Browser' };
  }
  if (/Snapchat/i.test(userAgent)) {
    return { isInApp: true, browserName: 'Snapchat In-App Browser' };
  }

  return { isInApp: false };
}
