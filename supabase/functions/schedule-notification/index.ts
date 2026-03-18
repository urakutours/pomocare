import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate user from JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const body = await req.json();
  const { action } = body;

  // --- Subscribe: save push subscription ---
  if (action === "subscribe") {
    const { endpoint, p256dh, auth } = body;
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        { user_id: user.id, endpoint, p256dh, auth },
        { onConflict: "user_id,endpoint" }
      );
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  // --- Schedule: create a pending notification ---
  if (action === "schedule") {
    // Cancel any existing pending for this user
    await supabaseAdmin
      .from("scheduled_notifications")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "pending");

    const { fire_at, title, body: notifBody } = body;
    const { error } = await supabaseAdmin
      .from("scheduled_notifications")
      .insert({
        user_id: user.id,
        fire_at,
        title: title || "Timer Complete",
        body: notifBody || "PomoCare",
      });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  // --- Cancel: mark all pending as cancelled ---
  if (action === "cancel") {
    const { error } = await supabaseAdmin
      .from("scheduled_notifications")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "pending");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  // --- Unsubscribe: remove a push subscription ---
  if (action === "unsubscribe") {
    const { endpoint } = body;
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: corsHeaders,
  });
});
