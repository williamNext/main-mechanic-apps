const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

for (const file of ['.env', '.env.local']) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true, quiet: true });
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mechanics = [
  { email: 'mecanico1@example.com', name: 'João Mecânico', phone: '+5551999990001', specialty: 'Motor', credentials: 'CREA-123456' },
  { email: 'mecanico2@example.com', name: 'Pedro Suspensão', phone: '+5551999990002', specialty: 'Suspensão', credentials: 'CREA-654321' },
  { email: 'mecanico3@example.com', name: 'Carlos Elétrica', phone: '+5551999990003', specialty: 'Elétrica', credentials: 'CREA-789012' },
];

const slotTimes = [
  ['08:00', '09:00'],
  ['09:00', '10:00'],
  ['10:00', '11:00'],
  ['11:00', '12:00'],
  ['13:00', '14:00'],
  ['14:00', '15:00'],
  ['15:00', '16:00'],
  ['16:00', '17:00'],
];

function formatDate(d) {
  const year = d.getUTCFullYear();
  const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function main() {
  console.log('Seeding profiles/mechanics/timeslots...');
  const users = await listAllUsers();

  const authMatches = mechanics
    .map((m) => {
      const user = users.find(
        (u) => (u.email || '').toLowerCase() === m.email.toLowerCase() || (u.phone || '') === m.phone,
      );
      return user ? { ...m, id: user.id } : null;
    })
    .filter(Boolean);

  if (authMatches.length < 3) {
    console.error(`Only ${authMatches.length}/3 mechanic auth users found. Run npm run seed:mechanics:auth first.`);
    process.exit(1);
  }

  const profiles = authMatches.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: 'mechanic',
    phone: m.phone,
  }));

  const { error: profilesError } = await supabaseAdmin
    .from('profiles')
    .upsert(profiles, { onConflict: 'id' });
  if (profilesError) throw profilesError;

  const mechanicsRows = authMatches.map((m) => ({
    id: m.id,
    specialty: m.specialty,
    credentials: m.credentials,
    is_active: true,
  }));

  const { error: mechanicsError } = await supabaseAdmin
    .from('mechanics')
    .upsert(mechanicsRows, { onConflict: 'id' });
  if (mechanicsError) throw mechanicsError;

  const today = new Date();
  const allSlots = [];
  for (const m of authMatches) {
    for (let dayOffset = 0; dayOffset <= 6; dayOffset += 1) {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + dayOffset));
      for (const [start, end] of slotTimes) {
        allSlots.push({
          mechanic_id: m.id,
          date: formatDate(date),
          start_time: start,
          end_time: end,
          is_available: true,
        });
      }
    }
  }

  const { error: slotsError } = await supabaseAdmin
    .from('timeslots')
    .upsert(allSlots, { onConflict: 'mechanic_id,date,start_time,end_time' });
  if (slotsError) throw slotsError;

  console.log(`Done. Upserted ${profiles.length} profiles, ${mechanicsRows.length} mechanics, ${allSlots.length} timeslots.`);
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
