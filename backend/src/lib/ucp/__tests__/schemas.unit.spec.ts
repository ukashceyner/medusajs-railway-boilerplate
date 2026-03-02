import {
  ucpCheckoutCreateSchema,
  ucpCheckoutUpdateSchema,
} from "../schemas"

describe("ucp schema validation", () => {
  it("requires payment in checkout create", () => {
    const parsed = ucpCheckoutCreateSchema.safeParse({
      line_items: [{ item: { id: "variant_123" }, quantity: 1 }],
      currency: "USD",
    })

    expect(parsed.success).toBe(false)
  })

  it("requires payment in checkout update", () => {
    const parsed = ucpCheckoutUpdateSchema.safeParse({
      id: "chk_123",
      line_items: [{ item: { id: "variant_123" }, quantity: 1 }],
      currency: "USD",
    })

    expect(parsed.success).toBe(false)
  })
})
