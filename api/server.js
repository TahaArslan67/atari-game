import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(join(__dirname, '../')));

const rooms = new Map();

io.on('connection', (socket) => {
    let roomId = null;
    let playerId = null;

    socket.on('join', (data) => {
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
    });

    socket.on('paddle_update', (data) => {
        if (roomId && rooms.has(roomId)) {
            socket.to(roomId).emit('opponent_update', {
                position: data.position
            });
        }
    });

    socket.on('ball_update', (data) => {
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.gameState.ball = data.ball;
            socket.to(roomId).emit('ball_sync', {
                ball: data.ball
            });
        }
    });

    socket.on('disconnect', () => {
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
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server ${port} portunda çalışıyor`);
}); 