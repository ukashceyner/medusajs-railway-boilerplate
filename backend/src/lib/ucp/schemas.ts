import { z } from "@medusajs/framework/zod"

export const ucpPaymentInstrumentSchema = z
  .object({
    id: z.string(),
    handler_id: z.string(),
    type: z.string(),
    selected: z.boolean().optional(),
    billing_address: z.record(z.unknown()).optional(),
    credential: z.record(z.unknown()).optional(),
    display: z.record(z.unknown()).optional(),
  })
  .passthrough()

export const ucpPaymentSchema = z
  .object({
    selected_instrument_id: z.string().optional(),
    instruments: z.array(ucpPaymentInstrumentSchema).optional(),
  })
  .passthrough()

const ucpItemSchema = z.object({
  id: z.string(),
})

const ucpLineItemCreateSchema = z.object({
  item: ucpItemSchema,
  quantity: z.number().int().min(1),
})

const ucpLineItemUpdateSchema = ucpLineItemCreateSchema.extend({
  id: z.string().optional(),
  parent_id: z.string().optional(),
})

const ucpBuyerSchema = z
  .object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
    phone_number: z.string().optional(),
  })
  .passthrough()

export const ucpCheckoutCreateSchema = z
  .object({
    line_items: z.array(ucpLineItemCreateSchema),
    buyer: ucpBuyerSchema.optional(),
    currency: z.string(),
    payment: ucpPaymentSchema.optional(),
  })
  .passthrough()

export const ucpCheckoutUpdateSchema = z
  .object({
    id: z.string().optional(),
    line_items: z.array(ucpLineItemUpdateSchema),
    buyer: ucpBuyerSchema.optional(),
    currency: z.string(),
    payment: ucpPaymentSchema.optional(),
  })
  .passthrough()

export const ucpCheckoutCompleteSchema = z
  .object({
    payment: ucpPaymentSchema.optional(),
    risk_signals: z.record(z.unknown()).optional(),
  })
  .passthrough()

export type UcpCheckoutCreateInput = z.infer<typeof ucpCheckoutCreateSchema>
export type UcpCheckoutUpdateInput = z.infer<typeof ucpCheckoutUpdateSchema>
export type UcpCheckoutCompleteInput = z.infer<typeof ucpCheckoutCompleteSchema>
export type UcpPaymentInput = z.infer<typeof ucpPaymentSchema>
