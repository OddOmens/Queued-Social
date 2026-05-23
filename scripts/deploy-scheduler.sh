#!/bin/bash

# Scheduler Edge Function Deployment Script
# This script deploys the updated process-scheduled-posts edge function

echo "🚀 Deploying process-scheduled-posts Edge Function..."
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing via npx..."
    echo ""
fi

# Get project ref (auto-detected or hardcoded fallback)
if [ -f .env ]; then
    PROJECT_REF=$(grep VITE_SUPABASE_URL .env | cut -d'/' -f3 | cut -d'.' -f1)
else
    PROJECT_REF="YOUR_PROJECT_REF"
fi

echo "📋 Project Reference: $PROJECT_REF"
echo ""

# Deploy the function
echo "📦 Deploying function..."
npx supabase functions deploy process-scheduled-posts --project-ref "$PROJECT_REF"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Scheduler function deployed successfully!"
    echo "LinkedIn and Instagram posting fixes are now live."
else
    echo ""
    echo "❌ Deployment failed! You may need to login first:"
    echo "npx supabase login"
fi
