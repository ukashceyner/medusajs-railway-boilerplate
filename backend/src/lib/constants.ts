export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:9000"
export const STORE_CORS = process.env.BACKEND_URL || process.env.STORE_CORS || "http://localhost:8000,https://docs.medusajs.com"
export const ADMIN_CORS = process.env.BACKEND_URL || process.env.ADMIN_CORS || "http://localhost:5173,http://localhost:9000,https://docs.medusajs.com"
export const AUTH_CORS = process.env.BACKEND_URL || process.env.AUTH_CORS || "http://localhost:5173,http://localhost:9000,https://docs.medusajs.com"

export const DATABASE_URL = process.env.DATABASE_URL
export const REDIS_URL = process.env.REDIS_URL

export const JWT_SECRET = process.env.JWT_SECRET || "supersecret"
export const COOKIE_SECRET = process.env.COOKIE_SECRET || "supersecret"

export const RESEND_API_KEY = process.env.RESEND_API_KEY
export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL

export const STRIPE_API_KEY = process.env.STRIPE_API_KEY
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

export const SHOULD_DISABLE_ADMIN = process.env.SHOULD_DISABLE_ADMIN === "true"
export const WORKER_MODE = (process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server") || "shared"

// UCP configuration
export const UCP_VERSION = process.env.UCP_VERSION || "2026-01-11"
export const UCP_BASE_URL = process.env.UCP_BASE_URL || BACKEND_URL
export const UCP_REST_ENDPOINT =
  process.env.UCP_REST_ENDPOINT ||
  `${UCP_BASE_URL.replace(/\/$/, "")}/ucp/v1`
export const UCP_CONTINUE_URL_BASE =
  process.env.UCP_CONTINUE_URL_BASE || UCP_BASE_URL
export const UCP_DEFAULT_REGION_ID = process.env.UCP_DEFAULT_REGION_ID
export const UCP_TERMS_URL =
  process.env.UCP_TERMS_URL || `${UCP_BASE_URL.replace(/\/$/, "")}/terms`
export const UCP_PRIVACY_URL =
  process.env.UCP_PRIVACY_URL || `${UCP_BASE_URL.replace(/\/$/, "")}/privacy`
export const UCP_REFUND_URL = process.env.UCP_REFUND_URL
export const UCP_SHIPPING_URL = process.env.UCP_SHIPPING_URL
export const UCP_FAQ_URL = process.env.UCP_FAQ_URL
export const UCP_VERIFY_PLATFORM_PROFILE =
  process.env.UCP_VERIFY_PLATFORM_PROFILE === "true"
export const UCP_PLATFORM_PROFILE_TIMEOUT_MS =
  Number.parseInt(process.env.UCP_PLATFORM_PROFILE_TIMEOUT_MS || "3000", 10) ||
  3000
export const UCP_REQUIRE_REQUEST_SIGNATURES =
  process.env.UCP_REQUIRE_REQUEST_SIGNATURES === "true"
export const UCP_IDEMPOTENCY_TABLE =
  process.env.UCP_IDEMPOTENCY_TABLE || "ucp_idempotency_keys"

// S3 Configuration
export const AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
export const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME
export const AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL
export const AWS_S3_FILE_URL = process.env.AWS_S3_FILE_URL
