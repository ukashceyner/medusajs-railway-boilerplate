import type { ToolDefinition, ToolHandler } from "../server"
import { getCheckout } from "../../ucp/service"

const definition: ToolDefinition = {
  name: "get_cart",
  description:
    "Get the cart including line items, shipping information, totals, buyer details, and payment status. Use this to check the current state of a checkout session.",
  inputSchema: {
    type: "object",
    properties: {
      checkout_session_id: {
        type: "string",
        description: "The checkout session (cart) ID to retrieve",
      },
    },
    required: ["checkout_session_id"],
  },
}

const handler: ToolHandler = async (params, scope) => {
  const id = String(params.checkout_session_id || "")
  if (!id) {
    throw new Error("checkout_session_id is required")
  }

  return getCheckout(scope, id)
}

export const getCartTool = { definition, handler }
