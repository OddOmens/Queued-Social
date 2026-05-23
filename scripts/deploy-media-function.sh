#!/bin/bash

# Media Library Edge Function Deployment Script
# This script deploys the updated upload-media edge function with delete support

echo "🚀 Deploying upload-media Edge Function..."
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing via npx..."
    echo ""
fi

# Get project ref from .env file
if [ -f .env ]; then
    PROJECT_REF=$(grep VITE_SUPABASE_URL .env | cut -d'/' -f3 | cut -d'.' -f1)
    echo "📋 Project Reference: $PROJECT_REF"
    echo ""
else
    echo "❌ .env file not found!"
    exit 1
fi

# Deploy the function
echo "📦 Deploying function..."
npx supabase functions deploy upload-media --project-ref "$PROJECT_REF"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Edge function deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Refresh your browser"
    echo "2. Navigate to the Media Library"
    echo "3. Check the console logs for detailed debugging info"
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "Manual deployment options:"
    echo "1. Login to Supabase Dashboard"
    echo "2. Go to Edge Functions > upload-media"
    echo "3. Deploy the updated code from supabase/functions/upload-media/index.ts"
fi
