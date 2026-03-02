import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api }) => {
    describe("UCP MVP", () => {
      const ucpAgentHeader =
        'profile="https://platform.example/.well-known/ucp"'

      it("serves discovery at /.well-known/ucp", async () => {
        const response = await api.get("/.well-known/ucp")

        expect(response.status).toBe(200)
        expect(response.body?.ucp?.version).toBeDefined()
        expect(response.body?.ucp?.services?.["dev.ucp.shopping"]).toBeDefined()
        expect(
          response.body?.ucp?.capabilities?.["dev.ucp.shopping.checkout"]
        ).toBeDefined()
      })

      it("requires UCP-Agent header on checkout routes", async () => {
        const response = await api.post("/ucp/v1/checkout-sessions").send({})

        expect(response.status).toBe(400)
        expect(response.body?.code).toBe("invalid_request")
      })

      it("returns not found for unknown checkout id", async () => {
        const response = await api
          .get("/ucp/v1/checkout-sessions/chk_missing")
          .set("UCP-Agent", ucpAgentHeader)

        expect(response.status).toBe(404)
        expect(response.body?.code).toBe("not_found")
      })
    })
  },
})
