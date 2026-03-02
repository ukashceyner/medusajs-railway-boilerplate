import { MedusaError } from "@medusajs/framework/utils"

import { parseUcpAgentProfile, toProtocolError } from "../protocol"

describe("ucp protocol helpers", () => {
  it("parses profile from UCP-Agent header", () => {
    const profile = parseUcpAgentProfile(
      'profile="https://platform.example/.well-known/ucp"'
    )

    expect(profile).toBe("https://platform.example/.well-known/ucp")
  })

  it("maps profile validation errors to 422/424", () => {
    const malformed = toProtocolError(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "ucp_profile:malformed:invalid json"
      )
    )
    const fetchFailed = toProtocolError(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "ucp_profile:fetch_failed:timeout"
      )
    )

    expect(malformed.status).toBe(422)
    expect(fetchFailed.status).toBe(424)
  })

  it("maps signature validation errors to 401", () => {
    const signatureError = toProtocolError(
      new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "ucp_signature:missing_headers:missing signature"
      )
    )

    expect(signatureError.status).toBe(401)
    expect(signatureError.body.code).toBe("missing_headers")
  })
})
