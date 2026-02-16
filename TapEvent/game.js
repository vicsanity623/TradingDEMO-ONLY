/* =========================================
   TURBO TAP RPG - ENHANCED ENGINE
   ========================================= */

const CONFIG = {
    // ✅ CORRECTED DIMENSIONS
    frameWidth: 480,
    frameHeight: 690,
    totalFrames: 10,

    baseSpeed: 0.1,
    drag: 0.94,
    acceleration: 0.6,
    maxVelocity: 2.0,

    // JUICE SETTINGS
    comboDecay: 2000,
    particleCount: 3,
    gravity: 0.8
};

// --- GAME STATE ---
let state = {
    gold: 0,
    level: 1,
    xp: 0,
    xpToNext: 100,
    combo: 0,
    maxCombo: 0,
    comboTimer: null,
    currentFrame: 0,
    velocity: 0,
    intensity: 0,
    pulsePhase: 0
};

// --- DOM CACHE ---
const dom = {
    sprite: document.getElementById('action-sprite'),
    wrapper: document.querySelector('.sprite-wrapper'),
    container: document.getElementById('game-container'),
    fxLayer: document.getElementById('fx-layer'),
    ui: {
        gold: document.getElementById('gold-display'),
        level: document.getElementById('level-display'),
        xpFill: document.getElementById('xp-fill'),
        comboContainer: document.getElementById('combo-container'),
        comboCount: document.getElementById('combo-count'),
        comboLabel: document.getElementById('combo-label')
    }
};

/* =========================================
   INITIALIZATION (FIXED)
   ========================================= */

// 1. Set the display size of ONE frame
dom.sprite.style.width = `${CONFIG.frameWidth}px`;
dom.sprite.style.height = `${CONFIG.frameHeight}px`;

// 2. FORCE the background image to match our math
//    Total Width = Frame Width * Number of Frames
//    This ensures scaling works even if the PNG is a different resolution
const sheetWidth = CONFIG.frameWidth * CONFIG.totalFrames;
dom.sprite.style.backgroundSize = `${sheetWidth}px ${CONFIG.frameHeight}px`;

// 3. Scale down the wrapper to fit mobile screens
//    480x690 is huge, so we shrink the container visually without breaking the sprite math
dom.wrapper.style.transform = "scale(0.5)"; // Adjust this (0.5 to 0.8) to fit your screen
/* =========================================
   CORE INPUT & LOOP
   ========================================= */

function handleTap(e) {
    if (e.cancelable && e.type === 'touchstart') e.preventDefault();

    // 1. Physics Boost
    state.velocity += CONFIG.acceleration;
    if (state.velocity > CONFIG.maxVelocity) state.velocity = CONFIG.maxVelocity;

    // 2. Logic & Rewards
    processRewards();

    // 3. Get Coordinates
    let x = e.clientX;
    let y = e.clientY;

    // Mobile Touch Fix
    if (e.type === 'touchstart') {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    }

    // 4. Trigger Visuals (The Juice)
    triggerTapFX(x, y);
}

// The Main Game Loop (60 FPS)
function gameLoop() {
    // 1. Calculate Intensity (0.0 = Chill, 1.0 = Chaos)
    // Intensity caps at Combo 50
    let targetIntensity = Math.min(state.combo, 100) / 100;
    // Smoothly lerp intensity
    state.intensity += (targetIntensity - state.intensity) * 0.09;

    // 2. Apply Physics
    state.velocity *= CONFIG.drag;
    if (state.velocity < 0.01) state.velocity = 0;

    // 3. Animation Frames
    let effectiveSpeed = CONFIG.baseSpeed + state.velocity + (state.intensity * 0.1);
    state.currentFrame += effectiveSpeed;
    if (state.currentFrame >= CONFIG.totalFrames) state.currentFrame = 0;

    // 4. Render Sprite Sheet
    let frameIndex = Math.floor(state.currentFrame);
    let posX = -(frameIndex * CONFIG.frameWidth);
    dom.sprite.style.backgroundPosition = `${posX}px 0px`;

    // 5. Render "The Throb" & Jiggle
    applyProceduralAnimation();

    requestAnimationFrame(gameLoop);
}

/* =========================================
   VISUALS & PROCEDURAL ANIMATION
   ========================================= */

function applyProceduralAnimation() {
    // A. Rhythmic Pulse (Heartbeat)
    // Speed of pulse increases with intensity
    let pulseSpeed = 0.1 + (state.intensity * 0.2);
    state.pulsePhase += pulseSpeed;

    // Sine wave for smooth scaling
    let scaleWave = Math.sin(state.pulsePhase) * (0.02 + (state.intensity * 0.08));
    let baseScale = 0.9 + (state.intensity * 0.09); // Grows bigger with combo

    let finalScale = baseScale + scaleWave;

    // B. Random Jitter (Shaking)
    // Only shakes if intensity is high
    let shakeX = 0;
    let shakeY = 0;
    let rotation = 0;

    if (state.intensity > 0.1) {
        let shakePower = state.intensity * 5; // Max 10px shake
        shakeX = (Math.random() - 0.5) * shakePower;
        shakeY = (Math.random() - 0.5) * shakePower;
        rotation = (Math.random() - 0.5) * (state.intensity * 5);
    }

    // Apply Transform
    dom.wrapper.style.transform =
        `translate(${shakeX}px, ${shakeY}px) ` +
        `rotate(${rotation}deg) ` +
        `scale(${finalScale})`;

    // C. Filter Effects (Glow)
    // Brightness fluctuates with pulse
    let brightness = 1 + (state.intensity * 0.5) + (Math.sin(state.pulsePhase) * 0.2);
    dom.wrapper.style.filter = `brightness(${brightness})`;
}

function triggerTapFX(x, y) {
    // 1. Floating Damage Text
    spawnFloatingText(x, y);

    // 2. Particle Explosion
    spawnParticles(x, y);

    // 3. Heart Flood (If combo is high)
    if (state.combo >= 15) {
        spawnHeart(x, y);
    }

    // 4. Screen Shake (On critical hits or high combo)
    if (state.combo > 20 || Math.random() > 0.4) {
        triggerScreenShake(state.intensity);
    }
}

/* =========================================
   PARTICLE ENGINE
   ========================================= */

function spawnParticles(x, y) {
    const colors = ['#fff', '#00e5ff', '#ff0055', '#ffeb3b'];

    // Scale particle count based on intensity
    let count = CONFIG.particleCount + Math.floor(state.intensity * 2);

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');

        // Random Physics
        const angle = Math.random() * Math.PI * 2;
        const velocity = 5 + Math.random() * 10;
        const size = 5 + Math.random() * 8;

        // CSS Setup
        p.style.position = 'absolute';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.borderRadius = '50%';
        p.style.pointerEvents = 'none';
        p.style.zIndex = 1000;

        dom.fxLayer.appendChild(p);

        // Animate
        let velX = Math.cos(angle) * velocity;
        let velY = Math.sin(angle) * velocity;
        let opacity = 1;

        const animateParticle = () => {
            velY += CONFIG.gravity; // Gravity
            velX *= 0.95; // Air resistance

            const curX = parseFloat(p.style.left);
            const curY = parseFloat(p.style.top);

            p.style.left = (curX + velX) + 'px';
            p.style.top = (curY + velY) + 'px';

            opacity -= 0.03;
            p.style.opacity = opacity;
            p.style.transform = `scale(${opacity})`;

            if (opacity > 0) {
                requestAnimationFrame(animateParticle);
            } else {
                p.remove();
            }
        };
        requestAnimationFrame(animateParticle);
    }
}

function spawnHeart(x, y) {
    const heart = document.createElement('div');
    heart.innerText = "💖";
    heart.style.position = 'absolute';
    heart.style.left = (x - 20 + Math.random() * 40) + 'px';
    heart.style.top = y + 'px';
    heart.style.fontSize = (20 + Math.random() * 30) + 'px';
    heart.style.pointerEvents = 'none';
    heart.style.zIndex = 1100;
    heart.style.transition = "all 1s ease-out";

    dom.fxLayer.appendChild(heart);

    // Float Up Animation
    setTimeout(() => {
        heart.style.transform = `translateY(-150px) scale(1.5) rotate(${Math.random() * 40 - 20}deg)`;
        heart.style.opacity = 0;
    }, 10);

    setTimeout(() => heart.remove(), 1000);
}

function spawnFloatingText(x, y) {
    const el = document.createElement('div');

    // Visual variety based on combo
    let isCrit = Math.random() > 0.9 || state.combo % 10 === 0;
    let val = Math.floor(1 + (state.combo * 0.5));

    el.innerText = isCrit ? `CRIT! +${val * 2}` : `+${val}`;
    el.className = 'float-text';

    // Style override via JS for randomness
    el.style.left = x + 'px';
    el.style.top = (y - 50) + 'px';
    el.style.fontSize = isCrit ? '3rem' : '2rem';
    el.style.color = isCrit ? '#ffeb3b' : '#fff';
    el.style.textShadow = isCrit ? '0px 0px 20px red' : '2px 2px 0 #000';
    el.style.zIndex = 1200;

    // Random Drift
    let drift = (Math.random() - 0.5) * 60;
    el.style.transform = `translateX(${drift}px)`;

    dom.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function triggerScreenShake(intensity) {
    dom.container.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px)`;
    setTimeout(() => {
        dom.container.style.transform = 'none';
    }, 50);
}

/* =========================================
   LOGIC & REWARDS
   ========================================= */

function processRewards() {
    // 1. Combo Logic
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    clearTimeout(state.comboTimer);

    dom.ui.comboContainer.classList.remove('hidden');
    dom.ui.comboCount.innerText = state.combo;

    // Changing labels based on combo tier
    if (state.combo < 10) dom.ui.comboLabel.innerText = "COMBO";
    else if (state.combo < 30) dom.ui.comboLabel.innerText = "SUPER!";
    else if (state.combo < 50) {
        dom.ui.comboLabel.innerText = "HYPER!!";
        dom.ui.comboLabel.style.color = "#00e5ff";
    }
    else {
        dom.ui.comboLabel.innerText = "ULTIMATE!!!";
        dom.ui.comboLabel.style.color = "#ff0055";
    }

    // Reset Timer
    state.comboTimer = setTimeout(() => {
        state.combo = 0;
        dom.ui.comboContainer.classList.add('hidden');
    }, CONFIG.comboDecay);

    // 2. Gold Calculation
    let addedGold = Math.floor(1 + (state.combo * 0.5));
    state.gold += addedGold;
    dom.ui.gold.innerText = state.gold.toLocaleString();

    // 3. XP Logic
    state.xp += 10 + Math.floor(state.combo / 5);
    if (state.xp >= state.xpToNext) levelUp();

    let xpPct = (state.xp / state.xpToNext) * 100;
    dom.ui.xpFill.style.width = `${xpPct}%`;
}

function levelUp() {
    state.level++;
    state.xp = 0;
    state.xpToNext = Math.floor(state.xpToNext * 1.5);
    dom.ui.level.innerText = state.level;

    // Big visual explosion
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            spawnParticles(window.innerWidth / 2, window.innerHeight / 2);
        }, i * 20);
    }

    const banner = document.createElement('div');
    banner.innerText = "LEVEL UP!";
    banner.style.position = 'absolute';
    banner.style.top = '40%';
    banner.style.left = '50%';
    banner.style.transform = 'translate(-50%, -50%) scale(0)';
    banner.style.fontSize = '5rem';
    banner.style.color = '#fff';
    banner.style.textShadow = '0 0 20px #00e5ff';
    banner.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    banner.style.zIndex = 2000;

    dom.fxLayer.appendChild(banner);

    requestAnimationFrame(() => banner.style.transform = 'translate(-50%, -50%) scale(1)');
    setTimeout(() => banner.remove(), 2000);
}

// --- INIT ---
dom.sprite.addEventListener('mousedown', handleTap);
dom.sprite.addEventListener('touchstart', handleTap, { passive: false });

// Start loop
gameLoop();
