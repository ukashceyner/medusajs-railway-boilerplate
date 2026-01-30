[![MedusaJS + Next.js Banner](./.github/medusajs-storefront-monorepo.jpg)](https://railway.com/deploy/medusajs-storefron-2?referralCode=karapi&utm_medium=integration&utm_source=template&utm_campaign=generic)

# MedusaJS 2.0 + Storefront Monorepo

A pre-configured monorepo for deploying **Medusa 2.0** (Backend) and **Next.js
15** (Storefront) on Railway, based on the official MedusaJS + Next.js
templates, NO extra dependencies.

## 🚀 Features

- **Backend**: Medusa v2.0 (Framework, Admin, Dashboard).
- **Storefront**: Next.js 15 Starter kit template integrated with Medusa.
- **Monorepo**: Managed with `pnpm workspace` for efficient dependency
  management.
- **Railway Optimized**: optimized configuration files (`railway.json`) and
  scripts for seamless deployment.

## ☁️ Deployment on Railway

This repository is optimized for Railway. Template uses Railway's Bucket for
media upload, avoiding extra costs of an extra service. One-click deployment on
Railway:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/medusajs-storefron-2?referralCode=karapi&utm_medium=integration&utm_source=template&utm_campaign=generic)

> **Note:** We patch **MedusaJS** need of publishable key to allow deployment
> without any other extra hassles. In case you need to use it, just add the
> **MEDUSA_PUBLISHABLE_KEY** environment variable to your **Backend** service
> and both services will be able to use it.

## 🛠️ Local Development

### Prerequisites

- Node.js v20+
- pnpm v10+
- PostgreSQL (else uses SQLite)
- Redis (else uses in-memory)

### Installation

1. **Clone**

   ```bash
   git clone https://github.com/georgekarapi/medusajs-railway-boilerplate.git
   ```

2. **Install dependencies:**

   ```bash
   cd medusajs-railway-boilerplate
   pnpm install
   ```

3. **Environment Setup & Seed:**

   Run the automated setup script to copy environment files, generate a compatible publishable key, and seed the database:

   ```bash
   pnpm setup
   ```

   > **Note:** The setup script appends a unique `MEDUSA_PUBLISHABLE_KEY` to both `backend/.env` and `storefront/.env.local` to ensure they are synchronized for local development.

### Development

Start the development servers for both backend and storefront from the root:

```bash
pnpm dev
```

Alternatively, you can run them individually:

**Backend:**

```bash
cd backend
pnpm dev
```

**Storefront:**

```bash
cd storefront
pnpm dev
```

## 📚 Resources

- [Medusa Documentation](https://docs.medusajs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Railway Documentation](https://docs.railway.app/)
