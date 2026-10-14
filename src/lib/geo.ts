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

/**
 * Extracts and normalizes country, state/region, and city information from incoming request headers.
 */
export function extractGeoFromHeaders(getHeader: (name: string) => string | null | undefined): VisitorGeoInfo {
  const rawCountry = getHeader('x-vercel-ip-country') || getHeader('cf-ipcountry') || '';
  const rawRegion = getHeader('x-vercel-ip-country-region') || getHeader('cf-region') || '';
  const rawCity = getHeader('x-vercel-ip-city') || getHeader('cf-ipcity') || '';

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

  const regionCode = rawRegion.trim().toUpperCase();
  let regionName = '';
  if (countryCode === 'IN' && INDIAN_STATES[regionCode]) {
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
 * Evaluates smart location routing rules against the visitor's detected country, region, and city.
 * Hierarchy: City (Highest specificity) -> State / Region -> Country
 */
export function matchGeoRule(rules: LinkRule[], geo: VisitorGeoInfo): LinkRule | null {
  if (!rules || rules.length === 0) return null;
  const geoRules = rules.filter(r => r.rule_type === 'geo' && r.target_url && r.condition);
  if (geoRules.length === 0) return null;

  const normalizedCity = (geo.city || '').toLowerCase().trim();
  const normalizedRegionName = (geo.regionName || '').toLowerCase().trim();
  const normalizedRegionCode = (geo.regionCode || '').toLowerCase().trim();
  const normalizedCountryCode = (geo.countryCode || '').toLowerCase().trim();
  const normalizedCountryName = (geo.countryName || '').toLowerCase().trim();

  // 1. City Level Matching (Highest Specificity)
  if (normalizedCity) {
    const cityRule = geoRules.find(r => {
      if (r.geo_type && r.geo_type !== 'city') return false;
      const cond = r.condition.toLowerCase().trim();
      return (
        cond === normalizedCity ||
        normalizedCity.includes(cond) ||
        cond.includes(normalizedCity)
      );
    });
    if (cityRule) return cityRule;
  }

  // 2. State / Region Level Matching
  if (normalizedRegionName || normalizedRegionCode) {
    const stateRule = geoRules.find(r => {
      if (r.geo_type && r.geo_type !== 'state') return false;
      const cond = r.condition.toLowerCase().trim();
      return (
        (normalizedRegionCode && cond === normalizedRegionCode) ||
        (normalizedRegionName && (cond === normalizedRegionName || normalizedRegionName.includes(cond) || cond.includes(normalizedRegionName))) ||
        (INDIAN_STATES[cond.toUpperCase()] && INDIAN_STATES[cond.toUpperCase()].toLowerCase() === normalizedRegionName) ||
        (US_STATES[cond.toUpperCase()] && US_STATES[cond.toUpperCase()].toLowerCase() === normalizedRegionName)
      );
    });
    if (stateRule) return stateRule;
  }

  // 3. Country Level Matching
  if (normalizedCountryCode || normalizedCountryName) {
    const countryRule = geoRules.find(r => {
      if (r.geo_type && r.geo_type !== 'country') return false;
      const cond = r.condition.toLowerCase().trim();
      return (
        (normalizedCountryCode && cond === normalizedCountryCode) ||
        (normalizedCountryName && (cond === normalizedCountryName || normalizedCountryName.includes(cond) || cond.includes(normalizedCountryName))) ||
        (COMMON_COUNTRIES[cond.toUpperCase()] && COMMON_COUNTRIES[cond.toUpperCase()].toLowerCase() === normalizedCountryName)
      );
    });
    if (countryRule) return countryRule;
  }

  return null;
}

/**
 * Resolves the ultimate destination URL taking into account Location rules (City > State > Country),
 * Device rules (Android / iOS), and A/B Split Testing.
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

  // 1. Check Location / Geo Rules (City > State > Country)
  if (geo) {
    const matchedGeo = matchGeoRule(rules, geo);
    if (matchedGeo && matchedGeo.target_url) {
      return matchedGeo.target_url;
    }
  }

  // 2. Check Device Rules (Android / iOS)
  const ua = userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const deviceRule = rules.find(r => 
    r.rule_type === 'device' && r.target_url && (
      (r.condition?.toLowerCase() === 'android' && isAndroid) ||
      (r.condition?.toLowerCase() === 'ios' && isIOS) ||
      (r.condition?.toLowerCase() === 'all' && (isIOS || isAndroid))
    )
  );

  if (deviceRule && deviceRule.target_url) {
    return deviceRule.target_url;
  }

  // 3. Check A/B Testing Rule
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
