import { db } from './firebase.js';
import {
    collection,
    addDoc,
    setDoc,
    doc,
    query,
    getDocs,
    orderBy,
    where,
    getDoc,
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const Cloud = {
    async uploadLevel(levelData, userId, username) {
        try {
            const levelRef = doc(db, "levels", levelData.id);
            const simplifiedLevel = {
                ...levelData,
                creatorId: userId,
                creatorName: username,
                uploadedAt: Date.now(),
                featured: false,
                starsReward: 0,
                downloads: 0
            };
            await setDoc(levelRef, simplifiedLevel);

            // Link to user profile
            const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                levels: arrayUnion(levelData.id)
            });

            return { success: true };
        } catch (e) {
            console.error("Error adding document: ", e);
            return { success: false, error: e.message };
        }
    },

    async getAllLevels() {
        const q = query(collection(db, "levels"), orderBy("uploadedAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getUserLevels(userId) {
        const q = query(collection(db, "levels"), where("creatorId", "==", userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getFeaturedLevels() {
        const q = query(collection(db, "levels"), where("featured", "==", true));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async getLeaderboard() {
        const q = query(collection(db, "users"), orderBy("stars", "desc"), orderBy("username", "asc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async awardStars(userId, amount) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            stars: increment(amount || 0)
        });
    },

    async setFeatured(levelId, featured, stars) {
        const ref = doc(db, "levels", levelId);
        await updateDoc(ref, { featured, starsReward: stars || 0 });
    }
};

export default Cloud;
