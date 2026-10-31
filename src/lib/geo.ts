import { LinkRule } from './types';

export interface VisitorGeoInfo {
  countryCode: string;
  countryName: string;
  regionCode: string;
  regionName: string;
  city: string;
}

export const COMMON_COUNTRIES: Record<string, string> = {
  'IN': 'India',
  'US': 'United States',
  'GB': 'United Kingdom',
  'UK': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'AE': 'United Arab Emirates',
  'SG': 'Singapore',
  'JP': 'Japan',
  'CN': 'China',
  'BR': 'Brazil',
  'RU': 'Russia',
  'ZA': 'South Africa',
  'NZ': 'New Zealand',
  'NL': 'Netherlands',
  'IT': 'Italy',
  'ES': 'Spain',
  'MX': 'Mexico',
  'ID': 'Indonesia',
  'MY': 'Malaysia',
  'PH': 'Philippines',
  'VN': 'Vietnam',
  'TH': 'Thailand',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'NP': 'Nepal',
  'LK': 'Sri Lanka'
};

export const INDIAN_STATES: Record<string, string> = {
  'AP': 'Andhra Pradesh',
  'AR': 'Arunachal Pradesh',
  'AS': 'Assam',
  'BR': 'Bihar',
  'CG': 'Chhattisgarh',
  'CT': 'Chhattisgarh',
  'GA': 'Goa',
  'GJ': 'Gujarat',
  'HR': 'Haryana',
  'HP': 'Himachal Pradesh',
  'JH': 'Jharkhand',
  'KA': 'Karnataka',
  'KL': 'Kerala',
  'MP': 'Madhya Pradesh',
  'MH': 'Maharashtra',
  'MN': 'Manipur',
  'ML': 'Meghalaya',
  'MZ': 'Mizoram',
  'NL': 'Nagaland',
  'OD': 'Odisha',
  'OR': 'Odisha',
  'PB': 'Punjab',
  'RJ': 'Rajasthan',
  'SK': 'Sikkim',
  'TN': 'Tamil Nadu',
  'TG': 'Telangana',
  'TS': 'Telangana',
  'TR': 'Tripura',
  'UP': 'Uttar Pradesh',
  'UT': 'Uttarakhand',
  'UK': 'Uttarakhand',
  'WB': 'West Bengal',
  // Union Territories
  'AN': 'Andaman and Nicobar Islands',
  'CH': 'Chandigarh',
  'DH': 'Dadra and Nagar Haveli and Daman and Diu',
  'DD': 'Daman and Diu',
  'DN': 'Dadra and Nagar Haveli',
  'DL': 'Delhi',
  'JK': 'Jammu and Kashmir',
  'LA': 'Ladakh',
  'LD': 'Lakshadweep',
  'PY': 'Puducherry'
};

export const US_STATES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

type HeaderGetter = (name: string) => string | null | undefined;

// Headers set by our own edge proxy (Caddy) in front of Vercel. Vercel geolocates the
// connecting IP and overwrites X-Forwarded-For, so behind Caddy every x-vercel-ip-* value
// describes the Caddy VM instead of the visitor. These are only honoured when the shared
// secret matches EDGE_PROXY_SECRET, otherwise anyone could spoof their location/IP.
const EDGE_PROXY_SECRET_HEADER = 'x-edge-proxy-secret';
const EDGE_CLIENT_IP_HEADER = 'x-client-ip';
const EDGE_CLIENT_COUNTRY_HEADER = 'x-client-country';
const EDGE_CLIENT_REGION_HEADER = 'x-client-region';
const EDGE_CLIENT_CITY_HEADER = 'x-client-city';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns true when the request was forwarded by our own edge proxy (verified via shared secret).
 * Always false when EDGE_PROXY_SECRET is not configured, so default behaviour is unchanged.
 */
export function isTrustedEdgeProxyRequest(getHeader: HeaderGetter): boolean {
  const secret = (typeof process !== 'undefined' && process.env?.EDGE_PROXY_SECRET) || '';
  if (!secret) return false;
  const provided = (getHeader(EDGE_PROXY_SECRET_HEADER) || '').trim();
  return !!provided && constantTimeEqual(provided, secret);
}

/**
 * Real visitor IP as reported by our trusted edge proxy, or null when the request
 * did not come through it (callers keep their existing IP detection in that case).
 */
export function getTrustedEdgeClientIp(getHeader: HeaderGetter): string | null {
  if (!isTrustedEdgeProxyRequest(getHeader)) return null;
  const ip = (getHeader(EDGE_CLIENT_IP_HEADER) || '').split(',')[0].trim();
  return ip || null;
}

/**
 * Extracts and normalizes country, state/region, and city information from incoming request headers.
 */
export function extractGeoFromHeaders(getHeader: HeaderGetter): VisitorGeoInfo {
  let rawCountry: string;
  let rawRegion: string;
  let rawCity: string;

  if (isTrustedEdgeProxyRequest(getHeader)) {
    // Never fall back to x-vercel-ip-* here: behind the proxy those describe the proxy VM.
    rawCountry = (getHeader(EDGE_CLIENT_COUNTRY_HEADER) || '').trim();
    rawRegion = (getHeader(EDGE_CLIENT_REGION_HEADER) || '').trim();
    rawCity = (getHeader(EDGE_CLIENT_CITY_HEADER) || '').trim();
    // GeoIP modules emit placeholders like "!", "No Country" or "No City" when the IP is unknown
    if (!/^[A-Za-z]{2}$/.test(rawCountry)) rawCountry = '';
    if (/^no\s+(city|region|state)$/i.test(rawCity) || rawCity === '!') rawCity = '';
    if (/^no\s+(city|region|state)$/i.test(rawRegion) || rawRegion === '!') rawRegion = '';
  } else {
    rawCountry = getHeader('x-vercel-ip-country') || getHeader('cf-ipcountry') || '';
    rawRegion = getHeader('x-vercel-ip-country-region') || getHeader('cf-region') || '';
    rawCity = getHeader('x-vercel-ip-city') || getHeader('cf-ipcity') || '';
  }

  const countryCode = rawCountry.trim().toUpperCase();
  let countryName = '';
  if (countryCode) {
    if (COMMON_COUNTRIES[countryCode]) {
      countryName = COMMON_COUNTRIES[countryCode];
    } else {
      try {
        const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
        countryName = regionNames.of(countryCode) || countryCode;
      } catch {
        countryName = countryCode;
      }
    }
  }

  // Vercel/Cloudflare send ISO subdivision codes ("MH"); some GeoIP proxies send full names ("Maharashtra")
  let decodedRegion = rawRegion.trim();
  try {
    decodedRegion = decodeURIComponent(decodedRegion);
  } catch {}
  const isRegionFullName = decodedRegion.length > 3;
  const regionCode = isRegionFullName ? '' : decodedRegion.toUpperCase();
  let regionName = '';
  if (isRegionFullName) {
    regionName = decodedRegion;
  } else if (countryCode === 'IN' && INDIAN_STATES[regionCode]) {
    regionName = INDIAN_STATES[regionCode];
  } else if (countryCode === 'US' && US_STATES[regionCode]) {
    regionName = US_STATES[regionCode];
  } else {
    regionName = regionCode;
  }

  let city = '';
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).trim();
    } catch {
      city = rawCity.trim();
    }
  }

  return {
    countryCode,
    countryName,
    regionCode,
    regionName,
    city
  };
}

/**
 * Evaluates whether a rule matches the incoming visitor and calculates a specificity score.
 * Higher specificity means more criteria were matched.
 */
export function evaluateRuleMatch(
  rule: LinkRule,
  geo: VisitorGeoInfo,
  userAgent: string
): { isMatch: boolean; score: number } {
  const ua = userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid;
  const isDesktop = !isMobile;

  let score = 0;
  let hasAnyFilter = false;

  // 1. Device match evaluation
  const targetDevice = (rule.device || (rule.rule_type === 'device' ? rule.condition?.toLowerCase() : 'all')).trim();
  if (targetDevice && targetDevice !== 'all') {
    hasAnyFilter = true;
    if (targetDevice === 'android') {
      if (!isAndroid) return { isMatch: false, score: 0 };
      score += 20;
    } else if (targetDevice === 'ios') {
      if (!isIOS) return { isMatch: false, score: 0 };
      score += 20;
    } else if (targetDevice === 'desktop') {
      if (!isDesktop) return { isMatch: false, score: 0 };
      score += 20;
    }
  }

  // 2. City match evaluation
  const targetCity = (rule.city || (rule.rule_type === 'geo' && rule.geo_type === 'city' ? rule.condition : '')).trim().toLowerCase();
  if (targetCity) {
    hasAnyFilter = true;
    const vCity = (geo.city || '').trim().toLowerCase();
    if (!vCity) return { isMatch: false, score: 0 };
    const cityMatches = vCity === targetCity || vCity.includes(targetCity) || targetCity.includes(vCity);
    if (!cityMatches) return { isMatch: false, score: 0 };
    score += 100;
  }

  // 3. State / Region match evaluation
  const targetState = (rule.state || (rule.rule_type === 'geo' && rule.geo_type === 'state' ? rule.condition : '')).trim().toLowerCase();
  if (targetState) {
    hasAnyFilter = true;
    const vRegionName = (geo.regionName || '').trim().toLowerCase();
    const vRegionCode = (geo.regionCode || '').trim().toLowerCase();
    const stateMatches =
      (vRegionCode && targetState === vRegionCode) ||
      (vRegionName && (targetState === vRegionName || vRegionName.includes(targetState) || targetState.includes(vRegionName))) ||
      (INDIAN_STATES[targetState.toUpperCase()] && INDIAN_STATES[targetState.toUpperCase()].toLowerCase() === vRegionName) ||
      (US_STATES[targetState.toUpperCase()] && US_STATES[targetState.toUpperCase()].toLowerCase() === vRegionName);
    if (!stateMatches) return { isMatch: false, score: 0 };
    score += 50;
  }

  // 4. Country match evaluation
  const targetCountry = (rule.country || (rule.rule_type === 'geo' && (!rule.geo_type || rule.geo_type === 'country') ? rule.condition : '')).trim().toLowerCase();
  if (targetCountry) {
    hasAnyFilter = true;
    const vCountryCode = (geo.countryCode || '').trim().toLowerCase();
    const vCountryName = (geo.countryName || '').trim().toLowerCase();
    const countryMatches =
      (vCountryCode && targetCountry === vCountryCode) ||
      (vCountryName && (targetCountry === vCountryName || vCountryName.includes(targetCountry) || targetCountry.includes(vCountryName))) ||
      (COMMON_COUNTRIES[targetCountry.toUpperCase()] && COMMON_COUNTRIES[targetCountry.toUpperCase()].toLowerCase() === vCountryName);
    if (!countryMatches) return { isMatch: false, score: 0 };
    score += 25;
  }

  // 5. Fallback for legacy rules without explicit multi-fields
  if (!hasAnyFilter) {
    if (rule.rule_type === 'device') {
      const cond = rule.condition?.toLowerCase();
      if ((cond === 'android' && isAndroid) || (cond === 'ios' && isIOS) || (cond === 'all' && isMobile)) {
        return { isMatch: true, score: 10 };
      }
      return { isMatch: false, score: 0 };
    }
    if (rule.rule_type === 'geo') {
      const cond = rule.condition?.trim().toLowerCase();
      const vCity = (geo.city || '').trim().toLowerCase();
      const vRegion = (geo.regionName || '').trim().toLowerCase();
      const vCountry = (geo.countryCode || '').trim().toLowerCase();
      if (vCity && (vCity === cond || vCity.includes(cond))) return { isMatch: true, score: 100 };
      if (vRegion && (vRegion === cond || vRegion.includes(cond))) return { isMatch: true, score: 50 };
      if (vCountry && (vCountry === cond || vCountry.includes(cond))) return { isMatch: true, score: 25 };
      return { isMatch: false, score: 0 };
    }
  }

  return { isMatch: score > 0, score };
}

/**
 * Evaluates smart location routing rules against the visitor's detected country, region, and city.
 */
export function matchGeoRule(rules: LinkRule[], geo: VisitorGeoInfo): LinkRule | null {
  if (!rules || rules.length === 0) return null;
  const candidates = rules
    .filter(r => r.target_url && (r.country || r.state || r.city || r.rule_type === 'geo'))
    .map(r => {
      const { isMatch, score } = evaluateRuleMatch(r, geo, '');
      return { rule: r, isMatch, score };
    })
    .filter(c => c.isMatch)
    .sort((a, b) => b.score - a.score);

  return candidates.length > 0 ? candidates[0].rule : null;
}

/**
 * Resolves the ultimate destination URL taking into account combined Location (City > State > Country),
 * Device rules (Android / iOS / Desktop), and A/B Split Testing.
 */
export function resolveSmartTargetUrl({
  rules,
  defaultUrl,
  userAgent,
  geo,
  abVariant
}: {
  rules?: LinkRule[] | null;
  defaultUrl: string;
  userAgent?: string;
  geo?: VisitorGeoInfo | null;
  abVariant?: 'A' | 'B' | null;
}): string {
  if (!rules || rules.length === 0) {
    return defaultUrl;
  }

  const visitorGeo = geo || { countryCode: '', countryName: '', regionCode: '', regionName: '', city: '' };
  const visitorUa = userAgent || '';

  // 1. Evaluate all smart candidate rules and pick highest specificity match
  const candidateRules = rules
    .filter(r => r.rule_type !== 'ab' && r.target_url)
    .map(r => {
      const { isMatch, score } = evaluateRuleMatch(r, visitorGeo, visitorUa);
      return { rule: r, isMatch, score };
    })
    .filter(c => c.isMatch)
    .sort((a, b) => b.score - a.score);

  if (candidateRules.length > 0) {
    return candidateRules[0].rule.target_url;
  }

  // 2. Check A/B Testing Rule
  const abRule = rules.find(r => r.rule_type === 'ab' && r.target_url);
  if (abRule && abRule.target_url) {
    if (abVariant === 'B') {
      return abRule.target_url;
    }
    if (abVariant === 'A') {
      return defaultUrl;
    }
    const weight = abRule.weight ?? 50;
    const isB = Math.random() * 100 < weight;
    return isB ? abRule.target_url : defaultUrl;
  }

  return defaultUrl;
}
