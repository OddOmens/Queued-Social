#!/usr/bin/env bash
# =============================================================================
# migrate-to-self-hosted.sh
# Exports data from Supabase Cloud and imports it into self-hosted Supabase.
#
# Prerequisites:
#   - supabase CLI installed: brew install supabase/tap/supabase
#   - psql installed: brew install postgresql
#   - .env.supabase file configured with your self-hosted values
#
# Usage:
#   chmod +x scripts/migrate-to-self-hosted.sh
#   ./scripts/migrate-to-self-hosted.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/supabase-backup-$(date +%Y%m%d_%H%M%S)"

# ── Load self-hosted env ──────────────────────────────────────────────────────
if [[ ! -f "$PROJECT_DIR/.env.supabase" ]]; then
  echo "ERROR: .env.supabase not found. Copy .env.supabase.example and fill in values."
  exit 1
fi

set -a
source "$PROJECT_DIR/.env.supabase"
set +a

echo "============================================================"
echo " Queued Social — Migrate to Self-Hosted Supabase"
echo "============================================================"
echo ""

# ── Step 1: Collect Cloud credentials ────────────────────────────────────────
echo "STEP 1: Cloud Supabase credentials"
echo "----------------------------------"
echo "You need your cloud project's database connection details."
echo "Find them at: Supabase Dashboard → Settings → Database → Connection string"
echo ""
read -rp "Cloud DB host (e.g. db.abcdef.supabase.co): " CLOUD_DB_HOST
read -rp "Cloud DB password: " -s CLOUD_DB_PASS
echo ""
read -rp "Cloud project ref (e.g. abcdefghijklm): " CLOUD_PROJECT_REF

CLOUD_DB_URL="postgresql://postgres:${CLOUD_DB_PASS}@${CLOUD_DB_HOST}:5432/postgres"
SELF_HOSTED_DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-postgres}"

mkdir -p "$BACKUP_DIR"
echo ""
echo "Backup directory: $BACKUP_DIR"
echo ""

# ── Step 2: Export schema + data from cloud ───────────────────────────────────
echo "STEP 2: Exporting database from Supabase Cloud..."
echo "--------------------------------------------------"

echo "  Exporting schema (roles, extensions)..."
pg_dump "$CLOUD_DB_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=auth \
  --schema=storage \
  -f "$BACKUP_DIR/schema.sql" \
  2>/dev/null || echo "  WARNING: Schema export failed — continuing with data export only"

echo "  Exporting public data..."
pg_dump "$CLOUD_DB_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --schema=public \
  --disable-triggers \
  -f "$BACKUP_DIR/public-data.sql"

echo "  Exporting auth users..."
pg_dump "$CLOUD_DB_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --schema=auth \
  --table=auth.users \
  --table=auth.identities \
  --table=auth.sessions \
  --table=auth.refresh_tokens \
  --disable-triggers \
  -f "$BACKUP_DIR/auth-data.sql" \
  2>/dev/null || echo "  WARNING: Auth export failed — users will need to re-register or reset passwords"

echo "  Exporting storage metadata..."
pg_dump "$CLOUD_DB_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --schema=storage \
  --table=storage.buckets \
  --table=storage.objects \
  --disable-triggers \
  -f "$BACKUP_DIR/storage-data.sql" \
  2>/dev/null || echo "  WARNING: Storage metadata export failed — bucket config will need to be recreated"

echo "  ✓ Export complete"
echo ""

# ── Step 3: Wait for self-hosted DB to be ready ───────────────────────────────
echo "STEP 3: Checking self-hosted database connection..."
echo "---------------------------------------------------"
echo "  Make sure self-hosted Supabase is running:"
echo "  docker compose -f docker-compose.supabase.yml --env-file .env.supabase up -d"
echo ""
read -rp "Press ENTER once the self-hosted Supabase is running..."

for i in {1..30}; do
  if psql "$SELF_HOSTED_DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
    echo "  ✓ Connected to self-hosted database"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "  ERROR: Could not connect to self-hosted database after 30 attempts."
    echo "  Check that the Supabase stack is running: docker compose -f docker-compose.supabase.yml ps"
    exit 1
  fi
  echo "  Waiting for database... ($i/30)"
  sleep 2
done
echo ""

# ── Step 4: Run migrations on self-hosted DB ─────────────────────────────────
echo "STEP 4: Running schema migrations..."
echo "------------------------------------"
echo "  Applying all migrations in order..."

MIGRATION_DIR="$PROJECT_DIR/supabase/migrations"
MIGRATION_FILES=$(ls "$MIGRATION_DIR"/*.sql | sort -V)
FAILED_MIGRATIONS=()

for migration in $MIGRATION_FILES; do
  filename=$(basename "$migration")
  echo -n "  Applying $filename..."
  if psql "$SELF_HOSTED_DB_URL" -f "$migration" >/dev/null 2>&1; then
    echo " ✓"
  else
    echo " WARN (may already exist)"
    FAILED_MIGRATIONS+=("$filename")
  fi
done

echo ""
if [[ ${#FAILED_MIGRATIONS[@]} -gt 0 ]]; then
  echo "  The following migrations had warnings (often safe if tables already exist):"
  for m in "${FAILED_MIGRATIONS[@]}"; do
    echo "    - $m"
  done
fi
echo ""

# ── Step 5: Import auth users ────────────────────────────────────────────────
echo "STEP 5: Importing auth users..."
echo "-------------------------------"
if [[ -f "$BACKUP_DIR/auth-data.sql" ]]; then
  psql "$SELF_HOSTED_DB_URL" -f "$BACKUP_DIR/auth-data.sql" 2>/dev/null && echo "  ✓ Auth users imported" || echo "  WARNING: Auth import had errors — check $BACKUP_DIR/auth-data.sql"
else
  echo "  SKIP: No auth backup found"
fi
echo ""

# ── Step 6: Import public data ────────────────────────────────────────────────
echo "STEP 6: Importing application data..."
echo "-------------------------------------"
psql "$SELF_HOSTED_DB_URL" -f "$BACKUP_DIR/public-data.sql" 2>/dev/null && echo "  ✓ Application data imported" || echo "  WARNING: Data import had errors — check manually"
echo ""

# ── Step 7: Import storage metadata ─────────────────────────────────────────
echo "STEP 7: Importing storage metadata..."
echo "-------------------------------------"
if [[ -f "$BACKUP_DIR/storage-data.sql" ]]; then
  psql "$SELF_HOSTED_DB_URL" -f "$BACKUP_DIR/storage-data.sql" 2>/dev/null && echo "  ✓ Storage metadata imported" || echo "  WARNING: Storage import had errors"
else
  echo "  SKIP: No storage backup found"
fi
echo ""

# ── Step 8: Configure app settings (cron) ────────────────────────────────────
echo "STEP 8: Configuring app settings for cron jobs..."
echo "--------------------------------------------------"
if [[ -n "${API_EXTERNAL_URL:-}" && -n "${ANON_KEY:-}" && -n "${SCHEDULER_SECRET:-}" ]]; then
  psql "$SELF_HOSTED_DB_URL" <<SQL
ALTER DATABASE postgres SET "app.supabase_url"      = '${API_EXTERNAL_URL}';
ALTER DATABASE postgres SET "app.supabase_anon_key" = '${ANON_KEY}';
ALTER DATABASE postgres SET "app.scheduler_secret"  = '${SCHEDULER_SECRET}';
SELECT pg_reload_conf();
SQL
  echo "  ✓ App settings configured"
else
  echo "  WARNING: API_EXTERNAL_URL, ANON_KEY, or SCHEDULER_SECRET not set in .env.supabase"
  echo "  Run migration 054 manually after configuring those values."
fi
echo ""

# ── Step 9: Create storage bucket ────────────────────────────────────────────
echo "STEP 9: Ensuring storage bucket exists..."
echo "-----------------------------------------"
psql "$SELF_HOSTED_DB_URL" <<SQL 2>/dev/null
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('media-files', 'media-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;
SQL
echo "  ✓ media-files bucket ready"
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo "============================================================"
echo " Migration Complete!"
echo "============================================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Update your app's environment variables:"
echo "   VITE_SUPABASE_URL=${API_EXTERNAL_URL:-https://supabase.yourdomain.com}"
echo "   VITE_SUPABASE_ANON_KEY=<your new ANON_KEY from .env.supabase>"
echo "   SUPABASE_SERVICE_ROLE_KEY=<your new SERVICE_ROLE_KEY from .env.supabase>"
echo ""
echo "2. Update OAuth callback URLs in each platform's developer console:"
echo "   Google:    https://console.developers.google.com"
echo "     Add redirect: ${API_EXTERNAL_URL:-https://supabase.yourdomain.com}/auth/v1/callback"
echo "   Threads/Instagram: Update redirect URI to your app URL"
echo "   LinkedIn:  Update redirect URI to your app URL"
echo ""
echo "3. Update Stripe webhook endpoint:"
echo "   New URL: ${API_EXTERNAL_URL:-https://supabase.yourdomain.com}/functions/v1/stripe-webhook"
echo ""
echo "4. Restart your app container with the new env vars:"
echo "   docker compose down && docker compose up -d"
echo ""
echo "5. Verify cron jobs are running in Studio:"
echo "   https://your-studio-url → Database → pg_cron"
echo ""
echo "Backup saved to: $BACKUP_DIR"
