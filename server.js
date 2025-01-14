const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);

// CORS ayarları
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// Socket.IO kurulumu
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

// Basit endpoint'ler
app.get('/', (req, res) => {
    res.send('Atari Game Server is running');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Oyun odaları
const rooms = new Map();

// Socket.IO olayları
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('join', (data) => {
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
            }
        }
    });

    socket.on('paddle_update', (data) => {
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit('opponent_update', data);
    });

    socket.on('ball_update', (data) => {
        socket.broadcast.to(Array.from(socket.rooms)[1]).emit('ball_sync', data);
    });

    socket.on('disconnect', () => {
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
    });
});

// Sunucuyu başlat
const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 