// Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyCEqVWEbGlcqPA80pkzhwnGcnIre6bIw18",
    authDomain: "edusolve-5ca48.firebaseapp.com",
    projectId: "edusolve-5ca48",
    storageBucket: "edusolve-5ca48.firebasestorage.app",
    messagingSenderId: "700539683935",
    appId: "1:700539683935:web:b7399ad51adf4a5bb187ea",
    measurementId: "G-K4E6CJ9SK1"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);