import { Server } from 'ws';

const wss = new Server({ noServer: true });
const rooms = new Map();

export default function handler(req, res) {
    if (req.headers.upgrade !== 'websocket') {
        res.status(400).json({ error: 'Expected WebSocket connection' });
        return;
    }

    wss.handleUpgrade(req, req.socket, Buffer.alloc(0), onConnect);
}

function onConnect(ws) {
    let roomId = null;
    let playerId = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'join':
                roomId = data.roomId;
                const room = rooms.get(roomId);

                if (room && room.players.size >= 2) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Oda dolu!'
                    }));
                    ws.close();
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
                currentRoom.players.set(ws, playerId);

                console.log(`Oyuncu ${playerId} odaya katıldı: ${roomId}`);

                ws.send(JSON.stringify({
                    type: 'init',
                    playerId: playerId,
                    gameState: currentRoom.gameState
                }));

                if (currentRoom.players.size === 2) {
                    console.log(`Oda ${roomId} oyuna başlıyor`);
                    currentRoom.players.forEach((id, playerWs) => {
                        playerWs.send(JSON.stringify({
                            type: 'start',
                            gameState: currentRoom.gameState
                        }));
                    });
                }
                break;

            case 'update':
                if (roomId && rooms.has(roomId)) {
                    const room = rooms.get(roomId);
                    room.players.forEach((id, playerWs) => {
                        if (playerWs !== ws && playerWs.readyState === 1) {
                            playerWs.send(JSON.stringify({
                                type: 'opponent_update',
                                position: data.position
                            }));
                        }
                    });
                }
                break;

            case 'ball_update':
                if (roomId && rooms.has(roomId)) {
                    const room = rooms.get(roomId);
                    room.gameState.ball = data.ball;
                    room.players.forEach((id, playerWs) => {
                        if (playerWs !== ws && playerWs.readyState === 1) {
                            playerWs.send(JSON.stringify({
                                type: 'ball_sync',
                                ball: data.ball
                            }));
                        }
                    });
                }
                break;
        }
    });

    ws.on('close', () => {
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.players.delete(ws);
            
            console.log(`Oyuncu odadan ayrıldı: ${roomId}`);

            room.players.forEach((id, playerWs) => {
                if (playerWs.readyState === 1) {
                    playerWs.send(JSON.stringify({
                        type: 'opponent_left'
                    }));
                }
            });

            if (room.players.size === 0) {
                console.log(`Oda silindi: ${roomId}`);
                rooms.delete(roomId);
            }
        }
    });
} 