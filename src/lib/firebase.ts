import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDB2kCccp3pfsWsxroRCOw8F9EAflUgrXw',
  authDomain: 'pomocare-com.firebaseapp.com',
  projectId: 'pomocare-com',
  appId: '1:694450253244:web:eccd6c98bbac7820b90fb9',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({}),
});
export const googleProvider = new GoogleAuthProvider();
