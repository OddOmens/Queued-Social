# Deploying Edge Functions to Self-Hosted Supabase (Coolify)

## How it works
Edge functions live in `supabase/functions/` in this repo. To deploy updates to the
Coolify server, clone the repo onto the server, copy the functions into the volume,
then restart the edge runtime container.

## Steps

### 1. Open the Coolify server terminal
Coolify dashboard → **Servers** → your server → **Terminal** (the localhost/top one, not a container terminal)

### 2. Clone the repo (replace PAT with a valid token)
```bash
git clone https://<GITHUB_PAT>@github.com/OddOmens/Queued-Social.git /tmp/queued
```

### 3. Copy functions and clean up
```bash
cp -r /tmp/queued/supabase/functions/* /data/coolify/services/YOUR_COOLIFY_SERVICE_ID/volumes/functions/ && rm -rf /tmp/queued
```

### 4. Restart the edge runtime
```bash
docker restart supabase-edge-functions-YOUR_COOLIFY_SERVICE_ID
```

### 5. Verify
```bash
KEY=<SUPABASE_ANON_KEY>
curl -s -H "apikey: $KEY" https://dbqueued.oddomens.com/functions/v1/publish-post
```
Expected response: `{"success":false,"error":"No authorization header"}` — this confirms the function is running correctly.

---

## GitHub PAT
- Generate at: GitHub → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
- Permissions needed: **Contents: Read-only** on the `Queued-Social` repo
- PATs expire — generate a new one when needed and use it in Step 2 above
- Never commit the actual PAT to this repo

## Supabase Anon Key
Found in the Coolify environment variables for the `supabase-edge-functions` container.
