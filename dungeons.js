// dungeons.js - Handles Dungeon Mode and Daily Logins

(function () {

    // --- CONFIGURATION ---
    const DUNGEON_CONFIG = {
        // Boss Definitions
        BOSSES: {
            buu: {
                name: "Majin Buu",
                img: "majin_buu.png", 
                baseHp: 100000000000, // 100B
                rewards: { shards: 50, coins: 100000 },
                color: "#ff79c6"
            },
            frieza: {
                name: "Frieza",
                img: "freeza.png",
                baseHp: 150000000000, // 150B
                rewards: { souls: 50, coins: 200000 },
                color: "#bd93f9"
            },
            cell: {
                name: "Cell",
                img: "cell.png",
                baseHp: 200000000000, // 200B
                rewards: { gearChance: true, coins: 300000 },
                color: "#50fa7b"
            }
        },
        // Daily Login Rewards
        DAILY_REWARDS: [
            { day: 1, keys: 5, coins: 100000, shards: 5 },
            { day: 2, keys: 5, coins: 250000, shards: 25, gear: { type: 'w', rarity: 3, count: 3 } },
            { day: 3, keys: 10, coins: 500000, shards: 50, gear: { type: 'a', rarity: 4, count: 6 } },
            { day: 4, keys: 10, coins: 750000, shards: 75 },
            { day: 5, keys: 15, coins: 1000000, souls: 10 },
            { day: 6, keys: 15, coins: 2500000, shards: 150 },
            { day: 7, keys: 30, coins: 5000000, souls: 100, gear: { type: 'w', rarity: 6, count: 1 } }
        ]
    };

    // --- STATE ---
    let activeBoss = null;
    let battleTimer = null;
    let timeLeft = 90;
    let exitTimer = null; 

    // Physics State
    let physicsFrame = null;
    const physics = {
        player: { x: 20, y: 50, vx: 0, vy: 0, el: null },
        boss: { x: 80, y: 50, vx: 0, vy: 0, el: null },
        magnet: 0.15, 
        friction: 0.94, 
        bounce: 2.0,   
        hitCooldown: 0
    };

    // --- DAILY LOGIN LOGIC ---
    window.checkDailyLogin = function () {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const lastClaim = window.player.dailyLogin.lastClaimTime || 0;
        if (now - lastClaim > oneDay || lastClaim === 0) {
            if (lastClaim !== 0 && now - lastClaim > (oneDay * 2)) {
                window.player.dailyLogin.day = 1;
            }
            openDailyLogin();
        }
    };

    function openDailyLogin() {
        const modal = document.getElementById('daily-login-modal');
        const grid = document.getElementById('daily-grid');
        if (!modal || !grid) return;
        grid.innerHTML = '';
        const currentDay = window.player.dailyLogin.day;
        DUNGEON_CONFIG.DAILY_REWARDS.forEach((reward, index) => {
            const dayNum = index + 1;
            const isToday = dayNum === currentDay;
            const isClaimed = dayNum < currentDay;
            const cell = document.createElement('div');
            cell.className = `daily-cell ${isToday ? 'today' : ''} ${isClaimed ? 'claimed' : ''}`;
            let content = `<div class="day-num">Day ${dayNum}</div>`;
            if (reward.keys) content += `<div>🗝️ x${reward.keys}</div>`;
            if (reward.coins) content += `<div>💰 ${window.formatNumber(reward.coins)}</div>`;
            if (reward.shards) content += `<div>💎 x${reward.shards}</div>`;
            if (reward.souls) content += `<div>👻 x${reward.souls}</div>`;
            if (reward.gear) content += `<div>🎒 Gear x${reward.gear.count}</div>`;
            if (isClaimed) content += `<div class="claimed-overlay">✔</div>`;
            cell.innerHTML = content;
            grid.appendChild(cell);
        });
        modal.style.display = 'flex';
    }

    window.claimDailyLogin = function () {
        const currentDay = window.player.dailyLogin.day;
        const reward = DUNGEON_CONFIG.DAILY_REWARDS[currentDay - 1] || DUNGEON_CONFIG.DAILY_REWARDS[0];
        if (reward.keys) window.player.dungeonKeys += reward.keys;
        if (reward.coins) window.player.coins += reward.coins;
        if (reward.shards) window.player.dragonShards += reward.shards;
        if (reward.souls) window.player.souls += reward.souls;
        if (reward.gear && window.addToInventory) {
            for (let i = 0; i < reward.gear.count; i++) {
                window.addToInventory({
                    n: "Daily Gear",
                    type: reward.gear.type,
                    val: 5000 * reward.gear.rarity,
                    rarity: reward.gear.rarity
                });
            }
        }
        window.player.dailyLogin.lastClaimTime = Date.now();
        window.player.dailyLogin.day++;
        if (window.player.dailyLogin.day > 7) window.player.dailyLogin.day = 1;
        window.isDirty = true;
        window.saveGame();
        document.getElementById('daily-login-modal').style.display = 'none';
        if (typeof window.initDungeons === 'function') window.initDungeons();
        window.customAlert("Daily Rewards Claimed!");
    };


    // --- VISUAL EFFECTS: THANOS SNAP ---
    function explodeSprite(element) {
        if (!element) return;

        const rect = element.getBoundingClientRect();
        
        // Create a temporary canvas for the effect
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

        // Try to draw the image to the canvas
        try {
            // Draw original image on canvas
            ctx.drawImage(element, drawX, drawY, rect.width, rect.height);
        } catch (e) {
            // Fallback if CORS prevents reading image data
            element.style.transition = "opacity 1s, transform 1s";
            element.style.opacity = "0";
            element.style.transform = "scale(2)";
            canvas.remove();
            return;
        }

        const particles = [];
        const density = 4; // Lower is more particles (heavier CPU)

        try {
            const imgData = ctx.getImageData(drawX, drawY, rect.width, rect.height);
            const data = imgData.data;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the image, we only want particles

            for (let y = 0; y < rect.height; y += density) {
                for (let x = 0; x < rect.width; x += density) {
                    const i = (y * rect.width + x) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    if (a > 128) { // Only create particles for visible pixels
                        particles.push({
                            x: drawX + x,
                            y: drawY + y,
                            color: `rgba(${r},${g},${b},${a / 255})`,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4 - 2, // Slight upward drift
                            life: 1.0 + Math.random() * 0.5
                        });
                    }
                }
            }
        } catch (e) {
            canvas.remove();
            return;
        }

        // Hide the real element immediately
        element.style.opacity = '0'; 

        // Animation Loop
        function loop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;

            for (let p of particles) {
                if (p.life > 0) {
                    active = true;
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= 0.02; // Fade speed

                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life;
                    ctx.fillRect(p.x, p.y, density, density);
                }
            }

            if (active) {
                requestAnimationFrame(loop);
            } else {
                canvas.remove();
            }
        }
        loop();
    }


    // --- DUNGEON SYSTEM ---

    window.initDungeons = function () {
        const list = document.getElementById('dungeon-list');
        const keyDisplay = document.getElementById('dungeon-keys-display');
        if (!list || !keyDisplay) return;

        keyDisplay.innerText = window.player.dungeonKeys || 0;
        list.innerHTML = '';

        Object.keys(DUNGEON_CONFIG.BOSSES).forEach(key => {
            const boss = DUNGEON_CONFIG.BOSSES[key];
            const lvl = window.player.dungeonLevel[key] || 1;
            const hp = boss.baseHp * Math.pow(1.2, lvl - 1);

            const card = document.createElement('div');
            card.className = 'dungeon-card';
            card.style.borderColor = boss.color;
            card.innerHTML = `
                <div class="d-card-img-box">
                    <img src="${boss.img}" onerror="this.src='https://dragonball-api.com/transformations/frieza-final.png'">
                </div>
                <div class="d-card-info">
                    <div class="d-boss-name" style="color:${boss.color}">${boss.name}</div>
                    <div class="d-boss-lvl">Level ${toRoman(lvl)}</div>
                    <div class="d-boss-hp">HP: ${window.formatNumber(hp)}</div>
                </div>
                <button class="d-enter-btn" onclick="startDungeon('${key}')">
                    ENTER <br><span style="font-size:0.8rem">1 🗝️</span>
                </button>
            `;
            list.appendChild(card);
        });
    };

    function toRoman(num) {
        if (num >= 1000) return "M+";
        const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
        let str = '';
        for (let i of Object.keys(roman)) {
            let q = Math.floor(num / roman[i]);
            num -= q * roman[i];
            str += i.repeat(q);
        }
        return str;
    }

    // Start Dungeon
    window.startDungeon = function (bossKey) {
        if (window.player.dungeonKeys < 1) {
            window.customAlert("No Dungeon Keys left!");
            return;
        }

        window.player.dungeonKeys--;
        window.isDirty = true;

        if (window.showTab) window.showTab(null);
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.getElementById('view-dungeon-battle').classList.add('active-screen');

        const bossConfig = DUNGEON_CONFIG.BOSSES[bossKey];
        const lvl = window.player.dungeonLevel[bossKey];

        // Calc HP
        const bossHp = bossConfig.baseHp * Math.pow(1.2, lvl - 1);
        const bossAtk = (window.GameState.gokuMaxHP * 0.01) + (bossHp * 0.0001); 

        activeBoss = {
            key: bossKey,
            name: bossConfig.name,
            lvl: lvl,
            maxHp: bossHp,
            hp: bossHp,
            atk: bossAtk,
            img: bossConfig.img,
            rewards: bossConfig.rewards,
            color: bossConfig.color
        };

        window.player.hp = window.GameState.gokuMaxHP;

        // Setup UI
        document.getElementById('db-boss-name').innerText = activeBoss.name;
        document.getElementById('db-boss-name').style.color = activeBoss.color;
        document.getElementById('db-dungeon-lvl').innerText = `LEVEL ${toRoman(lvl)}`;
        const bossImgEl = document.getElementById('db-boss-img');
        bossImgEl.src = activeBoss.img;
        bossImgEl.style.opacity = '1'; // Reset visibility from previous explosion
        
        const spriteEl = document.getElementById('ui-sprite');
        const playerImgEl = document.getElementById('db-player-img');
        playerImgEl.src = spriteEl ? spriteEl.src : "IMG_0061.png";
        playerImgEl.style.opacity = '1'; // Reset visibility

        // Reset Physics
        physics.player = { x: 20, y: 50, vx: 0, vy: 0, el: playerImgEl };
        physics.boss = { x: 80, y: 50, vx: 0, vy: 0, el: bossImgEl };
        physics.hitCooldown = 0;

        timeLeft = 90;
        updateDungeonUI();

        if (battleTimer) clearInterval(battleTimer);
        if (physicsFrame) cancelAnimationFrame(physicsFrame);

        battleTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) endDungeon(false);
            updateDungeonUI();
        }, 1000);

        physicsLoop();
    };

    // --- PHYSICS & COMBAT LOOP ---
    function physicsLoop() {
        if (!activeBoss) return;

        const p = physics.player;
        const b = physics.boss;

        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Random jitter movement for dynamic feel
        if(Math.random() < 0.02) { 
            p.vx += (Math.random() - 0.5) * 4; 
            p.vy += (Math.random() - 0.5) * 4;
        }

        // Magnetic attraction (they float towards each other)
        if (dist > 5) {
            p.vx += (dx / dist) * physics.magnet;
            p.vy += (dy / dist) * physics.magnet;
            b.vx -= (dx / dist) * physics.magnet;
            b.vy -= (dy / dist) * physics.magnet;
        }

        // Apply Velocity
        p.x += p.vx; p.y += p.vy;
        b.x += b.vx; b.y += b.vy;
        
        // Friction
        p.vx *= physics.friction; p.vy *= physics.friction;
        b.vx *= physics.friction; b.vy *= physics.friction;

        // Boundaries
        [p, b].forEach(u => {
            if (u.x < 5) { u.x = 5; u.vx *= -0.8; }
            if (u.x > 95) { u.x = 95; u.vx *= -0.8; }
            if (u.y < 15) { u.y = 15; u.vy *= -0.8; } 
            if (u.y > 75) { u.y = 75; u.vy *= -0.8; } 
        });

        // Apply visual transform (Movement tilt/scale)
        if (p.el) p.el.style.transform = `translate(${p.vx * 3}px, ${p.vy * 3}px) scaleX(1)`;
        if (b.el) b.el.style.transform = `translate(${b.vx * 3}px, ${b.vy * 3}px) scaleX(-1)`;

        // Update container positions
        const playerBox = document.querySelector('.db-player-box');
        const bossBox = document.querySelector('.db-boss-box');
        if (playerBox) { playerBox.style.left = p.x + "%"; playerBox.style.top = p.y + "%"; }
        if (bossBox) { bossBox.style.left = b.x + "%"; bossBox.style.top = b.y + "%"; }

        // Collision Check
        if (dist < 12 && physics.hitCooldown <= 0) {
            triggerHit(p, b);
            physics.hitCooldown = 15; // Delay between hits
        }
        if (physics.hitCooldown > 0) physics.hitCooldown--;

        // Continue loop if boss is still alive
        if(activeBoss && activeBoss.hp > 0 && window.player.hp > 0) {
            physicsFrame = requestAnimationFrame(physicsLoop);
        }
    }

    function triggerHit(p, b) {
        // Bounce back physics
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        p.vx -= (dx / dist) * physics.bounce;
        p.vy -= (dy / dist) * physics.bounce;
        b.vx += (dx / dist) * physics.bounce;
        b.vy += (dy / dist) * physics.bounce;

        // Damage Calc
        const playerPower = window.GameState.gokuPower || 100;
        const critChance = window.player.critChance || 0.05; 
        const critDmgMult = window.player.critDamage || 1.5; 

        let dmg = playerPower * (0.9 + Math.random() * 0.2);
        let isCrit = false;

        if (Math.random() < critChance) {
            isCrit = true;
            dmg *= critDmgMult;
        }

        dmg = Math.floor(dmg);
        let bossDmg = activeBoss.atk * (0.8 + Math.random() * 0.4);
        bossDmg = Math.floor(bossDmg);

        // Apply HP reduction
        activeBoss.hp -= dmg;
        window.player.hp -= bossDmg;

        // Visuals
        createDungeonPop(dmg, 'db-boss-img', isCrit ? 'gold' : 'red', isCrit);
        createDungeonPop(bossDmg, 'db-player-img', 'white', false);

        createDungeonParticles(b.x, b.y, 'red');
        if(isCrit) createDungeonParticles(b.x, b.y, 'gold'); 
        
        applyDungeonFlash(p.el);
        applyDungeonFlash(b.el);
        applyDungeonShake(isCrit ? 10 : 5); 

        // --- DEATH CHECK ---
        
        if (activeBoss.hp <= 0) {
            // WIN CONDITION
            activeBoss.hp = 0;
            updateDungeonUI(); // Show 0 HP
            
            // Stop Loops
            if(physicsFrame) cancelAnimationFrame(physicsFrame);
            if(battleTimer) clearInterval(battleTimer);
            
            // Explode Boss
            if(physics.boss.el) explodeSprite(physics.boss.el, 'right');
            
            // Wait then show Win Screen
            setTimeout(() => endDungeon(true), 2000);
            return;
        } 
        else if (window.player.hp <= 0) {
            // LOSE CONDITION
            window.player.hp = 0;
            updateDungeonUI(); // Show 0 HP

            // Stop Loops
            if(physicsFrame) cancelAnimationFrame(physicsFrame);
            if(battleTimer) clearInterval(battleTimer);

            // Explode Player
            if(physics.player.el) explodeSprite(physics.player.el, 'left');

            // Wait then show Lose Screen
            setTimeout(() => endDungeon(false), 2000);
            return;
        }

        // If no one died, update UI and continue
        updateDungeonUI();
    }

    function applyDungeonFlash(el) {
        if (!el) return;
        el.style.filter = 'brightness(5) contrast(2)';
        el.style.transform += ' scale(1.3)'; 
        setTimeout(() => {
            el.style.filter = '';
            el.style.transform = el.style.transform.replace(' scale(1.3)', '');
        }, 80);
    }

    function createDungeonParticles(x, y, color) {
        const container = document.getElementById('db-fx-container');
        if (!container) return;
        for (let i = 0; i < 6; i++) {
            const p = document.createElement('div');
            p.style.position = 'absolute';
            p.style.width = '5px';
            p.style.height = '5px';
            p.style.background = color;
            p.style.left = x + "%";
            p.style.top = y + "%";
            p.style.zIndex = 30;
            p.style.boxShadow = `0 0 8px ${color}`;
            container.appendChild(p);

            const vx = (Math.random() - 0.5) * 12;
            const vy = (Math.random() - 0.5) * 12;
            let op = 1;
            let px = x;
            let py = y;

            const anim = setInterval(() => {
                px += vx * 0.2; py += vy * 0.2; op -= 0.08;
                p.style.left = px + "%"; p.style.top = py + "%"; p.style.opacity = op;
                if (op <= 0) { clearInterval(anim); p.remove(); }
            }, 30);
        }
    }

    function applyDungeonShake(intensity) {
        const arena = document.querySelector('.db-battle-arena');
        if (!arena) return;
        arena.style.animation = 'none';
        void arena.offsetWidth;
        arena.style.animation = 'db-shake 0.3s cubic-bezier(.36,.07,.19,.97) both';
    }

    function updateDungeonUI() {
        if (!activeBoss) return;
        const bossPct = (activeBoss.hp / activeBoss.maxHp) * 100;
        document.getElementById('db-boss-hp-fill').style.width = Math.max(0, bossPct) + "%";
        document.getElementById('db-boss-hp-text').innerText = `${window.formatNumber(activeBoss.hp)} / ${window.formatNumber(activeBoss.maxHp)}`;

        const timePct = (timeLeft / 90) * 100;
        document.getElementById('db-timer-fill').style.width = timePct + "%";
        document.getElementById('db-timer-text').innerText = `${timeLeft}s`;

        const playerPct = (window.player.hp / window.GameState.gokuMaxHP) * 100;
        document.getElementById('db-player-hp-fill').style.width = Math.max(0, playerPct) + "%";
        document.getElementById('db-player-hp-text').innerText = `${window.formatNumber(window.player.hp)}`;
    }

    function createDungeonPop(val, targetId, color, isCrit) {
        const container = document.getElementById('db-fx-container');
        if (!container) return;

        const el = document.createElement('div');
        el.innerText = (isCrit ? "CRIT! " : "") + "-" + window.formatNumber(val);
        el.style.position = 'absolute';
        el.style.color = color;
        el.style.fontWeight = '900';
        el.style.fontSize = isCrit ? '2.5rem' : '1.5rem'; 
        el.style.textShadow = isCrit ? '0 0 10px orange, 0 0 5px black' : '0 0 4px black';
        el.style.fontFamily = 'Bangers';
        el.style.zIndex = 50;
        el.style.pointerEvents = 'none';

        if (targetId === 'db-boss-img') {
            el.style.right = (15 + Math.random() * 10) + "%";
            el.style.bottom = (40 + Math.random() * 10) + "%";
        } else {
            el.style.left = (15 + Math.random() * 10) + "%";
            el.style.bottom = (40 + Math.random() * 10) + "%";
        }

        container.appendChild(el);

        let op = 1;
        let bot = parseFloat(el.style.bottom);
        const anim = setInterval(() => {
            op -= 0.04;
            bot += 0.4;
            el.style.opacity = op;
            el.style.bottom = bot + "%";
            if (op <= 0) { clearInterval(anim); el.remove(); }
        }, 30);
    }

    // --- END GAME LOGIC ---
    function endDungeon(isWin) {
        // --- NEW FIX: Prevent Double Trigger ---
        const modal = document.getElementById('dungeon-result-modal');
        if (modal && modal.style.display === 'flex') return; // Already showing result
        // ---------------------------------------

        // Capture data safely
        const bossData = activeBoss; 
        
        // Stop engine just in case it wasn't stopped
        window.stopDungeon(); 

        const modal = document.getElementById('dungeon-result-modal');
        const list = document.getElementById('db-rewards-list');
        const title = document.getElementById('db-result-title');
        const btn = document.getElementById('db-btn-continue');

        if(!modal || !list || !btn) {
            console.error("Missing Dungeon UI elements");
            if(window.showTab) window.showTab('dungeon'); 
            return;
        }

        list.innerHTML = ''; 
        
        if (isWin && bossData) {
            title.innerText = "VICTORY!";
            title.style.color = "#f1c40f";

            window.player.dungeonLevel[bossData.key]++;

            const scaler = Math.pow(1.05, bossData.lvl - 1);
            let rewardsHtml = '';

            if (bossData.rewards.coins) {
                const amt = Math.floor(bossData.rewards.coins * scaler);
                window.player.coins += amt;
                rewardsHtml += `<div style="color:#f1c40f">💰 +${window.formatNumber(amt)} Coins</div>`;
            }
            if (bossData.rewards.shards) {
                const amt = Math.floor(bossData.rewards.shards * scaler);
                window.player.dragonShards += amt;
                rewardsHtml += `<div style="color:#3498db">💎 +${amt} Shards</div>`;
            }
            if (bossData.rewards.souls) {
                const amt = Math.floor(bossData.rewards.souls * scaler);
                window.player.souls += amt;
                rewardsHtml += `<div style="color:#9b59b6">👻 +${amt} Souls</div>`;
            }
            if (bossData.rewards.gearChance) {
                const qty = Math.floor(Math.random() * 3) + 1; 
                if(window.addToInventory) {
                    for (let i = 0; i < qty; i++) {
                        window.addToInventory({ n: "Dungeon Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: 5000 * bossData.lvl, rarity: 3 });
                    }
                }
                rewardsHtml += `<div style="color:#e67e22">🎒 +${qty} Rare Gear</div>`;
            }
            list.innerHTML = rewardsHtml;
            window.saveGame();
        } else {
            title.innerText = "DEFEATED";
            title.style.color = "#e74c3c";
            list.innerHTML = "<div style='color:#ccc'>You were overwhelmed!</div>";
        }

        modal.style.display = 'flex';

        if(exitTimer) clearInterval(exitTimer);

        const doExit = () => {
            if(exitTimer) clearInterval(exitTimer);
            modal.style.display = 'none';
            
            if (window.showTab) {
                window.showTab('dungeon');
            } else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
                const dungeonScreen = document.getElementById('view-dungeon');
                if(dungeonScreen) dungeonScreen.classList.add('active-screen');
            }
            window.initDungeons();
        };

        btn.onclick = doExit;

        let count = 5;
        btn.innerText = `CONTINUE (${count})`;
        exitTimer = setInterval(() => {
            count--;
            btn.innerText = `CONTINUE (${count})`;
            if (count <= 0) doExit();
        }, 1000);
    }

    window.stopDungeon = function () {
        activeBoss = null;
        if(battleTimer) clearInterval(battleTimer);
        if(physicsFrame) cancelAnimationFrame(physicsFrame);
    };

})();