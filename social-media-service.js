/**
 * VHICL Pro - Social Media Posting Service
 * Posts to Facebook and Instagram automatically
 */

let axios;
try {
    axios = require('axios');
} catch (error) {
    console.warn('⚠️ axios not installed - social media features will be disabled');
    axios = null;
}

class SocialMediaService {
    constructor(shopSettings) {
        this.shopSettings = shopSettings;
        this.isEnabled = axios !== null;
        this.facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || shopSettings.facebookAccessToken;
        this.facebookPageId = process.env.FACEBOOK_PAGE_ID || shopSettings.facebookPageId;
        this.instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID || shopSettings.instagramAccountId;
        this.metaAppId = process.env.META_APP_ID || shopSettings.metaAppId;
        this.metaAppSecret = process.env.META_APP_SECRET || shopSettings.metaAppSecret;
    }

    /**
     * Post templates for auto shop content
     */
    getPostTemplates() {
        return {
            successStories: [
                "Just completed a {service} on a {year} {make} {model}! Customer couldn't be happier with the results. 🚗✨ #AutoRepair #HappyCustomer #{city}Auto",
                "Another satisfied customer! We fixed their {service} and they're back on the road. Thanks for trusting {shopName}! 🛠️ #AutoRepair #QualityService",
                "Success story: {service} completed successfully on a {year} {make} {model}. Vehicle running like new! 🎉 #AutoShop #CarCare"
            ],
            tips: [
                "Pro Tip: Keep up with your {maintenance} schedule to avoid costly repairs down the road. Schedule yours today! 📅 #CarMaintenance #AutoTips",
                "Did you know? Regular {maintenance} can extend your vehicle's life by up to 50%. Book your appointment now! 🔧 #AutoShop #Maintenance",
                "Maintenance tip: Don't ignore {maintenance} signs. Early detection saves money and keeps you safe! 🚗 #AutoRepair #SafetyFirst"
            ],
            promotions: [
                "🎉 Special Offer: Get {discount}% off {service} this week! Call {phone} or visit our website to book. Limited time! #AutoRepair #SpecialOffer #{city}",
                "This week only: {service} for just ${price}! Regularly ${originalPrice}. Don't miss out! 🚗 #AutoShop #Deals #{city}Auto",
                "Flash sale! {service} at a discount. Call {phone} to schedule. Hurry, offer ends {date}! 🔧 #AutoRepair #Sale"
            ],
            educational: [
                "Ever wonder what {service} does? It's crucial for your vehicle's {benefit}. We're here to help! 📚 #AutoEducation #CarCare",
                "Understanding {service}: This maintenance item prevents {problem} and saves you money long-term. Learn more on our blog! 📖 #AutoTips #Maintenance",
                "Did you know? {service} is often overlooked but essential for {benefit}. Let us handle it for you! 🚗 #AutoRepair #CarFacts"
            ],
            team: [
                "Meet our team! We have {years} years of combined experience. Your car is in good hands at {shopName}! 👨‍🔧 #AutoShop #ExpertTeam",
                "Our technicians are certified professionals with {years} years of experience. Trust your car to the experts! 🏆 #AutoRepair #Certified",
                "Behind every great repair is a great team. Meet our skilled technicians! 👥 #AutoShop #TeamWork"
            ],
            beforeAfter: [
                "Before & After: {service} transformation! Check out the difference. 📸 #BeforeAfter #AutoRepair #CarCare",
                "Amazing transformation! This {year} {make} {model} looks brand new after {service}. 🚗✨ #AutoShop #Restoration",
                "See what we can do! Before and after of today's {service}. Results speak for themselves! 📸 #AutoRepair #QualityWork"
            ],
            community: [
                "Proud to serve the {city} community for {years} years! Thank you for your continued support. 🙏 #Community #LocalBusiness #{city}",
                "We love being part of the {city} community! Supporting local events and keeping your vehicles running. 🏘️ #ShopLocal #{city}",
                "{city}, we're here for you! From routine maintenance to major repairs, trust your local experts. 🚗 #LocalBusiness #{city}Auto"
            ],
            seasonal: [
                "🍂 Fall maintenance time! Prepare your vehicle for the season. Book your inspection today! 📅 #SeasonalMaintenance #AutoCare",
                "☀️ Summer is here! Is your AC ready? Schedule your AC check today! ❄️ #AutoRepair #SummerReady",
                "❄️ Winter prep: Get your vehicle ready for cold weather. Check tires, battery, and fluids! 🚗 #WinterReady #AutoCare"
            ]
        };
    }

    /**
     * Generate a post based on template and data
     */
    generatePost(templateType, data) {
        const templates = this.getPostTemplates();
        const templateList = templates[templateType] || templates.successStories;
        const template = templateList[Math.floor(Math.random() * templateList.length)];

        // Replace placeholders with actual data
        let post = template
            .replace(/{service}/g, data.service || 'service')
            .replace(/{maintenance}/g, data.maintenance || 'maintenance')
            .replace(/{year}/g, data.year || 'vehicle')
            .replace(/{make}/g, data.make || 'vehicle')
            .replace(/{model}/g, data.model || '')
            .replace(/{shopName}/g, this.shopSettings.name || 'our shop')
            .replace(/{phone}/g, this.shopSettings.phone || 'us')
            .replace(/{city}/g, this.shopSettings.city || 'local')
            .replace(/{discount}/g, data.discount || '10')
            .replace(/{price}/g, data.price || 'special price')
            .replace(/{originalPrice}/g, data.originalPrice || 'regular price')
            .replace(/{date}/g, data.date || 'soon')
            .replace(/{years}/g, data.years || 'many')
            .replace(/{benefit}/g, data.benefit || 'performance')
            .replace(/{problem}/g, data.problem || 'issues');

        return post;
    }

    /**
     * Post to Facebook Page
     */
    async postToFacebook(content, imageId = null) {
        if (!this.isEnabled) {
            throw new Error('Social media features are not available - axios module missing');
        }
        try {
            const url = `https://graph.facebook.com/v18.0/${this.facebookPageId}/feed`;
            
            const payload = {
                message: content,
                access_token: this.facebookAccessToken
            };

            if (imageId) {
                payload.attached_media = JSON.stringify({ media_fbid: imageId });
            }

            const response = await axios.post(url, payload);
            
            return {
                success: true,
                postId: response.data.id,
                platform: 'facebook',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Facebook posting error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message,
                platform: 'facebook'
            };
        }
    }

    /**
     * Upload image to Facebook (can be used for Instagram too)
     */
    async uploadImage(imageUrl) {
        try {
            const url = `https://graph.facebook.com/v18.0/${this.facebookPageId}/photos`;
            
            const response = await axios.post(url, {
                url: imageUrl,
                access_token: this.facebookAccessToken,
                published: false // Create unpublished photo
            });

            return response.data.id;
        } catch (error) {
            console.error('Image upload error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Post to Instagram (requires Facebook Business account)
     */
    async postToInstagram(content, imageUrl) {
        try {
            // Step 1: Upload image
            const containerId = await this.createInstagramContainer(imageUrl, content);
            
            // Step 2: Publish the container
            const url = `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media_publish`;
            const response = await axios.post(url, {
                creation_id: containerId,
                access_token: this.facebookAccessToken
            });

            return {
                success: true,
                postId: response.data.id,
                platform: 'instagram',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Instagram posting error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message,
                platform: 'instagram'
            };
        }
    }

    /**
     * Create Instagram media container
     */
    async createInstagramContainer(imageUrl, caption) {
        try {
            const url = `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media`;
            
            const response = await axios.post(url, {
                image_url: imageUrl,
                caption: caption,
                access_token: this.facebookAccessToken
            });

            return response.data.id;
        } catch (error) {
            console.error('Instagram container creation error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Post to both Facebook and Instagram
     */
    async postToBoth(content, imageUrl = null) {
        const results = {
            facebook: null,
            instagram: null
        };

        // Post to Facebook
        if (this.facebookPageId && this.facebookAccessToken) {
            let imageId = null;
            if (imageUrl) {
                try {
                    imageId = await this.uploadImage(imageUrl);
                } catch (error) {
                    console.error('Image upload failed, posting text only to Facebook');
                }
            }
            results.facebook = await this.postToFacebook(content, imageId);
        }

        // Post to Instagram (requires image)
        if (this.instagramAccountId && this.facebookAccessToken && imageUrl) {
            results.instagram = await this.postToInstagram(content, imageUrl);
        }

        return results;
    }

    /**
     * Generate and post weekly content
     */
    async postWeeklyContent(postType = 'auto') {
        const postTypes = ['successStories', 'tips', 'promotions', 'educational', 'team', 'community', 'seasonal'];
        
        // Auto-rotate through post types
        const typeIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % postTypes.length;
        const selectedType = postTypes[typeIndex];

        // Generate sample data
        const data = {
            service: 'brake service',
            maintenance: 'oil change',
            year: '2019',
            make: 'Toyota',
            model: 'Camry',
            discount: '15',
            price: '$99',
            originalPrice: '$129',
            date: 'Friday',
            years: '10',
            benefit: 'safety and performance',
            problem: 'breakdowns'
        };

        const content = this.generatePost(selectedType, data);
        
        // Can add image URL if available
        const imageUrl = null;

        const results = await this.postToBoth(content, imageUrl);

        return {
            success: results.facebook?.success || results.instagram?.success,
            content: content,
            type: selectedType,
            results: results,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get posting schedule
     */
    getPostingSchedule() {
        return {
            frequency: 'weekly',
            dayOfWeek: 'Monday', // Best day for auto posts
            time: '10:00 AM',
            timezone: 'America/New_York',
            platforms: ['facebook', 'instagram'],
            postTypes: ['successStories', 'tips', 'promotions', 'educational', 'team', 'community', 'seasonal']
        };
    }

    /**
     * Get social media stats
     */
    async getStats() {
        try {
            // Get page insights (requires page access token)
            const url = `https://graph.facebook.com/v18.0/${this.facebookPageId}/insights`;
            const response = await axios.get(url, {
                params: {
                    metric: 'page_impressions,page_engaged_users,page_post_engagements',
                    period: 'day',
                    access_token: this.facebookAccessToken
                }
            });

            return {
                success: true,
                stats: response.data.data
            };
        } catch (error) {
            console.error('Stats error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Validate configuration
     */
    validateConfiguration() {
        const errors = [];

        if (!this.facebookAccessToken) {
            errors.push('Facebook Access Token is required');
        }

        if (!this.facebookPageId) {
            errors.push('Facebook Page ID is required');
        }

        if (!this.instagramAccountId) {
            errors.push('Instagram Account ID is required for Instagram posting');
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            canPostToFacebook: !!this.facebookAccessToken && !!this.facebookPageId,
            canPostToInstagram: !!this.facebookAccessToken && !!this.instagramAccountId
        };
    }
}

module.exports = SocialMediaService;
