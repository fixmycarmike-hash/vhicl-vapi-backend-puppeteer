#!/bin/bash

# ========================================
# VHICL Pro - DigitalOcean Setup Script
# ========================================

echo "🚀 VHICL Pro - DigitalOcean Setup"
echo "=================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
apt-get update && apt-get upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
echo "📦 Installing PM2..."
npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
apt-get install -y nginx

# Install Chromium for Puppeteer
echo "📦 Installing Chromium for Puppeteer..."
apt-get install -y chromium-browser

# Create vhiclpro directory
echo "📁 Creating vhiclpro directory..."
mkdir -p /var/www/vhiclpro
cd /var/www/vhiclpro

# Copy files (assumes files are in current directory)
echo "📋 Copying application files..."
cp -r /workspace/* /var/www/vhiclpro/

# Create public directory for frontend
mkdir -p /var/www/vhiclpro/public

# Copy frontend files to public directory
echo "📋 Copying frontend files..."
cp /workspace/index.html /var/www/vhiclpro/public/ 2>/dev/null || echo "⚠️  index.html not found"
cp /workspace/quick-quote.html /var/www/vhiclpro/public/ 2>/dev/null || echo "⚠️  quick-quote.html not found"
cp /workspace/*.css /var/www/vhiclpro/public/ 2>/dev/null || echo "⚠️  CSS files not found"
cp /workspace/*.js /var/www/vhiclpro/public/ 2>/dev/null || echo "⚠️  JS files not found"

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install --production

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your credentials"
fi

# Set up PM2
echo "🔧 Setting up PM2..."
pm2 start server.js --name vhiclpro-backend
pm2 save
pm2 startup systemd -u root --hp /root

# Configure Nginx
echo "🔧 Configuring Nginx..."
cat > /etc/nginx/sites-available/vhiclpro << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend files
    location / {
        root /var/www/vhiclpro/public;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/vhiclpro /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx

# Set up SSL with Certbot (optional)
echo ""
echo "🔒 To set up SSL/HTTPS, run: certbot --nginx -d yourdomain.com"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 System Status:"
echo "   - Node.js: $(node --version)"
echo "   - NPM: $(npm --version)"
echo "   - PM2: $(pm2 --version)"
echo "   - Nginx: $(nginx -v 2>&1)"
echo ""
echo "🚀 Your application is running!"
echo "   - Frontend: http://your-droplet-ip/"
echo "   - Backend API: http://your-droplet-ip/api/"
echo "   - Health check: http://your-droplet-ip/health"
echo ""
echo "📝 Next steps:"
echo "   1. Edit /var/www/vhiclpro/.env with your credentials"
echo "   2. Restart PM2: pm2 restart vhiclpro-backend"
echo "   3. Set up SSL: certbot --nginx -d yourdomain.com"
echo ""