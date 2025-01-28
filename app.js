import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import os from 'os';
import mongoose from 'mongoose';
import moment from 'moment-timezone';
import Session from './models/sessions.model.js'; // Asegúrate de tener el modelo de la sesión

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// Conectar a MongoDB con la base de datos 'Api-Awi4_0-230592'
mongoose.connect('mongodb+srv://Dev-Angel:lucme123@clusterluvmee.fw2f7.mongodb.net/Api-Awi4_0-230592?retryWrites=true&w=majority', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.log('Error al conectar a MongoDB:', err));

// Configuración de sesiones
app.use(
    session({
        secret: 'P4-ADJBT#SpeakNow-Variables-de-SessionesHTTP',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 5 * 60 * 1000 },
    })
);

// Función para obtener la IP local
const getLocalIp = () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
};

// Endpoint para iniciar sesión
app.post('/login', async (req, res) => {
    const { email, nickname } = req.body;

    if (!email || !nickname) {
        return res.status(400).json({ message: 'Falta algún campo.' });
    }

    const sessionId = uuidv4();
    const now = new Date();

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const clientMac = 'default-mac-address'; // MAC predeterminada, solo por compatibilidad
    const serverIp = getLocalIp();

    try {
        let session = await Session.findOne({ email, status: 'activa' });

        if (session) {
            return res.status(400).json({ message: 'Ya hay una sesión activa para este usuario.' });
        }

        const newSession = new Session({
            sessionId,
            email,
            nickname,
            lastAccessedAt: now,
            clientIp,
            clientMac,
            serverIp,
            status: 'activa',
        });

        await newSession.save();

        req.session.sessionId = sessionId;
        req.session.email = email;
        req.session.nickname = nickname;
        req.session.createdAt = now;
        req.session.lastAccessedAt = now;

        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            sessionId,
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al guardar la sesión en la base de datos.', error: err });
    }
});

// Endpoint para cerrar sesión
app.post('/logout', async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId || req.session.sessionId !== sessionId) {
        return res.status(400).json({ message: 'Sesión no válida.' });
    }

    try {
        const updatedSession = await Session.findOneAndUpdate(
            { sessionId },
            { status: 'inactiva' },
            { new: true }
        );

        if (!updatedSession) {
            return res.status(404).json({ message: 'Sesión no encontrada.' });
        }

        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Error al cerrar la sesión.', error: err });
            }
            res.status(200).json({ message: 'Sesión cerrada con éxito.', updatedSession });
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el estado de la sesión.', error: err });
    }
});

// Endpoint para actualizar sesión
app.put('/update', async (req, res) => {
    const { sessionId, email, nickname } = req.body;

    if (!sessionId || req.session.sessionId !== sessionId) {
        return res.status(400).json({ message: 'Sesión no válida.' });
    }

    if (!email || !nickname) {
        return res.status(400).json({ message: 'Faltan campos.' });
    }

    try {
        const updatedSession = await Session.findOneAndUpdate(
            { sessionId },
            { email, nickname, lastAccessedAt: new Date() },
            { new: true }
        );

        if (!updatedSession) {
            return res.status(404).json({ message: 'Sesión no encontrada.' });
        }

        res.status(200).json({
            message: 'Sesión actualizada.',
            session: updatedSession,
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar la sesión.', error: err });
    }
});

// Endpoint para listar sesiones activas
app.get('/active-sessions', async (req, res) => {
    try {
        const activeSessions = await Session.find({ status: 'activa' });
        res.status(200).json({ activeSessions });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener las sesiones activas.', error: err });
    }
});

// Endpoint para el estado de la sesión
app.get('/status', (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId || req.session.sessionId !== sessionId) {
        return res.status(404).json({ message: 'No hay sesión activa.' });
    }

    const { sessionId: currentSessionId, email, nickname, clientIp, createdAt, lastAccessedAt } = req.session;
    const mexicoTime = moment.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');

    const timeElapsedInSeconds = moment().diff(moment(createdAt), 'seconds');
    const minutes = Math.floor(timeElapsedInSeconds / 60);
    const seconds = timeElapsedInSeconds % 60;

    res.status(200).json({
        message: 'Sesión activa.',
        session: {
            sessionId: currentSessionId,
            email,
            nickname,
            clientIp,
            createdAt: mexicoTime,
            lastAccessedAt: mexicoTime,
            timeElapsed: `${minutes} minutos y ${seconds} segundos`,
        },
    });
});

// Endpoint para obtener la IP local
app.get('/ip', (req, res) => {
    const localIp = getLocalIp();
    if (localIp) {
        res.status(200).json({ localIp });
    } else {
        res.status(500).json({ message: 'No se pudo obtener la IP local.' });
    }
});

// Ruta de bienvenida
app.get('/', (req, res) => {
    return res.status(200).json({
        message: 'Bienvenid@ al API de control de sesiones de Angel de Jesus',
    });
});

// Iniciar el servidor
app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});