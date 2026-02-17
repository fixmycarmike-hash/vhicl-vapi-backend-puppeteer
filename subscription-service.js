/**
 * VHICL Pro - Subscription Service
 * Handles Stripe subscriptions, billing, and customer management
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Plans configuration
const SUBSCRIPTION_PLANS = {
    starter: {
        name: 'Starter',
        price: 99, // $99/month
        features: [
            'Up to 50 work orders/month',
            'Basic technician management',
            'Standard reports',
            'Email support',
            'No social media integration'
        ],
        limits: {
            workOrders: 50,
            technicians: 2,
            users: 1
        }
    },
    professional: {
        name: 'Professional',
        price: 199, // $199/month
        features: [
            'Unlimited work orders',
            'Advanced technician management',
            'Full reports & analytics',
            'ALEX AI Service Advisor',
            'Social media integration',
            'Priority support'
        ],
        limits: {
            workOrders: -1, // unlimited
            technicians: 10,
            users: 5
        }
    },
    enterprise: {
        name: 'Enterprise',
        price: 499, // $499/month
        features: [
            'Everything in Professional',
            'Unlimited technicians',
            'Unlimited users',
            'Custom integrations',
            'Dedicated support',
            'White-label option',
            'API access'
        ],
        limits: {
            workOrders: -1, // unlimited
            technicians: -1, // unlimited
            users: -1 // unlimited
        }
    }
};

class SubscriptionService {
    constructor(db) {
        this.db = db;
        this.subscriptionsRef = db.ref('subscriptions');
        this.customersRef = db.ref('customers');
    }

    /**
     * Create a new customer subscription
     */
    async createSubscription(customerData, planId = 'starter') {
        try {
            const plan = SUBSCRIPTION_PLANS[planId];
            if (!plan) {
                throw new Error('Invalid plan ID');
            }

            // Create Stripe customer
            const stripeCustomer = await stripe.customers.create({
                email: customerData.email,
                name: customerData.shopName,
                phone: customerData.phone,
                metadata: {
                    shopName: customerData.shopName,
                    licenseKey: customerData.licenseKey
                }
            });

            // Create Stripe subscription
            const stripeSubscription = await stripe.subscriptions.create({
                customer: stripeCustomer.id,
                items: [{
                    price: this.getStripePriceId(planId)
                }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
                trial_period_days: 30, // 30-day free trial
                metadata: {
                    planId: planId,
                    licenseKey: customerData.licenseKey
                }
            });

            // Store subscription in Firebase
            const subscriptionData = {
                id: stripeSubscription.id,
                customerId: stripeCustomer.id,
                shopId: customerData.shopId,
                licenseKey: customerData.licenseKey,
                planId: planId,
                status: stripeSubscription.status,
                currentPeriodStart: stripeSubscription.current_period_start,
                currentPeriodEnd: stripeSubscription.current_period_end,
                trialEnd: stripeSubscription.trial_end,
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
                createdAt: admin.database.ServerValue.TIMESTAMP,
                updatedAt: admin.database.ServerValue.TIMESTAMP,
                shopInfo: {
                    name: customerData.shopName,
                    email: customerData.email,
                    phone: customerData.phone,
                    address: customerData.address
                }
            };

            await this.subscriptionsRef.child(stripeSubscription.id).set(subscriptionData);

            // Update customer record
            await this.customersRef.child(customerData.shopId).update({
                subscriptionId: stripeSubscription.id,
                stripeCustomerId: stripeCustomer.id,
                planId: planId,
                subscriptionStatus: stripeSubscription.status,
                trialEnd: stripeSubscription.trial_end,
                updatedAt: admin.database.ServerValue.TIMESTAMP
            });

            return {
                success: true,
                subscription: subscriptionData,
                clientSecret: stripeSubscription.latest_invoice.payment_intent.client_secret,
                message: 'Subscription created successfully. Complete payment to activate.'
            };

        } catch (error) {
            console.error('Subscription creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get Stripe price ID for plan
     */
    getStripePriceId(planId) {
        // In production, these would be actual Stripe Price IDs
        const priceIds = {
            starter: 'price_starter_monthly',
            professional: 'price_professional_monthly',
            enterprise: 'price_enterprise_monthly'
        };
        return priceIds[planId] || priceIds.starter;
    }

    /**
     * Get subscription status
     */
    async getSubscription(subscriptionId) {
        try {
            const snapshot = await this.subscriptionsRef.child(subscriptionId).once('value');
            const subscription = snapshot.val();

            if (!subscription) {
                return {
                    success: false,
                    error: 'Subscription not found'
                };
            }

            // Get latest status from Stripe
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

            // Update local status if changed
            if (stripeSubscription.status !== subscription.status) {
                await this.subscriptionsRef.child(subscriptionId).update({
                    status: stripeSubscription.status,
                    currentPeriodEnd: stripeSubscription.current_period_end,
                    updatedAt: admin.database.ServerValue.TIMESTAMP
                });
                subscription.status = stripeSubscription.status;
            }

            const plan = SUBSCRIPTION_PLANS[subscription.planId];

            return {
                success: true,
                subscription: {
                    ...subscription,
                    plan: plan,
                    isActive: ['active', 'trialing'].includes(stripeSubscription.status),
                    daysRemaining: this.calculateDaysRemaining(stripeSubscription.current_period_end)
                }
            };

        } catch (error) {
            console.error('Get subscription error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate days remaining in subscription
     */
    calculateDaysRemaining(endDate) {
        const now = Math.floor(Date.now() / 1000);
        const remaining = endDate - now;
        return Math.max(0, Math.ceil(remaining / (24 * 60 * 60)));
    }

    /**
     * Check if shop can create work order
     */
    async canCreateWorkOrder(shopId) {
        try {
            const snapshot = await this.customersRef.child(shopId).once('value');
            const customer = snapshot.val();

            if (!customer || !customer.subscriptionId) {
                return {
                    success: false,
                    error: 'No active subscription'
                };
            }

            const subResult = await this.getSubscription(customer.subscriptionId);
            
            if (!subResult.success || !subResult.subscription.isActive) {
                return {
                    success: false,
                    error: 'Subscription is not active'
                };
            }

            const plan = SUBSCRIPTION_PLANS[subResult.subscription.planId];

            // Check work order limit
            if (plan.limits.workOrders !== -1) {
                const workOrdersRef = this.db.ref('workOrders');
                const monthStart = new Date();
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);

                const workOrdersSnapshot = await workOrdersRef
                    .orderByChild('shopId')
                    .equalTo(shopId)
                    .once('value');

                let monthlyCount = 0;
                workOrdersSnapshot.forEach(child => {
                    const workOrder = child.val();
                    if (new Date(workOrder.createdAt) >= monthStart) {
                        monthlyCount++;
                    }
                });

                if (monthlyCount >= plan.limits.workOrders) {
                    return {
                        success: false,
                        error: `Work order limit reached (${plan.limits.workOrders}/month). Upgrade to Professional for unlimited.`
                    };
                }
            }

            return {
                success: true,
                remaining: plan.limits.workOrders === -1 ? 'unlimited' : plan.limits.workOrders
            };

        } catch (error) {
            console.error('Work order check error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update subscription plan
     */
    async updatePlan(subscriptionId, newPlanId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const newPriceId = this.getStripePriceId(newPlanId);

            const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
                items: [{
                    id: subscription.items.data[0].id,
                    price: newPriceId
                }],
                proration_behavior: 'create_prorations'
            });

            await this.subscriptionsRef.child(subscriptionId).update({
                planId: newPlanId,
                updatedAt: admin.database.ServerValue.TIMESTAMP
            });

            return {
                success: true,
                subscription: updatedSubscription,
                message: 'Plan updated successfully'
            };

        } catch (error) {
            console.error('Plan update error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId, cancelImmediately = false) {
        try {
            let cancelledSubscription;

            if (cancelImmediately) {
                cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);
            } else {
                cancelledSubscription = await stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true
                });
            }

            await this.subscriptionsRef.child(subscriptionId).update({
                cancelAtPeriodEnd: cancelledSubscription.cancel_at_period_end,
                status: cancelImmediately ? 'canceled' : cancelledSubscription.status,
                updatedAt: admin.database.ServerValue.TIMESTAMP
            });

            return {
                success: true,
                subscription: cancelledSubscription,
                message: cancelImmediately 
                    ? 'Subscription cancelled immediately' 
                    : 'Subscription will cancel at end of billing period'
            };

        } catch (error) {
            console.error('Cancel subscription error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Handle Stripe webhook events
     */
    async handleWebhook(event) {
        try {
            const eventType = event.type;
            const data = event.data.object;

            switch (eventType) {
                case 'invoice.payment_succeeded':
                    await this.handlePaymentSuccess(data);
                    break;

                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(data);
                    break;

                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(data);
                    break;

                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(data);
                    break;

                case 'invoice.created':
                    await this.handleInvoiceCreated(data);
                    break;

                default:
                    console.log(`Unhandled event type: ${eventType}`);
            }

            return {
                success: true,
                message: 'Webhook processed'
            };

        } catch (error) {
            console.error('Webhook error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Handle successful payment
     */
    async handlePaymentSuccess(invoice) {
        const subscriptionId = invoice.subscription;
        
        await this.subscriptionsRef.child(subscriptionId).update({
            status: 'active',
            lastPaymentAt: invoice.status_transitions.finalized_at * 1000,
            updatedAt: admin.database.ServerValue.TIMESTAMP
        });

        // Send confirmation email
        // Implementation depends on your email service
    }

    /**
     * Handle failed payment
     */
    async handlePaymentFailed(invoice) {
        const subscriptionId = invoice.subscription;

        await this.subscriptionsRef.child(subscriptionId).update({
            status: 'past_due',
            lastPaymentFailedAt: Date.now(),
            updatedAt: admin.database.ServerValue.TIMESTAMP
        });

        // Send payment failed email
    }

    /**
     * Handle subscription deleted
     */
    async handleSubscriptionDeleted(subscription) {
        const subscriptionId = subscription.id;

        await this.subscriptionsRef.child(subscriptionId).update({
            status: 'canceled',
            canceledAt: Date.now(),
            updatedAt: admin.database.ServerValue.TIMESTAMP
        });
    }

    /**
     * Handle subscription updated
     */
    async handleSubscriptionUpdated(subscription) {
        const subscriptionId = subscription.id;

        await this.subscriptionsRef.child(subscriptionId).update({
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
            updatedAt: admin.database.ServerValue.TIMESTAMP
        });
    }

    /**
     * Handle invoice created
     */
    async handleInvoiceCreated(invoice) {
        // Store invoice in Firebase for record keeping
        const invoicesRef = this.db.ref('invoices').child(invoice.subscription);
        await invoicesRef.child(invoice.id).set({
            id: invoice.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            status: invoice.status,
            created: invoice.created * 1000,
            dueDate: invoice.due_date * 1000,
            paid: invoice.paid
        });
    }

    /**
     * Get all subscriptions (admin)
     */
    async getAllSubscriptions() {
        try {
            const snapshot = await this.subscriptionsRef.once('value');
            const subscriptions = snapshot.val() || {};

            const subscriptionList = Object.keys(subscriptions).map(key => ({
                id: key,
                ...subscriptions[key],
                plan: SUBSCRIPTION_PLANS[subscriptions[key].planId]
            }));

            return {
                success: true,
                subscriptions: subscriptionList,
                total: subscriptionList.length
            };

        } catch (error) {
            console.error('Get all subscriptions error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get subscription revenue
     */
    async getRevenue(period = 'month') {
        try {
            const now = new Date();
            let startDate;

            switch (period) {
                case 'day':
                    startDate = new Date(now.setDate(now.getDate() - 1));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'year':
                    startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
            }

            const subscriptions = await this.getAllSubscriptions();
            let activeCount = 0;
            let monthlyRevenue = 0;

            if (subscriptions.success) {
                subscriptions.subscriptions.forEach(sub => {
                    if (['active', 'trialing'].includes(sub.status)) {
                        activeCount++;
                        monthlyRevenue += SUBSCRIPTION_PLANS[sub.planId].price;
                    }
                });
            }

            return {
                success: true,
                revenue: {
                    monthlyRevenue,
                    period,
                    activeSubscriptions: activeCount,
                    averageRevenue: activeCount > 0 ? monthlyRevenue / activeCount : 0
                }
            };

        } catch (error) {
            console.error('Get revenue error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate license key
     */
    generateLicenseKey() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 15);
        return `VHICL-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Validate license key
     */
    async validateLicenseKey(licenseKey) {
        try {
            const snapshot = await this.subscriptionsRef
                .orderByChild('licenseKey')
                .equalTo(licenseKey)
                .once('value');

            const data = snapshot.val();

            if (!data) {
                return {
                    valid: false,
                    error: 'License key not found'
                };
            }

            const subscriptionId = Object.keys(data)[0];
            const subscription = data[subscriptionId];

            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
            const isActive = ['active', 'trialing'].includes(stripeSubscription.status);

            return {
                valid: true,
                isActive,
                status: stripeSubscription.status,
                planId: subscription.planId,
                subscriptionId: subscriptionId,
                shopId: subscription.shopId
            };

        } catch (error) {
            console.error('License validation error:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

module.exports = SubscriptionService;