import type { Credential } from '../../domain'

export function getCredentialCatalog(): Record<string, readonly Credential[]> {
  return {
    platform: [
      { service: 'platform', identity: 'elvis@numstack.com', secret: 'bank55pass', role: 'admin', customerName: 'Elvis Magagula' },
      { service: 'platform', identity: 'thabo@email.co.za', secret: 'thabo123', role: 'customer', customerName: 'Thabo Mokoena' },
      { service: 'platform', identity: 'sipho@company.co.za', secret: 'sipho123', role: 'customer', customerName: 'Sipho Nkosi' },
      { service: 'platform', identity: 'admin@bank55.co.za', secret: 'admin2024', role: 'admin', customerName: 'Bank55 Admin' },
    ],
    customers: [
      { service: 'customers', identity: 'bank55-admin-key-2024', secret: '', role: 'admin', customerName: 'Admin Console' },
      { service: 'customers', identity: 'bank55-platform-key', secret: '', role: 'service', customerName: 'Platform Service' },
      { service: 'customers', identity: 'bank55-loans-key', secret: '', role: 'readonly', customerName: 'Loans Service' },
    ],
    wallets: [
      { service: 'wallets', identity: '1055001234', secret: '1234', role: 'customer', customerName: 'Elvis (Cheque)' },
      { service: 'wallets', identity: '1055005678', secret: '1234', role: 'customer', customerName: 'Elvis (Savings)' },
      { service: 'wallets', identity: '1055002345', secret: '5678', role: 'customer', customerName: 'Thabo (Cheque)' },
      { service: 'wallets', identity: '1055004567', secret: '4321', role: 'customer', customerName: 'Sipho (Cheque)' },
    ],
    loans: [
      { service: 'loans', identity: 'elvis-loans-client', secret: 'elvis-secret-2024', role: 'customer', customerName: 'Elvis' },
      { service: 'loans', identity: 'thabo-loans-client', secret: 'thabo-secret-2024', role: 'customer', customerName: 'Thabo' },
      { service: 'loans', identity: 'bank55-platform', secret: 'platform-secret-2024', role: 'admin', customerName: 'Platform (Admin)' },
    ],
    insurance: [
      { service: 'insurance', identity: 'ins-elvis', secret: 'hmac-elvis-secret-x9k2m', role: 'customer', customerName: 'Elvis' },
      { service: 'insurance', identity: 'ins-thabo', secret: 'hmac-thabo-secret-p4j7n', role: 'customer', customerName: 'Thabo' },
      { service: 'insurance', identity: 'ins-admin', secret: 'hmac-admin-secret-z7y6x', role: 'admin', customerName: 'Admin' },
    ],
  }
}
