# Subscription & Limits Implementation Summary

## ✅ What's Been Implemented

### 1. **Database Layer** (Migrations)

#### Migration 042: Basic Subscriptions
- `subscriptions` table with plan types: `free`, `pro`, `admin`
- Functions to check post limits
- RLS policies for security
- Trigger to enforce 30-post limit for free users

#### Migration 043: Admin Roles & Enhanced Limits
- `admin_users` table for admin email management
- `is_admin()` function to check admin status
- `is_pro_or_admin()` function for feature gating
- Database trigger to enforce post limits on INSERT
- Auto-grant admin status based on email

### 2. **Stripe Integration**

#### Edge Functions
- **`create-checkout-session`**: Creates Stripe checkout for Pro upgrades
- **`create-portal-session`**: Creates Stripe Customer Portal session for managing subscriptions
- **`stripe-webhook`**: Handles subscription events:
  - `checkout.session.completed` - New subscription
  - `customer.subscription.updated` - Subscription changes
  - `customer.subscription.deleted` - Cancellations
  - `invoice.payment_failed` - Payment failures

#### Configuration
- **Stripe Secret Key**: Set in Supabase secrets
- **Webhook Secret**: Set in Supabase secrets
- **Publishable Key**: `mk_1RUuRpDPf1P0vqtesbH5DXe3` (in Coolify)
- **Pro Price ID**: `price_1SdwOtDPf1P0vqteiHimbdOR` (in Coolify)

### 3. **Frontend Components**

#### Utilities (`src/utils/subscription.ts`)
- `getUserSubscription()` - Get current subscription
- `getSubscriptionLimits()` - Get limits and usage
- `canUserCreatePost()` - Check if user can create posts
- `createCheckoutSession()` - Start Stripe checkout
- `isAdmin()` - Check admin status
- `isProOrAdmin()` - Check pro or admin status

#### Hooks (`src/hooks/useSubscription.ts`)
- `useSubscription()` - React hook for subscription state
- Returns: `{ subscription, limits, isPro, isAdmin, isFree, loading, error, refresh }`

#### Components
- **`SubscriptionLimitBanner`**: Shows upgrade prompt when approaching/at limit

### 4. **Plan Features**

| Feature | Free | Pro | Admin |
|---------|------|-----|-------|
| Scheduled Posts | 30 | Unlimited | Unlimited |
| LinkedIn Support | ✅ | ✅ | ✅ |
| Threads Support | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |
| Admin Access | ❌ | ❌ | ✅ |
| Price | $0/month | $3.99/month | Free (granted) |

## 🔒 Security & Limits

### Database-Level Enforcement
- **Trigger on `scheduled_posts`**: Prevents INSERT if limit exceeded
- **RLS Policies**: Users can only see their own subscriptions
- **Function Security**: All functions use `SECURITY DEFINER` with proper checks

### Application-Level Checks
- `canUserCreatePost()` checked before showing "Create Post" UI
- `SubscriptionLimitBanner` shows when at 80% of limit
- Checkout flow requires authentication

## 🎯 How to Grant Admin Access

### Option 1: Direct Database Update
```sql
-- Update existing user to admin
UPDATE subscriptions 
SET plan_type = 'admin', status = 'active', updated_at = NOW()
WHERE user_id = 'USER_UUID_HERE';
```

### Option 2: Via Admin Users Table
```sql
-- Add email to admin list (auto-grants on next login)
INSERT INTO admin_users (email)
VALUES ('admin@example.com');
```

### Option 3: Programmatically
```typescript
import { supabase } from '@/services/supabase'

// Grant admin to current user
const { data: user } = await supabase.auth.getUser()
await supabase
  .from('subscriptions')
  .update({ plan_type: 'admin', status: 'active' })
  .eq('user_id', user.user.id)
```

## 📊 Monitoring & Analytics

### Check Subscription Stats
```sql
-- Count users by plan type
SELECT plan_type, COUNT(*) as count
FROM subscriptions
WHERE status = 'active'
GROUP BY plan_type;

-- Find users near limit
SELECT 
  u.email,
  s.plan_type,
  COUNT(sp.id) as post_count
FROM auth.users u
JOIN subscriptions s ON s.user_id = u.id
LEFT JOIN scheduled_posts sp ON sp.user_id = u.id AND sp.status IN ('pending', 'processing')
WHERE s.plan_type = 'free'
GROUP BY u.email, s.plan_type
HAVING COUNT(sp.id) >= 25
ORDER BY post_count DESC;
```

## 🚀 Next Steps

1. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy create-portal-session
   supabase functions deploy stripe-webhook
   ```

2. **Apply Migrations**:
   - Run `042_add_subscriptions.sql` in Supabase SQL Editor
   - Run `043_add_admin_and_limits.sql` in Supabase SQL Editor

3. **Test Stripe Integration**:
   - Use test card: `4242 4242 4242 4242`
   - Verify webhook events in Stripe Dashboard
   - Check subscription updates in Supabase

4. **Grant Yourself Admin**:
   ```sql
   UPDATE subscriptions 
   SET plan_type = 'admin', status = 'active'
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL');
   ```

## 🐛 Troubleshooting

### Post Creation Fails
- Check if user has reached limit: `SELECT * FROM subscriptions WHERE user_id = 'UUID'`
- Verify trigger is active: `SELECT * FROM pg_trigger WHERE tgname = 'enforce_post_limit'`

### Stripe Checkout Not Working
- Verify environment variables in Coolify
- Check Edge Function logs in Supabase
- Ensure user is authenticated

### Admin Access Not Working
- Verify subscription record: `SELECT * FROM subscriptions WHERE user_id = 'UUID'`
- Check `is_admin()` function returns true
- Ensure status is 'active'

## 📝 Environment Variables Checklist

### Coolify (Production)
- ✅ `VITE_STRIPE_PUBLISHABLE_KEY=mk_1RUuRpDPf1P0vqtesbH5DXe3`
- ✅ `VITE_STRIPE_PRO_PRICE_ID=price_1SdwOtDPf1P0vqteiHimbdOR`

### Supabase Secrets
- ✅ `STRIPE_SECRET_KEY=sk_live_...`
- ✅ `STRIPE_WEBHOOK_SECRET=whsec_WYln7AIN0Gm0Cp2B5Ca8yRPtC9D32lPC`
