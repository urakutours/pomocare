import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDB2kCccp3pfsWsxroRCOw8F9EAflUgrXw',
  authDomain: 'pomocare-com.firebaseapp.com',
  projectId: 'pomocare-com',
  storageBucket: 'pomocare-com.firebasestorage.app',
  messagingSenderId: '694450253244',
  appId: '1:694450253244:web:eccd6c98bbac7820b90fb9',
  measurementId: 'G-2J9Z1KFYGC',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
