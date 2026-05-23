#!/bin/bash

# Deploy All Scheduler Functions
# This script deploys all edge functions required for the scheduler to work correctly

echo "🚀 Deploying Scheduler Edge Functions..."
echo ""

# Get project ref
if [ -f .env ]; then
    PROJECT_REF=$(grep VITE_SUPABASE_URL .env | cut -d'/' -f3 | cut -d'.' -f1)
else
    PROJECT_REF="YOUR_PROJECT_REF"
fi

echo "📋 Project Reference: $PROJECT_REF"
echo ""

# 1. Deploy Exchange Function (Critical/Auth)
echo "📦 Deploying 'exchange-oauth-token'..."
npx supabase functions deploy exchange-oauth-token --project-ref "$PROJECT_REF"
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy exchange-oauth-token"
    exit 1
fi

# 2. Deploy Scheduler Function (Critical/Posting)
echo "📦 Deploying 'process-scheduled-posts'..."
npx supabase functions deploy process-scheduled-posts --project-ref "$PROJECT_REF"
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy process-scheduled-posts"
    exit 1
fi

echo ""
echo "✅ All functions deployed successfully!"
echo "Please reconnect your Instagram account now."
