import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"

import { toProtocolError } from "../lib/ucp/protocol"
import { buildBusinessProfile } from "../lib/ucp/service"
import { BACKEND_URL, UCP_REST_ENDPOINT, UCP_MCP_ENDPOINT } from "../lib/constants"

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

const serveLlmsTxt = async (
  req: MedusaRequest,
  res: MedusaResponse,
  _next: MedusaNextFunction
) => {
  const content = `# Medusa Commerce API

> Headless commerce backend powered by Medusa 2, with UCP and MCP protocol support for AI agent integration.

## Store API

The Store API lets you browse products, manage carts, and complete checkouts.

- [Products](${BACKEND_URL}/store/products): Browse and search the product catalog
- [Collections](${BACKEND_URL}/store/collections): Browse product collections
- [Carts](${BACKEND_URL}/store/carts): Create and manage shopping carts
- [Regions](${BACKEND_URL}/store/regions): Available shipping regions
- [Shipping Options](${BACKEND_URL}/store/shipping-options): Delivery methods and rates

## AI Agent Protocols

This store supports two protocols for AI agent integration:

- [UCP Manifest](${BACKEND_URL}/.well-known/ucp): Unified Commerce Protocol business profile and checkout session management
- [UCP Checkout Sessions](${UCP_REST_ENDPOINT}/checkout-sessions): Create and manage checkout sessions programmatically
- [MCP Endpoint](${UCP_MCP_ENDPOINT}): Model Context Protocol JSON-RPC 2.0 endpoint with tools for product search, cart management, and policy lookup

## MCP Tools

The MCP endpoint provides 5 tools for AI agents:

- search-catalog: Search the product catalog by keyword
- get-product-details: Get full details for a specific product
- get-cart: Retrieve the current state of a cart
- update-cart: Add, update, or remove line items in a cart
- search-policies: Look up shipping and refund policies

## Admin API

- [Admin Dashboard](${BACKEND_URL}/app): Medusa Admin UI for store management
`

  res.setHeader("Content-Type", "text/plain; charset=utf-8")
  res.setHeader("Cache-Control", "public, max-age=3600")
  res.status(200).send(content)
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/.well-known/ucp",
      methods: ["GET"],
      middlewares: [serveUcpManifest],
    },
    {
      matcher: "/llms.txt",
      methods: ["GET"],
      middlewares: [serveLlmsTxt],
    },
  ],
})
