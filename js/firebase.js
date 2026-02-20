// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDh4pxMFbAN7w5ehnHnHM4Tk04rJMTcLkk",
    authDomain: "pandadrive-af6b6.firebaseapp.com",
    databaseURL: "https://pandadrive-af6b6-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "pandadrive-af6b6",
    storageBucket: "pandadrive-af6b6.firebasestorage.app",
    messagingSenderId: "682265494431",
    appId: "1:682265494431:web:c9e3276f3774b3501633aa",
    measurementId: "G-V1DG96TNWJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
