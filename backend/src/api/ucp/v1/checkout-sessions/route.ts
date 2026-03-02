import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import {
  formatValidationError,
  getUcpAgentProfileOrThrow,
  runWithIdempotency,
  toProtocolError,
} from "../../../../lib/ucp/protocol"
import { ucpCheckoutCreateSchema } from "../../../../lib/ucp/schemas"
import { createCheckout } from "../../../../lib/ucp/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    await getUcpAgentProfileOrThrow(req)

    const parsedBody = ucpCheckoutCreateSchema.safeParse(req.body)
    if (!parsedBody.success) {
      throw formatValidationError(
        parsedBody.error.issues.map((issue) => issue.message).join("; ")
      )
    }

    const response = await runWithIdempotency(req, "create_checkout", async () => {
      const checkout = await createCheckout(req.scope, parsedBody.data)
      return { status: 201, body: checkout }
    })

    res.status(response.status).json(response.body)
  } catch (error) {
    const protocolError = toProtocolError(error)
    res.status(protocolError.status).json(protocolError.body)
  }
}
