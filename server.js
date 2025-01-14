const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

// Express ayarları
app.set('trust proxy', true);
app.disable('x-powered-by');

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
    res.send('Server is running');
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV
    });
});

// Hata yakalama
app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Internal server error' });
});

// Oyun odaları
const rooms = new Map();

// Socket.IO olayları
io.on('connection', (socket) => {
    socket.on('join', (data) => {
        try {
            const roomId = data.roomId;
            
            if (!rooms.has(roomId)) {
                rooms.set(roomId, [socket.id]);
                socket.join(roomId);
                socket.emit('init', { playerId: 1 });
            } else {
                const room = rooms.get(roomId);
                if (room.length < 2) {
                    room.push(socket.id);
                    socket.join(roomId);
                    socket.emit('init', { playerId: 2 });
                    io.to(roomId).emit('start');
                } else {
                    socket.emit('error', { message: 'Room is full' });
                }
            }
        } catch (error) {
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
        } catch (error) {}
    });

    socket.on('ball_update', (data) => {
        try {
            const rooms = Array.from(socket.rooms);
            if (rooms.length > 1) {
                const roomId = rooms[1];
                socket.broadcast.to(roomId).emit('ball_sync', data);
            }
        } catch (error) {}
    });

    socket.on('disconnect', () => {
        try {
            rooms.forEach((players, roomId) => {
                const index = players.indexOf(socket.id);
                if (index !== -1) {
                    players.splice(index, 1);
                    if (players.length === 0) {
                        rooms.delete(roomId);
                    } else {
                        io.to(roomId).emit('opponent_left');
                    }
                }
            });
        } catch (error) {}
    });

    // Skor güncelleme olayını dinle
    socket.on('score_update', (data) => {
        try {
            const socketRooms = Array.from(socket.rooms);
            if (socketRooms.length > 1) {
                const roomId = socketRooms[1];
                io.in(roomId).emit('score_update', {
                    player1Score: data.player1Score,
                    player2Score: data.player2Score,
                    winner: data.winner,
                    timestamp: data.timestamp
                });
            }
        } catch (error) {}
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT); 