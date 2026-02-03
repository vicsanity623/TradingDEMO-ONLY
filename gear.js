/**
 * GEAR.JS - Inventory & Item Management System
 */

const GearSystem = {
    selectedItemIndex: -1,

    // 1. Injects CSS into the document head
    injectStyles: function() {
        const css = `
            #gear-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.95); z-index: 3000;
                display: none; flex-direction: column; padding: 20px;
                font-family: 'Orbitron', sans-serif;
            }
            .gear-header {
                display: flex; justify-content: space-between; align-items: center;
                border-bottom: 2px solid var(--dbz-orange); padding-bottom: 10px;
            }
            .gear-header h2 { font-family: 'Bangers'; color: var(--dbz-yellow); margin: 0; font-size: 2rem; }
            .close-gear { background: #ff3e3e; border: none; color: white; padding: 5px 15px; border-radius: 5px; cursor: pointer; }

            .inventory-scroll {
                flex: 1; overflow-y: auto; margin: 20px 0;
                display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; align-content: start;
            }
            .inv-slot {
                aspect-ratio: 1/1; background: #1a1a1a; border: 2px solid #333;
                border-radius: 8px; display: flex; flex-direction: column; 
                align-items: center; justify-content: center; position: relative;
            }
            .inv-slot.selected { border-color: var(--dbz-yellow); background: #222; box-shadow: 0 0 10px var(--dbz-yellow); }
            .inv-slot img { width: 70%; }
            .slot-lvl { position: absolute; bottom: 2px; right: 4px; font-size: 0.6rem; color: #888; }
            .rarity-tag { position: absolute; top: 2px; left: 4px; font-size: 0.5rem; padding: 1px 3px; border-radius: 2px; background: #444; }

            .action-bar {
                background: #111; padding: 15px; border-radius: 10px; border: 1px solid #333;
                display: flex; flex-direction: column; gap: 10px;
            }
            .item-preview-name { font-family: 'Bangers'; color: white; font-size: 1.2rem; margin-bottom: 5px; }
            .button-row { display: flex; gap: 10px; }
            .btn-details { flex: 1; background: #3498db; color: white; border: none; padding: 10px; border-radius: 5px; font-family: 'Bangers'; }
            .btn-sell { flex: 1; background: #2ecc71; color: white; border: none; padding: 10px; border-radius: 5px; font-family: 'Bangers'; }
            .btn-sell:disabled, .btn-details:disabled { opacity: 0.3; }

            /* Detail Modal */
            #item-detail-modal {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 80%; background: #222; border: 2px solid var(--dbz-yellow);
                border-radius: 15px; padding: 20px; z-index: 4000; display: none;
                box-shadow: 0 0 50px black;
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    },

    // 2. Injects HTML structure into the document body
    injectHTML: function() {
        const html = `
            <div id="gear-overlay">
                <div class="gear-header">
                    <h2>GEAR INVENTORY</h2>
                    <button class="close-gear" onclick="GearSystem.close()">X</button>
                </div>
                <div class="inventory-scroll" id="gear-inv-list"></div>
                <div class="action-bar">
                    <div id="preview-name" class="item-preview-name">Select an item</div>
                    <div class="button-row">
                        <button id="gear-details-btn" class="btn-details" disabled onclick="GearSystem.showDetails()">DETAILS</button>
                        <button id="gear-sell-btn" class="btn-sell" disabled onclick="GearSystem.sellItem()">SELL</button>
                    </div>
                </div>
            </div>

            <div id="item-detail-modal">
                <h3 id="det-name" style="font-family: 'Bangers'; color: var(--dbz-yellow); margin-top:0;"></h3>
                <p id="det-stats" style="font-size: 0.9rem; line-height: 1.4; color: #ccc;"></p>
                <div id="det-value" style="color: gold; font-weight: bold; margin-bottom: 15px;"></div>
                <button class="lvl-up-btn" style="padding: 5px; font-size: 1rem;" onclick="document.getElementById('item-detail-modal').style.display='none'">CLOSE</button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    init: function() {
        this.injectStyles();
        this.injectHTML();
    },

    open: function() {
        this.selectedItemIndex = -1;
        document.getElementById('gear-overlay').style.display = 'flex';
        this.render();
    },

    close: function() {
        document.getElementById('gear-overlay').style.display = 'none';
        document.getElementById('item-detail-modal').style.display = 'none';
    },

    render: function() {
        const list = document.getElementById('gear-inv-list');
        list.innerHTML = '';

        // Reference the global player object from index.html
        player.inv.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = `inv-slot ${this.selectedItemIndex === index ? 'selected' : ''}`;
            
            // Icon Logic
            let icon = item.type === 'w' ? '⚔️' : '🛡️';
            
            slot.innerHTML = `
                <div class="rarity-tag">${item.type === 'w' ? 'ATK' : 'DEF'}</div>
                <div style="font-size: 1.5rem;">${icon}</div>
                <div class="slot-lvl">VAL: ${Math.floor(item.val / 10)}</div>
            `;
            
            slot.onclick = () => this.select(index);
            list.appendChild(slot);
        });

        // Toggle buttons
        const hasSelection = this.selectedItemIndex !== -1;
        document.getElementById('gear-sell-btn').disabled = !hasSelection;
        document.getElementById('gear-details-btn').disabled = !hasSelection;
        
        if (!hasSelection) {
            document.getElementById('preview-name').innerText = "Select an item";
        }
    },

    select: function(index) {
        this.selectedItemIndex = index;
        const item = player.inv[index];
        document.getElementById('preview-name').innerText = item.n + " (Tier " + battle.world + ")";
        this.render();
    },

    sellItem: function() {
        if (this.selectedItemIndex === -1) return;
        
        const item = player.inv[this.selectedItemIndex];
        const sellPrice = Math.floor(item.val / 2); // Sell for half value
        
        player.coins += sellPrice;
        player.inv.splice(this.selectedItemIndex, 1);
        
        this.selectedItemIndex = -1;
        this.render();
        
        // Update main game UI
        if(typeof syncUI === "function") syncUI();
        alert(`Sold for 🪙 ${sellPrice}!`);
    },

    showDetails: function() {
        const item = player.inv[this.selectedItemIndex];
        const modal = document.getElementById('item-detail-modal');
        
        document.getElementById('det-name').innerText = item.n;
        document.getElementById('det-stats').innerText = `Type: ${item.type === 'w' ? 'Weapon' : 'Armor'}\nCombat Power Boost: +${item.val}\nMaterial: Saiyan Steel\nEffect: Instant Boost to total Power Level.`;
        document.getElementById('det-value').innerText = `Sell Value: 🪙 ${Math.floor(item.val / 2)}`;
        
        modal.style.display = 'block';
    }
};

// Auto-initialize when file is loaded
GearSystem.init();