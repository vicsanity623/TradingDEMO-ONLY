/* strategy.js - Capsule Gravitron Training System */

let pendingOfflineXp = 0;
let offlineMinutes = 0;
let isStrategyModalOpen = false;

// Inject the Strategy Modal HTML into the body automatically
const strategyModalHTML = `
<div id="strategy-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:2000; flex-direction:column; align-items:center; justify-content:center;">
    <div style="width:90%; max-width:400px; background:linear-gradient(135deg, #2c3e50, #000); border:2px solid #00d2ff; border-radius:15px; padding:20px; text-align:center; box-shadow:0 0 20px #00d2ff; position:relative;">
        <div style="font-family:'Bangers'; color:#00d2ff; font-size:2.5rem; margin-bottom:10px; text-shadow:2px 2px black;">GRAVITRON CHAMBER</div>
        
        <div id="grav-anim" style="height:100px; display:flex; align-items:center; justify-content:center; margin:20px 0;">
            <div style="width:80px; height:80px; border-radius:50%; border:4px dashed #FFD700; animation:spinGrav 4s linear infinite; display:flex; align-items:center; justify-content:center;">
                <span style="font-size:2rem;">💊</span>
            </div>
        </div>

        <div style="font-family:'Orbitron'; color:white; font-size:0.9rem; margin-bottom:5px;">TIME IN CHAMBER: <span id="strat-time" style="color:yellow;">0</span> MINS</div>
        <div style="font-family:'Orbitron'; color:white; font-size:0.9rem; margin-bottom:20px;">GRAVITY MULTIPLIER: <span id="strat-mult" style="color:red;">x1</span></div>
        
        <div style="background:rgba(0,0,0,0.5); padding:15px; border-radius:10px; border:1px solid #555; margin-bottom:20px;">
            <div style="font-family:'Orbitron'; font-size:0.8rem; color:#aaa;">TRAINING RESULTS</div>
            <div id="strat-xp-display" style="font-family:'Bangers'; font-size:3rem; color:#00ff00; text-shadow:2px 2px black;">0 XP</div>
        </div>

        <button id="btn-claim-strat" onclick="claimStrategy()" style="width:100%; padding:15px; background:linear-gradient(to bottom, #27ae60, #2ecc71); border:none; border-radius:8px; color:white; font-family:'Bangers'; font-size:1.5rem; cursor:pointer; text-shadow:1px 1px black;">CLAIM REWARDS</button>
        <button onclick="closeStrategy()" style="margin-top:10px; background:transparent; border:none; color:#777; font-family:'Orbitron'; cursor:pointer;">LEAVE CHAMBER</button>
    </div>
</div>
<style>
@keyframes spinGrav { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
`;

// Initialize Strategy System
function initStrategy() {
    // Inject HTML
    if(!document.getElementById('strategy-modal')) {
        const d = document.createElement('div');
        d.innerHTML = strategyModalHTML;
        document.body.appendChild(d);
    }

    // Check Last Save Time
    const now = Date.now();
    const lastSave = player.lastSave || now;
    
    // Logic: 120 seconds (120,000 ms) threshold
    const diffMs = now - lastSave;
    
    if (diffMs >= 120000) {
        offlineMinutes = Math.floor(diffMs / 60000);
        
        // Calculate Multiplier (Base=1, S=2, SS=3...)
        // player.rank 0 is Base (x1)
        const multiplier = (player.rank || 0) + 1;
        
        // 147 XP per minute * Multiplier
        pendingOfflineXp = offlineMinutes * 147 * multiplier;

        console.log(`[Strategy] Offline for ${offlineMinutes} mins. Rank ${multiplier}x. XP: ${pendingOfflineXp}`);
        
        // Visual indicator on the button (optional)
        const btn = document.querySelector(".side-btn:first-child"); 
        if(btn) btn.style.border = "2px solid #00ff00"; // Light up the button
    }
}

// Open the Modal
function openStrategy() {
    if(pendingOfflineXp <= 0) {
        alert("Capsule Gravitron requires at least 2 minutes of offline rest to activate.");
        return;
    }

    document.getElementById('strategy-modal').style.display = 'flex';
    document.getElementById('strat-time').innerText = offlineMinutes;
    const multiplier = (player.rank || 0) + 1;
    document.getElementById('strat-mult').innerText = "x" + multiplier;
    
    // Count up animation
    let currentDisp = 0;
    const step = Math.ceil(pendingOfflineXp / 20);
    const xpEl = document.getElementById('strat-xp-display');
    
    const interval = setInterval(() => {
        currentDisp += step;
        if(currentDisp >= pendingOfflineXp) {
            currentDisp = pendingOfflineXp;
            clearInterval(interval);
        }
        xpEl.innerText = "+" + currentDisp.toLocaleString() + " XP";
    }, 30);
}

// Claim Logic
function claimStrategy() {
    // Add XP
    player.xp += pendingOfflineXp;
    
    // Check Level Up
    if(player.xp >= player.nextXp) {
        player.lvl++; 
        player.xp = player.xp - player.nextXp; // Overflow
        player.nextXp *= 1.6;
        if(player.lvl >= 100) { player.lvl = 1; player.rank++; }
        alert("LEVEL UP! YOU FEEL STRONGER!");
    }

    // Reset
    pendingOfflineXp = 0;
    offlineMinutes = 0;
    player.lastSave = Date.now(); // Reset timestamp
    
    syncUI();
    saveGame(); // Save immediately
    closeStrategy();
    
    const btn = document.querySelector(".side-btn:first-child"); 
    if(btn) btn.style.border = "2px solid #555"; // Reset border
}

function closeStrategy() {
    document.getElementById('strategy-modal').style.display = 'none';
}
