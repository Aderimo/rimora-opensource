import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    updateDoc,
    addDoc,
    onSnapshot,
    limit
} from 'firebase/firestore'
import { db } from './firebase'

export interface ModRoomMessage {
    id: string
    roomId: string
    senderId: string
    senderName: string
    senderPhoto?: string
    message: string
    createdAt: Date
}

export interface ModRoom {
    id: string
    name: string
    description?: string
    createdAt: Date
    updatedAt?: Date
}

// Get or create default room
export async function getDefaultRoom(): Promise<ModRoom> {
    const defaultRoomId = 'general'
    const q = query(collection(db, 'mod_rooms'), where('id', '==', defaultRoomId))
    const snapshot = await getDocs(q)
    
    if (snapshot.size > 0) {
        const data = snapshot.docs[0].data()
        return {
            id: data.id,
            name: data.name,
            description: data.description,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate()
        }
    }

    // Create default room if it doesn't exist
    const docRef = doc(db, 'mod_rooms', defaultRoomId)
    await setDoc(docRef, {
        id: defaultRoomId,
        name: 'Genel Oda',
        description: 'Moderatörler arasında genel tartışmalar',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    })

    return {
        id: defaultRoomId,
        name: 'Genel Oda',
        description: 'Moderatörler arasında genel tartışmalar',
        createdAt: new Date(),
        updatedAt: new Date()
    }
}

// Send message to mod room
export async function sendRoomMessage(
    roomId: string,
    senderId: string,
    senderName: string,
    message: string,
    senderPhoto?: string
): Promise<void> {
    const roomRef = doc(db, 'mod_rooms', roomId)
    
    const messageData: any = {
        roomId,
        senderId,
        senderName,
        message,
        createdAt: serverTimestamp()
    }
    
    if (senderPhoto) {
        messageData.senderPhoto = senderPhoto
    }
    
    await addDoc(collection(roomRef, 'messages'), messageData)

    // Update room's last message time
    await updateDoc(roomRef, {
        updatedAt: serverTimestamp()
    })
}

// Subscribe to room messages (real-time)
export function subscribeToRoomMessages(
    roomId: string,
    onUpdate: (messages: ModRoomMessage[]) => void
) {
    const q = query(
        collection(db, 'mod_rooms', roomId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(100)
    )

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as ModRoomMessage[]
        onUpdate(messages)
    })
}

// Get room messages (one-time fetch)
export async function getRoomMessages(roomId: string): Promise<ModRoomMessage[]> {
    const q = query(
        collection(db, 'mod_rooms', roomId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(100)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as ModRoomMessage[]
}
