import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import {
  formatValidationError,
  getUcpAgentProfileOrThrow,
  runWithIdempotency,
  toProtocolError,
} from "../../../../../lib/ucp/protocol"
import { ucpCheckoutUpdateSchema } from "../../../../../lib/ucp/schemas"
import { getCheckout, updateCheckout } from "../../../../../lib/ucp/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    getUcpAgentProfileOrThrow(req)
    const checkout = await getCheckout(req.scope, req.params.id)
    res.status(200).json(checkout)
  } catch (error) {
    const protocolError = toProtocolError(error)
    res.status(protocolError.status).json(protocolError.body)
  }
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  try {
    getUcpAgentProfileOrThrow(req)

    const parsedBody = ucpCheckoutUpdateSchema.safeParse(req.body)
    if (!parsedBody.success) {
      throw formatValidationError(
        parsedBody.error.issues.map((issue) => issue.message).join("; ")
      )
    }

    if (parsedBody.data.id && parsedBody.data.id !== req.params.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Checkout id in request body does not match path id"
      )
    }

    const response = await runWithIdempotency(req, "update_checkout", async () => {
      const checkout = await updateCheckout(req.scope, req.params.id, parsedBody.data)
      return { status: 200, body: checkout }
    })

    res.status(response.status).json(response.body)
  } catch (error) {
    const protocolError = toProtocolError(error)
    res.status(protocolError.status).json(protocolError.body)
  }
}
