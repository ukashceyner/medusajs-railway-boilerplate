// MCP JSON-RPC 2.0 endpoint for UCP tool dispatch
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { handleMcpRequest } from "../../lib/mcp/server"
import { registerAllTools } from "../../lib/mcp/tools"

// Register tools on first import
registerAllTools()

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await handleMcpRequest(req.body, req.scope)
    res.status(200).json(result)
  } catch (error) {
    res.status(200).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "Internal error" },
    })
  }
}
