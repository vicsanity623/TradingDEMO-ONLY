// Wrap logic in an IIFE to keep helper functions private, 
// but expose State Objects to the Window so other scripts can see them.
(function() {
    
    // --- CONSTANTS & CONFIG ---
    const CONFIG = {
        API_BASE: "https://dragonball-api.com/api",
        SAVE_KEY: 'dbz_gacha_save',
        CACHE_KEY: 'dbz_api_cache',
        SAVE_INTERVAL: 30000,
        CAPSULE_COOLDOWN: 60000
    };

    const ASSETS = {
        BASE: "IMG_0061.png",
        SSJ: "IMG_0062.png",
        BEAM: "hb_b.png"
    };

    const RANKS = ["BASE", "S", "SS", "SS2", "SS3", "SSG", "SSB", "UI", "MUI", "SSS", "SSS10"];
    const RARITY_NAMES = {1:"B", 2:"R", 3:"L", 4:"S", 5:"SS", 6:"SSS"};

    // --- STATE MANAGEMENT (GLOBAL) ---
    
    window.isDirty = false; 

    window.apiData = { characters: [], planets: [] };
    
    window.player = {
        lvl: 1, rank: 0, xp: 0, nextXp: 100, coins: 500,
        bAtk: 40, bDef: 25, bHp: 500, hp: 500, charge: 0,
        inv: [], gear: { w: null, a: null }, selected: -1,
        lastCapsule: 0,
        soulLevel: 1,
        souls: 0
    };

    window.battle = { 
        stage: 1, world: 1, maxStage: 1, 
        active: false, enemy: null, 
        autoTimerId: null, pInterval: null, eInterval: null, cinematic: false 
    };

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW failed', err));
        });
    }

    // --- MATH & STATS ---
    function getSoulMult() {
        const lvl = window.player.soulLevel || 1;
        return 1 + (lvl * 1.0); 
    }

    window.GameState = {
        get gokuLevel() { return window.player.lvl; },
        get gokuPower() {
            const rawAtk = window.player.bAtk + (window.player.rank * 400) + (window.player.gear.w?.val || 0);
            return Math.floor(rawAtk * getSoulMult());
        },
        get gokuHP() { return window.player.hp; },
        set gokuHP(v) { window.player.hp = v; },
        get gokuMaxHP() {
            const rawHp = window.player.bHp + (window.player.rank * 2500) + (window.player.gear.a?.val || 0);
            return Math.floor(rawHp * getSoulMult());
        },
        inBattle: false
    };

    // --- NEW: NUMBER FORMATTER (1M, 1B, 1T, 1A, 1AA...) ---
    window.formatNumber = function(num) {
        if (num < 1000000) return Math.floor(num).toLocaleString();

        const suffixes = ["", "K", "M", "B", "T"];
        // Calculate magnitude (log1000)
        let suffixNum = Math.floor(("" + Math.floor(num)).length / 3);
        
        let shortValue = parseFloat((num / Math.pow(1000, suffixNum)).toPrecision(3));
        
        if (shortValue < 1) {
            shortValue *= 1000;
            suffixNum--;
        }

        let suffix = "";
        if (suffixNum < suffixes.length) {
            suffix = suffixes[suffixNum];
        } else {
            // Generate A, AA, AB logic for numbers > Trillion
            let alphaNum = suffixNum - suffixes.length; 
            // 0 = A, 1 = AA isn't standard, usually A, B, C or aa, ab.
            // Let's do: A, B, C... then AA, AB...
            
            // Simple Single/Double char generator
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            if (alphaNum < 26) {
                suffix = alphabet[alphaNum];
            } else {
                let first = Math.floor(alphaNum / 26) - 1;
                let second = alphaNum % 26;
                suffix = alphabet[first] + alphabet[second];
            }
        }

        return shortValue + suffix;
    };

    // --- NEW: DETAILS MODAL ---
    window.openDetails = function() {
        const modal = document.getElementById('details-modal');
        if(!modal) return;

        const p = window.player;
        const sMult = getSoulMult();
        const baseAtk = p.bAtk + (p.rank * 400);
        const gearAtk = p.gear.w?.val || 0;
        const baseDef = p.bDef + (p.rank * 150);
        const gearDef = p.gear.a?.val || 0;
        
        // Populate
        document.getElementById('det-power').innerText = window.formatNumber(window.GameState.gokuPower);
        document.getElementById('det-hp').innerText = window.formatNumber(window.GameState.gokuMaxHP);
        document.getElementById('det-atk').innerText = window.formatNumber(baseAtk + gearAtk);
        document.getElementById('det-def').innerText = window.formatNumber(baseDef + gearDef);
        document.getElementById('det-soul').innerText = `x${sMult.toFixed(1)} (+${(sMult-1)*100}%)`;
        document.getElementById('det-crit').innerText = `${(1 + p.rank * 0.5).toFixed(1)}%`;
        document.getElementById('det-coins').innerText = window.formatNumber(p.coins);
        
        // Show
        modal.style.display = 'flex';
    };

    window.closeDetails = function() {
        document.getElementById('details-modal').style.display = 'none';
    };

    // --- INITIALIZATION ---
    async function initGame() {
        try {
            const cachedData = localStorage.getItem(CONFIG.CACHE_KEY);
            if (cachedData) {
                window.apiData = JSON.parse(cachedData);
            } else {
                const [charRes, planRes] = await Promise.all([
                    fetch(`${CONFIG.API_BASE}/characters?limit=58`),
                    fetch(`${CONFIG.API_BASE}/planets?limit=20`)
                ]);
                window.apiData.characters = (await charRes.json()).items;
                window.apiData.planets = (await planRes.json()).items;
                localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(window.apiData));
            }
            
            loadGame();
            if(!window.player.soulLevel) window.player.soulLevel = 1;
            if(!window.player.souls) window.player.souls = 0;

            document.getElementById('loader').style.display = 'none';
            syncUI();
            
            if(typeof window.buildStageSelector === 'function') window.buildStageSelector();
            if(typeof window.initStrategy === 'function') window.initStrategy();
            if(window.SoulSystem) window.SoulSystem.updateBtnUI(); 
            if(window.HubBattle) window.HubBattle.init();
            
            setupRebirthHandler();
        
            setInterval(saveGame, CONFIG.SAVE_INTERVAL);
            setInterval(updateCapsuleBtn, 1000);
            
        } catch (e) {
            console.error("Game Init Error", e);
            document.getElementById('loader').style.display = 'none';
        }
    }

    // --- REBIRTH HANDLER ---
    function setupRebirthHandler() {
        const btn = document.getElementById('btn-rebirth');
        if(!btn) return;
        let intervalId = null, timeoutId = null;

        const performAction = () => {
            let didTrain = false;
            if (window.player.coins >= 100) { train('atk', true); didTrain = true; }
            if (window.player.coins >= 100) { train('def', true); didTrain = true; }

            if (didTrain) updateStatsOnly();
            else {
                if (intervalId) { clearInterval(intervalId); intervalId = null; syncUI(); }
            }
        };

        const start = (e) => {
            if(e.cancelable && e.type === 'touchstart') e.preventDefault();
            performAction();
            timeoutId = setTimeout(() => { intervalId = setInterval(performAction, 20); }, 300);
        };
        const end = (e) => {
            if(e.cancelable && e.type === 'touchend') e.preventDefault();
            clearTimeout(timeoutId);
            if (intervalId) { clearInterval(intervalId); intervalId = null; }
            syncUI();
        };

        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
        btn.addEventListener('touchstart', start, {passive: false});
        btn.addEventListener('touchend', end);
        btn.addEventListener('touchcancel', end);
    }

    function updateStatsOnly() {
        const atk = window.GameState.gokuPower; 
        const rawDef = window.player.bDef + (window.player.rank * 150) + (window.player.gear.a?.val || 0);
        const def = Math.floor(rawDef * getSoulMult());

        // Use Formatter here
        document.getElementById('ui-atk').innerText = window.formatNumber(atk);
        document.getElementById('ui-def').innerText = window.formatNumber(def);
        document.getElementById('ui-coins').innerText = window.formatNumber(window.player.coins);
        document.getElementById('ui-power').innerText = window.formatNumber(atk * 30 + window.GameState.gokuMaxHP);
    }

    // --- CORE LOGIC ---
    function showLevelUp(oldLvl, newLvl) {
        if(window.battle.active) window.battle.cinematic = true;
        document.getElementById('lvl-up-old').innerText = oldLvl;
        document.getElementById('lvl-up-new').innerText = newLvl;
        
        document.getElementById('lvl-stats-hp').innerText = window.formatNumber(window.GameState.gokuMaxHP);
        document.getElementById('lvl-stats-atk').innerText = window.formatNumber(window.GameState.gokuPower);
        // Calc def
        const rawDef = window.player.bDef + (window.player.rank * 150) + (window.player.gear.a?.val || 0);
        document.getElementById('lvl-stats-def').innerText = window.formatNumber(Math.floor(rawDef * getSoulMult()));

        const img = (window.player.rank >= 1) ? ASSETS.SSJ : ASSETS.BASE;
        document.getElementById('lvl-up-img').src = img;
        document.getElementById('levelup-modal').style.display = 'flex';
    }

    function closeLevelUp() {
        document.getElementById('levelup-modal').style.display = 'none';
        if(window.GameState.inBattle && window.battle.active) window.battle.cinematic = false;
    }

    function checkLevelUp() {
        let leveledUp = false;
        const oldLvl = window.player.lvl;
        while(window.player.xp >= window.player.nextXp) {
            window.player.lvl++; 
            window.player.xp -= window.player.nextXp; 
            window.player.nextXp = Math.floor(window.player.nextXp * 1.3);
            window.player.bHp += 250; window.player.bAtk += 5; window.player.bDef += 2;
            window.player.hp = window.GameState.gokuMaxHP;
            if(window.player.lvl >= 100) { window.player.lvl = 1; window.player.rank++; }
            leveledUp = true;
        }
        if(leveledUp) {
            showLevelUp(oldLvl, window.player.lvl);
            syncUI();
            saveGame();
        }
    }

    function claimSupply() {
        const now = Date.now();
        if(!window.player.lastCapsule) window.player.lastCapsule = 0;
        const diff = now - window.player.lastCapsule;
        if(diff < CONFIG.CAPSULE_COOLDOWN) {
            alert(`Supply Capsule recharging... ${Math.ceil((CONFIG.CAPSULE_COOLDOWN - diff) / 1000)}s remaining.`);
            return;
        }
        window.player.lastCapsule = now;
        const base = 50 * (window.player.lvl || 1);
        const xpGain = Math.floor(base * (0.8 + Math.random() * 0.4));
        const coinGain = Math.floor(base * 0.5);
        window.player.xp += xpGain;
        window.player.coins += coinGain;
        window.isDirty = true;
        
        let msg = `SUPPLY DROP RECEIVED!\n\n+${window.formatNumber(xpGain)} XP\n+${window.formatNumber(coinGain)} Coins`;
        if(Math.random() < 0.3) {
            window.addToInventory({ n: "Capsule Gear", type: Math.random() > 0.5 ? 'w' : 'a', val: 700, rarity: 1 });
            msg += `\n+1 Saiyan Gear`;
        }
        checkLevelUp();
        syncUI();
        saveGame();
        if(document.getElementById('levelup-modal').style.display === 'none') alert(msg);
        updateCapsuleBtn();
    }

    function updateCapsuleBtn() {
        const btn = document.getElementById('btn-supply');
        if(!btn) return;
        const diff = Date.now() - (window.player.lastCapsule || 0);
        if(diff >= CONFIG.CAPSULE_COOLDOWN) {
            btn.innerHTML = "<i>🎁</i> Supply Ready!";
            btn.classList.add('btn-ready');
            btn.style.color = "#fff";
        } else {
            btn.innerHTML = `<i>⏳</i> ${Math.ceil((CONFIG.CAPSULE_COOLDOWN - diff) / 1000)}s`;
            btn.classList.remove('btn-ready');
            btn.style.color = "#777";
        }
    }

    function tapTrain() {
        window.player.xp += Math.ceil(window.player.lvl / 2);
        window.player.coins += 1;
        window.isDirty = true;
        popDamage(`+${Math.ceil(window.player.lvl / 2)} XP`, 'view-char', true);
        checkLevelUp();
        syncUI();
    }

    function saveGame() {
        if (!window.isDirty) return;
        window.player.lastSave = Date.now(); 
        const saveData = {
            player: window.player,
            battle: { stage: window.battle.stage, world: window.battle.world, maxStage: window.battle.maxStage }
        };
        localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(saveData));
        window.isDirty = false;
    }

    function loadGame() {
        const saved = localStorage.getItem(CONFIG.SAVE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if(parsed.player) window.player = parsed.player;
                if(parsed.battle) {
                    window.battle.stage = parsed.battle.stage || 1;
                    window.battle.world = parsed.battle.world || 1;
                    window.battle.maxStage = parsed.battle.maxStage || 1;
                }
                window.player.inv.forEach(i => { if(!i.qty) i.qty = 1; });
            } catch (e) { console.error("Corrupted Save"); }
        }
    }

    window.addEventListener('beforeunload', () => { window.isDirty = true; saveGame(); });

    function showTab(t) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        document.getElementById('view-' + t).classList.add('active-screen');
        document.getElementById('tab-' + t).classList.add('active');
        
        if(t === 'battle') {
            if(window.HubBattle) window.HubBattle.stop();
            if(!window.battle.active) {
                document.getElementById('start-prompt').style.display = 'block';
                document.getElementById('e-img').style.display = 'none';
                document.getElementById('e-name').innerText = "";
            }
        } else {
            if(window.HubBattle) window.HubBattle.start();
            if(typeof window.stopCombat === 'function') window.stopCombat();
            document.getElementById('battle-menu').style.display = 'none';
        }
        syncUI();
    }

    function addToInventory(item) {
        const found = window.player.inv.find(i => i.n === item.n && i.type === item.type && i.val === item.val && i.rarity === item.rarity && i.qty < 99);
        if(found) found.qty++; else { item.qty = 1; window.player.inv.push(item); }
        window.isDirty = true;
    }

    function syncUI() {
        const sprite = (window.player.rank >= 1) ? ASSETS.SSJ : ASSETS.BASE;
        document.getElementById('ui-sprite').src = sprite;
        document.getElementById('btl-p-sprite').src = sprite;
        document.getElementById('ui-aura').style.display = (window.player.rank >= 1) ? "block" : "none";
        
        const atk = window.GameState.gokuPower;
        const maxHp = window.GameState.gokuMaxHP;
        const rawDef = window.player.bDef + (window.player.rank * 150) + (window.player.gear.a?.val || 0);
        const def = Math.floor(rawDef * getSoulMult());

        document.getElementById('ui-rank-badge').innerText = RANKS[window.player.rank].substring(0,2);
        document.getElementById('ui-name').innerText = window.player.rank > 0 ? "Goku " + RANKS[window.player.rank] : "Goku";
        document.getElementById('ui-lvl').innerText = window.player.lvl;
        
        // USE FORMATTER HERE
        document.getElementById('ui-atk').innerText = window.formatNumber(atk);
        document.getElementById('ui-def').innerText = window.formatNumber(def);
        document.getElementById('ui-coins').innerText = window.formatNumber(window.player.coins);
        document.getElementById('ui-hp-txt').innerText = window.formatNumber(Math.floor(window.player.hp));
        document.getElementById('ui-power').innerText = window.formatNumber(atk * 30 + maxHp);
        
        const xpPct = (window.player.xp / window.player.nextXp) * 100;
        document.getElementById('bar-xp').style.width = xpPct + "%";
        
        // Inventory Grid
        const grid = document.getElementById('inv-grid');
        grid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        const mergeBtn = document.getElementById('btn-merge');
        const equipBtn = document.getElementById('btn-action');
        mergeBtn.style.display = 'none';
        equipBtn.style.display = 'flex'; 

        window.player.inv.forEach((item, i) => {
            const d = document.createElement('div');
            let rClass = 'item-basic';
            if(item.rarity === 2) rClass = 'item-rare';
            if(item.rarity === 3) rClass = 'item-legendary';
            if(item.rarity === 4) rClass = 'item-s';
            if(item.rarity === 5) rClass = 'item-ss';
            if(item.rarity === 6) rClass = 'item-sss';
            
            d.className = `inv-item ${rClass} ${window.player.selected === i ? 'selected' : ''}`;
            let rName = RARITY_NAMES[item.rarity] || "B";
            let qtyHtml = item.qty > 1 ? `<div class="qty-badge">x${item.qty}</div>` : '';
            d.innerHTML = `<span>${item.type === 'w' ? '⚔️' : '🛡️'}</span><span>${rName}</span>${qtyHtml}`;
            d.onclick = () => { window.player.selected = i; syncUI(); };
            fragment.appendChild(d);
        });
        grid.appendChild(fragment);

        updateVisualSlot('w', 'slot-w');
        updateVisualSlot('a', 'slot-a');

        if(window.player.selected !== -1) {
            const sItem = window.player.inv[window.player.selected];
            let totalCount = 0;
            window.player.inv.forEach(i => {
                if(i.n === sItem.n && i.type === sItem.type && i.rarity === sItem.rarity) totalCount += i.qty;
            });

            if(totalCount >= 3 && sItem.rarity < 6) {
                mergeBtn.style.display = 'flex';
                equipBtn.style.display = 'none';
                mergeBtn.innerHTML = `<span>⬆️ MERGE (3) - $${window.formatNumber(sItem.rarity * 500)}</span>`;
            } else {
                equipBtn.innerHTML = `<span>EQUIP ${sItem.type === 'w' ? 'WEAPON' : 'ARMOR'}</span>`;
            }
        } else {
            equipBtn.innerHTML = `<span>SELECT GEAR</span>`;
        }
        
        if(window.SoulSystem) window.SoulSystem.updateBtnUI();
    }

    function updateVisualSlot(type, id) {
        const el = document.getElementById(id);
        const item = window.player.gear[type];
        if(item) {
            el.className = 'slot-box slot-filled';
            let rColor = '#333';
            if(item.rarity === 2) rColor = '#00d2ff';
            if(item.rarity === 3) rColor = '#ff00ff';
            if(item.rarity === 4) rColor = '#e74c3c';
            if(item.rarity === 5) rColor = '#f1c40f';
            if(item.rarity === 6) rColor = '#00ffff';
            el.style.borderColor = rColor;
            el.innerHTML = `<span>${type === 'w' ? '⚔️' : '🛡️'}</span><div class="slot-label" style="color:${rColor}">${window.formatNumber(item.val)}</div>`;
        } else {
            el.className = 'slot-box';
            el.style.borderColor = '#b2bec3';
            el.innerHTML = `<span>${type === 'w' ? '⚔️' : '🛡️'}</span><div class="slot-label">${type === 'w' ? 'WEAPON' : 'ARMOR'}</div>`;
        }
    }

    function mergeItems() {
        if(window.player.selected === -1) return;
        const sItem = window.player.inv[window.player.selected];
        const cost = sItem.rarity * 500;
        if(window.player.coins < cost) { alert("Not enough coins!"); return; }

        let totalCount = 0;
        window.player.inv.forEach(i => { if(i.n === sItem.n && i.type === sItem.type && i.rarity === sItem.rarity) totalCount += i.qty; });

        if(totalCount >= 3) {
            window.player.coins -= cost;
            let needed = 3;
            for(let i = window.player.inv.length - 1; i >= 0; i--) {
                if(needed <= 0) break;
                let item = window.player.inv[i];
                if(item.n === sItem.n && item.type === sItem.type && item.rarity === sItem.rarity) {
                    if(item.qty >= needed) { item.qty -= needed; needed = 0; if(item.qty === 0) window.player.inv.splice(i, 1); }
                    else { needed -= item.qty; window.player.inv.splice(i, 1); }
                }
            }
            const newRarity = sItem.rarity + 1;
            let newVal = Math.floor(sItem.val * 2);
            let newName = "Saiyan Gear";
            if (newRarity === 2) { newVal = 1500; newName = "Elite Gear"; }      
            else if (newRarity === 3) { newVal = 3500; newName = "Legendary Gear"; } 
            else if (newRarity === 4) { newVal = 8500; newName = "God Gear"; }       
            else if (newRarity === 5) { newVal = 20000; newName = "Angel Gear"; }    
            else if (newRarity === 6) { newVal = 50000; newName = "Omni Gear"; }     

            window.addToInventory({ n: newName, type: sItem.type, val: newVal, rarity: newRarity });
            window.player.selected = -1;
            window.isDirty = true;
            syncUI();
        }
    }

    function train(s, skipSync = false) {
        if(window.player.coins >= 100) {
            window.player.coins -= 100;
            if(s === 'atk') window.player.bAtk += 20; else window.player.bDef += 10;
            window.isDirty = true;
            if(!skipSync) syncUI();
        } else {
            if(!skipSync) alert("Need 100 Coins to Train!");
        }
    }

    function doEquip() {
        if(window.player.selected === -1) return;
        const stackItem = window.player.inv[window.player.selected]; 
        const itemToEquip = { n: stackItem.n, type: stackItem.type, val: stackItem.val, rarity: stackItem.rarity, qty: 1 };
        const old = window.player.gear[stackItem.type]; 
        window.player.gear[stackItem.type] = itemToEquip;
        stackItem.qty--;
        if(stackItem.qty <= 0) window.player.inv.splice(window.player.selected, 1);
        if(old) window.addToInventory(old);
        window.player.selected = -1;
        window.isDirty = true;
        syncUI();
    }

    function popDamage(dmg, id, isSpecial = false) {
        const d = document.createElement('div');
        d.className = 'pop';
        if (typeof dmg === 'string') {
            d.innerText = dmg; 
            d.style.color = '#00ff00'; 
            d.style.fontSize = '1.5rem';
        } else {
            d.innerText = "-" + window.formatNumber(dmg);
            if(isSpecial) { d.style.color = 'cyan'; d.style.fontSize = '3rem'; d.style.zIndex = 30; }
        }
        const randomX = (Math.random() * 40) - 20; 
        const randomY = (Math.random() * 40) - 20;
        const container = document.getElementById(id);
        if(container) {
            d.style.left = id === 'view-char' ? `50%` : `calc(50% + ${randomX}px)`;
            d.style.top = id === 'view-char' ? `40%` : `calc(20% + ${randomY}px)`;
            container.appendChild(d);
            setTimeout(() => d.remove(), 600);
        }
    }

    window.initGame = initGame;
    window.showTab = showTab;
    window.claimSupply = claimSupply;
    window.tapTrain = tapTrain;
    window.train = train;
    window.doEquip = doEquip;
    window.mergeItems = mergeItems;
    window.closeLevelUp = closeLevelUp;
    window.checkLevelUp = checkLevelUp;
    window.addToInventory = addToInventory;
    window.syncUI = syncUI;
    window.popDamage = popDamage;

})();
