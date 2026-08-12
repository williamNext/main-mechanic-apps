import { test } from '@playwright/test';
import { supabase } from '../helpers/db';

test('debug list users and profiles', async () => {
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('List users error:', usersError);
    return;
  }
  console.log('--- AUTH USER LIST ---');
  for (const user of usersData.users) {
    console.log(`ID: ${user.id} | Email: ${user.email} | Phone: ${user.phone}`);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*');
  
  if (profilesError) {
    console.error('Profiles select error:', profilesError);
    return;
  }

  console.log('--- PROFILES TABLE ---');
  for (const prof of profiles) {
    console.log(`ID: ${prof.id} | Name: ${prof.name} | Role: ${prof.role} | Email: ${prof.email} | Phone: ${prof.phone}`);
  }
  console.log('----------------------');
});
