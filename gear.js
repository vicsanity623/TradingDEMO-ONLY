/**
 * GEAR.JS - Modern Inventory & Selling System
 * Updated to match HUB style (Colors, Stacking, Rarity)
 */

(function () {

    // --- CONFIG ---
    const CONFIG = {
        SELL_DIVISOR: 5,
        GRID_SIZE: 20 // Increased grid size for better view
    };

    const RARITY_NAMES = { 1: "B", 2: "R", 3: "L", 4: "S", 5: "SS", 6: "SSS", 7: "SSS2", 8: "SSS3", 9: "SSS4", 10: "SSS5" };

    // CSS Class Mapping for Rarities (Must match style.css)
    function getRarityClass(r) {
        if (r === 1) return 'item-basic';
        if (r === 2) return 'item-rare';
        if (r === 3) return 'item-legendary';
        if (r === 4) return 'item-s';
        if (r === 5) return 'item-ss';
        if (r >= 6) return 'item-sss';
        return 'item-basic';
    }

    // --- HELPER FUNCTIONS ---
    function getSellPrice(item) {
        if (!item || !item.val) return 0;
        return Math.floor(item.val / CONFIG.SELL_DIVISOR);
    }

    const GearSystem = {
        selectedIdx: -1,

        init: function () {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.bindEvents());
            } else {
                this.bindEvents();
            }
        },

        bindEvents: function () {
            const closeBtn = document.getElementById('g-close-btn');
            const detailsBtn = document.getElementById('g-details-btn');
            const sellBtn = document.getElementById('g-sell-btn');
            const sellAllBtn = document.getElementById('g-sell-all-btn');
            const modalClose = document.getElementById('g-modal-close');
            const list = document.getElementById('gear-list');

            if (closeBtn) closeBtn.onclick = () => this.close();
            if (detailsBtn) detailsBtn.onclick = () => this.details();
            if (sellBtn) sellBtn.onclick = () => this.sell();
            if (sellAllBtn) sellAllBtn.onclick = () => this.sellAll();
            if (modalClose) modalClose.onclick = () => {
                const m = document.getElementById('g-modal');
                if (m) m.style.display = 'none';
            };

            if (list) {
                list.addEventListener('click', (e) => {
                    const slot = e.target.closest('.g-slot');
                    // Ensure we clicked a valid item slot, not an empty one
                    if (slot && slot.dataset.index !== undefined && slot.classList.contains('has-item')) {
                        this.select(parseInt(slot.dataset.index));
                    }
                });
            }
        },

        open: function () {
            this.selectedIdx = -1;
            const overlay = document.getElementById('gear-overlay');
            if (overlay) overlay.style.display = 'flex';
            this.render();
        },

        close: function () {
            const overlay = document.getElementById('gear-overlay');
            const modal = document.getElementById('g-modal');
            if (overlay) overlay.style.display = 'none';
            if (modal) modal.style.display = 'none';

            // Sync Hub UI when closing to reflect sales
            if (typeof window.syncUI === "function") window.syncUI();
        },

        render: function () {
            const list = document.getElementById('gear-list');
            if (!list) return;

            list.innerHTML = '';
            const fragment = document.createDocumentFragment();

            let inventory = (typeof window.player !== 'undefined' && window.player.inv) ? window.player.inv : [];

            // Auto-sort inventory by highest rarity, then by value
            if (inventory.length > 0) {
                inventory.sort((a, b) => {
                    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
                    return b.val - a.val;
                });
            }

            inventory.forEach((item, i) => {
                const slot = document.createElement('div');

                // Add Rarity Class for Color/Border
                const rarityClass = getRarityClass(item.rarity);
                const isSelected = this.selectedIdx === i ? 'selected' : '';

                slot.className = `g-slot has-item ${rarityClass} ${isSelected}`;
                slot.dataset.index = i;

                let emoji = item.type === 'w' ? '⚔️' : '🛡️';
                let tierLetter = RARITY_NAMES[item.rarity] || "B";
                let qtyHtml = item.qty > 1 ? `<div class="qty-badge">x${item.qty}</div>` : '';

                slot.innerHTML = `
                    <div class="g-tier" style="color:inherit; font-weight:bold;">${tierLetter}</div>
                    <div class="g-type-icon">${emoji}</div>
                    ${qtyHtml}
                `;

                fragment.appendChild(slot);
            });

            // Fill empty slots
            const emptyCount = Math.max(0, CONFIG.GRID_SIZE - inventory.length);
            for (let i = 0; i < emptyCount; i++) {
                const empty = document.createElement('div');
                empty.className = 'g-slot empty';
                empty.style.opacity = "0.2";
                empty.style.cursor = "default";
                empty.style.border = "2px dashed #777";
                fragment.appendChild(empty);
            }

            list.appendChild(fragment);

            // Update Buttons
            const hasItem = this.selectedIdx !== -1 && inventory[this.selectedIdx];
            const sellBtn = document.getElementById('g-sell-btn');
            const sellAllBtn = document.getElementById('g-sell-all-btn');
            const detailsBtn = document.getElementById('g-details-btn');
            const smeltBtn = document.getElementById('g-smelt-btn');

            if (sellBtn) sellBtn.disabled = !hasItem;
            if (sellAllBtn) sellAllBtn.disabled = !hasItem;
            if (detailsBtn) detailsBtn.disabled = !hasItem;

            if (smeltBtn && window.player && window.player.gear) {
                const w = window.player.gear.w;
                const a = window.player.gear.a;
                // Only show if SSS5 (rarity 10) is equipped in both slots
                if (w && w.rarity === 10 && a && a.rarity === 10) {
                    smeltBtn.style.display = 'block';
                } else {
                    smeltBtn.style.display = 'none';
                }
            }

            // Reset Info Box if no selection
            if (!hasItem) {
                const nameEl = document.getElementById('g-display-name');
                const statsEl = document.getElementById('g-display-stats');
                if (nameEl) nameEl.innerText = "SELECT AN ITEM";
                if (statsEl) statsEl.innerText = "Tap inventory to manage";
            }
        },

        select: function (i) {
            if (typeof window.player === 'undefined' || !window.player.inv[i]) return;

            this.selectedIdx = i;
            const item = window.player.inv[i];
            const nameEl = document.getElementById('g-display-name');
            const statsEl = document.getElementById('g-display-stats');

            if (nameEl) nameEl.innerText = item.n;
            if (statsEl) {
                const valStr = window.formatNumber ? window.formatNumber(item.val) : item.val;
                const sellStr = window.formatNumber ? window.formatNumber(getSellPrice(item)) : getSellPrice(item);

                let bonusTxt = "";
                if (item.qty > 1) {
                    const totalSell = getSellPrice(item) * item.qty;
                    const totalStr = window.formatNumber ? window.formatNumber(totalSell) : totalSell;
                    bonusTxt = `<br><span style="color:#e67e22">Stack Sell Price: ${totalStr}</span>`;
                }

                statsEl.innerHTML = `
                    <span style="color:#00ffff">Power: +${valStr}</span><br>
                    <span style="color:#f1c40f">Sell Price: ${sellStr}</span>${bonusTxt}
                `;
            }

            this.render();
        },

        sell: function () {
            if (this.selectedIdx === -1 || typeof window.player === 'undefined') return;

            const item = window.player.inv[this.selectedIdx];
            if (!item) return;

            const price = getSellPrice(item);

            // Add Gold
            window.player.coins += price;

            // Decrease Quantity Logic
            item.qty--;

            // If empty, remove from array
            if (item.qty <= 0) {
                window.player.inv.splice(this.selectedIdx, 1);
                this.selectedIdx = -1; // Reset selection
            }

            const nameEl = document.getElementById('g-display-name');
            const statsEl = document.getElementById('g-display-stats');

            if (nameEl) nameEl.innerText = "SOLD!";
            if (statsEl) statsEl.innerText = `Earned ${window.formatNumber ? window.formatNumber(price) : price} coins`;

            window.isDirty = true;
            this.render();
        },

        sellAll: function () {
            if (this.selectedIdx === -1 || typeof window.player === 'undefined') return;

            const item = window.player.inv[this.selectedIdx];
            if (!item) return;

            const totalPrice = getSellPrice(item) * item.qty;

            // Add Gold
            window.player.coins += totalPrice;

            // Remove from array
            window.player.inv.splice(this.selectedIdx, 1);
            this.selectedIdx = -1; // Reset selection

            const nameEl = document.getElementById('g-display-name');
            const statsEl = document.getElementById('g-display-stats');

            if (nameEl) nameEl.innerText = "STACK SOLD!";
            if (statsEl) statsEl.innerText = `Earned ${window.formatNumber ? window.formatNumber(totalPrice) : totalPrice} coins`;

            window.isDirty = true;
            this.render();
        },

        details: function () {
            if (this.selectedIdx === -1 || typeof window.player === 'undefined') return;

            const item = window.player.inv[this.selectedIdx];
            const modal = document.getElementById('g-modal');

            if (modal && item) {
                const worldNum = (typeof window.battle !== 'undefined') ? window.battle.world : 1;
                const valStr = window.formatNumber ? window.formatNumber(item.val) : item.val;

                document.getElementById('gm-name').innerText = item.n;
                document.getElementById('gm-body').innerHTML = `
                    <div style="text-align:left; padding:10px;">
                        <div><b>Type:</b> ${item.type === 'w' ? '⚔️ Weapon' : '🛡️ Armor'}</div>
                        <div><b>Rarity:</b> Tier ${item.rarity}</div>
                        <div><b>Stats:</b> <span style="color:#00ffff">+${valStr}</span> Power</div>
                        <div style="margin-top:10px; font-size:0.8rem; color:#aaa;">
                            Stack Size: ${item.qty}<br>
                            Found in World ${worldNum}
                        </div>
                    </div>
                `;

                const sellP = getSellPrice(item);
                const sellStr = window.formatNumber ? window.formatNumber(sellP) : sellP;
                document.getElementById('gm-price').innerText = `Sell Value: 🪙 ${sellStr}`;

                modal.style.display = 'block';
            }
        }
    };

    window.GearSystem = {
        open: () => GearSystem.open(),
        close: () => GearSystem.close(),
        render: () => GearSystem.render()
    };

    GearSystem.init();

})();