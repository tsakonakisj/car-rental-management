import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CleanupPhoto {
  id: string;
  url: string;
  type: string;
  reservation_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let scanned = 0;
  let deleted = 0;
  let failed = 0;
  const failures: Array<{ path: string; error: string }> = [];

  try {
    const { data: photos, error: rpcError } = await supabase.rpc(
      "get_photos_for_cleanup"
    );

    if (rpcError) {
      console.error("Failed to fetch photos for cleanup:", rpcError.message);
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const photoList = (photos as CleanupPhoto[]) ?? [];
    scanned = photoList.length;

    console.log(`[cleanup] Scanned ${scanned} photos eligible for deletion`);

    for (const photo of photoList) {
      const { error: storageError } = await supabase.storage
        .from("rental-photos")
        .remove([photo.url]);

      if (storageError) {
        failed++;
        failures.push({ path: photo.url, error: storageError.message });
        console.error(
          `[cleanup] Storage delete FAILED for ${photo.url}: ${storageError.message}`
        );
        continue;
      }

      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .eq("id", photo.id);

      if (dbError) {
        failed++;
        failures.push({ path: photo.url, error: dbError.message });
        console.error(
          `[cleanup] DB delete FAILED for photo ${photo.id}: ${dbError.message}`
        );
        continue;
      }

      deleted++;
      console.log(`[cleanup] Deleted ${photo.url} (type=${photo.type})`);
    }

    const summary = { scanned, deleted, failed, failures };
    console.log(
      `[cleanup] Done — scanned: ${scanned}, deleted: ${deleted}, failed: ${failed}`
    );

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cleanup] Unexpected error:", msg);
    return new Response(
      JSON.stringify({ error: msg, scanned, deleted, failed }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
