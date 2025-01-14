// Sunucu URL'si
const serverUrl = process.env.NODE_ENV === 'production' 
    ? 'https://atari-game-server.vercel.app'  // Production URL'i
    : 'http://localhost:3000';                // Development URL'i

// Oyun değişkenleri
let socket = null;
let playerId = null;
let isMultiplayer = false;
let isSoundEnabled = true;
let isWaiting = true;
let player1Score = 0;
let player2Score = 0;

// Canvas ayarları
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas boyutlarını ayarla
canvas.width = 800;
canvas.height = 600;

// Paddle özellikleri
const paddle = {
    width: 100,
    height: 10,
    x: canvas.width / 2 - 50,
    y: canvas.height - 20,
    speed: 8,
    dx: 0
};

// Rakip paddle özellikleri
const opponentPaddle = {
    width: 100,
    height: 10,
    x: canvas.width / 2 - 50,
    y: 10,
    speed: 8,
    dx: 0
};

// Top özellikleri
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 8,
    speed: 2,
    dx: 2,
    dy: -2
};

// Top hareketi
function moveBall() {
    if (isWaiting) return;
    
    ball.x += ball.dx * ball.speed;
    ball.y += ball.dy * ball.speed;
}

// Ses efektleri
const startSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/baslangicsesi.WAV');
const hittingSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/hittingsound.WAV');
const scoreSound = new Audio('https://raw.githubusercontent.com/TahaArslan67/atari-game/master/sounds/hittingsound.WAV');

// Ses çalma fonksiyonu
function playSound(sound) {
    if (isSoundEnabled && sound) {
        sound.currentTime = 0;
        sound.play().catch(error => {
            console.log('Ses çalma hatası:', error);
        });
    }
}

// Tuş kontrollerini dinle
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        paddle.x -= paddle.speed;
        if (paddle.x < 0) paddle.x = 0;
    }
    if (e.key === 'ArrowRight') {
        paddle.x += paddle.speed;
        if (paddle.x + paddle.width > canvas.width) {
            paddle.x = canvas.width - paddle.width;
        }
    }
});

// Mobil kontroller
document.getElementById('leftBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    paddle.x -= paddle.speed;
    if (paddle.x < 0) paddle.x = 0;
});

document.getElementById('rightBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    paddle.x += paddle.speed;
    if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }
});

// Çizim fonksiyonları
function draw() {
    // Canvas'ı temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Paddle'ları çiz
    ctx.fillStyle = '#fff';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillRect(opponentPaddle.x, opponentPaddle.y, opponentPaddle.width, opponentPaddle.height);
    
    // Topu çiz
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();
    
    // Skoru çiz
    ctx.font = '24px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${player2Score}`, 20, canvas.height / 2 - 20);
    ctx.fillText(`${player1Score}`, 20, canvas.height / 2 + 40);
}

// Çarpışma kontrolü
function checkCollision() {
    // Duvarlarla çarpışma
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
        ball.dx *= -1;
        playSound(hittingSound);
    }
    
    // Üst ve alt çarpışma (skor)
    if (ball.y + ball.radius > canvas.height) {
        // Üst oyuncu kazandı
        if (isMultiplayer && socket && socket.connected) {
            if (playerId === 1) {
                socket.emit('score_update', {
                    winner: 2,
                    timestamp: Date.now()
                });
            }
        } else {
            player2Score++;
        }
        resetBall();
        playSound(scoreSound);
    } else if (ball.y - ball.radius < 0) {
        // Alt oyuncu kazandı
        if (isMultiplayer && socket && socket.connected) {
            if (playerId === 1) {
                socket.emit('score_update', {
                    winner: 1,
                    timestamp: Date.now()
                });
            }
        } else {
            player1Score++;
        }
        resetBall();
        playSound(scoreSound);
    }
    
    // Paddle çarpışmaları - Player 1
    if (playerId === 1) {
        if (ball.dy > 0) {
            // Alt paddle ile çarpışma (Player 1'in paddle'ı)
            if (ball.y + ball.radius > paddle.y && 
                ball.x > paddle.x && 
                ball.x < paddle.x + paddle.width) {
                ball.dy *= -1;
                ball.speed *= 1.02;
                playSound(hittingSound);
            }
        } else {
            // Üst paddle ile çarpışma (Rakibin paddle'ı)
            if (ball.y - ball.radius < opponentPaddle.y + opponentPaddle.height && 
                ball.x > opponentPaddle.x && 
                ball.x < opponentPaddle.x + opponentPaddle.width) {
                ball.dy *= -1;
                ball.speed *= 1.02;
                playSound(hittingSound);
            }
        }
    } else {
        // Paddle çarpışmaları - Player 2
        if (ball.dy < 0) {
            // Üst paddle ile çarpışma (Player 2'nin paddle'ı)
            if (ball.y - ball.radius < paddle.y + paddle.height && 
                ball.x > paddle.x && 
                ball.x < paddle.x + paddle.width) {
                ball.dy *= -1;
                ball.speed *= 1.02;
                playSound(hittingSound);
            }
        } else {
            // Alt paddle ile çarpışma (Rakibin paddle'ı)
            if (ball.y + ball.radius > opponentPaddle.y && 
                ball.x > opponentPaddle.x && 
                ball.x < opponentPaddle.x + opponentPaddle.width) {
                ball.dy *= -1;
                ball.speed *= 1.02;
                playSound(hittingSound);
            }
        }
    }
}

// Topu resetle
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = 2;
    ball.dx = Math.random() > 0.5 ? 2 : -2;
    ball.dy = Math.random() > 0.5 ? 2 : -2;
}

// Oyun döngüsü
function update() {
    // Canvas'ı temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Çok oyunculu modda
    if (isMultiplayer) {
        // Player 1 topu kontrol eder
        if (playerId === 1) {
            moveBall();
            checkCollision();
            
            // Top pozisyonunu gönder
            if (socket && socket.connected) {
                socket.emit('ball_update', {
                    x: ball.x,
                    y: ball.y,
                    dx: ball.dx,
                    dy: ball.dy,
                    speed: ball.speed,
                    timestamp: Date.now()
                });
            }
        }
        
        // Paddle pozisyonunu gönder
        if (socket && socket.connected) {
            socket.emit('paddle_update', {
                position: paddle.x,
                timestamp: Date.now()
            });
        }
    } else {
        // Tek oyunculu mod
        moveBall();
        checkCollision();
        
        // AI kontrolü
        opponentPaddle.x = ball.x - opponentPaddle.width / 2;
        if (opponentPaddle.x < 0) opponentPaddle.x = 0;
        if (opponentPaddle.x + opponentPaddle.width > canvas.width) {
            opponentPaddle.x = canvas.width - opponentPaddle.width;
        }
    }
    
    // Oyun elemanlarını çiz
    draw();
    
    // Bir sonraki kareyi çiz
    requestAnimationFrame(update);
}

// Buton olayları
const multiplayerBtn = document.getElementById('multiplayerBtn');
const soundBtn = document.getElementById('soundBtn');

multiplayerBtn.onclick = () => {
    isMultiplayer = true;
    playSound(startSound);
    
    // Butonları gizle
    document.querySelector('.button-container').style.display = 'none';
    
    // Mobil kontrolleri göster
    document.querySelector('.mobile-controls').style.display = 'flex';
    
    // Socket.IO bağlantısı
    socket = io(serverUrl, {
        transports: ['polling', 'websocket'],
        upgrade: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });

    // Bağlantı başarılı
    socket.on('connect', () => {
        socket.emit('check_rooms');
    });

    // Mevcut odaları kontrol et
    socket.on('rooms_status', (data) => {
        if (data.availableRoom) {
            socket.emit('join', { roomId: data.roomId });
        } else {
            const newRoomId = Math.random().toString(36).substring(7);
            socket.emit('join', { roomId: newRoomId });
        }
    });

    // Oyuncu numarası al
    socket.on('init', (data) => {
        playerId = data.playerId;
        
        // Player 2 için paddle pozisyonlarını ayarla
        if (playerId === 2) {
            // Player 2 için paddle'ı üste al
            paddle.y = 10;
            opponentPaddle.y = canvas.height - 20;
        } else {
            // Player 1 için paddle'ı alta al
            paddle.y = canvas.height - 20;
            opponentPaddle.y = 10;
        }
        
        // Başlangıç pozisyonlarını ayarla
        resetBall();
    });

    // Oyun başladı
    socket.on('start', () => {
        isWaiting = false;
        resetBall();
    });

    // Top güncelleme
    socket.on('ball_update', (data) => {
        if (playerId === 2) {
            ball.x = data.x;
            ball.y = data.y;
            ball.dx = data.dx;
            ball.dy = data.dy;
            ball.speed = data.speed;
        }
    });

    // Rakip paddle güncelleme
    socket.on('paddle_update', (data) => {
        opponentPaddle.x = data.position;
    });

    // Skor güncelleme
    socket.on('score_update', (data) => {
        console.log('Skor güncelleme alındı:', data);
        
        if (data.winner === 1) {
            player1Score++;
            console.log('Player 1 skor kazandı:', player1Score);
        } else if (data.winner === 2) {
            player2Score++;
            console.log('Player 2 skor kazandı:', player2Score);
        }
        
        // Ses efektini çal
        playSound(scoreSound);
        
        console.log('Güncel skorlar:', { player1Score, player2Score, winner: data.winner });
    });
};

// Ses butonu
soundBtn.onclick = () => {
    isSoundEnabled = !isSoundEnabled;
    soundBtn.textContent = `Ses: ${isSoundEnabled ? 'Açık' : 'Kapalı'}`;
};

// Oyunu başlat
resetBall();
update(); 