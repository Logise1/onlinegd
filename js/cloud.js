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
    increment,
    onSnapshot
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
    },

    async syncPrivateLevel(levelData, userId) {
        if (!userId) return { success: false, error: 'No user ID provided' };
        try {
            const levelRef = doc(db, "users", userId, "private_levels", levelData.id);
            await setDoc(levelRef, { ...levelData, uploadedAt: Date.now() });
            return { success: true };
        } catch (e) {
            console.error("Error syncing private level: ", e);
            return { success: false, error: e.message };
        }
    },

    async getAllPrivateLevels(userId) {
        if (!userId) return [];
        try {
            const q = collection(db, "users", userId, "private_levels");
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Error fetching private levels: ", e);
            return [];
        }
    },

    async createCollab(localLevel, targetUsername, currentUsername) {
        const q = query(collection(db, "users"), where("username", "==", targetUsername));
        const snap = await getDocs(q);
        if (snap.empty) return { success: false, error: "Target user not found" };

        const collabId = "collab_" + localLevel.id;
        const collabRef = doc(db, "collab_levels", collabId);

        const collabData = {
            ...localLevel,
            id: collabId,
            collaborators: [currentUsername, targetUsername],
            owner: currentUsername,
            lastEdited: Date.now(),
            lastEditedUser: currentUsername
        };

        try {
            await setDoc(collabRef, collabData);
            return { success: true, collabId };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    async getCollabs(username) {
        if (!username) return [];
        try {
            const q = query(collection(db, "collab_levels"), where("collaborators", "array-contains", username));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Error fetching collabs: ", e);
            return [];
        }
    },

    subscribeCollab(collabId, onUpdate) {
        const collabRef = doc(db, "collab_levels", collabId);
        return onSnapshot(collabRef, (docSnap) => {
            if (docSnap.exists()) {
                onUpdate(docSnap.data());
            }
        });
    },

    async updateCollab(collabId, objects, currentUsername) {
        const collabRef = doc(db, "collab_levels", collabId);
        try {
            await updateDoc(collabRef, {
                objects: objects,
                lastEditedUser: currentUsername,
                lastEdited: Date.now()
            });
        } catch (e) {
            console.error("Error updating collab: ", e);
        }
    }
};

export default Cloud;
