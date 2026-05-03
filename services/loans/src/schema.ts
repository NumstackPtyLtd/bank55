import type { Database } from '@bank55/shared'

export function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('vehicle','personal','home','student','business')) NOT NULL,
      original_amount REAL NOT NULL,
      balance REAL NOT NULL,
      interest_rate REAL NOT NULL,
      monthly_payment REAL NOT NULL,
      term_months INTEGER NOT NULL,
      months_paid INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('active','paid_off','defaulted','restructured','pending_approval')) DEFAULT 'active',
      next_payment_date TEXT,
      disbursement_wallet TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL,
      amount REAL NOT NULL,
      principal REAL NOT NULL,
      interest REAL NOT NULL,
      payment_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('completed','pending','failed','reversed')) DEFAULT 'completed',
      reference TEXT,
      source_wallet TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (loan_id) REFERENCES loans(id)
    );

    CREATE TABLE IF NOT EXISTS loan_schedule (
      id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL,
      payment_number INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      principal REAL NOT NULL,
      interest REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT CHECK(status IN ('upcoming','paid','overdue','skipped')) DEFAULT 'upcoming',
      FOREIGN KEY (loan_id) REFERENCES loans(id)
    );

    CREATE TABLE IF NOT EXISTS loan_applications (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_requested REAL NOT NULL,
      term_months INTEGER NOT NULL,
      purpose TEXT,
      monthly_income REAL,
      status TEXT CHECK(status IN ('submitted','under_review','approved','rejected','disbursed')) DEFAULT 'submitted',
      offered_rate REAL,
      decision_notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

export function seed(db: Database) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM loans').get() as any
  if (existing.count > 0) return

  db.exec(`
    INSERT INTO loans VALUES ('loan-001', 'cust-001', 'vehicle', 350000.00, 285000.00, 11.50, 5800.00, 60, 12, 'active', '2026-05-15', 'wal-001', '2025-05-15');
    INSERT INTO loans VALUES ('loan-002', 'cust-002', 'personal', 25000.00, 18500.00, 24.00, 1200.00, 24, 6, 'active', '2026-05-10', 'wal-004', '2025-11-10');
    INSERT INTO loans VALUES ('loan-003', 'cust-004', 'home', 1800000.00, 1650000.00, 10.75, 18500.00, 240, 10, 'active', '2026-06-01', 'wal-006', '2025-07-01');
    INSERT INTO loans VALUES ('loan-004', 'cust-001', 'student', 85000.00, 0, 9.25, 2100.00, 48, 48, 'paid_off', NULL, 'wal-001', '2020-01-15');
  `)

  db.exec(`
    INSERT INTO loan_payments VALUES ('lp-001', 'loan-001', 5800.00, 3067.00, 2733.00, '2026-04-15', 'completed', 'LOAN-PMT-APR', 'wal-001', '2026-04-15');
    INSERT INTO loan_payments VALUES ('lp-002', 'loan-001', 5800.00, 3097.00, 2703.00, '2026-03-15', 'completed', 'LOAN-PMT-MAR', 'wal-001', '2026-03-15');
    INSERT INTO loan_payments VALUES ('lp-003', 'loan-001', 5800.00, 3127.00, 2673.00, '2026-02-15', 'completed', 'LOAN-PMT-FEB', 'wal-001', '2026-02-15');
    INSERT INTO loan_payments VALUES ('lp-004', 'loan-002', 1200.00, 830.00, 370.00, '2026-04-10', 'completed', 'LOAN-PMT-APR-02', 'wal-004', '2026-04-10');
    INSERT INTO loan_payments VALUES ('lp-005', 'loan-002', 1200.00, 813.00, 387.00, '2026-03-10', 'completed', 'LOAN-PMT-MAR-02', 'wal-004', '2026-03-10');
    INSERT INTO loan_payments VALUES ('lp-006', 'loan-003', 18500.00, 3713.00, 14787.00, '2026-05-01', 'completed', 'LOAN-PMT-MAY-03', 'wal-006', '2026-05-01');
  `)

  db.exec(`
    INSERT INTO loan_schedule VALUES ('ls-001', 'loan-001', 13, '2026-05-15', 3098.00, 2702.00, 5800.00, 'upcoming');
    INSERT INTO loan_schedule VALUES ('ls-002', 'loan-001', 14, '2026-06-15', 3128.00, 2672.00, 5800.00, 'upcoming');
    INSERT INTO loan_schedule VALUES ('ls-003', 'loan-001', 15, '2026-07-15', 3158.00, 2642.00, 5800.00, 'upcoming');
    INSERT INTO loan_schedule VALUES ('ls-004', 'loan-002', 7, '2026-05-10', 847.00, 353.00, 1200.00, 'upcoming');
    INSERT INTO loan_schedule VALUES ('ls-005', 'loan-002', 8, '2026-06-10', 864.00, 336.00, 1200.00, 'upcoming');
    INSERT INTO loan_schedule VALUES ('ls-006', 'loan-003', 11, '2026-06-01', 3746.00, 14754.00, 18500.00, 'upcoming');
  `)

  db.exec(`
    INSERT INTO loan_applications VALUES ('la-001', 'cust-002', 'vehicle', 200000.00, 60, 'Purchase Toyota Corolla 2025', 18000.00, 'under_review', 12.50, NULL, '2026-04-28');
    INSERT INTO loan_applications VALUES ('la-002', 'cust-005', 'personal', 50000.00, 12, 'Business startup costs', 25000.00, 'submitted', NULL, NULL, '2026-05-01');
  `)
}
