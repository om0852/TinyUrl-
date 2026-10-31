# Future Migration Guide: Migrating from Cloudflare for SaaS to Self-Hosted Caddy Cluster

This document outlines how to migrate custom domain termination from **Cloudflare for SaaS** to a **Self-Hosted Caddy Cluster** with On-Demand TLS if link traffic or domain demand increases and you want 100% cloud independence.

---

## 1. Architectural Overview

```
Customer's Domain (e.g. links.acme.com)
            │
            │  CNAME links.acme.com ──> cname.tinyurl.dev
            ▼
┌────────────────────────────────────────────────────────┐
│ Caddy Cluster (2+ VPS nodes, e.g. Hetzner / AWS)      │
│ • On-Demand TLS (Let's Encrypt + ZeroSSL)              │
│ • Asks your app before issuing:                        │
│   GET /api/v1/internal/domain-check?domain=...         │
│ • Sets: X-Original-Host: links.acme.com                │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Next.js App / Redirect Engine                          │
│ • Reads X-Original-Host in middleware.ts               │
│ • Fetches shortcode from Neon PostgreSQL (< 2ms)       │
│ • Returns HTTP 307 Redirect to visitor                 │
└────────────────────────────────────────────────────────┘
```

---

## 2. What Is Already Prepared in Your Codebase

Your codebase is **already pre-configured** for Caddy:
1. **The Ask Endpoint**:
   - Route: `GET /api/v1/internal/domain-check?domain={hostname}` (Located at `src/app/api/v1/internal/domain-check/route.ts`).
   - Checks Neon PostgreSQL in real time.
   - Returns HTTP `200 OK` if the domain is verified in your workspace.
   - Returns HTTP `404` for unauthorized domains (preventing certificate exhaustion attacks).
2. **The Middleware Proxy Header Handler**:
   - Located at `src/middleware.ts`.
   - Reads `X-Original-Host` and `X-Forwarded-Host` before falling back to `Host`.

---

## 3. Production `Caddyfile` Configuration

Create a file named `Caddyfile` on your VPS:

```caddy
{
    # Global On-Demand TLS settings
    on_demand_tls {
        # Caddy will ask your app if this domain is allowed before requesting an SSL cert
        ask https://your-platform-domain.com/api/v1/internal/domain-check
        
        # Rate limiting to avoid Let's Encrypt abuse
        interval 2m
        burst 10
    }

    # Fallback storage for certs across cluster nodes
    # (Use Redis storage if running 2 or more Caddy VPS nodes)
    # storage redis {
    #     address "redis.internal:6379"
    # }
}

# Catch-all HTTPS listener for customer custom domains
:443 {
    tls {
        on_demand
    }

    # Pass original client host header securely to Next.js
    header_up X-Original-Host {host}
    header_up X-Forwarded-Host {host}
    header_up X-Forwarded-Proto https

    # Real visitor IP + geolocation (see "Visitor IP & Location Analytics" below).
    # Vercel overwrites X-Forwarded-For and geolocates THIS VM, so without these
    # headers every custom-domain click is recorded at the Caddy server's location.
    header_up X-Edge-Proxy-Secret {env.EDGE_PROXY_SECRET}
    header_up X-Client-IP {remote_host}
    # Requires a GeoIP Caddy module (placeholder names depend on the module you build in):
    # header_up X-Client-Country {geoip_country_code}
    # header_up X-Client-Region  {geoip_subdivision_code}
    # header_up X-Client-City    {geoip_city_name}

    # Proxy to your Next.js application
    reverse_proxy https://your-nextjs-app.vercel.app {
        header_up Host your-nextjs-app.vercel.app
    }
}

# Automatic HTTP to HTTPS redirection
:80 {
    redir https://{host}{uri} permanent
}
```

---

## 4. Multi-Node Caddy with Shared Storage (Docker Compose)

If you run **2 or more Caddy nodes** for high availability, they must share certificate storage so they don't request duplicate certs and hit Let's Encrypt rate limits (max 5 duplicate certs per week).

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  caddy:
    image: lucaslorentz/caddy-docker-proxy:ci-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    environment:
      - CADDY_INGRESS_NETWORKS=caddy
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - caddy

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - caddy

volumes:
  caddy_data:
  caddy_config:
  redis_data:

networks:
  caddy:
```

> **Note:** To build Caddy with the Redis storage plugin, use `xcaddy`:
> ```bash
> xcaddy build --with github.com/pberkel/caddy-storage-redis
> ```

---

## 5. Step-by-Step Migration from Cloudflare to Caddy (Zero Downtime)

When you decide to switch:

### Step 1: Provision your Caddy VPS
* Launch a $4–$5/mo VPS (e.g. on Hetzner, DigitalOcean, or AWS EC2).
* Run Caddy using the `Caddyfile` above.
* Verify Caddy can reach your app's ask endpoint:
  ```bash
  curl -i "https://your-platform.com/api/v1/internal/domain-check?domain=test.com"
  ```

### Step 2: Test with a Staging Domain
* Create a test subdomain in your DNS: `test-caddy.yourdomain.com` pointing to the VPS IP.
* Open `https://test-caddy.yourdomain.com/` in your browser.
* Watch Caddy's logs (`docker logs -f caddy` or `journalctl -u caddy -f`). You will see Caddy query your ask endpoint and successfully issue the certificate in ~2 seconds.

### Step 3: Switch the Canonical CNAME Record
* Change your DNS record for `cname.tinyurl.dev`:
  * **Before**: Pointed to Cloudflare fallback origin (`tiny-url-self.vercel.app`).
  * **After**: Point `cname.tinyurl.dev` (A record or CNAME) to your Caddy VPS cluster IP address.

### Step 4: Verification
* Because all customer domains (`links.acme.com`) point CNAME to `cname.tinyurl.dev`, **no customer needs to change anything in their DNS!**
* Traffic immediately flows through your Caddy cluster with automated On-Demand TLS.
* Delete any unused Cloudflare custom hostnames via the Cloudflare dashboard or API.

---

## 6. Visitor IP & Location Analytics Behind Caddy

When Caddy sits in front of Vercel, Vercel sees the **Caddy VM** as the client: it overwrites `X-Forwarded-For` and fills `x-vercel-ip-country/region/city` with the VM's location (for example California). Click analytics and geo smart-routing on custom domains then show the server's location instead of the visitor's.

The app (`src/lib/geo.ts`) accepts these headers from Caddy **only when `X-Edge-Proxy-Secret` matches the `EDGE_PROXY_SECRET` env var**:

| Header | Value | Used for |
| :--- | :--- | :--- |
| `X-Edge-Proxy-Secret` | shared secret (same value in Caddy env and Vercel env) | trust check |
| `X-Client-IP` | `{remote_host}` | visitor hash / unique-visitor detection |
| `X-Client-Country` | ISO 3166-1 alpha-2 (`IN`, `US`) | country |
| `X-Client-Region` | ISO subdivision code (`MH`) or full name (`Maharashtra`) | state / region |
| `X-Client-City` | city name (URL-encoded or plain) | city |

Setup:
1. Generate a secret (`openssl rand -hex 32`) and set `EDGE_PROXY_SECRET` both in the Caddy environment and in the Vercel project env vars.
2. Build Caddy with a GeoIP module and a MaxMind GeoLite2-City database, and map its placeholders to the `X-Client-*` headers above (check that module's README for the exact placeholder names).
3. Redeploy. Until `EDGE_PROXY_SECRET` is set on Vercel, the app ignores these headers and behaves exactly as before.

If only `X-Client-IP` is sent (no GeoIP module), visitor uniqueness is fixed but custom-domain clicks are stored as `Unknown` location (password/splash pages fall back to the browser's timezone estimate) instead of the VM's location.

---

## 7. Summary Comparison

| Metric | Cloudflare for SaaS (Current) | Caddy Cluster (Future) |
| :--- | :--- | :--- |
| **Server Maintenance** | Zero (Fully Serverless) | You manage VPS / Linux OS updates |
| **Cost** | 100 domains free ($0/mo) | ~$5 - $10/month per VPS |
| **Edge Handshake Latency** | Global Edge (300+ locations, ~20ms) | Centralized to VPS data centers (~50-150ms) |
| **Vendor Independence** | Tied to Cloudflare network | **100% Portable on any cloud or hardware** |
