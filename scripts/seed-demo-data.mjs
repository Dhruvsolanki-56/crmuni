// Seeds the LOCAL D1 database with a large, realistic volume of demo data
// (1000+ leads plus every dependent record: accounts, interactions, AI
// extractions, tasks, meetings, opportunities, quotations, RFQs, knowledge
// base, etc.) so every screen and list in the app can be previewed full of
// data instead of empty or lightly populated.
//
// This never touches the real Cloudflare account - see assertLocalOnly()
// and scripts/local-cloudflare-config.mjs. It opens the exact same local D1
// file `npm run dev` uses (via Miniflare) and inserts rows directly with
// raw SQL, respecting every CHECK trigger the schema enforces (event
// status, opportunity/quotation/RFQ lifecycle rules, task/meeting status
// enums, workspace plan member limits, etc.) so the seeded data behaves
// exactly like data a real user created through the UI.
//
// Usage:
//   node scripts/seed-demo-data.mjs             seed ~1000 leads (default)
//   node scripts/seed-demo-data.mjs --leads=300  seed a smaller amount
//   node scripts/seed-demo-data.mjs --reset      wipe the local DB and
//                                                reapply migrations first
//   node scripts/seed-demo-data.mjs --if-empty   do nothing when the database
//                                                already holds a workspace,
//                                                so first-run setup can call
//                                                this without ever clobbering
//                                                work already in progress
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import {
  D1_BINDING,
  LOCAL_D1_DATABASE_ID,
  LOCAL_PERSIST_PATH,
  assertLocalOnly,
} from './local-cloudflare-config.mjs';

assertLocalOnly();

const root = resolve(import.meta.dirname, '..');
// One definition, shared by the pre-seed guard and the workspace insert.
const DEMO_SLUG = 'global-expo-solutions';
const args = process.argv.slice(2);
const leadTarget = Number(
  (args.find((a) => a.startsWith('--leads=')) || '--leads=1000').split(
    '=',
  )[1],
);
if (args.includes('--reset')) {
  execSync('node scripts/db-local-init.mjs --reset', {
    cwd: root,
    stdio: 'inherit',
  });
}

// Whichever identity `npm run dev` actually signs the browser in as locally
// (see lib/db.ts requestUser() and .env) must have a real membership in the
// seeded workspace, or it's invisible to the one person opening the app -
// tenant isolation correctly hides it otherwise. Read the same .env values
// the app itself falls back to, so seeded data is always reachable.
function readLocalTestIdentity() {
  let userId = 'test-user';
  let email = 'tester@crm.local';
  // Codespaces sets the identity through the devcontainer's containerEnv, so
  // the process environment wins over .env - matching how the app itself
  // resolves it - and .env is only the fallback for a plain local checkout.
  if (process.env.CRMUNI_TEST_USER_ID || process.env.CRMUNI_TEST_USER_EMAIL) {
    return {
      userId: process.env.CRMUNI_TEST_USER_ID || userId,
      email: process.env.CRMUNI_TEST_USER_EMAIL || email,
    };
  }
  try {
    const envText = readFileSync(resolve(root, '.env'), 'utf-8');
    for (const line of envText.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (!match) continue;
      if (match[1] === 'CRMUNI_TEST_USER_ID') userId = match[2];
      if (match[1] === 'CRMUNI_TEST_USER_EMAIL') email = match[2];
    }
  } catch {
    // .env missing is fine - fall back to the framework's own defaults.
  }
  return { userId, email };
}

// ---------------------------------------------------------------- helpers
let seed = 42;
function rand() {
  // Deterministic PRNG so repeated seeding runs produce stable, reviewable
  // data instead of a new random dataset every time.
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick(list) {
  return list[Math.floor(rand() * list.length)];
}
function pickWeighted(pairs) {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}
function pickN(list, n) {
  const pool = [...list];
  const out = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}
function intBetween(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function id() {
  return randomUUID();
}
function daysFromNow(days) {
  return Date.now() + days * 86400000;
}
function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

const FIRST_NAMES = [
  'Arjun', 'Priya', 'Rohan', 'Sneha', 'Karan', 'Ananya', 'Vikram', 'Meera',
  'Rahul', 'Divya', 'Aditya', 'Kavya', 'Nikhil', 'Pooja', 'Sanjay', 'Ritu',
  'Amit', 'Neha', 'Vivek', 'Shreya', 'Manish', 'Anjali', 'Suresh', 'Isha',
  'Rajesh', 'Simran', 'Deepak', 'Tanya', 'Gaurav', 'Nisha', 'Ayesha', 'Farhan',
  'James', 'Sarah', 'Michael', 'Laura', 'David', 'Emma', 'Daniel', 'Olivia',
  'Chen', 'Wei', 'Li', 'Yuki', 'Hana', 'Omar', 'Layla', 'Ahmed', 'Fatima',
  'Carlos', 'Sofia', 'Diego', 'Valentina', 'Lucas', 'Isabella', 'Mateus',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Nair', 'Iyer', 'Mehta', 'Kapoor', 'Rao', 'Reddy',
  'Gupta', 'Malhotra', 'Chatterjee', 'Bose', 'Pillai', 'Menon', 'Joshi',
  'Desai', 'Kulkarni', 'Agarwal', 'Bhatt', 'Chawla', 'Khanna', 'Trivedi',
  'Patel', 'Shah', 'Singh', 'Kumar', 'Das', 'Sinha', 'Chopra', 'Dutta',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Wilson', 'Anderson', 'Taylor',
  'Zhang', 'Wang', 'Tanaka', 'Sato', 'Al-Farsi', 'Hassan', 'Silva', 'Costa',
];
const COMPANY_PREFIX = [
  'Nair', 'Kapoor', 'Sharma', 'Global', 'Prime', 'Apex', 'Bharat', 'Metro',
  'Coastal', 'Summit', 'Vertex', 'Orbit', 'Pioneer', 'Sterling', 'Horizon',
  'Continental', 'National', 'Precision', 'Alpine', 'Crescent', 'Meridian',
  'Falcon', 'Anchor', 'Delta', 'Century', 'Titan', 'Everest', 'Cascade',
  'Northstar', 'Ironclad',
];
const COMPANY_SUFFIX = [
  'Industries', 'Manufacturing', 'Textiles', 'Logistics', 'Electronics',
  'Pharma', 'Polymers', 'Chemicals', 'Engineering', 'Automation', 'Foods',
  'Packaging', 'Plastics', 'Steel', 'Components', 'Systems', 'Solutions',
  'Exports', 'Machine Tools', 'Energy',
];
const INDUSTRIES = [
  'Pharmaceuticals', 'Automotive', 'Food Processing', 'Textiles',
  'Electronics', 'Chemicals', 'Logistics', 'Packaging', 'Steel & Metals',
  'Renewable Energy', 'Industrial Automation', 'Consumer Goods',
];
const ROLES = [
  'Procurement Head', 'Plant Manager', 'Operations Director', 'CEO',
  'Founder', 'VP Engineering', 'Purchase Manager', 'Quality Head',
  'Supply Chain Manager', 'General Manager', 'CTO', 'Business Development Lead',
  'Production Manager', 'Sourcing Manager', 'Managing Director',
];
const PRODUCTS = [
  ['Conveyor Automation Kit', 'product'],
  ['Predictive Maintenance Sensor', 'product'],
  ['Industrial IoT Gateway', 'product'],
  ['Quality Inspection Camera System', 'product'],
  ['Warehouse Management Software', 'product'],
  ['Energy Monitoring Dashboard', 'product'],
  ['Robotic Palletizer', 'product'],
  ['Cold Chain Tracker', 'product'],
  ['CNC Retrofit Kit', 'product'],
  ['Compressed Air Leak Detector', 'product'],
  ['Installation & Commissioning', 'service'],
  ['Annual Maintenance Contract', 'service'],
];
const NOTE_NEEDS = [
  'Looking to automate their packaging line before the next quarter.',
  'Wants to reduce unplanned downtime on the main production line.',
  'Evaluating vendors for a plant-wide IoT retrofit.',
  'Interested in predictive maintenance for compressors.',
  'Needs a quote for 3 units by end of month.',
  'Currently using a competitor product, open to switching.',
  'Budget approved for next fiscal year, gathering options now.',
  'Wants a live demo scheduled at their facility.',
  'Compliance audit coming up, needs traceability features.',
  'Expanding a second plant, wants to standardize on one vendor.',
];
const QUESTIONS = [
  'What CRM or ERP do you currently use?',
  'How many production lines would this cover?',
  'What is your target go-live timeline?',
  "What's driving the initiative - cost, compliance, or capacity?",
  'Who else is involved in the purchase decision?',
  'Do you have budget already allocated?',
];
const LOSS_REASONS = [
  'Chose a competitor on price',
  'Budget frozen this quarter',
  'Project postponed internally',
  'Went with an in-house build',
  'Lost contact after initial interest',
];
const AGENDA = [
  'Product demo and technical Q&A',
  'Pricing and commercial terms discussion',
  'Site visit and installation walkthrough',
  'Contract review',
  'Follow-up on pilot results',
];

// ------------------------------------------------------------ batching
const statements = [];
function push(db, sql, bindings) {
  statements.push(db.prepare(sql).bind(...bindings));
}
async function flush(db, label) {
  if (!statements.length) return;
  const chunkSize = 150;
  for (let i = 0; i < statements.length; i += chunkSize) {
    await db.batch(statements.slice(i, i + chunkSize));
  }
  console.log(`  ${label}: ${statements.length} statements`);
  statements.length = 0;
}

// -------------------------------------------------------------- main
const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch: () => new Response("ok") };',
  d1Databases: { [D1_BINDING]: LOCAL_D1_DATABASE_ID },
  d1Persist: resolve(root, LOCAL_PERSIST_PATH, 'd1'),
});

try {
  const db = await mf.getD1Database(D1_BINDING);

  // Two reasons to stop before writing anything:
  //
  //  --if-empty  first-run setup passes this, so opening a Codespace gets a
  //              populated app while rerunning setup on a database someone
  //              has already worked in changes nothing.
  //
  //  re-seeding  the demo workspace has a fixed slug and workspaces.slug is
  //              unique, so a second seed used to die part-way through on a
  //              constraint error, leaving a half-written database behind.
  //              Say what to do instead of crashing.
  const stop = async (...messages) => {
    for (const message of messages) console.log(message);
    await mf.dispose();
    process.exit(0);
  };
  const workspaceCount = Number(
    (await db.prepare(`SELECT COUNT(*) AS total FROM workspaces`).first())
      ?.total || 0,
  );
  if (args.includes(`--if-empty`) && workspaceCount > 0)
    await stop(
      `Local database already has a workspace - leaving it untouched.`,
      'Run: npm run db:local:seed -- --reset',
    );
  const seeded = await db
    .prepare(`SELECT name FROM workspaces WHERE slug=?`)
    .bind(DEMO_SLUG)
    .first();
  if (seeded)
    await stop(
      `This database already holds the demo workspace "${seeded.name}".`,
      `Seeding again would collide with it, so nothing was changed.`,
      ``,
      `To replace it with a fresh set of demo data:`,
      `  npm run db:local:seed -- --reset`,
    );

  const now = Date.now();

  // --- workspace -----------------------------------------------------
  const workspaceId = id();
  const creatorId = 'demo-owner';
  push(
    db,
    `INSERT INTO workspaces (id,name,slug,timezone,currency,plan,status,kind,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      workspaceId,
      'Global Expo Solutions',
      DEMO_SLUG,
      'Asia/Kolkata',
      'INR',
      'growth',
      'active',
      'exhibitor',
      creatorId,
      now,
      now,
    ],
  );
  await flush(db, 'workspace');

  // --- memberships -----------------------------------------------------
  const localIdentity = readLocalTestIdentity();
  const teamNames = [
    [localIdentity.userId, 'owner', 'You (local test identity)', localIdentity.email],
    ['demo-admin-1', 'admin', 'Sameer Vora', 'sameer.vora@globalexpo.demo'],
    ['demo-admin-2', 'admin', 'Nandita Rao', 'nandita.rao@globalexpo.demo'],
    ['demo-mgr-1', 'manager', 'Kabir Malhotra', 'kabir.malhotra@globalexpo.demo'],
    ['demo-mgr-2', 'manager', 'Ishita Sen', 'ishita.sen@globalexpo.demo'],
    ['demo-rep-1', 'salesperson', 'Yusuf Khan', 'yusuf.khan@globalexpo.demo'],
    ['demo-rep-2', 'salesperson', 'Aarushi Bhat', 'aarushi.bhat@globalexpo.demo'],
    ['demo-rep-3', 'salesperson', 'Devansh Oza', 'devansh.oza@globalexpo.demo'],
  ];
  const memberships = teamNames.map(([userId, role, name, email]) => ({
    id: id(),
    userId,
    role,
    name,
    email,
  }));
  for (const m of memberships) {
    push(
      db,
      `INSERT INTO memberships (id,workspace_id,user_id,email,display_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [m.id, workspaceId, m.userId, m.email, m.name, m.role, 'active', now, now],
    );
  }
  await flush(db, 'memberships');
  const ownerUserId = teamNames[0][0];
  const salespeople = teamNames.filter((t) => t[1] !== 'owner');

  // --- company profile -------------------------------------------------
  push(
    db,
    `INSERT INTO company_profiles (workspace_id,legal_name,website_url,description,target_industries_json,target_geographies_json,event_objective,onboarding_step,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      workspaceId,
      'Global Expo Solutions Pvt Ltd',
      'https://globalexposolutions.demo',
      'Industrial automation and IoT retrofit kits for mid-size manufacturers, helping plants cut unplanned downtime and standardize quality inspection.',
      JSON.stringify(['Pharmaceuticals', 'Automotive', 'Food Processing', 'Electronics']),
      JSON.stringify(['India', 'UAE', 'Southeast Asia']),
      'Book 150 qualified demos and generate a measurable pipeline across three exhibitions this quarter.',
      4,
      ownerUserId,
      now,
    ],
  );
  for (let v = 1; v <= 3; v += 1) {
    push(
      db,
      `INSERT INTO company_profile_versions (id,workspace_id,version,snapshot_json,change_reason,created_by,created_at) VALUES (?,?,?,?,?,?,?)`,
      [
        id(),
        workspaceId,
        v,
        JSON.stringify({ legalName: 'Global Expo Solutions Pvt Ltd', version: v }),
        v === 1 ? 'Initial profile' : `Refined positioning after Q${v} review`,
        ownerUserId,
        now - (4 - v) * 20 * 86400000,
      ],
    );
  }
  await flush(db, 'company profile');

  // --- products, ICPs, qualification rules, knowledge, claims ---------
  const productIds = [];
  for (const [name, kind] of PRODUCTS) {
    const pid = id();
    productIds.push({ id: pid, name });
    push(
      db,
      `INSERT INTO products (id,workspace_id,name,kind,description,buyer_roles_json,pain_points_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        pid,
        workspaceId,
        name,
        kind,
        `${name} - reduces manual effort and improves traceability on the shop floor.`,
        JSON.stringify(pickN(ROLES, 3)),
        JSON.stringify(pickN(NOTE_NEEDS, 2)),
        'active',
        now,
        now,
      ],
    );
  }
  const icpNames = [
    'Mid-size discrete manufacturers',
    'Pharma plants scaling capacity',
    'Food & beverage processors',
    'Automotive tier-2 suppliers',
    'Export-focused textile units',
  ];
  for (const name of icpNames) {
    push(
      db,
      `INSERT INTO ideal_customer_profiles (id,workspace_id,name,industries_json,company_sizes_json,geographies_json,buyer_roles_json,must_have_signals_json,disqualifiers_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id(),
        workspaceId,
        name,
        JSON.stringify(pickN(INDUSTRIES, 3)),
        JSON.stringify(['50-200 employees', '200-1000 employees']),
        JSON.stringify(['India', 'UAE']),
        JSON.stringify(pickN(ROLES, 3)),
        JSON.stringify(['Budget confirmed', 'Active RFQ']),
        JSON.stringify(['No budget', 'Student inquiry']),
        now,
        now,
      ],
    );
  }
  const ruleDefs = [
    ['Budget confirmed', 'budget_timing', 'contains', 'yes', 25],
    ['Decision maker present', 'authority', 'contains', 'yes', 20],
    ['Timeline within 6 months', 'purchase_timeline', 'contains', '6 months', 15],
    ['Existing pain point named', 'requirement', 'contains', 'downtime', 15],
    ['Multi-site rollout', 'quantity', 'contains', 'multiple', 10],
    ['Uses competitor product', 'existing_technology', 'contains', 'competitor', -10],
    ['Student or research inquiry', 'company_size', 'contains', 'student', -30],
    ['Target industry match', 'industry', 'contains', 'manufacturing', 15],
  ];
  for (const [label, field, operator, expected, weight] of ruleDefs) {
    push(
      db,
      `INSERT INTO qualification_rules (id,workspace_id,label,field,operator,expected_value,weight,rule_type,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        id(),
        workspaceId,
        label,
        field,
        operator,
        expected,
        weight,
        weight >= 0 ? 'positive' : 'negative',
        'active',
        now,
      ],
    );
  }
  const sourceDefs = [
    ['Company brochure 2026.pdf', 'file', 'approved'],
    ['Product spec sheet.pdf', 'file', 'approved'],
    ['Case study - Acme Pharma.pdf', 'file', 'approved'],
    ['https://globalexposolutions.demo/products', 'website', 'approved'],
    ['Pricing sheet draft.pdf', 'file', 'pending_review'],
    ['Old brochure v1.pdf', 'file', 'rejected'],
  ];
  for (const [name, sourceType, status] of sourceDefs) {
    const sourceId = id();
    push(
      db,
      `INSERT INTO knowledge_sources (id,workspace_id,name,source_type,source_url,status,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [
        sourceId,
        workspaceId,
        name,
        sourceType,
        sourceType === 'website' ? name : null,
        status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending_review',
        ownerUserId,
        now,
      ],
    );
    push(
      db,
      `INSERT INTO knowledge_ingestions (id,workspace_id,source_id,status,content_hash,extraction_method,extracted_text,provenance_json,attempts,reviewed_by,reviewed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id(),
        workspaceId,
        sourceId,
        status === 'pending_review' ? 'ready_for_review' : 'approved',
        randomUUID().replace(/-/g, ''),
        sourceType === 'website' ? 'url_fetch' : 'text_extraction',
        'Extracted product and pricing context for AI grounding.',
        JSON.stringify({ seed: true }),
        1,
        status === 'pending_review' ? null : ownerUserId,
        status === 'pending_review' ? null : now,
        now,
        now,
      ],
    );
  }
  const claimDefs = [
    ['Reduces unplanned downtime by up to 30% in the first year.', 'approved'],
    ['Installed in over 200 plants across India and the UAE.', 'approved'],
    ['ISO 9001 and CE certified hardware.', 'approved'],
    ['Average ROI payback within 14 months.', 'approved'],
    ['24/7 remote monitoring support included.', 'draft'],
    ['First to market with this sensor category.', 'retired'],
  ];
  for (const [text, status] of claimDefs) {
    push(
      db,
      `INSERT INTO approved_claims (id,workspace_id,claim_text,evidence_note,status,version,created_by,approved_by,approved_at,retired_by,retired_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id(),
        workspaceId,
        text,
        'Sourced from case studies and internal QA reports.',
        status,
        1,
        ownerUserId,
        status === 'approved' || status === 'retired' ? ownerUserId : null,
        status === 'approved' || status === 'retired' ? now : null,
        status === 'retired' ? ownerUserId : null,
        status === 'retired' ? now : null,
        now,
        now,
      ],
    );
  }
  await flush(db, 'knowledge base');

  // --- events ----------------------------------------------------------
  const eventDefs = [
    {
      name: 'IndustrialTech Expo 2026',
      venue: 'Bombay Exhibition Centre',
      hall: '3',
      booth: 'B-42',
      status: 'active',
      directory: 'published',
      startsIn: -1,
      days: 3,
      weight: 5,
    },
    {
      name: 'FactoryTech Summit 2026',
      venue: 'Pragati Maidan',
      hall: '1',
      booth: 'A-10',
      status: 'active',
      directory: 'published',
      startsIn: -2,
      days: 4,
      weight: 4,
    },
    {
      name: 'Auto Components Expo 2026',
      venue: 'HITEX Grounds',
      hall: '2',
      booth: 'C-05',
      status: 'ready',
      directory: 'private',
      startsIn: 20,
      days: 3,
      weight: 3,
    },
    {
      name: 'GulfMFG Dubai 2026',
      venue: 'Dubai World Trade Centre',
      hall: 'Sheikh Saeed Hall',
      booth: 'D-18',
      status: 'draft',
      directory: 'private',
      startsIn: 60,
      days: 3,
      weight: 1,
    },
    {
      name: 'PackTech India 2025',
      venue: 'Chennai Trade Centre',
      hall: '4',
      booth: 'E-33',
      status: 'archived',
      directory: 'private',
      startsIn: -180,
      days: 3,
      weight: 3,
    },
    {
      name: 'FoodProcess Expo 2025',
      venue: 'Bangalore International Exhibition Centre',
      hall: '2',
      booth: 'F-21',
      status: 'archived',
      directory: 'private',
      startsIn: -240,
      days: 2,
      weight: 2,
    },
  ];
  const events = [];
  for (const def of eventDefs) {
    const eventId = id();
    const startsOn = isoDate(daysFromNow(def.startsIn));
    const endsOn = isoDate(daysFromNow(def.startsIn + def.days));
    events.push({ ...def, id: eventId, startsOn, endsOn });
    push(
      db,
      `INSERT INTO events (id,workspace_id,name,venue,hall,booth,starts_on,ends_on,timezone,budget,objective,products_json,target_accounts_json,qualification_questions_json,lead_field_schema_json,team_member_ids_json,lead_routing_rule,followup_sla_hours,daily_lead_target,badge_provider,qr_campaign_code,status,attribution_window_days,gross_margin_bps,config_version,directory_visibility,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        eventId,
        workspaceId,
        def.name,
        def.venue,
        def.hall,
        def.booth,
        startsOn,
        endsOn,
        'Asia/Kolkata',
        intBetween(200000, 900000),
        `Generate qualified pipeline at ${def.name}.`,
        JSON.stringify(pickN(productIds.map((p) => p.name), 4)),
        JSON.stringify([]),
        JSON.stringify(pickN(QUESTIONS, 3)),
        JSON.stringify(['Budget band']),
        JSON.stringify(pickN(memberships.map((m) => m.userId), 4)),
        'capturer',
        24,
        30,
        'Manual',
        randomUUID().slice(0, 8).toUpperCase(),
        def.status,
        180,
        4000,
        1,
        def.directory,
        ownerUserId,
        now,
        now,
      ],
    );
    const teamForEvent = pickN(memberships, intBetween(3, 6));
    for (const m of teamForEvent) {
      push(
        db,
        `INSERT INTO event_memberships (id,workspace_id,event_id,membership_id,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`,
        [id(), workspaceId, eventId, m.id, 'active', ownerUserId, now, now],
      );
    }
    for (let c = 0; c < intBetween(3, 5); c += 1) {
      const amount = intBetween(15000, 250000);
      const voided = rand() < 0.1;
      push(
        db,
        `INSERT INTO event_cost_lines (id,workspace_id,event_id,category,description,vendor,amount,status,incurred_on,version,voided_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id(),
          workspaceId,
          eventId,
          pick(['space', 'travel', 'logistics', 'marketing', 'staffing', 'technology']),
          pick(['Booth rental', 'Signage and branding', 'Staff travel', 'Freight and logistics', 'Lead retrieval devices', 'Booth furniture']),
          pick(['Expo Services Ltd', 'Prime Logistics', 'BoothWorks India', 'Skyline Events']),
          amount,
          voided ? 'void' : 'actual',
          isoDate(daysFromNow(def.startsIn - intBetween(5, 30))),
          1,
          voided ? now : null,
          ownerUserId,
          now,
          now,
        ],
      );
    }
  }
  await flush(db, 'events + cost lines');

  const activeEvents = events.filter((e) => e.status === 'active' || e.status === 'ready');
  const eventWeights = events.map((e) => [e, e.weight]);

  // --- accounts + leads --------------------------------------------------
  const accountPool = [];
  const accountCount = Math.max(80, Math.round(leadTarget * 0.28));
  for (let i = 0; i < accountCount; i += 1) {
    const companyName = `${pick(COMPANY_PREFIX)} ${pick(COMPANY_SUFFIX)}`;
    accountPool.push({
      id: id(),
      name: `${companyName} ${i}`,
      normalized: `${companyName} ${i}`.toLowerCase(),
      industry: pick(INDUSTRIES),
    });
  }
  for (const acc of accountPool) {
    push(
      db,
      `INSERT INTO accounts (id,workspace_id,name,normalized_name,domain,industry,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        acc.id,
        workspaceId,
        acc.name,
        acc.normalized,
        `${acc.normalized.replace(/[^a-z0-9]/g, '')}.demo`,
        acc.industry,
        'active',
        now,
        now,
      ],
    );
  }
  await flush(db, 'accounts');

  console.log(`Seeding ${leadTarget} leads across ${events.length} events...`);
  const leads = [];
  const BATCH = 150;
  for (let i = 0; i < leadTarget; i += 1) {
    const event = pickWeighted(eventWeights);
    const account = pick(accountPool);
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const fullName = `${first} ${last}`;
    const owner = pick(salespeople);
    const reviewStatus = pickWeighted([
      ['confirmed', 68],
      ['needs_review', 27],
      ['merged', 3],
      ['erased', 2],
    ]);
    const qualificationState = pickWeighted([
      ['hot', 15],
      ['warm', 32],
      ['cold', 30],
      ['unqualified', 23],
    ]);
    const relationshipStatus = rand() < 0.12 ? 'archived' : 'active';
    const source = pick(['card', 'badge', 'qr', 'manual']);
    const createdAt = daysFromNow(event.startsIn + intBetween(0, event.days)) - intBetween(0, 12) * 3600000;
    const leadId = id();
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@${account.normalized.replace(/[^a-z0-9]/g, '')}.demo`;
    const phone = `+91 9${intBetween(1000, 9999)}${intBetween(10000, 99999)}`;
    leads.push({
      id: leadId,
      eventId: event.id,
      accountId: account.id,
      owner: owner[0],
      fullName,
      company: account.name,
      reviewStatus,
      qualificationState,
      createdAt,
      email,
    });
    push(
      db,
      `INSERT INTO leads (id,workspace_id,event_id,owner_id,full_name,company,role,email,phone,source,review_status,client_capture_id,account_id,qualification_state,qualification_reason,qualification_updated_by,qualification_updated_at,custom_fields_json,relationship_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        leadId,
        workspaceId,
        event.id,
        owner[0],
        fullName,
        account.name,
        pick(ROLES),
        rand() < 0.9 ? email : null,
        rand() < 0.75 ? phone : null,
        source,
        reviewStatus,
        `seed-${i}-${leadId.slice(0, 8)}`,
        account.id,
        qualificationState,
        qualificationState === 'unqualified' ? pick(['No budget', 'Wrong industry fit', 'Student inquiry']) : null,
        qualificationState === 'unqualified' ? owner[0] : null,
        qualificationState === 'unqualified' ? createdAt : null,
        JSON.stringify({ 'Budget band': pick(['<5L', '5-20L', '20-50L', '50L+']) }),
        relationshipStatus,
        createdAt,
        createdAt,
      ],
    );
    push(
      db,
      `INSERT INTO lead_assignment_history (id,workspace_id,lead_id,previous_owner_id,owner_id,reason,changed_by,created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [id(), workspaceId, leadId, null, owner[0], 'captured_by', owner[0], createdAt],
    );

    // interaction (most leads have at least one note)
    const note = pick(NOTE_NEEDS);
    if (rand() < 0.92) {
      const interactionId = id();
      push(
        db,
        `INSERT INTO interactions (id,workspace_id,lead_id,note,source,occurred_at,created_at) VALUES (?,?,?,?,?,?,?)`,
        [interactionId, workspaceId, leadId, note, source === 'manual' ? 'typed_note' : 'card_scan', createdAt, createdAt],
      );

      // AI extraction + facts + qualification score for a portion
      if (reviewStatus === 'confirmed' && rand() < 0.45) {
        const extractionId = id();
        push(
          db,
          `INSERT INTO ai_extractions (id,workspace_id,lead_id,interaction_id,status,model,prompt_version,result_json,created_at,completed_at,confirmed_at,confirmed_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            extractionId,
            workspaceId,
            leadId,
            interactionId,
            'confirmed',
            'gpt-5-seed',
            'v3',
            JSON.stringify({ summary: note }),
            createdAt,
            createdAt + 60000,
            createdAt + 120000,
            owner[0],
          ],
        );
        const score = qualificationState === 'hot' ? intBetween(80, 98) : qualificationState === 'warm' ? intBetween(60, 79) : qualificationState === 'cold' ? intBetween(30, 59) : intBetween(0, 29);
        push(
          db,
          `INSERT INTO qualification_scores (id,workspace_id,lead_id,extraction_id,score,rationale,rule_results_json,created_at) VALUES (?,?,?,?,?,?,?,?)`,
          [id(), workspaceId, leadId, extractionId, score, `Scored from stated need and timeline evidence in the source note.`, JSON.stringify([]), createdAt + 120000],
        );
        for (const [label, value] of [
          ['Product interest', pick(productIds).name],
          ['Timeline', pick(['Within 3 months', 'Within 6 months', 'Next fiscal year'])],
        ]) {
          push(
            db,
            `INSERT INTO lead_facts (id,workspace_id,lead_id,extraction_id,field_key,label,value,confidence_basis_points,evidence,confirmed_by,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [id(), workspaceId, leadId, extractionId, label.toLowerCase().replace(/\s+/g, '_'), label, value, intBetween(7000, 9800), note, owner[0], createdAt + 120000],
          );
        }
      }
    }

    // consent
    if (rand() < 0.6) {
      push(
        db,
        `INSERT INTO lead_consents (id,workspace_id,lead_id,purpose,channel,status,source,captured_at,withdrawn_at,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id(),
          workspaceId,
          leadId,
          'follow_up',
          pick(['email', 'whatsapp']),
          rand() < 0.85 ? 'granted' : 'withdrawn',
          'booth_capture',
          createdAt,
          rand() < 0.15 ? createdAt + 86400000 : null,
          owner[0],
          createdAt,
        ],
      );
    }

    // comment
    if (rand() < 0.15) {
      push(
        db,
        `INSERT INTO lead_comments (id,workspace_id,lead_id,author_id,body,mentioned_user_ids_json,created_at) VALUES (?,?,?,?,?,?,?)`,
        [id(), workspaceId, leadId, pick(salespeople)[0], pick(['Following up tomorrow.', 'Good fit for the automation line.', 'Needs manager sign-off before demo.', 'Reassigning to territory owner.']), JSON.stringify([]), createdAt + 3600000],
      );
    }

    // communication draft
    if (reviewStatus === 'confirmed' && rand() < 0.32) {
      const status = pickWeighted([
        ['draft', 30],
        ['approved', 25],
        ['handed_off', 45],
      ]);
      push(
        db,
        `INSERT INTO communication_drafts (id,workspace_id,lead_id,channel,recipient,subject,body,status,model,created_by,approved_by,created_at,approved_at,version,updated_at,handed_off_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id(),
          workspaceId,
          leadId,
          pick(['email', 'whatsapp']),
          email,
          `Great meeting you at ${event.name}`,
          `Hi ${first}, thanks for stopping by our booth at ${event.name}. ${note} Let's set up a quick call this week.`,
          status,
          'gpt-5-seed',
          owner[0],
          status !== 'draft' ? owner[0] : null,
          createdAt,
          status !== 'draft' ? createdAt + 3600000 : null,
          1,
          createdAt,
          status === 'handed_off' ? createdAt + 7200000 : null,
        ],
      );
    }

    // task
    if (rand() < 0.4) {
      const taskStatus = pickWeighted([
        ['open', 55],
        ['complete', 35],
        ['cancelled', 10],
      ]);
      push(
        db,
        `INSERT INTO tasks (id,workspace_id,lead_id,owner_id,title,due_date,status,created_at,updated_at,completed_by,completed_at,cancelled_by,cancelled_at,cancellation_reason,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id(),
          workspaceId,
          leadId,
          owner[0],
          pick(['Send pricing follow-up', 'Schedule product demo', 'Share brochure and spec sheet', 'Confirm site visit date', 'Loop in technical team']),
          isoDate(daysFromNow(intBetween(-10, 20))),
          taskStatus,
          createdAt,
          createdAt,
          taskStatus === 'complete' ? owner[0] : null,
          taskStatus === 'complete' ? createdAt + 86400000 : null,
          taskStatus === 'cancelled' ? owner[0] : null,
          taskStatus === 'cancelled' ? createdAt + 86400000 : null,
          taskStatus === 'cancelled' ? 'No longer pursuing' : null,
          1,
        ],
      );
    }

    // account stakeholder role
    if (rand() < 0.25) {
      push(
        db,
        `INSERT INTO account_stakeholders (id,workspace_id,account_id,lead_id,buying_role,influence_level,notes,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        [id(), workspaceId, account.id, leadId, pick(['buyer', 'technical_evaluator', 'internal_champion', 'decision_maker', 'influencer']), pick(['high', 'medium', 'low', 'unknown']), null, owner[0], createdAt],
      );
    }

    if (leads.length % BATCH === 0) {
      await flush(db, `leads ${leads.length}/${leadTarget}`);
    }
  }
  await flush(db, `leads ${leads.length}/${leadTarget} (final)`);

  // --- meetings ----------------------------------------------------------
  console.log('Seeding meetings...');
  const meetingCount = Math.round(leadTarget * 0.12);
  const activeLeads = leads.filter(
    (l) => l.reviewStatus !== 'merged' && l.reviewStatus !== 'erased',
  );
  const meetingLeads = pickN(activeLeads, meetingCount);
  for (const lead of meetingLeads) {
    const status = pickWeighted([
      ['scheduled', 45],
      ['complete', 40],
      ['cancelled', 15],
    ]);
    const startsAt = daysFromNow(intBetween(-20, 20)) + intBetween(9, 17) * 3600000;
    const meetingId = id();
    push(
      db,
      `INSERT INTO meetings (id,workspace_id,event_id,lead_id,organizer_id,title,starts_at,ends_at,timezone,location,agenda,status,cancellation_reason,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        meetingId,
        workspaceId,
        lead.eventId,
        lead.id,
        lead.owner,
        `${lead.fullName} - ${pick(AGENDA)}`,
        startsAt,
        startsAt + 3600000,
        'Asia/Kolkata',
        pick(['Booth meeting room', 'Google Meet', 'Client office']),
        pick(AGENDA),
        status,
        status === 'cancelled' ? 'Rescheduling requested by customer' : null,
        1,
        startsAt - 86400000,
        startsAt,
      ],
    );
    push(
      db,
      `INSERT INTO meeting_participants (id,workspace_id,meeting_id,lead_id,name,email,participant_type,response_status,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id(), workspaceId, meetingId, lead.id, lead.fullName, lead.email, 'external', status === 'complete' ? 'accepted' : 'needs_action', startsAt - 86400000],
    );
  }
  await flush(db, 'meetings');

  // --- opportunities -------------------------------------------------
  console.log('Seeding opportunities...');
  const oppCount = Math.round(leadTarget * 0.15);
  const oppLeads = pickN(
    activeLeads.filter(
      (l) => l.qualificationState === 'hot' || l.qualificationState === 'warm',
    ),
    oppCount,
  );
  for (const lead of oppLeads) {
    const stage = pickWeighted([
      ['qualified', 20],
      ['requirement', 15],
      ['sample', 10],
      ['rfq', 10],
      ['quotation', 12],
      ['meeting', 8],
      ['negotiation', 10],
      ['won', 8],
      ['lost', 7],
    ]);
    const isClosed = stage === 'won' || stage === 'lost';
    const probability = { qualified: 20, requirement: 30, sample: 40, rfq: 50, quotation: 60, meeting: 65, negotiation: 80, won: 100, lost: 0 }[stage];
    const value = intBetween(150000, 4500000);
    const oppId = id();
    const createdAt = lead.createdAt + 86400000;
    const mutationToken = randomUUID();
    push(
      db,
      `INSERT INTO opportunities (id,workspace_id,lead_id,company,title,stage,value,currency,probability,expected_close_date,account_id,event_id,loss_reason,closed_at,version,mutation_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        oppId,
        workspaceId,
        lead.id,
        lead.company,
        `${pick(productIds).name} rollout - ${lead.company}`,
        stage,
        value,
        'INR',
        probability,
        isoDate(daysFromNow(intBetween(10, 90))),
        lead.accountId,
        lead.eventId,
        stage === 'lost' ? pick(LOSS_REASONS) : null,
        isClosed ? createdAt + intBetween(5, 60) * 86400000 : null,
        1,
        mutationToken,
        createdAt,
        createdAt,
      ],
    );
    push(
      db,
      `INSERT INTO opportunity_contacts (id,workspace_id,opportunity_id,lead_id,contact_role,is_primary,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [id(), workspaceId, oppId, lead.id, 'primary', 1, lead.owner, createdAt],
    );
    push(
      db,
      `INSERT INTO opportunity_history (id,workspace_id,opportunity_id,change_type,from_stage,to_stage,from_value,to_value,reason,mutation_token,changed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id(), workspaceId, oppId, 'created', null, stage, null, value, 'Opportunity created from qualified lead', mutationToken, lead.owner, createdAt],
    );
  }
  await flush(db, 'opportunities');

  // --- RFQs + quotations -------------------------------------------------
  console.log('Seeding RFQs and quotations...');
  const rfqCount = Math.round(leadTarget * 0.05);
  const rfqLeads = pickN(activeLeads, rfqCount);
  for (const lead of rfqLeads) {
    const status = pickWeighted([
      ['received', 25],
      ['reviewing', 20],
      ['clarification', 10],
      ['ready_to_quote', 15],
      ['quoted', 20],
      ['won', 5],
      ['lost', 5],
    ]);
    const rfqId = id();
    const createdAt = lead.createdAt + 172800000;
    push(
      db,
      `INSERT INTO rfqs (id,workspace_id,account_id,lead_id,event_id,title,reference,requester_company,contact_name,delivery_location,submission_deadline,status,processing_status,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        rfqId,
        workspaceId,
        lead.accountId,
        lead.id,
        lead.eventId,
        `${pick(productIds).name} - RFQ`,
        `RFQ/${new Date(createdAt).getFullYear()}/${intBetween(100, 999)}`,
        lead.company,
        lead.fullName,
        pick(['Mumbai, Maharashtra', 'Pune, Maharashtra', 'Ahmedabad, Gujarat', 'Chennai, Tamil Nadu']),
        isoDate(daysFromNow(intBetween(5, 30))),
        status,
        'manual_review',
        lead.owner,
        createdAt,
        createdAt,
      ],
    );
    for (let i = 0; i < intBetween(1, 3); i += 1) {
      push(
        db,
        `INSERT INTO rfq_items (id,workspace_id,rfq_id,product,quantity,specifications,source_evidence,created_at) VALUES (?,?,?,?,?,?,?,?)`,
        [id(), workspaceId, rfqId, pick(productIds).name, String(intBetween(1, 20)), 'Standard configuration', 'Manual entry', createdAt],
      );
    }
    if (status === 'quoted' || status === 'won' || status === 'lost') {
      const qStatus = pickWeighted([
        ['approved', 25],
        ['sent', 30],
        ['accepted', 20],
        ['rejected', 15],
        ['expired', 10],
      ]);
      push(
        db,
        `INSERT INTO quotations (id,workspace_id,rfq_id,opportunity_id,quote_number,customer,amount,currency,valid_until,status,created_by,created_at,updated_at,event_id,version,approved_by,approved_at,sent_at,account_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id(),
          workspaceId,
          rfqId,
          null,
          `Q-${new Date(createdAt).getFullYear()}-${intBetween(1000, 9999)}`,
          lead.company,
          intBetween(150000, 3500000),
          'INR',
          isoDate(daysFromNow(30)),
          qStatus,
          lead.owner,
          createdAt + 86400000,
          createdAt + 86400000,
          lead.eventId,
          1,
          lead.owner,
          createdAt + 86400000,
          qStatus !== 'approved' ? createdAt + 172800000 : null,
          lead.accountId,
        ],
      );
    }
  }
  await flush(db, 'RFQs + quotations');

  // --- audit events -------------------------------------------------
  console.log('Seeding audit log...');
  for (let i = 0; i < 200; i += 1) {
    const lead = pick(leads);
    push(
      db,
      `INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [
        id(),
        workspaceId,
        lead.owner,
        pick(['lead.updated', 'lead.contact_confirmed', 'followup.approved', 'event.updated', 'opportunity.stage_changed']),
        'lead',
        lead.id,
        JSON.stringify({ seed: true }),
        lead.createdAt + intBetween(1, 5) * 3600000,
      ],
    );
  }
  await flush(db, 'audit events');

  console.log('\nSeed complete.');
  console.log(`Workspace: Global Expo Solutions (${workspaceId})`);
  console.log(`Leads: ${leads.length}, Accounts: ${accountPool.length}, Events: ${events.length}`);
} finally {
  await mf.dispose();
}
