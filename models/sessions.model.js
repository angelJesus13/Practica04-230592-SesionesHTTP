import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true },
    email: { type: String, required: true },
    nickname: { type: String, required: true },
    lastAccessedAt: { type: Date, required: true },
    clientIp: { type: String, required: true },
    clientMac: { type: String, required: true },
    serverIp: { type: String, required: true },
    serverMac: { type: String, required: false },
    status: { 
        type: String, 
        enum: ['activa', 'inactiva'], 
        default: 'activa', 
        required: true 
    }
});

const Session = mongoose.model('Session', sessionSchema);

export default Session;
