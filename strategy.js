/* strategy.js - Capsule Gravitron Training System */

let pendingOfflineXp = 0;
let pendingOfflineGold = 0;
let pendingItems = [];
let offlineMinutes = 0;

// Inject the Strategy Modal HTML into the body automatically
const strategyModalHTML = `
<div id="strategy-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:2000; flex-direction:column; align-items:center; justify-content:center;">
    <div style="width:90%; max-width:400px; background:linear-gradient(135deg, #2c3e50, #000); border:2px solid #00d2ff; border-radius:15px; padding:20px; text-align:center; box-shadow:0 0 20px #00d2ff; position:relative;">
        <div style="font-family:'Bangers'; color:#00d2ff; font-size:2.5rem; margin-bottom:10px; text-shadow:2px 2px black;">GRAVITRON CHAMBER</div>
        
        <div id="grav-anim" style="height:120px; display:flex; align-items:center; justify-content:center; margin:20px 0;">
            <div style="width:100px; height:100px; border-radius:50%; border:4px dashed #FFD700; animation:spinGrav 4s linear infinite; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 15px #FFD700;">
                <span style="font-size:3rem;">💊</span>
            </div>
        </div>

        <div style="font-family:'Orbitron'; color:white; font-size:0.9rem; margin-bottom:5px;">TIME IN CHAMBER: <span id="strat-time" style="color:yellow;">0</span> MINS</div>
        <div style="font-family:'Orbitron'; color:white; font-size:0.9rem; margin-bottom:20px;">GRAVITY MULTIPLIER: <span id="strat-mult" style="color:red;">x1</span></div>
        
        <div style="background:rgba(0,0,0,0.5); padding:15px; border-radius:10px; border:1px solid #555; margin-bottom:20px;">
            <div style="font-family:'Orbitron'; font-size:0.8rem; color:#aaa;">TRAINING RESULTS</div>
            <div id="strat-xp-display" style="font-family:'Bangers'; font-size:2rem; color:#00ff00; text-shadow:2px 2px black;">0 XP</div>
            <div id="strat-gold-display" style="font-family:'Bangers'; font-size:1.5rem; color:#f1c40f; text-shadow:1px 1px black;">0 COINS</div>
            <div id="strat-item-display" style="font-family:'Orbitron'; font-size:0.8rem; color:#00d2ff; margin-top:5px;">No Items Found</div>
        </div>

        <button id="btn-claim-strat" onclick="claimStrategy()" style="width:100%; padding:15px; background:linear-gradient(to bottom, #27ae60, #2ecc71); border:none; border-radius:8px; color:white; font-family:'Bangers'; font-size:1.5rem; cursor:pointer; text-shadow:1px 1px black;">CLAIM REWARDS</button>
        <button onclick="closeStrategy()" style="margin-top:15px; background:transparent; border:none; color:#777; font-family:'Orbitron'; cursor:pointer; font-size:0.8rem;">LEAVE CHAMBER (NO CLAIM)</button>
    </div>
</div>
<style>
@keyframes spinGrav { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
`;

// Initialize Strategy System
function initStrategy() {
    if(!document.getElementById('strategy-modal')) {
        const d = document.createElement('div');
        d.innerHTML = strategyModalHTML;
        document.body.appendChild(d);
    }

    const now = Date.now();
    const lastSave = player.lastSave || now;
    const diffMs = now - lastSave;

    if (diffMs >= 120000) { // 2 minutes min
        offlineMinutes = Math.floor(diffMs / 60000);
        const multiplier = (player.rank || 0) + 1;
        
        // 2000 XP per minute (as requested previously)
        pendingOfflineXp = offlineMinutes * 53 * multiplier;
        
        // 25 Coins per minute
        pendingOfflineGold = offlineMinutes * 100 * multiplier;

        // Item Drop Logic: 1 Item every 30 mins approx
        pendingItems = [];
        const itemRolls = Math.floor(offlineMinutes / 30); 
        for(let i=0; i<itemRolls; i++) {
            if(Math.random() > 0.5) { // 50% chance per 30 min block
                pendingItems.push({
                    n: "Training Gear", 
                    type: Math.random() > 0.5 ? 'w' : 'a', 
                    val: 700,
                    rarity: 1 
                });
            }
        }

        console.log(`[Strategy] Offline: ${offlineMinutes}m. XP: ${pendingOfflineXp}, Gold: ${pendingOfflineGold}, Items: ${pendingItems.length}`);
        
        // Visual indicator
        const btns = document.querySelectorAll(".side-btn");
        btns.forEach(btn => {
            if(btn.getAttribute("onclick") === "openStrategy()") {
                btn.style.border = "2px solid #00ff00";
                btn.style.boxShadow = "0 0 10px #00ff00";
                // Add red dot if not there
                if(!btn.querySelector('.dot')) {
                    btn.innerHTML += `<div class="dot" style="position:absolute; top:-5px; right:-5px; width:10px; height:10px; background:red; border-radius:50%;"></div>`;
                }
            }
        });
    }
}

// Open the Modal
function openStrategy() {
    if(pendingOfflineXp <= 0) {
        alert("Capsule Gravitron is charging.\nRequires at least 2 minutes of offline rest to activate.");
        return;
    }

    const modal = document.getElementById('strategy-modal');
    modal.style.display = 'flex';
    
    document.getElementById('strat-time').innerText = offlineMinutes;
    const multiplier = (player.rank || 0) + 1;
    document.getElementById('strat-mult').innerText = `x${multiplier}`;
    
    // XP Animation
    const xpEl = document.getElementById('strat-xp-display');
    const goldEl = document.getElementById('strat-gold-display');
    const itemEl = document.getElementById('strat-item-display');

    xpEl.innerText = "+" + pendingOfflineXp.toLocaleString() + " XP";
    goldEl.innerText = "+" + pendingOfflineGold.toLocaleString() + " COINS";
    
    if(pendingItems.length > 0) {
        itemEl.innerText = `FOUND: ${pendingItems.length} ITEM(S)`;
        itemEl.style.color = "#00ff00";
    } else {
        itemEl.innerText = "No Items Found";
        itemEl.style.color = "#00d2ff";
    }
}

// Claim Logic
function claimStrategy() {
    // Add XP & Gold
    player.xp += pendingOfflineXp;
    player.coins += pendingOfflineGold;

    // Add Items
    if(typeof addToInventory === 'function') {
        pendingItems.forEach(item => addToInventory(item));
    } else {
        player.inv.push(...pendingItems);
    }
    
    // --- CHANGED: Use Global checkLevelUp() to trigger Modal ---
    if(typeof checkLevelUp === 'function') {
        checkLevelUp();
    } else {
        // Fallback if checkLevelUp is missing (safety)
        while(player.xp >= player.nextXp) {
            player.lvl++; 
            player.xp -= player.nextXp; 
            player.nextXp = Math.floor(player.nextXp * 1.3);
            player.bHp += 250; player.bAtk += 5; player.bDef += 2;
            player.hp = player.bHp + (player.rank * 2500) + (player.gear.a?.val || 0);
            if(player.lvl >= 100) { player.lvl = 1; player.rank++; }
        }
    }
    // -----------------------------------------------------------

    if(pendingOfflineXp > 0) {
        // Removed alert, modal handles it now
    }

    // Reset
    pendingOfflineXp = 0;
    pendingOfflineGold = 0;
    pendingItems = [];
    offlineMinutes = 0;
    
    // Update UI & Save
    if(typeof syncUI === 'function') syncUI();
    player.lastSave = Date.now(); 
    if(typeof saveGame === 'function') saveGame();
    
    closeStrategy();
    
    // Reset button style
    const btns = document.querySelectorAll(".side-btn");
    btns.forEach(btn => {
        if(btn.getAttribute("onclick") === "openStrategy()") {
            btn.style.border = "2px solid #555";
            btn.style.boxShadow = "none";
            const dot = btn.querySelector('.dot');
            if(dot) dot.remove();
        }
    });
}

function closeStrategy() {
    document.getElementById('strategy-modal').style.display = 'none';
}