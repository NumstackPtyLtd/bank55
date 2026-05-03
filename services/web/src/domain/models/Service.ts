import type { AuthMethod } from '../value-objects/AuthMethod'
import type { Tool } from '../value-objects/Tool'
import type { Port } from '../value-objects/Port'

export interface Service {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly port: Port
  readonly auth: AuthMethod
  readonly tools: readonly Tool[]
  readonly healthEndpoint: string
  readonly mcpEndpoint: string
}

export function createService(props: {
  id: string
  name: string
  description: string
  port: number
  auth: AuthMethod
  tools: readonly Tool[]
}): Service {
  return {
    ...props,
    port: props.port as Port,
    healthEndpoint: `/health`,
    mcpEndpoint: `/mcp`,
  }
}
