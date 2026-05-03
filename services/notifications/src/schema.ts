import type { Database } from '@bank55/shared'

export function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      channel TEXT CHECK(channel IN ('email','sms','push','in_app')) DEFAULT 'email',
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      metadata TEXT,
      status TEXT CHECK(status IN ('pending','sent','failed','read')) DEFAULT 'pending',
      sender TEXT NOT NULL,
      error TEXT,
      sent_at TEXT,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      subject_template TEXT NOT NULL,
      body_template TEXT NOT NULL,
      channel TEXT DEFAULT 'email',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS preferences (
      customer_id TEXT PRIMARY KEY,
      email_enabled INTEGER DEFAULT 1,
      sms_enabled INTEGER DEFAULT 1,
      push_enabled INTEGER DEFAULT 1,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT
    );
  `)
}

export function seed(db: Database) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM notifications').get() as any
  if (existing.count > 0) return

  // Templates
  db.exec(`
    INSERT INTO templates VALUES ('tpl-001', 'transfer_sent', 'transfer', 'Transfer Sent: ZAR {{amount}}', 'You sent ZAR {{amount}} to {{recipient}}.\n\nReference: {{reference}}\nDate: {{date}}', 'email', 1, datetime('now'));
    INSERT INTO templates VALUES ('tpl-002', 'transfer_received', 'transfer', 'Payment Received: ZAR {{amount}}', 'You received ZAR {{amount}} from {{sender}}.\n\nReference: {{reference}}\nNew Balance: ZAR {{balance}}', 'email', 1, datetime('now'));
    INSERT INTO templates VALUES ('tpl-003', 'loan_payment', 'payment', 'Loan Payment Confirmed', 'Your loan payment of ZAR {{amount}} has been processed.\n\nLoan: {{loan_type}} ({{loan_id}})\nRemaining Balance: ZAR {{balance}}\nNext Payment: {{next_date}}', 'email', 1, datetime('now'));
    INSERT INTO templates VALUES ('tpl-004', 'premium_payment', 'payment', 'Insurance Premium Paid', 'Your {{policy_type}} insurance premium of ZAR {{amount}} has been processed.\n\nPolicy: {{policy_number}}\nNext Due: {{next_date}}', 'email', 1, datetime('now'));
    INSERT INTO templates VALUES ('tpl-005', 'claim_submitted', 'insurance', 'Claim Submitted: {{claim_type}}', 'Your insurance claim has been submitted.\n\nClaim ID: {{claim_id}}\nType: {{claim_type}}\nAmount: ZAR {{amount}}\nStatus: Submitted\n\nWe will review your claim within 5 business days.', 'email', 1, datetime('now'));
    INSERT INTO templates VALUES ('tpl-006', 'claim_approved', 'insurance', 'Claim Approved: ZAR {{amount}}', 'Your insurance claim has been approved.\n\nClaim ID: {{claim_id}}\nApproved Amount: ZAR {{amount}}\n\nFunds will be paid to your linked account within 3 business days.', 'email', 1, datetime('now'));
    INSERT INTO templates VALUES ('tpl-007', 'security_alert', 'security', 'Security Alert: {{alert_type}}', '{{message}}\n\nIf this was not you, please contact us immediately.\nDate: {{date}}', 'email', 1, datetime('now'));
    INSERT INTO templates VALUES ('tpl-008', 'kyc_verified', 'info', 'KYC Verification Complete', 'Your identity has been verified. You now have full access to all Bank55 services.\n\nTier: {{tier}}', 'email', 1, datetime('now'));
    INSERT INTO templates VALUES ('tpl-009', 'payment_due', 'payment', 'Payment Due: {{type}} - ZAR {{amount}}', 'A payment is due soon.\n\nType: {{type}}\nAmount: ZAR {{amount}}\nDue Date: {{due_date}}\n\nPlease ensure sufficient funds are available.', 'email', 1, datetime('now'));
  `)

  // Sample sent notifications
  db.exec(`
    INSERT INTO notifications VALUES ('notif-s001', 'cust-001', 'email', 'transfer', 'Transfer Sent: ZAR 2,500.00', 'You sent ZAR 2,500.00 to Thabo Mokoena.\n\nReference: P2P-001\nDate: 2026-05-02', '{"ref":"P2P-001","amount":2500}', 'sent', 'Wallets Service', NULL, '2026-05-02 12:00:01', NULL, '2026-05-02 12:00:01');
    INSERT INTO notifications VALUES ('notif-s002', 'cust-002', 'email', 'transfer', 'Payment Received: ZAR 2,500.00', 'You received ZAR 2,500.00 from Elvis Magagula.\n\nReference: P2P-001', '{"ref":"P2P-001","amount":2500}', 'sent', 'Wallets Service', NULL, '2026-05-02 12:00:01', NULL, '2026-05-02 12:00:01');
    INSERT INTO notifications VALUES ('notif-s003', 'cust-001', 'email', 'payment', 'Loan Payment Confirmed', 'Your loan payment of ZAR 5,800.00 has been processed.\n\nLoan: Vehicle (loan-001)\nRemaining: ZAR 285,000.00', '{"loan_id":"loan-001","amount":5800}', 'sent', 'Loans Service', NULL, '2026-04-15 06:00:01', NULL, '2026-04-15 06:00:00');
    INSERT INTO notifications VALUES ('notif-s004', 'cust-001', 'email', 'payment', 'Insurance Premium Paid', 'Your vehicle insurance premium of ZAR 1,450.00 has been processed.\n\nPolicy: VEH-2024-0891', '{"policy_id":"pol-001","amount":1450}', 'sent', 'Insurance Service', NULL, '2026-04-15 06:30:01', NULL, '2026-04-15 06:30:00');
    INSERT INTO notifications VALUES ('notif-s005', 'cust-001', 'email', 'insurance', 'Claim Submitted: burglary', 'Your insurance claim has been submitted.\n\nClaim ID: clm-002\nType: burglary\nAmount: ZAR 45,000.00', '{"claim_id":"clm-002"}', 'sent', 'Insurance Service', NULL, '2026-04-26 10:00:01', NULL, '2026-04-26 10:00:00');
    INSERT INTO notifications VALUES ('notif-s006', 'cust-004', 'email', 'insurance', 'Claim Approved: ZAR 95,000.00', 'Your vehicle claim has been approved for ZAR 95,000.00.', '{"claim_id":"clm-003","amount":95000}', 'sent', 'Insurance Service', NULL, '2026-04-01 14:00:01', NULL, '2026-04-01 14:00:00');
    INSERT INTO notifications VALUES ('notif-s007', 'cust-003', 'email', 'security', 'Security Alert: Account Frozen', 'Your account has been frozen due to suspicious activity.\n\nIf this was not you, contact us immediately.', '{"reason":"fraud_detection"}', 'sent', 'Bank55 Platform', NULL, '2026-04-20 04:15:00', NULL, '2026-04-20 04:15:00');
  `)

  // Preferences
  db.exec(`
    INSERT INTO preferences VALUES ('cust-001', 1, 1, 1, '22:00', '07:00');
    INSERT INTO preferences VALUES ('cust-002', 1, 0, 1, NULL, NULL);
    INSERT INTO preferences VALUES ('cust-004', 1, 1, 1, '23:00', '06:00');
  `)
}
