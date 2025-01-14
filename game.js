const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Sabit değerler
const CANVAS_RATIO = 4/3; // 800x600 = 4:3
const PADDLE_BOTTOM_MARGIN = 40; // Alt paddle'ın alttan uzaklığı
const PADDLE_TOP_MARGIN = 40; // Üst paddle'ın üstten uzaklığı

// Canvas boyutlarını ayarla
function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Minimum boyutlar
    const MIN_WIDTH = 300;
    const MIN_HEIGHT = MIN_WIDTH * (3/4);

    // Maksimum boyutlar
    const MAX_WIDTH = 800;
    const MAX_HEIGHT = MAX_WIDTH * (3/4);

    // Önce container'a göre boyutu hesapla
    let newWidth = Math.min(containerWidth - 20, MAX_WIDTH);
    let newHeight = newWidth * (3/4);

    // Minimum boyutları kontrol et
    newWidth = Math.max(MIN_WIDTH, newWidth);
    newHeight = Math.max(MIN_HEIGHT, newHeight);

    // Canvas boyutlarını ayarla
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Paddle ve top boyutlarını ölçekle
    const scale = newWidth / 800;
    paddle.width = Math.max(60, Math.floor(100 * scale));
    paddle.height = Math.max(8, Math.floor(10 * scale));
    opponentPaddle.width = paddle.width;
    opponentPaddle.height = paddle.height;
    ball.size = Math.max(5, Math.floor(10 * scale));

    // Paddle pozisyonlarını güncelle
    paddle.y = canvas.height - paddle.height - PADDLE_BOTTOM_MARGIN;
    opponentPaddle.y = PADDLE_TOP_MARGIN;

    // Paddle'ların x pozisyonlarını ortala
    paddle.x = (canvas.width - paddle.width) / 2;
    opponentPaddle.x = (canvas.width - opponentPaddle.width) / 2;

    // Top pozisyonunu güncelle
    if (!isMultiplayer || (isMultiplayer && playerId === 1)) {
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
    }
}

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

    // Duvar kontrolü - ekran boyutuna göre sınırla
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

// Paddle pozisyonlarını ayarla
function updatePaddlePositions() {
    // Alt paddle pozisyonu - ekranın altından yukarı doğru belirli bir mesafe
    paddle.y = canvas.height - paddle.height - 50;

    // Üst paddle pozisyonu - ekranın üstünden aşağı doğru belirli bir mesafe
    opponentPaddle.y = 50;
}

// Event listener'ı güncelle
window.addEventListener('resize', () => {
    resizeCanvas();
});

// İlk yükleme için resize'ı çağır
resizeCanvas();

// Her frame'de paddle pozisyonlarını kontrol et
function update() {
    // Paddle'ı hareket ettir
    movePaddle();
    
    // Paddle'ın ekran dışına çıkmasını engelle
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
    
    // Alt paddle'ın y pozisyonunu sabit tut
    paddle.y = canvas.height - paddle.height - PADDLE_BOTTOM_MARGIN;
    
    // Çok oyunculu modda
    if (isMultiplayer) {
        // Üst paddle'ın y pozisyonunu sabit tut
        opponentPaddle.y = PADDLE_TOP_MARGIN;
        
        // Sadece Player 1 topu hareket ettirir
        if (playerId === 1) {
            moveBall();
            sendBallPosition();
        }
        sendPaddlePosition();
    } else {
        moveBall();
    }
    
    draw();
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
    // Yeni boyutları sunucuya bildir
    if (ws && ws.connected && isMultiplayer) {
        sendPaddlePosition();
        if (playerId === 1) {
            sendBallPosition();
        }
    }
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