import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import {
  getUcpAgentProfileOrThrow,
  runWithIdempotency,
  toProtocolError,
} from "../../../../../../lib/ucp/protocol"
import { cancelCheckout } from "../../../../../../lib/ucp/service"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    await getUcpAgentProfileOrThrow(req)

    const response = await runWithIdempotency(req, "cancel_checkout", async () => {
      const checkout = await cancelCheckout(req.scope, req.params.id)
      return { status: 200, body: checkout }
    })

    res.status(response.status).json(response.body)
  } catch (error) {
    const protocolError = toProtocolError(error)
    res.status(protocolError.status).json(protocolError.body)
  }
}
