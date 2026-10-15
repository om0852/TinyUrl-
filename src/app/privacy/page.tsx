import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | TrimLink Platform',
  description: 'Privacy Policy and data protection compliance information for TrimLink URL Shortener Platform.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto glass-panel p-8 md:p-12 rounded-xl border border-white/10 space-y-8">
        
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Privacy Policy</h1>
              <p className="text-xs text-slate-400">Effective Date: October 10, 2026</p>
            </div>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-2 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Platform
          </Link>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Data Collection & Usage</h2>
            <p>
              TrimLink collects minimal operational telemetry required to process URL redirects, log click events, and detect security threats. When visitors interact with short links created through our platform, we record anonymized click metadata including timestamp, hashed IP addresses, geographic country/region, user agent telemetry (browser & operating system), and referring URL.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. Anonymization & Hashing Policy</h2>
            <p>
              In accordance with GDPR, CCPA, and India DPDP regulations, visitor IP addresses are immediately hashed using standard cryptographic algorithms before being committed to our analytics storage. We do not store raw IP addresses in long-term databases.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. Security & Threat Scanning</h2>
            <p>
              All submitted destination URLs are scanned against Google Safe Browsing and VirusTotal APIs to protect users against phishing, malware distribution, and malicious redirects. Flagged links are quarantined automatically.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">4. Cookies & Retargeting Pixels</h2>
            <p>
              Our platform does not place persistent tracking cookies on end-user browser devices during 302/307 redirects unless explicitly configured by workspace link creators via client retargeting integrations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">5. Contact Information</h2>
            <p>
              For privacy inquiries, data deletion requests, or compliance auditing, please contact our privacy desk at <span className="font-mono text-blue-400">privacy@trimlink.io</span>.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-white/10 text-center text-xs text-slate-500">
          TrimLink URL Infrastructure Platform. All rights reserved.
        </div>
      </div>
    </div>
  );
}
