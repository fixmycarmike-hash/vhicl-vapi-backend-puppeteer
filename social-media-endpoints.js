/**
 * Social Media API Endpoints
 * Routes for Facebook/Instagram posting
 */

const SocialMediaService = require('./social-media-service.js');

function registerSocialMediaEndpoints(app, shopSettingsService) {
    let socialMediaService;

    // Initialize service
    async function initializeSocialMedia() {
        if (!socialMediaService) {
            const shopSettings = await shopSettingsService.getSettings();
            socialMediaService = new SocialMediaService(shopSettings);
        }
    }

    /**
     * POST /api/social/post
     * Post content to Facebook/Instagram
     */
    app.post('/api/social/post', async (req, res) => {
        try {
            await initializeSocialMedia();

            const { content, imageUrl, platform } = req.body;

            if (!content) {
                return res.status(400).json({ error: 'Content is required' });
            }

            let results;
            if (platform === 'facebook') {
                results = { facebook: await socialMediaService.postToFacebook(content, imageUrl) };
            } else if (platform === 'instagram') {
                if (!imageUrl) {
                    return res.status(400).json({ error: 'Image URL is required for Instagram' });
                }
                results = { instagram: await socialMediaService.postToInstagram(content, imageUrl) };
            } else {
                results = await socialMediaService.postToBoth(content, imageUrl);
            }

            res.json({
                success: results.facebook?.success || results.instagram?.success,
                results: results
            });
        } catch (error) {
            console.error('Social post error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/social/generate-post
     * Generate a post from template
     */
    app.post('/api/social/generate-post', async (req, res) => {
        try {
            await initializeSocialMedia();

            const { templateType, data } = req.body;

            const postContent = socialMediaService.generatePost(templateType, data || {});

            res.json({
                success: true,
                content: postContent,
                templateType: templateType
            });
        } catch (error) {
            console.error('Generate post error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/social/weekly-post
     * Generate and post weekly content
     */
    app.post('/api/social/weekly-post', async (req, res) => {
        try {
            await initializeSocialMedia();

            const result = await socialMediaService.postWeeklyContent();

            res.json(result);
        } catch (error) {
            console.error('Weekly post error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/social/templates
     * Get available post templates
     */
    app.get('/api/social/templates', async (req, res) => {
        try {
            await initializeSocialMedia();

            const templates = socialMediaService.getPostTemplates();

            res.json({
                success: true,
                templates: templates
            });
        } catch (error) {
            console.error('Get templates error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/social/schedule
     * Get posting schedule
     */
    app.get('/api/social/schedule', async (req, res) => {
        try {
            await initializeSocialMedia();

            const schedule = socialMediaService.getPostingSchedule();

            res.json({
                success: true,
                schedule: schedule
            });
        } catch (error) {
            console.error('Get schedule error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/social/stats
     * Get social media stats
     */
    app.get('/api/social/stats', async (req, res) => {
        try {
            await initializeSocialMedia();

            const stats = await socialMediaService.getStats();

            res.json(stats);
        } catch (error) {
            console.error('Get stats error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/social/validate
     * Validate social media configuration
     */
    app.get('/api/social/validate', async (req, res) => {
        try {
            await initializeSocialMedia();

            const validation = socialMediaService.validateConfiguration();

            res.json(validation);
        } catch (error) {
            console.error('Validate error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/social/upload-image
     * Upload image to Facebook
     */
    app.post('/api/social/upload-image', async (req, res) => {
        try {
            await initializeSocialMedia();

            const { imageUrl } = req.body;

            if (!imageUrl) {
                return res.status(400).json({ error: 'Image URL is required' });
            }

            const imageId = await socialMediaService.uploadImage(imageUrl);

            res.json({
                success: true,
                imageId: imageId
            });
        } catch (error) {
            console.error('Upload image error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/social/history
     * Get posting history (from database or file)
     */
    app.get('/api/social/history', async (req, res) => {
        try {
            // This would typically read from a database
            // For now, return sample data
            res.json({
                success: true,
                history: [
                    {
                        id: '1',
                        content: 'Just completed a brake service on a 2019 Toyota Camry!',
                        platforms: ['facebook', 'instagram'],
                        type: 'successStories',
                        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                        status: 'posted'
                    },
                    {
                        id: '2',
                        content: 'Pro Tip: Keep up with your oil change schedule!',
                        platforms: ['facebook'],
                        type: 'tips',
                        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                        status: 'posted'
                    }
                ]
            });
        } catch (error) {
            console.error('Get history error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * DELETE /api/social/post/:postId
     * Delete a post (Facebook/Instagram)
     */
    app.delete('/api/social/post/:postId', async (req, res) => {
        try {
            await initializeSocialMedia();

            const { postId } = req.params;
            const { platform } = req.query;

            // Note: Deleting posts requires additional permissions
            // This is a placeholder implementation
            res.json({
                success: true,
                message: 'Post deletion requires additional API permissions',
                postId: postId
            });
        } catch (error) {
            console.error('Delete post error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}

module.exports = registerSocialMediaEndpoints;
