import type { Database } from '@bank55/shared'

export function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('cheque','savings','credit','fixed_deposit')) NOT NULL,
      account_number TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 0,
      available_balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'ZAR',
      status TEXT CHECK(status IN ('active','frozen','closed','dormant')) DEFAULT 'active',
      overdraft_limit REAL DEFAULT 0,
      daily_limit REAL DEFAULT 50000,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallet_credentials (
      wallet_id TEXT PRIMARY KEY,
      pin TEXT NOT NULL,
      failed_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('debit','credit')) NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT,
      category TEXT,
      reference TEXT,
      counterparty TEXT,
      counterparty_wallet TEXT,
      channel TEXT CHECK(channel IN ('branch','atm','online','mobile','pos','eft','internal')) DEFAULT 'online',
      status TEXT CHECK(status IN ('completed','pending','failed','reversed')) DEFAULT 'completed',
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS scheduled_payments (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      recipient_wallet TEXT,
      recipient_name TEXT,
      amount REAL NOT NULL,
      frequency TEXT CHECK(frequency IN ('once','weekly','monthly')) DEFAULT 'once',
      next_run TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('active','paused','completed','cancelled')) DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    );
  `)
}

export function seed(db: Database) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM wallets').get() as any
  if (existing.count > 0) return

  // Wallets
  db.exec(`
    INSERT INTO wallets VALUES ('wal-001', 'cust-001', 'cheque', '1055001234', 24500.75, 29500.75, 'ZAR', 'active', 5000.00, 50000, '2024-01-15');
    INSERT INTO wallets VALUES ('wal-002', 'cust-001', 'savings', '1055005678', 180000.00, 180000.00, 'ZAR', 'active', 0, 25000, '2024-01-15');
    INSERT INTO wallets VALUES ('wal-003', 'cust-001', 'credit', '1055009999', -12500.00, 37500.00, 'ZAR', 'active', 50000.00, 50000, '2024-02-01');
    INSERT INTO wallets VALUES ('wal-004', 'cust-002', 'cheque', '1055002345', 3200.50, 5200.50, 'ZAR', 'active', 2000.00, 30000, '2024-03-20');
    INSERT INTO wallets VALUES ('wal-005', 'cust-003', 'cheque', '1055003456', 0, 0, 'ZAR', 'frozen', 0, 0, '2024-06-01');
    INSERT INTO wallets VALUES ('wal-006', 'cust-004', 'cheque', '1055004567', 89000.00, 99000.00, 'ZAR', 'active', 10000.00, 100000, '2025-01-10');
    INSERT INTO wallets VALUES ('wal-007', 'cust-004', 'savings', '1055008888', 450000.00, 450000.00, 'ZAR', 'active', 0, 50000, '2025-01-10');
    INSERT INTO wallets VALUES ('wal-008', 'cust-005', 'cheque', '1055006789', 15000.00, 15000.00, 'ZAR', 'active', 0, 20000, '2026-03-01');
  `)

  // Credentials
  db.exec(`
    INSERT INTO wallet_credentials VALUES ('wal-001', '1234', 0, NULL);
    INSERT INTO wallet_credentials VALUES ('wal-002', '1234', 0, NULL);
    INSERT INTO wallet_credentials VALUES ('wal-003', '1234', 0, NULL);
    INSERT INTO wallet_credentials VALUES ('wal-004', '5678', 0, NULL);
    INSERT INTO wallet_credentials VALUES ('wal-005', '9999', 0, NULL);
    INSERT INTO wallet_credentials VALUES ('wal-006', '4321', 0, NULL);
    INSERT INTO wallet_credentials VALUES ('wal-007', '4321', 0, NULL);
    INSERT INTO wallet_credentials VALUES ('wal-008', '1111', 0, NULL);
  `)

  // Transactions - rich history showing inter-user payments
  db.exec(`
    INSERT INTO transactions VALUES ('txn-001', 'wal-001', 'credit', 45000.00, 45000.00, 'Salary - Numstack Pty Ltd', 'income', 'SAL-2026-04', 'Numstack', NULL, 'eft', 'completed', NULL, '2026-04-25 08:00:00');
    INSERT INTO transactions VALUES ('txn-002', 'wal-001', 'debit', 15000.00, 30000.00, 'Rent - April', 'housing', 'RENT-04', 'Sandton Properties', NULL, 'eft', 'completed', NULL, '2026-04-01 07:00:00');
    INSERT INTO transactions VALUES ('txn-003', 'wal-001', 'debit', 1250.00, 28750.00, 'Woolworths Food', 'groceries', NULL, 'Woolworths', NULL, 'pos', 'completed', NULL, '2026-05-01 14:30:00');
    INSERT INTO transactions VALUES ('txn-004', 'wal-001', 'debit', 899.00, 27851.00, 'Netflix Subscription', 'entertainment', 'NFLX-05', 'Netflix', NULL, 'online', 'completed', NULL, '2026-04-28 00:01:00');
    INSERT INTO transactions VALUES ('txn-005', 'wal-001', 'debit', 3500.00, 24351.00, 'Transfer to Savings', 'transfer', 'TRF-INT-001', 'Self - Savings', 'wal-002', 'internal', 'completed', NULL, '2026-04-26 09:15:00');
    INSERT INTO transactions VALUES ('txn-006', 'wal-002', 'credit', 3500.00, 183500.00, 'Transfer from Cheque', 'transfer', 'TRF-INT-001', 'Self - Cheque', 'wal-001', 'internal', 'completed', NULL, '2026-04-26 09:15:00');
    INSERT INTO transactions VALUES ('txn-007', 'wal-001', 'debit', 5800.00, 18551.00, 'Vehicle Loan Payment', 'loan_payment', 'LOAN-PMT-APR', 'Bank55 Loans', NULL, 'eft', 'completed', '{"loan_id":"loan-001"}', '2026-04-15 06:00:00');
    INSERT INTO transactions VALUES ('txn-008', 'wal-001', 'debit', 1450.00, 17101.00, 'Vehicle Insurance Premium', 'insurance', 'INS-PMT-APR', 'Bank55 Insurance', NULL, 'eft', 'completed', '{"policy_id":"pol-001"}', '2026-04-15 06:30:00');
    INSERT INTO transactions VALUES ('txn-009', 'wal-001', 'debit', 850.00, 16251.00, 'Life Insurance Premium', 'insurance', 'LIFE-PMT-APR', 'Bank55 Insurance', NULL, 'eft', 'completed', '{"policy_id":"pol-002"}', '2026-04-15 06:30:00');
    INSERT INTO transactions VALUES ('txn-010', 'wal-001', 'debit', 450.00, 15801.00, 'Engen Fuel', 'transport', NULL, 'Engen Sandton', NULL, 'pos', 'completed', NULL, '2026-04-30 18:22:00');
    INSERT INTO transactions VALUES ('txn-011', 'wal-001', 'debit', 2100.00, 13701.00, 'Discovery Health', 'medical', 'DIS-05', 'Discovery', NULL, 'eft', 'completed', NULL, '2026-05-01 06:00:00');
    INSERT INTO transactions VALUES ('txn-012', 'wal-001', 'credit', 45000.00, 58701.00, 'Salary - Numstack Pty Ltd', 'income', 'SAL-2026-05', 'Numstack', NULL, 'eft', 'completed', NULL, '2026-05-25 08:00:00');
    INSERT INTO transactions VALUES ('txn-013', 'wal-001', 'debit', 2500.00, 24500.75, 'Payment to Thabo Mokoena', 'transfer', 'P2P-001', 'Thabo Mokoena', 'wal-004', 'internal', 'completed', '{"note":"Braai money"}', '2026-05-02 12:00:00');
    INSERT INTO transactions VALUES ('txn-014', 'wal-004', 'credit', 2500.00, 5700.50, 'Payment from Elvis Magagula', 'transfer', 'P2P-001', 'Elvis Magagula', 'wal-001', 'internal', 'completed', '{"note":"Braai money"}', '2026-05-02 12:00:00');
    INSERT INTO transactions VALUES ('txn-015', 'wal-004', 'debit', 150.00, 5550.50, 'Uber Trip', 'transport', NULL, 'Uber', NULL, 'mobile', 'completed', NULL, '2026-05-01 22:10:00');
    INSERT INTO transactions VALUES ('txn-016', 'wal-004', 'credit', 8500.00, 8650.50, 'Salary', 'income', 'SAL-05', 'TechCorp', NULL, 'eft', 'completed', NULL, '2026-04-25 08:00:00');
    INSERT INTO transactions VALUES ('txn-017', 'wal-004', 'debit', 1200.00, 3200.50, 'Personal Loan Payment', 'loan_payment', 'LOAN-PMT-APR-02', 'Bank55 Loans', NULL, 'eft', 'completed', '{"loan_id":"loan-002"}', '2026-04-10 06:00:00');
    INSERT INTO transactions VALUES ('txn-018', 'wal-005', 'debit', 12000.00, -12000.00, 'Foreign ATM Withdrawal', 'cash', NULL, 'ATM Lagos Nigeria', NULL, 'atm', 'completed', '{"flagged":true,"location":"Lagos, NG"}', '2026-04-20 03:45:00');
    INSERT INTO transactions VALUES ('txn-019', 'wal-005', 'debit', 8500.00, -20500.00, 'Online Purchase - Unverified', 'shopping', NULL, 'Unknown Merchant', NULL, 'online', 'pending', '{"flagged":true}', '2026-04-20 04:12:00');
    INSERT INTO transactions VALUES ('txn-020', 'wal-006', 'debit', 18500.00, 70500.00, 'Home Loan Payment', 'loan_payment', 'LOAN-PMT-MAY', 'Bank55 Loans', NULL, 'eft', 'completed', '{"loan_id":"loan-003"}', '2026-05-01 06:00:00');
    INSERT INTO transactions VALUES ('txn-021', 'wal-002', 'credit', 5000.00, 180000.00, 'Interest Earned - April', 'interest', 'INT-APR', 'Bank55', NULL, 'online', 'completed', NULL, '2026-04-30 23:59:00');
  `)

  // Scheduled payments
  db.exec(`
    INSERT INTO scheduled_payments VALUES ('sp-001', 'wal-001', NULL, 'Sandton Properties', 15000.00, 'monthly', '2026-06-01', 'Rent Payment', 'active', '2024-02-01');
    INSERT INTO scheduled_payments VALUES ('sp-002', 'wal-001', NULL, 'Bank55 Loans', 5800.00, 'monthly', '2026-05-15', 'Vehicle Loan', 'active', '2025-05-15');
    INSERT INTO scheduled_payments VALUES ('sp-003', 'wal-001', 'wal-002', 'Self - Savings', 3500.00, 'monthly', '2026-05-26', 'Savings Transfer', 'active', '2024-03-01');
  `)
}
