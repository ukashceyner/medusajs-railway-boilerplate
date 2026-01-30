export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:9000"
export const STORE_CORS = process.env.STORE_CORS || "http://localhost:8000,https://docs.medusajs.com"
export const ADMIN_CORS = process.env.ADMIN_CORS || "http://localhost:5173,http://localhost:9000,https://docs.medusajs.com"
export const AUTH_CORS = process.env.AUTH_CORS || "http://localhost:5173,http://localhost:9000,https://docs.medusajs.com"

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

// S3 Configuration
export const AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
export const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME
export const AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL
export const AWS_S3_FILE_URL = process.env.AWS_S3_FILE_URL
