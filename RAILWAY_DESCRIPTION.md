[![MedusaJS + Next.js Banner](https://raw.githubusercontent.com/georgekarapi/medusajs-railway-boilerplate/refs/heads/main/.github/medusajs-storefront-monorepo.jpg?token=GHSAT0AAAAAADOLU32SANXW6WY7FRKWOPVI2J4OOOQ)]

# Deploy and Host MedusaJS 2.0 + Storefront on Railway

This boilerplate provides a pre-configured e-commerce setup on Railway. It includes **Next.js Storefront Starter** and the **MedusaJS 2.0** backend, configured to work together out of the box.

## About Hosting MedusaJS 2.0 + Storefront

This template automates the setup of the core services needed for a MedusaJS store. It pre-configures **PostgreSQL, Redis, and Railway Buckets** to ensure all components are connected correctly from the first deployment.

**Key Features:**

- **Pre-configured Environment**: Backend, storefront, and database are pre-linked and ready for use.
- **Updated Tech Stack**: Built with Medusa 2.0, Next.js 15 (App Router), and Tailwind CSS.
- **Integrated Railway Storage**: Uses Railway's internal Bucket system for asset storage via AssetLinker.
- **Deployment Ready**: Includes health checks, environment variable management, and build pipelines.

Suitable for prototyping, custom e-commerce projects, and production deployments that require a scalable foundation.

## Common Use Cases

- **Deploying a MedusaJS Store**: Quick setup for a new e-commerce project.
- **Inventory & Promotions**: Ready for multi-warehouse setups and Medusa's promotion engine.
- **Development & Prototyping**: A clean starting point for building custom commerce logic.
- **Custom Commerce Solutions**: A flexible base for high-growth e-commerce applications.

## Dependencies for MedusaJS 2.0 + Storefront Hosting

- **GitHub Account** and **Railway Account** (required)
- **Railway Hobby Plan**: Recommended for persistent database and cache services.
- **Medusa Backend & Admin**: Pre-seeded with initial data for testing.
- **Next.js Storefront**: Integrated starter with responsive design.

### Deployment Dependencies

- **Service Connectivity**: Backend, Storefront, Postgres, and Redis auto-configure on deployment.
- **Admin Access**: Admin credentials are set via environment variables and created during the first deploy.
- **Asset Management**: Uses the "AssetLinker" service to proxy requests to Railway Buckets, handling media without external S3 configuration.

## Why Deploy on Railway?

Railway manages the underlying infrastructure, including database hosting and scaling. It allows you to deploy the entire stack without manual server configuration, providing both vertical and horizontal scaling options.

This template is designed to provide a stable, manageable foundation for MedusaJS applications by handling the initial wiring of services on Railway.
