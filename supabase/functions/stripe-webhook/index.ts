import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const signature = req.headers.get('stripe-signature')
        if (!signature) {
            console.error('❌ Missing stripe-signature header')
            return new Response(
                JSON.stringify({ error: 'Missing stripe-signature header' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const body = await req.text()
        let event: Stripe.Event

        try {
            event = await stripe.webhooks.constructEventAsync(
                body,
                signature,
                webhookSecret
            )
        } catch (err) {
            console.error('❌ Webhook signature verification failed:', err.message)
            return new Response(
                JSON.stringify({ error: `Webhook Error: ${err.message}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ Received webhook event:', event.type)

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                console.log('💳 Checkout session completed:', session.id)

                // Get the user ID from metadata
                const userId = session.metadata?.user_id
                if (!userId) {
                    console.error('❌ No user_id in session metadata')
                    break
                }

                // Update or create subscription record
                const { error } = await supabase
                    .from('subscriptions')
                    .upsert({
                        user_id: userId,
                        stripe_customer_id: session.customer as string,
                        stripe_subscription_id: session.subscription as string,
                        plan_type: 'pro',
                        status: 'active',
                        current_period_start: new Date().toISOString(),
                        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'user_id'
                    })

                if (error) {
                    console.error('❌ Error updating subscription:', error)
                } else {
                    console.log('✅ Subscription created/updated for user:', userId)
                }
                break
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription
                console.log('🔄 Subscription updated:', subscription.id)

                // Find the user by customer ID
                const { data: existingSub } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', subscription.customer as string)
                    .single()

                if (!existingSub) {
                    console.error('❌ No subscription found for customer:', subscription.customer)
                    break
                }

                // Update subscription status
                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        status: subscription.status === 'active' ? 'active' : subscription.status,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        cancel_at_period_end: subscription.cancel_at_period_end,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('user_id', existingSub.user_id)

                if (error) {
                    console.error('❌ Error updating subscription:', error)
                } else {
                    console.log('✅ Subscription updated for user:', existingSub.user_id)
                }
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                console.log('❌ Subscription deleted:', subscription.id)

                // Find the user by customer ID
                const { data: existingSub } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('stripe_customer_id', subscription.customer as string)
                    .single()

                if (!existingSub) {
                    console.error('❌ No subscription found for customer:', subscription.customer)
                    break
                }

                // Downgrade to free plan
                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        plan_type: 'free',
                        status: 'canceled',
                        stripe_subscription_id: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('user_id', existingSub.user_id)

                if (error) {
                    console.error('❌ Error downgrading subscription:', error)
                } else {
                    console.log('✅ User downgraded to free plan:', existingSub.user_id)
                }
                break
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice
                console.log('⚠️ Payment failed for invoice:', invoice.id)

                // Update subscription status to past_due
                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        status: 'past_due',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('stripe_customer_id', invoice.customer as string)

                if (error) {
                    console.error('❌ Error updating subscription status:', error)
                }
                break
            }

            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`)
        }

        return new Response(
            JSON.stringify({ received: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('❌ Webhook handler error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
