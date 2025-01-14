const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

// Debug mesajları
const debug = (...args) => {
    console.log(new Date().toISOString(), ...args);
};

debug('Server starting...');

// CORS ayarları
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
}));

// Socket.IO kurulumu
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Basit endpoint'ler
app.get('/', (req, res) => {
    debug('Root endpoint called');
    res.send('Server is running');
});

app.get('/health', (req, res) => {
    debug('Health check endpoint called');
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Hata yakalama
app.use((err, req, res, next) => {
    debug('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Oyun odaları
const rooms = new Map();

// Socket.IO olayları
io.on('connection', (socket) => {
    debug('New connection:', socket.id);

    socket.on('join', (data) => {
        try {
            debug('Join attempt:', { socketId: socket.id, roomId: data.roomId });
            const roomId = data.roomId;
            
            if (!rooms.has(roomId)) {
                rooms.set(roomId, [socket.id]);
                socket.join(roomId);
                socket.emit('init', { playerId: 1 });
                debug('Created new room:', roomId);
            } else {
                const room = rooms.get(roomId);
                if (room.length < 2) {
                    room.push(socket.id);
                    socket.join(roomId);
                    socket.emit('init', { playerId: 2 });
                    io.to(roomId).emit('start');
                    debug('Joined existing room:', roomId);
                } else {
                    debug('Room full:', roomId);
                    socket.emit('error', { message: 'Room is full' });
                }
            }
        } catch (error) {
            debug('Error in join:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    socket.on('paddle_update', (data) => {
        try {
            const rooms = Array.from(socket.rooms);
            if (rooms.length > 1) {
                const roomId = rooms[1];
                socket.broadcast.to(roomId).emit('opponent_update', data);
            }
        } catch (error) {
            debug('Error in paddle_update:', error);
        }
    });

    socket.on('ball_update', (data) => {
        try {
            const rooms = Array.from(socket.rooms);
            if (rooms.length > 1) {
                const roomId = rooms[1];
                socket.broadcast.to(roomId).emit('ball_sync', data);
            }
        } catch (error) {
            debug('Error in ball_update:', error);
        }
    });

    socket.on('disconnect', () => {
        debug('Client disconnected:', socket.id);
        try {
            rooms.forEach((players, roomId) => {
                const index = players.indexOf(socket.id);
                if (index !== -1) {
                    players.splice(index, 1);
                    if (players.length === 0) {
                        rooms.delete(roomId);
                        debug('Room deleted:', roomId);
                    } else {
                        io.to(roomId).emit('opponent_left');
                        debug('Opponent left room:', roomId);
                    }
                }
            });
        } catch (error) {
            debug('Error in disconnect:', error);
        }
    });

    socket.on('error', (error) => {
        debug('Socket error:', error);
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
    debug(`Server is running on http://${HOST}:${PORT}`);
}); 