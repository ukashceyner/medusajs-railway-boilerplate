

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
  async rewrites() {
    if (!MEDUSA_BACKEND_URL) {
      return []
    }

    const backendBaseUrl = MEDUSA_BACKEND_URL.replace(/\/$/, "")

    return [
      {
        source: "/llms.txt",
        destination: `${backendBaseUrl}/llms.txt`,
      },
      {
        source: "/.well-known/ucp",
        destination: `${backendBaseUrl}/.well-known/ucp`,
      },
      {
        source: "/ucp/v1/:path*",
        destination: `${backendBaseUrl}/ucp/v1/:path*`,
      },
      {
        source: "/mcp/:path*",
        destination: `${backendBaseUrl}/mcp/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
