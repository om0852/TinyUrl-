import React from 'react';
import { sql } from '@/lib/postgres';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Link2, TrendingUp, CheckCircle, ArrowLeft } from 'lucide-react';

interface CampaignPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignHubPage({ params }: CampaignPageProps) {
  const { id } = await params;
  const cleanId = (id || '').trim();

  let campaign: any = null;
  let campaignLinks: any[] = [];

  try {
    const campRows = (await sql.query(
      `SELECT * FROM campaigns WHERE id = $1 LIMIT 1`,
      [cleanId]
    )) as any[];

    if (campRows && campRows.length > 0) {
      campaign = campRows[0];
    }

    const linkRows = (await sql.query(
      `SELECT * FROM links WHERE campaign_id = $1 ORDER BY clicks_count DESC`,
      [cleanId]
    )) as any[];

    if (linkRows) {
      campaignLinks = linkRows;
    }
  } catch (err) {
    console.warn('Error reading campaign from DB:', err);
  }

  // If there is exactly one link attached, redirect directly to it
  if (campaignLinks.length === 1 && (campaignLinks[0].short_code || campaignLinks[0].custom_slug)) {
    const slug = campaignLinks[0].custom_slug || campaignLinks[0].short_code;
    redirect(`/${slug}`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-xl bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
            <Link2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/10">
                Campaign Deliverables
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground truncate mt-1">
              {campaign?.name || 'Campaign Hub'}
            </h1>
          </div>
        </div>

        {campaign?.description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {campaign.description}
          </p>
        )}

        {/* Links List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
            <span>Attached Assets &amp; Deliverables</span>
            <span>{campaignLinks.length} Link{campaignLinks.length !== 1 ? 's' : ''}</span>
          </div>

          {campaignLinks.length === 0 ? (
            <div className="p-8 text-center bg-muted/30 rounded-2xl border border-dashed border-border/70 space-y-2">
              <p className="text-xs font-semibold text-foreground">No links attached to this campaign yet.</p>
              <p className="text-[11px] text-muted-foreground">
                Links tagged or assigned to this campaign will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {campaignLinks.map((link) => {
                const slug = link.custom_slug || link.short_code;
                return (
                  <a
                    key={link.id}
                    href={`/${slug}`}
                    className="flex items-center justify-between p-4 bg-muted/40 hover:bg-muted/70 rounded-2xl border border-border/60 transition group cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-bold text-foreground group-hover:text-primary transition truncate">
                        {link.title || `/${slug}`}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                        {link.destination_url}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-semibold text-muted-foreground hidden sm:inline">
                        {(link.clicks_count || 0).toLocaleString()} clicks
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center text-foreground group-hover:text-primary border border-border/60">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1.5 hover:text-foreground transition font-medium">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="font-mono text-[11px]">Powered by TinyUrl</span>
        </div>

      </div>
    </div>
  );
}
