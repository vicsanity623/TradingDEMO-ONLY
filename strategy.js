/* ============================
   STRATEGY.JS – OPTIMIZED
   Offline Progression System
   ============================ */

(function() {

    // Internal State
    let pendingOfflineXp = 0;
    let pendingOfflineGold = 0;
    let pendingItems = [];
    let offlineMinutes = 0;

    // --- INITIALIZATION ---
    function initStrategy() {
        // Safety check for player object
        if (typeof player === 'undefined' || !player) return;

        const now = Date.now();
        const lastSave = player.lastSave || now;
        const diffMs = now - lastSave;

        // Minimum 2 minutes to trigger offline gains
        if (diffMs >= 120000) { 
            offlineMinutes = Math.floor(diffMs / 60000);
            const multiplier = (player.rank || 0) + 1;
            
            // Calc Gains
            pendingOfflineXp = offlineMinutes * 225 * multiplier;
            pendingOfflineGold = offlineMinutes * 500 * multiplier;

            // Item Logic: ~50% chance every 30 mins
            pendingItems = [];
            const itemRolls = Math.floor(offlineMinutes / 30); 
            for(let i = 0; i < itemRolls; i++) {
                if(Math.random() > 0.5) { 
                    pendingItems.push({
                        n: "Training Gear", 
                        type: Math.random() > 0.5 ? 'w' : 'a', 
                        val: 700,
                        rarity: 1 
                    });
                }
            }

            console.log(`[Strategy] Offline: ${offlineMinutes}m. XP: ${pendingOfflineXp}, Gold: ${pendingOfflineGold}`);
            
            // Visual Indicator
            updateStrategyButton(true);
        }
    }

    function updateStrategyButton(active) {
        const btns = document.querySelectorAll(".side-btn");
        btns.forEach(btn => {
            // Check if this is the Strategy button
            if(btn.innerHTML.includes('Strategy') || btn.innerText.includes('Strategy')) {
                if (active) {
                    btn.style.borderColor = "#00ff00";
                    btn.style.boxShadow = "0 0 10px #00ff00";
                    if(!btn.querySelector('.strat-dot')) {
                        const dot = document.createElement('div');
                        dot.className = 'strat-dot';
                        // Inline style for simplicity, or move to CSS
                        dot.style.cssText = "position:absolute; top:0; right:0; width:10px; height:10px; background:red; border-radius:50%; box-shadow:0 0 5px red;";
                        btn.appendChild(dot);
                    }
                } else {
                    btn.style.borderColor = "#555";
                    btn.style.boxShadow = "none";
                    const dot = btn.querySelector('.strat-dot');
                    if(dot) dot.remove();
                }
            }
        });
    }

    // --- UI INTERACTION ---
    function openStrategy() {
        if(pendingOfflineXp <= 0) {
            // Non-blocking notification (console or simple visual shake/toast)
            console.log("Capsule Gravitron is charging (Requires > 2m offline).");
            return;
        }

        const modal = document.getElementById('strategy-modal');
        if (!modal) return; // HTML must exist in index.html

        modal.style.display = 'flex';
        
        const timeEl = document.getElementById('strat-time');
        const multEl = document.getElementById('strat-mult');
        
        if(timeEl) timeEl.innerText = offlineMinutes;
        if(multEl) {
            const multiplier = (player.rank || 0) + 1;
            multEl.innerText = `x${multiplier}`;
        }
        
        // Display Results
        const xpEl = document.getElementById('strat-xp-display');
        const goldEl = document.getElementById('strat-gold-display');
        const itemEl = document.getElementById('strat-item-display');

        if(xpEl) xpEl.innerText = "+" + pendingOfflineXp.toLocaleString() + " XP";
        if(goldEl) goldEl.innerText = "+" + pendingOfflineGold.toLocaleString() + " COINS";
        
        if(itemEl) {
            if(pendingItems.length > 0) {
                itemEl.innerText = `FOUND: ${pendingItems.length} ITEM(S)`;
                itemEl.style.color = "#00ff00";
            } else {
                itemEl.innerText = "No Items Found";
                itemEl.style.color = "#00d2ff";
            }
        }
    }

    function claimStrategy() {
        // Apply Rewards
        if (typeof player !== 'undefined') {
            player.xp += pendingOfflineXp;
            player.coins += pendingOfflineGold;

            if (pendingItems.length > 0) {
                if (typeof window.addToInventory === 'function') {
                    pendingItems.forEach(item => window.addToInventory(item));
                } else {
                    player.inv.push(...pendingItems);
                }
            }
        }

        // Level Up Check
        if(typeof window.checkLevelUp === 'function') {
            window.checkLevelUp();
        }

        // Reset State
        pendingOfflineXp = 0;
        pendingOfflineGold = 0;
        pendingItems = [];
        offlineMinutes = 0;
        
        // UI & Save Updates
        if(typeof window.syncUI === 'function') window.syncUI();
        
        if (typeof player !== 'undefined') player.lastSave = Date.now(); 
        
        // Removed explicit saveGame() call to avoid redundancy 
        // as player.lastSave update + next loop save is sufficient, 
        // but keeping if immediate persistence is critical.
        // if(typeof window.saveGame === 'function') window.saveGame();
        
        closeStrategy();
        updateStrategyButton(false);
    }

    function closeStrategy() {
        const modal = document.getElementById('strategy-modal');
        if(modal) modal.style.display = 'none';
    }

    // --- EXPORTS ---
    window.initStrategy = initStrategy;
    window.openStrategy = openStrategy;
    window.claimStrategy = claimStrategy;
    window.closeStrategy = closeStrategy;

})();
