import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DOC_ID = 'main';
const COLLECTION = 'finance_data';

// Namespace for cloud operations
window.CBTCloud = {
  // Download data from Cloud -> LocalStorage
  syncDown: async function() {
    try {
      console.log('☁️ Checking cloud data...');
      const docRef = doc(db, COLLECTION, DOC_ID);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        // Simple strategy: Cloud wins on startup
        // In a complex app, we'd merge. Here we overwrite local to ensure consistency across devices.
        if (cloudData.payload) {
          localStorage.setItem('CBT_FMS_V1', cloudData.payload);
          console.log('✅ Cloud data loaded to device.');
          return true; // Data found and loaded
        }
      } else {
        console.log('☁️ No cloud data found. Using local data.');
      }
    } catch (error) {
      console.error('❌ Cloud Sync Error:', error);
      // Fallback: Use local data if offline or error
    }
    return false;
  },

  // Upload LocalStorage -> Cloud
  syncUp: async function() {
    try {
      const raw = localStorage.getItem('CBT_FMS_V1');
      if (!raw) return;

      const docRef = doc(db, COLLECTION, DOC_ID);
      await setDoc(docRef, {
        payload: raw,
        updatedAt: new Date().toISOString(),
        updatedBy: 'user' // Could use auth username if available
      });
      console.log('☁️ Data saved to cloud.');
    } catch (error) {
      console.error('❌ Cloud Save Error:', error);
    }
  }
};

// Dispatch event when ready
window.dispatchEvent(new Event('cbt-cloud-ready'));
