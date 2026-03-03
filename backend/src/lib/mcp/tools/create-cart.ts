import type { ToolDefinition, ToolHandler } from "../server"
import { createCheckout } from "../../ucp/service"

const definition: ToolDefinition = {
  name: "create_cart",
  description:
    "Create a new cart (checkout session). Returns the full cart state including the checkout_session_id needed for get_cart and update_cart. You must call this before using get_cart or update_cart.",
  inputSchema: {
    type: "object",
    properties: {
      currency: {
        type: "string",
        description:
          "Currency code for the cart (e.g. 'usd', 'eur'). Defaults to 'usd'.",
      },
      items: {
        type: "array",
        description: "Items to add to the cart (at least one required)",
        items: {
          type: "object",
          properties: {
            variant_id: { type: "string", description: "Product variant ID" },
            quantity: { type: "number", description: "Quantity to add" },
          },
          required: ["variant_id", "quantity"],
        },
      },
      buyer: {
        type: "object",
        description: "Optional buyer information",
        properties: {
          email: { type: "string" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          phone_number: { type: "string" },
        },
      },
    },
    required: ["items"],
  },
}

const handler: ToolHandler = async (params, scope) => {
  const currency = String(params.currency || "usd").toLowerCase()
  const items = params.items as Array<{ variant_id: string; quantity: number }>

  if (!items?.length) {
    throw new Error("At least one item is required to create a cart")
  }

  const buyer = params.buyer as
    | { email?: string; first_name?: string; last_name?: string; phone_number?: string }
    | undefined

  return createCheckout(scope, {
    currency,
    line_items: items.map((item) => ({
      item: { id: item.variant_id },
      quantity: item.quantity,
    })),
    payment: {},
    buyer: buyer
      ? {
          email: buyer.email,
          first_name: buyer.first_name,
          last_name: buyer.last_name,
          phone_number: buyer.phone_number,
        }
      : undefined,
  })
}

export const createCartTool = { definition, handler }
