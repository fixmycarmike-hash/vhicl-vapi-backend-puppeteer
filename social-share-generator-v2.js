// Social Media Share Card Generator for VHICL Pro - Version 2
// Enhanced with multiple caption templates and live editing

class SocialShareGenerator {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.shopInfo = null;
    }

    // Initialize canvas for image generation
    initCanvas(width, height) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        return this.canvas;
    }

    // Load shop information
    loadShopInfo() {
        this.shopInfo = window.loadShopSettings ? window.loadShopSettings() : {
            shopName: 'Your Auto Shop',
            shopPhone: '(555) 123-4567',
            shopAddress: '123 Main St, City, State'
        };
    }

    // Generate Instagram Post (1080x1080)
    async generateInstagramPost(assessmentData) {
        this.loadShopInfo();
        this.initCanvas(1080, 1080);
        const ctx = this.ctx;

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 1080);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1080);

        // White content box
        ctx.fillStyle = 'white';
        ctx.roundRect(60, 60, 960, 960, 30);
        ctx.fill();

        // Health Score Badge
        const score = assessmentData.healthScore || 0;
        const scoreColor = this.getScoreColor(score);
        
        // Large circle for score
        ctx.fillStyle = scoreColor;
        ctx.beginPath();
        ctx.arc(540, 300, 150, 0, Math.PI * 2);
        ctx.fill();

        // Score text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(score, 540, 330);

        ctx.font = 'bold 40px Arial';
        ctx.fillText('/100', 540, 380);

        // Score label
        ctx.fillStyle = '#333';
        ctx.font = 'bold 36px Arial';
        ctx.fillText(this.getScoreLabel(score), 540, 500);

        // Vehicle info
        const vehicleText = `${assessmentData.vehicle.year} ${assessmentData.vehicle.make} ${assessmentData.vehicle.model}`;
        ctx.font = 'bold 48px Arial';
        ctx.fillText(vehicleText, 540, 600);

        // Key highlights
        ctx.font = '32px Arial';
        ctx.textAlign = 'left';
        const highlights = this.getHighlights(assessmentData);
        let yPos = 680;
        
        highlights.forEach(highlight => {
            ctx.fillStyle = highlight.color;
            ctx.fillText(highlight.icon, 120, yPos);
            ctx.fillStyle = '#333';
            ctx.fillText(highlight.text, 180, yPos);
            yPos += 50;
        });

        // Shop branding
        ctx.fillStyle = '#667eea';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.shopInfo.shopName, 540, 900);

        ctx.fillStyle = '#666';
        ctx.font = '28px Arial';
        ctx.fillText(this.shopInfo.shopPhone, 540, 945);

        // Add QR code placeholder
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(880, 880, 120, 120);
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.fillText('QR', 940, 945);

        return this.canvas.toDataURL('image/png');
    }

    // Generate Instagram Story (1080x1920)
    async generateInstagramStory(assessmentData) {
        this.loadShopInfo();
        this.initCanvas(1080, 1920);
        const ctx = this.ctx;

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1920);

        // Title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('VEHICLE HEALTH REPORT', 540, 150);

        // White content box
        ctx.fillStyle = 'white';
        ctx.roundRect(60, 220, 960, 1400, 30);
        ctx.fill();

        // Health Score
        const score = assessmentData.healthScore || 0;
        const scoreColor = this.getScoreColor(score);
        
        ctx.fillStyle = scoreColor;
        ctx.beginPath();
        ctx.arc(540, 500, 180, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 140px Arial';
        ctx.fillText(score, 540, 540);

        ctx.font = 'bold 50px Arial';
        ctx.fillText('/100', 540, 600);

        // Score label
        ctx.fillStyle = '#333';
        ctx.font = 'bold 44px Arial';
        ctx.fillText(this.getScoreLabel(score), 540, 720);

        // Vehicle info
        const vehicleText = `${assessmentData.vehicle.year} ${assessmentData.vehicle.make} ${assessmentData.vehicle.model}`;
        ctx.font = 'bold 52px Arial';
        ctx.fillText(vehicleText, 540, 820);

        // Detailed highlights
        ctx.font = '36px Arial';
        ctx.textAlign = 'left';
        const highlights = this.getDetailedHighlights(assessmentData);
        let yPos = 920;
        
        highlights.forEach(highlight => {
            ctx.fillStyle = highlight.color;
            ctx.fillText(highlight.icon, 140, yPos);
            ctx.fillStyle = '#333';
            ctx.fillText(highlight.text, 210, yPos);
            yPos += 60;
        });

        // Shop branding
        ctx.fillStyle = '#667eea';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.shopInfo.shopName, 540, 1500);

        ctx.fillStyle = '#666';
        ctx.font = '32px Arial';
        ctx.fillText(this.shopInfo.shopPhone, 540, 1560);

        // Call to action
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px Arial';
        ctx.fillText('📱 Swipe Up to Book', 540, 1750);

        return this.canvas.toDataURL('image/png');
    }

    // Generate Facebook Post (1200x630)
    async generateFacebookPost(assessmentData) {
        this.loadShopInfo();
        this.initCanvas(1200, 630);
        const ctx = this.ctx;

        // Background
        const gradient = ctx.createLinearGradient(0, 0, 1200, 0);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1200, 630);

        // Left side - Score
        ctx.fillStyle = 'white';
        ctx.roundRect(40, 40, 500, 550, 20);
        ctx.fill();

        const score = assessmentData.healthScore || 0;
        const scoreColor = this.getScoreColor(score);
        
        ctx.fillStyle = scoreColor;
        ctx.beginPath();
        ctx.arc(290, 200, 120, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 100px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(score, 290, 230);

        ctx.font = 'bold 35px Arial';
        ctx.fillText('/100', 290, 270);

        ctx.fillStyle = '#333';
        ctx.font = 'bold 32px Arial';
        ctx.fillText(this.getScoreLabel(score), 290, 360);

        // Vehicle info
        const vehicleText = `${assessmentData.vehicle.year}`;
        ctx.font = 'bold 36px Arial';
        ctx.fillText(vehicleText, 290, 420);
        
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`${assessmentData.vehicle.make}`, 290, 460);
        ctx.fillText(`${assessmentData.vehicle.model}`, 290, 500);

        // Right side - Details
        ctx.fillStyle = 'white';
        ctx.font = '28px Arial';
        ctx.textAlign = 'left';
        
        const highlights = this.getHighlights(assessmentData);
        let yPos = 120;
        
        highlights.forEach(highlight => {
            ctx.fillStyle = highlight.color;
            ctx.fillText(highlight.icon, 600, yPos);
            ctx.fillStyle = 'white';
            ctx.fillText(highlight.text, 650, yPos);
            yPos += 60;
        });

        // Shop info
        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.fillText(this.shopInfo.shopName, 600, 500);
        
        ctx.font = '24px Arial';
        ctx.fillText(this.shopInfo.shopPhone, 600, 540);

        return this.canvas.toDataURL('image/png');
    }

    // Helper: Get score color
    getScoreColor(score) {
        if (score >= 80) return '#10b981'; // Green
        if (score >= 60) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    }

    // Helper: Get score label
    getScoreLabel(score) {
        if (score >= 80) return '✅ EXCELLENT CONDITION';
        if (score >= 60) return '⚠️ GOOD WITH MINOR ISSUES';
        return '❌ MAJOR CONCERNS FOUND';
    }

    // Helper: Get highlights
    getHighlights(assessmentData) {
        const highlights = [];
        
        if (assessmentData.diagnosticCodes && assessmentData.diagnosticCodes.length === 0) {
            highlights.push({ icon: '✅', text: 'No Diagnostic Codes', color: '#10b981' });
        } else if (assessmentData.diagnosticCodes) {
            highlights.push({ icon: '⚠️', text: `${assessmentData.diagnosticCodes.length} Codes Found`, color: '#f59e0b' });
        }

        if (assessmentData.readinessMonitors) {
            const ready = assessmentData.readinessMonitors.filter(m => m.status === 'Ready').length;
            highlights.push({ icon: '🔧', text: `${ready} Systems Ready`, color: '#10b981' });
        }

        if (assessmentData.batteryHealth && assessmentData.batteryHealth >= 12.4) {
            highlights.push({ icon: '🔋', text: 'Battery Healthy', color: '#10b981' });
        }

        return highlights.slice(0, 3); // Max 3 highlights
    }

    // Helper: Get detailed highlights
    getDetailedHighlights(assessmentData) {
        const highlights = [];
        
        if (assessmentData.diagnosticCodes) {
            if (assessmentData.diagnosticCodes.length === 0) {
                highlights.push({ icon: '✅', text: 'No Diagnostic Codes', color: '#10b981' });
            } else {
                highlights.push({ icon: '⚠️', text: `${assessmentData.diagnosticCodes.length} Codes Found`, color: '#f59e0b' });
            }
        }

        if (assessmentData.readinessMonitors) {
            const ready = assessmentData.readinessMonitors.filter(m => m.status === 'Ready').length;
            const total = assessmentData.readinessMonitors.length;
            highlights.push({ icon: '🔧', text: `${ready}/${total} Systems Ready`, color: '#10b981' });
        }

        if (assessmentData.batteryHealth) {
            highlights.push({ icon: '🔋', text: `Battery: ${assessmentData.batteryHealth.toFixed(1)}V`, color: '#10b981' });
        }

        if (assessmentData.coolantTemp) {
            highlights.push({ icon: '🌡️', text: `Coolant: ${assessmentData.coolantTemp}°F`, color: '#10b981' });
        }

        if (assessmentData.engineLoad) {
            highlights.push({ icon: '⚙️', text: `Engine Load: ${assessmentData.engineLoad}%`, color: '#10b981' });
        }

        return highlights.slice(0, 6); // Max 6 for story format
    }

    // Generate multiple caption options
    generateCaptionOptions(assessmentData) {
        const score = assessmentData.healthScore || 0;
        const vehicle = `${assessmentData.vehicle.year} ${assessmentData.vehicle.make} ${assessmentData.vehicle.model}`;
        const shopName = this.shopInfo.shopName;
        
        const captions = {
            'pre-purchase-high': {
                label: '🚗 Pre-Purchase Inspection (High Score)',
                text: `✅ Just got my pre-purchase inspection from ${shopName}! 

My ${vehicle} scored ${score}/100 - ready to hit the road! 🚗💨

Smart buyers always get inspected first. Thanks ${shopName}!

#CarInspection #SmartBuyer #UsedCars #PrePurchaseInspection`
            },
            'pre-purchase-medium': {
                label: '📋 Pre-Purchase Inspection (Medium Score)',
                text: `📋 Got my vehicle inspected by ${shopName} before buying.

Score: ${score}/100 - found some issues to negotiate on! 💰

This inspection just saved me $$$. Always inspect before you buy!

#PrePurchaseInspection #CarBuying #SmartShopping`
            },
            'pre-purchase-low': {
                label: '😅 Dodged a Bullet (Low Score)',
                text: `😅 ${shopName} just saved me from a HUGE mistake!

This ${vehicle} scored only ${score}/100 - walking away from this deal!

Best money I ever spent. Worth every penny!

#DodgedABullet #CarInspection #BuyerBeware`
            },
            'post-repair': {
                label: '🔧 Post-Repair Inspection',
                text: `🔧 Since my car was repaired at ${shopName}, my ${vehicle} now scores ${score}/100! 

${score >= 80 ? 'Running like new! 🚗✨' : 'Still got some more work to do, but getting there! 💪'}

Great service and thorough inspection. Highly recommend!

#AutoRepair #CarMaintenance #QualityService`
            },
            'maintenance-check': {
                label: '✅ Regular Maintenance Check',
                text: `✅ Just had my regular maintenance inspection at ${shopName}!

My ${vehicle} scored ${score}/100 - ${score >= 80 ? 'keeping it in top shape!' : 'time for some preventive maintenance!'}

Stay on top of your car's health! 🔧

#CarMaintenance #PreventiveMaintenance #AutoCare`
            },
            'peace-of-mind': {
                label: '😌 Peace of Mind',
                text: `😌 Got my ${vehicle} inspected at ${shopName} for peace of mind.

Health Score: ${score}/100

${score >= 80 ? 'No surprises - everything checks out!' : 'Found a few things to address, but glad I checked!'}

Knowledge is power! 💪

#CarInspection #PeaceOfMind #AutoCare`
            },
            'custom': {
                label: '✏️ Write Your Own',
                text: `My ${vehicle} scored ${score}/100 at ${shopName}!\n\n[Write your own message here...]\n\n#CarInspection #AutoCare`
            }
        };
        
        return captions;
    }
    
    // Generate default caption (for backward compatibility)
    generateCaption(assessmentData) {
        const options = this.generateCaptionOptions(assessmentData);
        const score = assessmentData.healthScore || 0;
        
        if (score >= 80) {
            return options['pre-purchase-high'].text;
        } else if (score >= 60) {
            return options['pre-purchase-medium'].text;
        } else {
            return options['pre-purchase-low'].text;
        }
    }

    // Show share dialog with caption options
    async showShareDialog(assessmentData) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center; overflow-y: auto; padding: 20px;';

        // Generate images
        const instagramPost = await this.generateInstagramPost(assessmentData);
        const instagramStory = await this.generateInstagramStory(assessmentData);
        const facebookPost = await this.generateFacebookPost(assessmentData);
        
        // Get all caption options
        const captionOptions = this.generateCaptionOptions(assessmentData);
        const defaultCaption = this.generateCaption(assessmentData);

        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 30px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 20px 0; color: #667eea;">📱 Share Your Vehicle Health Score</h2>
                
                <div style="margin-bottom: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border: 2px solid #10b981;">
                    <strong style="color: #10b981;">🎁 Share & Save 10%</strong>
                    <p style="margin: 5px 0 0 0; color: #666;">Share your score on social media and get 10% off your next service!</p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px;">
                    <div style="text-align: center;">
                        <img src="${instagramPost}" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <button onclick="window.downloadShareImage('${instagramPost}', 'instagram-post.png')" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%;">
                            📥 Instagram Post
                        </button>
                    </div>
                    
                    <div style="text-align: center;">
                        <img src="${instagramStory}" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <button onclick="window.downloadShareImage('${instagramStory}', 'instagram-story.png')" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%;">
                            📥 Instagram Story
                        </button>
                    </div>
                    
                    <div style="text-align: center;">
                        <img src="${facebookPost}" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <button onclick="window.downloadShareImage('${facebookPost}', 'facebook-post.png')" style="margin-top: 10px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%;">
                            📥 Facebook Post
                        </button>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">📝 Choose Your Caption Style:</label>
                    <select id="caption-selector" onchange="window.updateShareCaption()" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; margin-bottom: 10px;">
                        ${Object.entries(captionOptions).map(([key, option]) => 
                            `<option value="${key}">${option.label}</option>`
                        ).join('')}
                    </select>
                    
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">
                        ✏️ Edit Your Caption:
                        <span id="char-count" style="float: right; color: #666; font-weight: normal; font-size: 14px;">0 characters</span>
                    </label>
                    <textarea id="share-caption" style="width: 100%; height: 180px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: Arial; resize: vertical; font-size: 15px;" oninput="window.updateCharCount()">${defaultCaption}</textarea>
                    
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button onclick="navigator.clipboard.writeText(document.getElementById('share-caption').value); alert('✅ Caption copied to clipboard!')" style="flex: 1; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                            📋 Copy Caption
                        </button>
                        <button onclick="window.resetCaption()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            🔄 Reset
                        </button>
                    </div>
                    
                    <div style="margin-top: 10px; padding: 10px; background: #f3f4f6; border-radius: 6px; font-size: 13px; color: #666;">
                        💡 <strong>Tip:</strong> Personalize your caption! Add your own story, tag friends, or mention specific features you love about your vehicle.
                    </div>
                </div>

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <button onclick="this.closest('.modal-overlay').remove()" style="padding: 12px 30px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                        ✓ Done
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Store caption options for later use
        window.currentCaptionOptions = captionOptions;
        
        // Update character count initially
        window.updateCharCount();
    }
}

// Helper function to download images
window.downloadShareImage = function(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
};

// Helper function to update caption based on selection
window.updateShareCaption = function() {
    const selector = document.getElementById('caption-selector');
    const textarea = document.getElementById('share-caption');
    const selectedKey = selector.value;
    
    if (window.currentCaptionOptions && window.currentCaptionOptions[selectedKey]) {
        textarea.value = window.currentCaptionOptions[selectedKey].text;
        window.updateCharCount();
    }
};

// Helper function to update character count
window.updateCharCount = function() {
    const textarea = document.getElementById('share-caption');
    const charCount = document.getElementById('char-count');
    
    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = `${count} characters`;
        
        // Warn if over Instagram's limit (2200 characters)
        if (count > 2200) {
            charCount.style.color = '#ef4444';
            charCount.textContent = `${count} characters (Instagram limit: 2200)`;
        } else {
            charCount.style.color = '#666';
        }
    }
};

// Helper function to reset caption to selected template
window.resetCaption = function() {
    window.updateShareCaption();
};

// Initialize and export
if (typeof window !== 'undefined') {
    window.SocialShareGenerator = SocialShareGenerator;
    window.socialShareGenerator = new SocialShareGenerator();
}