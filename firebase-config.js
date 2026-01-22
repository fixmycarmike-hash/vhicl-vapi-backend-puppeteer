/**
 * Firebase Configuration for VHICL Pro Multi-Shop System
 * Handles Firebase initialization and provides configuration
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// Firebase Admin SDK configuration
const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://vhicl-pro-default.firebaseio.com',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'vhicl-pro.appspot.com'
};

// Initialize Firebase Admin
const firebaseApp = admin.initializeApp(firebaseConfig, 'vhicl-pro-backend');

// Firebase services
const db = firebaseApp.firestore();
const auth = firebaseApp.auth();
const storage = firebaseApp.storage();

/**
 * Shop-specific data routing
 * Ensures data isolation between shops
 */
class ShopRouter {
  /**
   * Get shop-specific collection reference
   * @param {string} shopId - Shop ID
   * @param {string} collectionName - Collection name
   * @returns {CollectionReference}
   */
  static getShopCollection(shopId, collectionName) {
    return db.collection('shops').doc(shopId).collection(collectionName);
  }

  /**
   * Get shop-specific document reference
   * @param {string} shopId - Shop ID
   * @param {string} collectionName - Collection name
   * @param {string} documentId - Document ID
   * @returns {DocumentReference}
   */
  static getShopDocument(shopId, collectionName, documentId) {
    return db.collection('shops').doc(shopId).collection(collectionName).doc(documentId);
  }

  /**
   * Get shop storage bucket reference
   * @param {string} shopId - Shop ID
   * @returns {StorageReference}
   */
  static getShopStorage(shopId) {
    const bucket = storage.bucket();
    return bucket;
  }

  /**
   * Verify shop exists and is active
   * @param {string} shopId - Shop ID
   * @returns {Promise<boolean>}
   */
  static async verifyShop(shopId) {
    try {
      const shopDoc = await db.collection('shops').doc(shopId).get();
      if (!shopDoc.exists) {
        return false;
      }
      
      const shopData = shopDoc.data();
      return shopData.active !== false;
    } catch (error) {
      console.error('Error verifying shop:', error);
      return false;
    }
  }
}

/**
 * Shop Authentication
 * Handles shop staff authentication with role-based access
 */
class ShopAuth {
  /**
   * Create shop staff account
   * @param {string} email - Staff email
   * @param {string} password - Staff password
   * @param {string} shopId - Shop ID
   * @param {string} role - Staff role (admin, technician, service_advisor, parts_manager)
   * @param {object} metadata - Additional metadata
   * @returns {Promise<UserRecord>}
   */
  static async createStaffAccount(email, password, shopId, role, metadata = {}) {
    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: metadata.name || email.split('@')[0],
        disabled: false
      });

      // Set custom claims for role and shop
      await auth.setCustomUserClaims(userRecord.uid, {
        role,
        shopId,
        shopActive: true
      });

      // Store additional staff info in Firestore
      await db.collection('shops').doc(shopId).collection('staff').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        name: metadata.name || email.split('@')[0],
        role,
        phone: metadata.phone || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        active: true
      });

      return userRecord;
    } catch (error) {
      console.error('Error creating staff account:', error);
      throw error;
    }
  }

  /**
   * Verify user token and get shop info
   * @param {string} idToken - Firebase ID token
   * @returns {Promise<object>}
   */
  static async verifyToken(idToken) {
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      
      if (!decodedToken.shopId || !decodedToken.role) {
        throw new Error('User does not have valid shop claims');
      }

      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        shopId: decodedToken.shopId,
        role: decodedToken.role,
        shopActive: decodedToken.shopActive
      };
    } catch (error) {
      console.error('Error verifying token:', error);
      throw error;
    }
  }

  /**
   * Get all staff for a shop
   * @param {string} shopId - Shop ID
   * @returns {Promise<Array>}
   */
  static async getShopStaff(shopId) {
    try {
      const staffSnapshot = await db.collection('shops').doc(shopId).collection('staff').get();
      
      return staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting shop staff:', error);
      throw error;
    }
  }
}

/**
 * Cloud Storage Manager
 * Handles file uploads and management for photos
 */
class CloudStorageManager {
  /**
   * Upload photo
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - File name
   * @param {object} metadata - File metadata
   * @returns {Promise<string>} - Public URL
   */
  static async uploadPhoto(shopId, vehicleId, fileBuffer, fileName, metadata = {}) {
    try {
      const bucket = storage.bucket();
      const filePath = `shops/${shopId}/vehicles/${vehicleId}/photos/${Date.now()}_${fileName}`;
      const file = bucket.file(filePath);

      await file.save(fileBuffer, {
        metadata: {
          contentType: metadata.contentType || 'image/jpeg',
          metadata: {
            shopId,
            vehicleId,
            photoType: metadata.photoType || 'general', // 'before', 'after', 'progress', 'document'
            technicianId: metadata.technicianId || '',
            description: metadata.description || '',
            uploadedBy: metadata.uploadedBy || '',
            uploadedAt: new Date().toISOString()
          }
        }
      });

      // Make file publicly accessible
      await file.makePublic();

      return file.publicUrl();
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  }

  /**
   * Delete photo
   * @param {string} fileUrl - Public URL of file
   * @returns {Promise<void>}
   */
  static async deletePhoto(fileUrl) {
    try {
      const bucket = storage.bucket();
      const file = bucket.file(fileUrl.split(`/${storage.bucket().name}/`)[1]);
      
      await file.delete();
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }

  /**
   * Get all photos for a vehicle
   * @param {string} shopId - Shop ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Array>}
   */
  static async getVehiclePhotos(shopId, vehicleId) {
    try {
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({
        prefix: `shops/${shopId}/vehicles/${vehicleId}/photos/`
      });

      return files.map(file => ({
        url: file.publicUrl(),
        name: file.name,
        size: file.metadata.size,
        contentType: file.metadata.contentType,
        metadata: file.metadata.metadata
      }));
    } catch (error) {
      console.error('Error getting vehicle photos:', error);
      throw error;
    }
  }
}

module.exports = {
  firebaseApp,
  db,
  auth,
  storage,
  ShopRouter,
  ShopAuth,
  CloudStorageManager
};