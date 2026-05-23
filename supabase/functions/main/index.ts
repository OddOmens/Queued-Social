// Self-hosted Supabase Edge Runtime router.
// Kong strips "/functions/v1/" so requests arrive as "/{function-name}/...".
// EdgeRuntime.userWorkers spawns an isolated Deno worker per function.

const WORKER_MEMORY_MB = 150;
const WORKER_TIMEOUT_MS = 300_000; // 5 minutes

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const functionName = url.pathname.split("/").filter(Boolean)[0];

  if (!functionName) {
    return new Response(
      JSON.stringify({ error: "function name required" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const servicePath = `/home/deno/functions/${functionName}`;

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: WORKER_MEMORY_MB,
      workerTimeoutMs: WORKER_TIMEOUT_MS,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    });

    return await worker.fetch(req);
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: `Failed to invoke function '${functionName}': ${e.message}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
