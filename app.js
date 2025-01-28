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
mongoose.connect('mongodb+srv://Dev-Angel:lucme123@clusterluvmee.fw2f7.mongodb.net/Api-Awi4_0-230592?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.log('Error al conectar a MongoDB:', err));

// Almacenar sesiones activas en memoria (solo para ejemplos o si no usas base de datos)
const activeSessions = [];

app.use(
    session({
        secret: 'P4-ADJBT#SpeakNow-Variables-de-SessionesHTTP',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 5 * 60 * 1000 },
        secure: false, // evitar problemas con la cookie en un entorno local
    })
);

// Función de utilidad para obtener la IP local.
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

app.post('/login', async (req, res) => {
    const { email, nickname } = req.body;

    if (!email || !nickname) {
        return res.status(400).json({ message: 'Falta algún campo.' });
    }

    const sessionId = uuidv4();
    const now = new Date();

    // Obtener la IP local automáticamente
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const clientMac = req.headers['x-client-mac'] || 'default-mac-address';  // Valor por defecto

    // Obtener la IP local del servidor
    const serverIp = getLocalIp();

    try {
        // Verificar si la sesión ya existe
        let session = await Session.findOne({ email, status: 'activa' });

        if (session) {
            return res.status(400).json({ message: 'Ya hay una sesión activa para este usuario.' });
        }

        // Crear una nueva sesión
        const newSession = new Session({
            sessionId,
            email,
            nickname,
            lastAccessedAt: now,
            clientIp,
            clientMac,  // Aunque no es requerido, se incluye por compatibilidad
            serverIp,   // Aquí se obtiene la IP local del servidor
            serverMac: '', // Aquí puedes agregar la MAC del servidor si es necesario
            status: 'activa', // Establecer estado como 'activa'
        });

        await newSession.save();

        req.session.sessionId = sessionId;
        req.session.email = email;
        req.session.nickname = nickname;
        req.session.createdAt = now;
        req.session.lastAccessedAt = now;
        req.session.clientIp = clientIp;  // Agregar IP del cliente
        req.session.clientMac = clientMac; // Agregar MAC del cliente
        req.session.serverIp = serverIp;  // Agregar IP del servidor
        req.session.serverMac = ''; // Agregar MAC del servidor

        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            sessionId,
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al guardar la sesión en la base de datos.', error: err });
    }
});

// Endpoint para hacer logout
app.post('/logout', (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId || req.session.sessionId !== sessionId) {
        return res.status(400).json({ message: 'Sesión no válida.' });
    }

    // Cambiar el estado de la sesión a "inactiva" en la base de datos
    Session.findOneAndUpdate(
        { sessionId }, 
        { status: 'inactiva' },  // Actualizamos el estado de la sesión a 'inactiva'
        { new: true },
        (err, updatedSession) => {
            if (err) {
                return res.status(500).json({ message: 'Error al actualizar el estado de la sesión en la base de datos.', error: err });
            }

            // Eliminar la sesión activa en el servidor
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).json({ message: 'Error al cerrar la sesión.', error: err });
                }
                res.status(200).json({ message: 'Sesión cerrada con éxito.', updatedSession });
            });
        }
    );
});


// Endpoint para actualizar la sesión
app.put('/update', async (req, res) => {
    const { sessionId, email, nickname } = req.body;

    if (!sessionId || req.session.sessionId !== sessionId) {
        return res.status(400).json({ message: 'Sesión no válida.' });
    }

    if (!email || !nickname) {
        return res.status(400).json({ message: 'Faltan campos.' });
    }

    try {
        // Actualizar la sesión en la base de datos
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
        return res.status(500).json({ message: 'Error al actualizar la sesión en la base de datos.', error: err });
    }
});

// Endpoint para listar las sesiones activas
app.get('/active-sessions', async (req, res) => {
    try {
        // Usamos async/await para obtener las sesiones activas
        const activeSessions = await Session.find({ status: 'activa' });

        // Devolvemos las sesiones activas
        res.status(200).json({ activeSessions });
    } catch (err) {
        // En caso de error, se captura y se devuelve un mensaje de error
        res.status(500).json({ message: 'Error al obtener las sesiones activas.', error: err });
    }
});


// Estado de la sesión
app.get('/status', (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId || req.session.sessionId !== sessionId) {
        return res.status(404).json({ message: 'No hay sesión activa.' });
    }

    const { sessionId: currentSessionId, email, nickname, clientMac, clientIp, createdAt, lastAccessedAt, serverIp, serverMac, status } = req.session;

    // Hora en formato de Ciudad de México (MX)
    const mexicoTime = moment.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');

    // Calcular el tiempo transcurrido desde que la sesión fue creada
    const timeElapsedInSeconds = moment().diff(moment(createdAt), 'seconds');
    const minutes = Math.floor(timeElapsedInSeconds / 60);
    const seconds = timeElapsedInSeconds % 60;

    // Calcular el tiempo de inactividad
    const inactivityTimeInSeconds = moment().diff(moment(lastAccessedAt), 'seconds');
    const inactivityMinutes = Math.floor(inactivityTimeInSeconds / 60);
    const inactivitySeconds = inactivityTimeInSeconds % 60;

    res.status(200).json({
        message: 'Sesión activa.',
        session: {
            sessionId: currentSessionId,
            email,
            nickname,
            clientMac,
            clientIp,
            serverIp,
            serverMac,
            status,
            createdAt: mexicoTime,
            lastAccessedAt: mexicoTime,
            timeElapsed: `${minutes} minutos y ${seconds} segundos`, // Tiempo de sesión en minutos y segundos
            inactivityTime: `${inactivityMinutes} minutos y ${inactivitySeconds} segundos`, // Tiempo de inactividad
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

// Welcome route
app.get('/', (req, res) => {
    return res.status(200).json({
        message: 'Bienvenid@ al API de control de sesiones de Angel de Jesus',
        
    });
});

app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});
