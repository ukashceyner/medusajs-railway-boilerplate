import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"

import { toProtocolError } from "../lib/ucp/protocol"
import { buildBusinessProfile } from "../lib/ucp/service"

const serveUcpManifest = async (
  req: MedusaRequest,
  res: MedusaResponse,
  _next: MedusaNextFunction
) => {
  try {
    const profile = await buildBusinessProfile(req.scope)
    res.setHeader("Cache-Control", "public, max-age=300")
    res.status(200).json(profile)
  } catch (error) {
    const protocolError = toProtocolError(error)
    res.status(protocolError.status).json(protocolError.body)
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/.well-known/ucp",
      methods: ["GET"],
      middlewares: [serveUcpManifest],
    },
  ],
})
