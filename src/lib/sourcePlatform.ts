import { PLATFORM_REGISTRY } from './deepLink';

export interface SourcePlatformInfo {
  id: string;
  name: string;
  category: 'social' | 'messaging' | 'search' | 'media' | 'direct' | 'other';
  color: string;
  badgeBg: string;
  badgeText: string;
  iconType: 'social' | 'messaging' | 'search' | 'media' | 'globe';
}

/**
 * Standardized mapping of known domains, user-agent tokens, and UTM source tags
 * to accurate, human-readable source platform identities.
 */
export function detectSourcePlatform(rawReferrer?: string, destinationUrl?: string): SourcePlatformInfo {
  const ref = (rawReferrer || '').trim().toLowerCase();

  // 1. Direct / Browser Address Bar (No Referrer or standard direct tokens)
  if (!ref || ref === 'direct' || ref === 'direct / none' || ref === 'direct / mobile' || ref === 'none' || ref.includes('localhost') || ref.includes('127.0.0.1')) {
    return {
      id: 'direct',
      name: 'Direct / Browser',
      category: 'direct',
      color: 'bg-slate-700',
      badgeBg: 'bg-slate-100 dark:bg-slate-800',
      badgeText: 'text-slate-800 dark:text-slate-200',
      iconType: 'globe'
    };
  }

  // 1b. Internal / Platform Dashboard Referrer (e.g. testing from within the shortener app)
  if (
    ref.includes('creataurus') ||
    ref.includes('creaturus') ||
    ref.includes('tinyurl') ||
    ref.includes('trimlink') ||
    ref.includes('bankai') ||
    ref.includes('xtrafusion') ||
    (typeof window !== 'undefined' && window.location.hostname && ref.includes(window.location.hostname.toLowerCase()))
  ) {
    return {
      id: 'internal',
      name: 'Dashboard / Internal',
      category: 'direct',
      color: 'bg-indigo-600',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/30',
      badgeText: 'text-indigo-700 dark:text-indigo-300',
      iconType: 'globe'
    };
  }

  // 2. Instagram
  if (
    ref.includes('instagram') ||
    ref.includes('l.instagram.com') ||
    ref.includes('ig_bio') ||
    ref.includes('com.instagram.android') ||
    ref === 'utm:instagram' ||
    ref === 'utm:ig'
  ) {
    return {
      id: 'instagram',
      name: 'Instagram',
      category: 'social',
      color: 'bg-pink-600',
      badgeBg: 'bg-pink-50 dark:bg-pink-950/30',
      badgeText: 'text-pink-700 dark:text-pink-300',
      iconType: 'social'
    };
  }

  // 3. Facebook & Messenger
  if (
    ref.includes('facebook') ||
    ref.includes('l.facebook.com') ||
    ref.includes('m.facebook.com') ||
    ref.includes('fb.me') ||
    ref.includes('fban') ||
    ref.includes('fbav') ||
    ref.includes('fb_iab') ||
    ref.includes('com.facebook.katana') ||
    ref === 'utm:facebook' ||
    ref === 'utm:fb'
  ) {
    return {
      id: 'facebook',
      name: 'Facebook',
      category: 'social',
      color: 'bg-blue-600',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/30',
      badgeText: 'text-blue-700 dark:text-blue-300',
      iconType: 'social'
    };
  }

  if (ref.includes('messenger') || ref.includes('com.facebook.orca')) {
    return {
      id: 'messenger',
      name: 'Messenger',
      category: 'messaging',
      color: 'bg-sky-500',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/30',
      badgeText: 'text-sky-700 dark:text-sky-300',
      iconType: 'messaging'
    };
  }

  // 4. X / Twitter
  if (
    ref.includes('twitter') ||
    ref.includes('t.co') ||
    ref.includes('x.com') ||
    ref.includes('twitterandroid') ||
    ref.includes('com.twitter.android') ||
    ref === 'utm:twitter' ||
    ref === 'utm:x'
  ) {
    return {
      id: 'twitter',
      name: 'X / Twitter',
      category: 'social',
      color: 'bg-neutral-900',
      badgeBg: 'bg-neutral-100 dark:bg-neutral-800',
      badgeText: 'text-neutral-800 dark:text-neutral-200',
      iconType: 'social'
    };
  }

  // 5. YouTube
  if (
    ref.includes('youtube') ||
    ref.includes('youtu.be') ||
    ref.includes('com.google.android.youtube') ||
    ref === 'utm:youtube'
  ) {
    return {
      id: 'youtube',
      name: 'YouTube',
      category: 'media',
      color: 'bg-red-600',
      badgeBg: 'bg-red-50 dark:bg-red-950/30',
      badgeText: 'text-red-700 dark:text-red-300',
      iconType: 'media'
    };
  }

  // 6. WhatsApp
  if (
    ref.includes('whatsapp') ||
    ref.includes('api.whatsapp.com') ||
    ref.includes('com.whatsapp') ||
    ref === 'utm:whatsapp'
  ) {
    return {
      id: 'whatsapp',
      name: 'WhatsApp',
      category: 'messaging',
      color: 'bg-emerald-600',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/30',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      iconType: 'messaging'
    };
  }

  // 7. Telegram
  if (
    ref.includes('telegram') ||
    ref.includes('t.me') ||
    ref.includes('org.telegram.messenger') ||
    ref === 'utm:telegram'
  ) {
    return {
      id: 'telegram',
      name: 'Telegram',
      category: 'messaging',
      color: 'bg-sky-600',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/30',
      badgeText: 'text-sky-700 dark:text-sky-300',
      iconType: 'messaging'
    };
  }

  // 8. LinkedIn
  if (
    ref.includes('linkedin') ||
    ref.includes('lnkd.in') ||
    ref.includes('linkedinapp') ||
    ref.includes('com.linkedin.android') ||
    ref === 'utm:linkedin'
  ) {
    return {
      id: 'linkedin',
      name: 'LinkedIn',
      category: 'social',
      color: 'bg-blue-700',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/30',
      badgeText: 'text-blue-800 dark:text-blue-300',
      iconType: 'social'
    };
  }

  // 9. TikTok
  if (
    ref.includes('tiktok') ||
    ref.includes('bytelocale') ||
    ref.includes('musical_ly') ||
    ref.includes('com.zhiliaoapp.musically') ||
    ref === 'utm:tiktok'
  ) {
    return {
      id: 'tiktok',
      name: 'TikTok',
      category: 'social',
      color: 'bg-neutral-900',
      badgeBg: 'bg-neutral-100 dark:bg-neutral-800',
      badgeText: 'text-neutral-800 dark:text-neutral-200',
      iconType: 'social'
    };
  }

  // 10. Reddit
  if (
    ref.includes('reddit') ||
    ref.includes('redd.it') ||
    ref.includes('com.reddit.frontpage') ||
    ref === 'utm:reddit'
  ) {
    return {
      id: 'reddit',
      name: 'Reddit',
      category: 'social',
      color: 'bg-orange-600',
      badgeBg: 'bg-orange-50 dark:bg-orange-950/30',
      badgeText: 'text-orange-700 dark:text-orange-300',
      iconType: 'social'
    };
  }

  // 11. Threads
  if (ref.includes('threads.net') || ref.includes('barcelona') || ref === 'utm:threads') {
    return {
      id: 'threads',
      name: 'Threads',
      category: 'social',
      color: 'bg-neutral-900',
      badgeBg: 'bg-neutral-100 dark:bg-neutral-800',
      badgeText: 'text-neutral-800 dark:text-neutral-200',
      iconType: 'social'
    };
  }

  // 12. Pinterest
  if (ref.includes('pinterest') || ref.includes('pin.it') || ref.includes('com.pinterest') || ref === 'utm:pinterest') {
    return {
      id: 'pinterest',
      name: 'Pinterest',
      category: 'social',
      color: 'bg-red-700',
      badgeBg: 'bg-red-50 dark:bg-red-950/30',
      badgeText: 'text-red-800 dark:text-red-300',
      iconType: 'social'
    };
  }

  // 13. Snapchat
  if (ref.includes('snapchat') || ref.includes('com.snapchat.android') || ref === 'utm:snapchat') {
    return {
      id: 'snapchat',
      name: 'Snapchat',
      category: 'social',
      color: 'bg-yellow-500',
      badgeBg: 'bg-yellow-50 dark:bg-yellow-950/30',
      badgeText: 'text-yellow-800 dark:text-yellow-300',
      iconType: 'social'
    };
  }

  // 14. Discord
  if (ref.includes('discord') || ref === 'utm:discord') {
    return {
      id: 'discord',
      name: 'Discord',
      category: 'messaging',
      color: 'bg-indigo-600',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/30',
      badgeText: 'text-indigo-700 dark:text-indigo-300',
      iconType: 'messaging'
    };
  }

  // 15. Slack
  if (ref.includes('slack') || ref === 'utm:slack') {
    return {
      id: 'slack',
      name: 'Slack',
      category: 'messaging',
      color: 'bg-purple-600',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/30',
      badgeText: 'text-purple-700 dark:text-purple-300',
      iconType: 'messaging'
    };
  }

  // 16. Google Search & Services
  if (ref.includes('google.') || ref.includes('googlequicksearchbox') || ref === 'utm:google') {
    return {
      id: 'google',
      name: 'Google Search',
      category: 'search',
      color: 'bg-blue-500',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/30',
      badgeText: 'text-blue-700 dark:text-blue-300',
      iconType: 'search'
    };
  }

  // 17. Bing Search
  if (ref.includes('bing.com') || ref === 'utm:bing') {
    return {
      id: 'bing',
      name: 'Microsoft Bing',
      category: 'search',
      color: 'bg-teal-600',
      badgeBg: 'bg-teal-50 dark:bg-teal-950/30',
      badgeText: 'text-teal-700 dark:text-teal-300',
      iconType: 'search'
    };
  }

  // 18. DuckDuckGo
  if (ref.includes('duckduckgo') || ref === 'utm:duckduckgo') {
    return {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      category: 'search',
      color: 'bg-amber-600',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/30',
      badgeText: 'text-amber-800 dark:text-amber-300',
      iconType: 'search'
    };
  }

  // 19. GitHub
  if (ref.includes('github.com') || ref === 'utm:github') {
    return {
      id: 'github',
      name: 'GitHub',
      category: 'other',
      color: 'bg-purple-700',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/30',
      badgeText: 'text-purple-800 dark:text-purple-300',
      iconType: 'globe'
    };
  }

  // 20. Substack & Newsletters
  if (ref.includes('substack') || ref === 'utm:substack' || ref === 'utm:newsletter') {
    return {
      id: 'substack',
      name: 'Substack / Newsletter',
      category: 'media',
      color: 'bg-orange-500',
      badgeBg: 'bg-orange-50 dark:bg-orange-950/30',
      badgeText: 'text-orange-700 dark:text-orange-300',
      iconType: 'media'
    };
  }

  // 21. Medium
  if (ref.includes('medium.com') || ref === 'utm:medium') {
    return {
      id: 'medium',
      name: 'Medium',
      category: 'media',
      color: 'bg-neutral-800',
      badgeBg: 'bg-neutral-100 dark:bg-neutral-800',
      badgeText: 'text-neutral-800 dark:text-neutral-200',
      iconType: 'media'
    };
  }

  // 22. Spotify
  if (ref.includes('spotify.com') || ref === 'utm:spotify') {
    return {
      id: 'spotify',
      name: 'Spotify',
      category: 'media',
      color: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/30',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      iconType: 'media'
    };
  }

  // 23. Twitch
  if (ref.includes('twitch.tv') || ref === 'utm:twitch') {
    return {
      id: 'twitch',
      name: 'Twitch',
      category: 'media',
      color: 'bg-purple-600',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/30',
      badgeText: 'text-purple-700 dark:text-purple-300',
      iconType: 'media'
    };
  }

  // 24. Amazon
  if (ref.includes('amazon') || ref.includes('amzn.to') || ref === 'utm:amazon') {
    return {
      id: 'amazon',
      name: 'Amazon',
      category: 'other',
      color: 'bg-amber-600',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/30',
      badgeText: 'text-amber-800 dark:text-amber-300',
      iconType: 'globe'
    };
  }

  // 25. Check against PLATFORM_REGISTRY (150+ AppInRouter platforms)
  for (const plat of PLATFORM_REGISTRY) {
    if (plat.domains && plat.domains.some(d => ref.includes(d.toLowerCase()))) {
      return {
        id: plat.app,
        name: plat.appName,
        category: 'other',
        color: 'bg-primary-container',
        badgeBg: 'bg-surface-container-high',
        badgeText: 'text-on-surface',
        iconType: 'globe'
      };
    }
  }

  // 26. Dynamic Fallback: Clean Hostname from URL
  try {
    const urlObj = new URL(ref.startsWith('http') ? ref : `https://${ref}`);
    const host = urlObj.hostname.replace(/^www\./, '');
    const cleanName = host.split('.')[0];
    const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    return {
      id: cleanName.toLowerCase(),
      name: capitalized,
      category: 'other',
      color: 'bg-primary-container',
      badgeBg: 'bg-surface-container-high',
      badgeText: 'text-on-surface',
      iconType: 'globe'
    };
  } catch {
    // If destination URL is provided, detect based on destination
    if (destinationUrl) {
      for (const plat of PLATFORM_REGISTRY) {
        if (plat.domains && plat.domains.some(d => destinationUrl.toLowerCase().includes(d.toLowerCase()))) {
          return {
            id: plat.app,
            name: `${plat.appName} (Destination)`,
            category: 'other',
            color: 'bg-primary-container',
            badgeBg: 'bg-surface-container-high',
            badgeText: 'text-on-surface',
            iconType: 'globe'
          };
        }
      }
    }

    return {
      id: 'other',
      name: 'External Web Referral',
      category: 'other',
      color: 'bg-primary-container',
      badgeBg: 'bg-surface-container-high',
      badgeText: 'text-on-surface',
      iconType: 'globe'
    };
  }
}
