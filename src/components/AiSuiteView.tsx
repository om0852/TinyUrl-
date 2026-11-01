'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/storeContext';
import { useToast } from '@/components/ui/ToastHub';
import { SkeletonGenericView } from '@/components/ui';
import { RESERVED_SLUGS } from '@/lib/db';
import { ClickEvent } from '@/lib/types';
import {
  Wand2,
  Check,
  Copy,
  MousePointerClick,
  Users,
  Smartphone,
  Globe2,
  Lightbulb
} from 'lucide-react';

type Tone = 'short' | 'deal' | 'creator' | 'launch';

const STOP_WORDS = new Set(['products', 'product', 'shop', 'store', 'item', 'page', 'https', 'http', 'www', 'com', 'net', 'org', 'html', 'php', 'index', 'and', 'the', 'for', 'with', 'your', 'from', 'utm', 'ref', 'source', 'medium', 'campaign']);

// Keyword-based slug ideas. Runs in the browser from the URL and title; no data leaves the page.
function suggestSlugs(url: string, title: string, tone: Tone): string[] {
  // Title words first, then the page path, then the site name
  const text = `${title} ${(() => { try { const u = new URL(url); return `${u.pathname} ${u.hostname.replace(/^www\./, '').split('.')[0]}`; } catch { return url; } })()}`;
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  const unique = [...new Set(words)];
  const [a = 'link', b = 'go', c = ''] = unique;
  const year = String(new Date().getFullYear()).slice(2);
  const byTone: Record<Tone, string[]> = {
    short: [a.slice(0, 8), `${a.slice(0, 4)}${b.slice(0, 3)}`, `${a}${year}`, `${a}-${b}`],
    deal: [`${a}-deal`, `save-${a}`, `${a}-offer`, `${a}-${b}-deal`],
    creator: [`my-${a}`, `${a}-pick`, `${a}-${b}`, `get-${a}`],
    launch: [`${a}-launch`, `new-${a}`, `${a}-${year}`, c ? `${a}-${c}` : `try-${a}`],
  };
  return [...new Set(byTone[tone].map(s => s.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32)))]
    .filter(s => s.length >= 3);
}

function topEntry(counts: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  counts.forEach((n, k) => { if (!best || n > best[1]) best = [k, n]; });
  return best;
}

function sourceOf(c: ClickEvent): string {
  if (c.utm_source) return c.utm_source.toLowerCase();
  const ref = (c.referrer || '').toLowerCase();
  if (!ref || ref === 'direct') return 'direct';
  try { return new URL(ref.includes('://') ? ref : `https://${ref}`).hostname.replace(/^www\./, '').replace(/^(l|m|lm)\./, ''); } catch { return ref; }
}

export const AiSuiteView: React.FC = () => {
  const { links, clicks, createShortLink, refreshLinks, refreshAnalytics, isInitialLoading, isLinksLoading } = useStore();
  const { showToast } = useToast();

  useEffect(() => {
    refreshLinks();
    refreshAnalytics();
  }, [refreshLinks, refreshAnalytics]);

  const [inputUrl, setInputUrl] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [tone, setTone] = useState<Tone>('short');
  const [slugIdeas, setSlugIdeas] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  // Reference time for the 7-day comparison, fixed when the page opens
  const [now] = useState(() => Date.now());

  const takenSlugs = useMemo(() => new Set(links.flatMap(l => [l.short_code, l.custom_slug].filter(Boolean).map(s => String(s).toLowerCase()))), [links]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    setSlugIdeas(suggestSlugs(inputUrl.trim(), inputTitle.trim(), tone));
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const createWithSlug = (slug: string) => {
    const result = createShortLink({ destination_url: inputUrl.trim(), custom_slug: slug, title: inputTitle.trim() || undefined });
    if (result.error || !result.link) {
      showToast('error', 'Link not created', result.error || 'Please try again.');
      return;
    }
    setCreated(slug);
    showToast('success', 'Link created', `/${slug}`);
  };

  // Everything below comes from this workspace's links and the recent clicks the app loaded
  const insights = useMemo(() => {
    const totalClicks = links.reduce((sum, l) => sum + (l.clicks_count || 0), 0);
    const human = clicks.filter(c => !c.is_bot);
    const n = human.length;
    const pct = (k: number) => (n ? Math.round((k / n) * 100) : 0);

    const countBy = (key: (c: ClickEvent) => string | undefined) => {
      const m = new Map<string, number>();
      human.forEach(c => { const k = key(c); if (k && k !== 'Unknown') m.set(k, (m.get(k) || 0) + 1); });
      return m;
    };
    const topCountry = topEntry(countBy(c => c.country));
    const topSource = topEntry(countBy(sourceOf));
    const topHour = topEntry(countBy(c => (c.timestamp ? String(new Date(c.timestamp).getHours()) : undefined)));
    const inAppShare = pct(human.filter(c => c.browser === 'In-App' || /instagram|fbav|fban|tiktok|snapchat/i.test(c.user_agent || '')).length);
    const mobileShare = pct(human.filter(c => c.device === 'mobile').length);
    const uniqueShare = pct(human.filter(c => c.is_unique).length);
    const botShare = clicks.length ? Math.round(((clicks.length - n) / clicks.length) * 100) : 0;

    const day = 86400000;
    const last7 = human.filter(c => now - new Date(c.timestamp).getTime() < 7 * day).length;
    const prev7 = human.filter(c => { const age = now - new Date(c.timestamp).getTime(); return age >= 7 * day && age < 14 * day; }).length;

    const topLink = [...links].sort((a, b) => (b.clicks_count || 0) - (a.clicks_count || 0))[0];
    const httpLinks = links.filter(l => /^http:/i.test(l.destination_url)).length;
    const noDeepLink = links.filter(l => !l.deep_link?.enabled).length;

    const tips: string[] = [];
    if (n >= 10 && mobileShare >= 60) tips.push(`${mobileShare}% of recent clicks are on phones. Check that your landing pages load quickly on mobile.`);
    if (n >= 10 && inAppShare >= 20 && noDeepLink > 0) tips.push(`${inAppShare}% of clicks open inside social apps. Turn on OpeninApp for those links so they open in the native app or browser.`);
    if (topHour && n >= 20) tips.push(`Most clicks come around ${Number(topHour[0]) % 12 || 12}${Number(topHour[0]) < 12 ? ' am' : ' pm'}. Post or send just before then.`);
    if (topSource && topSource[0] !== 'direct' && n >= 10) tips.push(`${topSource[0]} sends the most traffic (${pct(topSource[1])}%). Add UTM tags to links you share there to compare posts.`);
    if (httpLinks > 0) tips.push(`${httpLinks} ${httpLinks === 1 ? 'link points' : 'links point'} to plain HTTP pages. Switch to HTTPS where the site supports it.`);
    if (botShare >= 15) tips.push(`${botShare}% of recent clicks were bots and are left out of these numbers.`);

    const summary = n === 0
      ? ''
      : [
          `${totalClicks.toLocaleString()} total clicks across ${links.length} ${links.length === 1 ? 'link' : 'links'}.`,
          `Of the last ${n} human clicks: ${uniqueShare}% unique visitors, ${mobileShare}% on mobile${topCountry ? `, most from ${topCountry[0]}` : ''}${topSource ? `, top source ${topSource[0]}` : ''}.`,
          prev7 > 0 ? `Last 7 days: ${last7} clicks, ${last7 >= prev7 ? 'up' : 'down'} ${Math.abs(Math.round(((last7 - prev7) / prev7) * 100))}% on the week before.` : last7 > 0 ? `Last 7 days: ${last7} clicks.` : '',
          topLink && topLink.clicks_count ? `Top link: /${topLink.short_code} (${topLink.clicks_count.toLocaleString()} clicks).` : '',
        ].filter(Boolean).join(' ');

    return { totalClicks, n, uniqueShare, mobileShare, topCountry, topSource, tips, summary };
  }, [links, clicks, now]);

  if ((isInitialLoading || isLinksLoading) && links.length === 0) {
    return <SkeletonGenericView title="Insights" />;
  }

  const iconBtn = 'size-[30px] rounded-md grid place-items-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer';

  return (
    <div className="flex flex-col w-full gap-[15px] pb-16 animate-fade-in text-on-surface">

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[15px]">
        {[
          { icon: <MousePointerClick className="w-5 h-5" />, value: insights.totalClicks.toLocaleString(), label: 'Clicks', hint: `${links.length} ${links.length === 1 ? 'link' : 'links'}` },
          { icon: <Users className="w-5 h-5" />, value: insights.n ? `${insights.uniqueShare}%` : '—', label: 'Unique visitors', hint: insights.n ? `Last ${insights.n} clicks` : 'No clicks yet' },
          { icon: <Smartphone className="w-5 h-5" />, value: insights.n ? `${insights.mobileShare}%` : '—', label: 'On mobile', hint: insights.n ? `Last ${insights.n} clicks` : 'No clicks yet' },
          { icon: <Globe2 className="w-5 h-5" />, value: insights.topSource?.[0] || '—', label: 'Top source', hint: insights.topCountry ? `Most from ${insights.topCountry[0]}` : 'No clicks yet' },
        ].map(card => (
          <div key={card.label} className="flex items-center gap-[10px] rounded-xl border-[0.5px] border-outline-variant p-[15px] min-w-0">
            <div className="grid size-[40px] place-items-center rounded-md bg-surface-container text-on-surface-variant shrink-0">{card.icon}</div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-on-surface truncate" title={card.value}>{card.value}</div>
              <p className="text-xs text-outline truncate">{card.label} · {card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[15px] items-start">

        {/* Slug ideas */}
        <div className="lg:col-span-7 rounded-xl border-[0.5px] border-outline-variant p-[15px] flex flex-col gap-3">
          <h2 className="text-[14px] font-semibold text-on-surface">Slug ideas</h2>
          <form onSubmit={handleGenerate} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-on-surface-variant">Destination URL</span>
                <input
                  type="url"
                  required
                  value={inputUrl}
                  onChange={(e) => { setInputUrl(e.target.value); setCreated(null); }}
                  placeholder="https://example.com/product"
                  className="h-[34px] px-3 bg-surface-container-low rounded-md text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-on-surface-variant">Title <span className="text-outline">(optional)</span></span>
                <input
                  type="text"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  placeholder="e.g. Spring headphones sale"
                  className="h-[34px] px-3 bg-surface-container-low rounded-md text-xs text-on-surface border-[0.5px] border-outline-variant outline-none focus:border-on-surface-variant"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex p-[3px] bg-surface-container rounded-md text-xs" role="tablist" aria-label="Style">
                {([
                  { id: 'short', label: 'Short' },
                  { id: 'deal', label: 'Deal' },
                  { id: 'creator', label: 'Creator' },
                  { id: 'launch', label: 'Launch' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tone === t.id}
                    onClick={() => { setTone(t.id); if (inputUrl.trim()) setSlugIdeas(suggestSlugs(inputUrl.trim(), inputTitle.trim(), t.id)); }}
                    className={`h-[26px] px-3 rounded-[4px] transition-colors cursor-pointer ${
                      tone === t.id ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="submit" className="h-[34px] px-4 rounded-md bg-primary-container text-on-primary text-xs font-medium hover:bg-primary transition-colors cursor-pointer flex items-center gap-1.5">
                <Wand2 className="w-4 h-4" />
                <span>Suggest slugs</span>
              </button>
            </div>
          </form>

          {slugIdeas.length > 0 && (
            <div className="flex flex-col border-t-[0.5px] border-outline-variant pt-1">
              {slugIdeas.map(slug => {
                const taken = takenSlugs.has(slug) || RESERVED_SLUGS.has(slug);
                return (
                  <div key={slug} className="flex items-center gap-2 py-2 border-b-[0.5px] border-outline-variant last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-on-surface">/{slug}</span>
                      <span className="text-[11px] text-outline"> · {slug.length} characters{taken ? ' · taken' : ''}</span>
                    </div>
                    <button type="button" onClick={() => copy(slug, slug)} title="Copy slug" aria-label={`Copy ${slug}`} className={iconBtn}>
                      {copied === slug ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => createWithSlug(slug)}
                      disabled={taken || created === slug}
                      className="h-[30px] px-3 rounded-md border-[0.5px] border-outline-variant text-xs text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {created === slug ? 'Created' : 'Create link'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Traffic summary + tips */}
        <div className="lg:col-span-5 flex flex-col gap-[15px]">
          <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-semibold text-on-surface">Traffic summary</h2>
              {insights.summary && (
                <button type="button" onClick={() => copy(insights.summary, 'summary')} title="Copy summary" aria-label="Copy summary" className={iconBtn}>
                  {copied === 'summary' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">
              {insights.summary || 'No clicks yet. Share a link and the summary fills in here.'}
            </p>
          </div>

          <div className="rounded-xl border-[0.5px] border-outline-variant p-[15px]">
            <h2 className="text-[14px] font-semibold text-on-surface">Tips</h2>
            {insights.tips.length === 0 ? (
              <p className="mt-2 text-xs text-on-surface-variant">Nothing to suggest yet. Tips appear once there’s enough click data.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {insights.tips.map(tip => (
                  <li key={tip} className="flex items-start gap-2 text-xs text-on-surface-variant">
                    <Lightbulb className="w-3.5 h-3.5 text-primary-ink shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
