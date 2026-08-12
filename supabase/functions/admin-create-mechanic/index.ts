import { createClient } from 'jsr:@supabase/supabase-js@2';

type CreateMechanicBody = {
  nome?: string;
  celular?: string;
  email?: string;
  senha?: string;
  especialidade?: string;
  credenciais?: string;
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

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizePhoneToE164(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
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

  let body: CreateMechanicBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const name = cleanText(body.nome, 120);
  const phone = normalizePhoneToE164(cleanText(body.celular, 32));
  const email = cleanText(body.email, 180).toLowerCase();
  const password = typeof body.senha === 'string' ? body.senha : '';
  const specialty = cleanText(body.especialidade, 120);
  const credentials = cleanText(body.credenciais, 180);

  if (!name || !phone || !email || !password || !specialty || !credentials) {
    return json({ error: 'missing required fields' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid email' }, 400);
  if (password.length < 6) return json({ error: 'password too short' }, 400);

  const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
    phone,
    email,
    password,
    phone_confirm: true,
    email_confirm: true,
    user_metadata: { name, role: 'mechanic', phone },
  });

  const userId = authData.user?.id;
  if (createError || !userId) {
    return json({ error: createError?.message ?? 'failed to create auth user' }, 400);
  }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: userId,
    name,
    phone,
    email,
    role: 'mechanic',
  });

  const { error: mechanicError } = profileError
    ? { error: profileError }
    : await adminClient.from('mechanics').insert({
        id: userId,
        specialty,
        credentials,
        is_active: true,
      });

  if (profileError || mechanicError) {
    await adminClient.auth.admin.deleteUser(userId);
    return json({ error: profileError?.message ?? mechanicError?.message ?? 'failed to save mechanic' }, 400);
  }

  return json({ user: { id: userId, name, phone, email, specialty, credentials, isActive: true } });
});
