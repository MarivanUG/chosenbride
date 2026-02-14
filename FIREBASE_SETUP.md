# Church Finance System - Setup Guide

## 📱 Mobile & Desktop Sync (Important)

**Current Status:**  
This application currently runs **locally in your browser**. 
- Data entered on your **Desktop** stays on your Desktop.
- Data entered on your **Mobile** stays on your Mobile.
- They do **not** sync automatically.

### How to move data between devices:
1.  **On Desktop:** Go to **Settings > Data Backup** and click **"Export All Data (JSON)"**.
2.  Send the downloaded file to your phone (via WhatsApp, Email, or Cable).
3.  **On Mobile:** Open the app, go to **Settings > Data Backup**, click **"Import JSON Backup"**, and select the file.
4.  Your mobile now has all the data and passwords from the desktop.

---

## ☁️ Upgrade to Real-Time Cloud Sync (Optional)

To enable real-time synchronization where data appears instantly on all devices, you must connect this application to a centralized database (**Google Firebase**).

**Note:** This requires technical setup.

### Prerequisites
1.  A free Google Account.
2.  A Google Firebase project.

### Setup Instructions
1.  Go to [console.firebase.google.com](https://console.firebase.google.com/).
2.  Click **"Add project"** and name it `chosen-bride-finance`.
3.  Disable Google Analytics (not needed).
4.  Once created, go to **Build > Firestore Database**.
    *   Click **"Create Database"**.
    *   Start in **Test Mode** (for now).
    *   Select a location (e.g., `nam5` or `eur3`).
5.  Go to **Build > Authentication**.
    *   Click **"Get Started"**.
    *   Enable **"Email/Password"**.
6.  Click the **Gear Icon (Project Settings)** > **General**.
7.  Scroll down to **"Your apps"** and click the **Web (</>)** icon.
8.  Register the app (name it "Finance App").
9.  You will see a code block with `const firebaseConfig = { ... }`.
10. Copy that configuration.

### Applying the Config
1.  **Done:** The file `js/firebase-config.js` has been created with your configuration.
2.  **Next Steps:**
    *   This file uses ES Modules. To use it, you must switch your application to support modules or use a bundler.
    *   Alternatively, for a quick start, reference the CDN scripts in your HTML.
    *   **Code Update Required:** The file `js/storage.js` currently uses `localStorage`. It must be rewritten to read/write from `window.firebaseCtx.db` (Firestore) instead.

3.  The system is designed to detect this config... (Future Implementation)

---

## ⚠️ Important: "Test Mode" Expiration

If you selected **Test Mode** when creating your database, it will **stop working after 30 days**.

### How to fix it (Make it permanent):
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Open your project > **Firestore Database**.
3.  Click the **Rules** tab.
4.  Delete the existing code and paste this instead:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /finance_data/{document=**} {
      allow read, write: if true;
    }
  }
}
```
5. Click **Publish**.

**Note:** This makes your database publicly accessible to anyone with your config. Since your app handles encryption/passwords internally, this is a basic "Open" setup. For higher security, we would need to implement Firebase Authentication login in the code.