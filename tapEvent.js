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
        particleCount: 3,
        gravity: 0.8
    };

    let state = {
        gold: 0,
        level: 0, // This is level GAINED during event
        xp: 0,
        xpToNext: 100,
        combo: 0,
        maxCombo: 0,
        comboTimer: null,
        currentFrame: 0,
        velocity: 0,
        intensity: 0,
        pulsePhase: 0,
        timeLeft: 60,
        timerInterval: null,
        active: false
    };

    window.TapEvent = {
        init: function () {
            this.dom = {
                overlay: document.getElementById('tap-event-overlay'),
                sprite: document.getElementById('tap-action-sprite'),
                wrapper: document.querySelector('.tap-sprite-wrapper'),
                container: document.getElementById('tap-game-container'),
                fxLayer: document.getElementById('tap-fx-layer'),
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

            if (this.dom.sprite) {
                this.dom.sprite.style.width = `${CONFIG.frameWidth}px`;
                this.dom.sprite.style.height = `${CONFIG.frameHeight}px`;
                const sheetWidth = CONFIG.frameWidth * CONFIG.totalFrames;
                this.dom.sprite.style.backgroundSize = `${sheetWidth}px ${CONFIG.frameHeight}px`;
                this.dom.wrapper.style.transform = "scale(0.5)";

                this.dom.sprite.addEventListener('mousedown', (e) => this.handleTap(e));
                this.dom.sprite.addEventListener('touchstart', (e) => this.handleTap(e), { passive: false });
            }
        },

        start: function () {
            state.gold = 0;
            state.level = 0;
            state.xp = 0;
            state.xpToNext = 100;
            state.combo = 0;
            state.maxCombo = 0;
            state.velocity = 0;
            state.intensity = 0;
            state.timeLeft = 60;
            state.active = true;

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

            // Show result modal
            const results = {
                gold: state.gold,
                levels: state.level
            };

            // Apply rewards to player
            if (window.applyTapRewards) {
                window.applyTapRewards(results);
            }

            this.dom.overlay.style.display = 'none';
        },

        handleTap: function (e) {
            if (!state.active) return;
            if (e.cancelable && e.type === 'touchstart') e.preventDefault();

            state.velocity += CONFIG.acceleration;
            if (state.velocity > CONFIG.maxVelocity) state.velocity = CONFIG.maxVelocity;

            this.processRewards();

            let x = e.clientX || (e.touches && e.touches[0].clientX);
            let y = e.clientY || (e.touches && e.touches[0].clientY);
            this.triggerTapFX(x, y);
        },

        gameLoop: function () {
            if (!state.active) return;

            let targetIntensity = Math.min(state.combo, 100) / 100;
            state.intensity += (targetIntensity - state.intensity) * 0.09;

            state.velocity *= CONFIG.drag;
            if (state.velocity < 0.01) state.velocity = 0;

            let effectiveSpeed = CONFIG.baseSpeed + state.velocity + (state.intensity * 0.1);
            state.currentFrame += effectiveSpeed;
            if (state.currentFrame >= CONFIG.totalFrames) state.currentFrame = 0;

            let frameIndex = Math.floor(state.currentFrame);
            let posX = -(frameIndex * CONFIG.frameWidth);
            this.dom.sprite.style.backgroundPosition = `${posX}px 0px`;

            this.applyProceduralAnimation();

            requestAnimationFrame(() => this.gameLoop());
        },

        applyProceduralAnimation: function () {
            let pulseSpeed = 0.1 + (state.intensity * 0.2);
            state.pulsePhase += pulseSpeed;

            let scaleWave = Math.sin(state.pulsePhase) * (0.02 + (state.intensity * 0.08));
            let baseScale = 0.9 + (state.intensity * 0.09);
            let finalScale = baseScale + scaleWave;

            let shakeX = 0, shakeY = 0, rotation = 0;
            if (state.intensity > 0.1) {
                let shakePower = state.intensity * 5;
                shakeX = (Math.random() - 0.5) * shakePower;
                shakeY = (Math.random() - 0.5) * shakePower;
                rotation = (Math.random() - 0.5) * (state.intensity * 5);
            }

            this.dom.wrapper.style.transform =
                `translate(${shakeX}px, ${shakeY}px) ` +
                `rotate(${rotation}deg) ` +
                `scale(${finalScale})`;

            let brightness = 1 + (state.intensity * 0.5) + (Math.sin(state.pulsePhase) * 0.2);
            this.dom.wrapper.style.filter = `brightness(${brightness})`;
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
            }
            else {
                this.dom.ui.comboLabel.innerText = "ULTIMATE!!!";
                this.dom.ui.comboLabel.style.color = "#ff0055";
            }

            state.comboTimer = setTimeout(() => {
                state.combo = 0;
                this.dom.ui.comboContainer.classList.add('hidden');
            }, CONFIG.comboDecay);

            let addedGold = Math.floor(1 + (state.combo * 0.5));
            state.gold += addedGold;

            state.xp += 10 + Math.floor(state.combo / 5);
            if (state.xp >= state.xpToNext) this.levelUp();

            this.updateUI();
        },

        levelUp: function () {
            state.level++;
            state.xp = 0;
            state.xpToNext = Math.floor(state.xpToNext * 1.5);

            const banner = document.createElement('div');
            banner.innerText = "LEVEL UP!";
            banner.className = 'tap-level-banner';
            this.dom.fxLayer.appendChild(banner);
            setTimeout(() => banner.remove(), 2000);
        },

        updateUI: function () {
            this.dom.ui.gold.innerText = state.gold.toLocaleString();
            this.dom.ui.level.innerText = state.level;
            let xpPct = (state.xp / state.xpToNext) * 100;
            this.dom.ui.xpFill.style.width = `${xpPct}%`;
        },

        triggerTapFX: function (x, y) {
            this.spawnFloatingText(x, y);
            this.spawnParticles(x, y);
            if (state.combo >= 15) this.spawnHeart(x, y);
            if (state.combo > 20 || Math.random() > 0.4) this.triggerScreenShake();
        },

        spawnParticles: function (x, y) {
            const colors = ['#fff', '#00e5ff', '#ff0055', '#ffeb3b'];
            let count = CONFIG.particleCount + Math.floor(state.intensity * 2);

            for (let i = 0; i < count; i++) {
                const p = document.createElement('div');
                const angle = Math.random() * Math.PI * 2;
                const velocity = 5 + Math.random() * 10;
                const size = 5 + Math.random() * 8;

                p.style.position = 'absolute';
                p.style.left = x + 'px';
                p.style.top = y + 'px';
                p.style.width = size + 'px';
                p.style.height = size + 'px';
                p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                p.style.borderRadius = '50%';
                p.style.pointerEvents = 'none';
                p.style.zIndex = 1000;

                this.dom.fxLayer.appendChild(p);

                let velX = Math.cos(angle) * velocity;
                let velY = Math.sin(angle) * velocity;
                let opacity = 1;

                const animateParticle = () => {
                    velY += CONFIG.gravity;
                    velX *= 0.95;
                    const curX = parseFloat(p.style.left);
                    const curY = parseFloat(p.style.top);
                    p.style.left = (curX + velX) + 'px';
                    p.style.top = (curY + velY) + 'px';
                    opacity -= 0.03;
                    p.style.opacity = opacity;
                    p.style.transform = `scale(${opacity})`;
                    if (opacity > 0) requestAnimationFrame(animateParticle);
                    else p.remove();
                };
                requestAnimationFrame(animateParticle);
            }
        },

        spawnHeart: function (x, y) {
            const heart = document.createElement('div');
            heart.innerText = "💖";
            heart.className = 'tap-heart-fx';
            heart.style.left = (x - 20 + Math.random() * 40) + 'px';
            heart.style.top = y + 'px';
            heart.style.fontSize = (20 + Math.random() * 30) + 'px';
            this.dom.fxLayer.appendChild(heart);
            setTimeout(() => {
                heart.style.transform = `translateY(-150px) scale(1.5) rotate(${Math.random() * 40 - 20}deg)`;
                heart.style.opacity = 0;
            }, 10);
            setTimeout(() => heart.remove(), 1000);
        },

        spawnFloatingText: function (x, y) {
            const el = document.createElement('div');
            let isCrit = Math.random() > 0.9 || state.combo % 10 === 0;
            let val = Math.floor(1 + (state.combo * 0.5));
            el.innerText = isCrit ? `CRIT! +${val * 2}` : `+${val}`;
            el.className = 'tap-float-text';
            el.style.left = x + 'px';
            el.style.top = (y - 50) + 'px';
            el.style.fontSize = isCrit ? '3rem' : '2rem';
            el.style.color = isCrit ? '#ffeb3b' : '#fff';
            el.style.textShadow = isCrit ? '0px 0px 20px red' : '2px 2px 0 #000';
            let drift = (Math.random() - 0.5) * 60;
            el.style.transform = `translateX(${drift}px)`;
            this.dom.fxLayer.appendChild(el);
            setTimeout(() => el.remove(), 800);
        },

        triggerScreenShake: function () {
            this.dom.container.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px)`;
            setTimeout(() => { this.dom.container.style.transform = 'none'; }, 50);
        }
    };
})();
