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
    dx: 4,
    dy: -4
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

// Top hızlanma oranı
const BALL_SPEED_INCREASE = 1.1;
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
    const nextX = ball.x + ball.dx;
    const nextY = ball.y + ball.dy;

    // Duvar çarpışma kontrolü
    if (nextX + ball.size > canvas.width || nextX - ball.size < 0) {
        ball.dx *= -1;
    } else {
        ball.x = nextX;
    }

    // Üst duvar kontrolü
    if (nextY - ball.size < 0) {
        if (!isMultiplayer) {
            ball.dy *= -1;
        } else {
            // Üst sınıra çarpma
            if (playerId === 1) {
                alert('Alt oyuncu kazandı!');
            } else {
                alert('Kaybettiniz!');
            }
            resetGame();
            return;
        }
    }

    // Alt duvar kontrolü
    if (nextY + ball.size > canvas.height) {
        if (!isMultiplayer) {
            resetGame();
        } else {
            // Alt sınıra çarpma
            if (playerId === 1) {
                alert('Kazandınız!');
            } else {
                alert('Üst oyuncu kazandı!');
            }
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
    
    if (isMultiplayer) {
        ball.dx = ball.speed;
        ball.dy = playerId === 1 ? -ball.speed : ball.speed;
    } else {
        ball.dx = ball.speed;
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

// WebSocket bağlantısını başlat
function startMultiplayer() {
    if (ws) {
        ws.disconnect();
    }

    // Socket.IO bağlantısını kur
    const serverUrl = 'https://atari-game-production.up.railway.app';  // Railway URL'sini buraya yazın
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

    // Top hızını göster (çok oyunculu modda)
    if (isMultiplayer) {
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Top Hızı: ${Math.round(ball.speed * 10) / 10}`, 10, 20);
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

update(); 