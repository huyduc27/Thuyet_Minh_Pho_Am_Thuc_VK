// Firebase Configuration for Vĩnh Khánh Food Tour CMS
const firebaseConfig = {
    apiKey: "AIzaSyCEnL_IT-9OY5mfrRV2TJgPW7ctfDffK4I",
    authDomain: "vinhkhanhfoodtour.firebaseapp.com",
    projectId: "vinhkhanhfoodtour",
    storageBucket: "vinhkhanhfoodtour.firebasestorage.app",
    messagingSenderId: "755585686441",
    appId: "1:755585686441:web:374fe76a54a572ab2902b8",
    measurementId: "G-9LGXN58NTW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
