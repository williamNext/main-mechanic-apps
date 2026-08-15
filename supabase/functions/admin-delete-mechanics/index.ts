import { createClient } from 'jsr:@supabase/supabase-js@2';

type DeleteMechanicsBody = {
  mechanicIds?: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function uniqueUuidList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && uuid.test(item)))];
}

async function requireAdmin(req: Request, adminClient: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: json({ error: 'missing authorization' }, 401) };

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) return { error: json({ error: 'invalid authorization' }, 401) };

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileError || profile?.role !== 'admin') return { error: json({ error: 'not authorized' }, 403) };
  return { userId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server misconfigured' }, 500);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const admin = await requireAdmin(req, adminClient);
  if ('error' in admin) return admin.error;

  let body: DeleteMechanicsBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const mechanicIds = uniqueUuidList(body.mechanicIds);
  if (mechanicIds.length === 0) return json({ error: 'mechanic ids required' }, 400);
  if (mechanicIds.length > 100) return json({ error: 'too many mechanics selected' }, 400);

  const { data: targets, error: targetError } = await adminClient
    .from('profiles')
    .select('id, name, email, phone, mechanics(specialty, credentials, is_active)')
    .eq('role', 'mechanic')
    .in('id', mechanicIds);

  if (targetError) return json({ error: targetError.message }, 400);
  if (!targets?.length) return json({ error: 'no matching mechanics found' }, 404);

  const logRows = targets.map((target) => {
    const mechanic = Array.isArray(target.mechanics) ? target.mechanics[0] : target.mechanics;
    return {
      actor_id: admin.userId,
      target_mechanic_id: target.id,
      action: 'delete_mechanic',
      note: 'Delete from admin directory',
      before_state: {
        id: target.id,
        name: target.name,
        email: target.email,
        phone: target.phone,
        specialty: mechanic?.specialty,
        credentials: mechanic?.credentials,
        isActive: mechanic?.is_active,
      },
      after_state: {},
    };
  });

  await adminClient.from('admin_action_log').insert(logRows);

  const errors: Array<{ id: string; message: string }> = [];
  for (const target of targets) {
    const { error } = await adminClient.auth.admin.deleteUser(target.id);
    if (error) errors.push({ id: target.id, message: error.message });
  }

  if (errors.length > 0) return json({ error: 'failed to delete auth users', details: errors }, 500);

  return json({
    deletedCount: targets.length,
    requestedCount: mechanicIds.length,
    ignoredCount: mechanicIds.length - targets.length,
  });
});
