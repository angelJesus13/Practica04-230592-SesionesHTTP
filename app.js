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
  .catch(err => {
      console.log('Error al conectar a MongoDB:', err);
      process.exit(1); // Salir si la conexión falla
  });

app.use(
    session({
        secret: 'P4-ADJBT#SpeakNow-Variables-de-SessionesHTTP',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 10 * 60 * 1000 }, // 5 minutos
    })
);

// Funciones para obtener IP y MAC
const getLocalIp = () => '172.16.2.14';
const getLocalMac = () => '60:3e:5f:2f:7d:8f';

const getClientIp = (req) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp && clientIp.startsWith('::ffff:')) {
        return clientIp.substring(7);
    }
    if (clientIp === '::1' || clientIp === '127.0.0.1') {
        return '172.16.2.14';
    }
    return clientIp;
};

const getClientMac = (req) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('192.168.') || clientIp.startsWith('10.') || clientIp.startsWith('172.16.')) {
        return '60:3e:5f:2f:7d:8f'; // MAC conocida para conexiones locales
    }
    return 'No se puede obtener por seguridad'; // MAC no disponible por razones de seguridad
};

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Bienvenido a la API de sesiones', author: 'Angel de Jesus Baños' });
});

app.post('/login', async (req, res) => {
    const { email, nickname } = req.body;
    if (!email || !nickname) {
        return res.status(400).json({ message: 'Falta algún campo.' });
    }

    const sessionId = uuidv4();
    const now = new Date();
    const clientIp = getClientIp(req);  // Se obtiene la IP del cliente
    const clientMac = getClientMac(req);  // Se obtiene la MAC del cliente
    const serverIp = getLocalIp();  // IP del servidor
    const serverMac = getLocalMac();  // MAC del servidor

    try {
        // Comprobar si ya existe una sesión activa para el email proporcionado
        let session = await Session.findOne({ 'DatosCliente.email': email, status: 'activa' });
        if (session) {
            session.lastAccessedAt = now;
            await session.save();
            return res.status(200).json({ message: 'Sesión actualizada.', session });
        } else {
            // Crear una nueva sesión
            const newSession = new Session({
                sessionId, 
                DatosCliente: { email, nickname }, 
                lastAccessedAt: now, 
                clienteIP: clientIp, 
                clienteMac: clientMac,  // MAC del cliente
                DatosServidor: { serverIP: serverIp, serverMac },  // MAC del servidor
                status: 'activa'
            });
            await newSession.save();
            req.session.sessionId = sessionId;
            return res.status(200).json({ message: 'Sesión iniciada exitosamente.', sessionId });
        }
    } catch (err) {
        console.error('Error al crear o actualizar la sesión:', err);
        res.status(500).json({ message: 'Error en la sesión.', error: err.message });
    }
});


// Ruta para obtener el estado de la sesión
app.get('/status', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ message: 'Se requiere sessionId.' });
    
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ message: 'Sesión no encontrada.' });
        
        const now = moment();
        const lastAccessedAt = moment(session.lastAccessedAt);
        const sessionDuration = moment.duration(now.diff(lastAccessedAt));
        const inactivityDuration = session.status === 'activa' ? moment.duration(now.diff(lastAccessedAt)) : moment.duration(0);
        
        const formattedSessionDuration = `${sessionDuration.minutes()} min ${sessionDuration.seconds()} seg`;
        const formattedInactivityDuration = `${inactivityDuration.minutes()} min ${inactivityDuration.seconds()} seg`;
        
        res.status(200).json({
            message: 'Estado de la sesión.',
            session,
            sessionDuration: formattedSessionDuration,
            inactivityDuration: formattedInactivityDuration,
            createdAt: session.lastAccessedAt.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener estado.', error: err.message });
    }
});

// Ruta para actualizar el estado de la sesión
app.put('/update', async (req, res) => {
    const { sessionId, status } = req.body;
    if (!sessionId || !status) return res.status(400).json({ message: 'Datos insuficientes.' });

    try {
        const normalizedStatus = status.toLowerCase();
        const updatedSession = await Session.updateOne(
            { sessionId },
            { status: normalizedStatus, lastAccessedAt: new Date() }
        );
        res.status(200).json({ message: 'Sesión actualizada.', updatedSession });
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar.', error: err.message });
    }
});

// Ruta para cerrar sesión
app.post('/logout', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'Se requiere sessionId.' });

    try {
        const updatedSession = await Session.updateOne(
            { sessionId },
            { status: 'finalizada por el usuario', lastAccessedAt: new Date() }
        );
        res.status(200).json({ message: 'Sesión cerrada.', updatedSession });
    } catch (err) {
        res.status(500).json({ message: 'Error en logout.', error: err.message });
    }
});

// Ruta para obtener todas las sesiones
app.get('/allSessions', async (req, res) => {
    try {
        const sessions = await Session.find();
        res.status(200).json({ message: 'Todas las sesiones.', sessions });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener sesiones.', error: err.message });
    }
});

// Ruta para obtener solo sesiones activas
app.get('/allCurrentSessions', async (req, res) => {
    try {
        const sessions = await Session.find({ status: 'activa' });
        res.status(200).json({ message: 'Sesiones activas.', sessions });
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener sesiones activas.', error: err.message });
    }
});

// Ruta para eliminar todas las sesiones
app.delete('/deleteAllSessions', async (req, res) => {
    try {
        await Session.deleteMany();
        res.status(200).json({ message: 'Todas las sesiones han sido eliminadas.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar sesiones.', error: err.message });
    }
});

// Función para destruir sesiones inactivas
const destroyInactiveSessions = async () => {
    const now = new Date();
    const inactiveSessions = await Session.find({ status: 'activa' });
    inactiveSessions.forEach(async (session) => {
        const lastAccessedAt = new Date(session.lastAccessedAt);
        const timeDiff = (now - lastAccessedAt) / 1000; // tiempo en segundos
        if (timeDiff >= 120) { // 2 minutos
            await Session.updateOne(
                { sessionId: session.sessionId },
                { status: 'destrucción por inactividad', lastAccessedAt: now }
            );
        }
    });
};

// Llama a esta función cada 1 minuto para verificar inactividad
setInterval(destroyInactiveSessions, 60 * 1000);

// Iniciar el servidor
app.listen(3000, () => console.log('Servidor corriendo en puerto 3000.'));
