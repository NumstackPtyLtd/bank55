export type AuthType = 'api-key' | 'jwt' | 'oauth2' | 'hmac' | 'session'

export interface AuthMethod {
  readonly type: AuthType
  readonly label: string
  readonly description: string
  readonly headers: readonly string[]
  readonly tokenEndpoint: string | null
  readonly example: string
}

export function createAuthMethod(type: AuthType): AuthMethod {
  switch (type) {
    case 'api-key':
      return {
        type,
        label: 'API Key',
        description: 'Static API key passed in request header',
        headers: ['X-API-Key'],
        tokenEndpoint: null,
        example: `curl -H "X-API-Key: bank55-admin-key-2024" ...`,
      }
    case 'jwt':
      return {
        type,
        label: 'JWT Bearer',
        description: 'Login with account number + PIN to receive a signed JWT',
        headers: ['Authorization: Bearer <token>'],
        tokenEndpoint: '/auth/token',
        example: `curl -X POST /auth/token -d '{"account_number":"1055001234","pin":"1234"}'`,
      }
    case 'oauth2':
      return {
        type,
        label: 'OAuth2 Client Credentials',
        description: 'Exchange client_id + client_secret for an access token',
        headers: ['Authorization: Bearer <access_token>'],
        tokenEndpoint: '/oauth/token',
        example: `curl -X POST /oauth/token -d 'grant_type=client_credentials&client_id=X&client_secret=Y'`,
      }
    case 'hmac':
      return {
        type,
        label: 'HMAC-SHA256 Signature',
        description: 'Sign each request with a shared secret using timestamp + body',
        headers: ['X-Client-Id', 'X-Timestamp', 'X-Signature'],
        tokenEndpoint: '/auth/sign',
        example: `signature = HMAC-SHA256(secret, timestamp + "." + body)`,
      }
    case 'session':
      return {
        type,
        label: 'Session Token',
        description: 'Login with email + password to receive a session token',
        headers: ['X-Session-Token'],
        tokenEndpoint: '/auth/login',
        example: `curl -X POST /auth/login -d '{"email":"elvis@numstack.com","password":"bank55pass"}'`,
      }
  }
}
