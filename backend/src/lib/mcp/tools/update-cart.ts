import {
  addToCartWorkflowId,
  addShippingMethodToCartWorkflow,
  deleteLineItemsWorkflowId,
  updateCartWorkflowId,
  updateLineItemInCartWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  Modules,
} from "@medusajs/framework/utils"
import type { ToolDefinition, ToolHandler } from "../server"
import {
  getCheckout,
  refetchCart,
} from "../../ucp/service"

const definition: ToolDefinition = {
  name: "update_cart",
  description:
    "Perform updates to a cart, including adding/removing items, updating quantities, setting buyer info, applying discount codes, setting the shipping address, selecting a shipping option, and adding cart notes. Returns the full updated cart state.",
  inputSchema: {
    type: "object",
    properties: {
      checkout_session_id: {
        type: "string",
        description: "The checkout session (cart) ID to update",
      },
      add_items: {
        type: "array",
        description: "Items to add to the cart",
        items: {
          type: "object",
          properties: {
            variant_id: { type: "string", description: "Product variant ID" },
            quantity: { type: "number", description: "Quantity to add" },
          },
          required: ["variant_id", "quantity"],
        },
      },
      remove_item_ids: {
        type: "array",
        description: "Line item IDs to remove from cart",
        items: { type: "string" },
      },
      update_items: {
        type: "array",
        description: "Line items to update quantity",
        items: {
          type: "object",
          properties: {
            line_item_id: { type: "string", description: "Line item ID" },
            quantity: { type: "number", description: "New quantity" },
          },
          required: ["line_item_id", "quantity"],
        },
      },
      buyer: {
        type: "object",
        description: "Buyer identity information",
        properties: {
          email: { type: "string" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          phone_number: { type: "string" },
        },
      },
      delivery_address: {
        type: "object",
        description: "Shipping address for delivery",
        properties: {
          address_1: { type: "string" },
          address_2: { type: "string" },
          city: { type: "string" },
          province: { type: "string" },
          postal_code: { type: "string" },
          country_code: { type: "string" },
        },
        required: ["address_1", "city", "postal_code", "country_code"],
      },
      discount_codes: {
        type: "array",
        description: "Discount or promo codes to apply",
        items: { type: "string" },
      },
      gift_cards: {
        type: "array",
        description: "Gift card codes to apply",
        items: {
          type: "object",
          properties: { code: { type: "string" } },
          required: ["code"],
        },
      },
      shipping_option_id: {
        type: "string",
        description:
          "ID of the shipping option to select. Use list_shipping_options in get_cart response to see available options.",
      },
      notes: {
        type: "string",
        description: "Order notes or special instructions",
      },
    },
    required: ["checkout_session_id"],
  },
}

const handler: ToolHandler = async (params, scope) => {
  const cartId = String(params.checkout_session_id || "")
  if (!cartId) {
    throw new Error("checkout_session_id is required")
  }

  const we = scope.resolve(Modules.WORKFLOW_ENGINE)

  // Remove items
  const removeIds = params.remove_item_ids as string[] | undefined
  if (removeIds?.length) {
    await we.run(deleteLineItemsWorkflowId, {
      input: { cart_id: cartId, ids: removeIds },
    })
  }

  // Add items
  const addItems = params.add_items as
    | Array<{ variant_id: string; quantity: number }>
    | undefined
  if (addItems?.length) {
    await we.run(addToCartWorkflowId, {
      input: {
        cart_id: cartId,
        items: addItems.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
        })),
      },
    })
  }

  // Update item quantities
  const updateItems = params.update_items as
    | Array<{ line_item_id: string; quantity: number }>
    | undefined
  if (updateItems?.length) {
    for (const item of updateItems) {
      await updateLineItemInCartWorkflow(scope).run({
        input: {
          cart_id: cartId,
          item_id: item.line_item_id,
          update: {
            quantity: item.quantity,
          },
        },
      })
    }
  }

  // Update buyer info
  const buyer = params.buyer as
    | { email?: string; first_name?: string; last_name?: string; phone_number?: string }
    | undefined
  if (buyer) {
    const updateData: Record<string, unknown> = { id: cartId }
    if (buyer.email) updateData.email = buyer.email
    if (buyer.first_name || buyer.last_name || buyer.phone_number) {
      updateData.shipping_address = {
        first_name: buyer.first_name,
        last_name: buyer.last_name,
        phone: buyer.phone_number,
      }
    }
    await we.run(updateCartWorkflowId, { input: updateData })
  }

  // Apply delivery address
  const deliveryAddress = params.delivery_address as
    | {
        address_1: string
        address_2?: string
        city: string
        province?: string
        postal_code: string
        country_code: string
      }
    | undefined
  if (deliveryAddress) {
    await we.run(updateCartWorkflowId, {
      input: {
        id: cartId,
        shipping_address: {
          address_1: deliveryAddress.address_1,
          address_2: deliveryAddress.address_2,
          city: deliveryAddress.city,
          province: deliveryAddress.province,
          postal_code: deliveryAddress.postal_code,
          country_code: deliveryAddress.country_code,
        },
      },
    })
  }

  // Apply discount codes
  const discountCodes = params.discount_codes as string[] | undefined
  if (discountCodes?.length) {
    await we.run(updateCartWorkflowId, {
      input: { id: cartId, promo_codes: discountCodes },
    })
  }

  // Apply gift cards (same mechanism as promo codes in Medusa)
  const giftCards = params.gift_cards as Array<{ code: string }> | undefined
  if (giftCards?.length) {
    await we.run(updateCartWorkflowId, {
      input: { id: cartId, promo_codes: giftCards.map((gc) => gc.code) },
    })
  }

  // Apply shipping option
  const shippingOptionId = params.shipping_option_id as string | undefined
  if (shippingOptionId) {
    await addShippingMethodToCartWorkflow(scope).run({
      input: {
        cart_id: cartId,
        options: [{ id: shippingOptionId }],
      },
    })
  }

  // Apply notes
  const notes = params.notes as string | undefined
  if (notes !== undefined) {
    const cart = await refetchCart(scope, cartId)
    await we.run(updateCartWorkflowId, {
      input: {
        id: cartId,
        metadata: { ...(cart?.metadata ?? {}), ucp_notes: notes },
      },
    })
  }

  return getCheckout(scope, cartId)
}

export const updateCartTool = { definition, handler }
