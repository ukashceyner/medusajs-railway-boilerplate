import { createHash } from "crypto"

import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

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

const cleanupExpiredIdempotencyKeys = () => {
  const now = Date.now()
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.created_at > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key)
    }
  }
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

export const getUcpAgentProfileOrThrow = (req: MedusaRequest): string => {
  const profile = parseUcpAgentProfile(req.get("UCP-Agent") || undefined)
  if (!profile) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Missing UCP-Agent header. Expected format: profile="https://platform.example/.well-known/ucp"'
    )
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

  cleanupExpiredIdempotencyKeys()

  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        path: req.originalUrl || req.url,
        operation,
        body: req.body ?? null,
      })
    )
    .digest("hex")

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
