import { auth, db } from './firebase.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const Auth = {
    user: null,
    userData: null,

    init(onUserChange) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.user = user;
                // Fetch extra data
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    this.userData = docSnap.data();
                }
            } else {
                this.user = null;
                this.userData = null;
            }
            if (onUserChange) onUserChange(this.user, this.userData);
        });
    },

    async register(username, password) {
        const email = `${username.toLowerCase()}@gdclone.com`;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Create user profile in Firestore
            const initialData = {
                username: username,
                stars: 0,
                levels: [],
                iconSettings: JSON.parse(localStorage.getItem('gd_icon_settings') || '{}'),
                createdAt: Date.now()
            };

            await setDoc(doc(db, "users", user.uid), initialData);
            this.userData = initialData;
            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    },

    async login(username, password) {
        const email = `${username.toLowerCase()}@gdclone.com`;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async logout() {
        await signOut(auth);
    },

    async syncIconSettings() {
        if (!this.user) return;
        const settings = JSON.parse(localStorage.getItem('gd_icon_settings') || '{}');
        await setDoc(doc(db, "users", this.user.uid), { iconSettings: settings }, { merge: true });
    }
};

export default Auth;
