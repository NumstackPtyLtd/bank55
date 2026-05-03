export type Port = number & { readonly __brand: 'Port' }

export function isValidPort(value: number): value is Port {
  return Number.isInteger(value) && value > 0 && value < 65536
}
