import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1mnXL-vofyL10NPsWH86EAUs-B6APVek",
  authDomain: "vending-b7172.firebaseapp.com",
  projectId: "vending-b7172",
  storageBucket: "vending-b7172.firebasestorage.app",
  messagingSenderId: "207956683496",
  appId: "1:207956683496:web:93dff9d97b4da303fa375d",
  measurementId: "G-EVXS44NVHC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };