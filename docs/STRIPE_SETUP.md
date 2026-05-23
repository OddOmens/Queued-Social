# Stripe Integration Setup Guide

This guide will help you complete the Stripe integration for your Scheduler App.

## 📋 Prerequisites

- Stripe account (sign up at https://stripe.com)
- Supabase project with the latest migrations applied
- Access to your production environment variables

## 🔧 Step 1: Create Stripe Products

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** → **Add Product**
3. Create the Pro plan:
   - **Name**: Scheduler Pro
   - **Description**: Unlimited scheduled posts for LinkedIn and Threads
   - **Pricing**: $9/month (recurring)
   - **Billing period**: Monthly
4. After creating, copy the **Price ID** (starts with `price_`)

## 🔑 Step 2: Get Stripe API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy your keys:
   - **Publishable key** (starts with `pk_`)
   - **Secret key** (starts with `sk_`)

## 🪝 Step 3: Set Up Webhook

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to:
   ```
   https://[YOUR_PROJECT_REF].supabase.co/functions/v1/stripe-webhook
   ```
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. After creating, copy the **Signing secret** (starts with `whsec_`)

## 🌐 Step 4: Configure Environment Variables

### Local Development (.env.local)
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_PRO_PRICE_ID=price_...
```

### Supabase Edge Functions
In your Supabase Dashboard, go to **Edge Functions** → **Manage secrets**:
```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Production (.env.production or Coolify)
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_STRIPE_PRO_PRICE_ID=price_...
```

## 🚀 Step 5: Deploy Edge Functions

Run these commands to deploy the Stripe Edge Functions:

```bash
# Deploy the checkout session function
supabase functions deploy create-checkout-session

# Deploy the webhook handler
supabase functions deploy stripe-webhook
```

## 🗄️ Step 6: Apply Database Migration

Apply the subscription migration to your database:

```bash
# Via Supabase CLI
supabase db push

# OR manually in Supabase Dashboard SQL Editor
# Run the contents of: supabase/migrations/042_add_subscriptions.sql
```

## ✅ Step 7: Test the Integration

### Test Checkout Flow
1. Visit your landing page at http://localhost:5177
2. Click "Upgrade to Pro"
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete checkout
5. Verify subscription in Supabase `subscriptions` table

### Test Webhook
1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. Click **Send test webhook**
4. Select `checkout.session.completed`
5. Check Supabase Edge Function logs

## 🔍 Verification Checklist

- [ ] Stripe products created with correct pricing
- [ ] API keys copied and stored securely
- [ ] Webhook endpoint configured with correct URL
- [ ] All environment variables set in Supabase
- [ ] Edge Functions deployed successfully
- [ ] Database migration applied
- [ ] Test checkout completed successfully
- [ ] Subscription record created in database
- [ ] Webhook events being received

## 🐛 Troubleshooting

### Checkout not working
- Check browser console for errors
- Verify `VITE_STRIPE_PRO_PRICE_ID` is set correctly
- Ensure user is authenticated before clicking "Upgrade to Pro"

### Webhook not receiving events
- Verify webhook URL is correct
- Check that `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Review Edge Function logs in Supabase Dashboard

### Subscription not updating
- Check Edge Function logs for errors
- Verify RLS policies allow service role to update subscriptions
- Ensure `user_id` is in checkout session metadata

## 📚 Additional Resources

- [Stripe Testing](https://stripe.com/docs/testing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

## 🔐 Security Notes

- Never commit API keys to version control
- Use test keys for development
- Use live keys only in production
- Rotate keys if compromised
- Monitor webhook signatures carefully
