// src/systems/InventorySystem.js
class InventorySystem {
    constructor(scene) {
        this.scene = scene;
        this.game = scene.game;

        // 인벤토리 참조
        this.inventory = this.scene.game.gameData.inventory || [];

        // 장비 참조
        this.equipment = this.scene.game.gameData.player.equipment || {
            weapon: null,
            armor: null,
            accessory: null
        };

        // 장비 슬롯 설정
        this.equipmentSlots = {
            weapon: ['sword', 'axe', 'mace', 'spear', 'bow', 'staff', 'dagger', 'wand', 'hammer', 'fist'],
            armor: ['helmet', 'chest', 'gloves', 'boots', 'shield'],
            accessory: ['ring', 'amulet', 'bracelet', 'belt', 'cloak']
        };

        // 아이템 사용 효과 함수 매핑
        this.itemEffects = {
            // 포션 효과
            'health_potion': this.useHealthPotion.bind(this),
            'mana_potion': this.useManaPotion.bind(this),
            'strength_potion': this.useStrengthPotion.bind(this),
            'defense_potion': this.useDefensePotion.bind(this),
            'speed_potion': this.useSpeedPotion.bind(this),

            // 스크롤 효과
            'teleport_scroll': this.useTeleportScroll.bind(this),
            'identify_scroll': this.useIdentifyScroll.bind(this),
            'enchant_scroll': this.useEnchantScroll.bind(this),
            'fireball_scroll': this.useFireballScroll.bind(this),
            'frost_scroll': this.useFrostScroll.bind(this),
            'lightning_scroll': this.useLightningScroll.bind(this),
            'healing_scroll': this.useHealingScroll.bind(this),
            'protection_scroll': this.useProtectionScroll.bind(this),

            // 기타 소비 아이템
            'food': this.useFood.bind(this),
            'bomb': this.useBomb.bind(this)
        };

        // 아이템 효과 이벤트 리스너
        this.scene.events.on('itemEffect', this.handleItemEffect, this);
    }

    // 인벤토리 가져오기
    getInventory() {
        return this.inventory;
    }

    // 장비 가져오기
    getEquipment() {
        return this.equipment;
    }

    // 아이템 추가
    addItem(item) {
        // 기존 아이템인지 확인 (포션 같은 소비 아이템)
        if (item.type === 'consumable') {
            const existingItem = this.inventory.find(i =>
                i.id === item.id && i.type === 'consumable'
            );

            if (existingItem) {
                existingItem.count = (existingItem.count || 1) + (item.count || 1);
                return existingItem;
            }
        }

        // 새 아이템 추가
        this.inventory.push(item);

        // 아이템 획득 이벤트 발생
        this.scene.events.emit('itemAcquired', item);

        return item;
    }

    // 아이템 제거
    removeItem(itemId, count = 1) {
        const index = this.inventory.findIndex(item => item.id === itemId);

        if (index === -1) return false;

        const item = this.inventory[index];

        // 소비 아이템인 경우 개수 감소
        if (item.type === 'consumable' && item.count > count) {
            item.count -= count;
            return true;
        }

        // 아이템 제거
        this.inventory.splice(index, 1);

        // 아이템 제거 이벤트 발생
        this.scene.events.emit('itemRemoved', itemId);

        return true;
    }

    // 아이템 사용
    useItem(itemId) {
        const item = this.getItemById(itemId);

        if (!item) return false;

        // 아이템 타입에 따른 처리
        if (item.type === 'consumable') {
            // 효과 함수 찾기
            const effectFunction = this.itemEffects[item.id] || this.itemEffects[item.subType];

            if (effectFunction) {
                // 아이템 효과 적용
                const success = effectFunction(item);

                if (success) {
                    // 아이템 소비
                    this.removeItem(itemId, 1);

                    // 아이템 사용 이벤트 발생
                    this.scene.events.emit('itemUsed', item);

                    return true;
                }
            }
        }

        return false;
    }

    // 아이템 장착
    equipItem(itemId) {
        const item = this.getItemById(itemId);

        if (!item) return false;

        // 장착 가능한 아이템인지 확인
        if (!this.isEquippable(item)) return false;

        // 요구 레벨 확인
        if (item.requiredLevel && this.scene.player.level < item.requiredLevel) {
            // 레벨 부족 알림
            this.scene.ui.showNotification(`아이템 장착에 필요한 레벨(${item.requiredLevel})이 부족합니다.`, 0xff0000);
            return false;
        }

        // 현재 장착 슬롯 결정
        let slotType = null;

        if (item.type === 'weapon') {
            slotType = 'weapon';
        } else if (item.type === 'armor') {
            slotType = 'armor';
        } else if (item.type === 'accessory') {
            slotType = 'accessory';
        }

        if (!slotType) return false;

        // 이미 같은 아이템이 장착되어 있는지 확인
        if (this.equipment[slotType] === itemId) {
            // 장착 해제
            this.unequipItem(slotType);
            return true;
        }

        // 이전 장비 해제
        if (this.equipment[slotType]) {
            this.unequipItem(slotType);
        }

        // 새 장비 장착
        this.equipment[slotType] = itemId;

        // 장비 효과 적용
        this.applyEquipmentEffects();

        // 장비 변경 이벤트 발생
        this.scene.events.emit('equipmentChanged', { slot: slotType, itemId: itemId });

        return true;
    }

    // 아이템 장착 해제
    unequipItem(slotType) {
        if (!this.equipment[slotType]) return false;

        const itemId = this.equipment[slotType];

        // 장비 해제
        this.equipment[slotType] = null;

        // 장비 효과 제거
        this.applyEquipmentEffects();

        // 장비 변경 이벤트 발생
        this.scene.events.emit('equipmentChanged', { slot: slotType, itemId: null });

        return true;
    }

    // 장착 가능한 아이템인지 확인
    isEquippable(item) {
        if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
            return true;
        }
        return false;
    }

    // 장비 효과 적용
    applyEquipmentEffects() {
        // 플레이어 기본 스탯 복원
        this.resetPlayerStats();

        // 각 장비 효과 적용
        for (const slotType in this.equipment) {
            const itemId = this.equipment[slotType];
            if (!itemId) continue;

            const item = this.getItemById(itemId);
            if (!item) continue;

            // 기본 스탯 보너스 적용
            this.applyItemStats(item);

            // 특수 효과 적용 (추후 구현)
            this.applyItemSpecialEffects(item);
        }

        // 플레이어 HUD 업데이트
        if (this.scene.ui) {
            this.scene.ui.updatePlayerHUD(this.scene.player);
        }
    }

    // 플레이어 스탯 초기화
    resetPlayerStats() {
        // ClassSystem에서 계산된 기본 스탯 가져오기
        if (this.scene.classSystem) {
            const baseStats = this.scene.classSystem.calculateClassStats(
                this.scene.player.classId,
                this.scene.player.level
            );

            if (baseStats) {
                this.scene.player.stats = { ...baseStats };
            }
        }
    }

    // 아이템 스탯 적용
    applyItemStats(item) {
        // 무기 공격력
        if (item.type === 'weapon' && item.attack) {
            this.scene.player.stats.attack += item.attack;
        }

        // 방어구 방어력
        if (item.type === 'armor' && item.defense) {
            this.scene.player.stats.defense += item.defense;
        }

        // 속성 보너스
        if (item.attributes) {
            item.attributes.forEach(attr => {
                this.applyAttribute(attr);
            });
        }
    }

    // 아이템 속성 적용
    applyAttribute(attr) {
        const player = this.scene.player;

        switch (attr.type) {
            case 'hp_bonus':
                player.stats.maxHp += attr.value;
                player.stats.hp = Math.min(player.stats.hp, player.stats.maxHp);
                break;
            case 'mp_bonus':
                player.stats.maxMp += attr.value;
                player.stats.mp = Math.min(player.stats.mp, player.stats.maxMp);
                break;
            case 'attack_bonus':
                player.stats.attack += attr.value;
                break;
            case 'defense_bonus':
                player.stats.defense += attr.value;
                break;
            case 'speed_bonus':
                player.stats.speed += attr.value;
                break;
            // 기타 속성은 CombatSystem에서 처리함
        }
    }

    // 아이템 특수 효과 적용
    applyItemSpecialEffects(item) {
        // 특수 효과는 CombatSystem에서 처리함
        // 여기서는 이벤트만 발생시킴
        if (item.specialEffect) {
            this.scene.events.emit('itemSpecialEffect', {
                effects: item.specialEffect,
                source: item
            });
        }
    }

    // ID로 아이템 찾기
    getItemById(itemId) {
        return this.inventory.find(item => item.id === itemId);
    }

    // 아이템 소지 여부 확인
    hasItem(itemId) {
        return this.inventory.some(item => item.id === itemId);
    }

    // 아이템 효과 핸들러
    handleItemEffect(data) {
        const { item, target } = data;

        // 적절한 효과 함수 찾기
        const effectFunction = this.itemEffects[item.id] || this.itemEffects[item.subType];

        if (effectFunction) {
            effectFunction(item, target);
        }
    }

    // ======== 아이템 효과 함수들 ========

    // 체력 포션
    useHealthPotion(item) {
        const player = this.scene.player;

        // 이미 최대 체력인 경우
        if (player.stats.hp >= player.stats.maxHp) {
            this.scene.ui.showNotification('이미 최대 체력입니다!', 0xff0000);
            return false;
        }

        // 회복량 계산
        const quality = item.quality || 'normal';
        const qualityMultiplier = {
            minor: 0.2,
            normal: 0.3,
            greater: 0.5,
            superior: 0.8
        };

        const healAmount = Math.floor(player.stats.maxHp * (qualityMultiplier[quality] || 0.3));

        // 체력 회복
        player.stats.hp = Math.min(player.stats.hp + healAmount, player.stats.maxHp);

        // 회복 효과 표시
        this.scene.effects.playHealEffect(player);

        // 대미지 숫자 표시 (녹색)
        this.scene.combatSystem.showDamageNumber(player, healAmount, 0x00ff00, true);

        // UI 업데이트
        this.scene.ui.updatePlayerHUD(player);

        return true;
    }

    // 마나 포션
    useManaPotion(item) {
        const player = this.scene.player;

        // 이미 최대 마나인 경우
        if (player.stats.mp >= player.stats.maxMp) {
            this.scene.ui.showNotification('이미 최대 마나입니다!', 0xff0000);
            return false;
        }

        // 회복량 계산
        const quality = item.quality || 'normal';
        const qualityMultiplier = {
            minor: 0.2,
            normal: 0.3,
            greater: 0.5,
            superior: 0.8
        };

        const manaAmount = Math.floor(player.stats.maxMp * (qualityMultiplier[quality] || 0.3));

        // 마나 회복
        player.stats.mp = Math.min(player.stats.mp + manaAmount, player.stats.maxMp);

        // 회복 효과 표시
        this.scene.effects.createParticleEffect({
            x: player.x,
            y: player.y,
            texture: 'particle_star_blue',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 1000,
            gravityY: -40,
            follow: player,
            quantity: 10,
            frequency: 50
        });

        // 대미지 숫자 표시 (파란색)
        this.scene.combatSystem.showDamageNumber(player, manaAmount, 0x0000ff, true);

        // UI 업데이트
        this.scene.ui.updatePlayerHUD(player);

        return true;
    }

    // 힘의 포션
    useStrengthPotion(item) {
        const player = this.scene.player;

        // 효과량 계산
        const quality = item.quality || 'normal';
        const qualityMultiplier = {
            minor: 1.1,  // +10%
            normal: 1.2,  // +20%
            greater: 1.3,  // +30%
            superior: 1.5   // +50%
        };

        const multiplier = qualityMultiplier[quality] || 1.2;
        const duration = quality === 'superior' ? 120 : 60; // 초

        // 기존 공격력 저장
        const originalAttack = player.stats.attack;

        // 공격력 증가
        player.stats.attack = Math.floor(originalAttack * multiplier);

        // 효과 표시
        this.scene.effects.createParticleEffect({
            x: player.x,
            y: player.y,
            texture: 'particle_star_orange',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 1000,
            follow: player,
            quantity: 10,
            frequency: 50
        });

        // 버프 알림
        const buffPercent = Math.floor((multiplier - 1) * 100);
        this.scene.ui.showBuffNotification('strength', buffPercent, duration);

        // 지속 시간 후 효과 제거
        this.scene.time.delayedCall(duration * 1000, () => {
            player.stats.attack = originalAttack;
            this.scene.ui.updatePlayerHUD(player);
            this.scene.ui.showBuffExpiredNotification('strength');
        });

        // UI 업데이트
        this.scene.ui.updatePlayerHUD(player);

        return true;
    }

    // 방어의 포션
    useDefensePotion(item) {
        const player = this.scene.player;

        // 효과량 계산
        const quality = item.quality || 'normal';
        const qualityMultiplier = {
            minor: 1.1,  // +10%
            normal: 1.2,  // +20%
            greater: 1.3,  // +30%
            superior: 1.5   // +50%
        };

        const multiplier = qualityMultiplier[quality] || 1.2;
        const duration = quality === 'superior' ? 120 : 60; // 초

        // 기존 방어력 저장
        const originalDefense = player.stats.defense;

        // 방어력 증가
        player.stats.defense = Math.floor(originalDefense * multiplier);

        // 효과 표시
        this.scene.effects.createParticleEffect({
            x: player.x,
            y: player.y,
            texture: 'particle_star_blue',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 1000,
            follow: player,
            quantity: 10,
            frequency: 50
        });

        // 버프 알림
        const buffPercent = Math.floor((multiplier - 1) * 100);
        this.scene.ui.showBuffNotification('defense', buffPercent, duration);

        // 지속 시간 후 효과 제거
        this.scene.time.delayedCall(duration * 1000, () => {
            player.stats.defense = originalDefense;
            this.scene.ui.updatePlayerHUD(player);
            this.scene.ui.showBuffExpiredNotification('defense');
        });

        // UI 업데이트
        this.scene.ui.updatePlayerHUD(player);

        return true;
    }

    // 속도의 포션
    useSpeedPotion(item) {
        const player = this.scene.player;

        // 효과량 계산
        const quality = item.quality || 'normal';
        const qualityMultiplier = {
            minor: 1.1,  // +10%
            normal: 1.2,  // +20%
            greater: 1.3,  // +30%
            superior: 1.5   // +50%
        };

        const multiplier = qualityMultiplier[quality] || 1.2;
        const duration = quality === 'superior' ? 120 : 60; // 초

        // 기존 속도 저장
        const originalSpeed = player.stats.speed;

        // 속도 증가
        player.stats.speed = Math.floor(originalSpeed * multiplier);

        // 효과 표시
        this.scene.effects.createParticleEffect({
            x: player.x,
            y: player.y,
            texture: 'particle_star_yellow',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 1000,
            follow: player,
            quantity: 10,
            frequency: 50
        });

        // 버프 알림
        const buffPercent = Math.floor((multiplier - 1) * 100);
        this.scene.ui.showBuffNotification('speed', buffPercent, duration);

        // 지속 시간 후 효과 제거
        this.scene.time.delayedCall(duration * 1000, () => {
            player.stats.speed = originalSpeed;
            this.scene.ui.updatePlayerHUD(player);
            this.scene.ui.showBuffExpiredNotification('speed');
        });

        // UI 업데이트
        this.scene.ui.updatePlayerHUD(player);

        return true;
    }

    // 텔레포트 스크롤
    useTeleportScroll(item) {
        // 던전 시작 지점으로 텔레포트
        const startRoom = this.scene.currentDungeon.rooms[this.scene.currentDungeon.startRoom];
        if (!startRoom) return false;

        // 텔레포트 효과 표시
        this.scene.effects.createParticleEffect({
            x: this.scene.player.x,
            y: this.scene.player.y,
            texture: 'particle_circle_cyan',
            scale: { start: 0.1, end: 1.5 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 500,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 플레이어 텔레포트
        this.scene.player.x = startRoom.centerX * this.scene.tileSize;
        this.scene.player.y = startRoom.centerY * this.scene.tileSize;

        // 도착 효과
        this.scene.effects.createParticleEffect({
            x: this.scene.player.x,
            y: this.scene.player.y,
            texture: 'particle_circle_cyan',
            scale: { start: 0.1, end: 1.5 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 500,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 카메라 위치 조정
        this.scene.cameras.main.pan(
            this.scene.player.x,
            this.scene.player.y,
            500,
            'Sine.easeOut'
        );

        return true;
    }

    // 감정 스크롤
    useIdentifyScroll(item) {
        // 모든 아이템의 속성을 밝힘 (아직 미구현)
        this.scene.ui.showNotification('모든 아이템이 감정되었습니다.', 0x00ffff);

        // 효과 표시
        this.scene.effects.createCircularAuraEffect(this.scene.player, 'particle_circle_white', 1.0, 800);

        return true;
    }

    // 마법부여 스크롤
    useEnchantScroll(item) {
        // 현재 장착 중인 무기 강화
        const weaponId = this.equipment.weapon;

        if (!weaponId) {
            this.scene.ui.showNotification('강화할 무기가 장착되어 있지 않습니다.', 0xff0000);
            return false;
        }

        const weapon = this.getItemById(weaponId);

        if (!weapon) {
            this.scene.ui.showNotification('장착된 무기를 찾을 수 없습니다.', 0xff0000);
            return false;
        }

        // 강화 레벨 증가 (없으면 1로 시작)
        weapon.enchantLevel = (weapon.enchantLevel || 0) + 1;

        // 공격력 증가
        const bonusAttack = Math.floor(weapon.attack * 0.1); // 10% 증가
        weapon.attack += bonusAttack;

        // 효과 표시
        this.scene.effects.createParticleEffect({
            x: this.scene.player.x,
            y: this.scene.player.y,
            texture: 'particle_star_purple',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 1000,
            follow: null,
            quantity: 15,
            frequency: 50
        });

        // 무기 이름 업데이트 (예: +1, +2, +3...)
        weapon.name = weapon.name.replace(/\s*\+\d+$/, '') + ` +${weapon.enchantLevel}`;

        // 장비 효과 재적용
        this.applyEquipmentEffects();

        // 알림
        this.scene.ui.showNotification(`무기가 강화되었습니다! (+${weapon.enchantLevel})`, 0xff00ff);

        return true;
    }

    // 화염구 스크롤
    useFireballScroll(item) {
        // 주변 적에게 화염 대미지
        const radius = 100; // 픽셀
        const enemies = this.scene.enemies.filter(enemy =>
            enemy.active &&
            Phaser.Math.Distance.Between(
                this.scene.player.x, this.scene.player.y,
                enemy.x, enemy.y
            ) <= radius
        );

        if (enemies.length === 0) {
            this.scene.ui.showNotification('주변에 적이 없습니다.', 0xff0000);
            return false;
        }

        // 화염 효과
        this.scene.effects.createParticleEffect({
            x: this.scene.player.x,
            y: this.scene.player.y,
            texture: 'particle_circle_orange',
            scale: { start: 0.1, end: 2.0 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 500,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 대미지 계산
        const damage = 20 + (this.scene.player.level * 5); // 레벨에 따라 증가

        // 각 적에게 대미지 적용
        enemies.forEach(enemy => {
            this.scene.combatSystem.dealDamage(this.scene.player, enemy, damage, 'fire');
        });

        return true;
    }

    // 냉기 스크롤
    useFrostScroll(item) {
        // 주변 적 빙결
        const radius = 100; // 픽셀
        const enemies = this.scene.enemies.filter(enemy =>
            enemy.active &&
            Phaser.Math.Distance.Between(
                this.scene.player.x, this.scene.player.y,
                enemy.x, enemy.y
            ) <= radius
        );

        if (enemies.length === 0) {
            this.scene.ui.showNotification('주변에 적이 없습니다.', 0xff0000);
            return false;
        }

        // 냉기 효과
        this.scene.effects.createParticleEffect({
            x: this.scene.player.x,
            y: this.scene.player.y,
            texture: 'particle_circle_cyan',
            scale: { start: 0.1, end: 2.0 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 500,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 대미지 계산
        const damage = 15 + (this.scene.player.level * 3); // 레벨에 따라 증가

        // 각 적에게 대미지 및 빙결 효과 적용
        enemies.forEach(enemy => {
            this.scene.combatSystem.dealDamage(this.scene.player, enemy, damage, 'ice');

            // 빙결 효과 추가 (감속)
            this.scene.combatSystem.addStatusEffect(
                this.scene.player,
                enemy,
                'slow',
                70, // 70% 감속
                5   // 5초 지속
            );
        });

        return true;
    }

    // 번개 스크롤
    useLightningScroll(item) {
        // 연쇄 번개 공격
        if (this.scene.enemies.length === 0 || !this.scene.enemies.some(e => e.active)) {
            this.scene.ui.showNotification('적이 없습니다.', 0xff0000);
            return false;
        }

        // 첫 번째 타겟 (가장 가까운 적)
        let closestEnemy = null;
        let closestDistance = Number.MAX_VALUE;

        this.scene.enemies.forEach(enemy => {
            if (!enemy.active) return;

            const distance = Phaser.Math.Distance.Between(
                this.scene.player.x, this.scene.player.y,
                enemy.x, enemy.y
            );

            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        });

        if (!closestEnemy) return false;

        // 대미지 계산
        const damage = 30 + (this.scene.player.level * 6); // 레벨에 따라 증가

        // 번개 효과 시작
        this.castChainLightning(this.scene.player, closestEnemy, damage, 5); // 최대 5번 연쇄

        return true;
    }

    // 연쇄 번개 효과
    castChainLightning(source, target, damage, jumpsLeft, hitTargets = []) {
        if (!target || !target.active || jumpsLeft <= 0) return;

        // 이미 맞은 적은 다시 맞지 않음
        if (hitTargets.includes(target)) return;

        // 번개 효과
        this.scene.effects.createProjectileEffect(
            source.x, source.y,
            target.x, target.y,
            'particle_circle_yellow',
            {
                scale: 1.0,
                speed: 500,
                lifespan: 1000
            }
        );

        // 약간의 지연 후 대미지 적용
        this.scene.time.delayedCall(200, () => {
            // 대미지 적용
            this.scene.combatSystem.dealDamage(this.scene.player, target, damage, 'lightning');

            // 대미지 감소 (연쇄마다 30% 감소)
            const nextDamage = Math.floor(damage * 0.7);

            // 히트 목록에 추가
            hitTargets.push(target);

            // 다음 타겟 찾기 (가장 가까운 아직 맞지 않은 적)
            let nextTarget = null;
            let closestDistance = Number.MAX_VALUE;

            this.scene.enemies.forEach(enemy => {
                if (!enemy.active || hitTargets.includes(enemy)) return;

                const distance = Phaser.Math.Distance.Between(
                    target.x, target.y,
                    enemy.x, enemy.y
                );

                if (distance < closestDistance && distance < 150) { // 150px 이내의 적만
                    closestDistance = distance;
                    nextTarget = enemy;
                }
            });

            // 다음 타겟이 있으면 연쇄
            if (nextTarget) {
                this.castChainLightning(target, nextTarget, nextDamage, jumpsLeft - 1, hitTargets);
            }
        });
    }

    // 치유 스크롤
    useHealingScroll(item) {
        // 모든 아군 치유
        const player = this.scene.player;
        const allies = [player, ...(this.scene.allies || [])];

        // 치유량 계산
        const healAmount = 50 + (player.level * 10); // 레벨에 따라 증가

        // 치유 효과
        this.scene.effects.createCircularAuraEffect(player, 'particle_circle_green', 1.0, 800);

        // 각 아군 치유
        allies.forEach(ally => {
            if (!ally.active) return;

            // 체력 회복
            const previousHp = ally.stats.hp;
            ally.stats.hp = Math.min(ally.stats.hp + healAmount, ally.stats.maxHp);

            // 실제 회복량
            const actualHeal = ally.stats.hp - previousHp;

            if (actualHeal > 0) {
                // 치유 효과 표시
                this.scene.effects.playHealEffect(ally);

                // 대미지 숫자 표시 (녹색)
                this.scene.combatSystem.showDamageNumber(ally, actualHeal, 0x00ff00, true);
            }
        });

        // UI 업데이트
        this.scene.ui.updatePlayerHUD(player);

        return true;
    }

    // 보호 스크롤
    useProtectionScroll(item) {
        const player = this.scene.player;

        // 보호막 생성 (일시적인 대미지 보호)
        const shieldAmount = 30 + (player.level * 5); // 레벨에 따라 증가
        const duration = 30; // 30초 지속

        // 보호막 효과
        this.scene.effects.createCircularAuraEffect(player, 'particle_circle_blue', 0.8, 1000);

        // 보호막 생성
        player.shieldAmount = (player.shieldAmount || 0) + shieldAmount;

        // 버프 알림
        this.scene.ui.showBuffNotification('protection', shieldAmount, duration);

        // 지속 시간 후 효과 제거
        this.scene.time.delayedCall(duration * 1000, () => {
            player.shieldAmount = Math.max(0, player.shieldAmount - shieldAmount);
            this.scene.ui.showBuffExpiredNotification('protection');
        });

        return true;
    }

    // 음식 사용
    useFood(item) {
        const player = this.scene.player;

        // 회복량 계산
        const healValue = item.healValue || 10;

        // 체력 회복
        const previousHp = player.stats.hp;
        player.stats.hp = Math.min(player.stats.hp + healValue, player.stats.maxHp);

        // 실제 회복량
        const actualHeal = player.stats.hp - previousHp;

        if (actualHeal > 0) {
            // 회복 효과 표시
            this.scene.effects.createParticleEffect({
                x: player.x,
                y: player.y,
                texture: 'particle_circle_green',
                scale: { start: 0.3, end: 0 },
                alpha: { start: 0.7, end: 0 },
                speed: { min: 10, max: 20 },
                lifespan: 800,
                follow: player,
                quantity: 5,
                frequency: 50
            });

            // 대미지 숫자 표시
            this.scene.combatSystem.showDamageNumber(player, actualHeal, 0x00ff00, true);
        }

        // 버프 효과가 있는 경우 적용
        if (item.buffType && item.buffValue) {
            // 버프 타입에 따라 다른 처리
            switch (item.buffType) {
                case 'strength':
                    // 원래 공격력 저장
                    const originalAttack = player.stats.attack;
                    // 공격력 증가
                    player.stats.attack += item.buffValue;
                    // 지속 시간 후 효과 제거
                    this.scene.time.delayedCall(item.buffDuration * 1000, () => {
                        player.stats.attack = originalAttack;
                        this.scene.ui.updatePlayerHUD(player);
                        this.scene.ui.showBuffExpiredNotification('strength');
                    });
                    break;
                case 'defense':
                    // 원래 방어력 저장
                    const originalDefense = player.stats.defense;
                    // 방어력 증가
                    player.stats.defense += item.buffValue;
                    // 지속 시간 후 효과 제거
                    this.scene.time.delayedCall(item.buffDuration * 1000, () => {
                        player.stats.defense = originalDefense;
                        this.scene.ui.updatePlayerHUD(player);
                        this.scene.ui.showBuffExpiredNotification('defense');
                    });
                    break;
                case 'speed':
                    // 원래 속도 저장
                    const originalSpeed = player.stats.speed;
                    // 속도 증가
                    player.stats.speed += item.buffValue;
                    // 지속 시간 후 효과 제거
                    this.scene.time.delayedCall(item.buffDuration * 1000, () => {
                        player.stats.speed = originalSpeed;
                        this.scene.ui.updatePlayerHUD(player);
                        this.scene.ui.showBuffExpiredNotification('speed');
                    });
                    break;
                case 'health_regen':
                    // 체력 재생 상태 효과 추가
                    this.scene.combatSystem.addStatusEffect(
                        player,
                        player,
                        'regeneration',
                        item.buffValue,
                        item.buffDuration
                    );
                    break;
            }

            // 버프 알림
            this.scene.ui.showBuffNotification(item.buffType, item.buffValue, item.buffDuration);
        }

        // UI 업데이트
        this.scene.ui.updatePlayerHUD(player);

        return true;
    }

    // 폭탄 사용
    useBomb(item) {
        const player = this.scene.player;

        // 폭발 범위
        const radius = item.radius || 100; // 픽셀

        // 대미지 계산
        const damage = item.damage || 30;

        // 주변 적 찾기
        const enemies = this.scene.enemies.filter(enemy =>
            enemy.active &&
            Phaser.Math.Distance.Between(
                player.x, player.y,
                enemy.x, enemy.y
            ) <= radius
        );

        if (enemies.length === 0) {
            this.scene.ui.showNotification('주변에 적이 없습니다.', 0xff0000);
            return false;
        }

        // 폭발 효과
        switch (item.bombType) {
            case 'fire':
                this.scene.effects.createParticleEffect({
                    x: player.x,
                    y: player.y,
                    texture: 'particle_circle_orange',
                    scale: { start: 0.1, end: 2.0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0,
                    lifespan: 500,
                    follow: null,
                    quantity: 1,
                    frequency: 1
                });
                break;
            case 'ice':
                this.scene.effects.createParticleEffect({
                    x: player.x,
                    y: player.y,
                    texture: 'particle_circle_cyan',
                    scale: { start: 0.1, end: 2.0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0,
                    lifespan: 500,
                    follow: null,
                    quantity: 1,
                    frequency: 1
                });
                break;
            case 'poison':
                this.scene.effects.createParticleEffect({
                    x: player.x,
                    y: player.y,
                    texture: 'particle_circle_green',
                    scale: { start: 0.1, end: 2.0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0,
                    lifespan: 500,
                    follow: null,
                    quantity: 1,
                    frequency: 1
                });
                break;
            case 'shock':
                this.scene.effects.createParticleEffect({
                    x: player.x,
                    y: player.y,
                    texture: 'particle_circle_yellow',
                    scale: { start: 0.1, end: 2.0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0,
                    lifespan: 500,
                    follow: null,
                    quantity: 1,
                    frequency: 1
                });
                break;
            default:
                this.scene.effects.createParticleEffect({
                    x: player.x,
                    y: player.y,
                    texture: 'particle_circle_white',
                    scale: { start: 0.1, end: 2.0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0,
                    lifespan: 500,
                    follow: null,
                    quantity: 1,
                    frequency: 1
                });
                break;
        }

        // 각 적에게 대미지 및 상태이상 적용
        enemies.forEach(enemy => {
            // 거리에 따른 대미지 감소 (중심에 가까울수록 더 큰 대미지)
            const distance = Phaser.Math.Distance.Between(
                player.x, player.y,
                enemy.x, enemy.y
            );
            const distanceFactor = 1 - (distance / radius); // 0.0 ~ 1.0
            const finalDamage = Math.floor(damage * (0.5 + distanceFactor * 0.5)); // 최소 50% 대미지

            // 대미지 타입 결정
            let damageType = 'physical';
            switch (item.bombType) {
                case 'fire':
                    damageType = 'fire';
                    break;
                case 'ice':
                    damageType = 'ice';
                    break;
                case 'poison':
                    damageType = 'poison';
                    break;
                case 'shock':
                    damageType = 'lightning';
                    break;
            }

            // 대미지 적용
            this.scene.combatSystem.dealDamage(player, enemy, finalDamage, damageType);

            // 추가 상태이상 효과
            switch (item.bombType) {
                case 'fire':
                    if (item.burnDuration) {
                        this.scene.combatSystem.addStatusEffect(
                            player,
                            enemy,
                            'burn',
                            Math.floor(damage * 0.2),
                            item.burnDuration
                        );
                    }
                    break;
                case 'ice':
                    if (item.freezeDuration) {
                        this.scene.combatSystem.addStatusEffect(
                            player,
                            enemy,
                            'slow',
                            70, // 70% 감속
                            item.freezeDuration
                        );
                    }
                    break;
                case 'poison':
                    if (item.poisonDuration) {
                        this.scene.combatSystem.addStatusEffect(
                            player,
                            enemy,
                            'poison',
                            Math.floor(damage * 0.15),
                            item.poisonDuration
                        );
                    }
                    break;
                case 'shock':
                    if (item.stunDuration) {
                        this.scene.combatSystem.addStatusEffect(
                            player,
                            enemy,
                            'stun',
                            1,
                            item.stunDuration
                        );
                    }
                    break;
            }
        });

        // 카메라 효과
        this.scene.cameras.main.shake(300, 0.01);

        // 효과음 재생
        this.scene.sound.play('explosion');

        return true;
    }
}

export default InventorySystem;