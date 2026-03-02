import { createHash } from "crypto"

import type { MedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

import {
  UCP_IDEMPOTENCY_TABLE,
  UCP_PLATFORM_PROFILE_TIMEOUT_MS,
  UCP_REQUIRE_REQUEST_SIGNATURES,
  UCP_VERIFY_PLATFORM_PROFILE,
  UCP_VERSION,
} from "../constants"

type IdempotencyCacheEntry = {
  created_at: number
  request_hash: string
  response: {
    status: number
    body: Record<string, unknown>
  }
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const idempotencyCache = new Map<string, IdempotencyCacheEntry>()
let lastDbIdempotencyCleanupAt = 0
let ensureTablePromise: Promise<void> | null = null

const UCP_PROFILE_ERROR_PREFIX = "ucp_profile"
const UCP_SIGNATURE_ERROR_PREFIX = "ucp_signature"

type CachedPlatformProfile = {
  expiresAt: number
  profile: PlatformProfile
}

const platformProfileCache = new Map<string, CachedPlatformProfile>()

const versionSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const platformProfileSchema = z
  .object({
    ucp: z
      .object({
        version: versionSchema,
        capabilities: z
          .record(
            z.array(
              z
                .object({
                  version: versionSchema,
                })
                .passthrough()
            )
          )
          .optional(),
      })
      .passthrough(),
  })
  .passthrough()

type PlatformProfile = z.infer<typeof platformProfileSchema>

const cleanupExpiredIdempotencyKeys = () => {
  const now = Date.now()
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.created_at > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key)
    }
  }
}

const makeProfileError = (kind: string, message: string) => {
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `${UCP_PROFILE_ERROR_PREFIX}:${kind}:${message}`
  )
}

const makeSignatureError = (kind: string, message: string) => {
  return new MedusaError(
    MedusaError.Types.UNAUTHORIZED,
    `${UCP_SIGNATURE_ERROR_PREFIX}:${kind}:${message}`
  )
}

const parseVersionDate = (version: string) => {
  const timestamp = Date.parse(`${version}T00:00:00.000Z`)
  if (!Number.isFinite(timestamp)) {
    return null
  }
  return timestamp
}

const isVersionSupported = (platformVersion: string) => {
  const platformTs = parseVersionDate(platformVersion)
  const businessTs = parseVersionDate(UCP_VERSION)
  if (platformTs === null || businessTs === null) {
    return false
  }

  return platformTs <= businessTs
}

const parseCacheControlMaxAge = (cacheControl?: string | null) => {
  if (!cacheControl) {
    return null
  }

  const match = cacheControl.match(/max-age=(\d+)/i)
  if (!match) {
    return null
  }

  const value = Number.parseInt(match[1], 10)
  if (!Number.isFinite(value)) {
    return null
  }

  return value
}

const getPgConnection = (req: MedusaRequest) => {
  try {
    return req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  } catch {
    return undefined
  }
}

const ensureIdempotencyTable = async (pgConnection: any) => {
  if (ensureTablePromise) {
    return ensureTablePromise
  }

  ensureTablePromise = (async () => {
    const hasTable = await pgConnection.schema.hasTable(UCP_IDEMPOTENCY_TABLE)
    if (hasTable) {
      return
    }

    await pgConnection.schema.createTable(UCP_IDEMPOTENCY_TABLE, (table: any) => {
      table.string("operation", 128).notNullable()
      table.string("idempotency_key", 255).notNullable()
      table.string("request_hash", 64).notNullable()
      table.integer("status_code").notNullable()
      table.text("response_body").notNullable()
      table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(pgConnection.fn.now())

      table.primary(["operation", "idempotency_key"])
      table.index(["created_at"])
    })
  })().catch((error) => {
    ensureTablePromise = null
    throw error
  })

  return ensureTablePromise
}

const cleanupDbIdempotencyKeys = async (pgConnection: any) => {
  const now = Date.now()
  if (now - lastDbIdempotencyCleanupAt < 5 * 60 * 1000) {
    return
  }

  lastDbIdempotencyCleanupAt = now
  const cutoff = new Date(now - IDEMPOTENCY_TTL_MS).toISOString()
  await pgConnection(UCP_IDEMPOTENCY_TABLE)
    .where("created_at", "<", cutoff)
    .delete()
}

const parseStoredResponseBody = (body: string) => {
  try {
    const parsed = JSON.parse(body)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Fallback handled by caller.
  }

  return null
}

const runWithDbIdempotency = async (
  pgConnection: any,
  operation: string,
  requestHash: string,
  key: string,
  fn: () => Promise<{ status: number; body: Record<string, unknown> }>
) => {
  await ensureIdempotencyTable(pgConnection)
  await cleanupDbIdempotencyKeys(pgConnection)

  const existing = await pgConnection(UCP_IDEMPOTENCY_TABLE)
    .where({
      operation,
      idempotency_key: key,
    })
    .first()

  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "Idempotency key was already used with a different request payload"
      )
    }

    const parsedBody = parseStoredResponseBody(existing.response_body)
    if (parsedBody) {
      return {
        status: Number(existing.status_code),
        body: parsedBody,
      }
    }
  }

  const response = await fn()

  await pgConnection(UCP_IDEMPOTENCY_TABLE)
    .insert({
      operation,
      idempotency_key: key,
      request_hash: requestHash,
      status_code: response.status,
      response_body: JSON.stringify(response.body),
    })
    .onConflict(["operation", "idempotency_key"])
    .ignore()

  const stored = await pgConnection(UCP_IDEMPOTENCY_TABLE)
    .where({
      operation,
      idempotency_key: key,
    })
    .first()

  if (!stored) {
    return response
  }

  if (stored.request_hash !== requestHash) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      "Idempotency key was already used with a different request payload"
    )
  }

  const parsedBody = parseStoredResponseBody(stored.response_body)
  if (!parsedBody) {
    return response
  }

  return {
    status: Number(stored.status_code),
    body: parsedBody,
  }
}

const enforceRequestSignatureHeaders = (req: MedusaRequest) => {
  if (!UCP_REQUIRE_REQUEST_SIGNATURES) {
    return
  }

  const signature = req.get("Signature")
  const signatureInput = req.get("Signature-Input")

  if (!signature || !signatureInput) {
    throw makeSignatureError(
      "missing_headers",
      "Signature and Signature-Input headers are required"
    )
  }

  const method = (req.method || "").toUpperCase()
  const requiresDigest = method === "POST" || method === "PUT" || method === "PATCH"
  if (requiresDigest && !req.get("Content-Digest")) {
    throw makeSignatureError(
      "missing_content_digest",
      "Content-Digest header is required for signed requests with a body"
    )
  }
}

const fetchAndValidatePlatformProfile = async (profileUrl: string) => {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(profileUrl)
  } catch {
    throw makeProfileError("invalid_url", "Platform profile URL is not valid")
  }

  if (parsedUrl.protocol !== "https:") {
    throw makeProfileError(
      "invalid_url",
      "Platform profile URL must use HTTPS"
    )
  }

  const cached = platformProfileCache.get(profileUrl)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile
  }

  const abortController = new AbortController()
  const timeout = setTimeout(
    () => abortController.abort(),
    UCP_PLATFORM_PROFILE_TIMEOUT_MS
  )

  let response: Response
  try {
    response = await fetch(profileUrl, {
      method: "GET",
      redirect: "manual",
      signal: abortController.signal,
      headers: {
        Accept: "application/json",
      },
    })
  } catch (error) {
    throw makeProfileError(
      "fetch_failed",
      `Unable to fetch platform profile (${(error as Error).message})`
    )
  } finally {
    clearTimeout(timeout)
  }

  if (response.status >= 300 && response.status < 400) {
    throw makeProfileError(
      "fetch_failed",
      "Platform profile endpoint must not redirect"
    )
  }

  if (response.status < 200 || response.status >= 300) {
    throw makeProfileError(
      "fetch_failed",
      `Platform profile fetch failed with status ${response.status}`
    )
  }

  const cacheControl = response.headers.get("Cache-Control")
  const maxAgeSeconds = parseCacheControlMaxAge(cacheControl)
  if (maxAgeSeconds === null || maxAgeSeconds < 60) {
    throw makeProfileError(
      "malformed",
      "Platform profile must include Cache-Control max-age >= 60"
    )
  }

  let profileJson: unknown
  try {
    profileJson = await response.json()
  } catch {
    throw makeProfileError("malformed", "Platform profile response is not valid JSON")
  }

  const parsedProfile = platformProfileSchema.safeParse(profileJson)
  if (!parsedProfile.success) {
    throw makeProfileError("malformed", "Platform profile schema validation failed")
  }

  if (!isVersionSupported(parsedProfile.data.ucp.version)) {
    throw makeProfileError(
      "unsupported_version",
      `Platform UCP version ${parsedProfile.data.ucp.version} is newer than supported business version ${UCP_VERSION}`
    )
  }

  const checkoutCapabilities =
    parsedProfile.data.ucp.capabilities?.["dev.ucp.shopping.checkout"] || []

  const hasCompatibleCheckoutCapability = checkoutCapabilities.some(
    (capability) => isVersionSupported(capability.version)
  )

  if (!hasCompatibleCheckoutCapability) {
    throw makeProfileError(
      "capability_missing",
      "Platform profile must advertise a compatible dev.ucp.shopping.checkout capability"
    )
  }

  platformProfileCache.set(profileUrl, {
    expiresAt: Date.now() + maxAgeSeconds * 1000,
    profile: parsedProfile.data,
  })

  return parsedProfile.data
}

export const parseUcpAgentProfile = (
  headerValue?: string
): string | undefined => {
  if (!headerValue) {
    return undefined
  }

  const match = headerValue.match(/profile\s*=\s*"([^"]+)"/i)
  return match?.[1]
}

export const getUcpAgentProfileOrThrow = async (
  req: MedusaRequest
): Promise<string> => {
  enforceRequestSignatureHeaders(req)

  const profile = parseUcpAgentProfile(req.get("UCP-Agent") || undefined)
  if (!profile) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Missing UCP-Agent header. Expected format: profile="https://platform.example/.well-known/ucp"'
    )
  }

  if (UCP_VERIFY_PLATFORM_PROFILE) {
    await fetchAndValidatePlatformProfile(profile)
  }

  return profile
}

export const runWithIdempotency = async (
  req: MedusaRequest,
  operation: string,
  fn: () => Promise<{ status: number; body: Record<string, unknown> }>
) => {
  const key = req.get("Idempotency-Key")
  if (!key) {
    return fn()
  }

  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        path: req.originalUrl || req.url,
        operation,
        body: req.body ?? null,
      })
    )
    .digest("hex")

  const pgConnection = getPgConnection(req)
  if (pgConnection) {
    return runWithDbIdempotency(
      pgConnection,
      operation,
      requestHash,
      key,
      fn
    )
  }

  cleanupExpiredIdempotencyKeys()

  const cacheKey = `${operation}:${key}`
  const existing = idempotencyCache.get(cacheKey)
  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "Idempotency key was already used with a different request payload"
      )
    }

    return existing.response
  }

  const response = await fn()

  idempotencyCache.set(cacheKey, {
    created_at: Date.now(),
    request_hash: requestHash,
    response,
  })

  return response
}

export const formatValidationError = (message: string) => {
  return new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

export const toProtocolError = (
  error: unknown
): { status: number; body: { code: string; content: string } } => {
  if (error instanceof MedusaError) {
    if (error.message.startsWith(`${UCP_PROFILE_ERROR_PREFIX}:`)) {
      const [, errorCode, ...rest] = error.message.split(":")
      const content = rest.join(":").trim() || "Platform profile validation failed"
      const status = errorCode === "fetch_failed" ? 424 : 422
      return {
        status,
        body: { code: errorCode || "profile_error", content },
      }
    }

    if (error.message.startsWith(`${UCP_SIGNATURE_ERROR_PREFIX}:`)) {
      const [, errorCode, ...rest] = error.message.split(":")
      const content = rest.join(":").trim() || "Signature validation failed"
      return {
        status: 401,
        body: { code: errorCode || "signature_error", content },
      }
    }

    switch (error.type) {
      case MedusaError.Types.NOT_FOUND:
        return {
          status: 404,
          body: { code: "not_found", content: error.message },
        }
      case MedusaError.Types.CONFLICT:
        return {
          status: 409,
          body: { code: "conflict", content: error.message },
        }
      case MedusaError.Types.NOT_ALLOWED:
        return {
          status: 403,
          body: { code: "forbidden", content: error.message },
        }
      case MedusaError.Types.UNAUTHORIZED:
        return {
          status: 401,
          body: { code: "unauthorized", content: error.message },
        }
      default:
        return {
          status: 400,
          body: { code: "invalid_request", content: error.message },
        }
    }
  }

  return {
    status: 500,
    body: { code: "internal_error", content: "Unexpected UCP server error" },
  }
}
