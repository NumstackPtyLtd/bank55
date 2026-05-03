import type { Database } from '@bank55/shared'
import crypto from 'crypto'

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'bank55-salt').digest('hex')
}

export function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('customer','admin','support')) DEFAULT 'customer',
      status TEXT CHECK(status IN ('active','locked','pending')) DEFAULT 'active',
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      service TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      customer_id TEXT,
      service TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      params TEXT,
      result TEXT,
      success INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('info','warning','alert','success')) DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      service TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

export function seed(db: Database) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get() as any
  if (existing.count > 0) return

  db.exec(`
    INSERT INTO users VALUES ('usr-001', 'cust-001', 'elvis@numstack.com', 'Elvis Magagula', '${hashPassword('bank55pass')}', 'admin', 'active', '2026-05-02', '2024-01-15');
    INSERT INTO users VALUES ('usr-002', 'cust-002', 'thabo@email.co.za', 'Thabo Mokoena', '${hashPassword('thabo123')}', 'customer', 'active', '2026-04-30', '2024-03-20');
    INSERT INTO users VALUES ('usr-003', 'cust-003', 'naledi@email.co.za', 'Naledi Dlamini', '${hashPassword('naledi123')}', 'customer', 'locked', NULL, '2024-06-01');
    INSERT INTO users VALUES ('usr-004', 'cust-004', 'sipho@company.co.za', 'Sipho Nkosi', '${hashPassword('sipho123')}', 'customer', 'active', '2026-05-01', '2025-01-10');
    INSERT INTO users VALUES ('usr-005', 'cust-005', 'lindiwe@startup.co.za', 'Lindiwe Zulu', '${hashPassword('lindiwe123')}', 'customer', 'active', NULL, '2026-03-01');
    INSERT INTO users VALUES ('usr-006', 'cust-001', 'admin@bank55.co.za', 'Bank55 Admin', '${hashPassword('admin2024')}', 'admin', 'active', '2026-05-03', '2024-01-01');
  `)

  // Activity log showing cross-service events
  db.exec(`
    INSERT INTO activity_log VALUES ('act-001', 'usr-001', 'cust-001', 'wallets', 'transfer', '{"from":"wal-001","to":"wal-004","amount":2500,"note":"Braai money","ref":"P2P-001"}', '2026-05-02 12:00:00');
    INSERT INTO activity_log VALUES ('act-002', 'usr-001', 'cust-001', 'loans', 'payment', '{"loan_id":"loan-001","amount":5800,"ref":"LOAN-PMT-APR"}', '2026-04-15 06:00:00');
    INSERT INTO activity_log VALUES ('act-003', 'usr-001', 'cust-001', 'insurance', 'claim_submitted', '{"policy_id":"pol-003","claim_id":"clm-002","type":"burglary","amount":45000}', '2026-04-26 10:00:00');
    INSERT INTO activity_log VALUES ('act-004', 'usr-001', 'cust-001', 'insurance', 'premium_paid', '{"policy_id":"pol-001","amount":1450}', '2026-04-15 06:30:00');
    INSERT INTO activity_log VALUES ('act-005', 'usr-002', 'cust-002', 'loans', 'application_submitted', '{"type":"vehicle","amount":200000,"id":"la-001"}', '2026-04-28 09:00:00');
    INSERT INTO activity_log VALUES ('act-006', 'usr-004', 'cust-004', 'insurance', 'claim_approved', '{"claim_id":"clm-003","amount_approved":95000}', '2026-04-01 14:00:00');
    INSERT INTO activity_log VALUES ('act-007', 'usr-004', 'cust-004', 'loans', 'payment', '{"loan_id":"loan-003","amount":18500}', '2026-05-01 06:00:00');
    INSERT INTO activity_log VALUES ('act-008', 'usr-001', 'cust-001', 'wallets', 'salary_received', '{"amount":45000,"from":"Numstack"}', '2026-05-25 08:00:00');
  `)

  // Notifications
  db.exec(`
    INSERT INTO notifications VALUES ('notif-001', 'cust-001', 'info', 'Salary Received', 'ZAR 45,000.00 received from Numstack Pty Ltd', 1, 'wallets', '2026-05-25 08:00:00');
    INSERT INTO notifications VALUES ('notif-002', 'cust-001', 'warning', 'Claim Under Review', 'Your home insurance claim (CLM-002) for burglary is being reviewed', 0, 'insurance', '2026-04-28 10:00:00');
    INSERT INTO notifications VALUES ('notif-003', 'cust-001', 'alert', 'Loan Payment Due', 'Vehicle loan payment of ZAR 5,800.00 due on 15 May 2026', 0, 'loans', '2026-05-10 08:00:00');
    INSERT INTO notifications VALUES ('notif-004', 'cust-001', 'success', 'Transfer Complete', 'ZAR 2,500.00 sent to Thabo Mokoena', 1, 'wallets', '2026-05-02 12:00:01');
    INSERT INTO notifications VALUES ('notif-005', 'cust-002', 'info', 'Payment Received', 'ZAR 2,500.00 received from Elvis Magagula', 0, 'wallets', '2026-05-02 12:00:01');
    INSERT INTO notifications VALUES ('notif-006', 'cust-002', 'info', 'Loan Application Update', 'Your vehicle loan application is under review', 0, 'loans', '2026-04-29 09:00:00');
    INSERT INTO notifications VALUES ('notif-007', 'cust-004', 'success', 'Claim Approved', 'Vehicle claim approved for ZAR 95,000.00', 1, 'insurance', '2026-04-01 14:00:00');
    INSERT INTO notifications VALUES ('notif-008', 'cust-001', 'info', 'Insurance Premium Due', 'Vehicle insurance premium of ZAR 1,450.00 due 15 May', 0, 'insurance', '2026-05-10 08:00:00');
  `)
}
