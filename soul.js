/* ============================
   SOUL.JS – SOUL LEVEL SYSTEM
   ============================ */

(function() {

    const SoulSystem = {
        
        // BALANCING NOTE: 
        // 1.5x Power Growth is HUGE. 
        // To balance this, the COST should also grow.
        // Current Cost: 100 * Lvl (Linear) -> Too cheap later on.
        // New Cost: 100 * (1.1 ^ Lvl) -> Scales slightly to keep up with power.
        getSoulsNeeded: function() {
            const lvl = window.player.soulLevel || 1;
            if (lvl === 1) return 100;
            return Math.floor(100 * Math.pow(1.15, lvl)); 
        },

        // This is your Source of Truth for the multiplier
        getMultiplier: function() {
            const lvl = window.player.soulLevel || 1;
            return Math.pow(1.5, lvl);
        },

        gainSoul: function() {
            if (!window.player.soulLevel) window.player.soulLevel = 1;
            if (!window.player.souls) window.player.souls = 0;

            const needed = this.getSoulsNeeded();
            
            if (window.player.souls < needed) {
                window.player.souls++;
                this.updateBtnUI();
            }
        },

        updateBtnUI: function() {
            const btnPct = document.getElementById('soul-btn-pct');
            const btnLvl = document.getElementById('soul-btn-lvl');
            const ring = document.getElementById('soul-ring');

            if (!btnPct) return;

            const lvl = window.player.soulLevel || 1;
            const cur = window.player.souls || 0;
            const max = this.getSoulsNeeded();
            
            // Prevent division by zero or errors
            const safeMax = max > 0 ? max : 100;
            const pct = Math.min(100, Math.floor((cur / safeMax) * 100));

            btnPct.innerText = `${pct}%`;
            btnLvl.innerText = `Lv.${lvl}`;

            const color = pct >= 100 ? '#00ffff' : '#00d2ff';
            ring.style.background = `conic-gradient(${color} ${pct}%, transparent ${pct}%)`;
            
            const btn = document.getElementById('btn-soul');
            if (btn) {
                if (pct >= 100) {
                    btn.style.borderColor = '#00ffff';
                    btn.style.boxShadow = '0 0 10px #00ffff';
                } else {
                    btn.style.borderColor = '#555';
                    btn.style.boxShadow = 'none';
                }
            }
        },

        openModal: function() {
            const modal = document.getElementById('soul-modal');
            if (modal) {
                modal.style.display = 'flex';
                this.refreshModal();
            }
        },

        closeModal: function() {
            const modal = document.getElementById('soul-modal');
            if (modal) modal.style.display = 'none';
        },

        refreshModal: function() {
            const lvl = window.player.soulLevel || 1;
            const cur = window.player.souls || 0;
            const max = this.getSoulsNeeded();
            const pct = Math.min(100, Math.floor((cur / max) * 100));
            
            // Calculate Current vs Next Stats
            const currentMult = this.getMultiplier();
            const nextMult = Math.pow(1.5, lvl + 1);
            
            const displayPct = window.formatNumber ? window.formatNumber(Math.floor((currentMult - 1) * 100)) : Math.floor((currentMult - 1) * 100);
            const nextDisplayPct = window.formatNumber ? window.formatNumber(Math.floor((nextMult - 1) * 100)) : Math.floor((nextMult - 1) * 100);

            document.getElementById('sm-level').innerText = `Lv.${lvl}`;
            document.getElementById('sm-pct').innerText = `${pct}%`;
            document.getElementById('sm-pct').style.color = pct >= 100 ? '#00ffff' : 'white';

            // Show "Current -> Next" so player sees the gain
            const statsHTML = `
                <div style="margin-bottom:5px; color:#aaa; font-size:0.9rem;">Current Power: <span style="color:white">+${displayPct}%</span></div>
                <div style="margin-bottom:15px; color:#00ffff; font-size:1.1rem;">Next Level: +${nextDisplayPct}%</div>
                
                <div style="text-align:left; font-size:0.85rem; color:#ddd;">
                    <div>⚔️ Total Attack & Defense Boost</div>
                    <div>💰 Gold & XP Income Boost</div>
                    <div>⚡ Charge Might: +${(lvl * 10).toLocaleString()}%</div>
                </div>
            `;
            document.getElementById('sm-stats').innerHTML = statsHTML;

            const btn = document.getElementById('btn-liberate');
            const req = document.getElementById('sm-req');
            
            if (pct >= 100) {
                btn.classList.add('ready');
                btn.disabled = false;
                btn.innerText = "SOUL LIBERATION";
                req.innerText = "Ready to Ascend!";
                req.style.color = "#00ff00";
            } else {
                btn.classList.remove('ready');
                btn.disabled = true;
                btn.innerText = "GATHER MORE SOULS";
                req.innerText = `Requires ${max - cur} more Souls`;
                req.style.color = "#555";
            }
        },

        liberate: function() {
            const cur = window.player.souls || 0;
            const max = this.getSoulsNeeded();

            if (cur >= max) {
                window.player.soulLevel++;
                window.player.souls = 0; 
                
                if (window.popDamage) window.popDamage("SOUL LEVEL UP!", 'view-char', true);
                
                this.updateBtnUI();
                this.refreshModal();
                
                // FORCE UI UPDATE IN GAME.JS
                if(typeof window.syncUI === 'function') window.syncUI();
                window.isDirty = true;
            }
        }
    };

    window.SoulSystem = SoulSystem;

})();