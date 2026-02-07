/* ============================
   HUB.JS - Hub Horde Battle
   ============================ */

(function() {

    const HubBattle = {
        running: false,
        container: null,
        enemies: [],
        playerEl: null,
        killCount: 0,
        spawnInterval: null,
        animFrame: null,
        
        // Settings
        spawnRate: 800, // ms
        speed: 2,
        
        init: function() {
            this.container = document.getElementById('hub-arena');
            if(!this.container) return;
            
            // Create Mini Goku
            this.playerEl = document.createElement('img');
            this.playerEl.src = "IMG_0054.png"; // Reuse player sprite
            this.playerEl.className = "hub-goku";
            this.container.appendChild(this.playerEl);
            
            this.start();
        },

        start: function() {
            if(this.running) return;
            this.running = true;
            this.killCount = 0;
            this.enemies = [];
            
            // Start Loop
            this.loop();
            this.spawnInterval = setInterval(() => this.spawnEnemy(), this.spawnRate);
        },

        stop: function() {
            this.running = false;
            clearInterval(this.spawnInterval);
            cancelAnimationFrame(this.animFrame);
            
            // Clear enemies
            const enemies = document.querySelectorAll('.hub-enemy');
            enemies.forEach(e => e.remove());
            this.enemies = [];
        },

        spawnEnemy: function() {
            if(!this.running || document.hidden) return;
            
            const el = document.createElement('img');
            // Using a colored box if frieza image is missing, or use a placeholder URL
            el.src = "https://upload.wikimedia.org/wikipedia/en/2/29/Frieza_in_Dragon_Ball_Super.png"; // Placeholder Frieza
            el.className = "hub-enemy";
            el.onerror = function() { this.style.display='none'; }; // Hide if broken
            
            // Random Y Position
            const maxY = this.container.clientHeight - 60;
            const y = Math.floor(Math.random() * maxY);
            
            el.style.top = y + "px";
            el.style.left = "100%"; // Start off screen right
            
            this.container.appendChild(el);
            
            this.enemies.push({
                el: el,
                x: this.container.clientWidth,
                y: y,
                hp: 1, // 1 hit kill
                state: 'move'
            });
        },

        loop: function() {
            if(!this.running) return;

            // Move Enemies
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                e.x -= this.speed;
                e.el.style.left = e.x + "px";

                // Auto-Attack Logic (Goku Teleport)
                // Goku picks the closest enemy to the left side
                if (e.x < 250 && e.state === 'move') {
                    this.gokuAttack(e);
                }

                // Cleanup off-screen
                if(e.x < -50) {
                    e.el.remove();
                    this.enemies.splice(i, 1);
                }
            }

            this.animFrame = requestAnimationFrame(() => this.loop());
        },

        gokuAttack: function(enemy) {
            enemy.state = 'dying';
            
            // Teleport Visual
            this.playerEl.style.transition = 'none';
            this.playerEl.style.top = (enemy.y - 10) + "px";
            this.playerEl.style.left = (enemy.x - 40) + "px";
            this.playerEl.classList.add('hub-flash');
            
            // Play attack animation via CSS class swap
            this.playerEl.src = "IMG_0061.png"; // Switch to attack sprite if available (using base for now)
            this.playerEl.style.transform = "scale(1.2)";

            // Impact
            setTimeout(() => {
                this.playerEl.style.transform = "scale(1)";
                this.playerEl.classList.remove('hub-flash');
                
                // Kill Enemy
                enemy.el.classList.add('hub-die');
                setTimeout(() => {
                    enemy.el.remove();
                    const idx = this.enemies.indexOf(enemy);
                    if(idx > -1) this.enemies.splice(idx, 1);
                }, 300);

                // Rewards
                this.handleReward();

            }, 100);
        },

        handleReward: function() {
            this.killCount++;
            
            // Small XP/Gold
            window.player.xp += 10;
            window.player.coins += 5;
            
            // Souls Logic: 5 kills = 2 souls
            if(this.killCount % 5 === 0) {
                if(window.SoulSystem) {
                    window.SoulSystem.gainSoul();
                    window.SoulSystem.gainSoul(); // +2
                    
                    // Show Floating Text
                    this.showFloat("+2 SOULS", "#00ffff");
                }
            }
            
            // Sync specific UI elements periodically or rely on other loops
            // We won't call syncUI() every kill to save performance, 
            // but the train loop or battle loop elsewhere will eventually catch it.
            // Or we can simple update the text fields directly.
            const xpBar = document.getElementById('bar-xp');
            if(xpBar) {
                const xpPct = (window.player.xp / window.player.nextXp) * 100;
                xpBar.style.width = xpPct + "%";
            }
        },
        
        showFloat: function(text, color) {
            const el = document.createElement('div');
            el.className = 'hub-float';
            el.innerText = text;
            el.style.color = color;
            el.style.left = this.playerEl.style.left;
            el.style.top = this.playerEl.style.top;
            this.container.appendChild(el);
            setTimeout(() => el.remove(), 800);
        }
    };

    // Expose
    window.HubBattle = HubBattle;

})();
