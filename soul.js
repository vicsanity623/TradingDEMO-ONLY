/* ============================
   SOUL.JS – SOUL LEVEL SYSTEM
   ============================ */

(function() {

    const SoulSystem = {
        
        // Cost Formula: 100 * Level (Linear cost scaling is fine if rewards are exponential)
        getSoulsNeeded: function() {
            const lvl = window.player.soulLevel || 1;
            if (lvl === 1) return 100;
            return 100 * lvl; 
        },

        // --- NEW: EXPONENTIAL MULTIPLIER ---
        // Base 1.5x per level (50% compounding growth)
        // Level 1 = 1.5x
        // Level 10 = 57x
        // Level 20 = 3,325x
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
            const pct = Math.min(100, Math.floor((cur / max) * 100));

            btnPct.innerText = `${pct}%`;
            btnLvl.innerText = `Lv.${lvl}`;

            const color = pct >= 100 ? '#00ffff' : '#00d2ff';
            ring.style.background = `conic-gradient(${color} ${pct}%, transparent ${pct}%)`;
            
            const btn = document.getElementById('btn-soul');
            if (pct >= 100) {
                btn.style.borderColor = '#00ffff';
                btn.style.boxShadow = '0 0 10px #00ffff';
            } else {
                btn.style.borderColor = '#555';
                btn.style.boxShadow = 'none';
            }
        },

        openModal: function() {
            const modal = document.getElementById('soul-modal');
            modal.style.display = 'flex';
            this.refreshModal();
        },

        closeModal: function() {
            document.getElementById('soul-modal').style.display = 'none';
        },

        refreshModal: function() {
            const lvl = window.player.soulLevel || 1;
            const cur = window.player.souls || 0;
            const max = this.getSoulsNeeded();
            const pct = Math.min(100, Math.floor((cur / max) * 100));
            
            // Calculate Total Percentage Boost for Display
            // (Multiplier - 1) * 100 to get percentage increase
            const mult = this.getMultiplier();
            const displayPct = window.formatNumber ? window.formatNumber(Math.floor((mult - 1) * 100)) : Math.floor((mult - 1) * 100);

            document.getElementById('sm-level').innerText = `Lv.${lvl}`;
            document.getElementById('sm-pct').innerText = `${pct}%`;
            document.getElementById('sm-pct').style.color = pct >= 100 ? '#00ffff' : 'white';

            const statsHTML = `
                <div>⚔️ Total Attack: +${displayPct}%</div>
                <div>🛡️ Armor Defense: +${displayPct}%</div>
                <div>⚡ Charge Might: +${(lvl * 10).toLocaleString()}%</div>
                <div>❤️ HP Boost: +${displayPct}%</div>
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
                
                if(typeof window.syncUI === 'function') window.syncUI();
                window.isDirty = true;
            }
        }
    };

    window.SoulSystem = SoulSystem;

})();
