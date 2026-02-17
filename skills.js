/* ============================
   SKILLS.JS – OPTIMIZED
   RPG SKILL SYSTEM
   ============================ */

(function () {

    /* -------------------------
       CONSTANTS
    ------------------------- */
    const STORAGE_KEY = 'GOKU_SKILLS_V1';

    // Default Skill Data
    const DEFAULT_SKILLS = {
        doubleHit: {
            id: 'doubleHit',
            name: 'Double Hit',
            level: 1,
            xp: 0,
            xpToNext: 100,
            unlocked: false,
            cooldown: 3000,
            lastUsed: 0
        },
        focus: {
            id: 'focus',
            name: 'Focus',
            level: 1,
            xp: 0,
            xpToNext: 120,
            unlocked: false,
            cooldown: 7000,
            lastUsed: 0
        },
        kameBlast: {
            id: 'kameBlast',
            name: 'Kame Blast',
            level: 1,
            xp: 0,
            xpToNext: 150,
            unlocked: false,
            cooldown: 12000,
            lastUsed: 0
        }
    };

    /* -------------------------
       INTERNAL STATE
    ------------------------- */
    const now = () => Date.now();
    let skills = loadSkills();

    function loadSkills() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : structuredClone(DEFAULT_SKILLS);
        } catch (e) {
            console.error("Failed to load skills", e);
            return structuredClone(DEFAULT_SKILLS);
        }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
    }

    /* -------------------------
       HELPER FUNCTIONS
    ------------------------- */
    function updateUnlocks() {
        if (!window.GameState) return;

        if (GameState.gokuLevel >= 30) skills.doubleHit.unlocked = true;
        if (GameState.gokuLevel >= 50) skills.focus.unlocked = true;
        if (GameState.gokuLevel >= 70) skills.kameBlast.unlocked = true;
        save();
    }

    function gainXP(skill, amount) {
        skill.xp += amount;
        if (skill.xp >= skill.xpToNext) {
            skill.xp -= skill.xpToNext;
            skill.level++;
            skill.xpToNext = Math.floor(skill.xpToNext * 1.25);

            // Cooldown Reduction Logic
            if (skill.id === 'doubleHit') {
                skill.cooldown = Math.max(1000, skill.cooldown - 150);
            } else if (skill.id === 'focus') {
                skill.cooldown = Math.max(2000, skill.cooldown - 300);
            } else if (skill.id === 'kameBlast') {
                skill.cooldown = Math.max(4000, skill.cooldown - 500);
            }
        }
        save();
    }

    function canUse(skill) {
        return now() - skill.lastUsed >= skill.cooldown;
    }

    /* -------------------------
       SKILL LOGIC EXPORTS
    ------------------------- */
    const Skills = {};

    Skills.useDoubleHit = function (battleRef) {
        const s = skills.doubleHit;

        if (!s.unlocked || !canUse(s) || !battleRef || !battleRef.active || !battleRef.enemy) return 0;

        s.lastUsed = now();
        gainXP(s, 15);

        // Visual Feedback
        if (window.popDamage) {
            const floatText = document.createElement('div');
            floatText.className = 'pop skill-text';
            floatText.innerText = "DOUBLE HIT!";
            floatText.style.color = '#ff9900';
            floatText.style.fontSize = '2.5rem';
            floatText.style.left = '50%';
            floatText.style.top = '25%';
            floatText.style.zIndex = 100;
            floatText.style.textShadow = '2px 2px 0 #000';
            document.body.appendChild(floatText);
            setTimeout(() => floatText.remove(), 1000);
        }

        const duration = 3000;
        const hitsPerSecond = 10;
        const intervalTime = 1000 / hitsPerSecond;
        const dmgPerHit = Math.ceil((window.GameState ? GameState.gokuPower : 10) * 0.4);

        const rapidInterval = setInterval(() => {
            if (!window.GameState || !GameState.inBattle || !battleRef.active || battleRef.enemy.hp <= 0) {
                clearInterval(rapidInterval);
                return;
            }

            battleRef.enemy.hp -= dmgPerHit;
            if (window.popDamage) window.popDamage(dmgPerHit, 'e-box');

        }, intervalTime);

        setTimeout(() => clearInterval(rapidInterval), duration);

        save();
        return 0; // Damage handled internally via interval
    };

    Skills.useFocus = function () {
        const s = skills.focus;
        if (!s.unlocked || !canUse(s) || !window.GameState) return 0;

        s.lastUsed = now();
        gainXP(s, 12);

        const healPercent = Math.min(100, 12 + s.level * 4);
        const healAmount = GameState.gokuMaxHP * (healPercent / 100);

        GameState.gokuHP = Math.min(GameState.gokuMaxHP, GameState.gokuHP + healAmount);

        // Green particle healing visual
        const playerContainer = document.getElementById('view-char') || document.body;

        // Spawn 18 green particles
        for (let i = 0; i < 18; i++) {
            const particle = document.createElement('div');
            particle.className = 'focus-particle';

            // Random position around center
            const angle = (Math.PI * 2 * i) / 18;
            const distance = 20 + Math.random() * 40;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            particle.style.left = `calc(50% + ${x}px)`;
            particle.style.top = `calc(50% + ${y}px)`;
            particle.style.animationDelay = `${i * 0.05}s`;

            playerContainer.appendChild(particle);
            setTimeout(() => particle.remove(), 1500);
        }

        // Heal amount text
        const healText = document.createElement('div');
        healText.className = 'pop';
        healText.innerText = `+${window.formatNumber ? window.formatNumber(Math.floor(healAmount)) : Math.floor(healAmount)}`;
        healText.style.color = '#2ecc71';
        healText.style.fontSize = '2rem';
        healText.style.fontWeight = 'bold';
        healText.style.textShadow = '0 0 10px #2ecc71, 0 0 20px #2ecc71';
        healText.style.left = '50%';
        healText.style.top = '30%';
        healText.style.zIndex = '9999';
        playerContainer.appendChild(healText);
        setTimeout(() => healText.remove(), 1200);

        save();
        return healAmount;
    };

    Skills.useKameBlast = function () {
        const s = skills.kameBlast;
        if (!s.unlocked || !canUse(s) || !window.GameState) return 0;

        s.lastUsed = now();
        gainXP(s, 20);

        triggerKameVisual();

        const damage = GameState.gokuPower * 10;
        save();
        return damage;
    };

    // Called every frame/tick by battle.js
    Skills.autoBattleTick = function (battleRef) {
        updateUnlocks();
        if (!window.GameState || !GameState.inBattle) return;

        if (skills.doubleHit.unlocked && canUse(skills.doubleHit)) {
            Skills.useDoubleHit(battleRef);
        }

        if (skills.focus.unlocked && canUse(skills.focus) && GameState.gokuHP < GameState.gokuMaxHP * 0.6) {
            Skills.useFocus();
        }

        if (skills.kameBlast.unlocked && canUse(skills.kameBlast)) {
            if (battleRef && battleRef.active && battleRef.enemy) {
                const dmg = Skills.useKameBlast();
                if (dmg > 0) {
                    battleRef.enemy.hp -= dmg;
                    if (window.popDamage) window.popDamage(dmg, 'e-box', true);
                }
            }
        }
    };

    /* -------------------------
       UI MANAGEMENT
    ------------------------- */
    Skills.openSkillScreen = function () {
        updateUnlocks();

        const overlay = document.getElementById('skills-overlay');
        if (!overlay) return;

        const container = document.getElementById('skills-list-container');
        if (container) {
            container.innerHTML = `
                ${renderSkillCard(skills.doubleHit, 'Level 30')}
                ${renderSkillCard(skills.focus, 'Level 50')}
                ${renderSkillCard(skills.kameBlast, 'Level 70')}
            `;
        }

        overlay.style.display = 'flex';
    };

    Skills.closeSkillScreen = function () {
        const overlay = document.getElementById('skills-overlay');
        if (overlay) overlay.style.display = 'none';
    };

    function renderSkillCard(skill, unlockText) {
        const locked = !skill.unlocked;
        const cd = (skill.cooldown / 1000).toFixed(1);
        const progress = Math.min(100, (skill.xp / skill.xpToNext) * 100);

        return `
        <div class="skill-card ${locked ? 'locked' : ''}">
            <div class="skill-header">
                <h2>${skill.name} ${locked ? '🔒' : ''}</h2>
                <span class="skill-lvl">${locked ? `Unlocks: ${unlockText}` : `Level ${skill.level}`}</span>
            </div>
            
            <div class="skill-bar-bg">
                <div class="skill-bar-fill" style="width:${progress}%;"></div>
            </div>
            
            <div class="skill-stats">
                <span>XP: ${Math.floor(skill.xp)} / ${skill.xpToNext}</span>
                <span>CD: ${cd}s</span>
            </div>
        </div>
        `;
    }

    function triggerKameVisual() {
        const flash = document.createElement('div');
        flash.className = 'kame-visual-beam';
        document.body.appendChild(flash);

        // Trigger animation
        requestAnimationFrame(() => {
            flash.style.opacity = '0';
            flash.style.transition = 'opacity 0.5s ease-out';

            // Charge phase
            requestAnimationFrame(() => {
                flash.style.opacity = '0.3';

                // Flash phase
                setTimeout(() => {
                    flash.style.transition = 'opacity 0.3s ease-out';
                    flash.style.opacity = '0.9';

                    // Fade out
                    setTimeout(() => {
                        flash.style.transition = 'opacity 1.2s ease-in';
                        flash.style.opacity = '0';

                        setTimeout(() => flash.remove(), 1200);
                    }, 300);
                }, 500);
            });
        });
    }

    window.Skills = Skills;

})();