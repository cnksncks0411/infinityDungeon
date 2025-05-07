// src/systems/LootSystem.js

/**
 * 아이템 드롭, 보상, 전리품 생성을 관리하는 시스템
 * JSON 기반 데이터와 확률적 요소를 활용하여 게임 내 아이템 드롭 처리
 */
class LootSystem {
    /**
     * LootSystem 생성자
     * @param {Phaser.Scene} scene - 시스템이 속한 씬
     */
    constructor(scene) {
        this.scene = scene;
        this.game = scene.game;
        
        // 이벤트 관리
        this.events = new Phaser.Events.EventEmitter();
        
        // 데이터 로드
        this.loadData();
    }
    
    /**
     * 필요한 데이터 파일 로드
     */
    loadData() {
        // 캐시에서 데이터 가져오기
        this.itemsData = this.scene.cache.json.get('items');
        this.monstersData = this.scene.cache.json.get('monsters');
        this.dungeonsData = this.scene.cache.json.get('dungeons');
        this.progressionData = this.scene.cache.json.get('progression');
        
        // 아이템 타입별 분류
        this.categorizeItems();
    }
    
    /**
     * 아이템 데이터를 타입/희귀도별로 분류
     */
    categorizeItems() {
        if (!this.itemsData) {
            console.warn('아이템 데이터가 로드되지 않았습니다');
            return;
        }
        
        // 초기화
        this.itemsByType = {};
        this.itemsByRarity = {
            common: [],
            uncommon: [],
            rare: [],
            epic: [],
            legendary: [],
            mythic: []
        };
        
        // 아이템 분류
        this.itemsData.forEach(item => {
            // 타입별 분류
            if (!this.itemsByType[item.type]) {
                this.itemsByType[item.type] = {};
            }
            
            if (!this.itemsByType[item.type][item.subType]) {
                this.itemsByType[item.type][item.subType] = [];
            }
            
            this.itemsByType[item.type][item.subType].push(item);
            
            // 희귀도별 분류
            if (this.itemsByRarity[item.rarity]) {
                this.itemsByRarity[item.rarity].push(item);
            }
        });
    }
    
    /**
     * 몬스터로부터 전리품 생성
     * @param {Object} monster - 몬스터 데이터
     * @param {number} dungeonLevel - 던전 레벨
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Object} 생성된 전리품 {gold, items, experience}
     */
    generateLootFromMonster(monster, dungeonLevel, playerLevel) {
        if (!monster) {
            return { gold: 0, items: [], experience: 0 };
        }
        
        // 몬스터 정보 가져오기
        const monsterData = typeof monster === 'string' 
            ? this.getMonsterData(monster) 
            : monster;
            
        if (!monsterData || !monsterData.loot) {
            return { gold: 0, items: [], experience: 0 };
        }
        
        // 변수 초기화
        const loot = {
            gold: 0,
            items: [],
            experience: 0
        };
        
        // 경험치 계산
        const expRange = monsterData.loot.experience || { min: 5, max: 10 };
        loot.experience = this.calculateExp(expRange.min, expRange.max, monsterData.type, dungeonLevel, playerLevel);
        
        // 골드 계산
        const goldRange = monsterData.loot.gold || { min: 1, max: 5 };
        loot.gold = this.calculateGold(goldRange.min, goldRange.max, monsterData.type, dungeonLevel);
        
        // 아이템 드롭 확률 계산
        const baseDropChance = monsterData.loot.dropChance || 0.1;
        const adjustedDropChance = this.adjustDropChance(baseDropChance, monsterData.type, dungeonLevel);
        
        // 아이템 드롭 시도
        if (Math.random() < adjustedDropChance) {
            const droppedItems = this.rollForItems(monsterData, dungeonLevel, playerLevel);
            loot.items = droppedItems;
        }
        
        return loot;
    }
    
    /**
     * 몬스터 ID로 몬스터 데이터 가져오기
     * @param {string} monsterId - 몬스터 ID
     * @returns {Object} 몬스터 데이터
     */
    getMonsterData(monsterId) {
        if (!this.monstersData) {
            return null;
        }
        
        return this.monstersData.find(m => m.id === monsterId);
    }
    
    /**
     * 경험치 계산
     * @param {number} min - 최소 경험치
     * @param {number} max - 최대 경험치
     * @param {string} monsterType - 몬스터 유형 (normal, elite, boss)
     * @param {number} dungeonLevel - 던전 레벨
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {number} 계산된 경험치
     */
    calculateExp(min, max, monsterType, dungeonLevel, playerLevel) {
        // 기본 경험치 범위에서 랜덤 값
        let exp = Math.floor(Math.random() * (max - min + 1)) + min;
        
        // 몬스터 유형별 보정
        const typeMultiplier = {
            'normal': 1,
            'elite': 2.5,
            'boss': 5,
            'minion': 0.5
        };
        
        exp *= typeMultiplier[monsterType] || 1;
        
        // 던전 레벨 보정
        exp *= (1 + 0.1 * dungeonLevel);
        
        // 레벨 차이 보정 (플레이어가 높은 레벨이면 보상 감소)
        const levelDiff = playerLevel - dungeonLevel;
        if (levelDiff > 0) {
            // 레벨 차이 당 5%씩 감소 (최소 20%까지)
            const reduction = Math.min(0.8, levelDiff * 0.05);
            exp *= (1 - reduction);
        }
        
        return Math.floor(exp);
    }
    
    /**
     * 골드 계산
     * @param {number} min - 최소 골드
     * @param {number} max - 최대 골드
     * @param {string} monsterType - 몬스터 유형 (normal, elite, boss)
     * @param {number} dungeonLevel - 던전 레벨
     * @returns {number} 계산된 골드
     */
    calculateGold(min, max, monsterType, dungeonLevel) {
        // 기본 골드 범위에서 랜덤 값
        let gold = Math.floor(Math.random() * (max - min + 1)) + min;
        
        // 몬스터 유형별 보정
        const typeMultiplier = {
            'normal': 1,
            'elite': 2,
            'boss': 4,
            'minion': 0.5
        };
        
        gold *= typeMultiplier[monsterType] || 1;
        
        // 던전 레벨 보정
        gold *= (1 + 0.15 * dungeonLevel);
        
        // 골드 획득 보너스 (장비, 마스터리 등) 적용
        // 실제 구현에서는 플레이어의 골드 획득 보너스를 가져와 적용해야 함
        const goldFindBonus = this.getGoldFindBonus() || 0;
        gold *= (1 + goldFindBonus / 100);
        
        return Math.floor(gold);
    }
    
    /**
     * 골드 획득 보너스 가져오기
     * @returns {number} 골드 획득 보너스 (%)
     */
    getGoldFindBonus() {
        if (!this.game || !this.game.gameData) {
            return 0;
        }
        
        // 플레이어의 골드 획득 보너스 가져오기
        // 이 부분은 게임 데이터 구조에 따라 구현해야 함
        let bonus = 0;
        
        // 마스터리 보너스 체크
        const masteryBonuses = this.game.gameData.masteryBonuses || {};
        for (const classId in masteryBonuses) {
            for (const tier in masteryBonuses[classId]) {
                const bonusData = masteryBonuses[classId][tier];
                if (bonusData && bonusData.type === 'gold_find') {
                    bonus += bonusData.value;
                }
            }
        }
        
        // 장비 보너스 체크
        if (this.game.gameData.equipment) {
            for (const slot in this.game.gameData.equipment) {
                const itemId = this.game.gameData.equipment[slot];
                if (itemId) {
                    const item = this.findEquippedItem(itemId);
                    if (item && item.attributes) {
                        for (const attr of item.attributes) {
                            if (attr.type === 'gold_find') {
                                bonus += attr.value;
                            }
                        }
                    }
                }
            }
        }
        
        return bonus;
    }
    
    /**
     * 아이템 드롭 확률 조정
     * @param {number} baseChance - 기본 드롭 확률
     * @param {string} monsterType - 몬스터 유형
     * @param {number} dungeonLevel - 던전 레벨
     * @returns {number} 조정된 드롭 확률
     */
    adjustDropChance(baseChance, monsterType, dungeonLevel) {
        // 몬스터 유형별 보정
        const typeMultiplier = {
            'normal': 1,
            'elite': 2,
            'boss': 3,
            'minion': 0.5
        };
        
        let adjustedChance = baseChance * (typeMultiplier[monsterType] || 1);
        
        // 던전 레벨 보정 (레벨 당 약간 증가)
        adjustedChance *= (1 + 0.05 * dungeonLevel);
        
        // 운 스탯 보정 (있는 경우)
        const luckBonus = this.getLuckBonus() || 0;
        adjustedChance *= (1 + luckBonus / 100);
        
        // 최대 80%로 제한
        return Math.min(0.8, adjustedChance);
    }
    
    /**
     * 운 보너스 가져오기
     * @returns {number} 운 스탯 보너스 (%)
     */
    getLuckBonus() {
        if (!this.game || !this.game.gameData) {
            return 0;
        }
        
        // 플레이어의 운 스탯 보너스 가져오기
        let bonus = 0;
        
        // 장비 보너스 체크
        if (this.game.gameData.equipment) {
            for (const slot in this.game.gameData.equipment) {
                const itemId = this.game.gameData.equipment[slot];
                if (itemId) {
                    const item = this.findEquippedItem(itemId);
                    if (item && item.attributes) {
                        for (const attr of item.attributes) {
                            if (attr.type === 'luck') {
                                bonus += attr.value;
                            }
                        }
                    }
                }
            }
        }
        
        return bonus;
    }
    
    /**
     * 장착된 아이템 찾기
     * @param {string} itemId - 아이템 ID
     * @returns {Object} 아이템 데이터
     */
    findEquippedItem(itemId) {
        if (!this.game || !this.game.gameData || !this.game.gameData.inventory) {
            return null;
        }
        
        return this.game.gameData.inventory.find(item => item.id === itemId);
    }
    
    /**
     * 몬스터에서 드롭할 아이템 결정
     * @param {Object} monster - 몬스터 데이터
     * @param {number} dungeonLevel - 던전 레벨
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Array} 드롭된 아이템 배열
     */
    rollForItems(monster, dungeonLevel, playerLevel) {
        const items = [];
        
        // 드롭 가능한 아이템이 없는 경우
        if (!monster.loot || !monster.loot.possibleItems || monster.loot.possibleItems.length === 0) {
            // 랜덤 아이템 생성 (몬스터 유형 기반)
            const randomItem = this.generateRandomItemForMonster(monster, dungeonLevel, playerLevel);
            if (randomItem) {
                items.push(randomItem);
            }
            return items;
        }
        
        // 드롭 가능한 아이템 목록에서 선택
        const possibleItems = monster.loot.possibleItems;
        const itemCount = this.getItemDropCount(monster.type);
        
        // 아이템 수만큼 드롭 시도
        for (let i = 0; i < itemCount; i++) {
            // 무작위로 아이템 선택
            const randomIndex = Math.floor(Math.random() * possibleItems.length);
            const selectedItemId = possibleItems[randomIndex];
            
            // 아이템 템플릿 찾기
            const itemTemplate = this.findItemById(selectedItemId);
            if (!itemTemplate) continue;
            
            // 아이템 인스턴스 생성
            const itemInstance = this.createItemInstance(itemTemplate, dungeonLevel, playerLevel);
            if (itemInstance) {
                items.push(itemInstance);
            }
        }
        
        return items;
    }
    
    /**
     * 아이템 ID로 아이템 템플릿 찾기
     * @param {string} itemId - 아이템 ID
     * @returns {Object} 아이템 템플릿
     */
    findItemById(itemId) {
        if (!this.itemsData) {
            return null;
        }
        
        return this.itemsData.find(item => item.id === itemId);
    }
    
    /**
     * 몬스터 유형별 드롭 아이템 개수 결정
     * @param {string} monsterType - 몬스터 유형
     * @returns {number} 드롭 아이템 개수
     */
    getItemDropCount(monsterType) {
        // 몬스터 유형별 아이템 드롭 개수
        const dropCounts = {
            'normal': 1,
            'elite': () => Math.random() < 0.5 ? 2 : 1,
            'boss': () => Math.floor(Math.random() * 2) + 2, // 2-3개
            'minion': () => Math.random() < 0.3 ? 1 : 0
        };
        
        const count = dropCounts[monsterType];
        return typeof count === 'function' ? count() : count || 0;
    }
    
    /**
     * 아이템 템플릿으로부터 아이템 인스턴스 생성
     * @param {Object} template - 아이템 템플릿
     * @param {number} dungeonLevel - 던전 레벨
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Object} 생성된 아이템 인스턴스
     */
    createItemInstance(template, dungeonLevel, playerLevel) {
        if (!template) return null;
        
        // 기본 아이템 데이터 복사
        const instance = { ...template };
        
        // 고유 아이템 ID 생성
        instance.instanceId = this.generateUniqueId();
        
        // 아이템 레벨 설정
        instance.level = Math.max(1, Math.floor(dungeonLevel * 0.8));
        
        // 아이템 타입별 속성 생성
        switch (template.type) {
            case 'weapon':
                this.generateWeaponAttributes(instance, dungeonLevel);
                break;
            case 'armor':
                this.generateArmorAttributes(instance, dungeonLevel);
                break;
            case 'accessory':
                this.generateAccessoryAttributes(instance, dungeonLevel);
                break;
            case 'consumable':
                this.generateConsumableAttributes(instance, dungeonLevel);
                break;
        }
        
        // 필요 레벨 설정 (장비 아이템인 경우)
        if (['weapon', 'armor', 'accessory'].includes(template.type)) {
            instance.requiredLevel = Math.max(1, instance.level - 2);
        }
        
        return instance;
    }
    
    /**
     * 고유 아이템 ID 생성
     * @returns {string} 고유 ID
     */
    generateUniqueId() {
        return 'item_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    }
    
    /**
     * 무기 아이템 속성 생성
     * @param {Object} item - 아이템 인스턴스
     * @param {number} dungeonLevel - 던전 레벨
     */
    generateWeaponAttributes(item, dungeonLevel) {
        // 기본 스탯 설정
        if (!item.stats) {
            item.stats = {};
        }
        
        // 공격력 계산
        const baseDamage = item.stats.damage || 5;
        item.stats.damage = this.calculateScaledStat(baseDamage, item.level, 1.2);
        
        // 희귀도에 따른 추가 속성 생성
        const attributeCount = this.getAttributeCountByRarity(item.rarity);
        item.attributes = [];
        
        for (let i = 0; i < attributeCount; i++) {
            item.attributes.push(this.generateRandomAttribute('weapon', item.subType, item.level));
        }
        
        // 희귀도가 높으면 특수 효과 추가
        if (['rare', 'epic', 'legendary', 'mythic'].includes(item.rarity)) {
            item.specialEffect = this.generateSpecialEffect(item);
        }
    }
    
    /**
     * 방어구 아이템 속성 생성
     * @param {Object} item - 아이템 인스턴스
     * @param {number} dungeonLevel - 던전 레벨
     */
    generateArmorAttributes(item, dungeonLevel) {
        // 기본 스탯 설정
        if (!item.stats) {
            item.stats = {};
        }
        
        // 방어력 계산
        const baseDefense = item.stats.defense || 3;
        item.stats.defense = this.calculateScaledStat(baseDefense, item.level, 1.15);
        
        // 희귀도에 따른 추가 속성 생성
        const attributeCount = this.getAttributeCountByRarity(item.rarity);
        item.attributes = [];
        
        for (let i = 0; i < attributeCount; i++) {
            item.attributes.push(this.generateRandomAttribute('armor', item.subType, item.level));
        }
        
        // 희귀도가 높으면 특수 효과 추가
        if (['rare', 'epic', 'legendary', 'mythic'].includes(item.rarity)) {
            item.specialEffect = this.generateSpecialEffect(item);
        }
    }
    
    /**
     * 악세서리 아이템 속성 생성
     * @param {Object} item - 아이템 인스턴스
     * @param {number} dungeonLevel - 던전 레벨
     */
    generateAccessoryAttributes(item, dungeonLevel) {
        // 기본 스탯 설정
        if (!item.stats) {
            item.stats = {};
        }
        
        // 희귀도에 따른 추가 속성 생성
        const attributeCount = this.getAttributeCountByRarity(item.rarity) + 1; // 악세서리는 추가 속성 하나 더
        item.attributes = [];
        
        for (let i = 0; i < attributeCount; i++) {
            item.attributes.push(this.generateRandomAttribute('accessory', item.subType, item.level));
        }
        
        // 희귀도가 높으면 특수 효과 추가
        if (['uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(item.rarity)) {
            item.specialEffect = this.generateSpecialEffect(item);
        }
    }
    
    /**
     * 소비 아이템 속성 생성
     * @param {Object} item - 아이템 인스턴스
     * @param {number} dungeonLevel - 던전 레벨
     */
    generateConsumableAttributes(item, dungeonLevel) {
        // 포션 등의 소비 아이템에 대한 효과 강화
        if (item.effect) {
            // 힐링 포션의 회복량 조정
            if (item.effect.type === 'heal') {
                item.effect.value = this.calculateScaledStat(item.effect.value || 50, item.level, 1.3);
            }
            // 마나 포션의 회복량 조정
            else if (item.effect.type === 'restore_mana') {
                item.effect.value = this.calculateScaledStat(item.effect.value || 30, item.level, 1.25);
            }
            // 버프 지속시간 또는 효과 강화
            else if (['buff', 'stat_boost'].includes(item.effect.type)) {
                item.effect.value = this.calculateScaledStat(item.effect.value || 10, item.level, 1.1);
                item.effect.duration = this.calculateScaledStat(item.effect.duration || 30, item.level, 1.05);
            }
        }
        
        // 스택 크기 설정
        if (item.stackable) {
            item.maxStack = item.maxStack || 10;
            item.count = 1;
        }
    }
    
    /**
     * 희귀도별 속성 개수 가져오기
     * @param {string} rarity - 아이템 희귀도
     * @returns {number} 속성 개수
     */
    getAttributeCountByRarity(rarity) {
        const counts = {
            'common': 0,
            'uncommon': 1,
            'rare': 2,
            'epic': 3,
            'legendary': 4,
            'mythic': 5
        };
        
        return counts[rarity] || 0;
    }
    
    /**
     * 랜덤 속성 생성
     * @param {string} itemType - 아이템 유형
     * @param {string} subType - 아이템 하위 유형
     * @param {number} level - 아이템 레벨
     * @returns {Object} 생성된 속성
     */
    generateRandomAttribute(itemType, subType, level) {
        // 해당 아이템 유형에 적용 가능한 속성 목록
        const availableAttributes = this.getAvailableAttributes(itemType, subType);
        
        // 랜덤하게 선택
        const attributeType = availableAttributes[Math.floor(Math.random() * availableAttributes.length)];
        
        // 속성 값 계산
        const value = this.calculateAttributeValue(attributeType, level);
        
        return {
            type: attributeType,
            value: value
        };
    }
    
    /**
     * 아이템 유형별 사용 가능한 속성 목록
     * @param {string} itemType - 아이템 유형
     * @param {string} subType - 아이템 하위 유형
     * @returns {Array} 속성 유형 배열
     */
    getAvailableAttributes(itemType, subType) {
        // 공통 속성
        const commonAttributes = ['hp_bonus', 'mp_bonus'];
        
        // 유형별 속성
        const typeAttributes = {
            'weapon': ['damage_bonus', 'critical_chance', 'critical_damage', 'attack_speed', 'lifesteal'],
            'armor': ['defense_bonus', 'damage_reduction', 'hp_regen', 'element_resist', 'dodge_chance'],
            'accessory': ['all_stats', 'gold_find', 'exp_bonus', 'movement_speed', 'cooldown_reduction']
        };
        
        // 하위 유형별 특수 속성
        const subTypeAttributes = {
            // 무기
            'sword': ['bleed_chance', 'counter_chance'],
            'axe': ['armor_penetration', 'stun_chance'],
            'dagger': ['poison_chance', 'dodge_bonus'],
            'staff': ['magic_damage', 'mana_cost_reduction'],
            'bow': ['accuracy', 'multishot_chance'],
            'wand': ['element_damage', 'spell_power'],
            
            // 방어구
            'helmet': ['magic_resist', 'vision_range'],
            'chest': ['hp_percent', 'reflect_damage'],
            'gloves': ['attack_speed_bonus', 'harvest_bonus'],
            'boots': ['movement_speed_bonus', 'fall_damage_reduction'],
            
            // 악세서리
            'amulet': ['magic_find', 'exp_boost', 'stat_boost'],
            'ring': ['elemental_damage', 'resource_gain'],
            'belt': ['stamina_bonus', 'charge_speed']
        };
        
        // 속성 목록 결합
        let attributes = [...commonAttributes];
        
        if (typeAttributes[itemType]) {
            attributes = [...attributes, ...typeAttributes[itemType]];
        }
        
        if (subTypeAttributes[subType]) {
            attributes = [...attributes, ...subTypeAttributes[subType]];
        }
        
        return attributes;
    }
    
    /**
     * 속성 값 계산
     * @param {string} attributeType - 속성 유형
     * @param {number} level - 아이템 레벨
     * @returns {number} 계산된 속성 값
     */
    calculateAttributeValue(attributeType, level) {
        // 기본 속성 값 범위
        const baseValues = {
            // 기본 스탯 보너스
            'hp_bonus': { base: 5, factor: 2.5 },
            'mp_bonus': { base: 3, factor: 1.5 },
            
            // 무기 속성
            'damage_bonus': { base: 2, factor: 1.2 },
            'critical_chance': { base: 3, factor: 0.3, max: 15 },
            'critical_damage': { base: 10, factor: 2, max: 100 },
            'attack_speed': { base: 5, factor: 0.5, max: 25 },
            'lifesteal': { base: 2, factor: 0.2, max: 10 },
            
            // 방어구 속성
            'defense_bonus': { base: 2, factor: 0.8 },
            'damage_reduction': { base: 1, factor: 0.2, max: 10 },
            'hp_regen': { base: 0.5, factor: 0.1 },
            'element_resist': { base: 3, factor: 0.5, max: 30 },
            'dodge_chance': { base: 2, factor: 0.2, max: 10 },
            
            // 악세서리 속성
            'all_stats': { base: 1, factor: 0.2, max: 10 },
            'gold_find': { base: 5, factor: 0.5, max: 50 },
            'exp_bonus': { base: 3, factor: 0.3, max: 30 },
            'movement_speed': { base: 3, factor: 0.3, max: 20 },
            'cooldown_reduction': { base: 2, factor: 0.2, max: 20 },
            
            // 하위 유형 특수 속성
            'bleed_chance': { base: 3, factor: 0.3, max: 15 },
            'counter_chance': { base: 3, factor: 0.3, max: 15 },
            'armor_penetration': { base: 5, factor: 0.5, max: 30 },
            'stun_chance': { base: 2, factor: 0.2, max: 10 },
            'poison_chance': { base: 3, factor: 0.3, max: 15 },
            'dodge_bonus': { base: 2, factor: 0.2, max: 10 },
            'magic_damage': { base: 3, factor: 0.6 },
            'mana_cost_reduction': { base: 3, factor: 0.3, max: 20 },
            'accuracy': { base: 3, factor: 0.3, max: 15 },
            'multishot_chance': { base: 2, factor: 0.2, max: 10 },
            'element_damage': { base: 4, factor: 0.4, max: 25 },
            'spell_power': { base: 2, factor: 0.5 },
            'magic_resist': { base: 3, factor: 0.5, max: 30 },
            'vision_range': { base: 5, factor: 0.5, max: 20 },
            'hp_percent': { base: 2, factor: 0.2, max: 15 },
            'reflect_damage': { base: 2, factor: 0.2, max: 10 },
            'attack_speed_bonus': { base: 3, factor: 0.3, max: 15 },
            'harvest_bonus': { base: 5, factor: 0.5, max: 25 },
            'movement_speed_bonus': { base: 3, factor: 0.3, max: 15 },
            'fall_damage_reduction': { base: 5, factor: 0.5, max: 25 },
            'magic_find': { base: 4, factor: 0.4, max: 20 },
            'exp_boost': { base: 3, factor: 0.3, max: 15 },
            'stat_boost': { base: 2, factor: 0.2, max: 10 },
            'elemental_damage': { base: 3, factor: 0.3, max: 20 },
            'resource_gain': { base: 4, factor: 0.4, max: 20 },
            'stamina_bonus': { base: 3, factor: 0.3, max: 15 },
            'charge_speed': { base: 3, factor: 0.3, max: 15 }
        };
        
        // 해당 속성 값 계산 방식
        const valueInfo = baseValues[attributeType] || { base: 1, factor: 0.1 };
        
        // 레벨 스케일링과 랜덤 요소 적용
        let value = valueInfo.base + (level * valueInfo.factor);
        
        // 약간의 랜덤 변동 (±10%)
        const randomFactor = 0.9 + (Math.random() * 0.2);
        value *= randomFactor;
        
        // 최대 값 제한 (있는 경우)
        if (valueInfo.max && value > valueInfo.max) {
            value = valueInfo.max;
        }
        
        // 소수점 처리
        if (attributeType.includes('chance') || attributeType.includes('percent')) {
            return Math.round(value * 10) / 10; // 소수점 한 자리
        } else {
            return Math.round(value); // 정수
        }
    }
    
    /**
     * 특수 효과 생성
     * @param {Object} item - 아이템 인스턴스
     * @returns {Object} 특수 효과 정보
     */
    generateSpecialEffect(item) {
        // 아이템 유형별 가능한 특수 효과 목록
        const effectsByType = {
            'weapon': [
                {
                    name: '불꽃의 일격',
                    type: 'on_hit',
                    element: 'fire',
                    description: '공격 시 일정 확률로 적에게 화염 대미지를 입힙니다.',
                    procChance: 0.15,
                    effect: {
                        type: 'damage_over_time',
                        element: 'fire',
                        duration: 3,
                        tickDamage: item.level * 2
                    }
                },
                {
                    name: '번개의 일격',
                    type: 'on_hit',
                    element: 'lightning',
                    description: '공격 시 일정 확률로 적에게 번개 대미지를 입힙니다.',
                    procChance: 0.2,
                    effect: {
                        type: 'chain_lightning',
                        element: 'lightning',
                        damage: item.level * 3,
                        targets: 2
                    }
                },
                {
                    name: '서리의 일격',
                    type: 'on_hit',
                    element: 'ice',
                    description: '공격 시 일정 확률로 적을 감속시킵니다.',
                    procChance: 0.2,
                    effect: {
                        type: 'slow',
                        element: 'ice',
                        duration: 2,
                        slowAmount: 30
                    }
                },
                {
                    name: '생명력 흡수',
                    type: 'on_hit',
                    description: '공격 시 입힌 대미지의 일부만큼 체력을 회복합니다.',
                    procChance: 1.0,
                    effect: {
                        type: 'lifesteal',
                        amount: Math.min(5 + Math.floor(item.level / 2), 15)
                    }
                }
            ],
            'armor': [
                {
                    name: '가시 갑옷',
                    type: 'on_hit_taken',
                    description: '피격 시 공격자에게 대미지를 반사합니다.',
                    procChance: 1.0,
                    effect: {
                        type: 'reflect_damage',
                        amount: 10 + Math.floor(item.level * 0.5)
                    }
                },
                {
                    name: '생명력 재생',
                    type: 'passive',
                    description: '5초마다 체력을 회복합니다.',
                    effect: {
                        type: 'hp_regen',
                        amount: Math.floor(item.level * 0.5),
                        interval: 5
                    }
                },
                {
                    name: '마법 방벽',
                    type: 'passive',
                    description: '마법 대미지를 감소시킵니다.',
                    effect: {
                        type: 'magic_damage_reduction',
                        amount: Math.min(10 + Math.floor(item.level * 0.5), 30)
                    }
                },
                {
                    name: '원소 저항',
                    type: 'passive',
                    element: ['fire', 'ice', 'lightning'].at(Math.floor(Math.random() * 3)),
                    description: '특정 원소 대미지를 감소시킵니다.',
                    effect: {
                        type: 'element_resist',
                        amount: Math.min(15 + Math.floor(item.level * 0.7), 40)
                    }
                }
            ],
            'accessory': [
                {
                    name: '은신',
                    type: 'on_low_health',
                    description: '체력이 20% 이하로 떨어지면 3초간 은신합니다.',
                    cooldown: 60,
                    effect: {
                        type: 'stealth',
                        duration: 3
                    }
                },
                {
                    name: '보물 탐색가',
                    type: 'passive',
                    description: '상자에서 얻는 골드와 아이템 품질이 증가합니다.',
                    effect: {
                        type: 'treasure_bonus',
                        goldAmount: 20,
                        qualityBonus: 10
                    }
                },
                {
                    name: '마법 활성화',
                    type: 'on_skill_use',
                    description: '스킬 사용 시 일정 확률로 마나를 회복합니다.',
                    procChance: 0.3,
                    effect: {
                        type: 'mana_restore',
                        amount: Math.floor(10 + item.level * 0.5)
                    }
                },
                {
                    name: '신속한 움직임',
                    type: 'passive',
                    description: '이동 속도가 증가합니다.',
                    effect: {
                        type: 'movement_speed',
                        amount: Math.min(10 + Math.floor(item.level * 0.3), 20)
                    }
                }
            ]
        };
        
        // 희귀도에 따른 특수 효과 강화
        const rarityMultiplier = {
            'uncommon': 0.8,
            'rare': 1.0,
            'epic': 1.2,
            'legendary': 1.5,
            'mythic': 2.0
        };
        
        // 아이템 유형에 맞는 효과 목록
        const availableEffects = effectsByType[item.type] || [];
        
        // 효과가 없으면 null 반환
        if (availableEffects.length === 0) {
            return null;
        }
        
        // 랜덤 효과 선택
        const effect = { ...availableEffects[Math.floor(Math.random() * availableEffects.length)] };
        
        // 희귀도에 따른 효과 강화
        const multiplier = rarityMultiplier[item.rarity] || 1.0;
        
        // 효과 강화 적용
        if (effect.effect) {
            // 대미지 관련 효과
            if (effect.effect.damage) {
                effect.effect.damage = Math.floor(effect.effect.damage * multiplier);
            }
            
            // 회복 관련 효과
            if (effect.effect.amount) {
                effect.effect.amount = Math.floor(effect.effect.amount * multiplier);
            }
            
            // 지속시간 관련 효과
            if (effect.effect.duration) {
                effect.effect.duration = Math.floor(effect.effect.duration * multiplier * 10) / 10;
            }
            
            // 확률 관련 효과 (최대 확률 제한)
            if (effect.procChance) {
                effect.procChance = Math.min(0.5, effect.procChance * multiplier);
            }
        }
        
        return effect;
    }
    
    /**
     * 스탯 값 스케일링 계산
     * @param {number} baseStat - 기본 스탯 값
     * @param {number} level - 아이템 레벨
     * @param {number} scaleFactor - 스케일링 인자
     * @returns {number} 계산된 스탯 값
     */
    calculateScaledStat(baseStat, level, scaleFactor) {
        return Math.floor(baseStat * Math.pow(scaleFactor, level - 1));
    }
    
    /**
     * 몬스터 유형에 맞는 랜덤 아이템 생성
     * @param {Object} monster - 몬스터 데이터
     * @param {number} dungeonLevel - 던전 레벨
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Object} 생성된 아이템
     */
    generateRandomItemForMonster(monster, dungeonLevel, playerLevel) {
        // 희귀도 결정
        const rarity = this.determineRarityForMonster(monster.type);
        
        // 아이템 유형 결정 (몬스터 유형에 따라 다른 확률)
        const itemTypeRolls = {
            'normal': {
                'weapon': 0.2,
                'armor': 0.2,
                'accessory': 0.1,
                'consumable': 0.4,
                'material': 0.1
            },
            'elite': {
                'weapon': 0.25,
                'armor': 0.25,
                'accessory': 0.15,
                'consumable': 0.3,
                'material': 0.05
            },
            'boss': {
                'weapon': 0.3,
                'armor': 0.3,
                'accessory': 0.2,
                'consumable': 0.15,
                'material': 0.05
            }
        };
        
        const roll = Math.random();
        const typeRolls = itemTypeRolls[monster.type] || itemTypeRolls['normal'];
        
        let itemType;
        let cumulativeChance = 0;
        
        for (const [type, chance] of Object.entries(typeRolls)) {
            cumulativeChance += chance;
            if (roll < cumulativeChance) {
                itemType = type;
                break;
            }
        }
        
        // 아이템 유형별 템플릿 선택
        const itemTemplate = this.selectItemTemplate(itemType, rarity, monster.element);
        
        // 템플릿이 없으면 null 반환
        if (!itemTemplate) {
            return null;
        }
        
        // 아이템 인스턴스 생성
        return this.createItemInstance(itemTemplate, dungeonLevel, playerLevel);
    }
    
    /**
     * 몬스터 유형에 따른 아이템 희귀도 결정
     * @param {string} monsterType - 몬스터 유형
     * @returns {string} 희귀도
     */
    determineRarityForMonster(monsterType) {
        // 몬스터 유형별 희귀도 확률
        const rarityChances = {
            'normal': {
                'common': 0.7,
                'uncommon': 0.25,
                'rare': 0.04,
                'epic': 0.01,
                'legendary': 0.0
            },
            'elite': {
                'common': 0.4,
                'uncommon': 0.4,
                'rare': 0.15,
                'epic': 0.04,
                'legendary': 0.01
            },
            'boss': {
                'common': 0.1,
                'uncommon': 0.3,
                'rare': 0.4,
                'epic': 0.15,
                'legendary': 0.05
            }
        };
        
        const chances = rarityChances[monsterType] || rarityChances['normal'];
        const roll = Math.random();
        
        let rarity;
        let cumulativeChance = 0;
        
        for (const [r, chance] of Object.entries(chances)) {
            cumulativeChance += chance;
            if (roll < cumulativeChance) {
                rarity = r;
                break;
            }
        }
        
        return rarity || 'common';
    }
    
    /**
     * 유형과 희귀도에 맞는 아이템 템플릿 선택
     * @param {string} itemType - 아이템 유형
     * @param {string} rarity - 희귀도
     * @param {string} element - 몬스터 속성 (선택적)
     * @returns {Object} 아이템 템플릿
     */
    selectItemTemplate(itemType, rarity, element) {
        if (!this.itemsData || !itemType) {
            return null;
        }
        
        // 유형과 희귀도에 맞는 아이템 필터링
        const matchingItems = this.itemsData.filter(item => 
            item.type === itemType && item.rarity === rarity);
        
        // 매칭 아이템이 없으면 희귀도 하향 조정
        if (matchingItems.length === 0) {
            const fallbackRarities = {
                'legendary': 'epic',
                'epic': 'rare',
                'rare': 'uncommon',
                'uncommon': 'common'
            };
            
            const fallbackRarity = fallbackRarities[rarity];
            if (fallbackRarity) {
                return this.selectItemTemplate(itemType, fallbackRarity, element);
            }
            
            return null;
        }
        
        // 원소 속성이 있으면 해당 속성 아이템 우선
        if (element && ['fire', 'ice', 'lightning', 'light', 'dark'].includes(element)) {
            const elementItems = matchingItems.filter(item => 
                (item.element === element) || 
                (item.effects && item.effects.some(e => e.element === element)));
            
            if (elementItems.length > 0) {
                return elementItems[Math.floor(Math.random() * elementItems.length)];
            }
        }
        
        // 랜덤 선택
        return matchingItems[Math.floor(Math.random() * matchingItems.length)];
    }
    
    /**
     * 보물 상자 보상 생성
     * @param {string} chestType - 상자 유형 (normal, gold, boss, legendary)
     * @param {number} dungeonLevel - 던전 레벨
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Object} 생성된 보상 {gold, items}
     */
    generateChestRewards(chestType, dungeonLevel, playerLevel) {
        // 보물 상자 설정
        const chestConfig = this.getChestConfig(chestType);
        
        // 골드 계산
        const goldMin = chestConfig.goldRange.min;
        const goldMax = chestConfig.goldRange.max;
        const goldBase = Math.floor(Math.random() * (goldMax - goldMin + 1)) + goldMin;
        
        // 던전 레벨에 따른 골드 보정
        const goldAmount = Math.floor(goldBase * (1 + 0.1 * dungeonLevel));
        
        // 아이템 개수 결정
        const itemCount = Math.floor(Math.random() * 
            (chestConfig.itemCount.max - chestConfig.itemCount.min + 1)) + 
            chestConfig.itemCount.min;
        
        // 아이템 생성
        const items = [];
        
        for (let i = 0; i < itemCount; i++) {
            // 희귀도 결정
            const rarity = this.rollChestItemRarity(chestConfig.rarityDistribution);
            
            // 아이템 유형 결정 (랜덤)
            const itemTypes = ['weapon', 'armor', 'accessory', 'consumable'];
            const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
            
            // 아이템 템플릿 선택
            const itemTemplate = this.selectItemTemplate(itemType, rarity);
            
            // 아이템 생성
            if (itemTemplate) {
                const item = this.createItemInstance(itemTemplate, dungeonLevel, playerLevel);
                if (item) {
                    items.push(item);
                }
            }
        }
        
        return {
            gold: goldAmount,
            items: items
        };
    }
    
    /**
     * 상자 유형별 설정 가져오기
     * @param {string} chestType - 상자 유형
     * @returns {Object} 상자 설정
     */
    getChestConfig(chestType) {
        // 기본 상자 설정
        const chestConfigs = {
            'normal': {
                goldRange: { min: 10, max: 30 },
                itemCount: { min: 1, max: 2 },
                rarityDistribution: {
                    'common': 0.6,
                    'uncommon': 0.3,
                    'rare': 0.09,
                    'epic': 0.01,
                    'legendary': 0.0
                }
            },
            'gold': {
                goldRange: { min: 50, max: 100 },
                itemCount: { min: 1, max: 3 },
                rarityDistribution: {
                    'common': 0.4,
                    'uncommon': 0.4,
                    'rare': 0.15,
                    'epic': 0.05,
                    'legendary': 0.0
                }
            },
            'boss': {
                goldRange: { min: 100, max: 200 },
                itemCount: { min: 2, max: 4 },
                rarityDistribution: {
                    'common': 0.2,
                    'uncommon': 0.4,
                    'rare': 0.3,
                    'epic': 0.09,
                    'legendary': 0.01
                }
            },
            'legendary': {
                goldRange: { min: 200, max: 500 },
                itemCount: { min: 3, max: 5 },
                rarityDistribution: {
                    'common': 0.0,
                    'uncommon': 0.2,
                    'rare': 0.5,
                    'epic': 0.25,
                    'legendary': 0.05
                }
            }
        };
        
        return chestConfigs[chestType] || chestConfigs['normal'];
    }
    
    /**
     * 상자 아이템 희귀도 결정
     * @param {Object} rarityDistribution - 희귀도별 확률
     * @returns {string} 결정된 희귀도
     */
    rollChestItemRarity(rarityDistribution) {
        const roll = Math.random();
        let cumulativeChance = 0;
        
        for (const [rarity, chance] of Object.entries(rarityDistribution)) {
            cumulativeChance += chance;
            if (roll < cumulativeChance) {
                return rarity;
            }
        }
        
        return 'common'; // 기본 값
    }
    
    /**
     * 상인 인벤토리 생성
     * @param {string} merchantType - 상인 유형
     * @param {number} dungeonLevel - 던전 레벨
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Array} 상인 아이템 배열
     */
    generateMerchantInventory(merchantType, dungeonLevel, playerLevel) {
        // 상인 설정
        const merchantConfig = this.getMerchantConfig(merchantType);
        
        // 인벤토리 크기 결정
        const inventorySize = Math.floor(Math.random() * 
            (merchantConfig.inventorySize.max - merchantConfig.inventorySize.min + 1)) + 
            merchantConfig.inventorySize.min;
        
        // 아이템 생성
        const inventory = [];
        
        for (let i = 0; i < inventorySize; i++) {
            // 희귀도 결정
            const rarity = this.rollChestItemRarity(merchantConfig.rarityDistribution);
            
            // 아이템 유형 결정 (상인 유형에 따라 다름)
            const itemType = this.selectMerchantItemType(merchantConfig.itemTypes);
            
            // 아이템 템플릿 선택
            const itemTemplate = this.selectItemTemplate(itemType, rarity);
            
            // 아이템 생성
            if (itemTemplate) {
                const item = this.createItemInstance(itemTemplate, dungeonLevel, playerLevel);
                if (item) {
                    // 가격 설정
                    item.price = this.calculateItemPrice(item, merchantConfig.priceMultiplier);
                    inventory.push(item);
                }
            }
        }
        
        return inventory;
    }
    
    /**
     * 상인 유형별 설정 가져오기
     * @param {string} merchantType - 상인 유형
     * @returns {Object} 상인 설정
     */
    getMerchantConfig(merchantType) {
        // 기본 상인 설정
        const merchantConfigs = {
            'general': {
                inventorySize: { min: 5, max: 8 },
                itemTypes: ['weapon', 'armor', 'accessory', 'consumable'],
                rarityDistribution: {
                    'common': 0.5,
                    'uncommon': 0.3,
                    'rare': 0.15,
                    'epic': 0.05,
                    'legendary': 0.0
                },
                priceMultiplier: 1.0,
                buyRate: 0.5
            },
            'weapon': {
                inventorySize: { min: 4, max: 6 },
                itemTypes: ['weapon'],
                rarityDistribution: {
                    'common': 0.3,
                    'uncommon': 0.4,
                    'rare': 0.25,
                    'epic': 0.05,
                    'legendary': 0.0
                },
                priceMultiplier: 1.2,
                buyRate: 0.6
            },
            'armor': {
                inventorySize: { min: 4, max: 6 },
                itemTypes: ['armor'],
                rarityDistribution: {
                    'common': 0.3,
                    'uncommon': 0.4,
                    'rare': 0.25,
                    'epic': 0.05,
                    'legendary': 0.0
                },
                priceMultiplier: 1.2,
                buyRate: 0.6
            },
            'magic': {
                inventorySize: { min: 3, max: 5 },
                itemTypes: ['accessory', 'consumable'],
                rarityDistribution: {
                    'common': 0.2,
                    'uncommon': 0.4,
                    'rare': 0.3,
                    'epic': 0.1,
                    'legendary': 0.0
                },
                priceMultiplier: 1.5,
                buyRate: 0.7
            },
            'rare': {
                inventorySize: { min: 2, max: 4 },
                itemTypes: ['weapon', 'armor', 'accessory'],
                rarityDistribution: {
                    'common': 0.0,
                    'uncommon': 0.3,
                    'rare': 0.5,
                    'epic': 0.18,
                    'legendary': 0.02
                },
                priceMultiplier: 2.0,
                buyRate: 0.8
            }
        };
        
        return merchantConfigs[merchantType] || merchantConfigs['general'];
    }
    
    /**
     * 상인 아이템 유형 선택
     * @param {Array} itemTypes - 가능한 아이템 유형 배열
     * @returns {string} 선택된 아이템 유형
     */
    selectMerchantItemType(itemTypes) {
        if (!itemTypes || itemTypes.length === 0) {
            // 기본 아이템 유형
            const defaultTypes = ['weapon', 'armor', 'accessory', 'consumable'];
            return defaultTypes[Math.floor(Math.random() * defaultTypes.length)];
        }
        
        return itemTypes[Math.floor(Math.random() * itemTypes.length)];
    }
    
    /**
     * 아이템 가격 계산
     * @param {Object} item - 아이템 인스턴스
     * @param {number} priceMultiplier - 가격 배수
     * @returns {number} 계산된 가격
     */
    calculateItemPrice(item, priceMultiplier) {
        if (!item) return 0;
        
        // 기본 가격 (아이템 정보에 있는 경우)
        let basePrice = item.value || 0;
        
        // 기본 가격이 없으면 유형, 희귀도, 레벨로 계산
        if (basePrice === 0) {
            // 유형별 기본 가격
            const typeBasePrice = {
                'weapon': 20,
                'armor': 18,
                'accessory': 15,
                'consumable': 10,
                'material': 5,
                'special': 50
            };
            
            // 희귀도별 배수
            const rarityMultiplier = {
                'common': 1,
                'uncommon': 2,
                'rare': 5,
                'epic': 15,
                'legendary': 50,
                'mythic': 200
            };
            
            basePrice = (typeBasePrice[item.type] || 10) * 
                (rarityMultiplier[item.rarity] || 1) * 
                (1 + (item.level || 1) * 0.2);
        }
        
        // 속성 개수에 따른 추가 가격
        if (item.attributes) {
            basePrice += item.attributes.length * basePrice * 0.1;
        }
        
        // 특수 효과에 따른 추가 가격
        if (item.specialEffect) {
            basePrice += basePrice * 0.3;
        }
        
        // 상인 배수 적용
        const finalPrice = Math.floor(basePrice * (priceMultiplier || 1));
        
        return finalPrice;
    }
    
    /**
     * 던전 클리어 보상 생성
     * @param {string} dungeonId - 던전 ID
     * @param {Object} stats - 던전 클리어 통계
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Object} 보상 정보 {gold, items, experience}
     */
    generateDungeonRewards(dungeonId, stats, playerLevel) {
        // 던전 정보 가져오기
        const dungeonInfo = this.getDungeonInfo(dungeonId);
        if (!dungeonInfo) {
            return {
                gold: 100,
                items: [],
                experience: 50
            };
        }
        
        // 기본 보상 설정
        const baseRewards = {
            gold: 100 * dungeonInfo.difficulty.base,
            experience: 50 * dungeonInfo.difficulty.base
        };
        
        // 통계 기반 보상 조정
        let goldMultiplier = 1.0;
        let expMultiplier = 1.0;
        
        if (stats) {
            // 몬스터 처치 보너스
            if (stats.monstersKilled) {
                goldMultiplier += stats.monstersKilled * 0.02;
                expMultiplier += stats.monstersKilled * 0.01;
            }
            
            // 방 탐험 보너스
            if (stats.roomsExplored) {
                goldMultiplier += stats.roomsExplored * 0.05;
                expMultiplier += stats.roomsExplored * 0.03;
            }
            
            // 보스 처치 보너스
            if (stats.bossDefeated) {
                goldMultiplier += 0.5;
                expMultiplier += 0.4;
            }
            
            // 도전 방 완료 보너스
            if (stats.challengesCompleted) {
                goldMultiplier += stats.challengesCompleted * 0.2;
                expMultiplier += stats.challengesCompleted * 0.15;
            }
            
            // 시간 보너스 (빠를수록 더 높은 보너스)
            if (stats.timeElapsed) {
                const minutes = stats.timeElapsed / 60000;
                const timeFactor = Math.max(0, 1 - (minutes / 30)); // 30분 기준
                goldMultiplier += timeFactor * 0.5;
                expMultiplier += timeFactor * 0.3;
            }
            
            // 사망 패널티
            if (stats.deaths) {
                goldMultiplier -= stats.deaths * 0.1;
                expMultiplier -= stats.deaths * 0.05;
            }
        }
        
        // 최소 보상 보장
        goldMultiplier = Math.max(0.5, goldMultiplier);
        expMultiplier = Math.max(0.5, expMultiplier);
        
        // 최종 기본 보상 계산
        const finalGold = Math.floor(baseRewards.gold * goldMultiplier);
        const finalExp = Math.floor(baseRewards.experience * expMultiplier);
        
        // 아이템 보상 생성
        const items = this.generateDungeonItems(dungeonInfo, stats, playerLevel);
        
        return {
            gold: finalGold,
            items: items,
            experience: finalExp
        };
    }
    
    /**
     * 던전 ID로 던전 정보 가져오기
     * @param {string} dungeonId - 던전 ID
     * @returns {Object} 던전 정보
     */
    getDungeonInfo(dungeonId) {
        if (!this.dungeonsData || !this.dungeonsData.dungeons) {
            return null;
        }
        
        return this.dungeonsData.dungeons.find(d => d.id === dungeonId);
    }
    
    /**
     * 던전 클리어 아이템 보상 생성
     * @param {Object} dungeonInfo - 던전 정보
     * @param {Object} stats - 던전 통계
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Array} 아이템 배열
     */
    generateDungeonItems(dungeonInfo, stats, playerLevel) {
        if (!dungeonInfo) {
            return [];
        }
        
        const items = [];
        const dungeonLevel = dungeonInfo.recommendedLevel || 1;
        
        // 보상 아이템 개수 결정
        let itemCount = 1 + Math.floor(dungeonInfo.difficulty.base / 2);
        
        // 보스 처치 보너스
        if (stats && stats.bossDefeated) {
            itemCount += 1;
        }
        
        // 도전 방 보너스
        if (stats && stats.challengesCompleted) {
            itemCount += stats.challengesCompleted;
        }
        
        // 던전 난이도별 아이템 희귀도 조정
        const rarityDistribution = this.getDungeonRarityDistribution(dungeonInfo.difficulty.base);
        
        // 아이템 생성
        for (let i = 0; i < itemCount; i++) {
            const rarity = this.rollChestItemRarity(rarityDistribution);
            
            // 아이템 유형 결정 (랜덤)
            const itemTypes = ['weapon', 'armor', 'accessory', 'consumable'];
            const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
            
            // 던전 룻 테이블이 있으면 사용
            let itemTemplate = null;
            if (dungeonInfo.lootTable && dungeonInfo.lootTable[rarity] && dungeonInfo.lootTable[rarity].length > 0) {
                const lootTableItems = dungeonInfo.lootTable[rarity];
                const itemId = lootTableItems[Math.floor(Math.random() * lootTableItems.length)];
                itemTemplate = this.findItemById(itemId);
            } else {
                // 일반 아이템 템플릿 선택
                itemTemplate = this.selectItemTemplate(itemType, rarity);
            }
            
            // 아이템 생성
            if (itemTemplate) {
                const item = this.createItemInstance(itemTemplate, dungeonLevel, playerLevel);
                if (item) {
                    items.push(item);
                }
            }
        }
        
        return items;
    }
    
    /**
     * 던전 난이도별 희귀도 분포 가져오기
     * @param {number} difficulty - 던전 난이도
     * @returns {Object} 희귀도 분포
     */
    getDungeonRarityDistribution(difficulty) {
        // 기본 희귀도 분포
        const baseDistribution = {
            'common': 0.5,
            'uncommon': 0.3,
            'rare': 0.15,
            'epic': 0.04,
            'legendary': 0.01
        };
        
        // 난이도에 따라 조정
        const difficultyFactor = (difficulty - 1) * 0.1;
        
        return {
            'common': Math.max(0.1, baseDistribution.common - difficultyFactor * 2),
            'uncommon': Math.max(0.2, baseDistribution.uncommon - difficultyFactor),
            'rare': Math.min(0.5, baseDistribution.rare + difficultyFactor),
            'epic': Math.min(0.3, baseDistribution.epic + difficultyFactor * 0.5),
            'legendary': Math.min(0.1, baseDistribution.legendary + difficultyFactor * 0.2)
        };
    }
    
    /**
     * 아이템 분해 결과 생성
     * @param {Object} item - 분해할 아이템
     * @returns {Array} 획득한 재료 아이템 배열
     */
    generateDisassemblyResult(item) {
        if (!item) {
            return [];
        }
        
        const materials = [];
        
        // 재료 개수 결정 (희귀도와 아이템 레벨에 따라)
        const counts = {
            'common': { min: 1, max: 1 },
            'uncommon': { min: 1, max: 2 },
            'rare': { min: 2, max: 3 },
            'epic': { min: 2, max: 4 },
            'legendary': { min: 3, max: 5 },
            'mythic': { min: 4, max: 6 }
        };
        
        const range = counts[item.rarity] || counts.common;
        const materialCount = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        
        // 아이템 유형에 따른 재료 결정
        const materialTypes = this.getMaterialTypesByItem(item);
        
        // 재료 생성
        for (let i = 0; i < materialCount; i++) {
            const materialType = materialTypes[Math.floor(Math.random() * materialTypes.length)];
            
            // 재료 아이템 템플릿 선택
            const materialTemplate = this.selectMaterialTemplate(materialType, item.rarity);
            
            if (materialTemplate) {
                // 재료 인스턴스 생성
                const material = { ...materialTemplate };
                
                // 개수 결정 (1~3)
                material.count = Math.floor(Math.random() * 3) + 1;
                
                // 희귀 재료는 개수 제한
                if (['rare', 'epic', 'legendary'].includes(material.rarity)) {
                    material.count = 1;
                }
                
                materials.push(material);
            }
        }
        
        return materials;
    }
    
    /**
     * 아이템 유형별 분해 재료 타입 가져오기
     * @param {Object} item - 아이템 인스턴스
     * @returns {Array} 재료 타입 배열
     */
    getMaterialTypesByItem(item) {
        // 기본 재료 타입
        const basicMaterials = ['scrap', 'dust'];
        
        // 아이템 유형별 특수 재료
        const typeMaterials = {
            'weapon': ['metal', 'wood', 'crystal'],
            'armor': ['leather', 'cloth', 'metal', 'scale'],
            'accessory': ['gem', 'rune', 'crystal'],
            'consumable': ['herb', 'powder', 'liquid']
        };
        
        // 아이템 속성별 원소 재료
        const elementMaterials = [];
        
        if (item.element) {
            elementMaterials.push(`${item.element}_essence`);
        }
        
        if (item.attributes) {
            for (const attr of item.attributes) {
                if (attr.element) {
                    elementMaterials.push(`${attr.element}_essence`);
                }
            }
        }
        
        // 모든 재료 타입 결합
        const allMaterials = [
            ...basicMaterials,
            ...(typeMaterials[item.type] || []),
            ...elementMaterials
        ];
        
        // 중복 제거
        return [...new Set(allMaterials)];
    }
    
    /**
     * 재료 타입과 희귀도에 맞는 재료 템플릿 선택
     * @param {string} materialType - 재료 타입
     * @param {string} originRarity - 원본 아이템 희귀도
     * @returns {Object} 재료 템플릿
     */
    selectMaterialTemplate(materialType, originRarity) {
        // 재료 희귀도 결정 (원본보다 낮거나 같음)
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
        const originIndex = rarityOrder.indexOf(originRarity);
        const maxRarityIndex = Math.min(originIndex, rarityOrder.length - 1);
        
        // 희귀도 롤링
        let rarityIndex;
        if (maxRarityIndex <= 1) {
            rarityIndex = Math.floor(Math.random() * (maxRarityIndex + 1));
        } else {
            // 높은 희귀도일 수록 낮은 희귀도의 재료가 나올 확률이 높음
            const roll = Math.random();
            if (roll < 0.6) {
                rarityIndex = 0;
            } else if (roll < 0.85) {
                rarityIndex = 1;
            } else {
                rarityIndex = Math.min(2, maxRarityIndex);
            }
        }
        
        const rarity = rarityOrder[rarityIndex];
        
        // 해당 타입과 희귀도의 재료 찾기
        const materials = this.itemsData.filter(item => 
            item.type === 'material' && 
            item.subType === materialType && 
            item.rarity === rarity);
        
        // 해당하는 재료가 없으면 대체 재료 찾기
        if (materials.length === 0) {
            // 같은 타입, 다른 희귀도
            const anyRarityMaterials = this.itemsData.filter(item => 
                item.type === 'material' && 
                item.subType === materialType);
            
            if (anyRarityMaterials.length > 0) {
                return anyRarityMaterials[Math.floor(Math.random() * anyRarityMaterials.length)];
            }
            
            // 기본 재료 (scrap)
            const defaultMaterials = this.itemsData.filter(item => 
                item.type === 'material' && 
                item.subType === 'scrap');
            
            if (defaultMaterials.length > 0) {
                return defaultMaterials[0];
            }
            
            return null;
        }
        
        // 랜덤 선택
        return materials[Math.floor(Math.random() * materials.length)];
    }
    
    /**
     * 신단 효과 생성
     * @param {string} shrineType - 신단 유형
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {Object} 신단 효과 정보
     */
    generateShrineEffect(shrineType, playerLevel) {
        // 신단 설정
        const shrineConfig = this.getShrineConfig(shrineType);
        
        // 기본 효과 정보
        const effectInfo = {
            type: shrineType,
            name: shrineConfig.name,
            description: shrineConfig.description,
            duration: 300, // 기본 5분 (초 단위)
            effects: []
        };
        
        // 신단 효과 생성
        for (const [effectType, baseValue] of Object.entries(shrineConfig.effects)) {
            // 레벨 스케일링 효과 값
            const scaledValue = this.calculateShrineEffectValue(effectType, baseValue, playerLevel);
            
            effectInfo.effects.push({
                type: effectType,
                value: scaledValue,
                description: this.getShrineEffectDescription(effectType, scaledValue)
            });
        }
        
        return effectInfo;
    }
    
    /**
     * 신단 유형별 설정 가져오기
     * @param {string} shrineType - 신단 유형
     * @returns {Object} 신단 설정
     */
    getShrineConfig(shrineType) {
        // 신단 설정
        const shrineConfigs = {
            'power': {
                name: '힘의 신단',
                description: '공격력이 일시적으로 증가합니다.',
                effects: {
                    'attack_bonus': 15,
                    'critical_chance': 5
                }
            },
            'defense': {
                name: '방어의 신단',
                description: '방어력이 일시적으로 증가합니다.',
                effects: {
                    'defense_bonus': 20,
                    'damage_reduction': 10
                }
            },
            'vitality': {
                name: '생명력의 신단',
                description: '최대 HP와 재생력이 일시적으로 증가합니다.',
                effects: {
                    'max_hp_bonus': 25,
                    'hp_regen': 5
                }
            },
            'magic': {
                name: '마법의 신단',
                description: '주문력과 마나 회복력이 일시적으로 증가합니다.',
                effects: {
                    'magic_power': 20,
                    'mp_regen': 10
                }
            },
            'speed': {
                name: '신속의 신단',
                description: '이동 속도와 공격 속도가 일시적으로 증가합니다.',
                effects: {
                    'movement_speed': 15,
                    'attack_speed': 10
                }
            },
            'fortune': {
                name: '행운의 신단',
                description: '골드 획득량과 아이템 드롭률이 일시적으로 증가합니다.',
                effects: {
                    'gold_find': 30,
                    'item_find': 20
                }
            },
            'elements': {
                name: '원소의 신단',
                description: '원소 대미지가 일시적으로 증가합니다.',
                effects: {
                    'element_damage': 25,
                    'element_resist': 15
                }
            }
        };
        
        return shrineConfigs[shrineType] || shrineConfigs['power'];
    }
    
    /**
     * 신단 효과 값 계산
     * @param {string} effectType - 효과 유형
     * @param {number} baseValue - 기본 효과 값
     * @param {number} playerLevel - 플레이어 레벨
     * @returns {number} 계산된 효과 값
     */
    calculateShrineEffectValue(effectType, baseValue, playerLevel) {
        // 레벨 스케일링 (10레벨당 10% 증가)
        const levelFactor = 1 + (Math.floor(playerLevel / 10) * 0.1);
        
        // 효과 유형별 최대값 제한
        const maxValues = {
            'attack_bonus': 50,
            'critical_chance': 25,
            'defense_bonus': 75,
            'damage_reduction': 30,
            'max_hp_bonus': 100,
            'hp_regen': 20,
            'magic_power': 60,
            'mp_regen': 30,
            'movement_speed': 50,
            'attack_speed': 40,
            'gold_find': 100,
            'item_find': 75,
            'element_damage': 80,
            'element_resist': 50
        };
        
        // 계산된 값 (최대값 제한)
        const scaledValue = baseValue * levelFactor;
        const maxValue = maxValues[effectType] || 100;
        
        return Math.min(maxValue, Math.floor(scaledValue));
    }
    
    /**
     * 신단 효과 설명 가져오기
     * @param {string} effectType - 효과 유형
     * @param {number} value - 효과 값
     * @returns {string} 효과 설명
     */
    getShrineEffectDescription(effectType, value) {
        // 효과 유형별 설명 템플릿
        const descriptionTemplates = {
            'attack_bonus': `공격력 +${value}%`,
            'critical_chance': `치명타 확률 +${value}%`,
            'defense_bonus': `방어력 +${value}%`,
            'damage_reduction': `대미지 감소 +${value}%`,
            'max_hp_bonus': `최대 HP +${value}%`,
            'hp_regen': `HP 초당 회복 +${value}`,
            'magic_power': `주문력 +${value}%`,
            'mp_regen': `MP 초당 회복 +${value}`,
            'movement_speed': `이동 속도 +${value}%`,
            'attack_speed': `공격 속도 +${value}%`,
            'gold_find': `골드 획득량 +${value}%`,
            'item_find': `아이템 드롭률 +${value}%`,
            'element_damage': `원소 대미지 +${value}%`,
            'element_resist': `원소 저항 +${value}%`
        };
        
        return descriptionTemplates[effectType] || `${effectType} +${value}`;
    }
    
    /**
     * 이벤트 리스너 등록
     * @param {string} event - 이벤트 이름
     * @param {Function} listener - 리스너 함수
     * @param {Object} context - 콘텍스트 (선택적)
     */
    on(event, listener, context) {
        this.events.on(event, listener, context);
    }
    
    /**
     * 이벤트 리스너 제거
     * @param {string} event - 이벤트 이름
     * @param {Function} listener - 리스너 함수
     * @param {Object} context - 콘텍스트 (선택적)
     */
    off(event, listener, context) {
        this.events.off(event, listener, context);
    }
}

export default LootSystem;