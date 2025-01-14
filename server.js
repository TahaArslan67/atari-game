const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const cors = require('cors');
const path = require('path');
const serveStatic = require('serve-static');

app.use(cors());
app.use(serveStatic(path.join(__dirname, 'public')));

// Odaları saklamak için dizi
const rooms = [];

// Ana endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Statik dosyalar için endpoint
app.use('/sounds', express.static(path.join(__dirname, 'public/sounds')));
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO olayları
io.on('connection', (socket) => {
    let currentRoom = null;

    // Mevcut odaları kontrol et
    socket.on('check_rooms', () => {
        // Boş yer olan bir oda bul
        const availableRoom = rooms.find(r => r.players.length === 1);
        
        if (availableRoom) {
            socket.emit('rooms_status', {
                availableRoom: true,
                roomId: availableRoom.id
            });
        } else {
            socket.emit('rooms_status', {
                availableRoom: false
            });
        }
    });

    // Odaya katılma isteği
    socket.on('join', (data) => {
        const { roomId } = data;
        
        // Mevcut odayı bul veya yeni oda oluştur
        let room = rooms.find(r => r.id === roomId);
        if (!room) {
            room = {
                id: roomId,
                players: [],
                scores: {
                    player1: 0,
                    player2: 0
                }
            };
            rooms.push(room);
        }

        // Odada yer varsa oyuncuyu ekle
        if (room.players.length < 2) {
            // Eğer oyuncu zaten odadaysa, tekrar ekleme
            if (!room.players.includes(socket.id)) {
                room.players.push(socket.id);
                socket.join(roomId);
                currentRoom = roomId;

                // Oyuncu numarasını belirle
                const playerId = room.players.length;
                socket.emit('init', { playerId });

                console.log(`Player ${playerId} joined room ${roomId}`);

                // İki oyuncu da hazırsa oyunu başlat
                if (room.players.length === 2) {
                    io.to(roomId).emit('start');
                    console.log(`Game started in room ${roomId}`);
                }
            }
        } else {
            socket.emit('error', { message: 'Oda dolu!' });
        }
    });

    // Paddle pozisyonu güncelleme
    socket.on('paddle_update', (data) => {
        if (!currentRoom) return;
        
        const room = rooms.find(r => r.id === currentRoom);
        if (room) {
            socket.to(currentRoom).emit('paddle_update', {
                position: data.position,
                timestamp: data.timestamp
            });
        }
    });

    // Top pozisyonu güncelleme
    socket.on('ball_update', (data) => {
        if (!currentRoom) return;
        
        const room = rooms.find(r => r.id === currentRoom);
        if (room) {
            socket.to(currentRoom).emit('ball_update', {
                x: data.x,
                y: data.y,
                dx: data.dx,
                dy: data.dy,
                speed: data.speed,
                isWaiting: data.isWaiting,
                timestamp: data.timestamp
            });
        }
    });

    // Skor güncelleme
    socket.on('score_update', (data) => {
        // Sadece Player 1'den gelen skor güncellemelerini kabul et
        if (rooms.some(r => r.players[0] === socket.id)) {
            const room = rooms.find(r => r.players.includes(socket.id));
            if (room) {
                // Kazanana göre skoru güncelle
                if (data.winner === 1) {
                    room.player1Score = (room.player1Score || 0) + 1;
                } else if (data.winner === 2) {
                    room.player2Score = (room.player2Score || 0) + 1;
                }

                // Güncellenmiş skorları gönder
                io.in(room.id).emit('score_update', {
                    winner: data.winner,
                    player1Score: room.player1Score,
                    player2Score: room.player2Score,
                    timestamp: Date.now()
                });
                
                console.log(`Room ${room.id} skor güncellendi - P1: ${room.player1Score}, P2: ${room.player2Score}`);
            }
        }
    });

    // Yeni oda oluşturulduğunda skorları sıfırla
    socket.on('create_room', () => {
        const room = {
            id: generateRoomId(),
            players: [socket.id],
            player1Score: 0,
            player2Score: 0
        };
        rooms.push(room);
        socket.join(room.id);
        socket.emit('room_created', { roomId: room.id });
    });

    // Bağlantı koptuğunda
    socket.on('disconnect', () => {
        if (!currentRoom) return;

        const room = rooms.find(r => r.id === currentRoom);
        if (room) {
            // Oyuncuyu odadan çıkar
            room.players = room.players.filter(id => id !== socket.id);
            
            // Diğer oyuncuya haber ver
            socket.to(currentRoom).emit('opponent_left');

            console.log(`Player left room ${currentRoom}`);

            // Oda boşsa sil
            if (room.players.length === 0) {
                const index = rooms.indexOf(room);
                if (index > -1) {
                    rooms.splice(index, 1);
                    console.log(`Room ${currentRoom} removed`);
                }
            }
        }
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

http.listen(PORT, HOST, () => {
    console.log(`Server is running on port ${PORT}`);
}); 