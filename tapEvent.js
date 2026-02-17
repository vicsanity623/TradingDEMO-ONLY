(function () {
    const CONFIG = {
        frameWidth: 480,
        frameHeight: 690,
        totalFrames: 10,
        baseSpeed: 0.1,
        drag: 0.94,
        acceleration: 0.6,
        maxVelocity: 2.0,
        comboDecay: 2000,
        particleCount: 5,
        gravity: 0.6,
        maxFX: 100 // Hard cap on active FX objects for performance
    };

    let state = {
        gold: 0,
        level: 0,
        xp: 0,
        xpToNext: 1000,
        combo: 0,
        maxCombo: 0,
        comboTimer: null,
        currentFrame: 0,
        velocity: 0,
        intensity: 0,
        pulsePhase: 0,
        timeLeft: 25,
        timerInterval: null,
        active: false,
        fxObjects: [] // Combined pool for all canvas effects
    };

    // --- RECYCLABLE OBJECT POOLS ---
    const POOLS = {
        particles: [],
        text: []
    };

    const COLORS = ['#fff', '#00e5ff', '#ff0055', '#ffeb3b'];

    window.TapEvent = {
        init: function () {
            this.dom = {
                overlay: document.getElementById('tap-event-overlay'),
                sprite: document.getElementById('tap-action-sprite'),
                wrapper: document.querySelector('.tap-sprite-wrapper'),
                container: document.getElementById('tap-game-container'),
                canvas: document.getElementById('tap-fx-canvas'),
                timer: document.getElementById('tap-timer-display'),
                ui: {
                    gold: document.getElementById('tap-gold-display'),
                    level: document.getElementById('tap-level-display'),
                    xpFill: document.getElementById('tap-xp-fill'),
                    comboContainer: document.getElementById('tap-combo-container'),
                    comboCount: document.getElementById('tap-combo-count'),
                    comboLabel: document.getElementById('tap-combo-label')
                }
            };

            if (this.dom.canvas) {
                this.ctx = this.dom.canvas.getContext('2d');
                this.handleResize();
                window.addEventListener('resize', () => this.handleResize());
            }

            if (this.dom.sprite) {
                this.dom.sprite.style.width = `${CONFIG.frameWidth}px`;
                this.dom.sprite.style.height = `${CONFIG.frameHeight}px`;
                const sheetWidth = CONFIG.frameWidth * CONFIG.totalFrames;
                this.dom.sprite.style.backgroundSize = `${sheetWidth}px ${CONFIG.frameHeight}px`;

                this.dom.sprite.addEventListener('mousedown', (e) => this.handleTap(e));
                this.dom.sprite.addEventListener('touchstart', (e) => this.handleTap(e), { passive: false });
            }
        },

        handleResize: function () {
            if (this.dom.canvas) {
                this.dom.canvas.width = window.innerWidth;
                this.dom.canvas.height = window.innerHeight;
            }
        },

        start: function () {
            state.gold = 0;
            state.level = 0;
            state.xp = 0;
            state.xpToNext = 1000;
            state.combo = 0;
            state.maxCombo = 0;
            state.velocity = 0;
            state.intensity = 0;
            state.timeLeft = 25;
            state.active = true;
            state.fxObjects = [];

            this.updateUI();
            this.dom.overlay.style.display = 'flex';

            state.timerInterval = setInterval(() => {
                state.timeLeft--;
                if (this.dom.timer) this.dom.timer.innerText = state.timeLeft + "s";
                if (state.timeLeft <= 0) {
                    this.end();
                }
            }, 1000);

            this.gameLoop();
        },

        end: function () {
            state.active = false;
            clearInterval(state.timerInterval);
            if (window.applyTapRewards) {
                window.applyTapRewards({ gold: state.gold, levels: state.level });
            }
            this.dom.overlay.style.display = 'none';
        },

        handleTap: function (e) {
            if (!state.active) return;
            if (e.cancelable && e.type === 'touchstart') e.preventDefault();

            state.velocity += CONFIG.acceleration;
            if (state.velocity > CONFIG.maxVelocity) state.velocity = CONFIG.maxVelocity;

            this.processRewards();

            const x = e.clientX || (e.touches && e.touches[0].clientX);
            const y = e.clientY || (e.touches && e.touches[0].clientY);
            this.triggerTapFX(x, y);
        },

        gameLoop: function () {
            if (!state.active) return;

            // 1. Logic Updates
            let targetIntensity = Math.min(state.combo, 100) / 100;
            state.intensity += (targetIntensity - state.intensity) * 0.09;
            state.velocity *= CONFIG.drag;
            if (state.velocity < 0.01) state.velocity = 0;

            state.currentFrame += (CONFIG.baseSpeed + state.velocity + (state.intensity * 0.1));
            if (state.currentFrame >= CONFIG.totalFrames) state.currentFrame = 0;

            // 2. DOM Updates (Batched/Throttled by RAF)
            const frameIndex = Math.floor(state.currentFrame);
            this.dom.sprite.style.backgroundPosition = `${-(frameIndex * CONFIG.frameWidth)}px 0px`;
            this.applyProceduralAnimation();

            // 3. Canvas Rendering
            this.renderFX();

            requestAnimationFrame(() => this.gameLoop());
        },

        renderFX: function () {
            const ctx = this.ctx;
            if (!ctx) return;

            ctx.clearRect(0, 0, this.dom.canvas.width, this.dom.canvas.height);

            // Update & Draw FX objects
            for (let i = state.fxObjects.length - 1; i >= 0; i--) {
                const fx = state.fxObjects[i];
                fx.life -= fx.decay;

                if (fx.life <= 0) {
                    state.fxObjects.splice(i, 1);
                    continue;
                }

                if (fx.type === 'particle') {
                    fx.vy += CONFIG.gravity;
                    fx.x += fx.vx;
                    fx.y += fx.vy;
                    ctx.globalAlpha = fx.life;
                    ctx.fillStyle = fx.color;
                    ctx.beginPath();
                    ctx.arc(fx.x, fx.y, fx.size * fx.life, 0, Math.PI * 2);
                    ctx.fill();
                } else if (fx.type === 'text') {
                    fx.y -= 2;
                    fx.x += fx.drift;
                    ctx.globalAlpha = fx.life;
                    ctx.fillStyle = fx.color;
                    ctx.font = `bold ${fx.size}px Bangers`;
                    ctx.textAlign = 'center';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = fx.isCrit ? 'red' : 'black';
                    ctx.fillText(fx.text, fx.x, fx.y);
                    ctx.shadowBlur = 0;
                } else if (fx.type === 'heart') {
                    fx.y -= 3;
                    fx.x += Math.sin(fx.life * 10) * 2;
                    ctx.globalAlpha = fx.life;
                    ctx.font = `${fx.size}px serif`;
                    ctx.fillText("💖", fx.x, fx.y);
                }
            }
            ctx.globalAlpha = 1.0;
        },

        applyProceduralAnimation: function () {
            state.pulsePhase += (0.1 + (state.intensity * 0.2));
            const scaleWave = Math.sin(state.pulsePhase) * (0.02 + (state.intensity * 0.08));
            const finalScale = (0.9 + (state.intensity * 0.09)) + scaleWave;

            let shakeX = 0, shakeY = 0, rotation = 0;
            if (state.intensity > 0.1) {
                const pwr = state.intensity * 5;
                shakeX = (Math.random() - 0.5) * pwr;
                shakeY = (Math.random() - 0.5) * pwr;
                rotation = (Math.random() - 0.5) * pwr;
            }

            this.dom.wrapper.style.transform = `translate(${shakeX}px, ${shakeY}px) rotate(${rotation}deg) scale(${finalScale})`;
            this.dom.wrapper.style.filter = `brightness(${1 + (state.intensity * 0.5) + (Math.sin(state.pulsePhase) * 0.2)})`;
        },

        processRewards: function () {
            state.combo++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            clearTimeout(state.comboTimer);

            this.dom.ui.comboContainer.classList.remove('hidden');
            this.dom.ui.comboCount.innerText = state.combo;

            if (state.combo < 10) this.dom.ui.comboLabel.innerText = "COMBO";
            else if (state.combo < 30) this.dom.ui.comboLabel.innerText = "SUPER!";
            else if (state.combo < 50) {
                this.dom.ui.comboLabel.innerText = "HYPER!!";
                this.dom.ui.comboLabel.style.color = "#00e5ff";
            } else {
                this.dom.ui.comboLabel.innerText = "ULTIMATE!!!";
                this.dom.ui.comboLabel.style.color = "#ff0055";
            }

            state.comboTimer = setTimeout(() => {
                state.combo = 0;
                this.dom.ui.comboContainer.classList.add('hidden');
            }, CONFIG.comboDecay);

            state.gold += Math.floor(1 + (state.combo * 0.5));
            state.xp += 10 + Math.floor(state.combo / 5);
            if (state.xp >= state.xpToNext) this.levelUp();
            this.updateUI();
        },

        levelUp: function () {
            state.level++;
            state.xp = 0;
            state.xpToNext = Math.floor(state.xpToNext * 1.5);
            // Level up text is rare so DOM is fine, or we can use Canvas.
            // Let's use Canvas to be consistent and fully optimized.
            this.addFX('text', window.innerWidth / 2, window.innerHeight / 2, {
                text: "LEVEL UP!", size: 60, color: '#00e5ff', isCrit: true, decay: 0.01
            });
        },

        updateUI: function () {
            this.dom.ui.gold.innerText = state.gold.toLocaleString();
            this.dom.ui.level.innerText = state.level;
            this.dom.ui.xpFill.style.width = `${(state.xp / state.xpToNext) * 100}%`;
        },

        triggerTapFX: function (x, y) {
            // Spawn particles
            const count = CONFIG.particleCount + Math.floor(state.intensity * 3);
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const velocity = 4 + Math.random() * 8;
                this.addFX('particle', x, y, {
                    vx: Math.cos(angle) * velocity,
                    vy: Math.sin(angle) * velocity,
                    size: 4 + Math.random() * 6,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    decay: 0.02 + Math.random() * 0.02
                });
            }

            // Spawn floating text
            const isCrit = Math.random() > 0.9 || state.combo % 10 === 0;
            const val = Math.floor(1 + (state.combo * 0.5));
            this.addFX('text', x, y - 40, {
                text: isCrit ? `CRIT! +${val * 2}` : `+${val}`,
                size: isCrit ? 48 : 32,
                color: isCrit ? '#ffeb3b' : '#fff',
                isCrit: isCrit,
                decay: 0.02,
                drift: (Math.random() - 0.5) * 4
            });

            if (state.combo >= 15) {
                this.addFX('heart', x + (Math.random() - 0.5) * 40, y, {
                    size: 20 + Math.random() * 20,
                    decay: 0.015
                });
            }

            if (state.combo > 20 || Math.random() > 0.4) this.triggerScreenShake();
        },

        addFX: function (type, x, y, extra) {
            if (state.fxObjects.length > CONFIG.maxFX) return;
            state.fxObjects.push({
                type, x, y,
                life: 1.0,
                ...extra
            });
        },

        triggerScreenShake: function () {
            if (this.shakeTimer) return;
            this.dom.container.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px)`;
            this.shakeTimer = setTimeout(() => {
                this.dom.container.style.transform = 'none';
                this.shakeTimer = null;
            }, 50);
        }
    };
})();
