/**
 * Dungeon Loop 게임의 아이템 클래스
 * items.json 데이터를 기반으로 게임에서 사용되는 모든 아이템 타입을 관리
 */
class Item {
    /**
     * @param {object} itemData - 아이템 데이터 객체
     * @param {object} options - 추가 옵션 (인스턴스별 설정)
     */
    constructor(itemData, options = {}) {
        // 필수 필드
        this.id = itemData.id || '';
        this.name = itemData.name || '이름 없는 아이템';
        this.type = itemData.type || 'consumable';
        this.subType = itemData.subType || '';
        this.rarity = itemData.rarity || 'common';
        this.description = itemData.description || '';

        // 선택 필드 (기본값 적용)
        this.requiredLevel = itemData.requiredLevel || 1;
        this.classRestriction = itemData.classRestriction || [];
        this.dropRate = itemData.dropRate || 0.1;
        this.value = itemData.value || 0;

        // 능력치 (무기/방어구/악세사리)
        this.stats = itemData.stats ? { ...itemData.stats } : {};

        // 단일 효과 (소비/유산/특수 아이템)
        this.effect = itemData.effect ? { ...itemData.effect } : null;

        // 복수 효과 (무기/방어구/악세사리)
        this.effects = itemData.effects ? [...itemData.effects] : [];

        // 소비/재료/특수 아이템 속성
        this.stackable = itemData.stackable !== undefined ? itemData.stackable : this.isStackableType();
        this.maxStack = itemData.maxStack || 99;
        this.usesLeft = itemData.usesLeft || 1;

        // 인스턴스별 속성 (고유 식별자, 향상 레벨 등)
        this.instanceId = options.instanceId || this.generateInstanceId();
        this.count = options.count || 1;
        this.equipped = options.equipped || false;
        this.upgradeLevel = options.upgradeLevel || 0;
        this.identified = options.identified !== undefined ? options.identified : !this.needsIdentification();

        // 아이템 획득 관련
        this.acquiredFrom = options.acquiredFrom || '';
        this.acquiredTimestamp = options.acquiredTimestamp || Date.now();

        // 추가 속성 (특수 아이템용)
        if (options.customProperties) {
            Object.assign(this, options.customProperties);
        }
    }

    /**
     * 아이템 인스턴스 고유 ID 생성
     * @returns {string} 고유 ID
     */
    generateInstanceId() {
        return `${this.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }

    /**
     * 아이템 타입에 따라 기본 스택 가능 여부 결정
     * @returns {boolean} 스택 가능 여부
     */
    isStackableType() {
        const stackableTypes = ['consumable', 'material'];
        return stackableTypes.includes(this.type);
    }

    /**
     * 아이템이 장착 가능한지 확인
     * @returns {boolean} 장착 가능 여부
     */
    isEquippable() {
        const equippableTypes = ['weapon', 'armor', 'accessory'];
        return equippableTypes.includes(this.type);
    }

    /**
     * 아이템이 사용 가능한지 확인
     * @returns {boolean} 사용 가능 여부
     */
    isUsable() {
        const usableTypes = ['consumable', 'special', 'legacy'];
        return usableTypes.includes(this.type) && this.usesLeft > 0;
    }

    /**
     * 아이템이 식별이 필요한지 확인
     * @returns {boolean} 식별 필요 여부
     */
    needsIdentification() {
        // 일반 아이템 및 재료는 식별 필요 없음
        if (this.type === 'material' || this.rarity === 'common') {
            return false;
        }

        // 언커먼 이상 무기/방어구/악세사리는 식별 필요
        if (['weapon', 'armor', 'accessory'].includes(this.type) && this.rarity !== 'common') {
            return true;
        }

        // 특정 타입의 소비 아이템 (스크롤, 물약)도 식별 필요
        if (this.type === 'consumable' && ['scroll', 'unknown_potion'].includes(this.subType)) {
            return true;
        }

        return false;
    }

    /**
     * 아이템 사용
     * @param {object} target - 사용 대상 (일반적으로 플레이어)
     * @returns {object} 아이템 사용 결과 정보
     */
    use(target) {
        if (!this.isUsable()) {
            return { success: false, message: '이 아이템은 사용할 수 없습니다.' };
        }

        // 식별되지 않은 아이템은 사용 불가
        if (!this.identified && this.needsIdentification()) {
            return { success: false, message: '이 아이템은 식별이 필요합니다.' };
        }

        // 소비 아이템은 사용 후 수량 감소
        if (this.type === 'consumable') {
            this.count--;

            // 효과 처리
            return this.applyEffect(target);
        }

        // 특수/유산 아이템은 사용 횟수 감소
        if (this.type === 'special' || this.type === 'legacy') {
            this.usesLeft--;

            // 효과 처리
            return this.applyEffect(target);
        }

        return { success: false, message: '이 아이템은 사용할 수 없습니다.' };
    }

    /**
     * 아이템 효과 적용
     * @param {object} target - 효과 적용 대상
     * @returns {object} 효과 적용 결과
     */
    applyEffect(target) {
        // 효과가 없는 경우
        if (!this.effect) {
            return { success: false, message: '이 아이템은 효과가 없습니다.' };
        }

        // 효과 타입에 따른 처리
        switch (this.effect.type) {
            case 'heal':
                return this.applyHealEffect(target);

            case 'restore_mana':
                return this.applyManaRestoreEffect(target);

            case 'buff':
                return this.applyBuffEffect(target);

            case 'debuff_cleanse':
                return this.applyDebuffCleanseEffect(target);

            case 'identify':
                return this.applyIdentifyEffect(target);

            case 'teleport':
                return this.applyTeleportEffect(target);

            case 'revive':
                return this.applyReviveEffect(target);

            case 'damage':
                return this.applyDamageEffect(target);

            case 'experience':
                return this.applyExperienceEffect(target);

            default:
                return { success: false, message: '알 수 없는 효과입니다.' };
        }
    }

    /**
     * 체력 회복 효과 적용
     * @param {object} target - 회복 대상
     * @returns {object} 효과 적용 결과
     */
    applyHealEffect(target) {
        if (!target || !target.stats) {
            return { success: false, message: '대상에게 효과를 적용할 수 없습니다.' };
        }

        // 체력 회복량 계산
        let healAmount = 0;

        if (this.effect.value) {
            // 고정값 회복
            healAmount = this.effect.value;
        } else if (this.effect.healthPercent) {
            // 최대 체력 비율 회복
            healAmount = Math.floor(target.stats.maxHp * this.effect.healthPercent);
        } else {
            // 기본값 (약한 회복)
            healAmount = Math.floor(target.stats.maxHp * 0.2);
        }

        // 회복 적용
        if (target.heal) {
            target.heal(healAmount);
        } else {
            target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
        }

        return {
            success: true,
            message: `${healAmount}의 체력을 회복했습니다.`,
            healAmount: healAmount
        };
    }

    /**
     * 마나 회복 효과 적용
     * @param {object} target - 회복 대상
     * @returns {object} 효과 적용 결과
     */
    applyManaRestoreEffect(target) {
        if (!target || !target.stats) {
            return { success: false, message: '대상에게 효과를 적용할 수 없습니다.' };
        }

        // 마나 회복량 계산
        let manaAmount = 0;

        if (this.effect.value) {
            // 고정값 회복
            manaAmount = this.effect.value;
        } else if (this.effect.manaPercent) {
            // 최대 마나 비율 회복
            manaAmount = Math.floor(target.stats.maxMp * this.effect.manaPercent);
        } else {
            // 기본값 (약한 회복)
            manaAmount = Math.floor(target.stats.maxMp * 0.2);
        }

        // 회복 적용
        if (target.restoreMana) {
            target.restoreMana(manaAmount);
        } else {
            target.stats.mp = Math.min(target.stats.maxMp, target.stats.mp + manaAmount);
        }

        return {
            success: true,
            message: `${manaAmount}의 마나를 회복했습니다.`,
            manaAmount: manaAmount
        };
    }

    /**
     * 버프 효과 적용
     * @param {object} target - 버프 대상
     * @returns {object} 효과 적용 결과
     */
    applyBuffEffect(target) {
        if (!target) {
            return { success: false, message: '대상에게 효과를 적용할 수 없습니다.' };
        }

        // 버프 정보
        const buffType = this.effect.buffType || 'stat_boost';
        const duration = this.effect.duration || 30000; // 기본 30초
        const value = this.effect.value || 0.1; // 기본 10% 향상

        // 버프 효과 생성
        const buffEffect = {
            type: buffType,
            value: value,
            duration: duration,
            source: this.name
        };

        // 대상에게 버프 적용
        if (target.addStatusEffect) {
            target.addStatusEffect(buffEffect);
        } else if (target.buffs) {
            target.buffs.push(buffEffect);
        }

        return {
            success: true,
            message: `${this.name}의 효과가 ${duration / 1000}초 동안 적용됩니다.`,
            buff: buffEffect
        };
    }

    /**
     * 디버프 해제 효과 적용
     * @param {object} target - 디버프 해제 대상
     * @returns {object} 효과 적용 결과
     */
    applyDebuffCleanseEffect(target) {
        if (!target) {
            return { success: false, message: '대상에게 효과를 적용할 수 없습니다.' };
        }

        // 특정 디버프 유형만 해제
        const targetType = this.effect.targetDebuff;

        let removedCount = 0;

        // 플레이어 상태 효과 처리
        if (target.statusEffects && Array.isArray(target.statusEffects)) {
            const initialLength = target.statusEffects.length;

            // 특정 디버프만 제거하거나, 모든 디버프 제거
            if (targetType) {
                target.statusEffects = target.statusEffects.filter(effect => {
                    return effect.type !== targetType;
                });
            } else {
                // 부정적인 효과만 제거 (대표적인 디버프 유형)
                const debuffTypes = ['poison', 'burn', 'freeze', 'slow', 'stun', 'weakness', 'bleed'];
                target.statusEffects = target.statusEffects.filter(effect => {
                    return !debuffTypes.includes(effect.type);
                });
            }

            removedCount = initialLength - target.statusEffects.length;
        }

        return {
            success: true,
            message: removedCount > 0 ? `${removedCount}개의 디버프가 제거되었습니다.` : '제거할 디버프가 없습니다.',
            removedCount: removedCount
        };
    }

    /**
     * 식별 효과 적용 (미식별 아이템 식별)
     * @param {object} target - 대상 (일반적으로 플레이어)
     * @returns {object} 효과 적용 결과
     */
    applyIdentifyEffect(target) {
        if (!target || !target.inventory) {
            return { success: false, message: '인벤토리에 접근할 수 없습니다.' };
        }

        // 미식별 아이템 찾기
        const unidentifiedItems = target.inventory.filter(item => !item.identified && item.needsIdentification);

        if (unidentifiedItems.length === 0) {
            return { success: false, message: '식별할 아이템이 없습니다.' };
        }

        // 일반적으로 게임에서는 아이템 선택 UI를 표시하지만,
        // 여기서는 가장 첫 번째 미식별 아이템을 자동으로 식별합니다.
        const itemToIdentify = unidentifiedItems[0];
        itemToIdentify.identified = true;

        return {
            success: true,
            message: `${itemToIdentify.name}을(를) 식별했습니다!`,
            identifiedItem: itemToIdentify
        };
    }

    /**
     * 텔레포트 효과 적용
     * @param {object} target - 텔레포트 대상 (일반적으로 플레이어)
     * @returns {object} 효과 적용 결과
     */
    applyTeleportEffect(target) {
        // 현재 씬의 던전 인스턴스에 접근 필요
        const scene = target.scene;
        if (!scene || !scene.dungeon) {
            return { success: false, message: '텔레포트할 수 없습니다.' };
        }

        // 텔레포트 타입에 따른 동작
        const teleportType = this.effect.teleportType || 'random';

        switch (teleportType) {
            case 'entrance':
                // 던전 입구로 텔레포트
                if (scene.dungeon.startRoom) {
                    const startRoom = scene.dungeon.startRoom;
                    target.x = startRoom.centerX;
                    target.y = startRoom.centerY;

                    // 방 전환 이벤트 발생
                    scene.events.emit('roomChange', {
                        player: target,
                        room: startRoom
                    });

                    return {
                        success: true,
                        message: '던전 입구로 텔레포트했습니다.',
                        destination: 'entrance'
                    };
                }
                break;

            case 'exit':
                // 던전 출구로 텔레포트
                if (scene.dungeon.endRoom) {
                    const endRoom = scene.dungeon.endRoom;
                    target.x = endRoom.centerX;
                    target.y = endRoom.centerY;

                    // 방 전환 이벤트 발생
                    scene.events.emit('roomChange', {
                        player: target,
                        room: endRoom
                    });

                    return {
                        success: true,
                        message: '던전 출구로 텔레포트했습니다.',
                        destination: 'exit'
                    };
                }
                break;

            case 'boss':
                // 보스 방으로 텔레포트
                if (scene.dungeon.bossRoom) {
                    const bossRoom = scene.dungeon.bossRoom;
                    target.x = bossRoom.centerX;
                    target.y = bossRoom.centerY;

                    // 방 전환 이벤트 발생
                    scene.events.emit('roomChange', {
                        player: target,
                        room: bossRoom
                    });

                    return {
                        success: true,
                        message: '보스 방으로 텔레포트했습니다.',
                        destination: 'boss'
                    };
                }
                break;

            case 'random':
            default:
                // 랜덤 방으로 텔레포트
                if (scene.dungeon.rooms && scene.dungeon.rooms.length > 0) {
                    const randomIndex = Math.floor(Math.random() * scene.dungeon.rooms.length);
                    const randomRoom = scene.dungeon.rooms[randomIndex];

                    target.x = randomRoom.centerX;
                    target.y = randomRoom.centerY;

                    // 방 전환 이벤트 발생
                    scene.events.emit('roomChange', {
                        player: target,
                        room: randomRoom
                    });

                    return {
                        success: true,
                        message: '랜덤한 방으로 텔레포트했습니다.',
                        destination: 'random'
                    };
                }
        }

        return { success: false, message: '텔레포트할 수 없습니다.' };
    }

    /**
     * 부활 효과 적용
     * @param {object} target - 부활 대상 (일반적으로 플레이어)
     * @returns {object} 효과 적용 결과
     */
    applyReviveEffect(target) {
        if (!target) {
            return { success: false, message: '대상에게 효과를 적용할 수 없습니다.' };
        }

        // 이미 살아있는 경우
        if (!target.isDead) {
            return { success: false, message: '대상이 이미 살아있습니다.' };
        }

        // 부활 처리
        if (target.revive) {
            // 부활 시 체력 (기본값 50%)
            const hpPercent = this.effect.healthPercent || 0.5;
            target.revive(hpPercent);

            return {
                success: true,
                message: '부활했습니다!',
                healthPercent: hpPercent
            };
        }

        return { success: false, message: '부활할 수 없습니다.' };
    }

    /**
     * 대미지 효과 적용 (적에게 대미지)
     * @param {object} target - 대미지 대상 (적)
     * @returns {object} 효과 적용 결과
     */
    applyDamageEffect(target) {
        if (!target) {
            return { success: false, message: '대상에게 효과를 적용할 수 없습니다.' };
        }

        // 대미지 계산
        let damage = 0;

        if (this.effect.value) {
            // 고정 대미지
            damage = this.effect.value;
        } else if (this.effect.damage_multiplier) {
            // 플레이어 공격력 기반 대미지
            const player = this.scene.player;
            if (player && player.stats) {
                damage = Math.floor(player.stats.attack * this.effect.damage_multiplier);
            } else {
                damage = 10 * this.effect.damage_multiplier; // 기본값
            }
        } else {
            // 기본 대미지
            damage = 10;
        }

        // 속성 대미지
        const element = this.effect.element || 'neutral';

        // 대미지 적용
        if (target.takeDamage) {
            const damageResult = target.takeDamage({
                damage: damage,
                element: element,
                source: 'item',
                isCritical: false
            });

            return {
                success: true,
                message: `${target.name || '대상'}에게 ${damage}의 대미지를 입혔습니다.`,
                damage: damageResult.damage || damage
            };
        }

        return { success: false, message: '대미지를 적용할 수 없습니다.' };
    }

    /**
     * 경험치 효과 적용
     * @param {object} target - 경험치 획득 대상 (일반적으로 플레이어)
     * @returns {object} 효과 적용 결과
     */
    applyExperienceEffect(target) {
        if (!target) {
            return { success: false, message: '대상에게 효과를 적용할 수 없습니다.' };
        }

        // 경험치 계산
        const expAmount = this.effect.value || 100;

        // 경험치 적용
        if (target.gainExperience) {
            target.gainExperience(expAmount);

            return {
                success: true,
                message: `${expAmount} 경험치를 획득했습니다.`,
                expAmount: expAmount
            };
        }

        return { success: false, message: '경험치를 적용할 수 없습니다.' };
    }

    /**
     * 아이템 식별
     * @returns {boolean} 식별 성공 여부
     */
    identify() {
        if (!this.needsIdentification() || this.identified) {
            return false;
        }

        this.identified = true;
        return true;
    }

    /**
     * 아이템 스택 추가
     * @param {number} amount - 추가할 수량
     * @returns {number} 최종 수량
     */
    addToStack(amount) {
        if (!this.stackable) {
            return this.count;
        }

        this.count = Math.min(this.maxStack, this.count + amount);
        return this.count;
    }

    /**
     * 아이템 스택에서 제거
     * @param {number} amount - 제거할 수량
     * @returns {number} 남은 수량
     */
    removeFromStack(amount) {
        if (!this.stackable) {
            return this.count;
        }

        this.count = Math.max(0, this.count - amount);
        return this.count;
    }

    /**
     * 아이템 업그레이드
     * @param {number} levels - 업그레이드할 레벨 수
     * @returns {boolean} 업그레이드 성공 여부
     */
    upgrade(levels = 1) {
        if (!this.isEquippable()) {
            return false;
        }

        // 최대 업그레이드 레벨 (장비 타입별로 다를 수 있음)
        const maxUpgradeLevel = 10;

        if (this.upgradeLevel >= maxUpgradeLevel) {
            return false;
        }

        // 업그레이드 레벨 증가
        this.upgradeLevel = Math.min(maxUpgradeLevel, this.upgradeLevel + levels);

        // 능력치 향상
        this.applyUpgradeBonus();

        return true;
    }

    /**
     * 업그레이드에 따른 능력치 향상
     */
    applyUpgradeBonus() {
        // 장비 타입별 주요 스탯 향상
        if (this.stats) {
            if (this.type === 'weapon' && this.stats.damage) {
                // 무기는 대미지 증가 (레벨당 10%)
                this.stats.damage = Math.floor(this.stats.damage * (1 + this.upgradeLevel * 0.1));
            }

            if (this.type === 'armor' && this.stats.defense) {
                // 방어구는 방어력 증가 (레벨당 10%)
                this.stats.defense = Math.floor(this.stats.defense * (1 + this.upgradeLevel * 0.1));
            }

            // 다른 스탯도 일부 향상 (레벨당 5%)
            Object.keys(this.stats).forEach(statKey => {
                if (statKey !== 'damage' && statKey !== 'defense') {
                    this.stats[statKey] = Math.floor(this.stats[statKey] * (1 + this.upgradeLevel * 0.05));
                }
            });
        }

        // 추가 효과 강화
        if (this.effects && this.effects.length > 0) {
            this.effects.forEach(effect => {
                if (typeof effect.value === 'number') {
                    // 효과 수치 증가 (레벨당 5%)
                    effect.value = parseFloat((effect.value * (1 + this.upgradeLevel * 0.05)).toFixed(2));
                }
            });
        }
    }

    /**
     * 랜덤 속성 생성
     * @param {number} count - 생성할 속성 수
     * @returns {object[]} 생성된 속성 목록
     */
    generateRandomAttributes(count = 1) {
        const attributes = [];

        // 아이템 타입별 가능한 속성 목록
        const availableAttributes = this.getAvailableAttributes();

        // 랜덤 속성 생성
        for (let i = 0; i < count; i++) {
            if (availableAttributes.length > 0) {
                // 랜덤 속성 선택
                const attrIndex = Math.floor(Math.random() * availableAttributes.length);
                const attrType = availableAttributes.splice(attrIndex, 1)[0];

                // 속성 값 계산
                const attrValue = this.calculateAttributeValue(attrType);

                // 속성 추가
                attributes.push({
                    type: attrType,
                    value: attrValue
                });
            }
        }

        return attributes;
    }

    /**
     * 아이템 타입별 가능한 속성 목록 반환
     * @returns {string[]} 속성 유형 목록
     */
    getAvailableAttributes() {
        switch (this.type) {
            case 'weapon':
                return [
                    'damage', 'critical_chance', 'attack_speed', 'lifesteal',
                    'element_damage', 'penetration', 'accuracy', 'burning_chance',
                    'freezing_chance', 'poison_chance', 'mp_per_hit'
                ];

            case 'armor':
                return [
                    'defense', 'max_hp', 'hp_regen', 'damage_reduction',
                    'elemental_resistance', 'movement_speed', 'evasion',
                    'status_resistance', 'reflect_damage', 'thorns_damage',
                    'reduced_damage_from_elites'
                ];

            case 'accessory':
                return [
                    'all_stats', 'cooldown_reduction', 'gold_find', 'item_find',
                    'exp_bonus', 'reduced_consumption', 'resurrection_chance',
                    'double_attack_chance', 'extended_buff_duration',
                    'reduced_debuff_duration', 'increased_healing'
                ];

            default:
                return [];
        }
    }

    /**
     * 속성 값 계산
     * @param {string} attrType - 속성 유형
     * @returns {number} 계산된 속성 값
     */
    calculateAttributeValue(attrType) {
        // 레어리티에 따른 기본 배율
        const rarityMultiplier = {
            common: 1.0,
            uncommon: 1.2,
            rare: 1.5,
            epic: 2.0,
            legendary: 3.0
        };

        // 아이템 레벨에 따른 스케일링
        const levelFactor = 1 + (this.requiredLevel - 1) * 0.1;

        // 속성 유형별 기본값
        let baseValue = 0;

        switch (attrType) {
            // 무기 속성
            case 'damage':
                baseValue = 5;
                break;
            case 'critical_chance':
                baseValue = 0.05; // 5%
                break;
            case 'attack_speed':
                baseValue = 0.1; // 10%
                break;
            case 'lifesteal':
                baseValue = 0.05; // 5%
                break;
            case 'element_damage':
                baseValue = 0.1; // 10%
                break;
            case 'penetration':
                baseValue = 0.1; // 10%
                break;
            case 'accuracy':
                baseValue = 0.05; // 5%
                break;
            case 'burning_chance':
            case 'freezing_chance':
            case 'poison_chance':
                baseValue = 0.1; // 10%
                break;
            case 'mp_per_hit':
                baseValue = 2;
                break;

            // 방어구 속성
            case 'defense':
                baseValue = 3;
                break;
            case 'max_hp':
                baseValue = 10;
                break;
            case 'hp_regen':
                baseValue = 0.5;
                break;
            case 'damage_reduction':
                baseValue = 0.05; // 5%
                break;
            case 'elemental_resistance':
                baseValue = 0.1; // 10%
                break;
            case 'movement_speed':
                baseValue = 0.05; // 5%
                break;
            case 'evasion':
                baseValue = 0.05; // 5%
                break;
            case 'status_resistance':
                baseValue = 0.1; // 10%
                break;
            case 'reflect_damage':
                baseValue = 0.05; // 5%
                break;
            case 'thorns_damage':
                baseValue = 3;
                break;
            case 'reduced_damage_from_elites':
                baseValue = 0.1; // 10%
                break;

            // 악세서리 속성
            case 'all_stats':
                baseValue = 0.05; // 5%
                break;
            case 'cooldown_reduction':
                baseValue = 0.05; // 5%
                break;
            case 'gold_find':
                baseValue = 0.1; // 10%
                break;
            case 'item_find':
                baseValue = 0.1; // 10%
                break;
            case 'exp_bonus':
                baseValue = 0.1; // 10%
                break;
            case 'reduced_consumption':
                baseValue = 0.1; // 10%
                break;
            case 'resurrection_chance':
                baseValue = 0.05; // 5%
                break;
            case 'double_attack_chance':
                baseValue = 0.05; // 5%
                break;
            case 'extended_buff_duration':
                baseValue = 0.1; // 10%
                break;
            case 'reduced_debuff_duration':
                baseValue = 0.1; // 10%
                break;
            case 'increased_healing':
                baseValue = 0.1; // 10%
                break;

            default:
                baseValue = 1;
        }

        // 최종 값 계산 (기본값 * 레어리티 배율 * 레벨 요소)
        let finalValue = baseValue * rarityMultiplier[this.rarity] * levelFactor;

        // 퍼센트 값은 최대 50%로 제한 (0.5)
        if (attrType.includes('chance') || attrType.includes('reduction') ||
            attrType.includes('resistance') || attrType.includes('speed') ||
            attrType.includes('bonus') || attrType.includes('duration')) {
            finalValue = Math.min(0.5, finalValue);
        }

        // 소수점 둘째 자리까지 반올림
        if (finalValue < 1 && finalValue > 0) {
            return parseFloat(finalValue.toFixed(2));
        }

        // 정수 값은 반올림
        return Math.round(finalValue);
    }

    /**
     * 아이템 장착 가능 여부 확인
     * @param {object} player - 플레이어 객체
     * @returns {boolean} 장착 가능 여부
     */
    canEquip(player) {
        if (!this.isEquippable()) {
            return false;
        }

        // 레벨 요구사항 확인
        if (player.level < this.requiredLevel) {
            return false;
        }

        // 클래스 제한 확인
        if (this.classRestriction.length > 0) {
            if (!this.classRestriction.includes(player.classId)) {
                return false;
            }
        }

        // 식별 여부 확인
        if (this.needsIdentification() && !this.identified) {
            return false;
        }

        return true;
    }

    /**
     * 아이템 상세 정보 반환
     * @param {boolean} detailed - 상세 정보 포함 여부
     * @returns {object} 아이템 상세 정보
     */
    getDetails(detailed = false) {
        // 기본 정보
        const details = {
            id: this.id,
            name: this.name,
            type: this.type,
            subType: this.subType,
            rarity: this.rarity,
            description: this.description,
            stackable: this.stackable,
            count: this.count,
            equipped: this.equipped,
            identified: this.identified,
            upgradeLevel: this.upgradeLevel
        };

        // 미식별 아이템의 경우 제한된 정보만 제공
        if (this.needsIdentification() && !this.identified) {
            return {
                ...details,
                name: this.getUnidentifiedName(),
                description: '??? (식별 필요)',
                stats: {},
                effects: []
            };
        }

        // 상세 정보
        if (detailed) {
            details.requiredLevel = this.requiredLevel;
            details.classRestriction = this.classRestriction;
            details.value = this.calculateValue();

            // 능력치 정보
            if (this.stats && Object.keys(this.stats).length > 0) {
                details.stats = { ...this.stats };
            }

            // 효과 정보
            if (this.effect) {
                details.effect = { ...this.effect };
            }

            if (this.effects && this.effects.length > 0) {
                details.effects = [...this.effects];
            }

            // 장비별 특수 정보
            if (this.isEquippable()) {
                details.equipSlot = this.getEquipSlot();
            }

            // 소비 아이템 특수 정보
            if (this.isUsable()) {
                details.usesLeft = this.usesLeft;
            }
        }

        return details;
    }

    /**
     * 미식별 아이템 이름 생성
     * @returns {string} 미식별 아이템 이름
     */
    getUnidentifiedName() {
        const typeNames = {
            weapon: {
                sword: '알 수 없는 검',
                axe: '알 수 없는 도끼',
                bow: '알 수 없는 활',
                staff: '알 수 없는 지팡이',
                wand: '알 수 없는 마법봉',
                dagger: '알 수 없는 단검',
                spear: '알 수 없는 창'
            },
            armor: {
                helmet: '알 수 없는 투구',
                chest: '알 수 없는 갑옷',
                gloves: '알 수 없는 장갑',
                boots: '알 수 없는 신발',
                shield: '알 수 없는 방패'
            },
            accessory: {
                ring: '알 수 없는 반지',
                necklace: '알 수 없는 목걸이',
                amulet: '알 수 없는 부적',
                belt: '알 수 없는 벨트',
                earring: '알 수 없는 귀걸이'
            },
            consumable: {
                scroll: '알 수 없는 스크롤',
                unknown_potion: '알 수 없는 물약'
            }
        };

        if (typeNames[this.type] && typeNames[this.type][this.subType]) {
            return typeNames[this.type][this.subType];
        }

        return `알 수 없는 ${this.type}`;
    }

    /**
     * 아이템 값어치 계산
     * @returns {number} 아이템 가치 (골드)
     */
    calculateValue() {
        // 기본 가치
        let baseValue = this.value || 10;

        // 레어리티 배수
        const rarityMultiplier = {
            common: 1,
            uncommon: 2,
            rare: 5,
            epic: 15,
            legendary: 50
        };

        // 레벨 요소
        const levelFactor = Math.max(1, this.requiredLevel);

        // 업그레이드 보너스
        const upgradeFactor = 1 + (this.upgradeLevel * 0.2);

        // 아이템 타입별 배수
        let typeMultiplier = 1;

        switch (this.type) {
            case 'weapon':
            case 'armor':
                typeMultiplier = 1.2;
                break;
            case 'accessory':
                typeMultiplier = 1.5;
                break;
            case 'consumable':
                typeMultiplier = 0.8;
                break;
            case 'material':
                typeMultiplier = 0.6;
                break;
            case 'special':
                typeMultiplier = 2;
                break;
            case 'legacy':
                typeMultiplier = 5;
                break;
        }

        // 최종 가치 계산
        let finalValue = baseValue * rarityMultiplier[this.rarity] * levelFactor * typeMultiplier * upgradeFactor;

        // 스택 가능 아이템은 개당 가격
        if (!this.stackable) {
            return Math.round(finalValue);
        }

        return Math.round(finalValue / 2); // 스택 가능 아이템은 개당 절반 가격
    }

    /**
     * 장비 슬롯 유형 반환
     * @returns {string} 장비 슬롯 유형
     */
    getEquipSlot() {
        if (!this.isEquippable()) {
            return null;
        }

        if (this.type === 'weapon') {
            return 'weapon';
        }

        if (this.type === 'armor') {
            return this.subType || 'armor';
        }

        if (this.type === 'accessory') {
            return this.subType || 'accessory';
        }

        return null;
    }

    /**
     * 아이템 복제
     * @returns {Item} 복제된 아이템 인스턴스
     */
    clone() {
        const itemData = {
            id: this.id,
            name: this.name,
            type: this.type,
            subType: this.subType,
            rarity: this.rarity,
            description: this.description,
            requiredLevel: this.requiredLevel,
            classRestriction: [...this.classRestriction],
            dropRate: this.dropRate,
            value: this.value,
            stats: this.stats ? { ...this.stats } : null,
            effect: this.effect ? { ...this.effect } : null,
            effects: this.effects ? [...this.effects] : [],
            stackable: this.stackable,
            maxStack: this.maxStack,
            usesLeft: this.usesLeft
        };

        const options = {
            instanceId: `clone_${this.instanceId}`,
            count: this.count,
            equipped: false, // 복제된 아이템은 기본적으로 장착하지 않음
            upgradeLevel: this.upgradeLevel,
            identified: this.identified,
            acquiredFrom: this.acquiredFrom,
            acquiredTimestamp: Date.now()
        };

        return new Item(itemData, options);
    }

    /**
     * 특정 속성 값 가져오기
     * @param {string} statName - 속성 이름
     * @returns {number|null} 속성 값 또는 null
     */
    getStat(statName) {
        if (this.stats && this.stats[statName] !== undefined) {
            return this.stats[statName];
        }

        // 효과에서 속성 값 찾기
        if (this.effects && this.effects.length > 0) {
            for (const effect of this.effects) {
                if (effect.type === statName && effect.value !== undefined) {
                    return effect.value;
                }
            }
        }

        return null;
    }

    /**
     * 아이템의 모든 효과 반환
     * @returns {Array} 효과 목록
     */
    getAllEffects() {
        const effectsList = [];

        // 단일 효과 추가
        if (this.effect) {
            effectsList.push(this.effect);
        }

        // 복수 효과 추가
        if (this.effects && this.effects.length > 0) {
            effectsList.push(...this.effects);
        }

        return effectsList;
    }

    /**
     * 스탯 배열로 변환
     * @returns {Array} 스탯 배열 (표시용)
     */
    getStatsArray() {
        const statsArray = [];

        // 기본 스탯 추가
        if (this.stats) {
            Object.entries(this.stats).forEach(([key, value]) => {
                statsArray.push({
                    name: key,
                    value: value
                });
            });
        }

        // 효과로부터 스탯 추가
        if (this.effects && this.effects.length > 0) {
            this.effects.forEach(effect => {
                if (effect.type && effect.value !== undefined) {
                    statsArray.push({
                        name: effect.type,
                        value: effect.value,
                        duration: effect.duration
                    });
                }
            });
        }

        return statsArray;
    }

    /**
     * 특정 속성 여부 체크
     * @param {string} property - 확인할 속성 (레어리티, 타입 등)
     * @param {string|number} value - 비교할 값
     * @returns {boolean} 속성 일치 여부
     */
    hasProperty(property, value) {
        switch (property) {
            case 'rarity':
                return this.rarity === value;
            case 'type':
                return this.type === value;
            case 'subType':
                return this.subType === value;
            case 'level':
                return this.requiredLevel <= value;
            case 'class':
                return this.classRestriction.length === 0 || this.classRestriction.includes(value);
            case 'identified':
                return this.identified === value;
            case 'upgradable':
                return this.isEquippable() && value;
            case 'usable':
                return this.isUsable() && value;
            default:
                return false;
        }
    }

    /**
     * 아이템 비교
     * @param {Item} otherItem - 비교할 아이템
     * @returns {object} 비교 결과
     */
    compareTo(otherItem) {
        if (!otherItem || this.type !== otherItem.type) {
            return null;
        }

        const comparisonResult = {
            better: [],
            worse: [],
            same: []
        };

        // 비교할 수 있는 스탯이 있는지 확인
        if (this.stats && otherItem.stats) {
            // 공통 스탯 비교
            Object.keys(this.stats).forEach(statName => {
                if (otherItem.stats[statName] !== undefined) {
                    if (this.stats[statName] > otherItem.stats[statName]) {
                        comparisonResult.better.push({
                            name: statName,
                            difference: this.stats[statName] - otherItem.stats[statName]
                        });
                    } else if (this.stats[statName] < otherItem.stats[statName]) {
                        comparisonResult.worse.push({
                            name: statName,
                            difference: otherItem.stats[statName] - this.stats[statName]
                        });
                    } else {
                        comparisonResult.same.push({
                            name: statName,
                            value: this.stats[statName]
                        });
                    }
                }
            });
        }

        // 희귀도 비교
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const thisRarityIndex = rarityOrder.indexOf(this.rarity);
        const otherRarityIndex = rarityOrder.indexOf(otherItem.rarity);

        if (thisRarityIndex > otherRarityIndex) {
            comparisonResult.better.push({
                name: 'rarity',
                value: this.rarity
            });
        } else if (thisRarityIndex < otherRarityIndex) {
            comparisonResult.worse.push({
                name: 'rarity',
                value: otherItem.rarity
            });
        } else {
            comparisonResult.same.push({
                name: 'rarity',
                value: this.rarity
            });
        }

        // 업그레이드 레벨 비교
        if (this.upgradeLevel > otherItem.upgradeLevel) {
            comparisonResult.better.push({
                name: 'upgradeLevel',
                difference: this.upgradeLevel - otherItem.upgradeLevel
            });
        } else if (this.upgradeLevel < otherItem.upgradeLevel) {
            comparisonResult.worse.push({
                name: 'upgradeLevel',
                difference: otherItem.upgradeLevel - this.upgradeLevel
            });
        } else if (this.upgradeLevel > 0) {
            comparisonResult.same.push({
                name: 'upgradeLevel',
                value: this.upgradeLevel
            });
        }

        return comparisonResult;
    }

    /**
     * 아이템 문자열 표현
     * @returns {string} 아이템 정보 문자열
     */
    toString() {
        let itemStr = `${this.name} (${this.rarity})`;

        if (this.upgradeLevel > 0) {
            itemStr += ` +${this.upgradeLevel}`;
        }

        if (this.stackable && this.count > 1) {
            itemStr += ` x${this.count}`;
        }

        return itemStr;
    }
}

export default Item;