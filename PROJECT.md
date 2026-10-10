# URL Shortener Platform — Technical Specification & Blueprint

## 1. Stack Architecture
- **Frontend & API**: Next.js 15 (App Router, Server Actions, Route Handlers) + TypeScript
- **Styling & UI**: Tailwind CSS v4 + Lucide Icons + Custom Modern Glassmorphism System
- **Database & Cache**: Relational PostgreSQL Schema & Redis Caching Layer (abstracted with client state / indexed memory persistent engine)
- **Analytics Store**: Fast event-based Click logging pipeline (ClickHouse pattern)
- **Security & Safety**: Safe Browsing API, VirusTotal link risk scoring, Bot filtering, IP hashing
- **Add-ons**: Custom branded domains, UTM builder, QR Code Generator with logos, Link-in-Bio mobile page builder, Deep linking, Smart Routing (Geo, Device, A/B Split), Retargeting pixels, AI Slug & Insights generator.

## 2. Core Database Schemas
- `workspaces`: id, name, slug, owner_id, plan, created_at
- `workspace_members`: workspace_id, user_id, role (owner, admin, editor, viewer)
- `domains`: id, hostname, verified, ssl_status, workspace_id
- `links`: id, short_code, destination_url, title, domain_id, workspace_id, tags, campaign_id, password_hash, expires_at, max_clicks, clicks_count, status, is_flagged, risk_score, created_by, created_at
- `link_rules`: id, link_id, rule_type (geo, device, ab), condition, target_url, weight
- `clicks`: id, link_id, timestamp, ip_hash, country, city, device, os, browser, referrer, is_bot, is_unique, latency_ms
- `campaigns`: id, workspace_id, name, description, tags, target_clicks
- `qr_codes`: id, link_id, color_fg, color_bg, logo_url, dot_style
- `bio_pages`: id, workspace_id, slug, title, bio, avatar_url, theme, links_json, created_at
- `api_keys`: id, workspace_id, name, key_hash, permissions, created_at

## 3. High Performance Redirect Pipeline
1. Visitor requests `short.link/:code`
2. Redis lookup simulation (< 10ms cache hit)
3. Expiration / Click limit check
4. Security check (Safe Browsing flag check)
5. Rule matching:
   - Device: iOS -> App Store URL, Android -> Play Store URL
   - Country: Geo targeting match
   - A/B Split: Weighted random distribution
6. Asynchronous non-blocking log event sent to click queue
7. Return 302 / 307 Redirect (or render password verification / interstitial if required)

## 4. Security & Compliance
- Rate limiting per IP/session
- Anonymous IP Hashing (GDPR & India DPDP compliant)
- Phishing & Malware link reporting & auto-quarantine
