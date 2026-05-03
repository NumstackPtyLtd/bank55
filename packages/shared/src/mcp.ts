export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolResult {
  content: Array<{ type: string; text: string }>
  isError?: boolean
}

type ToolHandler = (name: string, args: Record<string, unknown>, context: any) => Promise<ToolResult>

export function createMcpRouter(serviceName: string, version: string, tools: McpTool[], handleTool: ToolHandler) {
  return async (body: any, context: any): Promise<any> => {
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((req) => handleRpc(req, context)))
      return results.filter((r) => r !== null)
    }
    return handleRpc(body, context)
  }

  async function handleRpc(req: { jsonrpc: string; method: string; params?: any; id?: number | string }, context: any) {
    switch (req.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: serviceName, version },
            capabilities: { tools: { listChanged: false } },
          },
        }
      case 'notifications/initialized':
        return null
      case 'tools/list':
        return { jsonrpc: '2.0', id: req.id, result: { tools } }
      case 'tools/call': {
        const { name, arguments: args } = req.params
        const tool = tools.find((t) => t.name === name)
        if (!tool) {
          return { jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } }
        }
        const result = await handleTool(name, args || {}, context)
        return { jsonrpc: '2.0', id: req.id, result }
      }
      default:
        return { jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } }
    }
  }
}
