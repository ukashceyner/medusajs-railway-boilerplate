[![MedusaJS + Next.js Banner](https://raw.githubusercontent.com/georgekarapi/medusajs-railway-boilerplate/refs/heads/main/.github/medusajs-storefront-monorepo.jpg?token=GHSAT0AAAAAADOLU32SANXW6WY7FRKWOPVI2J4OOOQ)]

# Deploy and Host MedusaJS 2.0 + Storefront on Railway

Deploy a best-in-class e-commerce stack in minutes. This boilerplate brings you
an all-in-one **MedusaJS 2.0** solution, preconfigured with the backend, admin
dashboard, and a connected **Next.js 15** storefront. Everything you need to get
started with a modern, feature-rich shop, fully updated to the latest Medusa
architecture, with native support for Railway Buckets.

## About Hosting MedusaJS 2.0 + Storefront

Host the next-gen MedusaJS 2.0 e-commerce stack—complete with storefront, admin
dashboard, and all necessary services—without the tedious setup. This template
configures the **Backend**, **Storefront**, **Redis**, **PostgreSQL**, and
**Railway Bucket** (via AssetLinker), so your shop is production-ready from the
first deploy.

Benefit from:

- **Automatic Admin Creation**: The setup script automatically seeds your
  database and creates an admin user with your specified credentials.
- **Unified Storage**: Uses Railway's internal Bucket storage with a custom
  AssetLinker service to securely serve private assets, keeping your
  infrastructure contained within Railway.
- **Production Ready**: Strong secret generation, health checks, and optimized
  build pipelines are standard.
- **Scalable**: Railway handles the cloud infrastructure (servers, databases,
  caching) so you can focus on building your business logic.

Ideal for fast prototyping, custom e-commerce applications, and ambitious
side-projects that need to scale.

## Common Use Cases

- **Launching a modern full-featured e-commerce store fast**: Go from zero to
  live shop in minutes.
- **Scaling a boutique business**: Ready for multi-warehouse inventory and
  advanced promotions.
- **Experimenting and Learning**: Perfect for rapid-prototyping in open source
  commerce with the latest tech stack (Next.js 15, Medusa 2.0).
- **Complex Custom Solutions**: A flexible foundation that enterprise platforms
  can't match.

## Dependencies for MedusaJS 2.0 + Storefront Hosting

- **GitHub Account** and **Railway Account**
- **Railway Hobby Plan**: Recommended for keeping services active and
  persistent.
- **API Keys (Optional)**: Stripe, etc., if you choose to install those plugins.

### Deployment Dependencies

- [MedusaJS Official Docs](https://docs.medusajs.com/)
- [Next.js Documentation](https://nextjs.org/docs)

### Implementation Details

- **Auto-Configuration**: Backend, Storefront, Postgres, Redis, and AssetLinker
  auto-configure and interact on deploy.
- **Admin Setup**: Admin user is created automatically with `MEDUSA_ADMIN_EMAIL`
  and `MEDUSA_ADMIN_PASSWORD`.
- **Asset Handling**: Integrated "AssetLinker" service effectively proxies
  requests to the private Railway Bucket, ensuring media works out of the box
  without extra services (like MinIO).

## Why Deploy MedusaJS 2.0 + Storefront on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will
host your infrastructure so you don't have to deal with configuration, while
allowing you to vertically and horizontally scale it.

By deploying MedusaJS 2.0 + Storefront on Railway, you are one step closer to
supporting a complete full-stack application with minimal burden. Host your
servers, databases, AI agents, and more on Railway.
