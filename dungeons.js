// dungeons.js - Handles Dungeon Mode and Daily Logins

(function () {

    // --- CONFIGURATION ---
    const DUNGEON_CONFIG = {
        BOSSES: {
            buu: { name: "Majin Buu", img: "majin_buu.png", baseHp: 1000, rewards: { shards: 1, coins: 500 }, color: "#ff79c6" },
            frieza: { name: "Frieza", img: "freeza.png", baseHp: 2000, rewards: { souls: 10, coins: 1000 }, color: "#bd93f9" },
            cell: { name: "Cell", img: "cell.png", baseHp: 3000, rewards: { gearChance: true, coins: 2500 }, color: "#50fa7b" }
        },
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

    let activeBoss = null;
    let battleTimer = null;
    let timeLeft = 90;
    let exitTimer = null;
    let physicsFrame = null;
    let skillInterval = null;

    const physics = {
        player: { x: 20, y: 50, vx: 0, vy: 0, el: null },
        boss: { x: 80, y: 50, vx: 0, vy: 0, el: null },
        magnet: 0.15, friction: 0.94, bounce: 2.0, hitCooldown: 0
    };

    // --- DAILY LOGIN LOGIC ---
    window.checkDailyLogin = function () {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const lastClaim = window.player.dailyLogin.lastClaimTime || 0;
        if (now - lastClaim > oneDay || lastClaim === 0) {
            if (lastClaim !== 0 && now - lastClaim > (oneDay * 2)) window.player.dailyLogin.day = 1;
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
            // Fix Daily Gear to also use standard values
            let val = 3500; // Default Legendary
            if (reward.gear.rarity === 4) val = 8500;
            if (reward.gear.rarity === 6) val = 50000;

            let name = "Legendary Gear";
            if (reward.gear.rarity === 4) name = "S Gear";
            if (reward.gear.rarity === 6) name = "SSS Gear";

            for (let i = 0; i < reward.gear.count; i++) {
                window.addToInventory({ n: name, type: reward.gear.type, val: val, rarity: reward.gear.rarity });
            }
        }
        window.player.dailyLogin.lastClaimTime = Date.now();
        window.player.dailyLogin.day++;
        if (window.player.dailyLogin.day > 7) window.player.dailyLogin.day = 1;
        window.isDirty = true; window.saveGame();
        document.getElementById('daily-login-modal').style.display = 'none';
        if (typeof window.initDungeons === 'function') window.initDungeons();
        window.customAlert("Daily Rewards Claimed!");
    };

    function explodeSprite(element, direction) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        canvas.style.position = 'fixed'; canvas.style.left = '0'; canvas.style.top = '0'; canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);
        const drawX = rect.left; const drawY = rect.top;
        try { ctx.drawImage(element, drawX, drawY, rect.width, rect.height); } catch (e) { element.style.opacity = "0"; canvas.remove(); return; }
        const particles = []; const density = 4;
        try {
            const imgData = ctx.getImageData(drawX, drawY, rect.width, rect.height); const data = imgData.data; ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let y = 0; y < rect.height; y += density) {
                for (let x = 0; x < rect.width; x += density) {
                    const i = (y * rect.width + x) * 4; const r = data[i]; const g = data[i + 1]; const b = data[i + 2]; const a = data[i + 3];
                    if (a > 128) particles.push({ x: drawX + x, y: drawY + y, color: `rgba(${r},${g},${b},${a / 255})`, vx: (Math.random() - 0.5) * 4 + (direction === 'left' ? -4 : 4), vy: (Math.random() - 0.5) * 4 - 2, life: 1.0 + Math.random() * 0.5 });
                }
            }
        } catch (e) { canvas.remove(); return; }
        element.style.opacity = '0';
        function loop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height); let active = false;
            for (let p of particles) { if (p.life > 0) { active = true; p.x += p.vx; p.y += p.vy; p.life -= 0.02; ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, density, density); } }
            if (active) requestAnimationFrame(loop); else canvas.remove();
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
            const hp = boss.baseHp * Math.pow(2, lvl - 1);
            const card = document.createElement('div');
            card.className = 'dungeon-card';
            card.style.borderColor = boss.color;
            card.innerHTML = `<div class="d-card-img-box"><img src="${boss.img}" onerror="this.src='freeza.png'"></div><div class="d-card-info"><div class="d-boss-name" style="color:${boss.color}">${boss.name}</div><div class="d-boss-lvl">Level ${toRoman(lvl)}</div><div class="d-boss-hp">HP: ${window.formatNumber(hp)}</div></div><button class="d-enter-btn" onclick="startDungeon('${key}')">ENTER <br><span style="font-size:0.8rem">1 🗝️</span></button>`;
            list.appendChild(card);
        });
    };

    function toRoman(num) {
        if (num >= 1000) return "M+";
        const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
        let str = '';
        for (let i of Object.keys(roman)) { let q = Math.floor(num / roman[i]); num -= q * roman[i]; str += i.repeat(q); }
        return str;
    }

    window.startDungeon = function (bossKey) {
        if (window.player.dungeonKeys < 1) { window.customAlert("No Dungeon Keys left!"); return; }
        window.player.dungeonKeys--; window.isDirty = true;

        if (window.showTab) window.showTab(null);
        if (window.GameState) window.GameState.inBattle = true;

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.getElementById('view-dungeon-battle').classList.add('active-screen');

        const bossConfig = DUNGEON_CONFIG.BOSSES[bossKey];
        const lvl = window.player.dungeonLevel[bossKey];
        const bossHp = bossConfig.baseHp * Math.pow(2, lvl - 1);
        const bossAtk = (window.GameState.gokuMaxHP * 0.01) + (bossHp * 0.0001);

        activeBoss = {
            key: bossKey, name: bossConfig.name, lvl: lvl, maxHp: bossHp, hp: bossHp, atk: bossAtk, img: bossConfig.img, rewards: bossConfig.rewards, color: bossConfig.color
        };

        window.player.hp = window.GameState.gokuMaxHP;
        document.getElementById('db-boss-name').innerText = activeBoss.name;
        document.getElementById('db-boss-name').style.color = activeBoss.color;
        document.getElementById('db-dungeon-lvl').innerText = `LEVEL ${toRoman(lvl)}`;
        const bossImgEl = document.getElementById('db-boss-img');
        bossImgEl.src = activeBoss.img;
        bossImgEl.style.opacity = '1';
        const playerImgEl = document.getElementById('db-player-img');
        playerImgEl.src = "IMG_0061.png";
        playerImgEl.style.opacity = '1';

        physics.player = { x: 20, y: 50, vx: 0, vy: 0, el: playerImgEl };
        physics.boss = { x: 80, y: 50, vx: 0, vy: 0, el: bossImgEl, stun: 0 };
        physics.hitCooldown = 0;

        timeLeft = 90;
        updateDungeonUI();

        if (battleTimer) clearInterval(battleTimer);
        if (physicsFrame) cancelAnimationFrame(physicsFrame);
        if (skillInterval) clearInterval(skillInterval);

        battleTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) endDungeon(false);
            updateDungeonUI();
        }, 1000);

        skillInterval = setInterval(() => {
            if (!activeBoss) return;

            // FIX: Catch deaths caused by external DoTs, Pets, or outside scripts
            if (activeBoss.hp <= 0) {
                activeBoss.hp = 0; 
                updateDungeonUI();
                if (physicsFrame) cancelAnimationFrame(physicsFrame);
                if (battleTimer) clearInterval(battleTimer);
                if (skillInterval) clearInterval(skillInterval);
                if (physics.boss.el) explodeSprite(physics.boss.el, 'right');
                setTimeout(() => endDungeon(true), 2000);
                return;
            }

            const dungeonBattleAdapter = { active: true, enemy: activeBoss };
            if (window.Skills && typeof window.Skills.autoBattleTick === 'function') {
                window.Skills.autoBattleTick(dungeonBattleAdapter);
                updateDungeonUI();

                // Check if boss died directly from a skill tick
                if (activeBoss.hp <= 0) {
                    activeBoss.hp = 0; 
                    updateDungeonUI();
                    if (physicsFrame) cancelAnimationFrame(physicsFrame);
                    if (battleTimer) clearInterval(battleTimer);
                    if (skillInterval) clearInterval(skillInterval);
                    if (physics.boss.el) explodeSprite(physics.boss.el, 'right');
                    setTimeout(() => endDungeon(true), 2000);
                    return;
                }
            }
        }, 500);

        physicsLoop();
    };

    function physicsLoop() {
        if (!activeBoss) return;
        const p = physics.player; const b = physics.boss;
        const dx = b.x - p.x; const dy = b.y - p.y; const dist = Math.sqrt(dx * dx + dy * dy);

        let currentMagnet = physics.magnet;
        if (b.stun > 0) { currentMagnet = 0.8; if (Math.random() > 0.5) createDungeonParticles(p.x, p.y, 'white'); }
        if (b.stun <= 0 && Math.random() < 0.02) { p.vx += (Math.random() - 0.5) * 4; p.vy += (Math.random() - 0.5) * 4; }

        if (dist > 5) {
            p.vx += (dx / dist) * currentMagnet; p.vy += (dy / dist) * currentMagnet;
            if (!b.stun || b.stun <= 0) { b.vx -= (dx / dist) * physics.magnet; b.vy -= (dy / dist) * physics.magnet; } else { b.stun--; b.vx *= 0.5; b.vy *= 0.5; }
        }

        p.x += p.vx; p.y += p.vy; b.x += b.vx; b.y += b.vy;
        p.vx *= physics.friction; p.vy *= physics.friction; b.vx *= physics.friction; b.vy *= physics.friction;

        [p, b].forEach(u => {
            let hitWall = false;
            if (u.x < 5) { u.x = 5; u.vx *= -0.8; hitWall = true; }
            if (u.x > 95) { u.x = 95; u.vx *= -0.8; hitWall = true; }
            if (u.y < 15) { u.y = 15; u.vy *= -0.8; hitWall = true; }
            if (u.y > 75) { u.y = 75; u.vy *= -0.8; hitWall = true; }
            if (u === b && hitWall && (Math.abs(u.vx) > 1 || Math.abs(u.vy) > 1)) {
                if (b.stun > 0) { b.vx = 0; b.vy = 0; applyDungeonShake(5); }
            }
        });

        if (p.el) { let scale = b.stun > 0 ? "scale(1.2)" : "scale(1)"; p.el.style.transform = `translate(${p.vx * 3}px, ${p.vy * 3}px) scaleX(1) ${scale}`; }
        if (b.el) b.el.style.transform = `translate(${b.vx * 3}px, ${b.vy * 3}px) scaleX(-1)`;

        const playerBox = document.querySelector('.db-player-box'); const bossBox = document.querySelector('.db-boss-box');
        if (playerBox) { playerBox.style.left = p.x + "%"; playerBox.style.top = p.y + "%"; }
        if (bossBox) { bossBox.style.left = b.x + "%"; bossBox.style.top = b.y + "%"; }

        if (dist < 12 && physics.hitCooldown <= 0) { triggerHit(p, b); physics.hitCooldown = 15; }
        if (physics.hitCooldown > 0) physics.hitCooldown--;

        if (activeBoss && activeBoss.hp > 0 && window.player.hp > 0) { physicsFrame = requestAnimationFrame(physicsLoop); }
    }

    function triggerHit(p, b) {
        const playerPower = window.GameState.gokuPower || 100;
        const critChance = (window.player.rank * 0.05) + 0.1;
        const critDmgMult = 2.0;

        let dmg = playerPower * (0.9 + Math.random() * 0.2);
        let isCrit = false;
        if (Math.random() < critChance) { isCrit = true; dmg *= critDmgMult; }

        const dx = b.x - p.x; const dy = b.y - p.y; const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.vx -= (dx / dist) * physics.bounce; p.vy -= (dy / dist) * physics.bounce;
        const force = isCrit ? (physics.bounce * 15) : physics.bounce;
        b.vx += (dx / dist) * force; b.vy += (dy / dist) * force;
        if (isCrit) b.stun = 45;

        dmg = Math.floor(dmg);
        let bossDmg = activeBoss.atk * (0.8 + Math.random() * 0.4);
        bossDmg = Math.floor(bossDmg);

        activeBoss.hp -= dmg;
        window.player.hp -= bossDmg;

        createDungeonPop(dmg, 'db-boss-img', isCrit ? 'gold' : 'red', isCrit);
        createDungeonPop(bossDmg, 'db-player-img', 'white', false);
        createDungeonParticles(b.x, b.y, 'red');
        if (isCrit) createDungeonParticles(b.x, b.y, 'gold');

        applyDungeonFlash(p.el); applyDungeonFlash(b.el); applyDungeonShake(isCrit ? 10 : 5);

        if (activeBoss.hp <= 0) {
            activeBoss.hp = 0; updateDungeonUI();
            if (physicsFrame) cancelAnimationFrame(physicsFrame);
            if (battleTimer) clearInterval(battleTimer);
            if (skillInterval) clearInterval(skillInterval);
            if (physics.boss.el) explodeSprite(physics.boss.el, 'right');
            setTimeout(() => endDungeon(true), 2000);
            return;
        } else if (window.player.hp <= 0) {
            window.player.hp = 0; updateDungeonUI();
            if (physicsFrame) cancelAnimationFrame(physicsFrame);
            if (battleTimer) clearInterval(battleTimer);
            if (skillInterval) clearInterval(skillInterval);
            if (physics.player.el) explodeSprite(physics.player.el, 'left');
            setTimeout(() => endDungeon(false), 2000);
            return;
        }
        updateDungeonUI();
    }

    function applyDungeonFlash(el) { if (!el) return; el.style.filter = 'brightness(5) contrast(2)'; el.style.transform += ' scale(1.3)'; setTimeout(() => { el.style.filter = ''; el.style.transform = el.style.transform.replace(' scale(1.3)', ''); }, 80); }
    function createDungeonParticles(x, y, color) {
        const container = document.getElementById('db-fx-container'); if (!container) return;
        for (let i = 0; i < 6; i++) {
            const p = document.createElement('div'); p.style.position = 'absolute'; p.style.width = '5px'; p.style.height = '5px'; p.style.background = color; p.style.left = x + "%"; p.style.top = y + "%"; p.style.zIndex = 30; p.style.boxShadow = `0 0 8px ${color}`; container.appendChild(p);
            const vx = (Math.random() - 0.5) * 12; const vy = (Math.random() - 0.5) * 12; let op = 1; let px = x; let py = y;
            const anim = setInterval(() => { px += vx * 0.2; py += vy * 0.2; op -= 0.08; p.style.left = px + "%"; p.style.top = py + "%"; p.style.opacity = op; if (op <= 0) { clearInterval(anim); p.remove(); } }, 30);
        }
    }
    function applyDungeonShake(intensity) { const arena = document.querySelector('.db-battle-arena'); if (!arena) return; arena.style.animation = 'none'; void arena.offsetWidth; arena.style.animation = 'db-shake 0.3s cubic-bezier(.36,.07,.19,.97) both'; }

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

    window.createDungeonPop = function (val, targetId, color, isCrit) {
        const container = document.getElementById('db-fx-container'); if (!container) return;
        const el = document.createElement('div'); el.innerText = (isCrit ? "CRIT! " : "") + "-" + window.formatNumber(val); el.style.position = 'absolute'; el.style.color = color; el.style.fontWeight = '900'; el.style.fontSize = isCrit ? '2.5rem' : '1.5rem'; el.style.textShadow = isCrit ? '0 0 10px orange, 0 0 5px black' : '0 0 4px black'; el.style.fontFamily = 'Bangers'; el.style.zIndex = 50; el.style.pointerEvents = 'none';
        if (targetId === 'db-boss-img') { el.style.right = (15 + Math.random() * 10) + "%"; el.style.bottom = (40 + Math.random() * 10) + "%"; } else { el.style.left = (15 + Math.random() * 10) + "%"; el.style.bottom = (40 + Math.random() * 10) + "%"; }
        container.appendChild(el);
        let op = 1; let bot = parseFloat(el.style.bottom);
        const anim = setInterval(() => { op -= 0.04; bot += 0.4; el.style.opacity = op; el.style.bottom = bot + "%"; if (op <= 0) { clearInterval(anim); el.remove(); } }, 30);
    }

    function endDungeon(isWin) {
        const modal = document.getElementById('dungeon-result-modal'); if (modal && modal.style.display === 'flex') return;
        const bossData = activeBoss;
        window.stopDungeon();
        const list = document.getElementById('db-rewards-list');
        const title = document.getElementById('db-result-title');
        const btn = document.getElementById('db-btn-continue');
        list.innerHTML = '';

        if (isWin && bossData) {
            title.innerText = "VICTORY!"; title.style.color = "#f1c40f";
            window.player.dungeonLevel[bossData.key]++;
            const scaler = Math.pow(1.015, bossData.lvl - 1);
            let rewardsHtml = '';
            if (bossData.rewards.coins) { const amt = Math.floor(bossData.rewards.coins * scaler) + (bossData.lvl * 1000); window.player.coins += amt; rewardsHtml += `<div style="color:#f1c40f">💰 +${window.formatNumber(amt)} Coins</div>`; }
            if (bossData.rewards.shards) { const amt = Math.ceil(bossData.rewards.shards * scaler) + Math.floor(bossData.lvl / 2); window.player.dragonShards += amt; rewardsHtml += `<div style="color:#3498db">💎 +${amt} Shards</div>`; }
            if (bossData.rewards.souls) { const amt = Math.ceil(bossData.rewards.souls * scaler) + Math.floor(bossData.lvl / 5); window.player.souls += amt; rewardsHtml += `<div style="color:#9b59b6">👻 +${amt} Souls</div>`; }

            // --- FIXED GEAR LOGIC TO MATCH MERGE SYSTEM ---
            if (bossData.rewards.gearChance) {
                const baseQty = Math.floor(Math.random() * 4) + 1;
                const bonusQty = Math.floor(bossData.lvl / 10);
                const qty = baseQty + bonusQty;

                // Determine Rarity
                let rarity = 3;
                if (bossData.lvl >= 50) rarity = 6;
                else if (bossData.lvl >= 30) rarity = 5;
                else if (bossData.lvl >= 15) rarity = 4;

                // HARD-SET Values based on Rarity (to ensure merging works)
                let val = 3500; // Legendary (Rarity 3)
                let rName = "Legendary Gear";

                if (rarity === 4) { val = 8500; rName = "S Gear"; }
                if (rarity === 5) { val = 20000; rName = "SS Gear"; }
                if (rarity === 6) { val = 50000; rName = "SSS Gear"; }

                if (window.addToInventory) {
                    try {
                        for (let i = 0; i < qty; i++) {
                            window.addToInventory({
                                n: rName,
                                type: Math.random() > 0.5 ? 'w' : 'a',
                                val: val,
                                rarity: rarity
                            });
                        }
                    } catch(err) {
                        console.error("Inventory error during dungeon reward:", err);
                    }
                }
                rewardsHtml += `<div style="color:#e67e22">🎒 +${qty} ${rName}</div>`;
            }
            // ----------------------------------------------

            list.innerHTML = rewardsHtml; window.saveGame();
        } else { title.innerText = "DEFEATED"; title.style.color = "#e74c3c"; list.innerHTML = "<div style='color:#ccc'>You were overwhelmed!</div>"; }

        modal.style.display = 'flex';
        if (exitTimer) clearInterval(exitTimer);
        const doExit = () => { if (exitTimer) clearInterval(exitTimer); modal.style.display = 'none'; if (window.showTab) { window.showTab('dungeon'); } else { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen')); const dungeonScreen = document.getElementById('view-dungeon'); if (dungeonScreen) dungeonScreen.classList.add('active-screen'); } window.initDungeons(); };
        btn.onclick = doExit;
        let count = 5; btn.innerText = `CONTINUE (${count})`;
        exitTimer = setInterval(() => { count--; btn.innerText = `CONTINUE (${count})`; if (count <= 0) doExit(); }, 1000);
    }

    window.stopDungeon = function () {
        if (window.GameState) window.GameState.inBattle = false;
        activeBoss = null;
        if (battleTimer) clearInterval(battleTimer);
        if (physicsFrame) cancelAnimationFrame(physicsFrame);
        if (skillInterval) clearInterval(skillInterval);
    };

})();