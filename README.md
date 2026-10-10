# TinyUrl- — Enterprise URL Shortener & Analytics Platform

[![CI/CD Pipeline](https://github.com/om0852/TinyUrl-/actions/workflows/ci.yml/badge.svg)](https.github.com/om0852/TinyUrl-/actions)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](https://www.docker.com/)

An enterprise-grade URL shortener platform built with **Next.js 16 (Turbopack)**, **TypeScript**, and **Tailwind CSS v4**. Features custom branded short domains, device & geo smart routing, QR code studio, link-in-bio builder, real-time analytics, and automated security scanning.

---

## 🌟 Key Features

- **⚡ Fast Link Shortening**: Base62 collision-proof code generation with custom alias support.
- **🎨 Modern TinyURL UI**: Responsive theme matching dark navy teal (`#052536`) with emerald action buttons.
- **🌐 Custom Branded Domains**: Support for primary application host as well as custom domains (`go.client.com`, `buy.acme.shop`).
- **📱 QR Code Studio**: Custom QR code generator with downloadable logos and dot styles.
- **🔀 Smart Routing & A/B Testing**: Device-based (iOS / Android) and Geo-based (country) target URL redirection.
- **🛡️ Threat Protection & Security**: URL security scanning with risk scoring and malware/phishing detection.
- **📊 Real-time Click Analytics**: Async non-blocking click logging pipeline with device, OS, location, and latency tracking.
- **🤖 AI Marketing Suite**: Automatic AI slug suggestions and performance summaries.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js `v20.x` or `v18.x`
- npm / pnpm / yarn

### Installation & Local Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/om0852/TinyUrl-.git
   cd TinyUrl-
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Containerization

### Build Docker Image
```bash
docker build -t tinyurl-platform .
```

### Run Docker Container
```bash
docker run -p 3000:3000 tinyurl-platform
```

---

## 🔄 CI/CD Pipeline

Automated GitHub Actions workflow configured at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) checks:
1. ESLint & TypeScript compilation.
2. Next.js production build (`npm run build`).
3. Multi-stage Docker image build verification.

---

## 📜 License
Licensed under the [MIT License](LICENSE).
