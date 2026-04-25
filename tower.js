// tower.js - THE ULTIMATE STANDALONE ENGINE
// Features: Save/Load, Canvas Trails, Swarm Universe, Dungeon Sweeps, Infinite Shop

(function () {

    // --- 1. GAME STATE & SAVE SYSTEM ---
    const SAVE_KEY = "dbz_endless_universe_v1";

    const DEFAULT_PLAYER = {
        lvl: 1, xp: 0, nextXp: 100, coins: 0,
        bAtk: 50, bDef: 20, bHp: 1000,
        inv: [], gear: { w: null, a: null }, selected: -1,
        dungeonKeys: 10, senzuBeans: 0, maxFloor: 1, 
        shop: { zsword: 0, potara: 0, godki: 0 },
        dStats: { dmgDealt: 0, hardestHit: 0, lootFound: 0, dmgTaken: 0, kills: 0 }
    };

    window.player = structuredClone(DEFAULT_PLAYER);

    function saveGame() {
        localStorage.setItem(SAVE_KEY, JSON.stringify(player));
    }

    function loadGame() {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                window.player = { ...DEFAULT_PLAYER, ...parsed };
                // Deep merge nested objects
                if(parsed.shop) window.player.shop = { ...DEFAULT_PLAYER.shop, ...parsed.shop };
                if(parsed.dStats) window.player.dStats = { ...DEFAULT_PLAYER.dStats, ...parsed.dStats };
                if(parsed.gear) window.player.gear = { ...DEFAULT_PLAYER.gear, ...parsed.gear };
            }
        } catch (e) { console.error("Save corrupted, reset to default."); }
    }

    // Auto-save every 10 seconds
    setInterval(saveGame, 10000);

    // --- 2. DATA & CONSTANTS ---
    const DUNGEONS = {
        buu: { name: "Majin Buu", img: "majin_buu.png", hp: 5000, atk: 150, color: "#ff79c6" },
        frieza: { name: "Frieza", img: "freeza.png", hp: 15000, atk: 400, color: "#bd93f9" },
        cell: { name: "Cell", img: "cell.png", hp: 50000, atk: 1200, color: "#50fa7b" }
    };

    let combatState = {
        active: false, type: '', floor: 1, bossKey: null,
        p: { hp: 0, maxHp: 0, atk: 0, def: 0, x: 20, y: 50, vx: 0, vy: 0, el: null, history: [] },
        e: { hp: 0, maxHp: 0, atk: 0, def: 0, x: 80, y: 50, vx: 0, vy: 0, el: null, stun: 0, history: [] },
        hitCooldown: 0, loopId: null, lastSweepData: null
    };

    // --- 3. MATH CALCULATORS ---
    function getPlayerStats() {
        const wVal = player.gear.w ? player.gear.w.val : 0;
        const aVal = player.gear.a ? player.gear.a.val : 0;
        const shopW = player.shop.zsword * 500000;
        const shopA = player.shop.potara * 500000;
        const mult = Math.pow(2, player.shop.godki);

        return {
            hp: Math.floor((player.bHp + (player.lvl * 100) + (aVal * 5)) * mult),
            atk: Math.floor((player.bAtk + (player.lvl * 10) + wVal + shopW) * mult),
            def: Math.floor((player.bDef + (player.lvl * 5) + aVal + shopA) * mult)
        };
    }

    window.formatNum = function(num) {
        if (num == null || isNaN(num) || num <= 0) return "0";
        if (num < 1000) return Math.floor(num);
        const suffixes = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
        const tier = Math.floor(Math.log10(num) / 3);
        if(tier >= suffixes.length) return "MAX";
        return (num / Math.pow(10, tier * 3)).toFixed(1) + suffixes[tier];
    };

    // --- 4. CORE UI ENGINE ---
    window.showTab = function(tab) {
        if (combatState.active) stopCombat();
        uniState.active = (tab === 'universe');
        if (tab === 'universe') initUniverse();

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + tab).classList.add('active-screen');
        document.getElementById('tab-' + tab).classList.add('active');
        syncUI();
    };

    function syncUI() {
        try {
            const stats = getPlayerStats();
            // Hub Elements
            document.getElementById('ui-lvl').innerText = player.lvl;
            document.getElementById('ui-hp').innerText = formatNum(stats.hp);
            document.getElementById('ui-atk').innerText = formatNum(stats.atk);
            document.getElementById('ui-def').innerText = formatNum(stats.def);
            document.getElementById('ui-gold').innerText = formatNum(player.coins);
            document.getElementById('ui-xp-fill').style.width = (player.xp / player.nextXp * 100) + '%';
            document.getElementById('ui-xp-text').innerText = `${formatNum(player.xp)} / ${formatNum(player.nextXp)}`;
            document.getElementById('ui-eq-w').innerText = player.gear.w ? `+${formatNum(player.gear.w.val)}` : "NONE";
            document.getElementById('ui-eq-a').innerText = player.gear.a ? `+${formatNum(player.gear.a.val)}` : "NONE";
            
            // Stats Dashboard (Fixed IDs)
            document.getElementById('stat-dmg-dealt').innerText = formatNum(player.dStats.dmgDealt);
            document.getElementById('stat-hardest-hit').innerText = formatNum(player.dStats.hardestHit);
            document.getElementById('stat-loot-found').innerText = formatNum(player.dStats.lootFound);
            document.getElementById('stat-dmg-taken').innerText = formatNum(player.dStats.dmgTaken);

            // Other Tabs
            document.getElementById('ui-keys').innerText = player.dungeonKeys;
            document.getElementById('ui-senzu').innerText = player.senzuBeans;
            document.getElementById('ui-max-floor').innerText = player.maxFloor;

            renderInventory();
            renderDungeons();
        } catch (e) { console.warn("Sync error - check HTML IDs"); }
    }

    window.farmGold = function() {
        player.coins += 100 * player.lvl;
        player.xp += 15 * player.lvl;
        checkLevelUp(); syncUI();
    };

    function checkLevelUp() {
        while(player.xp >= player.nextXp) {
            player.xp -= player.nextXp; player.lvl++;
            player.nextXp = Math.floor(player.nextXp * 1.5);
            player.bHp += 200; player.bAtk += 20; player.bDef += 10;
        }
    }

    // --- 5. INVENTORY & GEAR ---
    function addToInv(item) {
        const found = player.inv.find(i => i.n === item.n && i.val === item.val);
        if (found) found.qty++; else { item.qty = 1; player.inv.push(item); }
        syncUI();
    }

    function renderInventory() {
        const grid = document.getElementById('inv-grid');
        grid.innerHTML = '';
        const mergeBtn = document.getElementById('btn-merge');
        const equipBtn = document.getElementById('btn-equip');
        mergeBtn.style.display = 'none'; equipBtn.style.display = 'block';

        player.inv.forEach((item, i) => {
            const el = document.createElement('div');
            el.className = `inv-item ${player.selected === i ? 'selected' : ''}`;
            let color = (item.val > 20000) ? "var(--cyan)" : (item.val > 5000 ? "var(--red)" : "white");
            el.innerHTML = `<span style="font-size:1.5rem;">${item.type === 'w' ? '⚔️' : '🛡️'}</span>
                            <span style="color:${color}; font-weight:bold;">${formatNum(item.val)}</span>
                            ${item.qty > 1 ? `<div class="qty-badge">x${item.qty}</div>` : ''}`;
            el.onclick = () => { player.selected = i; syncUI(); };
            grid.appendChild(el);
        });

        if (player.selected !== -1 && player.inv[player.selected] && player.inv[player.selected].qty >= 3) {
            mergeBtn.style.display = 'block'; equipBtn.style.display = 'none';
        }
    }

    window.equipSelected = function() {
        if(player.selected === -1) return;
        const item = player.inv[player.selected];
        const old = player.gear[item.type];
        player.gear[item.type] = { n: item.n, type: item.type, val: item.val, qty: 1 };
        item.qty--; if(item.qty <= 0) player.inv.splice(player.selected, 1);
        if(old) addToInv(old);
        player.selected = -1; syncUI();
    };

    window.mergeSelected = function() {
        if(player.selected === -1) return;
        const item = player.inv[player.selected];
        item.qty -= 3; if(item.qty <= 0) player.inv.splice(player.selected, 1);
        player.selected = -1; addToInv({ n: item.n + "+", type: item.type, val: item.val * 2 });
    };

    function renderDungeons() {
        const list = document.getElementById('dungeon-list');
        list.innerHTML = '';
        Object.keys(DUNGEONS).forEach(key => {
            const d = DUNGEONS[key];
            const el = document.createElement('div');
            el.style.cssText = `background:rgba(20,20,30,0.9); border:2px solid ${d.color}; border-radius:10px; padding:15px; display:flex; align-items:center; gap:15px; flex-shrink: 0; min-height: 90px;`;
            el.innerHTML = `
                <div style="width:60px; height:60px; border-radius:50%; background:black; border:2px solid #fff; overflow:hidden; flex-shrink:0;">
                    <img src="${d.img}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="flex:1;">
                    <div style="font-family:'Bangers'; font-size:1.5rem; color:${d.color};">${d.name}</div>
                    <div style="font-size:0.75rem; color:#aaa;">HP: ${formatNum(d.hp)} | ATK: ${formatNum(d.atk)}</div>
                </div>
                <button class="btn btn-gold" style="padding:10px; flex:none; width:100px;" onclick="startCombat('dungeon', null, '${key}')">FIGHT (1🗝️)</button>
            `;
            list.appendChild(el);
        });
    }

    // --- 6. INFINITE TOWER SHOP ---
    window.openTowerShop = function() {
        document.getElementById('shop-zsword-cost').innerText = formatNum(50 + (player.shop.zsword * 50));
        document.getElementById('shop-potara-cost').innerText = formatNum(50 + (player.shop.potara * 50));
        document.getElementById('shop-godki-cost').innerText = formatNum(250 * Math.pow(2, player.shop.godki));
        document.getElementById('shop-zsword-qty').innerText = player.shop.zsword;
        document.getElementById('shop-potara-qty').innerText = player.shop.potara;
        document.getElementById('shop-godki-qty').innerText = player.shop.godki;
        document.getElementById('shop-senzu').innerText = player.senzuBeans;
        document.getElementById('shop-modal').style.display = 'flex';
    };

    window.buyShopItem = function(id) {
        let cost = (id==='godki') ? 250 * Math.pow(2, player.shop.godki) : 50 + (player.shop[id] * 50);
        if (player.senzuBeans < cost) { alert("Not enough beans!"); return; }
        player.senzuBeans -= cost; player.shop[id]++; syncUI(); openTowerShop();
    };

    // --- 7. ARENA PHYSICS & GHOST TRAILS ---
    const trCanvas = document.getElementById('trail-canvas');
    const trCtx = trCanvas.getContext('2d');
    function resizeTrails() { trCanvas.width = trCanvas.offsetWidth; trCanvas.height = trCanvas.offsetHeight; }
    window.addEventListener('resize', resizeTrails); resizeTrails();

    window.startCombat = function(type, floor = 1, bossKey = null) {
        if (type === 'dungeon' && player.dungeonKeys < 1) { alert("No Keys!"); return; }
        if (type === 'dungeon') player.dungeonKeys--;

        combatState.active = true; combatState.type = type; combatState.floor = floor; combatState.bossKey = bossKey; combatState.hitCooldown = 0;
        const stats = getPlayerStats();
        combatState.p = { hp: stats.hp, maxHp: stats.hp, atk: stats.atk, def: stats.def, x: 20, y: 50, vx: 0, vy: 0, el: document.getElementById('cb-player'), history: [] };
        spawnEnemy();
        document.getElementById('combat-modal').style.display = 'flex';
        document.getElementById('cb-fx').innerHTML = ''; updateCombatUI();
        if(combatState.loopId) cancelAnimationFrame(combatState.loopId); combatLoop();
    };

    function spawnEnemy() {
        const c = combatState; let eName, eImg, eHp, eAtk;
        if (c.type === 'dungeon') {
            const d = DUNGEONS[c.bossKey]; eName = d.name; eImg = d.img; eHp = d.hp; eAtk = d.atk;
        } else {
            const mult = Math.pow(1.15, c.floor - 1);
            eName = `Tower Guardian F${c.floor}`; eImg = "cell.png"; 
            eHp = Math.floor(5000 * mult); eAtk = Math.floor(100 * mult);
        }
        document.getElementById('combat-title').innerText = eName;
        document.getElementById('combat-subtitle').innerText = c.type === 'tower' ? `Floor ${c.floor}` : "Boss Fight";
        document.getElementById('cb-enemy-img').src = eImg;
        c.e = { hp: eHp, maxHp: eHp, atk: eAtk, def: eAtk * 0.5, x: 80, y: 50, vx: 0, vy: 0, el: document.getElementById('cb-enemy'), stun: 0, history: [] };
    }

    function combatLoop() {
        if(!combatState.active) return;
        const p = combatState.p; const e = combatState.e;
        const dx = e.x - p.x; const dy = e.y - p.y; const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 10) {
            p.vx += (dx/dist) * 0.7; p.vy += (dy/dist) * 0.7;
            if(e.stun <= 0) { e.vx -= (dx/dist) * 0.4; e.vy -= (dy/dist) * 0.4; } else { e.stun--; e.vx *= 0.8; }
        }
        p.x += p.vx; p.y += p.vy; e.x += e.vx; e.y += e.vy;
        p.vx *= 0.88; p.vy *= 0.88; e.vx *= 0.88; e.vy *= 0.88;

        p.el.style.left = p.x + "%"; p.el.style.top = p.y + "%";
        e.el.style.left = e.x + "%"; e.el.style.top = e.y + "%";

        // Trails
        p.history.unshift({x: p.x, y: p.y}); if(p.history.length > 20) p.history.pop();
        e.history.unshift({x: e.x, y: e.y}); if(e.history.length > 20) e.history.pop();
        drawTrails(p.history, e.history);

        if (dist < 15 && combatState.hitCooldown <= 0) {
            combatState.hitCooldown = 15;
            const pDmg = Math.max(1, Math.floor(p.atk * (0.8 + Math.random() * 0.4)));
            e.hp -= pDmg; player.dStats.dmgDealt += pDmg; if (pDmg > player.dStats.hardestHit) player.dStats.hardestHit = pDmg;
            spawnPop(formatNum(pDmg), e.x, e.y, 'gold');
            e.vx += (dx/dist) * 10; e.vy += (dy/dist) * 10; e.stun = 20;

            const eDmg = Math.max(1, Math.floor(e.atk * (0.8 + Math.random() * 0.4) - (p.def * 0.2)));
            p.hp -= eDmg; player.dStats.dmgTaken += eDmg; spawnPop(formatNum(eDmg), p.x, p.y, 'var(--red)');
            p.vx -= (dx/dist) * 10; p.vy -= (dy/dist) * 10;

            const arena = document.getElementById('combat-arena');
            arena.classList.remove('epic-shake'); void arena.offsetWidth; arena.classList.add('epic-shake');
        }
        if(combatState.hitCooldown > 0) combatState.hitCooldown--;
        updateCombatUI();

        if (e.hp <= 0) handleEnemyDeath();
        else if (p.hp <= 0) handlePlayerDeath();
        else combatState.loopId = requestAnimationFrame(combatLoop);
    }

    function drawTrails(pHist, eHist) {
        trCtx.clearRect(0, 0, trCanvas.width, trCanvas.height);
        const w = trCanvas.width; const h = trCanvas.height;
        function drawLine(hist, color, glow) {
            if(hist.length < 2) return;
            trCtx.beginPath(); trCtx.moveTo(hist[0].x/100*w, hist[0].y/100*h);
            for(let i=1; i<hist.length; i++) trCtx.lineTo(hist[i].x/100*w, hist[i].y/100*h);
            trCtx.shadowBlur = 15; trCtx.shadowColor = glow; trCtx.strokeStyle = color; trCtx.lineWidth = 12; trCtx.lineCap = 'round'; trCtx.stroke();
        }
        drawLine(pHist, 'rgba(0, 229, 255, 0.4)', '#00e5ff');
        drawLine(eHist, 'rgba(255, 0, 85, 0.4)', '#ff0055');
    }

    function handleEnemyDeath() {
        if (combatState.type === 'dungeon') {
            stopCombat(); player.dStats.kills++;
            let baseVal = combatState.bossKey === 'cell' ? 15000 : (combatState.bossKey === 'frieza' ? 5000 : 1500);
            addToInv({ n: "Boss Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: baseVal });
            player.coins += baseVal * 2; player.dStats.lootFound++;
            combatState.lastSweepData = { coins: baseVal*2, gearVal: baseVal };
            showResult("VICTORY!", `Gained ${formatNum(baseVal*2)} Gold<br>Found Boss Gear!`, true);
        } else {
            player.senzuBeans += Math.floor(combatState.floor / 2) + 1;
            if (combatState.floor > player.maxFloor) player.maxFloor = combatState.floor;
            combatState.floor++; spawnEnemy(); 
            combatState.loopId = requestAnimationFrame(combatLoop);
        }
    }

    function handlePlayerDeath() {
        stopCombat();
        showResult("DEFEATED", combatState.type === 'tower' ? `Fell on Floor ${combatState.floor}` : "Go Train!");
    }

    function updateCombatUI() {
        const c = combatState;
        document.getElementById('cb-player-hp').style.width = Math.max(0, (c.p.hp / c.p.maxHp) * 100) + "%";
        document.getElementById('cb-boss-hp').style.width = Math.max(0, (c.e.hp / c.e.maxHp) * 100) + "%";
        document.getElementById('cb-player-hp-text').innerText = Math.round(Math.max(0, (c.p.hp / c.p.maxHp) * 100)) + "%";
    }

    window.stopCombat = function() {
        combatState.active = false; if (combatState.loopId) cancelAnimationFrame(combatState.loopId);
        document.getElementById('combat-modal').style.display = 'none'; syncUI();
    };

    function spawnPop(text, x, y, color) {
        const el = document.createElement('div'); el.className = 'pop'; el.innerText = text; el.style.color = color;
        el.style.left = x + "%"; el.style.top = y + "%"; document.getElementById('cb-fx').appendChild(el);
        setTimeout(() => el.remove(), 600);
    }

    // --- 8. SWEEP & RESULT LOGIC ---
    window.showResult = function(title, text, canSweep = false) {
        document.getElementById('res-title').innerText = title;
        document.getElementById('res-body').innerHTML = text;
        document.getElementById('sweep-ui').style.display = canSweep ? 'block' : 'none';
        document.getElementById('sweep-keys-avail').innerText = player.dungeonKeys;
        document.getElementById('result-modal').style.display = 'flex';
    };

    window.closeResult = function() { document.getElementById('result-modal').style.display = 'none'; syncUI(); };

    let sweepCount = 1;
    window.adjSweep = function(amount) {
        if(amount === 'max') sweepCount = player.dungeonKeys; else sweepCount += amount;
        if(sweepCount < 1) sweepCount = 1; if(sweepCount > player.dungeonKeys) sweepCount = player.dungeonKeys;
        document.getElementById('sweep-input').value = sweepCount;
    };

    window.confirmSweep = function() {
        if (sweepCount < 1 || sweepCount > player.dungeonKeys) return;
        player.dungeonKeys -= sweepCount;
        const sd = combatState.lastSweepData;
        player.coins += sd.coins * sweepCount; player.dStats.lootFound += sweepCount;
        for(let i=0; i<sweepCount; i++) addToInv({ n: "Boss Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: sd.gearVal });
        closeResult(); alert("Sweep Complete!");
    };

    // --- 9. UNIVERSE SWARM ENGINE ---
    const uCan = document.getElementById('uni-canvas'); const uCtx = uCan.getContext('2d');
    let uniState = { active: false, cx: 0, cy: 0, px: 0, py: 0, vx: 0, vy: 0, enemies: [], stars: [], particles: [], texts: [], dead: false, joy: { active: false, nx: 0, ny: 0 } };
    
    const joyZone = document.getElementById('joystick-zone');
    const joyKnob = document.getElementById('joystick-knob');
    joyZone.addEventListener('touchstart', (e) => { e.preventDefault(); handleJoy(e); }, {passive: false});
    joyZone.addEventListener('touchmove', (e) => { e.preventDefault(); handleJoy(e); }, {passive: false});
    joyZone.addEventListener('touchend', () => { uniState.joy.active = false; joyKnob.style.transform = `translate(-50%, -50%)`; uniState.joy.nx = 0; uniState.joy.ny = 0; });

    function handleJoy(e) {
        uniState.joy.active = true; const rect = joyZone.getBoundingClientRect();
        const clientX = e.touches[0].clientX; const clientY = e.touches[0].clientY;
        let dx = clientX - (rect.left + rect.width/2); let dy = clientY - (rect.top + rect.height/2);
        const dist = Math.sqrt(dx*dx + dy*dy); const maxDist = rect.width/2;
        if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        uniState.joy.nx = dx / maxDist; uniState.joy.ny = dy / maxDist;
    }

    function initUniverse() {
        uCan.width = window.innerWidth; uCan.height = window.innerHeight;
        uniState.stars = []; for(let i=0; i<200; i++) uniState.stars.push({ x: Math.random()*5000-2500, y: Math.random()*5000-2500, size: Math.random()*2+1, color: '#fff' });
        uniState.px = 0; uniState.py = 0; uniState.vx = 0; uniState.vy = 0; uniState.enemies = []; uniState.particles = [];
        player.hp = getPlayerStats().hp; spawnUniEnemy(500, 500);
        requestAnimationFrame(universeLoop);
    }

    function spawnUniEnemy(x, y) {
        const hp = getPlayerStats().atk * 3;
        uniState.enemies.push({ x: x, y: y, vx: 0, vy: 0, hp: hp, maxHp: hp, hist: [], hitCooldown: 0 });
    }

    function universeLoop() {
        if(!uniState.active) return; const w = uCan.width; const h = uCan.height;
        uCtx.fillStyle = "rgba(5, 5, 10, 0.4)"; uCtx.fillRect(0, 0, w, h);
        if(uniState.dead) return;

        const pStats = getPlayerStats();
        uniState.vx += uniState.joy.nx * 2; uniState.vy += uniState.joy.ny * 2;
        uniState.vx *= 0.94; uniState.vy *= 0.94; uniState.px += uniState.vx; uniState.py += uniState.vy;
        document.getElementById('uni-hp-fill').style.width = (player.hp / pStats.hp * 100) + '%';
        
        uniState.cx += (uniState.px - uniState.cx) * 0.1; uniState.cy += (uniState.py - uniState.cy) * 0.1;
        uCtx.save(); uCtx.translate(w/2 - uniState.cx, h/2 - uniState.cy);
        
        uniState.stars.forEach(s => { uCtx.fillStyle = s.color; uCtx.beginPath(); uCtx.arc(s.x, s.y, s.size, 0, Math.PI*2); uCtx.fill(); });
        uCtx.fillStyle = 'cyan'; uCtx.beginPath(); uCtx.arc(uniState.px, uniState.py, 15, 0, Math.PI*2); uCtx.fill();

        for(let i = uniState.enemies.length - 1; i >= 0; i--) {
            let e = uniState.enemies[i]; const dx = uniState.px - e.x; const dy = uniState.py - e.y; const dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < 1500) { e.vx += (dx/dist)*0.6; e.vy += (dy/dist)*0.6; }
            e.vx *= 0.98; e.vy *= 0.98; e.x += e.vx; e.y += e.vy;
            
            uCtx.fillStyle = 'red'; uCtx.beginPath(); uCtx.arc(e.x, e.y, 14, 0, Math.PI*2); uCtx.fill();
            uCtx.fillStyle = 'red'; uCtx.fillRect(e.x-20, e.y+20, 40, 4); uCtx.fillStyle = '#0f0'; uCtx.fillRect(e.x-20, e.y+20, 40*(e.hp/e.maxHp), 4);

            if(dist < 35 && e.hitCooldown <= 0) {
                e.hp -= pStats.atk; player.hp -= (pStats.hp * 0.05); e.hitCooldown = 20;
                e.vx -= (dx/dist)*30; e.vy -= (dy/dist)*30; uniState.vx += (dx/dist)*15;
            }
            if(e.hp <= 0) {
                uniState.enemies.splice(i, 1); player.coins += 1000;
                document.getElementById('uni-kills').innerText = parseInt(document.getElementById('uni-kills').innerText) + 1;
                spawnUniEnemy(e.x + 100, e.y + 100); spawnUniEnemy(e.x - 100, e.y - 100);
            }
            if(e.hitCooldown > 0) e.hitCooldown--;
        }

        if(player.hp <= 0) { 
            uniState.dead = true; document.getElementById('respawn-overlay').style.display='flex';
            setTimeout(() => { uniState.dead=false; player.hp=pStats.hp; document.getElementById('respawn-overlay').style.display='none'; uniState.px=0; uniState.py=0; }, 5000);
        }
        uCtx.restore(); requestAnimationFrame(universeLoop);
    }

    // --- INIT ---
    loadGame(); syncUI();

})();
