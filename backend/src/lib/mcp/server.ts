import type { Scope } from "../ucp/service"

export type ToolInputSchema = {
  type: "object"
  properties: Record<string, unknown>
  required?: string[]
}

export type ToolDefinition = {
  name: string
  description: string
  inputSchema: ToolInputSchema
}

export type ToolHandler = (
  params: Record<string, unknown>,
  scope: Scope
) => Promise<unknown>

type JsonRpcRequest = {
  jsonrpc: "2.0"
  id?: string | number | null
  method: string
  params?: unknown
}

type JsonRpcResponse = {
  jsonrpc: "2.0"
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

const tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>()

export function registerTool(
  name: string,
  definition: ToolDefinition,
  handler: ToolHandler
) {
  tools.set(name, { definition, handler })
}

const jsonRpcError = (
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
})

const jsonRpcResult = (
  id: string | number | null,
  result: unknown
): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  result,
})

const handleInitialize = (id: string | number | null): JsonRpcResponse =>
  jsonRpcResult(id, {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: "medusa-ucp-mcp",
      version: "1.0.0",
    },
  })

const handleToolsList = (id: string | number | null): JsonRpcResponse => {
  const toolList = Array.from(tools.values()).map((t) => t.definition)
  return jsonRpcResult(id, { tools: toolList })
}

const handleToolsCall = async (
  id: string | number | null,
  params: unknown,
  scope: Scope
): Promise<JsonRpcResponse> => {
  if (!params || typeof params !== "object") {
    return jsonRpcError(id, -32602, "Invalid params")
  }

  const { name, arguments: args } = params as {
    name?: string
    arguments?: Record<string, unknown>
  }

  if (!name || typeof name !== "string") {
    return jsonRpcError(id, -32602, "Missing tool name")
  }

  const tool = tools.get(name)
  if (!tool) {
    return jsonRpcError(id, -32602, `Unknown tool: ${name}`)
  }

  try {
    const result = await tool.handler(args ?? {}, scope)
    return jsonRpcResult(id, {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result),
        },
      ],
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tool execution failed"
    return jsonRpcResult(id, {
      content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      isError: true,
    })
  }
}

export async function handleMcpRequest(
  body: unknown,
  scope: Scope
): Promise<JsonRpcResponse | JsonRpcResponse[]> {
  if (Array.isArray(body)) {
    const results = await Promise.all(
      body.map((req) => handleSingleRequest(req, scope))
    )
    return results
  }

  return handleSingleRequest(body, scope)
}

async function handleSingleRequest(
  body: unknown,
  scope: Scope
): Promise<JsonRpcResponse> {
  if (!body || typeof body !== "object") {
    return jsonRpcError(null, -32700, "Parse error")
  }

  const req = body as JsonRpcRequest
  const id = req.id ?? null

  if (req.jsonrpc !== "2.0" || !req.method) {
    return jsonRpcError(id, -32600, "Invalid Request")
  }

  switch (req.method) {
    case "initialize":
      return handleInitialize(id)

    case "notifications/initialized":
      return jsonRpcResult(id, {})

    case "tools/list":
      return handleToolsList(id)

    case "tools/call":
      return handleToolsCall(id, req.params, scope)

    default:
      return jsonRpcError(id, -32601, `Method not found: ${req.method}`)
  }
}
