const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
const startSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/baslangicsesi.WAV');
const hittingSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/hittingsound.WAV');
const scoreSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/hittingsound.WAV');

let isSoundEnabled = true;
let player1Score = 0;
let player2Score = 0;

// Top hızlanma oranı
const BALL_SPEED_INCREASE = 1.075; // %7.5 artış
const MAX_BALL_SPEED = 15;

// Mesaj gösterimi için değişkenler
let gameMessage = '';
let showGameMessage = false;
let messageTimer = null;

// Mesaj gösterme fonksiyonu
function showMessage(message, duration = 3000) {
    gameMessage = message;
    showGameMessage = true;
    
    if (messageTimer) {
        clearTimeout(messageTimer);
    }
    
    messageTimer = setTimeout(() => {
        showGameMessage = false;
        gameMessage = '';
    }, duration);
}

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
        playSound(hittingSound);
       
    } else {
        ball.x = nextX;
    }

    // Üst duvar kontrolü
    if (nextY - ball.size < 0) {
        if (!isMultiplayer) {
            ball.dy *= -1;
            playSound(hittingSound);
            
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
    
    // Çarpışma toleransını artır
    const paddleCollisionTolerance = 5;
    if (nextY + ball.size + paddleCollisionTolerance > currentPaddle.y &&
        nextY - ball.size - paddleCollisionTolerance < currentPaddle.y + currentPaddle.height &&
        nextX + ball.size > currentPaddle.x &&
        nextX - ball.size < currentPaddle.x + currentPaddle.width) {
        
        playSound(hittingSound);

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
        score = 0;
    }
}

// Çizim fonksiyonları
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
    ctx.fillStyle = playerId === 2 ? '#ff0000' : '#fff';
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
    // Skoru güncelle
    if (winner === 1) {
        player1Score++;
    } else if (winner === 2) {
        player2Score++;
    }

    // Skor güncellemesini server'a gönder
    if (ws && ws.connected) {
        ws.emit('score_update', {
            player1Score,
            player2Score,
            winner,
            timestamp: Date.now()
        });
    }

    playSound(scoreSound);
}

// Skor gösterimini güncelle
function updateScoreDisplay(data) {
    if (!data) return;
    
    player1Score = data.player1Score;
    player2Score = data.player2Score;
    ball.lastWinner = data.lastWinner;
    
    console.log('Skorlar güncellendi:', {
        player1Score,
        player2Score,
        playerId,
        sender: data.sender
    });
}

// WebSocket bağlantısını başlat
function startMultiplayer() {
    if (ws) {
        ws.disconnect();
    }

    // Başlangıç sesi çal
    playSound(startSound);

    // Skorları sıfırla
    player1Score = 0;
    player2Score = 0;

    // Socket.IO bağlantısını kur
    const serverUrl = 'https://pleasing-radiance-production.up.railway.app';
    ws = io(serverUrl, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });

    waitingForOpponent = true;

    ws.on('connect', () => {
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
        showMessage('Sunucuya bağlanılamadı!');
    });

    ws.on('init', (data) => {
        playerId = data.playerId;
        
        // Skorları sıfırla
        player1Score = 0;
        player2Score = 0;
        
        if (playerId === 2) {
            paddle.y = 50;
            paddle.color = '#ff0000';
            opponentPaddle.y = 550;
            opponentPaddle.color = '#fff';
        } else {
            paddle.y = 550;
            paddle.color = '#fff';
            opponentPaddle.y = 50;
            opponentPaddle.color = '#ff0000';
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
        // Her iki oyuncu için de top verilerini senkronize et
        if (playerId === 2) {
            ball.x = data.ball.x;
            ball.y = data.ball.y;
            ball.dx = data.ball.dx;
            ball.dy = data.ball.dy;
            ball.speed = data.ball.speed;
            ball.isWaiting = data.ball.isWaiting;
        }
    });

    ws.on('opponent_left', () => {
        showMessage('Rakip oyundan ayrıldı!');
        isMultiplayer = false;
        waitingForOpponent = false;
        resetGame();
    });

    ws.on('disconnect', () => {
        isMultiplayer = false;
        waitingForOpponent = false;
        showMessage('Sunucu bağlantısı kesildi!');
    });

    // Skor güncelleme olayını dinle
    ws.on('score_update', (data) => {
        player1Score = data.player1Score;
        player2Score = data.player2Score;
    });
}

// Paddle pozisyonunu daha sık gönder
function sendPaddlePosition() {
    if (ws && ws.connected) {
        ws.emit('paddle_update', {
            position: paddle.x,
            timestamp: Date.now()
        });
    }
}

// Top pozisyonunu daha sık gönder
function sendBallPosition() {
    if (ws && ws.connected && playerId === 1) {
        ws.emit('ball_update', {
            ball: {
                x: ball.x,
                y: ball.y,
                dx: ball.dx,
                dy: ball.dy,
                speed: ball.speed,
                isWaiting: ball.isWaiting,
                timestamp: Date.now()
            }
        });
    }
}

let winnerMessage = '';
let showWinnerMessage = false;

function showWinner(message) {
    winnerMessage = message;
    showWinnerMessage = true;
    
    if (messageTimer) {
        clearTimeout(messageTimer);
    }
    
    messageTimer = setTimeout(() => {
        showWinnerMessage = false;
        winnerMessage = '';
    }, 3000);
}

// Zaman takibi için değişken
let lastUpdateTime = Date.now();

// Canvas boyutlarını responsive yap
function resizeCanvas() {
    const container = document.querySelector('.game-container');
    const containerWidth = container.clientWidth;
    const maxWidth = 800;
    const aspectRatio = 600 / 800;

    // Mevcut pozisyonların oranlarını kaydet
    const paddleRatioX = paddle.x / canvas.width;
    const paddleRatioY = paddle.y / canvas.height;
    const opponentRatioX = opponentPaddle.x / canvas.width;
    const opponentRatioY = opponentPaddle.y / canvas.height;
    const ballRatioX = ball.x / canvas.width;
    const ballRatioY = ball.y / canvas.height;

    // Canvas boyutlarını güncelle
    if (containerWidth < maxWidth) {
        canvas.width = containerWidth - 40;
        canvas.height = canvas.width * aspectRatio;
    } else {
        canvas.width = maxWidth;
        canvas.height = maxWidth * aspectRatio;
    }

    // Oyun elemanlarının boyutlarını güncelle
    const scale = canvas.width / 800;

    // Paddle boyutlarını güncelle
    paddle.width = 100 * scale;
    paddle.height = 10 * scale;
    opponentPaddle.width = 100 * scale;
    opponentPaddle.height = 10 * scale;

    // Top boyutunu güncelle
    ball.size = 10 * scale;

    // Pozisyonları yeni boyutlara göre ayarla
    paddle.x = paddleRatioX * canvas.width;
    paddle.y = playerId === 2 ? (50 * scale) : (canvas.height - paddle.height - 10);
    opponentPaddle.x = opponentRatioX * canvas.width;
    opponentPaddle.y = playerId === 2 ? (canvas.height - paddle.height - 10) : (50 * scale);
    ball.x = ballRatioX * canvas.width;
    ball.y = ballRatioY * canvas.height;

    // Font boyutlarını güncelle
    const fontSize = Math.max(16 * scale, 12);
    ctx.font = `${fontSize}px Arial`;
}

// Oyun döngüsü
function update() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastUpdateTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (waitingForOpponent && isMultiplayer) {
        ctx.fillStyle = '#fff';
        const fontSize = Math.max(24 * (canvas.width / 800), 14);
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Rakip bekleniyor...', canvas.width / 2, canvas.height / 2);
        ctx.fillText('Oda bağlantı linki:', canvas.width / 2, canvas.height / 2 + 40 * (canvas.width / 800));
        ctx.fillText(window.location.href, canvas.width / 2, canvas.height / 2 + 80 * (canvas.width / 800));
        requestAnimationFrame(update);
        return;
    }

    // Skor tablosunu göster
    if (!isMultiplayer) {
        ctx.fillStyle = '#fff';
        const fontSize = Math.max(24 * (canvas.width / 800), 14);
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(`Skor: ${score}`, 10 * (canvas.width / 800), 30 * (canvas.width / 800));
    } else {
        ctx.fillStyle = '#fff';
        const fontSize = Math.max(24 * (canvas.width / 800), 14);
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        
        if (playerId === 2) {
            ctx.fillText(`Siz (Kırmızı): ${player2Score}`, canvas.width / 4, 30 * (canvas.width / 800));
            ctx.fillText(`Rakip (Beyaz): ${player1Score}`, canvas.width * 3 / 4, 30 * (canvas.width / 800));
        } else {
            ctx.fillText(`Siz (Beyaz): ${player1Score}`, canvas.width / 4, 30 * (canvas.width / 800));
            ctx.fillText(`Rakip (Kırmızı): ${player2Score}`, canvas.width * 3 / 4, 30 * (canvas.width / 800));
        }
        
        const smallFontSize = Math.max(16 * (canvas.width / 800), 12);
        ctx.font = `${smallFontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(`Top Hızı: ${Math.round(ball.speed * 10) / 10}`, 10 * (canvas.width / 800), 60 * (canvas.width / 800));
    }

    // Her zaman topu çiz
    drawBall();
    drawPaddle();
    drawOpponentPaddle();

    movePaddle();
    
    // Çok oyunculu modda sadece Player 1 topu hareket ettirir
    if (!isMultiplayer || (isMultiplayer && playerId === 1)) {
        moveBall();
    }

    // Top pozisyonunu daha sık gönder
    if (isMultiplayer && playerId === 1) {
        sendBallPosition();
    }

    if (isMultiplayer && deltaTime >= 16) { // ~60fps
        sendPaddlePosition();
        lastUpdateTime = currentTime;
    }

    // Mesaj gösterimi
    if (showGameMessage) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);
        
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gameMessage, canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(update);
}

// Butonları HTML'den al
const multiplayerBtn = document.getElementById('multiplayerBtn');
const soundBtn = document.getElementById('soundBtn');

// Buton olaylarını ekle
multiplayerBtn.onclick = () => {
    playSound(startSound);
    startMultiplayer();
};

soundBtn.onclick = () => {
    isSoundEnabled = !isSoundEnabled;
    soundBtn.textContent = `Ses: ${isSoundEnabled ? 'Açık' : 'Kapalı'}`;
};

// Pencere boyutu değiştiğinde canvas'ı yeniden boyutlandır
window.addEventListener('resize', () => {
    resizeCanvas();
});

// İlk yükleme için canvas'ı boyutlandır
resizeCanvas();

// Oyun başlangıç sesi - kullanıcı etkileşimi sonrası çal
document.addEventListener('click', () => {
    if (!startSound.played.length) {
        playSound(startSound);
    }
}, { once: true });

// Ses çalma fonksiyonu
function playSound(sound) {
    if (isSoundEnabled && sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
}

// Mobil kontroller
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

// Dokunmatik kontroller için değişkenler
let isTouchingLeft = false;
let isTouchingRight = false;

// Dokunmatik olayları
leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isTouchingLeft = true;
    paddle.dx = -paddle.speed;
});

leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    isTouchingLeft = false;
    if (!isTouchingRight) paddle.dx = 0;
});

rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isTouchingRight = true;
    paddle.dx = paddle.speed;
});

rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    isTouchingRight = false;
    if (!isTouchingLeft) paddle.dx = 0;
});

// Mouse kontrolleri (tablet için)
leftBtn.addEventListener('mousedown', () => {
    isTouchingLeft = true;
    paddle.dx = -paddle.speed;
});

leftBtn.addEventListener('mouseup', () => {
    isTouchingLeft = false;
    if (!isTouchingRight) paddle.dx = 0;
});

rightBtn.addEventListener('mousedown', () => {
    isTouchingRight = true;
    paddle.dx = paddle.speed;
});

rightBtn.addEventListener('mouseup', () => {
    isTouchingRight = false;
    if (!isTouchingLeft) paddle.dx = 0;
});

// Mouse için global mouseup olayı
document.addEventListener('mouseup', () => {
    if (isTouchingLeft || isTouchingRight) {
        isTouchingLeft = false;
        isTouchingRight = false;
        paddle.dx = 0;
    }
});

update(); 