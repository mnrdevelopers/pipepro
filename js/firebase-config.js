// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCIt1KxIwhHFvYvbRsXP37v3Mo6r8T15ss",
  authDomain: "pipepro-1b94a.firebaseapp.com",
  projectId: "pipepro-1b94a",
  storageBucket: "pipepro-1b94a.firebasestorage.app",
  messagingSenderId: "925160729360",
  appId: "1:925160729360:web:5322efdee0c5bf4b661395",
  measurementId: "G-B3GEB284B8"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
// Auth and Firestore are optional on some pages; guard if SDK isn't loaded.
const auth = typeof firebase.auth === "function" ? firebase.auth() : null;
const db = typeof firebase.firestore === "function" ? firebase.firestore() : null;
// Remote Config is optional; avoid hard failure if its SDK isn't loaded.
let remoteConfig = null;
if (typeof firebase.remoteConfig === "function") {
  remoteConfig = firebase.remoteConfig();
  remoteConfig.settings = {
    minimumFetchIntervalMillis: 0, // Set to 0 during dev to fetch immediately
    fetchTimeoutMillis: 60000
  };
}

async function getPublicBusinessId() {
  if (remoteConfig && typeof remoteConfig.fetchAndActivate === "function") {
    try {
      await remoteConfig.fetchAndActivate();
      const rcValue = remoteConfig.getValue('public_business_id').asString();
      if (rcValue) return rcValue;
    } catch (e) {
      // Ignore and fall through to empty
    }
  }
  return '';
}

// Initialize Google Auth Provider (only if Auth SDK is available)
const googleProvider = (typeof firebase.auth === "function" && firebase.auth && firebase.auth.GoogleAuthProvider)
  ? new firebase.auth.GoogleAuthProvider()
  : null;

// Export modules
export { auth, db, googleProvider, remoteConfig, getPublicBusinessId };
