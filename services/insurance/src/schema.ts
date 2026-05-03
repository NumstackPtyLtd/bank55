import type { Database } from '@bank55/shared'

export function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('life','vehicle','home','health','funeral','business')) NOT NULL,
      policy_number TEXT UNIQUE NOT NULL,
      status TEXT CHECK(status IN ('active','lapsed','cancelled','claimed','pending')) DEFAULT 'active',
      premium REAL NOT NULL,
      cover_amount REAL NOT NULL,
      excess REAL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT,
      payment_frequency TEXT CHECK(payment_frequency IN ('monthly','quarterly','annual')) DEFAULT 'monthly',
      next_payment_date TEXT,
      linked_asset TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS premium_payments (
      id TEXT PRIMARY KEY,
      policy_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT CHECK(status IN ('completed','pending','failed','reversed')) DEFAULT 'completed',
      reference TEXT,
      source_wallet TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (policy_id) REFERENCES policies(id)
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      policy_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_claimed REAL NOT NULL,
      amount_approved REAL,
      status TEXT CHECK(status IN ('submitted','under_review','approved','rejected','paid_out','withdrawn')) DEFAULT 'submitted',
      incident_date TEXT,
      documents TEXT,
      assessor_notes TEXT,
      payout_wallet TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (policy_id) REFERENCES policies(id)
    );

    CREATE TABLE IF NOT EXISTS policy_beneficiaries (
      id TEXT PRIMARY KEY,
      policy_id TEXT NOT NULL,
      name TEXT NOT NULL,
      relationship TEXT,
      id_number TEXT,
      percentage REAL NOT NULL,
      FOREIGN KEY (policy_id) REFERENCES policies(id)
    );
  `)
}

export function seed(db: Database) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM policies').get() as any
  if (existing.count > 0) return

  db.exec(`
    INSERT INTO policies VALUES ('pol-001', 'cust-001', 'vehicle', 'VEH-2024-0891', 'active', 1450.00, 350000.00, 5000.00, '2025-05-15', '2026-05-15', 'monthly', '2026-05-15', 'BMW 320i 2022 - CA 123 456', '2025-05-15');
    INSERT INTO policies VALUES ('pol-002', 'cust-001', 'life', 'LIFE-2024-0234', 'active', 850.00, 2000000.00, 0, '2024-01-15', NULL, 'monthly', '2026-05-15', NULL, '2024-01-15');
    INSERT INTO policies VALUES ('pol-003', 'cust-001', 'home', 'HOME-2024-0567', 'active', 1200.00, 1500000.00, 10000.00, '2024-03-01', NULL, 'monthly', '2026-05-01', '42 Sandton Drive, Sandton', '2024-03-01');
    INSERT INTO policies VALUES ('pol-004', 'cust-002', 'funeral', 'FUN-2025-0112', 'active', 350.00, 50000.00, 0, '2025-01-01', NULL, 'monthly', '2026-05-01', NULL, '2025-01-01');
    INSERT INTO policies VALUES ('pol-005', 'cust-004', 'vehicle', 'VEH-2025-0445', 'active', 2100.00, 850000.00, 8000.00, '2025-03-01', '2026-03-01', 'monthly', '2026-05-01', 'Mercedes GLC 2024 - GP 789 012', '2025-03-01');
    INSERT INTO policies VALUES ('pol-006', 'cust-004', 'health', 'HLT-2025-0678', 'active', 3500.00, 5000000.00, 500.00, '2025-01-10', NULL, 'monthly', '2026-05-10', NULL, '2025-01-10');
    INSERT INTO policies VALUES ('pol-007', 'cust-003', 'life', 'LIFE-2024-0890', 'lapsed', 500.00, 500000.00, 0, '2024-06-01', NULL, 'monthly', '2026-03-01', NULL, '2024-06-01');
  `)

  db.exec(`
    INSERT INTO premium_payments VALUES ('pp-001', 'pol-001', 1450.00, '2026-04-15', '2026-04-15', '2026-05-15', 'completed', 'INS-VEH-APR', 'wal-001', '2026-04-15');
    INSERT INTO premium_payments VALUES ('pp-002', 'pol-001', 1450.00, '2026-03-15', '2026-03-15', '2026-04-15', 'completed', 'INS-VEH-MAR', 'wal-001', '2026-03-15');
    INSERT INTO premium_payments VALUES ('pp-003', 'pol-002', 850.00, '2026-04-15', '2026-04-15', '2026-05-15', 'completed', 'INS-LIFE-APR', 'wal-001', '2026-04-15');
    INSERT INTO premium_payments VALUES ('pp-004', 'pol-003', 1200.00, '2026-04-01', '2026-04-01', '2026-05-01', 'completed', 'INS-HOME-APR', 'wal-001', '2026-04-01');
    INSERT INTO premium_payments VALUES ('pp-005', 'pol-004', 350.00, '2026-04-01', '2026-04-01', '2026-05-01', 'completed', 'INS-FUN-APR', 'wal-004', '2026-04-01');
    INSERT INTO premium_payments VALUES ('pp-006', 'pol-005', 2100.00, '2026-04-01', '2026-04-01', '2026-05-01', 'completed', 'INS-VEH2-APR', 'wal-006', '2026-04-01');
  `)

  db.exec(`
    INSERT INTO claims VALUES ('clm-001', 'pol-001', 'cust-001', 'windscreen', 'Windscreen cracked by stone on N1 highway near Midrand', 4500.00, 4500.00, 'paid_out', '2026-02-10', 'photos_damage.jpg,quote_autoglass.pdf', 'Approved - windscreen excess waiver applies', 'wal-001', '2026-02-12', '2026-02-15');
    INSERT INTO claims VALUES ('clm-002', 'pol-003', 'cust-001', 'burglary', 'Break-in at residence. Stolen: MacBook Pro, TV, sound system', 45000.00, NULL, 'under_review', '2026-04-25', 'police_report_CR123.pdf,inventory_list.pdf,photos.zip', 'Awaiting police case number and assessor visit', NULL, '2026-04-26', '2026-04-28');
    INSERT INTO claims VALUES ('clm-003', 'pol-005', 'cust-004', 'accident', 'Rear-end collision at William Nicol & Sandton Drive traffic light', 120000.00, 95000.00, 'approved', '2026-03-20', 'accident_report.pdf,repair_quote_mbsa.pdf,photos.zip', 'Partial approval - cosmetic damage on bumper excluded per policy terms', 'wal-006', '2026-03-22', '2026-04-01');
  `)

  db.exec(`
    INSERT INTO policy_beneficiaries VALUES ('pb-001', 'pol-002', 'Grace Magagula', 'mother', '6501015800081', 50.0);
    INSERT INTO policy_beneficiaries VALUES ('pb-002', 'pol-002', 'Thandi Magagula', 'sister', '9505080200085', 50.0);
    INSERT INTO policy_beneficiaries VALUES ('pb-003', 'pol-004', 'Lerato Mokoena', 'sister', '9102125400089', 100.0);
  `)
}
