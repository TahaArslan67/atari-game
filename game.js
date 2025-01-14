const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('scoreValue');

// Canvas boyutlarını ayarla
canvas.width = 800;
canvas.height = 600;

// Oyun nesneleri
const paddle = {
    width: 100,
    height: 10,
    x: 350,
    y: 550,
    speed: 8,
    dx: 0,
    color: '#fff'
};

const ball = {
    x: 400,
    y: 300,
    size: 10,
    speed: 4,
    dx: 0,
    dy: 0,
    isWaiting: false,
    lastWinner: null
};

let score = 0;

// Çoklu oyuncu değişkenleri
let ws = null;
let playerId = null;
const opponentPaddle = {
    width: 100,
    height: 10,
    x: 350,
    y: 50,
    speed: 8,
    dx: 0,
    color: '#ff0000'
};
let isMultiplayer = false;
let waitingForOpponent = false;

// Ses efektleri
const paddleHitSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/paddle_hit.wav');
const wallHitSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/wall_hit.wav');
const scoreSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/score.wav');

let isSoundEnabled = true;
let player1Score = 0;
let player2Score = 0;

// Top hızlanma oranı
const BALL_SPEED_INCREASE = 1.05; // %5 artış
const MAX_BALL_SPEED = 15;

// Tuş kontrollerini dinle
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

function keyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'Right') {
        paddle.dx = paddle.speed;
    } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
        paddle.dx = -paddle.speed;
    }
}

function keyUp(e) {
    if (
        e.key === 'ArrowRight' ||
        e.key === 'Right' ||
        e.key === 'ArrowLeft' ||
        e.key === 'Left'
    ) {
        paddle.dx = 0;
    }
}

// Paddle'ı hareket ettir
function movePaddle() {
    paddle.x += paddle.dx;

    // Duvar kontrolü
    if (paddle.x < 0) {
        paddle.x = 0;
    } else if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }
}

// Topu hareket ettir
function moveBall() {
    if (ball.isWaiting) return;

    const nextX = ball.x + ball.dx;
    const nextY = ball.y + ball.dy;

    // Duvar çarpışma kontrolü
    if (nextX + ball.size > canvas.width || nextX - ball.size < 0) {
        ball.dx *= -1;
        if (isSoundEnabled) {
            wallHitSound.play();
        }
    } else {
        ball.x = nextX;
    }

    // Üst duvar kontrolü
    if (nextY - ball.size < 0) {
        if (!isMultiplayer) {
            ball.dy *= -1;
            if (isSoundEnabled) {
                wallHitSound.play();
            }
        } else {
            // Üst sınıra çarpma (Player 2 kaybetti)
            updateScore(1);
            resetGame();
            return;
        }
    }

    // Alt duvar kontrolü
    if (nextY + ball.size > canvas.height) {
        if (!isMultiplayer) {
            resetGame();
        } else {
            // Alt sınıra çarpma (Player 1 kaybetti)
            updateScore(2);
            resetGame();
            return;
        }
    }

    // Paddle çarpışma kontrolü (hem üst hem alt paddle için)
    const currentPaddle = nextY > canvas.height / 2 ? paddle : opponentPaddle;
    if (nextY + ball.size > currentPaddle.y &&
        nextY - ball.size < currentPaddle.y + currentPaddle.height &&
        nextX + ball.size > currentPaddle.x &&
        nextX - ball.size < currentPaddle.x + currentPaddle.width) {
        
        if (isSoundEnabled) {
            paddleHitSound.play();
        }

        // Top yönünü değiştir
        ball.dy = currentPaddle === paddle ? -ball.speed : ball.speed;
        
        // Topun paddle'ın neresine çarptığına göre açıyı değiştir
        const hitPosition = (nextX - (currentPaddle.x + currentPaddle.width / 2)) / (currentPaddle.width / 2);
        ball.dx = hitPosition * ball.speed;

        if (isMultiplayer) {
            // Çok oyunculu modda topu hızlandır
            const newSpeed = ball.speed * BALL_SPEED_INCREASE;
            if (newSpeed <= MAX_BALL_SPEED) {
                ball.speed = newSpeed;
                // Yeni hıza göre dx ve dy'yi güncelle
                const currentAngle = Math.atan2(ball.dy, ball.dx);
                ball.dx = Math.cos(currentAngle) * ball.speed;
                ball.dy = Math.sin(currentAngle) * ball.speed;
            }
        }
    }

    // Top pozisyonunu güncelle
    if (!ball.dx && !ball.dy) {
        ball.dx = ball.speed;
        ball.dy = playerId === 1 ? -ball.speed : ball.speed;
    }
    
    ball.y = nextY;
}

// Oyunu sıfırla
function resetGame() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = 4;
    ball.dx = 0;
    ball.dy = 0;
    ball.isWaiting = true;
    
    if (isMultiplayer) {
        setTimeout(() => {
            ball.isWaiting = false;
            // Top yönünü son kazanana göre belirle
            if (ball.lastWinner) {
                ball.dy = ball.lastWinner === 1 ? ball.speed : -ball.speed;
            } else {
                // İlk başlangıçta rastgele yön
                ball.dy = Math.random() < 0.5 ? ball.speed : -ball.speed;
            }
            // Her durumda rastgele x yönü
            ball.dx = (Math.random() * 2 - 1) * ball.speed;
        }, 1000);
    } else {
        ball.dx = (Math.random() * 2 - 1) * ball.speed;
        ball.dy = -ball.speed;
    }

    score = 0;
    scoreElement.innerHTML = score;
}

// Çizim fonksiyonları
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();
}

function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = paddle.color;
    ctx.fill();
    ctx.closePath();
}

function drawOpponentPaddle() {
    if (isMultiplayer) {
        ctx.beginPath();
        ctx.rect(opponentPaddle.x, opponentPaddle.y, opponentPaddle.width, opponentPaddle.height);
        ctx.fillStyle = opponentPaddle.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Skor tablosunu güncelle
function updateScore(winner) {
    if (winner === 1) {
        player1Score++;
        ball.lastWinner = 1;
    } else if (winner === 2) {
        player2Score++;
        ball.lastWinner = 2;
    }
    
    if (isSoundEnabled) {
        scoreSound.play();
    }
}

// WebSocket bağlantısını başlat
function startMultiplayer() {
    if (ws) {
        ws.disconnect();
    }

    // Skorları sıfırla
    player1Score = 0;
    player2Score = 0;

    // Socket.IO bağlantısını kur
    const serverUrl = 'https://pleasing-radiance-production.up.railway.app';
    ws = io(serverUrl, {
        transports: ['websocket'],
        upgrade: false
    });

    waitingForOpponent = true;

    ws.on('connect', () => {
        console.log('Sunucuya bağlandı');
        const urlParams = new URLSearchParams(window.location.search);
        let roomId = urlParams.get('room');
        
        if (!roomId) {
            roomId = Math.random().toString(36).substring(7);
            window.history.pushState({}, '', `?room=${roomId}`);
        }

        ws.emit('join', {
            roomId: roomId
        });
    });

    ws.on('connect_error', (error) => {
        console.error('Bağlantı hatası:', error);
        alert('Sunucuya bağlanılamadı!');
    });

    ws.on('init', (data) => {
        playerId = data.playerId;
        if (playerId === 2) {
            paddle.y = 50;
            paddle.color = '#ff0000';
            opponentPaddle.y = 550;
            opponentPaddle.color = '#fff';
            ball.dy = ball.speed;
        } else {
            paddle.y = 550;
            paddle.color = '#fff';
            opponentPaddle.y = 50;
            opponentPaddle.color = '#ff0000';
            ball.dy = -ball.speed;
        }
    });

    ws.on('start', () => {
        waitingForOpponent = false;
        isMultiplayer = true;
        resetGame();
    });

    ws.on('opponent_update', (data) => {
        opponentPaddle.x = data.position;
    });

    ws.on('ball_sync', (data) => {
        if (playerId === 2) {
            ball.x = data.ball.x;
            ball.y = data.ball.y;
            ball.dx = data.ball.dx;
            ball.dy = data.ball.dy;
            ball.speed = data.ball.speed;
        }
    });

    ws.on('opponent_left', () => {
        alert('Rakip oyundan ayrıldı!');
        isMultiplayer = false;
        waitingForOpponent = false;
        resetGame();
    });

    ws.on('disconnect', () => {
        isMultiplayer = false;
        waitingForOpponent = false;
        alert('Sunucu bağlantısı kesildi!');
    });
}

// Paddle pozisyonunu gönder
function sendPaddlePosition() {
    if (ws && ws.connected) {
        ws.emit('paddle_update', {
            position: paddle.x
        });
    }
}

// Top pozisyonunu gönder
function sendBallPosition() {
    if (ws && ws.connected && playerId === 1) {
        ws.emit('ball_update', {
            ball: {
                x: ball.x,
                y: ball.y,
                dx: ball.dx,
                dy: ball.dy,
                speed: ball.speed
            }
        });
    }
}

let winnerMessage = '';
let showWinnerMessage = false;
let messageTimer = null;

function showWinner(message) {
    winnerMessage = message;
    showWinnerMessage = true;
    
    // Önceki zamanlayıcıyı temizle
    if (messageTimer) {
        clearTimeout(messageTimer);
    }
    
    // 3 saniye sonra mesajı kaldır
    messageTimer = setTimeout(() => {
        showWinnerMessage = false;
        winnerMessage = '';
    }, 3000);
}

// Oyun döngüsü
function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (waitingForOpponent && isMultiplayer) {
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Rakip bekleniyor...', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Oda bağlantı linki:', canvas.width / 2, canvas.height / 2 + 40);
        ctx.fillText(window.location.href, canvas.width / 2, canvas.height / 2 + 80);
        requestAnimationFrame(update);
        return;
    }

    // Skor tablosunu göster
    if (isMultiplayer) {
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        
        // Player 1 skoru (üst)
        ctx.fillText(`Player 1: ${player1Score}`, canvas.width / 4, 30);
        
        // Player 2 skoru (alt)
        ctx.fillText(`Player 2: ${player2Score}`, canvas.width * 3 / 4, 30);
        
        // Top hızı
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Top Hızı: ${Math.round(ball.speed * 10) / 10}`, 10, 60);
    }

    drawBall();
    drawPaddle();
    drawOpponentPaddle();

    movePaddle();
    moveBall();

    if (isMultiplayer) {
        sendPaddlePosition();
        sendBallPosition();
    }

    requestAnimationFrame(update);
}

// Çoklu oyuncu butonu ekle
const gameContainer = document.querySelector('.game-container');
const multiplayerBtn = document.createElement('button');
multiplayerBtn.textContent = 'Çoklu Oyuncu';
multiplayerBtn.style.marginTop = '10px';
multiplayerBtn.onclick = startMultiplayer;
gameContainer.appendChild(multiplayerBtn);

// Ses açma/kapama butonu ekle
const soundBtn = document.createElement('button');
soundBtn.textContent = 'Ses: Açık';
soundBtn.style.marginTop = '10px';
soundBtn.style.marginLeft = '10px';
soundBtn.onclick = () => {
    isSoundEnabled = !isSoundEnabled;
    soundBtn.textContent = `Ses: ${isSoundEnabled ? 'Açık' : 'Kapalı'}`;
};
gameContainer.appendChild(soundBtn);

update(); 