import { loadEnv, Modules, defineConfig } from '@medusajs/framework/utils'
import {
  ADMIN_CORS,
  AUTH_CORS,
  BACKEND_URL,
  COOKIE_SECRET,
  DATABASE_URL,
  JWT_SECRET,
  REDIS_URL,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  SHOULD_DISABLE_ADMIN,
  STORE_CORS,
  STRIPE_API_KEY,
  STRIPE_WEBHOOK_SECRET,
  WORKER_MODE,

  AWS_DEFAULT_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_S3_BUCKET_NAME,
  AWS_ENDPOINT_URL,
  AWS_S3_FILE_URL
} from './src/lib/constants'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: DATABASE_URL,
    databaseLogging: false,
    redisUrl: REDIS_URL,
    workerMode: WORKER_MODE,
    http: {
      adminCors: ADMIN_CORS,
      authCors: AUTH_CORS,
      storeCors: STORE_CORS,
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET
    }
  },
  admin: {
    backendUrl: BACKEND_URL,
    disable: SHOULD_DISABLE_ADMIN,
  },
  modules: [
    // File storage module
    {
      key: Modules.FILE,
      resolve: '@medusajs/file',
      options: {
        providers: [
          ...(AWS_DEFAULT_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_S3_BUCKET_NAME
            ? [
              {
                resolve: '@medusajs/file-s3',
                id: 's3',
                options: {
                  file_url: AWS_S3_FILE_URL,
                  endpoint: AWS_ENDPOINT_URL,
                  bucket: AWS_S3_BUCKET_NAME,
                  region: AWS_DEFAULT_REGION,
                  access_key_id: AWS_ACCESS_KEY_ID,
                  secret_access_key: AWS_SECRET_ACCESS_KEY,
                  additional_client_config: {
                    forcePathStyle: true,
                  },
                }
              }
            ]
            : [
              {
                resolve: '@medusajs/file-local',
                id: 'local',
                options: {
                  upload_dir: 'static',
                  backend_url: `${BACKEND_URL}/static`
                }
              }
            ])
        ]
      }
    },
    // Redis modules (if Redis is available)
    ...(REDIS_URL
      ? [
        {
          key: Modules.EVENT_BUS,
          resolve: '@medusajs/event-bus-redis',
          options: {
            redisUrl: REDIS_URL
          }
        },
        {
          key: Modules.WORKFLOW_ENGINE,
          resolve: '@medusajs/workflow-engine-redis',
          options: {
            redis: {
              url: REDIS_URL
            }
          }
        }
      ]
      : []),
    // Notification module (if Resend is configured)
    ...(RESEND_API_KEY && RESEND_FROM_EMAIL
      ? [
        {
          key: Modules.NOTIFICATION,
          resolve: '@medusajs/notification',
          options: {
            providers: [
              {
                resolve: '@medusajs/notification-resend',
                id: 'resend',
                options: {
                  channels: ['email'],
                  api_key: RESEND_API_KEY,
                  from: RESEND_FROM_EMAIL
                }
              }
            ]
          }
        }
      ]
      : []),
    // Payment module (Stripe)
    ...(STRIPE_API_KEY && STRIPE_WEBHOOK_SECRET
      ? [
        {
          key: Modules.PAYMENT,
          resolve: '@medusajs/payment',
          options: {
            providers: [
              {
                resolve: '@medusajs/payment-stripe',
                id: 'stripe',
                options: {
                  apiKey: STRIPE_API_KEY,
                  webhookSecret: STRIPE_WEBHOOK_SECRET,
                  capture: true,
                  automatic_payment_methods: true
                }
              }
            ]
          }
        }
      ]
      : [])
  ]
});
