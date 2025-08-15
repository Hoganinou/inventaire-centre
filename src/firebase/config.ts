import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBC7LlqBPbBDCiP00QcruQVIYLkHxjk8NM",
  authDomain: "inventairecaserne.firebaseapp.com",
  projectId: "inventairecaserne",
  storageBucket: "inventairecaserne.firebasestorage.app",
  messagingSenderId: "663850765407",
  appId: "1:663850765407:web:2f611f0ed8f41cf580dfea"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser Firestore
export const db = getFirestore(app);

export default app;
