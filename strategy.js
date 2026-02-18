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
    let offlineSeconds = 0;

    // --- HELPER: FORMAT TIME ---
    function formatTime(totalSeconds) {
        if (totalSeconds < 60) return `${totalSeconds}s`;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    // --- INITIALIZATION ---
    function initStrategy() {
        if (typeof window.player === 'undefined' || !window.player) return;

        const now = Date.now();
        const lastSave = window.player.lastSave || now;
        const diffMs = now - lastSave;

        // Minimum 2 minutes (120000ms) to trigger offline gains
        if (diffMs >= 120000) { 
            offlineSeconds = Math.floor(diffMs / 1000);
            offlineMinutes = Math.floor(diffMs / 60000);
            
            // Capped at 24 hours (86400 seconds) to prevent infinite abuse
            if (offlineSeconds > 86400) offlineSeconds = 86400;

            const rankMult = (window.player.rank || 0) + 1;
            const soulMult = window.SoulSystem ? window.SoulSystem.getMultiplier() : 1;
            const trueLvl = (window.player.rank * 100) + (window.player.lvl || 1);

            // --- XP CALCULATION (PERCENTAGE BASED) ---
            // Goal: 1 Hour Offline = ~10% of a level
            // 10% / 60 mins = ~0.16% per minute
            // 0.0016 * nextXp * minutes
            let xpPerMin = Math.floor(window.player.nextXp * 0.002); 
            // Safety fallback for very low levels
            if (xpPerMin < 100) xpPerMin = 100 + (trueLvl * 10);
            
            pendingOfflineXp = Math.floor(xpPerMin * (offlineSeconds / 60));

            // --- GOLD CALCULATION (EXPONENTIAL) ---
            // Base scaled by level * Soul Multiplier
            // This ensures gold keeps up with inflation
            let goldPerMin = (500 + (trueLvl * 100) + Math.pow(trueLvl, 1.8)) * soulMult;
            pendingOfflineGold = Math.floor(goldPerMin * (offlineSeconds / 60));

            // --- ITEM LOGIC ---
            // 1 Item roll every 30 minutes
            pendingItems = [];
            const itemRolls = Math.floor(offlineMinutes / 30); 
            
            if (itemRolls > 0) {
                for(let i = 0; i < itemRolls; i++) {
                    if(Math.random() > 0.4) { // 60% Chance per roll
                        // Item Tier Scaling
                        const tier = Math.min(10, Math.max(1, Math.floor(trueLvl / 20)));
                        let baseVal = 700 * tier * rankMult;
                        
                        let name = "Saiyan Gear";
                        if (tier >= 2) name = "Elite Gear";
                        if (tier >= 3) name = "Legendary Gear";
                        if (tier >= 4) name = "God Gear";
                        if (tier >= 6) name = "Omni Gear";

                        pendingItems.push({
                            n: name, 
                            type: Math.random() > 0.5 ? 'w' : 'a', 
                            val: baseVal,
                            rarity: tier 
                        });
                    }
                }
            }

            console.log(`[Strategy] Offline: ${formatTime(offlineSeconds)}. XP: ${pendingOfflineXp}, Gold: ${pendingOfflineGold}`);
            
            // Show the modal immediately if there are gains
            openStrategy();
        }
    }

    // --- UI INTERACTION ---
    function openStrategy() {
        if(pendingOfflineXp <= 0 && pendingOfflineGold <= 0) return;

        const modal = document.getElementById('strategy-modal'); // You might need to rename your modal ID in HTML or here to match
        // NOTE: In your screenshot it says "OFFLINE REPORT", check if that ID is 'offline-report-modal' or similar. 
        // If you are using the existing 'strategy-modal', keep this.
        
        if (!modal) return; 

        modal.style.display = 'flex';
        
        // Update UI Elements based on your screenshot structure
        const timeEl = document.getElementById('strat-time'); // "Time Away"
        const multEl = document.getElementById('strat-mult'); // "Rank Multiplier"
        
        if(timeEl) timeEl.innerText = formatTime(offlineSeconds);
        if(multEl) multEl.innerText = `x${(window.player.rank || 0) + 1}`;
        
        // Display Results
        const xpEl = document.getElementById('strat-xp-display');
        const goldEl = document.getElementById('strat-gold-display');
        const itemEl = document.getElementById('strat-item-display');

        if(xpEl) xpEl.innerText = "+" + window.formatNumber(pendingOfflineXp) + " XP";
        if(goldEl) goldEl.innerText = "+" + window.formatNumber(pendingOfflineGold) + " COINS";
        
        if(itemEl) {
            if(pendingItems.length > 0) {
                itemEl.innerText = `FOUND: ${pendingItems.length} ITEM(S)`;
                itemEl.style.color = "#00ff00";
            } else {
                itemEl.innerText = "No Items Found";
                itemEl.style.color = "#555";
            }
        }
    }

    function claimStrategy() {
        if (!window.player) return;

        // Apply Rewards
        window.player.xp += pendingOfflineXp;
        window.player.coins += pendingOfflineGold;

        if (pendingItems.length > 0) {
            if (typeof window.addToInventory === 'function') {
                pendingItems.forEach(item => window.addToInventory(item));
            } else {
                window.player.inv.push(...pendingItems);
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
        offlineSeconds = 0;
        
        // UI & Save Updates
        if(typeof window.syncUI === 'function') window.syncUI();
        window.player.lastSave = Date.now(); 
        
        closeStrategy();
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