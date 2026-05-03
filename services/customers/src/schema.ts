import type { Database } from '@bank55/shared'

export function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      id_number TEXT UNIQUE,
      email TEXT UNIQUE,
      phone TEXT,
      date_of_birth TEXT,
      address TEXT,
      country TEXT NOT NULL DEFAULT 'ZA',
      currency TEXT NOT NULL DEFAULT 'ZAR',
      risk_score INTEGER DEFAULT 0,
      kyc_tier TEXT CHECK(kyc_tier IN ('none','basic','standard','enhanced')) DEFAULT 'none',
      kyc_status TEXT CHECK(kyc_status IN ('verified','pending','failed','expired')) DEFAULT 'pending',
      kyc_verified_at TEXT,
      status TEXT CHECK(status IN ('active','suspended','closed')) DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kyc_documents (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('id_document','proof_of_address','selfie','bank_statement','tax_id')) NOT NULL,
      status TEXT CHECK(status IN ('pending','verified','rejected')) DEFAULT 'pending',
      file_ref TEXT,
      notes TEXT,
      verified_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

export function seed(db: Database) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM customers').get() as any
  if (existing.count > 0) return

  // Core demo customers (manually crafted for demo scenarios)
  const coreCustomers = [
    ['cust-001', 'Elvis', 'Magagula', '9201015800087', 'elvis@numstack.com', '+27831234567', '1992-01-01', '42 Sandton Drive, Sandton, 2196', 'ZA', 'ZAR', 12, 'enhanced', 'verified', '2024-02-01', 'active'],
    ['cust-002', 'Thabo', 'Mokoena', '8805125400083', 'thabo@email.co.za', '+27829876543', '1988-05-12', '15 Main Rd, Rosebank, 2196', 'ZA', 'ZAR', 5, 'standard', 'verified', '2024-04-10', 'active'],
    ['cust-003', 'Naledi', 'Dlamini', '9503080200081', 'naledi@email.co.za', '+27845556677', '1995-03-08', '8 Church St, Pretoria, 0002', 'ZA', 'ZAR', 78, 'basic', 'failed', null, 'suspended'],
    ['cust-004', 'Sipho', 'Nkosi', '9108240100089', 'sipho@company.co.za', '+27826667788', '1991-08-24', '101 Rivonia Blvd, Rivonia, 2128', 'ZA', 'ZAR', 3, 'enhanced', 'verified', '2025-02-15', 'active'],
    ['cust-005', 'Lindiwe', 'Zulu', '9607150300082', 'lindiwe@startup.co.za', '+27839991122', '1996-07-15', '22 Bree St, Cape Town, 8001', 'ZA', 'ZAR', 8, 'none', 'pending', null, 'active'],
    // Nigeria (CBN regulated)
    ['cust-006', 'Adebayo', 'Okonkwo', 'A00000006', 'adebayo@techng.com', '+2348012345678', '1990-03-15', '12 Victoria Island, Lagos', 'NG', 'NGN', 4, 'standard', 'verified', '2025-01-20', 'active'],
    ['cust-007', 'Chioma', 'Eze', 'A00000007', 'chioma@mail.ng', '+2348098765432', '1994-11-22', '45 Garki, Abuja', 'NG', 'NGN', 15, 'basic', 'verified', '2025-03-01', 'active'],
    ['cust-008', 'Emeka', 'Nwosu', 'A00000008', 'emeka@business.ng', '+2347011223344', '1985-07-30', '8 Allen Avenue, Ikeja, Lagos', 'NG', 'NGN', 62, 'standard', 'verified', '2024-12-10', 'active'],
    // Kenya (CBK regulated)
    ['cust-009', 'Wanjiku', 'Kamau', 'KE29384756', 'wanjiku@safari.ke', '+254712345678', '1993-02-14', 'Westlands, Nairobi', 'KE', 'KES', 6, 'standard', 'verified', '2025-02-28', 'active'],
    ['cust-010', 'Otieno', 'Odhiambo', 'KE38475612', 'otieno@work.ke', '+254723456789', '1987-09-03', 'Mombasa Road, Nairobi', 'KE', 'KES', 3, 'enhanced', 'verified', '2024-11-15', 'active'],
    // UK (FCA regulated)
    ['cust-011', 'James', 'Whitmore', 'UK112233445', 'james@london.co.uk', '+447911123456', '1982-06-18', '14 Baker Street, London W1U', 'GB', 'GBP', 2, 'enhanced', 'verified', '2024-09-01', 'active'],
    ['cust-012', 'Priya', 'Patel', 'UK556677889', 'priya@fintech.co.uk', '+447922234567', '1991-12-05', '8 Canary Wharf, London E14', 'GB', 'GBP', 7, 'standard', 'verified', '2025-01-15', 'active'],
    // USA (FinCEN regulated)
    ['cust-013', 'Michael', 'Johnson', 'US123456789', 'michael@startup.us', '+12125551234', '1988-04-22', '350 5th Ave, New York, NY 10118', 'US', 'USD', 4, 'enhanced', 'verified', '2024-08-20', 'active'],
    ['cust-014', 'Sarah', 'Chen', 'US987654321', 'sarah@west.us', '+14155559876', '1995-10-11', '1 Market St, San Francisco, CA 94105', 'US', 'USD', 1, 'standard', 'verified', '2025-03-10', 'active'],
    // EU (PSD2)
    ['cust-015', 'Hans', 'Mueller', 'DE123456789', 'hans@berlin.de', '+491511234567', '1979-08-30', 'Friedrichstr. 44, 10117 Berlin', 'DE', 'EUR', 3, 'enhanced', 'verified', '2024-07-01', 'active'],
  ]

  const insertCore = db.prepare(
    `INSERT INTO customers (id, first_name, last_name, id_number, email, phone, date_of_birth, address, country, currency, risk_score, kyc_tier, kyc_status, kyc_verified_at, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'), datetime('now'))`
  )
  for (const c of coreCustomers) insertCore.run(...c)

  // Generate 200+ additional customers across countries
  const countries = [
    { code: 'ZA', currency: 'ZAR', firstNames: ['Themba','Zanele','Mandla','Nomvula','Bongani','Sibongile','Mpho','Lerato','Kagiso','Thandeka','Tshepo','Palesa','Sizwe','Anele','Nombuso'], lastNames: ['Ndlovu','Mkhize','Cele','Shabalala','Mahlangu','Motsepe','Radebe','Khumalo','Maseko','Zwane','Molefe','Sithole','Ngcobo','Pillay','Govender'], phone: '+278' },
    { code: 'NG', currency: 'NGN', firstNames: ['Oluwaseun','Ngozi','Chukwuemeka','Aisha','Tunde','Kelechi','Yusuf','Amara','Obioma','Folake','Damilola','Ifeanyi','Hadiza','Segun','Blessing'], lastNames: ['Adeyemi','Okafor','Ibrahim','Abubakar','Ogundele','Nnamdi','Balogun','Chukwu','Musa','Oluwole','Ayodele','Okeke','Bankole','Fashola','Afolabi'], phone: '+234' },
    { code: 'KE', currency: 'KES', firstNames: ['Njeri','Kipchoge','Amina','Omondi','Wambui','Kibet','Akinyi','Mwangi','Nyambura','Korir','Atieno','Mutua','Chebet','Njoroge','Wekesa'], lastNames: ['Mwangi','Ochieng','Wanjiru','Kiplagat','Mutua','Nyong\'o','Kiptoo','Onyango','Njuguna','Kimani','Cheruiyot','Wambua','Odera','Karanja','Rotich'], phone: '+254' },
    { code: 'GB', currency: 'GBP', firstNames: ['Oliver','Amelia','George','Isla','Harry','Olivia','Jack','Emily','Thomas','Sophie','William','Grace','Henry','Mia','Charlie'], lastNames: ['Smith','Jones','Williams','Brown','Taylor','Davies','Wilson','Evans','Thomas','Roberts','Johnson','Walker','Wright','Thompson','White'], phone: '+447' },
    { code: 'US', currency: 'USD', firstNames: ['Liam','Emma','Noah','Ava','Ethan','Sophia','Mason','Isabella','Logan','Mia','Jackson','Charlotte','Aiden','Harper','Lucas'], lastNames: ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson'], phone: '+1' },
    { code: 'DE', currency: 'EUR', firstNames: ['Lukas','Anna','Felix','Lena','Maximilian','Marie','Paul','Sophie','Leon','Mia','Jonas','Lea','Tim','Hannah','Niklas'], lastNames: ['Mueller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Schaefer','Koch','Bauer','Richter','Klein'], phone: '+49' },
  ]

  const kycTiers = ['none', 'basic', 'standard', 'enhanced']
  const kycStatuses = ['pending', 'verified', 'verified', 'verified', 'failed', 'expired']
  const statuses = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'suspended', 'closed']

  const insertBulk = db.prepare(
    `INSERT OR IGNORE INTO customers (id, first_name, last_name, id_number, email, phone, date_of_birth, address, country, currency, risk_score, kyc_tier, kyc_status, kyc_verified_at, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )

  let idx = 16
  for (const country of countries) {
    const count = country.code === 'ZA' ? 60 : country.code === 'NG' ? 40 : country.code === 'KE' ? 30 : 20
    for (let i = 0; i < count; i++) {
      const fn = country.firstNames[i % country.firstNames.length]
      const ln = country.lastNames[Math.floor(i / country.firstNames.length) % country.lastNames.length]
      const id = `cust-${String(idx).padStart(3, '0')}`
      const idNum = `${country.code}${String(100000000 + idx).slice(1)}`
      const email = `${fn.toLowerCase()}.${ln.toLowerCase().replace(/'/g, '')}${i > 14 ? i : ''}@mail.${country.code.toLowerCase()}`
      const phone = `${country.phone}${String(100000000 + Math.floor(Math.random() * 900000000)).slice(0, 9)}`
      const dob = `${1970 + Math.floor(Math.random() * 35)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`
      const risk = Math.floor(Math.random() * 100)
      const tier = kycTiers[Math.floor(Math.random() * kycTiers.length)]
      const kycStatus = tier === 'none' ? 'pending' : kycStatuses[Math.floor(Math.random() * kycStatuses.length)]
      const status = risk > 70 ? 'suspended' : statuses[Math.floor(Math.random() * statuses.length)]
      const verifiedAt = kycStatus === 'verified' ? `2024-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-15` : null
      const createdAt = `202${3 + Math.floor(Math.random() * 3)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`

      insertBulk.run(id, fn, ln, idNum, email, phone, dob, null, country.code, country.currency, risk, tier, kycStatus, verifiedAt, status, createdAt, createdAt)
      idx++
    }
  }

  // Audit log
  db.exec(`
    INSERT INTO audit_log VALUES ('audit-001', 'cust-003', 'account_suspended', 'fraud-system', 'High risk score triggered automatic suspension', '2026-04-20');
    INSERT INTO audit_log VALUES ('audit-002', 'cust-001', 'kyc_verified', 'compliance-team', 'All documents verified - enhanced tier', '2024-02-01');
  `)
}
