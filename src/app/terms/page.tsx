import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata = {
  title: 'Terms & Conditions | TrimLink Platform',
  description: 'Terms of Service and Acceptable Use Policy for TrimLink URL Shortener Platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto glass-panel p-8 md:p-12 rounded-2xl border border-white/10 space-y-8">
        
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Terms & Conditions</h1>
              <p className="text-xs text-slate-400">Effective Date: October 10, 2026</p>
            </div>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Platform
          </Link>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Acceptable Use Policy</h2>
            <p>
              By using TrimLink, you agree to generate short links exclusively for lawful purposes. You must not create short links targeting malicious software, phishing pages, deceptive spam campaigns, unauthorized malware downloads, or illegal content.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. Abuse Prevention & Account Suspension</h2>
            <p>
              TrimLink enforces continuous automated security scanning. Any link detected or reported as abusive, malicious, or phishing will be disabled immediately without prior notice. Repeat violators will have their accounts and workspaces permanently terminated.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. Custom Branded Domains</h2>
            <p>
              Users connecting custom branded domains (`go.client.com`) must maintain valid DNS CNAME routing and ownership records. TrimLink is not responsible for link resolution failures caused by improper DNS record changes on client servers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">4. SLA & Uptime Guarantee</h2>
            <p>
              We strive to maintain 99.99% redirect service availability across our global edge cache infrastructure. However, TrimLink does not assume liability for temporary disruptions caused by third-party upstream DNS providers or internet backbone connectivity issues.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">5. Governing Law</h2>
            <p>
              These Terms of Service are governed by applicable trade standards and international software licensing laws.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-white/10 text-center text-xs text-slate-500">
          TrimLink Enterprise URL Shortener. All rights reserved.
        </div>
      </div>
    </div>
  );
}
