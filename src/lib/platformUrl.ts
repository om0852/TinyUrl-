// The deployed product. "Go to dashboard" style buttons point here from any host (custom domains,
// vercel.app aliases), so visitors always land on the real platform. Override with
// NEXT_PUBLIC_PLATFORM_URL if the product moves.
export const PLATFORM_URL = (process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://link.grabormiss.com').replace(/\/+$/, '');
