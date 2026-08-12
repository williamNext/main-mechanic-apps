import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables in environment.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function clearE2EData() {
  console.log('Starting E2E database cleanup...');

  // Delete in correct order of foreign key dependencies
  const { error: itemsError } = await supabase
    .from('appointment_service_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (itemsError) {
    console.error('Failed to clear appointment_service_items:', itemsError);
  }

  const { error: reportsError } = await supabase
    .from('appointment_service_reports')
    .delete()
    .neq('appointment_id', '00000000-0000-0000-0000-000000000000');
  if (reportsError) {
    console.error('Failed to clear appointment_service_reports:', reportsError);
  }

  const { error: appointmentsError } = await supabase
    .from('appointments')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (appointmentsError) {
    console.error('Failed to clear appointments:', appointmentsError);
  }

  const { error: timeslotsError } = await supabase
    .from('timeslots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (timeslotsError) {
    console.error('Failed to clear timeslots:', timeslotsError);
  }

  // Delete any E2E-generated mechanic users from auth.users (cascade takes care of profiles/mechanics)
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list auth users:', listError);
  } else if (usersData && usersData.users) {
    const e2eUsers = usersData.users.filter((user) => {
      const rawPhone = user.phone || '';
      const email = user.email || '';
      const phone = rawPhone.replace('+', ''); // Strip + if present

      // Keep E2E admin and client
      return (
        (phone.startsWith('555199999') && phone !== '5551999999000') ||
        (phone.startsWith('555198888') && phone !== '5551988880000') ||
        email.includes('e2e-temp-')
      );
    });

    for (const user of e2eUsers) {
      console.log(`Deleting E2E auth user: ${user.id} (${user.phone})`);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`Failed to delete E2E auth user ${user.id}:`, deleteError);
      }
    }
  }

  console.log('E2E database cleanup finished.');
}

export async function setupE2EUsers() {
  console.log('Setting up E2E admin and client users...');

  const adminEmail = 'admin-e2e@example.com';
  const adminPhone = '+5551999999000'; // Correct E.164 format
  const clientEmail = 'client-e2e@example.com';
  const clientPhone = '+5551988880000'; // Correct E.164 format
  const password = 'password123';

  // List users in Auth to see if they already exist
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw listError;
  }

  // Find admin user in Auth
  const existingAdmin = usersData.users.find((u) => u.email === adminEmail);
  let adminId: string;

  if (!existingAdmin) {
    console.log('Admin user does not exist in Auth, creating...');
    const { data: newAdmin, error: createAdminError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      phone: adminPhone,
      password: password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { name: 'E2E Admin', role: 'admin', phone: adminPhone },
    });
    if (createAdminError) {
      throw createAdminError;
    }
    adminId = newAdmin.user.id;
  } else {
    adminId = existingAdmin.id;
    console.log('Admin user exists in Auth, updating password and phone...');
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(adminId, {
      password: password,
      phone: adminPhone,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: { name: 'E2E Admin', role: 'admin', phone: adminPhone },
    });
    if (updateAuthError) {
      throw updateAuthError;
    }
  }

  // Ensure admin user has correct profile and role
  const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('id', adminId);
  if (!adminProfiles || adminProfiles.length === 0) {
    console.log('Admin profile does not exist, inserting...');
    const { error: insertError } = await supabase.from('profiles').insert({
      id: adminId,
      name: 'E2E Admin',
      email: adminEmail,
      phone: adminPhone,
      role: 'admin',
    });
    if (insertError) {
      throw insertError;
    }
  } else {
    // Update role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin', name: 'E2E Admin', phone: adminPhone })
      .eq('id', adminId);
    if (updateError) {
      throw updateError;
    }
  }

  // Find client user in Auth
  const existingClient = usersData.users.find((u) => u.email === clientEmail);
  let clientId: string;

  if (!existingClient) {
    console.log('Client user does not exist in Auth, creating...');
    const { data: newClient, error: createClientError } = await supabase.auth.admin.createUser({
      email: clientEmail,
      phone: clientPhone,
      password: password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { name: 'E2E Client', role: 'client', phone: clientPhone },
    });
    if (createClientError) {
      throw createClientError;
    }
    clientId = newClient.user.id;
  } else {
    clientId = existingClient.id;
    console.log('Client user exists in Auth, updating password and phone...');
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(clientId, {
      password: password,
      phone: clientPhone,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: { name: 'E2E Client', role: 'client', phone: clientPhone },
    });
    if (updateAuthError) {
      throw updateAuthError;
    }
  }

  // Ensure client user has correct profile and role
  const { data: clientProfiles } = await supabase.from('profiles').select('id').eq('id', clientId);
  if (!clientProfiles || clientProfiles.length === 0) {
    console.log('Client profile does not exist, inserting...');
    const { error: insertError } = await supabase.from('profiles').insert({
      id: clientId,
      name: 'E2E Client',
      email: clientEmail,
      phone: clientPhone,
      role: 'client',
    });
    if (insertError) {
      throw insertError;
    }
  } else {
    // Update role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'client', name: 'E2E Client', phone: clientPhone })
      .eq('id', clientId);
    if (updateError) {
      throw updateError;
    }
  }

  console.log('E2E users setup complete successfully.');
}
