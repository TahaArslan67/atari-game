import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Sağlık kontrolü endpoint'i
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Ana sayfa endpoint'i
app.get('/', (req, res) => {
    res.send('Atari Game Server');
});

// Hata yönetimi middleware'i
app.use((err, req, res, next) => {
    console.error('Hata:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
});

// Oyun odaları
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Yeni bağlantı:', socket.id);
    let roomId = null;
    let playerId = null;

    socket.on('join', (data) => {
        try {
            roomId = data.roomId;
            const room = rooms.get(roomId);

            if (room && room.players.size >= 2) {
                socket.emit('error', { message: 'Oda dolu!' });
                socket.disconnect();
                return;
            }

            if (!rooms.has(roomId)) {
                rooms.set(roomId, {
                    players: new Map(),
                    gameState: {
                        ball: { x: 400, y: 300, dx: 4, dy: -4 },
                        score: { player1: 0, player2: 0 }
                    }
                });
            }

            const currentRoom = rooms.get(roomId);
            playerId = currentRoom.players.size + 1;
            currentRoom.players.set(socket.id, playerId);
            socket.join(roomId);

            console.log(`Oyuncu ${playerId} odaya katıldı: ${roomId}`);

            socket.emit('init', {
                playerId: playerId,
                gameState: currentRoom.gameState
            });

            if (currentRoom.players.size === 2) {
                console.log(`Oda ${roomId} oyuna başlıyor`);
                io.to(roomId).emit('start', {
                    gameState: currentRoom.gameState
                });
            }
        } catch (error) {
            console.error('Join hatası:', error);
            socket.emit('error', { message: 'Odaya katılırken bir hata oluştu' });
        }
    });

    socket.on('paddle_update', (data) => {
        try {
            if (roomId && rooms.has(roomId)) {
                socket.to(roomId).emit('opponent_update', {
                    position: data.position
                });
            }
        } catch (error) {
            console.error('Paddle update hatası:', error);
        }
    });

    socket.on('ball_update', (data) => {
        try {
            if (roomId && rooms.has(roomId)) {
                const room = rooms.get(roomId);
                room.gameState.ball = data.ball;
                socket.to(roomId).emit('ball_sync', {
                    ball: data.ball
                });
            }
        } catch (error) {
            console.error('Ball update hatası:', error);
        }
    });

    socket.on('disconnect', () => {
        try {
            if (roomId && rooms.has(roomId)) {
                const room = rooms.get(roomId);
                room.players.delete(socket.id);
                
                console.log(`Oyuncu odadan ayrıldı: ${roomId}`);

                io.to(roomId).emit('opponent_left');

                if (room.players.size === 0) {
                    console.log(`Oda silindi: ${roomId}`);
                    rooms.delete(roomId);
                }
            }
        } catch (error) {
            console.error('Disconnect hatası:', error);
        }
    });

    socket.on('error', (error) => {
        console.error('Socket hatası:', error);
    });
});

// Port dinleme
const port = process.env.PORT || 3000;

try {
    server.listen(port, '0.0.0.0', () => {
        console.log(`Server ${port} portunda çalışıyor`);
    });
} catch (error) {
    console.error('Server başlatma hatası:', error);
    process.exit(1);
}

// Beklenmeyen hataları yakala
process.on('uncaughtException', (error) => {
    console.error('Beklenmeyen hata:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('İşlenmeyen Promise reddi:', error);
}); 