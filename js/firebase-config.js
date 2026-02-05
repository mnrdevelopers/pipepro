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
const auth = firebase.auth();
const db = firebase.firestore();
const remoteConfig = firebase.remoteConfig();

remoteConfig.settings = {
  minimumFetchIntervalMillis: 0, // Set to 0 during dev to fetch immediately
  fetchTimeoutMillis: 60000
};

// Initialize Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Export modules
export { auth, db, googleProvider, remoteConfig };