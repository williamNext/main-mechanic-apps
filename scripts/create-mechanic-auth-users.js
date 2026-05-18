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
const defaultPassword = process.env.MECHANIC_DEFAULT_PASSWORD || 'password123';

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing env vars. Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mechanics = [
  {
    email: 'mecanico1@example.com',
    phone: '+5551999990001',
    name: 'João Mecânico',
    specialty: 'Motor',
    credentials: 'CREA-123456',
  },
  {
    email: 'mecanico2@example.com',
    phone: '+5551999990002',
    name: 'Pedro Suspensão',
    specialty: 'Suspensão',
    credentials: 'CREA-654321',
  },
  {
    email: 'mecanico3@example.com',
    phone: '+5551999990003',
    name: 'Carlos Elétrica',
    specialty: 'Elétrica',
    credentials: 'CREA-789012',
  },
];

async function userExistsByEmail(email) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const found = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function createMechanicAuthUser(user) {
  const existing = await userExistsByEmail(user.email);
  if (existing) {
    console.log(`Already exists: ${user.email} (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      name: user.name,
      role: 'mechanic',
      phone: user.phone,
      specialty: user.specialty,
      credentials: user.credentials,
    },
  });

  if (error) throw error;
  console.log(`Created: ${user.email} (${data.user.id})`);
  return data.user.id;
}

async function main() {
  console.log('Creating mechanic auth users...');
  for (const mechanic of mechanics) {
    await createMechanicAuthUser(mechanic);
  }
  console.log('Done. Now run scripts/sql/2026-05-16_seed_3_mechanics_timeslots.sql');
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
