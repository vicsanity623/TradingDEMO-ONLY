// Wrap in IIFE to protect scope
(function () {

    // --- UTILS ---
    function clearBattleTimers() {
        if (!window.battle) return;
        if (window.battle.pInterval) clearInterval(window.battle.pInterval);
        if (window.battle.eInterval) clearInterval(window.battle.eInterval);
        if (window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
        if (window.battle.stageTimerId) clearInterval(window.battle.stageTimerId);

        window.battle.pInterval = null;
        window.battle.eInterval = null;
        window.battle.autoTimerId = null;
        window.battle.stageTimerId = null;
    }

    function toRoman(num) {
        const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
        let str = '';
        for (let i of Object.keys(roman)) {
            let q = Math.floor(num / roman[i]);
            num -= q * roman[i];
            str += i.repeat(q);
        }
        return str;
    }

    // --- DBZ VISUAL HELPERS ---
    function triggerShake(intensity = 'normal') {
        const arena = document.querySelector('.arena');
        if (arena) {
            arena.classList.remove('shake-screen');
            void arena.offsetWidth;
            arena.style.animationDuration = intensity === 'heavy' ? '0.2s' : '0.3s';
            arena.classList.add('shake-screen');
        }
    }

    function shiftBackground(direction) {
        const viewBattle = document.getElementById('view-battle');
        if (viewBattle) {
            let currentPos = viewBattle.style.backgroundPositionX || '50%';
            let currentVal = parseInt(currentPos) || 50;
            let shift = direction === 'left' ? -3 : 3;
            viewBattle.style.backgroundPositionX = (currentVal + shift) + '%';
        }
    }

    async function teleportVisual(container, targetX, targetY = 0) {
        const sprite = container.querySelector('img');
        return new Promise(resolve => {
            if (sprite) {
                sprite.classList.add('teleport-flash');
                sprite.style.opacity = '0';
            }
            setTimeout(() => {
                container.style.transition = 'none';
                container.style.transform = `translate(${targetX}px, ${targetY}px)`;
                setTimeout(() => {
                    if (sprite) {
                        sprite.style.opacity = '1';
                        sprite.classList.remove('teleport-flash');
                    }
                    resolve();
                }, 80);
            }, 100);
        });
    }

    // --- THANOS SNAP EFFECT (Particle Explosion) ---
    // Added 'reverse' parameter to handle reformation
    function explodeSprite(element, direction, reverse = false) {
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';

        document.body.appendChild(canvas);

        const drawX = rect.left;
        const drawY = rect.top;

        const particles = [];
        const density = 4;

        // Try to get pixel data for particle effect
        try {
            // Draw image to canvas to read pixel data
            ctx.drawImage(element, drawX, drawY, rect.width, rect.height);
            const imgData = ctx.getImageData(drawX, drawY, rect.width, rect.height);
            const data = imgData.data;
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear original image from canvas

            for (let y = 0; y < rect.height; y += density) {
                for (let x = 0; x < rect.width; x += density) {
                    const i = (y * rect.width + x) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    if (a > 128) {
                        particles.push({
                            originX: drawX + x,
                            originY: drawY + y,
                            x: reverse ? (drawX + x + (Math.random() - 0.5) * 100) : (drawX + x),
                            y: reverse ? (drawY + y - 50 - Math.random() * 50) : (drawY + y),
                            color: `rgba(${r},${g},${b},${a / 255})`,
                            vx: reverse ? 0 : ((Math.random() - 0.5) * 4 + (direction === 'left' ? -4 : 4)),
                            vy: reverse ? 0 : ((Math.random() - 0.5) * 4 - 1),
                            life: reverse ? 0 : 1.0,
                            targetLife: 1.0
                        });
                    }
                }
            }
        } catch (e) {
            canvas.remove();
            return;
        }

        if (!reverse) element.style.opacity = '0'; // Hide real sprite immediately

        // Animate Loop
        let frame = 0;
        function loop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;

            for (let p of particles) {
                if (reverse) {
                    // Rewind: Move from scattered pos back to origin
                    const dx = p.originX - p.x;
                    const dy = p.originY - p.y;
                    p.x += dx * 0.1; // Ease in
                    p.y += dy * 0.1;
                    p.life += 0.02;
                    if (p.life > 1) p.life = 1;

                    // Draw
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life;
                    ctx.fillRect(p.x, p.y, density, density);

                    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) active = true;

                } else {
                    // Explode: Standard physics
                    if (p.life > 0) {
                        active = true;
                        p.x += p.vx;
                        p.y += p.vy;
                        p.life -= 0.015; // Decay

                        ctx.fillStyle = p.color;
                        ctx.globalAlpha = p.life;
                        ctx.fillRect(p.x, p.y, density, density);
                    }
                }
            }

            frame++;
            // Cutoff for reverse animation to ensure it finishes
            if (reverse && frame > 60) active = false;

            if (active) {
                requestAnimationFrame(loop);
            } else {
                if (reverse) element.style.opacity = '1'; // Show real sprite again
                canvas.remove();
            }
        }
        loop();
    }

    // --- ZENKAI REVIVE LOGIC ---
    function triggerZenkaiRevive() {
        // 1. Pause Logic
        window.battle.cinematic = true; // Stops damage loops
        window.battle.zenkaiUsed = true;

        const pBox = document.getElementById('p-box');
        const pSprite = document.getElementById('btl-p-sprite');

        // 2. Explode (Die)
        if (window.popDamage) window.popDamage("FATAL DMG!", 'p-box', true);
        explodeSprite(pSprite, 'left', false); // Normal explosion

        // 3. Wait 1.5s, then Reform
        setTimeout(() => {
            if (!window.battle.active) return; // If exited

            if (window.popDamage) window.popDamage("ZENKAI BOOST!", 'p-box', true);
            triggerShake('heavy');

            // Reverse Explosion (Reform)
            explodeSprite(pSprite, 'left', true);

            // 4. Restore Stats
            window.player.hp = Math.floor(window.GameState.gokuMaxHP * 0.5); // 50% HP Revive
            updateBars();

            // 5. Resume Battle after animation
            setTimeout(() => {
                window.battle.cinematic = false;
                // Add a small invulnerability shield visual or effect if desired
            }, 1000);

        }, 1500);
    }

    // --- BOSS UI ---
    function ensureBattleUI() {
        const battleScreen = document.getElementById('view-battle');
        if (!document.getElementById('boss-ui-container')) {
            const container = document.createElement('div');
            container.id = 'boss-ui-container';
            container.style.position = 'absolute';
            container.style.top = '60px';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.zIndex = '50';
            container.style.pointerEvents = 'none';
            container.style.fontFamily = "'Orbitron', sans-serif";

            const stageInfo = document.createElement('div');
            stageInfo.id = 'boss-ui-stage-info';
            stageInfo.style.textAlign = 'center';
            stageInfo.style.marginBottom = '5px';
            stageInfo.style.color = '#ff3e3e';
            stageInfo.style.fontSize = '1.2rem';
            stageInfo.style.fontWeight = 'bold';
            stageInfo.style.textShadow = '1px 1px 0 #000';
            stageInfo.innerText = "Stage 1 - World I";

            const hpContainer = document.createElement('div');
            hpContainer.style.width = '90%';
            hpContainer.style.margin = '0 auto';
            hpContainer.style.height = '25px';
            hpContainer.style.background = '#333';
            hpContainer.style.border = '2px solid white';
            hpContainer.style.position = 'relative';

            const hpFill = document.createElement('div');
            hpFill.id = 'boss-ui-hp-fill';
            hpFill.style.width = '100%';
            hpFill.style.height = '100%';
            hpFill.style.background = '#ff0000';
            hpFill.style.transition = 'width 0.2s';

            const hpText = document.createElement('div');
            hpText.id = 'boss-ui-hp-text';
            hpText.style.position = 'absolute';
            hpText.style.top = '0';
            hpText.style.left = '0';
            hpText.style.width = '100%';
            hpText.style.height = '100%';
            hpText.style.display = 'flex';
            hpText.style.alignItems = 'center';
            hpText.style.justifyContent = 'center';
            hpText.style.color = 'white';
            hpText.style.fontSize = '14px';
            hpText.style.fontWeight = 'bold';
            hpText.style.textShadow = '1px 1px 2px black';
            hpText.innerText = "0/0";

            const hpLabel = document.createElement('div');
            hpLabel.style.position = 'absolute';
            hpLabel.style.right = '5px';
            hpLabel.style.top = '0';
            hpLabel.style.color = 'red';
            hpLabel.style.fontWeight = 'bold';
            hpLabel.style.fontSize = '18px';
            hpLabel.innerText = "HP";

            const timeContainer = document.createElement('div');
            timeContainer.style.width = '84%';
            timeContainer.style.margin = '5px auto 0';
            timeContainer.style.height = '8px';
            timeContainer.style.background = 'rgba(255,255,255,0.2)';

            const timeFill = document.createElement('div');
            timeFill.id = 'boss-ui-time-fill';
            timeFill.style.width = '100%';
            timeFill.style.height = '100%';
            timeFill.style.background = 'white';

            const timeText = document.createElement('div');
            timeText.id = 'boss-ui-time-text';
            timeText.style.position = 'absolute';
            timeText.style.right = '5px';
            timeText.style.top = '55px';
            timeText.style.color = 'white';
            timeText.style.fontSize = '14px';
            timeText.innerText = "60s";

            hpContainer.appendChild(hpFill);
            hpContainer.appendChild(hpText);
            hpContainer.appendChild(hpLabel);
            timeContainer.appendChild(timeFill);

            container.appendChild(stageInfo);
            container.appendChild(hpContainer);
            container.appendChild(timeContainer);
            container.appendChild(timeText);

            battleScreen.appendChild(container);
        }
    }

    // --- STAGE SELECTION ---

    function openStageDetails(stageNum) {
        window.battle.selectedStage = stageNum;

        const modal = document.getElementById('stage-details-modal');
        if (!modal) return;

        const scale = Math.pow(1.8, stageNum) * Math.pow(25, window.battle.world - 1);
        const estHp = Math.floor(250 * scale);
        const estAtk = Math.floor(250 * scale);
        const recPower = Math.floor((estAtk * 15) + estHp);

        const xp = 100 * stageNum * window.battle.world;
        const coins = 250;
        let drops = "Common";
        if (stageNum % 5 === 0) drops = "High";
        if (stageNum === 20) drops = "LEGENDARY";

        if ((window.battle.world === 1 && stageNum >= 15) || window.battle.world > 1) {
            drops += " + 💎";
        }

        let imgUrl = "";
        let name = "Enemy";

        if (window.apiData && window.apiData.characters) {
            if (stageNum === 20) {
                let bossName = "Frieza";
                const wMod = window.battle.world % 3;
                if (wMod === 2) bossName = "Cell";
                if (wMod === 0) bossName = "Majin";
                let charData = window.apiData.characters.find(c => c.name.includes(bossName));
                if (!charData) charData = window.apiData.characters[(window.battle.world * 5) % window.apiData.characters.length];

                imgUrl = charData ? charData.image : "";
                name = "BOSS " + (charData ? charData.name : "Titan");
            } else {
                const charIdx = (stageNum + (window.battle.world * 3)) % window.apiData.characters.length;
                let dat = window.apiData.characters[charIdx];
                if (dat) {
                    imgUrl = dat.image;
                    name = dat.name;
                }
            }
        }

        document.getElementById('sd-num').innerText = stageNum;
        document.getElementById('sd-enemy-img').src = imgUrl;
        document.getElementById('sd-enemy-name').innerText = name;
        document.getElementById('sd-power').innerText = window.formatNumber ? window.formatNumber(recPower) : recPower;
        document.getElementById('sd-xp').innerText = xp;
        document.getElementById('sd-coins').innerText = coins;
        document.getElementById('sd-drops').innerText = drops;

        const aura = document.querySelector('.enemy-aura');
        if (aura) {
            aura.style.background = (stageNum === 20)
                ? "radial-gradient(circle, rgba(255,0,0,0.8), transparent 70%)"
                : "radial-gradient(circle, rgba(0,255,255,0.6), transparent 70%)";
        }

        modal.style.display = 'flex';
    }

    function closeStageDetails() {
        const modal = document.getElementById('stage-details-modal');
        if (modal) modal.style.display = 'none';
    }

    function confirmStart() {
        closeStageDetails();
        if (window.battle.selectedStage) {
            window.battle.stage = window.battle.selectedStage;
            document.getElementById('battle-menu').style.display = 'none';
            clearBattleTimers();
            startBattle();
            buildStageSelector();
        }
    }

    // --- CORE BATTLE FUNCTIONS ---

    function buildStageSelector() {
        const container = document.getElementById('ui-stage-selector');
        if (!container || !window.battle) return;

        container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        for (let i = 1; i <= 20; i++) {
            const dot = document.createElement('div');
            dot.className = 'stage-dot';
            if (i > window.battle.maxStage) dot.classList.add('locked');
            if (i === window.battle.stage) dot.classList.add('active');
            if (i === 20) dot.style.borderColor = "red";

            dot.innerText = i;
            dot.onclick = () => {
                if (i <= window.battle.maxStage) {
                    openStageDetails(i);
                }
            };
            fragment.appendChild(dot);
        }
        container.appendChild(fragment);
    }

    function stopCombat() {
        if (window.battle) {
            window.battle.active = false;
        }
        if (window.GameState) window.GameState.inBattle = false;

        const bossUI = document.getElementById('boss-ui-container');
        if (bossUI) bossUI.style.display = 'none';

        clearBattleTimers();
    }

    function exitBattle() {
        stopCombat();
        const menu = document.getElementById('battle-menu');
        if (menu) menu.style.display = 'none';
        if (typeof window.showTab === 'function') window.showTab('char');
    }

    function autoStartNext() {
        const menu = document.getElementById('battle-menu');
        if (menu) menu.style.display = 'none';
        clearBattleTimers();

        if (window.battle.stage === window.battle.maxStage && window.battle.maxStage < 20) {
            window.battle.maxStage++;
            window.battle.stage++;
        } else if (window.battle.stage === 20) {
            window.battle.stage = 1;
            window.battle.world++;
            window.battle.maxStage = 1;
        } else if (window.battle.stage < window.battle.maxStage) {
            window.battle.stage++;
        }

        startBattle();
    }

    function restartGame() {
        stopCombat();
        if (window.GameState) {
            window.player.hp = window.GameState.gokuMaxHP;
        } else {
            const maxHp = window.player.bHp + (window.player.rank * 2500) + (window.player.gear.a?.val || 0);
            window.player.hp = maxHp;
        }
        window.player.charge = 0;
        window.battle.stage = 1;
        document.getElementById('battle-menu').style.display = 'none';
        startBattle();
    }

    async function startBattle() {
        stopCombat();
        ensureBattleUI();

        const adv = window.AdvanceSystem ? window.AdvanceSystem.getBonuses(window.player.advanceLevel || 0) : null;

        window.battle.active = true;
        window.battle.cinematic = false;
        window.battle.zenkaiUsed = false; // Reset Zenkai Flag
        if (window.GameState) window.GameState.inBattle = true;

        document.getElementById('start-prompt').style.display = 'none';
        document.getElementById('battle-menu').style.display = 'none';

        const bossUI = document.getElementById('boss-ui-container');
        if (bossUI) {
            bossUI.style.display = 'block';
            const infoEl = document.getElementById('boss-ui-stage-info');
            if (infoEl) {
                infoEl.innerText = `Stage ${window.battle.stage} - World ${toRoman(window.battle.world)}`;
            }
        }

        const eImg = document.getElementById('e-img');
        const pSprite = document.getElementById('btl-p-sprite');

        if (eImg) { eImg.style.display = 'block'; eImg.classList.remove('dead-anim'); eImg.style.opacity = '1'; eImg.style.transform = 'none'; }
        if (pSprite) { pSprite.classList.remove('dead-anim'); pSprite.style.opacity = '1'; pSprite.style.transform = 'none'; }

        // --- BATTLE TIMER LOGIC ---
        window.battle.timeLeft = 60;
        const timeFill = document.getElementById('boss-ui-time-fill');
        const timeText = document.getElementById('boss-ui-time-text');
        if (timeFill) timeFill.style.width = '100%';
        if (timeText) timeText.innerText = '60s';

        window.battle.stageTimerId = setInterval(() => {
            if (!window.battle.active) return;
            window.battle.timeLeft--;

            if (timeFill) timeFill.style.width = (window.battle.timeLeft / 60 * 100) + '%';
            if (timeText) timeText.innerText = window.battle.timeLeft + 's';

            if (window.battle.timeLeft <= 0) {
                stopCombat();
                handleDefeat();
            }
        }, 1000);

        window.player.charge = (adv && adv.startKi) ? adv.startKi : 0;
        const pBox = document.getElementById('p-box');
        const eBox = document.getElementById('e-box');
        if (pBox) pBox.style.transform = 'translate(0,0)';
        if (eBox) eBox.style.transform = 'translate(0,0)';

        const log = document.getElementById('log');
        if (log) log.innerHTML = `Stage ${window.battle.stage}: Finding opponent...`;

        buildStageSelector();

        const viewBattle = document.getElementById('view-battle');
        if (window.apiData && window.apiData.planets && window.apiData.planets.length > 0 && viewBattle) {
            const pIdx = (window.battle.world - 1) % window.apiData.planets.length;
            viewBattle.style.backgroundImage = `url('${window.apiData.planets[pIdx].image}')`;
            viewBattle.style.backgroundPositionX = '50%';
        }

        spawnPersistentEnemy();
        updateBars();

        const banner = document.getElementById('ready-msg');
        if (banner) {
            banner.style.display = "block";
            if (window.battle.stage === 20) {
                banner.innerText = "BOSS BATTLE";
                banner.style.color = "red";
            } else {
                banner.innerText = "READY?";
                banner.style.color = "var(--dbz-yellow)";
            }

            await new Promise(r => setTimeout(r, 1000));
            if (!window.battle.active) { banner.style.display = 'none'; return; }
            banner.innerText = "FIGHT!";
            await new Promise(r => setTimeout(r, 600));
            banner.style.display = "none";
        }

        if (log) log.innerHTML = `<div style="color:white">Battle Started!</div>`;

        window.battle.pInterval = setInterval(() => {
            if (!window.battle.active || window.battle.cinematic) return;
            if (window.Skills) window.Skills.autoBattleTick(window.battle);
            if (window.player.charge >= 100) executeSpecial();
            else executeStrike('p');
        }, 600);

        window.battle.eInterval = setInterval(() => {
            if (!window.battle.active || window.battle.cinematic) return;
            executeStrike('e');
        }, 900);
    }

    function spawnPersistentEnemy() {
        const scale = Math.pow(1.8, window.battle.stage) * Math.pow(25, window.battle.world - 1);

        const eHP = 250 * scale;
        const eATK = 30 * scale;
        const eDEF = eHP * 0.4;

        if (!window.apiData || !window.apiData.characters || window.apiData.characters.length === 0) {
            window.battle.enemy = { name: "Loading...", hp: 100, maxHp: 100, atk: 10, def: 5, i: "" };
            return;
        }

        if (window.battle.stage === 20) {
            window.battle.bossPhase = 1;
            let bossName = "Frieza";
            const wMod = window.battle.world % 3;
            if (wMod === 2) bossName = "Cell";
            if (wMod === 0) bossName = "Majin";

            let charData = window.apiData.characters.find(c => c.name.includes(bossName));
            if (!charData) charData = window.apiData.characters[(window.battle.world * 5) % window.apiData.characters.length];

            let imgSrc = charData ? charData.image : "";

            window.battle.enemy = {
                name: "BOSS " + (charData ? charData.name : "Titan"),
                hp: 2000 * scale,
                maxHp: 2000 * scale,
                atk: 80 * scale,
                def: (2000 * scale) * 0.35,
                i: imgSrc
            };

            const eImg = document.getElementById('e-img');
            if (eImg) {
                eImg.crossOrigin = "anonymous";
                eImg.src = imgSrc;
            }

            const eName = document.getElementById('e-name');
            if (eName) {
                eName.innerText = "⚠ " + window.battle.enemy.name + " ⚠";
                eName.style.color = "#ff0000";
                eName.style.textShadow = "0 0 5px red";
            }
        }
        else {
            window.battle.bossPhase = 0;
            const charIdx = (window.battle.stage + (window.battle.world * 3)) % window.apiData.characters.length;
            let dat = window.apiData.characters[charIdx] || { name: "Guardian", image: "" };

            window.battle.enemy = {
                name: dat.name,
                hp: eHP,
                maxHp: eHP,
                atk: eATK,
                def: eDEF,
                i: dat.image
            };

            const eImg = document.getElementById('e-img');
            if (eImg) {
                eImg.crossOrigin = "anonymous";
                eImg.src = dat.image;
            }

            const eName = document.getElementById('e-name');
            if (eName) {
                eName.innerText = window.battle.enemy.name;
                eName.style.color = "white";
                eName.style.textShadow = "1px 1px black";
            }
        }
    }

    async function transformBoss() {
        window.battle.cinematic = true;
        const eImg = document.getElementById('e-img');
        if (eImg) {
            eImg.style.transition = "transform 1s, filter 1s";
            eImg.style.transform = "scale(0.1) rotate(360deg)";
        }
        if (window.popDamage) window.popDamage("FINAL FORM!", 'e-box', true);
        triggerShake('heavy');
        await new Promise(r => setTimeout(r, 1000));

        window.battle.bossPhase = 2;
        window.battle.enemy.maxHp = window.battle.enemy.maxHp * 1.5;
        window.battle.enemy.hp = window.battle.enemy.maxHp;
        window.battle.enemy.atk = window.battle.enemy.atk * 1.5;
        window.battle.enemy.def = window.battle.enemy.def * 1.5;

        if (eImg) {
            eImg.style.transform = "scale(1.4)";
            eImg.style.filter = "sepia(1) saturate(5) hue-rotate(-50deg) drop-shadow(0 0 20px red)";
        }
        const eName = document.getElementById('e-name');
        if (eName) eName.innerText = "MAX POWER " + window.battle.enemy.name;

        updateBars();
        window.battle.cinematic = false;
    }

    // --- DAMAGE MITIGATION LOGIC ---
    function applyDamage(rawDmg, sourceSide) {
        if (!window.battle.active) return;

        const target = (sourceSide === 'p') ? window.battle.enemy : window.player;
        const targetId = (sourceSide === 'p') ? 'e-box' : 'p-box';

        let defense = 0;
        if (sourceSide === 'p') defense = window.battle.enemy.def || 1;
        else defense = window.GameState ? window.GameState.gokuDefense : 10;

        const defConst = 5000 * Math.pow(1.5, window.battle.world);
        const reduction = defense / (defense + defConst);

        let actualDmg = Math.floor(rawDmg * (1 - reduction));
        if (actualDmg < rawDmg * 0.05) actualDmg = Math.floor(rawDmg * 0.05);
        if (actualDmg < 1) actualDmg = 1;

        target.hp -= actualDmg;

        if (window.popDamage) window.popDamage(actualDmg, targetId);
        updateBars();

        if (window.battle.enemy.hp <= 0) {
            if (window.battle.stage === 20 && window.battle.bossPhase === 1) {
                window.battle.enemy.hp = 1;
                transformBoss();
                return;
            }
            // --- VICTORY SEQUENCE ---
            stopCombat();
            const eImg = document.getElementById('e-img');
            if (eImg) {
                explodeSprite(eImg, 'right');
            }
            setTimeout(handleWin, 2500);

        } else if (window.player.hp <= 0) {
            // --- ZENKAI CHECK (Revive) ---
            const adv = window.AdvanceSystem ? window.AdvanceSystem.getBonuses(window.player.advanceLevel || 0) : null;
            if (adv && adv.zenkai && !window.battle.zenkaiUsed) {
                triggerZenkaiRevive(); // Call new function
                return;
            }
            // --- DEFEAT SEQUENCE ---
            stopCombat();
            const pSprite = document.getElementById('btl-p-sprite');
            if (pSprite) {
                explodeSprite(pSprite, 'left');
            }
            setTimeout(handleDefeat, 2500);
        }
    }

    async function executeStrike(side) {
        if (!window.battle.active) return;
        const isP = (side === 'p');
        const adv = window.AdvanceSystem ? window.AdvanceSystem.getBonuses(window.player.advanceLevel || 0) : null;

        if (!isP) {
            let dodgeChance = adv ? (adv.evasion / 100) : 0;
            if (Math.random() < dodgeChance) {
                if (window.popDamage) window.popDamage("MISS!", 'p-box');
                const pSprite = document.getElementById('btl-p-sprite');
                if (pSprite) {
                    pSprite.style.opacity = '0.5';
                    pSprite.style.transform = 'translateX(-20px)';
                    setTimeout(() => { pSprite.style.opacity = '1'; pSprite.style.transform = 'translateX(0)' }, 200);
                }
                return;
            }
        }

        let threshold = 0.8;
        if (isP) {
            let critChance = 0.1 + (window.player.rank * 0.05);
            if (adv) critChance += (adv.critChance / 100);
            threshold = 1.0 - critChance;
        }

        const isAmbush = Math.random() > threshold;
        const attackerBox = document.getElementById(isP ? 'p-box' : 'e-box');
        const victimImg = isP ? document.getElementById('e-img') : document.getElementById('btl-p-sprite');
        let atkVal = isP ? (window.GameState ? window.GameState.gokuPower : 10) : window.battle.enemy.atk;

        if (isP) {
            if (adv && adv.rageMode && (window.player.hp / window.GameState.gokuMaxHP) < 0.2) {
                atkVal *= 2;
                if (window.popDamage && Math.random() > 0.7) window.popDamage("RAGE!", 'p-box');
            }
            if (adv && adv.bossSlayer > 0 && window.battle.stage === 20) {
                atkVal *= (1 + (adv.bossSlayer / 100));
            }
            const soulLvl = window.player.soulLevel || 1;
            const chargeBonus = Math.floor(soulLvl * 0.5);
            window.player.charge += (12 + chargeBonus);
            if (window.player.charge > 100) window.player.charge = 100;
        }

        const dmg = Math.floor(atkVal * (0.7 + Math.random() * 0.6));

        const performHit = async (isDouble = false) => {
            if (!window.battle.active) return;

            if (isAmbush && !isDouble) {
                await teleportVisual(attackerBox, isP ? 80 : -80);
                if (!window.battle.active) return;
                triggerShake();
                if (victimImg) {
                    victimImg.classList.add(isP ? 'knockback-right' : 'knockback-left');
                    setTimeout(() => victimImg.classList.remove('knockback-right', 'knockback-left'), 200);
                }
                if (window.popDamage) window.popDamage("CRIT!", isP ? 'e-box' : 'p-box');
                applyDamage(Math.floor(dmg * 1.5), side);
                setTimeout(() => { if (window.battle.active) teleportVisual(attackerBox, 0); }, 250);
            } else {
                attackerBox.style.transition = "transform 0.1s cubic-bezier(0.1, 0.7, 1.0, 0.1)";
                attackerBox.style.transform = isP ? 'translateX(60px)' : 'translateX(-60px)';
                setTimeout(() => {
                    if (!window.battle.active) return;
                    if (Math.random() > 0.5) triggerShake();
                    if (victimImg) {
                        victimImg.style.transition = "transform 0.1s";
                        victimImg.style.transform = isP ? 'translateX(10px)' : 'translateX(-10px)';
                        setTimeout(() => victimImg.style.transform = 'translateX(0)', 100);
                    }
                    applyDamage(dmg, side);
                    setTimeout(() => {
                        if (window.battle.active) {
                            attackerBox.style.transition = "transform 0.2s ease-out";
                            attackerBox.style.transform = 'translateX(0)';
                        }
                    }, 100);
                }, 100);
            }
        };

        await performHit();

        if (isP && adv && adv.doubleStrike > 0) {
            let doubleChance = adv.doubleStrike / 100;
            if (Math.random() < doubleChance) {
                setTimeout(() => {
                    if (window.popDamage) window.popDamage("DOUBLE!", 'p-box');
                    performHit(true);
                }, 300);
            }
        }
    }

    async function executeSpecial() {
        if (!window.battle.active || window.battle.cinematic) return;
        window.battle.cinematic = true;
        window.player.charge = 0;
        updateBars();

        const cutInWrap = document.getElementById('cutin-overlay');
        const cutInImg = document.getElementById('cutin-img');
        if (cutInImg) cutInImg.src = (window.player.rank >= 1) ? 'charged_s.png' : 'charged_b.png';
        if (cutInWrap) cutInWrap.style.display = 'flex';

        await new Promise(r => setTimeout(r, 450));
        const beam = document.getElementById('fx-beam');
        if (beam) {
            beam.style.opacity = '1';
            beam.style.width = '200%';
            triggerShake('heavy');
        }
        await new Promise(r => setTimeout(r, 200));
        if (cutInWrap) cutInWrap.style.display = 'none';

        if (!window.battle.active) { window.battle.cinematic = false; return; }

        const soulLvl = window.player.soulLevel || 1;
        const power = window.GameState ? window.GameState.gokuPower : 100;
        const soulBonus = 1 + (soulLvl * 0.1);
        const dmg = Math.floor(power * 6 * soulBonus);

        if (window.popDamage) window.popDamage("ULTIMATE!", 'e-box', true);
        const eImg = document.getElementById('e-img');
        if (eImg) eImg.classList.add('knockback-right');

        applyDamage(dmg, 'p');

        setTimeout(() => {
            if (beam) {
                beam.style.transition = "opacity 0.2s ease-out";
                beam.style.opacity = '0';
                setTimeout(() => {
                    beam.style.transition = "none";
                    beam.style.width = "0";
                    if (window.battle.active && window.battle.enemy.hp > 0 && eImg) {
                        eImg.classList.remove('knockback-right');
                    }
                    setTimeout(() => {
                        beam.style.transition = "width 0.2s cubic-bezier(0.1, 0.7, 1.0, 0.1), opacity 0.2s ease-in";
                    }, 50);
                    window.battle.cinematic = false;
                }, 200);
            } else {
                window.battle.cinematic = false;
            }
        }, 500);
    }

    function handleWin() {
        const adv = window.AdvanceSystem ? window.AdvanceSystem.getBonuses(window.player.advanceLevel || 0) : null;
        const menu = document.getElementById('battle-menu');
        if (menu && menu.style.display === 'flex') return;

        if (window.SoulSystem) window.SoulSystem.gainSoul();

        const tEl = document.getElementById('menu-title');
        if (tEl) {
            tEl.innerText = "STAGE CLEARED!";
            tEl.style.color = "var(--dbz-yellow)";
        }

        let startPct = (window.player.xp / window.player.nextXp) * 100;
        if (isNaN(startPct)) startPct = 0;
        let oldLvl = window.player.lvl;

        let xpGain = 100 * window.battle.stage * window.battle.world;
        let coinGain = 250;
        let bossSouls = 0;
        if (window.battle.stage === 20) {
            xpGain *= 5;
            coinGain *= 5;
            bossSouls = Math.floor(30 + Math.random() * 70);
            window.player.souls = (window.player.souls || 0) + bossSouls;
        }

        if (adv && adv.goldMult > 0) {
            coinGain *= (1 + (adv.goldMult / 100));
        }
        if (adv && adv.xpMult > 0) {
            xpGain *= (1 + (adv.xpMult / 100));
        }

        window.player.xp += xpGain;
        window.player.coins += coinGain;

        const log = document.getElementById('log');
        if (log) log.innerHTML = `<div style="color:cyan">> WON! +${window.formatNumber ? window.formatNumber(xpGain) : xpGain} XP</div>`;

        // --- DROP LOGIC ---
        let dropText = "";
        let dropCount = 0;
        const qty = Math.floor(Math.random() * 4);

        let dropRarity = Math.min(6, window.battle.world);
        if (window.battle.stage === 20 && dropRarity < 3) dropRarity = 3;

        let baseVal = 700;
        let baseName = "Saiyan Gear";

        if (dropRarity === 2) { baseVal = 1500; baseName = "Elite Gear"; }
        else if (dropRarity === 3) { baseVal = 3500; baseName = "Legendary Gear"; }
        else if (dropRarity === 4) { baseVal = 8500; baseName = "God Gear"; }
        else if (dropRarity === 5) { baseVal = 20000; baseName = "Angel Gear"; }
        else if (dropRarity === 6) { baseVal = 50000; baseName = "Omni Gear"; }

        for (let i = 0; i < qty; i++) {
            if (typeof window.addToInventory === 'function') {
                addToInventory({
                    n: baseName,
                    type: Math.random() > 0.5 ? 'w' : 'a',
                    val: baseVal,
                    rarity: dropRarity
                });
                dropCount++;
            }
        }

        let shardDrop = 0;
        if ((window.battle.world === 1 && window.battle.stage >= 15) || window.battle.world > 1) {
            if (Math.random() < 0.35) {
                shardDrop = 1;
                if (window.battle.stage === 20) shardDrop = Math.floor(Math.random() * 3) + 1;
            }
        }
        if (shardDrop > 0) window.player.dragonShards = (window.player.dragonShards || 0) + shardDrop;

        // Key Drop Logic
        let keyDrop = 0;
        if (Math.random() < 0.12) {
            keyDrop = Math.floor(Math.random() * 2) + 1;
            window.player.dungeonKeys = (window.player.dungeonKeys || 0) + keyDrop;
        }

        if (adv && adv.lifeSteal > 0) {
            const healMult = adv.lifeSteal / 100;
            const healAmt = window.GameState.gokuMaxHP * healMult;
            window.player.hp = Math.min(window.player.hp + healAmt, window.GameState.gokuMaxHP);
        }

        // --- CONSTRUCT REWARD HTML ---
        let dropsHtml = "";

        if (bossSouls > 0) {
            dropsHtml += `<div style="color:#00ffff; font-weight:bold;">+${bossSouls} SOULS</div>`;
        }

        if (shardDrop > 0) {
            dropsHtml += `<div style="color:#00d2ff; font-weight:bold;">💎 +${shardDrop} SHARD</div>`;
        }

        if (keyDrop > 0) {
            dropsHtml += `<div style="color:gold; font-weight:bold;">🗝️ +${keyDrop} KEYS</div>`;
        }

        if (dropCount > 0) {
            let rColor = "#fff";
            if (dropRarity === 2) rColor = "#00d2ff";
            if (dropRarity === 3) rColor = "#ff00ff";
            if (dropRarity >= 4) rColor = "#e74c3c";
            dropsHtml += `<div style="color:${rColor}">+${dropCount} ${baseName.toUpperCase()}</div>`;
        }

        if (dropsHtml === "") dropText = "NONE";
        else dropText = dropsHtml;

        if (typeof window.checkLevelUp === 'function') checkLevelUp();

        let leveledUp = (window.player.lvl > oldLvl);

        if (typeof window.syncUI === 'function') syncUI();
        if (window.Skills) Skills.autoBattleTick();

        document.getElementById('r-xp').innerText = window.formatNumber ? window.formatNumber(xpGain) : xpGain;
        document.getElementById('r-coins').innerText = window.formatNumber ? window.formatNumber(coinGain) : coinGain;
        document.getElementById('r-drops').innerHTML = dropText;
        document.getElementById('r-lvl').innerText = window.player.lvl;

        const xpTextEl = document.getElementById('r-xp-text');
        if (xpTextEl) {
            if (leveledUp) {
                xpTextEl.innerText = "LEVEL UP!";
                xpTextEl.style.color = "#00ff00";
                xpTextEl.style.textShadow = "0 0 5px #00ff00";
            } else {
                xpTextEl.innerText = `${window.formatNumber(window.player.xp)} / ${window.formatNumber(window.player.nextXp)}`;
                xpTextEl.style.color = "white";
                xpTextEl.style.textShadow = "none";
            }
        }

        if (menu) menu.style.display = 'flex';

        const rBar = document.getElementById('r-bar-xp');
        if (rBar) {
            let endPct = leveledUp ? 100 : (window.player.xp / window.player.nextXp) * 100;
            rBar.style.transition = 'none';
            rBar.style.width = startPct + "%";
            void rBar.offsetWidth;
            requestAnimationFrame(() => {
                rBar.style.transition = 'width 3s ease-out';
                rBar.style.width = endPct + "%";
            });
        }

        const btnNext = document.querySelector('#battle-menu .menu-btn:first-of-type');
        if (btnNext) {
            btnNext.onclick = () => {
                if (window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
                autoStartNext();
            };

            let time = 3;
            btnNext.innerText = `NEXT STAGE (${time})`;

            if (window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
            window.battle.autoTimerId = setInterval(() => {
                time--;
                btnNext.innerText = `NEXT STAGE (${time})`;
                if (time <= 0) {
                    clearBattleTimers();
                    autoStartNext();
                }
            }, 1000);
        }
    }

    function handleDefeat() {
        const menu = document.getElementById('battle-menu');
        if (menu && menu.style.display === 'flex') return;

        if (window.GameState) window.player.hp = window.GameState.gokuMaxHP;
        else {
            const maxHp = window.player.bHp + (window.player.rank * 2500) + (window.player.gear.a?.val || 0);
            window.player.hp = maxHp;
        }

        if (typeof window.syncUI === 'function') syncUI();

        const tEl = document.getElementById('menu-title');
        if (tEl) {
            tEl.innerText = "DEFEATED";
            tEl.style.color = "#c0392b";
        }

        document.getElementById('r-lvl').innerText = window.player.lvl;
        document.getElementById('r-xp-text').innerText = `${window.formatNumber(window.player.xp)} / ${window.formatNumber(window.player.nextXp)}`;
        const xpPct = Math.min(100, (window.player.xp / window.player.nextXp) * 100);
        document.getElementById('r-bar-xp').style.width = xpPct + "%";
        document.getElementById('r-xp').innerText = "0";
        document.getElementById('r-coins').innerText = "0";
        document.getElementById('r-drops').innerText = "NONE";

        const btnNext = document.querySelector('#battle-menu .menu-btn:first-of-type');
        if (btnNext) {
            btnNext.onclick = restartGame;
            let time = 5;
            btnNext.innerText = `RESTART (STAGE 1) (${time})`;

            if (menu) menu.style.display = 'flex';
            if (window.battle.autoTimerId) clearTimeout(window.battle.autoTimerId);
            window.battle.autoTimerId = setInterval(() => {
                time--;
                btnNext.innerText = `RESTART (STAGE 1) (${time})`;
                if (time <= 0) {
                    clearBattleTimers();
                    restartGame();
                }
            }, 1000);
        }
    }

    function updateBars() {
        let m = window.GameState ? window.GameState.gokuMaxHP : 100;
        const btlPHp = document.getElementById('btl-p-hp');
        const btlEHp = document.getElementById('btl-e-hp');
        const btlPCharge = document.getElementById('btl-p-charge');

        if (btlPHp) btlPHp.style.width = Math.max(0, (window.player.hp / m * 100)) + "%";
        if (btlEHp && window.battle.enemy) btlEHp.style.width = Math.max(0, (window.battle.enemy.hp / window.battle.enemy.maxHp * 100)) + "%";
        if (btlPCharge) btlPCharge.style.width = window.player.charge + "%";

        const bossBar = document.getElementById('boss-ui-hp-fill');
        const bossText = document.getElementById('boss-ui-hp-text');

        if (bossBar && window.battle.enemy) {
            const pct = Math.max(0, (window.battle.enemy.hp / window.battle.enemy.maxHp) * 100);
            bossBar.style.width = pct + "%";

            if (bossText) {
                let hpStr = window.formatNumber ? window.formatNumber(window.battle.enemy.hp) : Math.floor(window.battle.enemy.hp);
                let maxStr = window.formatNumber ? window.formatNumber(window.battle.enemy.maxHp) : Math.floor(window.battle.enemy.maxHp);
                bossText.innerText = `${hpStr} / ${maxStr}`;
            }
        }
    }

    // --- EXPOSE NECESSARY FUNCTIONS ---
    window.startBattle = startBattle;
    window.stopCombat = stopCombat;
    window.exitBattle = exitBattle;
    window.autoStartNext = autoStartNext;
    window.buildStageSelector = buildStageSelector;
    window.openStageDetails = openStageDetails;
    window.closeStageDetails = closeStageDetails;
    window.confirmStart = confirmStart;

})();
