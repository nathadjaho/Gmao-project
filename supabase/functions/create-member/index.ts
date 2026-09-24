// Edge Function : un admin crée le compte d'un membre de SON organisation.
//
// Pourquoi côté serveur : créer un compte pour quelqu'un d'autre exige la clé
// secrète (service role), qui ne doit JAMAIS aller dans le navigateur.
// Pourquoi sans email : MVP sans nom de domaine ni service SMTP. L'admin transmet
// le mot de passe provisoire au technicien, qui pourra le changer.
//
// Flux : JWT de l'appelant → vérifie qu'il est admin → crée l'utilisateur
//        (email confirmé) → crée son appartenance à l'organisation de l'admin.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Qui appelle ? (le JWT est vérifié par Supabase avant d'arriver ici : verify_jwt)
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return json({ error: "Authentification requise" }, 401);
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller.user) return json({ error: "Session invalide" }, 401);

  // 2. L'appelant est-il admin actif, et de quelle organisation ?
  const { data: membership } = await admin
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", caller.user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!membership || membership.role !== "admin") {
    return json({ error: "Seul un administrateur peut ajouter un membre" }, 403);
  }

  // 3. Validation des entrées (ne jamais faire confiance au client)
  let body: { email?: string; full_name?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps de requête invalide" }, 400);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const fullName = (body.full_name ?? "").trim();
  const password = body.password ?? "";
  const role = body.role === "admin" ? "admin" : "technician";
  if (!EMAIL_RE.test(email)) return json({ error: "Email invalide" }, 400);
  if (fullName.length < 2 || fullName.length > 100) return json({ error: "Nom : 2 à 100 caractères" }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: "Mot de passe : 8 à 72 caractères" }, 400);

  // 4. Création du compte (email marqué confirmé : pas d'email envoyé)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created.user) {
    const exists = createErr?.message?.toLowerCase().includes("already");
    return json({ error: exists ? "Un compte existe déjà avec cet email" : createErr?.message ?? "Création impossible" }, exists ? 409 : 400);
  }

  // 5. Rattachement à l'organisation de l'admin. En cas d'échec, on supprime le
  //    compte créé pour ne pas laisser d'utilisateur orphelin (compensation).
  const { error: memberErr } = await admin.from("memberships").insert({
    user_id: created.user.id,
    organization_id: membership.organization_id,
    role,
  });
  if (memberErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "Rattachement à l'organisation impossible : " + memberErr.message }, 500);
  }

  return json({ user_id: created.user.id, email, full_name: fullName, role }, 201);
});
