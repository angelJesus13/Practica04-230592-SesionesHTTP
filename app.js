import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import os from 'os';
import mongoose from 'mongoose';
import moment from 'moment-timezone';
import Session from './models/sessions.model.js';

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// Conectar a MongoDB
mongoose.connect('mongodb+srv://Dev-Angel:lucme123@clusterluvmee.fw2f7.mongodb.net/Api-Awi4_0-230592?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.log('Error al conectar a MongoDB:', err));

// Configuración de sesiones
app.use(session({
    secret: 'P4-ADJBT#SpeakNow-Variables-de-SessionesHTTP',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 5 * 60 * 1000 },
}));

// Obtener la IP local
const getLocalIp = () => {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
};

// Iniciar sesión
app.post('/login', async (req, res) => {
    const { email, nickname } = req.body;
    if (!email || !nickname) return res.status(400).json({ message: 'Falta algún campo.' });

    try {
        const existingSession = await Session.findOne({ email, status: 'activa' });
        if (existingSession) return res.status(400).json({ message: 'Sesión activa encontrada.' });

        const newSession = new Session({
            sessionId: uuidv4(),
            email,
            nickname,
            lastAccessedAt: new Date(),
            clientIp: req.ip,
            clientMac: '00:00:00:00:00:00',
            serverIp: getLocalIp(),
            status: 'activa',
        });
        await newSession.save();
        req.session.sessionId = newSession.sessionId;
        res.status(200).json({ message: 'Inicio de sesión exitoso.', sessionId: newSession.sessionId });
    } catch (err) {
        res.status(500).json({ message: 'Error al iniciar sesión.', error: err });
    }
});

// Cerrar sesión
app.post('/logout', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || req.session.sessionId !== sessionId) return res.status(400).json({ message: 'Sesión no válida.' });
    try {
        await Session.findOneAndUpdate({ sessionId }, { status: 'inactiva' });
        req.session.destroy(() => res.status(200).json({ message: 'Sesión cerrada con éxito.' }));
    } catch (err) {
        res.status(500).json({ message: 'Error al cerrar la sesión.', error: err });
    }
});

// Estado de la sesión
app.get('/status', (req, res) => {
    if (!req.session.sessionId) return res.status(404).json({ message: 'No hay sesión activa.' });
    res.status(200).json({
        message: 'Sesión activa.',
        session: req.session
    });
});

// Obtener la IP local
app.get('/ip', (req, res) => {
    res.status(200).json({ localIp: getLocalIp() });
});

// Ruta de bienvenida
app.get('/', (req, res) => res.status(200).json({ message: 'Bienvenid@ al API de control de sesiones de Ángel de Jesús' }));

// Iniciar servidor
app.listen(3000, () => console.log('Servidor escuchando en el puerto 3000'));
