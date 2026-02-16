// Wrap logic in an IIFE to keep helper functions private, 
// but expose State Objects to the Window so other scripts can see them.
(function () {

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
        SSJ: "IMG_0081.png",
        BEAM: "hb_b.png"
    };

    const RANKS = ["BASE", "S", "SS", "SS2", "SS3", "SSG", "SSB", "UI", "MUI", "SSS", "SSS10"];
    const RARITY_NAMES = { 1: "B", 2: "R", 3: "L", 4: "S", 5: "SS", 6: "SSS", 7: "SSS2", 8: "SSS3", 9: "SSS4", 10: "SSS5" };

    // --- STATE MANAGEMENT (GLOBAL) ---

    window.isDirty = false;

    window.apiData = { characters: [], planets: [] };

    window.player = {
        lvl: 1, rank: 0, xp: 0, nextXp: 100, coins: 500,
        bAtk: 40, bDef: 25, bHp: 500, hp: 500, charge: 0,
        inv: [], gear: { w: null, a: null }, selected: -1,
        lastCapsule: 0,
        soulLevel: 1,
        souls: 0,
        dragonShards: 0,
        advanceLevel: 0,
        sp: 0,
        dungeonKeys: 0,
        dungeonLevel: { buu: 1, frieza: 1, cell: 1 },
        dailyLogin: { day: 1, lastClaimTime: 0 }
    };

    window.battle = {
        stage: 1, world: 1, maxStage: 1,
        active: false, enemy: null,
        autoTimerId: null, pInterval: null, eInterval: null, cinematic: false
    };
    
    window.exportSave = function() {
        const data = localStorage.getItem(CONFIG.SAVE_KEY);
        if(data) {
            navigator.clipboard.writeText(data).then(() => {
                alert("Save copied to clipboard!");
            });
        } else {
            alert("No save data found.");
        }
    }
    
    window.importSave = function() {
        const data = prompt("Paste your save string here:");
        if(data) {
            try {
                JSON.parse(data); 
                localStorage.setItem(CONFIG.SAVE_KEY, data);
                alert("Save loaded! Reloading...");
                location.reload();
            } catch(e) {
                alert("Invalid save data.");
            }
        }
    }

    let isAutoMerging = false;

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW failed', err));
        });
    }

    // --- MATH & STATS ---
    function getSoulMult() {
        const lvl = window.player.soulLevel || 1;
        return Math.pow(1.5, lvl);
    }

    // Main Adv Mult (10% per level)
    function getAdvMult() {
        return 1 + ((window.player.advanceLevel || 0) * 0.1); 
    }

    // --- NEW: SPECIFIC ADVANCE MULTIPLIERS ---
    function getHpAdvMult() {
        const lvl = window.player.advanceLevel || 0;
        if(lvl < 3) return 1.0;
        // Base 115% at lvl 3, +5% per additional level
        const bonus = 1.15 + ((lvl - 3) * 0.05); 
        return 1 + bonus; // Add to existing 100% base
    }

    function getDefAdvMult() {
        const lvl = window.player.advanceLevel || 0;
        if(lvl < 6) return 1.0;
        // Base 120% at lvl 6, +5% per additional level
        const bonus = 1.20 + ((lvl - 6) * 0.05); 
        return 1 + bonus;
    }

    function getAtkAdvMult() {
        const lvl = window.player.advanceLevel || 0;
        if(lvl < 12) return 1.0;
        // Base 125% at lvl 12, +5% per additional level
        const bonus = 1.25 + ((lvl - 12) * 0.05); 
        return 1 + bonus;
    }

    window.GameState = {
        get gokuLevel() { return window.player.lvl; },

        get gokuPower() {
            const rawAtk = window.player.bAtk + (window.player.rank * 400) + (window.player.gear.w?.val || 0);
            // Apply Base Adv Mult AND Specific ATK Adv Mult
            return Math.floor(rawAtk * getSoulMult() * getAdvMult() * getAtkAdvMult());
        },

        get gokuDefense() {
            const rawDef = window.player.bDef + (window.player.rank * 150) + (window.player.gear.a?.val || 0);
            // Apply Base Adv Mult AND Specific DEF Adv Mult
            return Math.floor(rawDef * getSoulMult() * getAdvMult() * getDefAdvMult());
        },

        get gokuHP() { return window.player.hp; },
        set gokuHP(v) { window.player.hp = v; },

        get gokuMaxHP() {
            const rawHp = window.player.bHp + (window.player.rank * 2500) + (window.player.gear.a?.val || 0);
            // Apply Base Adv Mult AND Specific HP Adv Mult
            return Math.floor(rawHp * getSoulMult() * getAdvMult() * getHpAdvMult());
        },
        inBattle: false
    };

    // --- NUMBER FORMATTER ---
    window.formatNumber = function (num) {
        if (num < 1000000) return Math.floor(num).toLocaleString();
        const suffixes = ["", "K", "M", "B", "T"];
        let suffixNum = Math.floor(("" + Math.floor(num)).length / 3);
        let shortValue = parseFloat((num / Math.pow(1000, suffixNum)).toPrecision(3));
        if (shortValue < 1) { shortValue *= 1000; suffixNum--; }
        let suffix = "";
        if (suffixNum < suffixes.length) suffix = suffixes[suffixNum];
        return shortValue + suffix;
    };

    // --- DETAILS MODAL ---
    window.openDetails = function () {
        const modal = document.getElementById('details-modal');
        if (!modal) return;
        const p = window.player;
        const sMult = getSoulMult();
        const aMult = getAdvMult();
        const advLvl = p.advanceLevel || 0;

        const totalPower = window.GameState.gokuPower;
        const maxHp = window.GameState.gokuMaxHP;
        const defense = window.GameState.gokuDefense;

        let critChance = 1 + (p.rank * 0.5);
        if (advLvl >= 5) critChance += 5 + ((advLvl - 5) * 0.5);

        // Populate Main Stats
        document.getElementById('det-power').innerText = window.formatNumber(totalPower);
        document.getElementById('det-hp').innerText = window.formatNumber(maxHp);
        document.getElementById('det-atk').innerText = window.formatNumber(totalPower);
        document.getElementById('det-def').innerText = window.formatNumber(defense);

        document.getElementById('det-soul').innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%;">
                <span>💎 Soul Boost:</span> <span style="color:#00ffff">x${sMult.toFixed(1)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; margin-top:2px;">
                <span>⚙️ Gear Adv:</span> <span style="color:#00ff00">+${Math.round((aMult - 1) * 100)}%</span>
            </div>
        `;

        document.getElementById('det-crit').innerText = `${critChance.toFixed(1)}%`;
        document.getElementById('det-coins').innerText = window.formatNumber(p.coins);

        // Inject Extra Stats
        let extraContainer = document.getElementById('det-extra-stats');
        if (!extraContainer) {
            extraContainer = document.createElement('div');
            extraContainer.id = 'det-extra-stats';
            extraContainer.style.marginTop = '10px';
            extraContainer.style.borderTop = '1px solid #444';
            extraContainer.style.paddingTop = '10px';
            const coinRow = document.getElementById('det-coins').parentNode;
            coinRow.parentNode.insertBefore(extraContainer, coinRow);
        }

        // Logic for display strings
        let extraHtml = "";
        
        // Show specific HP/ATK/DEF boosts if active
        if (advLvl >= 3) {
            const val = 115 + ((advLvl - 3) * 5);
            extraHtml += `<div class="stat-row"><span>❤️ HP Boost</span> <span style="color:#ff3e3e">+${val}%</span></div>`;
        }
        if (advLvl >= 6) {
            const val = 120 + ((advLvl - 6) * 5);
            extraHtml += `<div class="stat-row"><span>🛡️ DEF Boost</span> <span style="color:#2ecc71">+${val}%</span></div>`;
        }
        if (advLvl >= 12) {
            const val = 125 + ((advLvl - 12) * 5);
            extraHtml += `<div class="stat-row"><span>⚔️ ATK Boost</span> <span style="color:#3498db">+${val}%</span></div>`;
        }

        let evasion = 0; if (advLvl >= 50) evasion = 15; else if (advLvl >= 15) evasion = 5 + ((advLvl - 15) * 0.2);
        if (evasion > 0) extraHtml += `<div class="stat-row"><span>💨 Dodge Chance</span> <span style="color:#00d2ff">${evasion.toFixed(1)}%</span></div>`;
        
        let lifeSteal = 0; if (advLvl >= 10) lifeSteal = 15 + ((advLvl - 10) * 1.0);
        if (lifeSteal > 0) extraHtml += `<div class="stat-row"><span>🩸 Life Steal</span> <span style="color:#e74c3c">${lifeSteal.toFixed(0)}%</span></div>`;
        
        let doubleStrike = 0; if (advLvl >= 20) doubleStrike = 5 + ((advLvl - 20) * 0.5);
        if (doubleStrike > 0) extraHtml += `<div class="stat-row"><span>⚔️ Double Strike</span> <span style="color:#f1c40f">${doubleStrike.toFixed(1)}%</span></div>`;
        
        let goldBoost = 0; if (advLvl >= 25) goldBoost = 10 + (advLvl - 25);
        if (goldBoost > 0) extraHtml += `<div class="stat-row"><span>💰 Gold Bonus</span> <span style="color:gold">+${goldBoost}%</span></div>`;
        
        let xpBoost = 0; if (advLvl >= 30) xpBoost = 10 + (advLvl - 30);
        if (xpBoost > 0) extraHtml += `<div class="stat-row"><span>🌟 XP Bonus</span> <span style="color:cyan">+${xpBoost}%</span></div>`;
        
        if (advLvl >= 35) extraHtml += `<div class="stat-row"><span>😡 Rage Mode</span> <span style="color:#ff0000">Active</span></div>`;
        if (advLvl >= 40) extraHtml += `<div class="stat-row"><span>⚡ Starter Ki</span> <span style="color:#ffff00">+20%</span></div>`;
        if (advLvl >= 45) extraHtml += `<div class="stat-row"><span>💀 Boss Slayer</span> <span style="color:#ff8c00">+20% Dmg</span></div>`;
        if (advLvl >= 60) extraHtml += `<div class="stat-row"><span>❤️ Zenkai Revive</span> <span style="color:#2ecc71">Active</span></div>`;

        extraContainer.innerHTML = extraHtml;
        modal.style.display = 'flex';
    };

    window.closeDetails = function () {
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

            // Default State Checks
            if (!window.player.soulLevel) window.player.soulLevel = 1;
            if (!window.player.souls) window.player.souls = 0;
            if (window.player.dragonShards === undefined) window.player.dragonShards = 0;
            if (window.player.advanceLevel === undefined) window.player.advanceLevel = 0;
            if (window.player.sp === undefined) window.player.sp = 0;
            if (!window.player.spSpent) window.player.spSpent = { hp: 0, atk: 0, def: 0 };
            
            if (window.player.dungeonKeys === undefined) window.player.dungeonKeys = 0;
            if (!window.player.dungeonLevel) window.player.dungeonLevel = { buu: 1, frieza: 1, cell: 1 };
            if (!window.player.dailyLogin) window.player.dailyLogin = { day: 1, lastClaimTime: 0 };

            if (typeof window.checkDailyLogin === 'function') window.checkDailyLogin();

            const loader = document.getElementById('loader');
            if (loader) {
                setTimeout(() => {
                    loader.style.transition = "opacity 0.5s";
                    loader.style.opacity = "0";
                    setTimeout(() => { loader.style.display = 'none'; }, 500);
                }, 3500);
            }

            syncUI();

            if (typeof window.buildStageSelector === 'function') window.buildStageSelector();
            if (typeof window.initStrategy === 'function') window.initStrategy();
            if (window.SoulSystem) window.SoulSystem.updateBtnUI();
            if (window.HubBattle) window.HubBattle.init();
            if (window.Ranks) window.Ranks.init();
            if (typeof window.initDungeons === 'function') window.initDungeons();

            setupBoostHandler();

            setInterval(saveGame, CONFIG.SAVE_INTERVAL);
            setInterval(updateCapsuleBtn, 1000);

        } catch (e) {
            console.error("Game Init Error", e);
            document.getElementById('loader').style.display = 'none';
        }
    }

    // --- BOOST HANDLER ---
    function setupBoostHandler() {
        const btn = document.getElementById('btn-boost');
        if (!btn) return;
        let intervalId = null, timeoutId = null;

        const performAction = () => {
            const cost = 100 + (window.player.lvl * 10);
            if (window.player.coins >= cost) {
                window.player.coins -= cost;
                const rand = Math.random();
                if (rand < 0.33) window.player.bAtk += 1;
                else if (rand < 0.66) window.player.bDef += 1;
                else window.player.bHp += 5;
                window.isDirty = true;
                updateStatsOnly();
            } else {
                if (intervalId) { clearInterval(intervalId); intervalId = null; syncUI(); }
            }
        };

        const start = (e) => {
            if (e.cancelable && (e.type === 'touchstart' || e.type === 'mousedown')) { }
            performAction();
            timeoutId = setTimeout(() => { intervalId = setInterval(performAction, 50); }, 300);
        };
        const end = (e) => {
            if (e.cancelable) e.preventDefault();
            clearTimeout(timeoutId);
            if (intervalId) { clearInterval(intervalId); intervalId = null; }
            syncUI();
        };
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('touchend', end);
        btn.addEventListener('touchcancel', end);
    }

    function updateStatsOnly() {
        const atk = window.GameState.gokuPower;
        const def = window.GameState.gokuDefense;
        document.getElementById('ui-atk').innerText = window.formatNumber(atk);
        document.getElementById('ui-def').innerText = window.formatNumber(def);
        document.getElementById('ui-coins').innerText = window.formatNumber(window.player.coins);
        document.getElementById('ui-power').innerText = window.formatNumber(atk * 30 + window.GameState.gokuMaxHP);
    }

    function showLevelUp(oldLvl, newLvl, hpGain, atkGain, defGain) {
        if (window.battle.active) window.battle.cinematic = true;
        document.getElementById('lvl-up-old').innerText = oldLvl;
        document.getElementById('lvl-up-new').innerText = newLvl;

        const maxHp = window.GameState.gokuMaxHP;
        const power = window.GameState.gokuPower;
        const defense = window.GameState.gokuDefense;

        const hpEl = document.getElementById('lvl-stats-hp');
        if (hpEl) hpEl.parentElement.innerHTML = `HP: <span id="lvl-stats-hp">${window.formatNumber(maxHp)}</span> <span style="color:#00ff00;">(+${window.formatNumber(hpGain)})</span>`;
        const atkEl = document.getElementById('lvl-stats-atk');
        if (atkEl) atkEl.parentElement.innerHTML = `ATK: <span id="lvl-stats-atk">${window.formatNumber(power)}</span> <span style="color:#00ff00;">(+${window.formatNumber(atkGain)})</span>`;
        const defEl = document.getElementById('lvl-stats-def');
        if (defEl) defEl.parentElement.innerHTML = `DEF: <span id="lvl-stats-def">${window.formatNumber(defense)}</span> <span style="color:#00ff00;">(+${window.formatNumber(defGain)})</span>`;

        const img = (window.player.rank >= 1) ? ASSETS.SSJ : ASSETS.BASE;
        document.getElementById('lvl-up-img').src = img;
        document.getElementById('levelup-modal').style.display = 'flex';
    }

    function closeLevelUp() {
        document.getElementById('levelup-modal').style.display = 'none';
        if (window.GameState.inBattle && window.battle.active) window.battle.cinematic = false;
    }

    function checkLevelUp() {
        let leveledUp = false;
        const oldLvl = window.player.lvl;

        const startHP = window.GameState.gokuMaxHP;
        const startATK = window.GameState.gokuPower;
        const startDEF = window.GameState.gokuDefense;

        while (window.player.xp >= window.player.nextXp) {
            window.player.lvl++;
            window.player.xp -= window.player.nextXp;
            window.player.nextXp = Math.floor(window.player.nextXp * 1.3);

            window.player.bHp = Math.floor(window.player.bHp * 1.05) + 1000;
            window.player.bAtk = Math.floor(window.player.bAtk * 1.05) + 20;
            window.player.bDef = Math.floor(window.player.bDef * 1.05) + 10;
            window.player.hp = window.GameState.gokuMaxHP;

            if (window.player.lvl >= 100) { window.player.lvl = 1; window.player.rank++; }
            leveledUp = true;
        }

        if (leveledUp) {
            window.player.sp += (window.player.lvl - oldLvl) * 2; 
            const endHP = window.GameState.gokuMaxHP;
            const endATK = window.GameState.gokuPower;
            const endDEF = window.GameState.gokuDefense;
            showLevelUp(oldLvl, window.player.lvl, endHP - startHP, endATK - startATK, endDEF - startDEF);
            syncUI();
            saveGame();
        }
    }

    // --- NOTIFICATION HELPER ---
    function showSupplyToast(xp, coins, item) {
        const div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.top = '20%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%) scale(0.8)';
        div.style.background = 'rgba(0, 0, 0, 0.95)';
        div.style.border = '2px solid #00ff00';
        div.style.borderRadius = '15px';
        div.style.padding = '20px 40px';
        div.style.color = 'white';
        div.style.textAlign = 'center';
        div.style.zIndex = '10000';
        div.style.fontFamily = 'Impact, sans-serif';
        div.style.fontSize = '1.5rem';
        div.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.3)';
        div.style.opacity = '0';
        div.style.transition = 'all 0.3s ease-out';
        div.style.pointerEvents = 'none';

        let html = `<div style="color:#00ff00; margin-bottom:10px; font-size:1.8rem;">SUPPLY DROP!</div>`;
        html += `<div>✨ +${window.formatNumber(xp)} XP</div>`;
        html += `<div>💰 +${window.formatNumber(coins)} Coins</div>`;
        if (item) {
            html += `<div style="color:cyan; margin-top:10px; border-top:1px solid #555; padding-top:5px;">🎁 ${item}</div>`;
        }
        div.innerHTML = html;
        document.body.appendChild(div);

        requestAnimationFrame(() => { div.style.opacity = '1'; div.style.transform = 'translate(-50%, -50%) scale(1)'; });
        setTimeout(() => { div.style.opacity = '0'; div.style.transform = 'translate(-50%, -60%) scale(0.8)'; setTimeout(() => div.remove(), 300); }, 2500);
    }

    function claimSupply() {
        const now = Date.now();
        if (!window.player.lastCapsule) window.player.lastCapsule = 0;
        if (now - window.player.lastCapsule < CONFIG.CAPSULE_COOLDOWN) return;

        window.player.lastCapsule = now;
        const lvl = window.player.lvl || 1;
        const advLvl = window.player.advanceLevel || 0;

        let baseXp = 500 + (lvl * 250) + (Math.pow(lvl, 1.8) * 10);
        let baseCoins = 1000 + (lvl * 150) + (Math.pow(lvl, 1.7) * 5);
        let xpMult = 1.0, coinMult = 1.0;

        if (advLvl >= 25) coinMult += (0.10 + ((advLvl - 25) * 0.01));
        if (advLvl >= 30) xpMult += (0.10 + ((advLvl - 30) * 0.01));
        const soulMult = 1 + (window.player.soulLevel * 0.1);

        const xpGain = Math.floor(baseXp * xpMult * soulMult);
        const coinGain = Math.floor(baseCoins * coinMult * soulMult);

        window.player.xp += xpGain;
        window.player.coins += coinGain;

        let dropName = null;
        if (Math.random() < 0.35) {
            const tier = Math.min(6, Math.max(1, Math.floor(window.player.lvl / 20)));
            let val = 700 * tier;
            let name = "Saiyan Gear";
            if (tier >= 2) name = "Elite Gear";
            if (tier >= 3) name = "Legendary Gear";
            window.addToInventory({ n: name, type: Math.random() > 0.5 ? 'w' : 'a', val: val, rarity: tier });
            dropName = name;
        }

        window.isDirty = true;
        checkLevelUp();
        syncUI();
        saveGame();
        showSupplyToast(xpGain, coinGain, dropName);
        updateCapsuleBtn();
    }

    function updateCapsuleBtn() {
        const btn = document.getElementById('btn-supply');
        if (!btn) return;
        const diff = Date.now() - (window.player.lastCapsule || 0);

        if (diff >= CONFIG.CAPSULE_COOLDOWN) {
            btn.innerHTML = "<i>🎁</i> Supply Ready!";
            btn.classList.add('btn-ready');
            btn.style.color = "#fff";
            btn.style.background = "linear-gradient(to bottom, #2ecc71, #27ae60)";
            btn.style.border = "1px solid #2ecc71";
        } else {
            const sec = Math.ceil((CONFIG.CAPSULE_COOLDOWN - diff) / 1000);
            btn.innerHTML = `<i>⏳</i> ${sec}s`;
            btn.classList.remove('btn-ready');
            btn.style.color = "#777";
            btn.style.background = "#222";
            btn.style.border = "1px solid #444";
        }
    }

    function tapTrain() {
        const gain = Math.ceil(window.player.lvl / 2);
        window.player.xp += gain;
        window.player.coins += 1;
        window.isDirty = true;
        popDamage(`+${gain} XP`, 'view-char', true);
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
                if (parsed.player) window.player = parsed.player;
                if (parsed.battle) {
                    window.battle.stage = parsed.battle.stage || 1;
                    window.battle.world = parsed.battle.world || 1;
                    window.battle.maxStage = parsed.battle.maxStage || 1;
                }
                window.player.inv.forEach(i => { if (!i.qty) i.qty = 1; });
            } catch (e) { console.error("Save file corrupted"); }
        }
    }

    window.addEventListener('beforeunload', () => { window.isDirty = true; saveGame(); });

    const PRELOAD_ASSETS = [
        "IMG_0287.png", "IMG_0299.png", "IMG_0300.png", "IMG_0292.png",
        "IMG_0061.png", "IMG_0081.png", "hb_b.png"
    ];

    function showTab(t) {
        if ((t === 'explore' || t === 'battle') && window.GameLoader) {
            window.GameLoader.preload(PRELOAD_ASSETS, () => {
                _doSwitchTab(t);
            });
        } else {
            _doSwitchTab(t);
        }
    }

    function _doSwitchTab(t) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));

        const targetView = document.getElementById('view-' + t);
        const targetBtn = document.getElementById('tab-' + t);

        if (targetView) targetView.classList.add('active-screen');
        if (targetBtn) targetBtn.classList.add('active');

        if (t === 'battle') {
            if (window.HubBattle) window.HubBattle.stop();
            if (typeof window.stopExplore === 'function') window.stopExplore();

            if (!window.battle.active) {
                const prompt = document.getElementById('start-prompt');
                const eImg = document.getElementById('e-img');
                const eName = document.getElementById('e-name');
                if (prompt) prompt.style.display = 'block';
                if (eImg) eImg.style.display = 'none';
                if (eName) eName.innerText = "";
            }
        }
        else if (t === 'explore') {
            if (window.HubBattle) window.HubBattle.stop();
            if (typeof window.stopCombat === 'function') window.stopCombat();
            document.getElementById('battle-menu').style.display = 'none';

            if (typeof window.initExplore === 'function') {
                window.initExplore();
            }
        }
        else {
            if (window.HubBattle) window.HubBattle.start();
            if (typeof window.stopCombat === 'function') window.stopCombat();
            if (typeof window.stopExplore === 'function') window.stopExplore();

            const bMenu = document.getElementById('battle-menu');
            if (bMenu) bMenu.style.display = 'none';
        }

        syncUI();
    }

    function addToInventory(item) {
        const found = window.player.inv.find(i => i.n === item.n && i.type === item.type && i.val === item.val && i.rarity === item.rarity && i.qty < 99);
        if (found) found.qty++; else { item.qty = 1; window.player.inv.push(item); }
        window.isDirty = true;
        if (isAutoMerging) setTimeout(processAutoMerge, 200);
        else syncUI();
    }

    function syncUI() {
        const sprite = (window.player.rank >= 1) ? ASSETS.SSJ : ASSETS.BASE;
        const uiSprite = document.getElementById('ui-sprite');
        if (uiSprite) uiSprite.src = sprite;
        const btlSprite = document.getElementById('btl-p-sprite');
        if (btlSprite) btlSprite.src = sprite;
        if (window.HubBattle && typeof window.HubBattle.updateSprite === 'function') {
            window.HubBattle.updateSprite(sprite);
        }
        const uiAura = document.getElementById('ui-aura');
        if (uiAura) {
            uiAura.style.display = (window.player.rank >= 1) ? "block" : "none";
        }

        const atk = window.GameState.gokuPower;
        const maxHp = window.GameState.gokuMaxHP;
        const def = window.GameState.gokuDefense;

        if (!window.battle.active) {
            window.player.hp = maxHp;
        }

        document.getElementById('ui-rank-badge').innerText = RANKS[window.player.rank].substring(0, 2);
        document.getElementById('ui-name').innerText = window.player.rank > 0 ? "Goku " + RANKS[window.player.rank] : "Goku";
        document.getElementById('ui-lvl').innerText = window.player.lvl;

        document.getElementById('ui-atk').innerText = window.formatNumber(atk);
        document.getElementById('ui-def').innerText = window.formatNumber(def);
        document.getElementById('ui-coins').innerText = window.formatNumber(window.player.coins);

        document.getElementById('ui-hp-txt').innerText = window.formatNumber(maxHp);
        document.getElementById('ui-power').innerText = window.formatNumber(atk * 30 + maxHp);

        const xpPct = (window.player.xp / window.player.nextXp) * 100;
        document.getElementById('bar-xp').style.width = xpPct + "%";

        const xpTextEl = document.getElementById('hub-xp-text');
        if (xpTextEl) {
            const curXp = window.formatNumber(window.player.xp);
            const maxXp = window.formatNumber(window.player.nextXp);
            xpTextEl.innerText = `${curXp} / ${maxXp}`;
        }

        const grid = document.getElementById('inv-grid');
        grid.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const mergeBtn = document.getElementById('btn-merge');
        const equipBtn = document.getElementById('btn-action');
        const autoMergeBtn = document.getElementById('btn-auto-merge');

        if (mergeBtn) mergeBtn.style.display = 'none';
        if (equipBtn) equipBtn.style.display = 'flex';

        if (autoMergeBtn) {
            if (window.player.inv.length > 0) {
                autoMergeBtn.style.display = 'flex';
                if (isAutoMerging) {
                    autoMergeBtn.innerHTML = `<span>⚡ STOP MERGING</span>`;
                    autoMergeBtn.classList.add('merging');
                } else {
                    autoMergeBtn.innerHTML = `<span>⚡ AUTO MERGE</span>`;
                    autoMergeBtn.classList.remove('merging');
                }
            } else {
                autoMergeBtn.style.display = 'none';
            }
        }

        window.player.inv.forEach((item, i) => {
            const d = document.createElement('div');
            let rClass = 'item-basic';
            if (item.rarity === 2) rClass = 'item-rare';
            if (item.rarity === 3) rClass = 'item-legendary';
            if (item.rarity === 4) rClass = 'item-s';
            if (item.rarity === 5) rClass = 'item-ss';
            if (item.rarity === 6) rClass = 'item-sss';
            if (item.rarity === 7) rClass = 'item-sss2';
            if (item.rarity === 8) rClass = 'item-sss3';
            if (item.rarity === 9) rClass = 'item-sss4';
            if (item.rarity === 10) rClass = 'item-sss5';

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

        if (window.player.selected !== -1) {
            const sItem = window.player.inv[window.player.selected];

            if (sItem) {
                let totalCount = 0;
                window.player.inv.forEach(i => {
                    if (i.n === sItem.n && i.type === sItem.type && i.rarity === sItem.rarity) {
                        totalCount += i.qty;
                    }
                });

                if (totalCount >= 3 && sItem.rarity < 10) {
                    mergeBtn.style.display = 'flex';
                    equipBtn.style.display = 'none';
                    mergeBtn.innerHTML = `<span>⬆️ MERGE (3) - $${window.formatNumber(sItem.rarity * 500)}</span>`;
                } else {
                    equipBtn.innerHTML = `<span>EQUIP ${sItem.type === 'w' ? 'WEAPON' : 'ARMOR'}</span>`;
                }
            } else {
                window.player.selected = -1;
                equipBtn.innerHTML = `<span>SELECT GEAR</span>`;
            }
        } else {
            equipBtn.innerHTML = `<span>SELECT GEAR</span>`;
        }

        if (window.SoulSystem) window.SoulSystem.updateBtnUI();
    }

    function updateVisualSlot(type, id) {
        const el = document.getElementById(id);
        const item = window.player.gear[type];
        const advLvl = window.player.advanceLevel || 0;

        if (item) {
            el.className = 'slot-box slot-filled';
            let rColor = '#333';
            if (item.rarity === 2) rColor = '#00d2ff';
            if (item.rarity === 3) rColor = '#ff00ff';
            if (item.rarity === 4) rColor = '#e74c3c';
            if (item.rarity === 5) rColor = '#f1c40f';
            if (item.rarity === 6) rColor = '#00ffff';
            if (item.rarity === 7) rColor = '#00ffff';
            if (item.rarity === 8) rColor = '#f1c40f';
            if (item.rarity === 9) rColor = '#00ffff';
            if (item.rarity === 10) rColor = '#f1c40f';
            el.style.borderColor = rColor;

            let badgeHtml = advLvl > 0 ? `<div class="adv-badge">+${advLvl}</div>` : '';

            el.innerHTML = `<span>${type === 'w' ? '⚔️' : '🛡️'}</span><div class="slot-label" style="color:${rColor}">${window.formatNumber(item.val)}</div>${badgeHtml}`;
        } else {
            el.className = 'slot-box';
            el.style.borderColor = '#b2bec3';
            el.innerHTML = `<span>${type === 'w' ? '⚔️' : '🛡️'}</span><div class="slot-label">${type === 'w' ? 'WEAPON' : 'ARMOR'}</div>`;
        }
    }

    // --- MANUAL MERGE ---
    function mergeItems() {
        if (window.player.selected === -1) return;
        const sItem = window.player.inv[window.player.selected];
        if (!sItem) return;

        const cost = sItem.rarity * 500;
        if (window.player.coins < cost) { alert("Not enough coins!"); return; }

        let totalCount = 0;
        window.player.inv.forEach(i => { if (i.n === sItem.n && i.type === sItem.type && i.rarity === sItem.rarity) totalCount += i.qty; });

        if (totalCount >= 3) {
            window.player.coins -= cost;
            removeItems(sItem, 3);

            const newRarity = sItem.rarity + 1;
            let newVal = Math.floor(sItem.val * 2);
            let newName = "Saiyan Gear";
            if (newRarity === 2) { newVal = 1500; newName = "Elite Gear"; }
            else if (newRarity === 3) { newVal = 3500; newName = "Legendary Gear"; }
            else if (newRarity === 4) { newVal = 8500; newName = "God Gear"; }
            else if (newRarity === 5) { newVal = 20000; newName = "Angel Gear"; }
            else if (newRarity === 6) { newVal = 50000; newName = "Omni Gear"; }
            else if (newRarity === 7) { newVal = 150000; newName = "SSS2"; }
            else if (newRarity === 8) { newVal = 500000; newName = "SSS3"; }
            else if (newRarity === 9) { newVal = 1250000; newName = "SSS4"; }
            else if (newRarity === 10) { newVal = 5000000; newName = "SSS5"; }
            
            window.addToInventory({ n: newName, type: sItem.type, val: newVal, rarity: newRarity });
            window.player.selected = -1;
            window.isDirty = true;
            syncUI();
        }
    }

    // --- AUTO MERGE SYSTEM ---
    function toggleAutoMerge() {
        isAutoMerging = !isAutoMerging;
        syncUI();
        if (isAutoMerging) processAutoMerge();
    }

    function processAutoMerge() {
        if (!isAutoMerging) return;

        let mergedSomething = false;

        for (let i = 0; i < window.player.inv.length; i++) {
            const item = window.player.inv[i];

            if (item.rarity >= 10) continue;

            const cost = item.rarity * 500;
            if (window.player.coins < cost) continue;

            let count = 0;
            window.player.inv.forEach(x => {
                if (x.n === item.n && x.type === item.type && x.rarity === item.rarity) count += x.qty;
            });

            if (count >= 3) {
                window.player.coins -= cost;
                removeItems(item, 3);

                const newRarity = item.rarity + 1;
                let newVal = Math.floor(item.val * 2);
                let newName = "Saiyan Gear";
                if (newRarity === 2) { newVal = 1500; newName = "Elite Gear"; }
                else if (newRarity === 3) { newVal = 3500; newName = "Legendary Gear"; }
                else if (newRarity === 4) { newVal = 8500; newName = "God Gear"; }
                else if (newRarity === 5) { newVal = 20000; newName = "Angel Gear"; }
                else if (newRarity === 6) { newVal = 50000; newName = "Omni Gear"; }
                else if (newRarity === 7) { newVal = 150000; newName = "SSS2"; }
                else if (newRarity === 8) { newVal = 500000; newName = "SSS3"; }
                else if (newRarity === 9) { newVal = 1250000; newName = "SSS4"; }
                else if (newRarity === 10) { newVal = 10000000; newName = "SSS5"; }

                window.addToInventory({ n: newName, type: item.type, val: newVal, rarity: newRarity });
                mergedSomething = true;
                break;
            }
        }

        window.isDirty = true;
        syncUI();

        if (mergedSomething && isAutoMerging) {
            setTimeout(processAutoMerge, 200);
        }
    }

    function removeItems(templateItem, qtyToRemove) {
        let needed = qtyToRemove;
        for (let i = window.player.inv.length - 1; i >= 0; i--) {
            if (needed <= 0) break;
            let item = window.player.inv[i];
            if (item.n === templateItem.n && item.type === templateItem.type && item.rarity === templateItem.rarity) {
                if (item.qty >= needed) {
                    item.qty -= needed;
                    needed = 0;
                    if (item.qty === 0) window.player.inv.splice(i, 1);
                } else {
                    needed -= item.qty;
                    window.player.inv.splice(i, 1);
                }
            }
        }
    }

    // --- NEW TRAINING SYSTEM (SP) ---
    function openTraining() {
        const modal = document.getElementById('training-modal');
        if (!modal) return;
        updateTrainingUI();
        modal.style.display = 'flex';
    }

    function closeTraining() {
        document.getElementById('training-modal').style.display = 'none';
    }

    function spendSP(stat) {
        if (window.player.sp < 1) {
            alert("Not enough SP!");
            return;
        }

        window.player.sp--;

        // 20% Compounding Boost
        if (stat === 'hp') {
            window.player.bHp = Math.floor(window.player.bHp * 1.20);
            if (!window.player.spSpent) window.player.spSpent = { hp: 0, atk: 0, def: 0 };
            window.player.spSpent.hp++;
        } else if (stat === 'atk') {
            window.player.bAtk = Math.floor(window.player.bAtk * 1.20);
            if (!window.player.spSpent) window.player.spSpent = { hp: 0, atk: 0, def: 0 };
            window.player.spSpent.atk++;
        } else if (stat === 'def') {
            window.player.bDef = Math.floor(window.player.bDef * 1.20);
            if (!window.player.spSpent) window.player.spSpent = { hp: 0, atk: 0, def: 0 };
            window.player.spSpent.def++;
        }

        window.isDirty = true;
        updateTrainingUI();
        syncUI();
    }

    function resetSP() {
        const modal = document.getElementById('custom-confirm-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeConfirmModal() {
        const modal = document.getElementById('custom-confirm-modal');
        if (modal) modal.style.display = 'none';
    }

    function confirmResetSP() {
        closeConfirmModal();
        if (!window.player.spSpent) window.player.spSpent = { hp: 0, atk: 0, def: 0 };
        const spent = window.player.spSpent;

        // Reverse stats (Approximate)
        // Divide by 1.2^count
        if (spent.hp > 0) {
            window.player.bHp = Math.ceil(window.player.bHp / Math.pow(1.20, spent.hp));
            window.player.sp += spent.hp;
            spent.hp = 0;
        }
        if (spent.atk > 0) {
            window.player.bAtk = Math.ceil(window.player.bAtk / Math.pow(1.20, spent.atk));
            window.player.sp += spent.atk;
            spent.atk = 0;
        }
        if (spent.def > 0) {
            window.player.bDef = Math.ceil(window.player.bDef / Math.pow(1.20, spent.def));
            window.player.sp += spent.def;
            spent.def = 0;
        }

        window.isDirty = true;
        updateTrainingUI();
        syncUI();
    }

    function updateTrainingUI() {
        if (!window.player.spSpent) window.player.spSpent = { hp: 0, atk: 0, def: 0 };
        document.getElementById('tr-sp-count').innerText = window.player.sp;

        document.getElementById('tr-hp-val').innerText = window.formatNumber(window.player.bHp);
        const hpSpent = document.getElementById('tr-hp-spent');
        if (hpSpent) hpSpent.innerText = `(+${window.player.spSpent.hp})`;

        document.getElementById('tr-atk-val').innerText = window.formatNumber(window.player.bAtk);
        const atkSpent = document.getElementById('tr-atk-spent');
        if (atkSpent) atkSpent.innerText = `(+${window.player.spSpent.atk})`;

        document.getElementById('tr-def-val').innerText = window.formatNumber(window.player.bDef);
        const defSpent = document.getElementById('tr-def-spent');
        if (defSpent) defSpent.innerText = `(+${window.player.spSpent.def})`;
    }

    function doEquip() {
        if (window.player.selected === -1) return;
        const stackItem = window.player.inv[window.player.selected];

        // Safety Check
        if (!stackItem) {
            window.player.selected = -1;
            syncUI();
            return;
        }

        const itemToEquip = { n: stackItem.n, type: stackItem.type, val: stackItem.val, rarity: stackItem.rarity, qty: 1 };
        const old = window.player.gear[stackItem.type];

        window.player.gear[stackItem.type] = itemToEquip;

        stackItem.qty--;
        if (stackItem.qty <= 0) window.player.inv.splice(window.player.selected, 1);

        if (old) window.addToInventory(old);

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
            if (isSpecial) { d.style.color = 'cyan'; d.style.fontSize = '3rem'; d.style.zIndex = 30; }
        }
        const randomX = (Math.random() * 40) - 20;
        const randomY = (Math.random() * 40) - 20;
        const container = document.getElementById(id);
        if (container) {
            d.style.left = id === 'view-char' ? `50%` : `calc(50% + ${randomX}px)`;
            d.style.top = id === 'view-char' ? `40%` : `calc(20% + ${randomY}px)`;
            container.appendChild(d);
            setTimeout(() => d.remove(), 600);
        }
    }

    // --- EXPOSE NECESSARY FUNCTIONS TO WINDOW ---
    window.initGame = initGame;
    window.showTab = showTab;
    window.claimSupply = claimSupply;
    window.tapTrain = tapTrain;
    window.openTraining = openTraining;
    window.closeTraining = closeTraining;
    window.spendSP = spendSP;
    window.resetSP = resetSP;
    window.confirmResetSP = confirmResetSP;
    window.closeConfirmModal = closeConfirmModal;
    window.doEquip = doEquip;
    window.mergeItems = mergeItems;
    window.closeLevelUp = closeLevelUp;
    window.checkLevelUp = checkLevelUp;
    window.addToInventory = addToInventory;
    window.syncUI = syncUI;
    window.popDamage = popDamage;
    window.toggleAutoMerge = toggleAutoMerge;

})();
