import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { toProtocolError } from "../../../lib/ucp/protocol"
import { buildBusinessProfile } from "../../../lib/ucp/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const profile = await buildBusinessProfile(req.scope)
    res.setHeader("Cache-Control", "public, max-age=300")
    res.status(200).json(profile)
  } catch (error) {
    const protocolError = toProtocolError(error)
    res.status(protocolError.status).json(protocolError.body)
  }
}
