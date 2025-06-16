// --- Minesweeper Game Config ---
let BOARD_SIZE = 10;
let MINE_COUNT = 15;

// --- State ---
let board = [];
let revealed = [];
let flagged = [];
let gameOver = false;
let timer = 0;
let timerInterval = null;
let flagsLeft = MINE_COUNT;
let moveCount = 0;
let muted = false;
let sounds = {};
let currentHoverColor = '#546e7a';
let boardConfig = {
    easy: { size: 8, mines: 10 },
    medium: { size: 10, mines: 15 },
    hard: { size: 14, mines: 32 }
};

const boardElem = document.getElementById('board');
const flagCountElem = document.getElementById('flag-count');
const moveCountElem = document.getElementById('move-count');
const messageElem = document.getElementById('message');
const timerElem = document.getElementById('time');
const restartBtn = document.getElementById('restart');
const muteBtn = document.getElementById('mute');
const difficultyElem = document.getElementById('difficulty');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const customizeBtn = document.getElementById('customize-btn');

function createParticles(button) {
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'color-particle';
        const size = Math.random() * 8 + 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        button.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
    }
}

function getRandomAccentColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 20 + 70); // 70-90%
    const lightness = Math.floor(Math.random() * 15 + 45);  // 45-60%
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    
    const btn = document.getElementById('customize-btn');
    document.documentElement.style.setProperty('--hover-color', color);
    btn.classList.add('changing-color');
    createParticles(btn);
    
    setTimeout(() => {
        btn.classList.remove('changing-color');
    }, 800);
    
    return color;
}

customizeBtn.addEventListener('click', () => {
    getRandomAccentColor();
});

// --- Utility Functions ---
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function inBounds(x, y) {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function adjacentCells(x, y) {
    const cells = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (inBounds(nx, ny)) cells.push([nx, ny]);
        }
    }
    return cells;
}

// --- Game Logic ---
function generateBoard() {
    // Place mines
    const cells = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            cells.push([x, y]);
        }
    }
    shuffle(cells);
    const mines = new Set(cells.slice(0, MINE_COUNT).map(([x, y]) => `${x},${y}`));

    // Build board
    board = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
        board[x] = [];
        for (let y = 0; y < BOARD_SIZE; y++) {
            board[x][y] = {
                mine: mines.has(`${x},${y}`),
                adjacent: 0
            };
        }
    }
    // Calculate adjacent mine counts
    for (let x = 0; x < BOARD_SIZE; x++) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            if (board[x][y].mine) continue;
            let count = 0;
            for (const [nx, ny] of adjacentCells(x, y)) {
                if (board[nx][ny].mine) count++;
            }
            board[x][y].adjacent = count;
        }
    }
}

function resetGame() {
    generateBoard();
    revealed = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
    flagged = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));
    gameOver = false;
    timer = 0;
    moveCount = 0;
    flagsLeft = MINE_COUNT;
    flagCountElem.textContent = flagsLeft;
    timerElem.textContent = timer;
    moveCountElem.textContent = moveCount;
    messageElem.textContent = '';
    messageElem.classList.remove('show');
    clearInterval(timerInterval);
    hideModal();
    renderBoard();
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer++;
        timerElem.textContent = timer;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function revealCell(x, y) {
    if (gameOver || revealed[x][y] || flagged[x][y]) return;
    revealed[x][y] = true;
    moveCount++;
    moveCountElem.textContent = moveCount;
    const cellElem = document.getElementById(`cell-${x}-${y}`);
    cellElem.classList.add('revealed');
    playSound('reveal');
    if (board[x][y].mine) {
        cellElem.classList.add('mine');
        cellElem.innerHTML = '💣';
        gameOver = true;
        showAllMines();
        showMessage('Game Over! 💥', false);
        playSound('lose');
        stopTimer();
        setTimeout(() => showModal(false), 600);
        return;
    }
    if (board[x][y].adjacent > 0) {
        cellElem.setAttribute('data-adjacent', board[x][y].adjacent);
        cellElem.innerHTML = `<span>${board[x][y].adjacent}</span>`;
    } else {
        cellElem.innerHTML = '';
        // Reveal adjacent cells recursively
        for (const [nx, ny] of adjacentCells(x, y)) {
            if (!revealed[nx][ny]) revealCell(nx, ny);
        }
    }
    checkWin();
}

function flagCell(x, y) {
    if (gameOver || revealed[x][y]) return;
    const cellElem = document.getElementById(`cell-${x}-${y}`);
    if (flagged[x][y]) {
        flagged[x][y] = false;
        cellElem.classList.remove('flagged');
        cellElem.innerHTML = '';
        flagsLeft++;
    } else {
        if (flagsLeft === 0) return;
        flagged[x][y] = true;
        cellElem.classList.add('flagged');
        cellElem.innerHTML = '🚩';
        flagsLeft--;
        playSound('flag');
    }
    flagCountElem.textContent = flagsLeft;
    checkWin();
}

function showAllMines() {
    for (let x = 0; x < BOARD_SIZE; x++) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            if (board[x][y].mine) {
                const cellElem = document.getElementById(`cell-${x}-${y}`);
                cellElem.classList.add('mine', 'revealed');
                cellElem.innerHTML = '💣';
            }
        }
    }
}

function checkWin() {
    let cellsToReveal = 0;
    for (let x = 0; x < BOARD_SIZE; x++) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            if (!board[x][y].mine && !revealed[x][y]) cellsToReveal++;
        }
    }
    if (cellsToReveal === 0 && !gameOver) {
        gameOver = true;
        showMessage('You Win! 🎉', true);
        playSound('win');
        stopTimer();
        setTimeout(() => showModal(true), 600);
    }
}

function showMessage(msg, win) {
    messageElem.textContent = msg;
    messageElem.classList.add('show');
    messageElem.style.background = win ? '#43a047' : '#d32f2f';
}

function renderBoard() {
    boardElem.innerHTML = '';
    boardElem.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, ${BOARD_SIZE > 10 ? 28 : 36}px)`;
    boardElem.style.gridTemplateRows = `repeat(${BOARD_SIZE}, ${BOARD_SIZE > 10 ? 28 : 36}px)`;
    for (let x = 0; x < BOARD_SIZE; x++) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${x}-${y}`;
            cell.addEventListener('click', (e) => {
                if (gameOver) return;
                if (timer === 0 && !revealed[x][y]) startTimer();
                revealCell(x, y);
            });
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (gameOver) return;
                if (timer === 0 && !revealed[x][y]) startTimer();
                flagCell(x, y);
            });
            cell.addEventListener('mouseenter', () => highlightAdjacents(x, y, true));
            cell.addEventListener('mouseleave', () => highlightAdjacents(x, y, false));
            boardElem.appendChild(cell);
        }
    }
}
function highlightAdjacents(x, y, on) {
    // Highlight center cell more prominently
    const centerCell = document.getElementById(`cell-${x}-${y}`);
    if (centerCell && !centerCell.classList.contains('revealed')) {
        if (on) {
            centerCell.style.zIndex = '4';  // Keep center cell on top
        } else {
            centerCell.style.zIndex = '';
        }
    }

    // Highlight adjacent cells with a slight delay for a wave effect
    adjacentCells(x, y).forEach(([nx, ny], index) => {
        const adj = document.getElementById(`cell-${nx}-${ny}`);
        if (adj && !adj.classList.contains('revealed')) {
            setTimeout(() => {
                if (on) {
                    adj.classList.add('adjacent-hover');
                    adj.style.zIndex = '3';  // Keep hovered cells above others
                } else {
                    adj.classList.remove('adjacent-hover');
                    adj.style.zIndex = '';
                }
            }, index * 30);  // Stagger the effect
        }
    });
}

// --- Event Listeners ---
restartBtn.addEventListener('click', resetGame);
muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
    // Stop all currently playing sounds when muted
    if (muted) {
        Object.values(sounds).forEach(sound => {
            try {
                sound.pause();
                sound.currentTime = 0;
            } catch (e) {}
        });
    }
});
difficultyElem.addEventListener('change', (e) => setDifficulty(e.target.value));
modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
document.getElementById('custom-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const size = parseInt(document.getElementById('custom-size').value);
    const mines = parseInt(document.getElementById('custom-mines').value);
    const theme = document.getElementById('theme-select').value;
    const hoverColor = document.getElementById('hover-color').value;
    
    if (size >= 6 && size <= 20 && mines >= 5 && mines <= 99) {
        BOARD_SIZE = size;
        MINE_COUNT = mines;
        document.body.className = `theme-${theme}`;
        setHoverColor(hoverColor);
        resetGame();
        document.getElementById('custom-modal').classList.remove('show');
    }
});

// --- Sound System ---
let soundsLoaded = false;
const soundUrls = {
    reveal: 'sounds/click.wav',
    flag: 'sounds/flag.wav',
    win: 'sounds/win.wav',
    lose: 'sounds/lose.wav'
};

async function loadSounds() {
    try {
        const loadPromises = Object.entries(soundUrls).map(([name, url]) => {
            return new Promise((resolve, reject) => {
                const audio = new Audio();
                audio.addEventListener('canplaythrough', () => {
                    console.log(`Sound ${name} loaded successfully`);
                    sounds[name] = audio;
                    resolve();
                }, { once: true });
                audio.addEventListener('error', (e) => {
                    console.error(`Failed to load sound ${name} from ${url}:`, e);
                    reject(e);
                }, { once: true });
                audio.src = url;
                audio.preload = 'auto';
                audio.load();
            });
        });

        await Promise.all(loadPromises);
        soundsLoaded = true;
        console.log('All sounds loaded successfully');
    } catch (error) {
        console.error('Some sounds failed to load:', error);
        // Create fallback audio context for basic sounds
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const createBasicSound = () => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                return { oscillator, gainNode };
            };
            
            sounds = {
                reveal: () => {
                    const { oscillator, gainNode } = createBasicSound();
                    const ctx = audioContext;
                    const now = ctx.currentTime;
                    
                    // Create a softer, more pleasant click
                    oscillator.type = 'sine';  // Use sine wave for softer sound
                    gainNode.gain.setValueAtTime(0.08, now); // Lower initial volume
                    
                    // Gentle frequency sweep for a pleasant pop
                    oscillator.frequency.setValueAtTime(800, now);
                    oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.05);
                    
                    // Smooth volume envelope
                    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.02);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                    
                    oscillator.start(now);
                    oscillator.stop(now + 0.05);
                },
                flag: () => {
                    const { oscillator, gainNode } = createBasicSound();
                    const ctx = audioContext;
                    const now = ctx.currentTime;
                    
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(600, now);
                    oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                    
                    gainNode.gain.setValueAtTime(0.08, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    
                    oscillator.start(now);
                    oscillator.stop(now + 0.1);
                },
                win: () => {
                    const { oscillator, gainNode } = createBasicSound();
                    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                    oscillator.start();
                    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
                    oscillator.stop(audioContext.currentTime + 0.3);
                },
                lose: () => {
                    const { oscillator, gainNode } = createBasicSound();
                    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                    oscillator.start();
                    oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.2);
                    oscillator.stop(audioContext.currentTime + 0.4);
                }
            };
            soundsLoaded = true;
            console.log('Fallback sounds initialized');
        } catch (e) {
            console.error('Failed to initialize fallback sounds:', e);
        }
    }
}

function playSound(name) {
    if (muted || !soundsLoaded) return;
    
    try {
        if (typeof sounds[name] === 'function') {
            // Use fallback sound
            sounds[name]();
        } else {
            // Use audio file
            const sound = sounds[name].cloneNode();
            sound.volume = 0.3;
            const playPromise = sound.play();
            
            if (playPromise) {
                playPromise.catch(error => {
                    console.error(`Error playing sound ${name}:`, error);
                    // Try to enable sound on next interaction
                    const enableSound = () => {
                        sound.play().catch(() => {});
                        document.removeEventListener('click', enableSound);
                    };
                    document.addEventListener('click', enableSound, { once: true });
                });
            }
        }
    } catch (error) {
        console.error(`Error playing sound ${name}:`, error);
    }
}

// Initialize sound system
loadSounds().catch(console.error);

// Enable sounds on first interaction
document.addEventListener('click', function initSound() {
    if (!soundsLoaded) {
        loadSounds().catch(console.error);
    }
    document.removeEventListener('click', initSound);
}, { once: true });

// --- Difficulty ---
function setDifficulty(level) {
    BOARD_SIZE = boardConfig[level].size;
    MINE_COUNT = boardConfig[level].mines;
    document.documentElement.style.setProperty('--board-size', BOARD_SIZE);
    document.documentElement.style.setProperty('--cell-size', BOARD_SIZE > 10 ? '28px' : '36px');
    resetGame();
}

// --- Modals ---
function showModal(win) {
    modalContent.innerHTML = `
        <h2>${win ? 'You Win! 🎉' : 'Game Over! 💥'}</h2>
        <p>Time: <b>${timer}</b> seconds</p>
        <p>Moves: <b>${moveCount}</b></p>
        <button onclick="document.getElementById('modal').classList.remove('show')">Close</button>
    `;
    modal.classList.add('show');
}

function hideModal() {
    modal.classList.remove('show');
}

// --- Start Game ---
setDifficulty('medium');
