/**
 * Photo Management Service
 * Handles before/after photos, vehicle documentation, and photo display
 */

const { CloudStorageManager } = require('./firebase-config');
const { ShopRouter } = require('./firebase-config');
const admin = require('firebase-admin');

class PhotoManagementService {
  /**
   * Upload vehicle photo
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @param {Buffer} fileBuffer - Photo file buffer
   * @param {string} fileName - File name
   * @param {object} metadata - Photo metadata
   * @returns {Promise<object>}
   */
  async uploadPhoto(shopId, vehicleId, fileBuffer, fileName, metadata = {}) {
    try {
      // Upload to Firebase Storage
      const photoUrl = await CloudStorageManager.uploadPhoto(
        shopId,
        vehicleId,
        fileBuffer,
        fileName,
        {
          photoType: metadata.photoType || 'general',
          technicianId: metadata.technicianId || '',
          description: metadata.description || '',
          uploadedBy: metadata.uploadedBy || '',
          ...metadata
        }
      );

      // Save photo metadata to Firestore
      const photoDoc = await ShopRouter.getShopCollection(shopId, 'photos').add({
        id: '', // Will be set after creation
        vehicleId,
        url: photoUrl,
        fileName,
        photoType: metadata.photoType || 'general', // 'before', 'after', 'progress', 'document'
        technicianId: metadata.technicianId || '',
        description: metadata.description || '',
        uploadedBy: metadata.uploadedBy || '',
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        fileSize: fileBuffer.length,
        contentType: metadata.contentType || 'image/jpeg'
      });

      // Update with document ID
      await photoDoc.update({ id: photoDoc.id });

      return {
        id: photoDoc.id,
        url: photoUrl,
        ...metadata
      };
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  }

  /**
   * Get all photos for a vehicle
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Array>}
   */
  async getVehiclePhotos(shopId, vehicleId) {
    try {
      const photosSnapshot = await ShopRouter.getShopCollection(shopId, 'photos')
        .where('vehicleId', '==', vehicleId)
        .orderBy('uploadedAt', 'desc')
        .get();

      return photosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting vehicle photos:', error);
      throw error;
    }
  }

  /**
   * Get photos by type (before/after)
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @param {string} photoType - Photo type ('before', 'after', 'progress', 'document')
   * @returns {Promise<Array>}
   */
  async getPhotosByType(shopId, vehicleId, photoType) {
    try {
      const photosSnapshot = await ShopRouter.getShopCollection(shopId, 'photos')
        .where('vehicleId', '==', vehicleId)
        .where('photoType', '==', photoType)
        .orderBy('uploadedAt', 'desc')
        .get();

      return photosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting photos by type:', error);
      throw error;
    }
  }

  /**
   * Get before/after photo pairs
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Array>}
   */
  async getBeforeAfterPairs(shopId, vehicleId) {
    try {
      const beforePhotos = await this.getPhotosByType(shopId, vehicleId, 'before');
      const afterPhotos = await this.getPhotosByType(shopId, vehicleId, 'after');

      const pairs = [];
      
      // Match before and after photos by description or time
      beforePhotos.forEach(before => {
        const matchingAfter = afterPhotos.find(after => 
          after.description === before.description || 
          after.technicianId === before.technicianId
        );
        
        pairs.push({
          before,
          after: matchingAfter || null
        });
      });

      return pairs;
    } catch (error) {
      console.error('Error getting before/after pairs:', error);
      throw error;
    }
  }

  /**
   * Delete photo
   * @param {string} shopId - Shop ID
   * @param {string} photoId - Photo ID
   * @returns {Promise<void>}
   */
  async deletePhoto(shopId, photoId) {
    try {
      // Get photo metadata
      const photoDoc = await ShopRouter.getShopDocument(shopId, 'photos', photoId).get();
      
      if (!photoDoc.exists) {
        throw new Error('Photo not found');
      }

      const photoData = photoDoc.data();

      // Delete from storage
      await CloudStorageManager.deletePhoto(photoData.url);

      // Delete from Firestore
      await ShopRouter.getShopDocument(shopId, 'photos', photoId).delete();
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }

  /**
   * Update photo metadata
   * @param {string} shopId - Shop ID
   * @param {string} photoId - Photo ID
   * @param {object} metadata - Updated metadata
   * @returns {Promise<void>}
   */
  async updatePhoto(shopId, photoId, metadata) {
    try {
      await ShopRouter.getShopDocument(shopId, 'photos', photoId).update(metadata);
    } catch (error) {
      console.error('Error updating photo:', error);
      throw error;
    }
  }

  /**
   * Attach photo to invoice
   * @param {string} shopId - Shop ID
   * @param {string} invoiceId - Invoice ID
   * @param {string} photoId - Photo ID
   * @returns {Promise<void>}
   */
  async attachToInvoice(shopId, invoiceId, photoId) {
    try {
      // Add photo reference to invoice
      await ShopRouter.getShopDocument(shopId, 'invoices', invoiceId).update({
        photos: admin.firestore.FieldValue.arrayUnion({
          photoId,
          attachedAt: admin.firestore.FieldValue.serverTimestamp()
        })
      });
    } catch (error) {
      console.error('Error attaching photo to invoice:', error);
      throw error;
    }
  }

  /**
   * Get photos for invoice
   * @param {string} shopId - Shop ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Array>}
   */
  async getInvoicePhotos(shopId, invoiceId) {
    try {
      const invoiceDoc = await ShopRouter.getShopDocument(shopId, 'invoices', invoiceId).get();
      
      if (!invoiceDoc.exists) {
        return [];
      }

      const invoiceData = invoiceDoc.data();
      const photoRefs = invoiceData.photos || [];

      const photos = [];
      
      for (const ref of photoRefs) {
        const photoDoc = await ShopRouter.getShopDocument(shopId, 'photos', ref.photoId).get();
        if (photoDoc.exists) {
          photos.push({
            id: photoDoc.id,
            ...photoDoc.data(),
            attachedAt: ref.attachedAt
          });
        }
      }

      return photos;
    } catch (error) {
      console.error('Error getting invoice photos:', error);
      throw error;
    }
  }

  /**
   * Get photo gallery HTML
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<string>}
   */
  async getPhotoGalleryHTML(shopId, vehicleId) {
    try {
      const photos = await this.getVehiclePhotos(shopId, vehicleId);
      
      const html = `
<div class="photo-gallery">
  <h3>Vehicle Photos</h3>
  <div class="photo-grid">
    ${photos.map(photo => `
      <div class="photo-item" data-photo-type="${photo.photoType}">
        <img src="${photo.url}" alt="${photo.description || 'Vehicle photo'}" onclick="openPhotoViewer('${photo.id}')">
        <div class="photo-info">
          <span class="photo-type">${photo.photoType.toUpperCase()}</span>
          <span class="photo-description">${photo.description || ''}</span>
        </div>
      </div>
    `).join('')}
  </div>
</div>

<style>
  .photo-gallery {
    margin: 20px 0;
  }
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin-top: 15px;
  }
  .photo-item {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  .photo-item img {
    width: 100%;
    height: 150px;
    object-fit: cover;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .photo-item img:hover {
    transform: scale(1.05);
  }
  .photo-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.8));
    padding: 10px;
    color: #ffffff;
  }
  .photo-type {
    display: inline-block;
    background: var(--vhicl-primary, #2563eb);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
  }
  .photo-description {
    display: block;
    font-size: 12px;
    margin-top: 5px;
  }
  .photo-item[data-photo-type="before"] .photo-type {
    background: var(--vhicl-warning, #f59e0b);
  }
  .photo-item[data-photo-type="after"] .photo-type {
    background: var(--vhicl-success, #22c55e);
  }
  .photo-item[data-photo-type="document"] .photo-type {
    background: var(--vhicl-secondary, #64748b);
  }
</style>
      `.trim();

      return html;
    } catch (error) {
      console.error('Error generating photo gallery HTML:', error);
      return '<div class="photo-gallery">Error loading photos</div>';
    }
  }

  /**
   * Get before/after comparison HTML
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<string>}
   */
  async getBeforeAfterComparisonHTML(shopId, vehicleId) {
    try {
      const pairs = await this.getBeforeAfterPairs(shopId, vehicleId);
      
      const html = `
<div class="before-after-comparison">
  <h3>Before & After Photos</h3>
  <div class="comparison-grid">
    ${pairs.map((pair, index) => `
      <div class="comparison-item" data-pair-id="${index}">
        <div class="before-photo">
          <img src="${pair.before.url}" alt="Before: ${pair.before.description || 'Photo'}">
          <div class="label">BEFORE</div>
        </div>
        ${pair.after ? `
          <div class="after-photo">
            <img src="${pair.after.url}" alt="After: ${pair.after.description || 'Photo'}">
            <div class="label">AFTER</div>
          </div>
        ` : `
          <div class="after-photo placeholder">
            <div class="label">No after photo yet</div>
          </div>
        `}
        <div class="comparison-description">
          ${pair.before.description || `Repair #${index + 1}`}
        </div>
      </div>
    `).join('')}
  </div>
</div>

<style>
  .before-after-comparison {
    margin: 20px 0;
  }
  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    margin-top: 15px;
  }
  .comparison-item {
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }
  .before-photo, .after-photo {
    position: relative;
    height: 200px;
  }
  .before-photo img, .after-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .after-photo.placeholder {
    background-color: #f9fafb;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .label {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 5px 10px;
    border-radius: 4px;
    font-weight: bold;
    color: #ffffff;
  }
  .before-photo .label {
    background-color: var(--vhicl-warning, #f59e0b);
  }
  .after-photo .label {
    background-color: var(--vhicl-success, #22c55e);
  }
  .comparison-description {
    padding: 10px 15px;
    background-color: #f9fafb;
    text-align: center;
    font-weight: bold;
  }
</style>
      `.trim();

      return html;
    } catch (error) {
      console.error('Error generating before/after comparison:', error);
      return '<div class="before-after-comparison">Error loading comparison</div>';
    }
  }

  /**
   * Batch upload multiple photos
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @param {Array} files - Array of {fileBuffer, fileName, metadata}
   * @returns {Promise<Array>}
   */
  async batchUploadPhotos(shopId, vehicleId, files) {
    try {
      const uploadPromises = files.map(file => 
        this.uploadPhoto(shopId, vehicleId, file.fileBuffer, file.fileName, file.metadata)
      );

      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('Error batch uploading photos:', error);
      throw error;
    }
  }
}

module.exports = PhotoManagementService;