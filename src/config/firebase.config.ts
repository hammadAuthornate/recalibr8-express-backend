import admin from "firebase-admin";
import { credential } from "firebase-admin";

admin.initializeApp({
  credential: credential.cert({
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    projectId: process.env.FIREBASE_PROJECT_ID,
  }),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

export const db = admin.firestore();
