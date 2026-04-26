// tower.js - Standalone Engine (Fixed Walls, Persistence, Dashboards, & RPG Stats)

(function () {

    const SAVE_KEY = "dbz_tower_standalone_v1";

    const DEFAULT_PLAYER = {
        lvl: 1, xp: 0, nextXp: 100, coins: 0, sp: 0,
        bAtk: 50, bDef: 20, bHp: 1000, 
        stats: { hp: 0, regen: 0, atk: 0, def: 0, res: 0, xp: 0, gold: 0, crit: 0 },
        inv: [], gear: { w: null, a: null }, selected: -1,
        dungeonKeys: 10, senzuBeans: 0, maxFloor: 1, 
        shop: { zsword: 0, potara: 0, godki: 0 },
        dStats: { dmgDealt: 0, hardestHit: 0, lootFound: 0, dmgTaken: 0, kills: 0 }
    };

    window.player = structuredClone(DEFAULT_PLAYER);

    function saveGame() { localStorage.setItem(SAVE_KEY, JSON.stringify(player)); }

    function loadGame() {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                window.player = { ...DEFAULT_PLAYER, ...parsed };
                if(parsed.shop) window.player.shop = { ...DEFAULT_PLAYER.shop, ...parsed.shop };
                if(parsed.dStats) window.player.dStats = { ...DEFAULT_PLAYER.dStats, ...parsed.dStats };
                if(parsed.gear) window.player.gear = { ...DEFAULT_PLAYER.gear, ...parsed.gear };
                if(parsed.stats) window.player.stats = { ...DEFAULT_PLAYER.stats, ...parsed.stats };
            }
        } catch (e) { console.error("Save corrupted, reset to default."); }
    }

    setInterval(saveGame, 5000);

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

    function getPlayerStats() {
        const wVal = player.gear.w ? player.gear.w.val : 0;
        const aVal = player.gear.a ? player.gear.a.val : 0;
        
        // Skill Point Multipliers
        const skillHpMult = 1 + (player.stats.hp * 0.1);    
        const skillAtkMult = 1 + (player.stats.atk * 0.1);  
        const skillDefMult = 1 + (player.stats.def * 0.1);  
        
        const shopW = player.shop.zsword * 1000;
        const shopA = player.shop.potara * 1000;
        const globalMult = Math.pow(2, player.shop.godki);

        return {
            hp: Math.floor((player.bHp + (player.lvl * 100) + (aVal * 5)) * skillHpMult * globalMult),
            atk: Math.floor((player.bAtk + (player.lvl * 10) + wVal + shopW) * skillAtkMult * globalMult),
            def: Math.floor((player.bDef + (player.lvl * 5) + aVal + shopA) * skillDefMult * globalMult),
            regen: player.stats.regen * 0.0005, // HP regen per frame
            res: Math.min(0.5, player.stats.res * 0.02), // Max 50% damage reduction
            crit: Math.min(20, player.stats.crit), // Max 20% crit chance
            xpBonus: 1 + (player.stats.xp * 0.05),
            goldBonus: 1 + (player.stats.gold * 0.05)
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

    window.showTab = function(tab) {
        if (combatState.active) stopCombat();
        if (tab === 'universe') initUniverse(); else if(typeof uniState !== 'undefined') uniState.active = false;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + tab).classList.add('active-screen');
        document.getElementById('tab-' + tab).classList.add('active');
        syncUI();
    };

    function syncUI() {
        try {
            const stats = getPlayerStats();
            document.getElementById('ui-lvl').innerText = player.lvl;
            document.getElementById('ui-hp').innerText = formatNum(stats.hp);
            document.getElementById('ui-atk').innerText = formatNum(stats.atk);
            document.getElementById('ui-def').innerText = formatNum(stats.def);
            document.getElementById('ui-gold').innerText = formatNum(player.coins);
            document.getElementById('ui-xp-fill').style.width = (player.xp / player.nextXp * 100) + '%';
            document.getElementById('ui-xp-text').innerText = `${formatNum(player.xp)} / ${formatNum(player.nextXp)}`;
            
            // Skill Points UI
            if(document.getElementById('ui-sp-badge')) document.getElementById('ui-sp-badge').style.display = player.sp > 0 ? 'inline' : 'none';
            if(document.getElementById('ui-sp-count')) document.getElementById('ui-sp-count').innerText = player.sp;

            // Optional Gear Displays (Safe check to prevent crash)
            if(document.getElementById('ui-eq-w')) document.getElementById('ui-eq-w').innerText = player.gear.w ? `+${formatNum(player.gear.w.val)}` : "0";
            if(document.getElementById('ui-eq-a')) document.getElementById('ui-eq-a').innerText = player.gear.a ? `+${formatNum(player.gear.a.val)}` : "0";

            document.getElementById('ui-keys').innerText = player.dungeonKeys;
            document.getElementById('ui-senzu').innerText = player.senzuBeans;
            document.getElementById('ui-max-floor').innerText = player.maxFloor;

            if(document.getElementById('stat-dmg-dealt')) document.getElementById('stat-dmg-dealt').innerText = formatNum(player.dStats.dmgDealt);
            if(document.getElementById('stat-hardest-hit')) document.getElementById('stat-hardest-hit').innerText = formatNum(player.dStats.hardestHit);
            if(document.getElementById('stat-loot-found')) document.getElementById('stat-loot-found').innerText = formatNum(player.dStats.lootFound);
            if(document.getElementById('stat-dmg-taken')) document.getElementById('stat-dmg-taken').innerText = formatNum(player.dStats.dmgTaken);

            renderInventory();
            renderDungeons();
        } catch(e) { console.warn("SyncUI error: ", e); }
    }

    // --- RPG STAT UPGRADES ---
    const STAT_DEFS = [
        { id: 'hp', name: 'Health', desc: '+10% Max HP' },
        { id: 'regen', name: 'Regen', desc: '+0.5% HP/tick' },
        { id: 'atk', name: 'Attack Power', desc: '+10% Total ATK' },
        { id: 'def', name: 'Defense', desc: '+10% Total DEF' },
        { id: 'res', name: 'Damage Resistance', desc: '+2% (Max 50%)' },
        { id: 'xp', name: 'XP Gain', desc: '+5% XP' },
        { id: 'gold', name: 'Gold Gain', desc: '+5% Gold' },
        { id: 'crit', name: 'Critical Chance', desc: '+1% (Max 20%)' }
    ];

    window.openStatPanel = function() {
        const list = document.getElementById('stat-list');
        if(!list) return;
        list.innerHTML = '';
        STAT_DEFS.forEach(s => {
            const row = document.createElement('div');
            row.style.cssText = "background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;";
            row.innerHTML = `
                <div style="text-align:left;">
                    <div style="font-weight:bold; color:white; font-size:0.9rem;">${s.name} [Lv. ${player.stats[s.id]}]</div>
                    <div style="font-size:0.65rem; color:#aaa;">${s.desc}</div>
                </div>
                <button class="btn btn-green" style="padding:5px 15px; font-size:1rem; flex:none;" onclick="upgradeStat('${s.id}')">UP</button>
            `;
            list.appendChild(row);
        });
        document.getElementById('stat-modal').style.display = 'flex';
        document.getElementById('ui-sp-count').innerText = player.sp;
    };

    window.upgradeStat = function(statId) {
        if (player.sp <= 0) return;
        if (statId === 'crit' && player.stats.crit >= 20) return;
        if (statId === 'res' && player.stats.res >= 25) return;
        
        player.sp--;
        player.stats[statId]++;
        syncUI();
        openStatPanel();
        saveGame();
    };

    window.farmGold = function() {
        const stats = getPlayerStats();
        player.coins += Math.floor(100 * player.lvl * stats.goldBonus);
        player.xp += Math.floor(15 * player.lvl * stats.xpBonus);
        checkLevelUp(); syncUI();
    };

    function checkLevelUp() {
        while(player.xp >= player.nextXp) {
            player.xp -= player.nextXp; 
            player.lvl++;
            player.sp++; 
            player.nextXp = Math.floor(player.nextXp * 1.5);
            player.bHp += 200; player.bAtk += 20; player.bDef += 10;
        }
    }

    function addToInv(item) {
        // If item doesn't have a buff, give it one
        if (!item.buff) {
            const buffs = [
                { id: 'atkSpd', name: 'Attack Speed', val: 5 + Math.floor(Math.random() * 10) },
                { id: 'critDmg', name: 'Crit Multiplier', val: 10 + Math.floor(Math.random() * 20) },
                { id: 'dodge', name: 'Dodge Chance', val: 1 + Math.floor(Math.random() * 5) }
            ];
            item.buff = buffs[Math.floor(Math.random() * buffs.length)];
        }

        const found = player.inv.find(i => i.n === item.n && i.val === item.val && i.buff?.id === item.buff?.id);
        if (found) found.qty++; 
        else { item.qty = 1; player.inv.push(item); }
        syncUI();
    }

    function renderInventory() {
        const grid = document.getElementById('inv-grid'); if(!grid) return;
        grid.innerHTML = '';
        player.inv.forEach((item, i) => {
            const el = document.createElement('div'); el.className = `inv-item`;
            let color = (item.val > 20000) ? "var(--cyan)" : (item.val > 5000 ? "var(--red)" : "white");
            el.innerHTML = `<span style="font-size:1.5rem;">${item.type === 'w' ? '⚔️' : '🛡️'}</span><span style="color:${color}; font-weight:bold; margin-top:5px;">${formatNum(item.val)}</span>${item.qty > 1 ? `<div class="qty-badge">x${item.qty}</div>` : ''}`;
            el.onclick = () => openItemModal(i); 
            grid.appendChild(el);
        });
    }

    window.openItemModal = function(index) {
        const item = player.inv[index];
        if(!item) return;

        const modal = document.getElementById('item-modal');
        document.getElementById('item-icon').innerText = item.type === 'w' ? '⚔️' : '🛡️';
        document.getElementById('item-name').innerText = item.n;
        document.getElementById('item-main-val').innerText = `+${formatNum(item.val)} ${item.type === 'w' ? 'ATK' : 'DEF'}`;
        
        const buffCont = document.getElementById('item-buff-container');
        buffCont.innerHTML = item.buff ? `<span class="buff-text">✦ ${item.buff.name}: +${item.buff.val}%</span>` : '';

        // Buttons
        document.getElementById('modal-equip-btn').onclick = () => { equipItem(index); modal.style.display = 'none'; };
        document.getElementById('modal-sell-btn').onclick = () => { sellItem(index); modal.style.display = 'none'; };
        
        const mBtn = document.getElementById('modal-merge-btn');
        if (item.qty >= 3) {
            mBtn.style.display = 'block';
            mBtn.onclick = () => { mergeItem(index); modal.style.display = 'none'; };
        } else {
            mBtn.style.display = 'none';
        }

        modal.style.display = 'flex';
    }

    function equipItem(index) {
        const item = player.inv[index];
        const old = player.gear[item.type];
        player.gear[item.type] = { ...item, qty: 1 };
        item.qty--;
        if(item.qty <= 0) player.inv.splice(index, 1);
        if(old) addToInv(old);
        syncUI(); saveGame();
    }

    function sellItem(index) {
        const item = player.inv[index];
        player.coins += Math.floor(item.val * 0.5);
        item.qty--;
        if(item.qty <= 0) player.inv.splice(index, 1);
        syncUI(); saveGame();
    }

    function mergeItem(index) {
        const item = player.inv[index];
        item.qty -= 3;
        if(item.qty <= 0) player.inv.splice(index, 1);
        addToInv({ n: item.n + "+", type: item.type, val: item.val * 2, buff: item.buff });
        saveGame();
    }

    window.equipSelected = function() {
        if(player.selected === -1) return;
        const item = player.inv[player.selected]; if(!item) return;
        const old = player.gear[item.type]; player.gear[item.type] = { n: item.n, type: item.type, val: item.val, qty: 1 };
        item.qty--; if(item.qty <= 0) player.inv.splice(player.selected, 1);
        if(old) addToInv(old); player.selected = -1; syncUI(); saveGame();
    };

    window.mergeSelected = function() {
        if(player.selected === -1) return;
        const item = player.inv[player.selected]; if(!item || item.qty < 3) return;
        item.qty -= 3; if(item.qty <= 0) player.inv.splice(player.selected, 1);
        player.selected = -1; addToInv({ n: item.n + "+", type: item.type, val: item.val * 2 }); saveGame();
    };

    function renderDungeons() {
        const list = document.getElementById('dungeon-list'); if(!list) return;
        list.innerHTML = '';
        Object.keys(DUNGEONS).forEach(key => {
            const d = DUNGEONS[key]; const el = document.createElement('div');
            el.style.cssText = `background:rgba(20,20,30,0.9); border:2px solid ${d.color}; border-radius:10px; padding:15px; display:flex; align-items:center; gap:15px; flex-shrink: 0; min-height: 90px;`;
            el.innerHTML = `<div style="width:60px; height:60px; border-radius:50%; background:black; border:2px solid #fff; overflow:hidden; flex-shrink:0;"><img src="${d.img}" style="width:100%; height:100%; object-fit:cover;"></div><div style="flex:1;"><div style="font-family:'Bangers'; font-size:1.5rem; color:${d.color};">${d.name}</div><div style="font-size:0.75rem; color:#aaa;">HP: ${formatNum(d.hp)} | ATK: ${formatNum(d.atk)}</div></div><button class="btn btn-gold" style="padding:10px; flex:none; width:100px;" onclick="startCombat('dungeon', null, '${key}')">ENTER (1🗝️)</button>`;
            list.appendChild(el);
        });
    }

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
        player.senzuBeans -= cost; player.shop[id]++; syncUI(); openTowerShop(); saveGame();
    };

    // --- EXPLOSION PARTICLES ---
    function createExplosion(x, y, color) {
        const fxContainer = document.getElementById('cb-fx');
        if(!fxContainer) return;
        const particleCount = 40;
        for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.backgroundColor = color;
            p.style.left = x + "%";
            p.style.top = y + "%";
            const dx = (Math.random() - 0.5) * 300 + "px";
            const dy = (Math.random() - 0.5) * 300 + "px";
            p.style.setProperty('--dx', dx);
            p.style.setProperty('--dy', dy);
            fxContainer.appendChild(p);
            setTimeout(() => p.remove(), 1200);
        }
    }

    const trCanvas = document.getElementById('trail-canvas'); const trCtx = trCanvas.getContext('2d');
    function resizeTrails() { trCanvas.width = trCanvas.offsetWidth; trCanvas.height = trCanvas.offsetHeight; }
    window.addEventListener('resize', resizeTrails); resizeTrails();

    window.startCombat = function(type, floor = 1, bossKey = null) {
        if (type === 'tower') floor = player.maxFloor || 1; 
        if (type === 'dungeon' && player.dungeonKeys < 1) { alert("No Keys!"); return; }
        if (type === 'dungeon') player.dungeonKeys--;
        
        combatState.active = true; combatState.type = type; combatState.floor = floor; combatState.bossKey = bossKey; combatState.hitCooldown = 0;
        const stats = getPlayerStats();
        combatState.p = { hp: stats.hp, maxHp: stats.hp, atk: stats.atk, def: stats.def, x: 20, y: 50, vx: 0, vy: 0, el: document.getElementById('cb-player'), history: [] };
        
        spawnEnemy();
        document.getElementById('combat-modal').style.display = 'flex';
        document.getElementById('cb-fx').innerHTML = ''; 
        document.getElementById('cb-enemy').classList.remove('disintegrate');
        updateCombatUI();
        if(combatState.loopId) cancelAnimationFrame(combatState.loopId); combatLoop();
    };

    function spawnEnemy() {
        const c = combatState; 
        let eName, eImg, eHp, eAtk;
        
        if (c.type === 'dungeon') { 
            const d = DUNGEONS[c.bossKey]; 
            eName = d.name; eImg = d.img; eHp = d.hp; eAtk = d.atk; 
        } else { 
            const mult = Math.pow(1.15, c.floor - 1);
            const towerEnemies = [
                { n: "Cell Jr", i: "cell.png" },
                { n: "Majin Buu", i: "majin_buu.png" },
                { n: "Frieza", i: "freeza.png" }
            ];
            const enemyChoice = towerEnemies[(c.floor - 1) % towerEnemies.length];
            eName = `${enemyChoice.n} (F${c.floor})`; 
            eImg = enemyChoice.i; 
            eHp = Math.floor(5000 * mult); 
            eAtk = Math.floor(100 * mult); 
        }

        document.getElementById('combat-title').innerText = eName; 
        document.getElementById('combat-subtitle').innerText = c.type === 'tower' ? `Floor ${c.floor}` : "Boss Fight"; 
        document.getElementById('cb-enemy-img').src = eImg;
        c.e = { hp: eHp, maxHp: eHp, atk: eAtk, def: eAtk * 0.5, x: 80, y: 50, vx: 0, vy: 0, el: document.getElementById('cb-enemy'), stun: 0, history: [] };
    }

    function combatLoop() {
        if(!combatState.active) return;
        const p = combatState.p; const e = combatState.e; const dx = e.x - p.x; const dy = e.y - p.y; const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const pStats = getPlayerStats();

        // Regen
        p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * pStats.regen));

        if (dist > 10) { p.vx += (dx/dist)*0.7; p.vy += (dy/dist)*0.7; if(e.stun <= 0) { e.vx -= (dx/dist)*0.4; e.vy -= (dy/dist)*0.4; } else { e.stun--; e.vx *= 0.8; } }
        p.x += p.vx; p.y += p.vy; e.x += e.vx; e.y += e.vy; p.vx *= 0.88; p.vy *= 0.88; e.vx *= 0.88; e.vy *= 0.88;

        if(p.x < 5) { p.x=5; p.vx *= -1.5; } if(p.x > 95) { p.x=95; p.vx *= -1.5; }
        if(p.y < 20) { p.y=20; p.vy *= -1.5; } if(p.y > 80) { p.y=80; p.vy *= -1.5; }
        if(e.x < 5) { e.x=5; e.vx *= -1.5; } if(e.x > 95) { e.x=95; e.vx *= -1.5; }
        if(e.y < 20) { e.y=20; e.vy *= -1.5; } if(e.y > 80) { e.y=80; e.vy *= -1.5; }

        p.el.style.left = p.x + "%"; p.el.style.top = p.y + "%"; e.el.style.left = e.x + "%"; e.el.style.top = e.y + "%";
        p.history.unshift({x: p.x, y: p.y}); if(p.history.length > 15) p.history.pop();
        e.history.unshift({x: e.x, y: e.y}); if(e.history.length > 15) e.history.pop();
        drawTrails(p.history, e.history);

        if (dist < 15 && combatState.hitCooldown <= 0) {
            // Calculate Attack Speed bonus from Weapon
            const spdBonus = player.gear.w?.buff?.id === 'atkSpd' ? player.gear.w.buff.val : 0;
            combatState.hitCooldown = Math.max(5, 15 - Math.floor(spdBonus / 5));
            
            // Player Attack (With Crit)
            let isCrit = Math.random() * 100 < pStats.crit;
            let pDmg = Math.max(1, Math.floor(p.atk * (0.8 + Math.random() * 0.4)));
            if(isCrit) pDmg *= 2;
            e.hp -= pDmg; player.dStats.dmgDealt += pDmg; if (pDmg > player.dStats.hardestHit) player.dStats.hardestHit = pDmg;
            spawnPop(formatNum(pDmg), e.x, e.y, isCrit ? 'var(--orange)' : 'gold'); e.vx += (dx/dist) * 10; e.vy += (dy/dist) * 10; e.stun = 20;
            
            // Enemy Attack (With Resistance)
            const eDmg = Math.max(1, Math.floor((e.atk * (0.8 + Math.random() * 0.4) - (p.def * 0.2)) * (1 - pStats.res)));
            p.hp -= eDmg; player.dStats.dmgTaken += eDmg; spawnPop(formatNum(eDmg), p.x, p.y, 'var(--red)'); p.vx -= (dx/dist) * 10; p.vy -= (dy/dist) * 10;
            const arena = document.getElementById('combat-arena'); arena.classList.remove('epic-shake'); void arena.offsetWidth; arena.classList.add('epic-shake');
        }
        if(combatState.hitCooldown > 0) combatState.hitCooldown--;
        updateCombatUI();
        if (e.hp <= 0) handleEnemyDeath(); else if (p.hp <= 0) handlePlayerDeath(); else combatState.loopId = requestAnimationFrame(combatLoop);
    }

    function drawTrails(pHist, eHist) {
        trCtx.clearRect(0, 0, trCanvas.width, trCanvas.height); const w = trCanvas.width; const h = trCanvas.height;
        function drawLine(hist, color, glow) {
            if(hist.length < 2) return; trCtx.beginPath(); trCtx.moveTo(hist[0].x/100*w, hist[0].y/100*h);
            for(let i=1; i<hist.length; i++) trCtx.lineTo(hist[i].x/100*w, hist[i].y/100*h);
            trCtx.shadowBlur = 15; trCtx.shadowColor = glow; trCtx.strokeStyle = color; trCtx.lineWidth = 12; trCtx.lineCap = 'round'; trCtx.stroke();
        }
        drawLine(pHist, 'rgba(0, 229, 255, 0.4)', '#00e5ff'); drawLine(eHist, 'rgba(255, 0, 85, 0.4)', '#ff0055');
    }

    function handleEnemyDeath() {
        const c = combatState;
        if(!c.active) return;
        c.active = false; if (c.loopId) cancelAnimationFrame(c.loopId);
        
        const pStats = getPlayerStats();
        let explosionColor = "#50fa7b";
        if (c.bossKey === 'buu') explosionColor = "#ff79c6";
        if (c.bossKey === 'frieza') explosionColor = "#bd93f9";

        createExplosion(c.e.x, c.e.y, explosionColor);
        c.e.el.classList.add('disintegrate');

        setTimeout(() => {
            player.dStats.kills++;
            if (c.type === 'dungeon') {
                let baseVal = c.bossKey === 'cell' ? 15000 : (c.bossKey === 'frieza' ? 5000 : 1500);
                const gGain = Math.floor(baseVal * 2 * pStats.goldBonus);
                const xGain = Math.floor(player.lvl * 50 * pStats.xpBonus);
                addToInv({ n: "Boss Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: baseVal });
                player.coins += gGain; player.xp += xGain; player.dStats.lootFound++;
                c.lastSweepData = { coins: baseVal*2, gearVal: baseVal };
                showResult("VICTORY!", `Gained ${formatNum(gGain)} Gold & ${formatNum(xGain)} XP`, true);
            } else {
                const beanGain = Math.floor(c.floor * 1.5);
                const xpGain = Math.floor(c.floor * 25 * pStats.xpBonus);
                player.senzuBeans += beanGain; player.xp += xpGain;
                if (c.floor >= player.maxFloor) player.maxFloor = c.floor + 1;
                showResult("FLOOR CLEARED!", `Rewards:<br>🫘 +${beanGain} Beans<br>✨ +${formatNum(xpGain)} XP`);
            }
            checkLevelUp(); saveGame(); syncUI();
            document.getElementById('combat-modal').style.display = 'none';
        }, 1000);
    }

    function handlePlayerDeath() {
        stopCombat();
        showResult("BATTLE ENDED", combatState.type === 'tower' ? `Fell on Floor ${combatState.floor}` : "Go Train!");
        saveGame(); syncUI();
    }

    function updateCombatUI() {
        const c = combatState;
        if(!document.getElementById('cb-player-hp')) return;
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

    window.showResult = function(title, text, canSweep = false) {
        document.getElementById('res-title').innerText = title; document.getElementById('res-body').innerHTML = text;
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
        const pStats = getPlayerStats();
        if (sweepCount < 1 || sweepCount > player.dungeonKeys) return;
        player.dungeonKeys -= sweepCount; const sd = combatState.lastSweepData;
        player.coins += Math.floor(sd.coins * sweepCount * pStats.goldBonus);
        player.dStats.lootFound += sweepCount;
        for(let i=0; i<sweepCount; i++) addToInv({ n: "Boss Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: sd.gearVal });
        saveGame(); syncUI(); closeResult();
    };

    // --- UNIVERSE ENGINE ---
    const uCan = document.getElementById('uni-canvas'); const uCtx = uCan.getContext('2d');
    let uniState = { active: false, cx: 0, cy: 0, px: 0, py: 0, vx: 0, vy: 0, enemies: [], stars: [], particles: [], texts: [], dead: false, joy: { active: false, nx: 0, ny: 0 } };
    const joyZone = document.getElementById('joystick-zone'); const joyKnob = document.getElementById('joystick-knob');
    if(joyZone) {
        joyZone.addEventListener('touchstart', (e) => { e.preventDefault(); handleJoy(e); }, {passive: false});
        joyZone.addEventListener('touchmove', (e) => { e.preventDefault(); handleJoy(e); }, {passive: false});
        joyZone.addEventListener('touchend', () => { uniState.joy.active = false; joyKnob.style.transform = `translate(-50%, -50%)`; uniState.joy.nx = 0; uniState.joy.ny = 0; });
    }

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
        uCan.width = window.innerWidth; uCan.height = window.innerHeight; uniState.active = true; uniState.dead = false;
        uniState.stars = []; for(let i=0; i<200; i++) uniState.stars.push({ x: Math.random()*5000-2500, y: Math.random()*5000-2500, size: Math.random()*2+1, color: '#00e5ff' });
        uniState.px = 0; uniState.py = 0; uniState.vx = 0; uniState.vy = 0; uniState.enemies = []; uniState.particles = [];
        player.hp = getPlayerStats().hp; spawnUniEnemy(500, 500);
        requestAnimationFrame(universeLoop);
    }

    function spawnUniEnemy(x, y) { uniState.enemies.push({ x: x, y: y, vx: 0, vy: 0, hp: getPlayerStats().atk*3, maxHp: getPlayerStats().atk*3, hist: [], hitCooldown: 0 }); }

    function universeLoop() {
        if(!uniState.active) return; 
        const w = uCan.width; const h = uCan.height;
        uCtx.fillStyle = "rgba(5, 5, 10, 0.4)"; uCtx.fillRect(0, 0, w, h);
        if(uniState.dead) return;

        const pStats = getPlayerStats(); 
        
        // --- FIX 1: APPLY REGEN ---
        player.hp = Math.min(pStats.hp, player.hp + (pStats.hp * pStats.regen));
        
        uniState.vx += uniState.joy.nx * 2; uniState.vy += uniState.joy.ny * 2; 
        uniState.vx *= 0.92; uniState.vy *= 0.92; uniState.px += uniState.vx; uniState.py += uniState.vy;
        
        document.getElementById('uni-hp-fill').style.width = (player.hp / pStats.hp * 100) + '%';
        
        uniState.cx += (uniState.px - uniState.cx) * 0.1; uniState.cy += (uniState.py - uniState.cy) * 0.1;
        uCtx.save(); uCtx.translate(w/2 - uniState.cx, h/2 - uniState.cy);
        
        uniState.stars.forEach(s => { uCtx.fillStyle = s.color; uCtx.beginPath(); uCtx.arc(s.x, s.y, s.size, 0, Math.PI*2); uCtx.fill(); });
        uCtx.fillStyle = 'cyan'; uCtx.beginPath(); uCtx.arc(uniState.px, uniState.py, 15, 0, Math.PI*2); uCtx.fill();
        
        for(let i = uniState.enemies.length - 1; i >= 0; i--) {
            let e = uniState.enemies[i]; const dx = uniState.px - e.x; const dy = uniState.py - e.y; const dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < 1500) { e.vx += (dx/dist)*0.6; e.vy += (dy/dist)*0.6; } 
            e.vx *= 0.98; e.vy *= 0.98; e.x += e.vx; e.y += e.vy;
            
            uCtx.fillStyle = '#ff0055'; uCtx.beginPath(); uCtx.arc(e.x, e.y, 14, 0, Math.PI*2); uCtx.fill();
            
            if(dist < 35 && e.hitCooldown <= 0) { 
                e.hp -= pStats.atk; 
                player.hp -= (pStats.hp * 0.05); 
                e.vx -= (dx/dist)*30; e.vy -= (dy/dist)*30; 
                uniState.vx += (dx/dist)*15; uniState.vy += (dy/dist)*15; e.hitCooldown = 20; 
            }
            
            if(e.hp <= 0) { 
                uniState.enemies.splice(i, 1);
                
                // --- FIX 2: REWARDS & UI UPDATE ---
                player.dStats.kills++;
                const gGain = Math.floor(5000 * pStats.goldBonus);
                const xGain = Math.floor(50 * pStats.xpBonus);
                player.coins += gGain;
                player.xp += xGain;

                // Chance to drop dungeon key (5%)
                if (Math.random() < 0.05) {
                    player.dungeonKeys++;
                    spawnPop("KEY FOUND!", 50, 20, "var(--yellow)");
                }

                // Update Universe UI text
                document.getElementById('uni-kills').innerText = player.dStats.kills;
                document.getElementById('uni-gold').innerText = formatNum(player.coins);
                
                spawnUniEnemy(e.x+200, e.y+200);
                spawnUniEnemy(e.x-200, e.y-200);
                checkLevelUp();
            }
            if(e.hitCooldown > 0) e.hitCooldown--;
        }
        uCtx.restore(); 
        requestAnimationFrame(universeLoop);
    }

    loadGame(); syncUI();

})();