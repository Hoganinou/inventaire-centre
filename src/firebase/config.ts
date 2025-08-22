import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuration Firebase pour inventaire
const firebaseConfig = {
  apiKey: "AIzaSyBC7LlqBPbBDCiP00QcruQVIYLkHxjk8NM",
  authDomain: "inventairecaserne.firebaseapp.com",
  projectId: "inventairecaserne",
  storageBucket: "inventairecaserne.firebasestorage.app",
  messagingSenderId: "663850765407",
  appId: "1:663850765407:web:2f611f0ed8f41cf580dfea"
};

// Configuration Firebase pour MessCaserne (base de données des utilisateurs)
const messCaserneConfig = {
  apiKey: "AIzaSyAsekdHUcG0_0UO8Q662DdaXyK-cho3XtI",
  authDomain: "messcaserne.firebaseapp.com",
  projectId: "messcaserne",
  storageBucket: "messcaserne.firebasestorage.app",
  messagingSenderId: "778943794732",
  appId: "1:778943794732:web:4ac56dea31e8682d3c8b89"
};

// Initialiser Firebase pour inventaire
const app = initializeApp(firebaseConfig, 'inventaire');

// Initialiser Firebase pour MessCaserne
const messCaserneApp = initializeApp(messCaserneConfig, 'messcaserne');

// Initialiser Firestore pour inventaire
export const db = getFirestore(app);

// Initialiser Firestore pour MessCaserne (utilisateurs)
export const messCaserneDb = getFirestore(messCaserneApp);

// Initialiser Firebase Storage
export const storage = getStorage(app);

export default app;
