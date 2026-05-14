const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars. Run with Doppler: doppler run -- node scripts/seed.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const users = [
  { email: 'admin1@example.com', password: 'password123', name: 'Super Admin', role: 'admin' },
  { email: 'mecanico1@example.com', password: 'password123', name: 'João Mecânico', role: 'mechanic', specialty: 'Motor', phone: '51999990001' },
  { email: 'mecanico2@example.com', password: 'password123', name: 'Pedro Suspensão', role: 'mechanic', specialty: 'Suspensão', phone: '51999990002' },
  { email: 'mecanico3@example.com', password: 'password123', name: 'Carlos Elétrica', role: 'mechanic', specialty: 'Elétrica', phone: '51999990003' },
  { email: 'cliente1@example.com', password: 'password123', name: 'Maria Cliente', role: 'client' },
];

async function seed() {
  console.log('Seeding users...');
  
  for (const u of users) {
    console.log(`Creating ${u.role}: ${u.email}`);
    
    // 1. Sign up user (Auth)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
    });
    
    if (authError) {
      console.error(`Error creating ${u.email} in Auth:`, authError.message);
      continue;
    }
    
    const userId = authData.user.id;
    console.log(`Auth created with ID: ${userId}`);

    // 2. Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone ?? null
    });

    if (profileError) {
      console.error(`Error creating profile for ${u.email}:`, profileError.message);
      continue;
    }
    
    // 3. Create mechanic entry if needed
    if (u.role === 'mechanic') {
      const { error: mechError } = await supabase.from('mechanics').insert({
        id: userId,
        specialty: u.specialty,
        credentials: 'CREA-123456'
      });
      if (mechError) console.error(`Error creating mechanic profile:`, mechError.message);
    }
    
    console.log(`Successfully created ${u.email}`);
  }
  
  console.log('\nSeed complete!');
  console.log('IMPORTANT: If email confirmation is ON in Supabase, you must disable it or confirm emails manually before logging in.');
}

seed();
