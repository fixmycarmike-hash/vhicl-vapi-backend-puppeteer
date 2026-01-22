/**
 * Shop Branding Service
 * Manages logos, color schemes, and branding elements for each shop
 */

class ShopBrandingService {
  constructor() {
    this.defaultColors = {
      primary: '#2563eb',
      secondary: '#64748b',
      accent: '#3b82f6',
      background: '#ffffff',
      text: '#1e293b',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    };
  }

  /**
   * Get shop branding configuration
   * @param {string} shopId - Shop ID
   * @returns {Promise<object>}
   */
  async getBranding(shopId) {
    try {
      const { ShopRouter } = require('./firebase-config');
      const brandingDoc = await ShopRouter.getShopDocument(shopId, 'branding', 'config').get();
      
      if (!brandingDoc.exists) {
        return this.getDefaultBranding();
      }

      const branding = brandingDoc.data();
      
      // Merge with defaults for any missing values
      return {
        ...this.getDefaultBranding(),
        ...branding
      };
    } catch (error) {
      console.error('Error getting branding:', error);
      return this.getDefaultBranding();
    }
  }

  /**
   * Update shop branding
   * @param {string} shopId - Shop ID
   * @param {object} brandingData - Branding data
   * @returns {Promise<void>}
   */
  async updateBranding(shopId, brandingData) {
    try {
      const { ShopRouter } = require('./firebase-config');
      
      await ShopRouter.getShopDocument(shopId, 'branding', 'config').set({
        ...brandingData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating branding:', error);
      throw error;
    }
  }

  /**
   * Upload shop logo
   * @param {string} shopId - Shop ID
   * @param {Buffer} fileBuffer - Logo file buffer
   * @param {string} fileName - File name
   * @returns {Promise<string>} - Public URL
   */
  async uploadLogo(shopId, fileBuffer, fileName) {
    try {
      const { CloudStorageManager } = require('./firebase-config');
      const bucket = CloudStorageManager.getShopStorage(shopId);
      const filePath = `shops/${shopId}/branding/logo.${this.getFileExtension(fileName)}`;
      const file = bucket.file(filePath);

      await file.save(fileBuffer, {
        metadata: {
          contentType: this.getContentType(fileName)
        }
      });

      await file.makePublic();

      const logoUrl = file.publicUrl();
      
      // Update branding with new logo URL
      await this.updateBranding(shopId, { logoUrl });

      return logoUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  }

  /**
   * Generate CSS variables from branding
   * @param {string} shopId - Shop ID
   * @returns {Promise<string>}
   */
  async generateCSSVariables(shopId) {
    try {
      const branding = await this.getBranding(shopId);
      
      const css = `
:root {
  --vhicl-primary: ${branding.colors.primary};
  --vhicl-secondary: ${branding.colors.secondary};
  --vhicl-accent: ${branding.colors.accent};
  --vhicl-background: ${branding.colors.background};
  --vhicl-text: ${branding.colors.text};
  --vhicl-success: ${branding.colors.success};
  --vhicl-warning: ${branding.colors.warning};
  --vhicl-error: ${branding.colors.error};
  --vhicl-logo-url: url('${branding.logoUrl}');
}
      `.trim();

      return css;
    } catch (error) {
      console.error('Error generating CSS variables:', error);
      return this.generateDefaultCSS();
    }
  }

  /**
   * Generate branded email HTML
   * @param {string} shopId - Shop ID
   * @param {string} subject - Email subject
   * @param {string} content - Email content HTML
   * @returns {Promise<string>}
   */
  async generateBrandedEmail(shopId, subject, content) {
    try {
      const branding = await this.getBranding(shopId);
      const { ShopRouter } = require('./firebase-config');
      
      // Get shop info
      const shopDoc = await ShopRouter.getShopDocument(shopId, 'settings', 'info').get();
      const shopInfo = shopDoc.exists ? shopDoc.data() : {};

      const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: ${branding.colors.primary};
      padding: 20px;
      text-align: center;
    }
    .header img {
      max-height: 60px;
      max-width: 100%;
    }
    .header h1 {
      color: #ffffff;
      margin: 10px 0 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .footer {
      background-color: ${branding.colors.secondary};
      color: #ffffff;
      padding: 20px;
      text-align: center;
      font-size: 14px;
    }
    .footer a {
      color: ${branding.colors.accent};
      text-decoration: none;
    }
    .button {
      display: inline-block;
      background-color: ${branding.colors.primary};
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${shopInfo.name || 'Shop Logo'}">` : ''}
      ${!branding.logoUrl ? `<h1>${shopInfo.name || 'Your Shop'}</h1>` : ''}
    </div>
    <div class="content">
      <h2 style="color: ${branding.colors.primary};">${subject}</h2>
      ${content}
    </div>
    <div class="footer">
      <p><strong>${shopInfo.name || 'Your Shop'}</strong></p>
      <p>${shopInfo.address || ''}</p>
      <p>${shopInfo.phone || ''} | ${shopInfo.email || ''}</p>
      <p style="margin-top: 20px; font-size: 12px;">
        ${shopInfo.website ? `<a href="${shopInfo.website}">${shopInfo.website}</a>` : ''}
      </p>
    </div>
  </div>
</body>
</html>
      `.trim();

      return emailHTML;
    } catch (error) {
      console.error('Error generating branded email:', error);
      // Return plain HTML if branding fails
      return content;
    }
  }

  /**
   * Generate branded invoice HTML
   * @param {string} shopId - Shop ID
   * @param {object} invoiceData - Invoice data
   * @returns {Promise<string>}
   */
  async generateBrandedInvoice(shopId, invoiceData) {
    try {
      const branding = await this.getBranding(shopId);
      const { ShopRouter } = require('./firebase-config');
      
      // Get shop info
      const shopDoc = await ShopRouter.getShopDocument(shopId, 'settings', 'info').get();
      const shopInfo = shopDoc.exists ? shopDoc.data() : {};

      const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .invoice {
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid ${branding.colors.primary};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header img {
      max-height: 80px;
      max-width: 200px;
    }
    .shop-info {
      text-align: right;
    }
    .shop-name {
      font-size: 28px;
      font-weight: bold;
      color: ${branding.colors.primary};
    }
    .invoice-details {
      margin-bottom: 30px;
      padding: 15px;
      background-color: ${branding.colors.background};
      border-left: 4px solid ${branding.colors.primary};
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: ${branding.colors.primary};
      margin: 20px 0 10px;
      border-bottom: 1px solid ${branding.colors.secondary};
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .table th {
      background-color: ${branding.colors.primary};
      color: #ffffff;
      padding: 12px;
      text-align: left;
    }
    .table td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .table tr:hover {
      background-color: #f9fafb;
    }
    .total {
      font-size: 24px;
      font-weight: bold;
      text-align: right;
      color: ${branding.colors.primary};
      margin: 20px 0;
    }
    .photos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
      margin: 20px 0;
    }
    .photos img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      border-radius: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid ${branding.colors.secondary};
      text-align: center;
      color: ${branding.colors.text};
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${shopInfo.name || 'Shop Logo'}">` : ''}
      </div>
      <div class="shop-info">
        <div class="shop-name">${shopInfo.name || 'Your Shop'}</div>
        <div>${shopInfo.address || ''}</div>
        <div>${shopInfo.phone || ''}</div>
        <div>${shopInfo.email || ''}</div>
      </div>
    </div>

    <div class="invoice-details">
      <strong>Invoice #${invoiceData.invoiceNumber}</strong><br>
      Date: ${new Date().toLocaleDateString()}<br>
      Customer: ${invoiceData.customerName}<br>
      Vehicle: ${invoiceData.vehicleInfo}
    </div>

    <div class="section-title">Services & Parts</div>
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceData.items.map(item => `
          <tr>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>$${(item.quantity * item.price).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="total">Total: $${invoiceData.total.toFixed(2)}</div>

    ${invoiceData.photos && invoiceData.photos.length > 0 ? `
      <div class="section-title">Photos</div>
      <div class="photos">
        ${invoiceData.photos.map(photo => `
          <img src="${photo.url}" alt="${photo.description || 'Vehicle photo'}">
        `).join('')}
      </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>${shopInfo.name || 'Your Shop'}</p>
    </div>
  </div>
</body>
</html>
      `.trim();

      return invoiceHTML;
    } catch (error) {
      console.error('Error generating branded invoice:', error);
      throw error;
    }
  }

  /**
   * Get default branding
   * @returns {object}
   */
  getDefaultBranding() {
    return {
      logoUrl: '',
      colors: { ...this.defaultColors },
      customCSS: ''
    };
  }

  /**
   * Generate default CSS
   * @returns {string}
   */
  generateDefaultCSS() {
    const branding = this.getDefaultBranding();
    
    const css = `
:root {
  --vhicl-primary: ${branding.colors.primary};
  --vhicl-secondary: ${branding.colors.secondary};
  --vhicl-accent: ${branding.colors.accent};
  --vhicl-background: ${branding.colors.background};
  --vhicl-text: ${branding.colors.text};
  --vhicl-success: ${branding.colors.success};
  --vhicl-warning: ${branding.colors.warning};
  --vhicl-error: ${branding.colors.error};
}
    `.trim();

    return css;
  }

  /**
   * Get file extension
   * @param {string} fileName - File name
   * @returns {string}
   */
  getFileExtension(fileName) {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'png';
  }

  /**
   * Get content type
   * @param {string} fileName - File name
   * @returns {string}
   */
  getContentType(fileName) {
    const ext = this.getFileExtension(fileName);
    const types = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp'
    };
    return types[ext] || 'image/jpeg';
  }
}

module.exports = ShopBrandingService;