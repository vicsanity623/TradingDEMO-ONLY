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
    let exitTimer = null; // Store exit timer globally to clear it properly

    // Physics State
    let physicsFrame = null;
    const physics = {
        player: { x: 20, y: 50, vx: 0, vy: 0, el: null },
        boss: { x: 80, y: 50, vx: 0, vy: 0, el: null },
        magnet: 0.15, // Increased from 0.05 for faster acceleration
        friction: 0.94, // Less friction for speed
        bounce: 2.0,   // Harder bounce on impact
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
        
        // Dynamic Attack Scaling: Boss deals ~1% of player max HP per hit + base dmg
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
        document.getElementById('db-boss-img').src = activeBoss.img;
        
        const spriteEl = document.getElementById('ui-sprite');
        document.getElementById('db-player-img').src = spriteEl ? spriteEl.src : "IMG_0061.png";

        // Reset Physics
        physics.player = { x: 20, y: 50, vx: 0, vy: 0, el: document.getElementById('db-player-img') };
        physics.boss = { x: 80, y: 50, vx: 0, vy: 0, el: document.getElementById('db-boss-img') };
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

        // 1. Calculate Distance
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 2. Dash Mechanic (Random burst of speed)
        if(Math.random() < 0.02) { // 2% chance per frame to dash
            p.vx += (Math.random() - 0.5) * 4; 
            p.vy += (Math.random() - 0.5) * 4;
        }

        // 3. Magnet Attraction (Stronger closer they get)
        if (dist > 5) {
            p.vx += (dx / dist) * physics.magnet;
            p.vy += (dy / dist) * physics.magnet;
            b.vx -= (dx / dist) * physics.magnet;
            b.vy -= (dy / dist) * physics.magnet;
        }

        // 4. Apply Velocity & Friction
        p.x += p.vx; p.y += p.vy;
        b.x += b.vx; b.y += b.vy;
        p.vx *= physics.friction; p.vy *= physics.friction;
        b.vx *= physics.friction; b.vy *= physics.friction;

        // 5. Keep in Bounds
        [p, b].forEach(u => {
            if (u.x < 5) { u.x = 5; u.vx *= -0.8; }
            if (u.x > 95) { u.x = 95; u.vx *= -0.8; }
            if (u.y < 15) { u.y = 15; u.vy *= -0.8; } // Adjusted top bound for HUD
            if (u.y > 75) { u.y = 75; u.vy *= -0.8; } // Adjusted bottom bound
        });

        // 6. Update Visuals
        if (p.el) p.el.style.transform = `translate(${p.vx * 3}px, ${p.vy * 3}px) scaleX(1)`;
        if (b.el) b.el.style.transform = `translate(${b.vx * 3}px, ${b.vy * 3}px) scaleX(-1)`;

        const playerBox = document.querySelector('.db-player-box');
        const bossBox = document.querySelector('.db-boss-box');
        if (playerBox) { playerBox.style.left = p.x + "%"; playerBox.style.top = p.y + "%"; }
        if (bossBox) { bossBox.style.left = b.x + "%"; bossBox.style.top = b.y + "%"; }

        // 7. Collision
        if (dist < 12 && physics.hitCooldown <= 0) {
            triggerHit(p, b);
            physics.hitCooldown = 15; // 0.25s Invulnerability
        }
        if (physics.hitCooldown > 0) physics.hitCooldown--;

        physicsFrame = requestAnimationFrame(physicsLoop);
    }

    function triggerHit(p, b) {
        // Bounce Force
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        p.vx -= (dx / dist) * physics.bounce;
        p.vy -= (dy / dist) * physics.bounce;
        b.vx += (dx / dist) * physics.bounce;
        b.vy += (dy / dist) * physics.bounce;

        // --- DAMAGE CALCULATIONS ---
        
        // 1. Get Player Stats (w/ Defaults)
        const playerPower = window.GameState.gokuPower || 100;
        const critChance = window.player.critChance || 0.05; // 5% base
        const critDmgMult = window.player.critDamage || 1.5; // 150% base

        // 2. Calculate Damage with Variance (0.9 to 1.1)
        let dmg = playerPower * (0.9 + Math.random() * 0.2);
        let isCrit = false;

        // 3. Roll for Crit
        if (Math.random() < critChance) {
            isCrit = true;
            dmg *= critDmgMult;
        }

        dmg = Math.floor(dmg);

        // 4. Boss Damage (Flat + Variance)
        let bossDmg = activeBoss.atk * (0.8 + Math.random() * 0.4);
        bossDmg = Math.floor(bossDmg);

        // Apply Damage
        activeBoss.hp -= dmg;
        window.player.hp -= bossDmg;

        // Visual Popups
        createDungeonPop(dmg, 'db-boss-img', isCrit ? 'gold' : 'red', isCrit);
        createDungeonPop(bossDmg, 'db-player-img', 'white', false);

        // Visual Effects
        createDungeonParticles(b.x, b.y, 'red');
        if(isCrit) createDungeonParticles(b.x, b.y, 'gold'); // Extra sparkles for crit
        
        applyDungeonFlash(p.el);
        applyDungeonFlash(b.el);
        applyDungeonShake(isCrit ? 10 : 5); // Shake harder on crit

        // Check End
        if (activeBoss.hp <= 0) {
            activeBoss.hp = 0;
            // Stop physics immediately so we don't trigger hits after death
            cancelAnimationFrame(physicsFrame);
            endDungeon(true);
        } else if (window.player.hp <= 0) {
            window.player.hp = 0;
            cancelAnimationFrame(physicsFrame);
            endDungeon(false);
        } else {
            updateDungeonUI();
        }
    }

    function applyDungeonFlash(el) {
        if (!el) return;
        el.style.filter = 'brightness(5) contrast(2)';
        el.style.transform += ' scale(1.3)'; // Pop bigger
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
        // Inject dynamic intensity into keyframes if possible, or just standard shake class
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
        // Add "CRIT!" text if crit
        el.innerText = (isCrit ? "CRIT! " : "") + "-" + window.formatNumber(val);
        el.style.position = 'absolute';
        el.style.color = color;
        el.style.fontWeight = '900';
        el.style.fontSize = isCrit ? '2.5rem' : '1.5rem'; // Bigger if crit
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

    // --- REWRITTEN END GAME LOGIC ---
    function endDungeon(isWin) {
        // --- FIX: CAPTURE DATA BEFORE KILLING THE ENGINE ---
        const bossData = activeBoss;

        window.stopDungeon(); // Stops physics and battle timer

        const modal = document.getElementById('dungeon-result-modal');
        const title = document.getElementById('db-result-title');
        const list = document.getElementById('db-rewards-list');
        const btn = document.getElementById('db-btn-continue');

        if(!modal || !list || !btn) {
            console.error("Missing Dungeon UI elements");
            if(window.showTab) window.showTab('dungeon'); 
            return;
        }

        list.innerHTML = ''; // Clear previous rewards
        
        // Populate modal data *before* showing it
        if (isWin && bossData) {
            title.innerText = "VICTORY!";
            title.style.color = "#f1c40f"; // Gold
            title.style.textShadow = "0 0 15px orange";

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
                // Higher levels = more gear
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
            title.style.textShadow = "0 0 15px darkred";
            list.innerHTML = "<div style='color:#ccc'>You were overwhelmed! Try upgrading your stats.</div>";
        }

        // Show Modal
        modal.style.display = 'flex';

        // Clean up previous timer if it exists
        if(exitTimer) clearInterval(exitTimer);

        // Exit Logic
        const doExit = () => {
            if(exitTimer) clearInterval(exitTimer);
            modal.style.display = 'none';
            
            // Safe screen switching
            if (window.showTab) {
                window.showTab('dungeon');
            } else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
                const dungeonScreen = document.getElementById('view-dungeon');
                if(dungeonScreen) dungeonScreen.classList.add('active-screen');
            }
            
            window.initDungeons(); // Refresh boss levels
        };

        // Button Click
        btn.onclick = doExit;

        // Auto Countdown
        let count = 5;
        btn.innerText = `CONTINUE (${count})`;
        
        exitTimer = setInterval(() => {
            count--;
            btn.innerText = `CONTINUE (${count})`;
            if (count <= 0) {
                doExit(); 
            }
        }, 1000);
    }

    window.stopDungeon = function () {
        activeBoss = null;
        if(battleTimer) clearInterval(battleTimer);
        if(physicsFrame) cancelAnimationFrame(physicsFrame);
    };

})();