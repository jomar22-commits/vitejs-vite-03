import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCedOqydfLQNrRrlmtL1-j19DuddoM86Qw",
  authDomain: "project-dynamic-46eb3.firebaseapp.com",
  projectId: "project-dynamic-46eb3",
  storageBucket: "project-dynamic-46eb3.firebasestorage.app",
  messagingSenderId: "709962779443",
  appId: "1:709962779443:web:7d12345de14552ea298c46",
  measurementId: "G-XDQBS2QDG"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);