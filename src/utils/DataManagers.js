// src/utils/DataManager.js

/**
 * 게임 데이터의 로드, 저장, 관리를 담당하는 클래스
 * 모든 게임 데이터 접근을 중앙화하여 일관된 데이터 처리를 제공
 */
class DataManager {
    /**
     * DataManager 생성자
     * @param {Phaser.Game} game - 게임 인스턴스
     */
    constructor(game) {
        this.game = game;
        
        // 기본 데이터 구조 초기화
        this.gameData = {
            player: {},
            classes: {},
            inventory: [],
            equipment: {},
            masteryBonuses: {},
            statistics: {},
            completedDungeons: [],
            unlockedDungeons: [],
            achievements: {},
            gold: 0,
            lastSaveTime: Date.now()
        };
        
        // 데이터 캐시
        this.dataCache = {
            items: null,
            monsters: null,
            classes: null,
            dungeons: null,
            progression: null
        };
        
        // 이벤트 관리
        this.events = new Phaser.Events.EventEmitter();
        
        // 자동 저장 설정
        this.setupAutoSave();
    }
    
    /**
     * 자동 저장 타이머 설정
     */
    setupAutoSave() {
        // 5분마다 자동 저장
        this.autoSaveInterval = setInterval(() => {
            this.saveGameData();
        }, 5 * 60 * 1000);
    }
    
    /**
     * 게임 데이터 로드
     * @returns {Promise<boolean>} 로드 성공 여부
     */
    async loadGameData() {
        try {
            // 저장된 데이터 가져오기
            const savedData = await this.getSavedData();
            
            if (savedData) {
                // 저장 데이터 검증
                if (this.validateGameData(savedData)) {
                    this.gameData = savedData;
                    
                    // 이벤트 발생
                    this.events.emit('dataLoaded', this.gameData);
                    return true;
                } else {
                    console.warn('게임 데이터 검증 실패, 새 게임 시작');
                    this.initNewGame();
                    return false;
                }
            } else {
                console.log('저장된 게임 데이터가 없습니다. 새 게임 시작');
                this.initNewGame();
                return false;
            }
        } catch (error) {
            console.error('게임 데이터 로딩 오류:', error);
            this.initNewGame();
            return false;
        }
    }
    
    /**
     * 저장된 게임 데이터 가져오기
     * @returns {Promise<Object>} 저장된 게임 데이터
     */
    async getSavedData() {
        return new Promise((resolve) => {
            // localStorage에서 데이터 가져오기
            try {
                const savedDataString = localStorage.getItem('dungeon_loop_save');
                
                if (savedDataString) {
                    const savedData = JSON.parse(savedDataString);
                    resolve(savedData);
                } else {
                    resolve(null);
                }
            } catch (error) {
                console.error('저장 데이터 파싱 오류:', error);
                resolve(null);
            }
        });
    }
    
    /**
     * 게임 데이터 검증
     * @param {Object} data - 검증할 게임 데이터
     * @returns {boolean} 유효한 데이터인지 여부
     */
    validateGameData(data) {
        // 필수 데이터 필드 확인
        const requiredFields = ['player', 'classes', 'inventory', 'equipment', 'gold'];
        
        for (const field of requiredFields) {
            if (!data[field]) {
                console.warn(`누락된 필드: ${field}`);
                return false;
            }
        }
        
        // 데이터 무결성 검사
        // 1. 플레이어 데이터 확인
        if (!data.player.currentClass || !data.classes[data.player.currentClass]) {
            console.warn('현재 클래스 데이터 무결성 오류');
            return false;
        }
        
        // 2. 장비 데이터 확인
        for (const slot in data.equipment) {
            const itemId = data.equipment[slot];
            if (itemId && !this.findItemInInventory(data.inventory, itemId)) {
                console.warn(`장착된 아이템이 인벤토리에 없음: ${itemId}`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 인벤토리에서 아이템 찾기
     * @param {Array} inventory - 인벤토리 배열
     * @param {string} itemId - 찾을 아이템 ID
     * @returns {Object} 찾은 아이템 또는 null
     */
    findItemInInventory(inventory, itemId) {
        return inventory.find(item => item.id === itemId || item.instanceId === itemId);
    }
    
    /**
     * 새 게임 초기화
     */
    initNewGame() {
        // 기본 플레이어 데이터 설정
        this.gameData.player = {
            currentClass: 'warrior',
            level: 1,
            experience: 0,
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            stats: {
                attack: 10,
                defense: 5,
                speed: 5
            }
        };
        
        // 기본 클래스 해금
        this.gameData.classes = {
            'warrior': {
                level: 1,
                experience: 0,
                unlocked: true,
                skillPoints: 0,
                skills: {}
            },
            'archer': {
                level: 1,
                experience: 0,
                unlocked: true,
                skillPoints: 0,
                skills: {}
            },
            'mage': {
                level: 1,
                experience: 0,
                unlocked: true,
                skillPoints: 0,
                skills: {}
            }
        };
        
        // 시작 아이템 추가
        this.gameData.inventory = [
            {
                id: 'wooden_sword',
                instanceId: 'starter_sword_' + Date.now(),
                type: 'weapon',
                subType: 'sword',
                name: '나무 검',
                rarity: 'common',
                level: 1,
                stats: {
                    damage: 5
                },
                attributes: []
            },
            {
                id: 'leather_armor',
                instanceId: 'starter_armor_' + Date.now(),
                type: 'armor',
                subType: 'chest',
                name: '가죽 갑옷',
                rarity: 'common',
                level: 1,
                stats: {
                    defense: 3
                },
                attributes: []
            },
            {
                id: 'health_potion_small',
                type: 'consumable',
                subType: 'potion',
                name: '소형 체력 포션',
                rarity: 'common',
                effect: {
                    type: 'heal',
                    value: 30
                },
                stackable: true,
                count: 3
            }
        ];
        
        // 시작 장비 설정
        this.gameData.equipment = {
            weapon: 'starter_sword_' + Date.now(),
            chest: 'starter_armor_' + Date.now()
        };
        
        // 기본 골드
        this.gameData.gold = 100;
        
        // 첫 번째 던전 해금
        this.gameData.unlockedDungeons = ['sword_forest_1'];
        
        // 통계 초기화
        this.gameData.statistics = {
            playTime: 0,
            dungeonRuns: 0,
            monstersKilled: 0,
            bossesKilled: 0,
            itemsCollected: 0,
            goldCollected: 0,
            deaths: 0
        };
        
        // 시작 시간 기록
        this.gameData.lastSaveTime = Date.now();
        
        // 저장
        this.saveGameData();
        
        // 이벤트 발생
        this.events.emit('newGameInitialized', this.gameData);
    }
    
    /**
     * 게임 데이터 저장
     * @returns {Promise<boolean>} 저장 성공 여부
     */
    async saveGameData() {
        try {
            // 저장 전 데이터 업데이트
            this.updateGameDataForSaving();
            
            // 데이터 저장
            localStorage.setItem('dungeon_loop_save', JSON.stringify(this.gameData));
            
            console.log('게임 데이터 저장 완료');
            
            // 이벤트 발생
            this.events.emit('dataSaved', this.gameData);
            
            return true;
        } catch (error) {
            console.error('게임 데이터 저장 오류:', error);
            return false;
        }
    }
    
    /**
     * 저장 전 게임 데이터 업데이트
     */
    updateGameDataForSaving() {
        // 현재 시간 기록
        const currentTime = Date.now();
        const lastSaveTime = this.gameData.lastSaveTime || currentTime;
        
        // 플레이 시간 업데이트
        this.updatePlayTimeStatistics(lastSaveTime, currentTime);
        
        // 마지막 저장 시간 갱신
        this.gameData.lastSaveTime = currentTime;
    }
    
    /**
     * 플레이 시간 통계 업데이트
     * @param {number} lastTime - 이전 시간 (밀리초)
     * @param {number} currentTime - 현재 시간 (밀리초)
     */
    updatePlayTimeStatistics(lastTime, currentTime) {
        if (!this.gameData.statistics) {
            this.gameData.statistics = { playTime: 0 };
        }
        
        // 이전 저장 시간과의 차이를 추가 (초 단위)
        const timeDiff = Math.floor((currentTime - lastTime) / 1000);
        this.gameData.statistics.playTime = (this.gameData.statistics.playTime || 0) + timeDiff;
    }
    
    /**
     * 플레이어 클래스 변경
     * @param {string} classId - 변경할 클래스 ID
     * @returns {boolean} 변경 성공 여부
     */
    changePlayerClass(classId) {
        // 클래스 확인
        if (!this.gameData.classes[classId] || !this.gameData.classes[classId].unlocked) {
            console.warn(`해금되지 않은 클래스 선택: ${classId}`);
            return false;
        }
        
        // 현재 클래스 저장
        const previousClass = this.gameData.player.currentClass;
        
        // 클래스 변경
        this.gameData.player.currentClass = classId;
        
        // 플레이어 스탯 업데이트
        this.updatePlayerStats();
        
        // 이벤트 발생
        this.events.emit('classChanged', {
            previousClass: previousClass,
            newClass: classId
        });
        
        return true;
    }
    
    /**
     * 플레이어 스탯 업데이트
     */
    updatePlayerStats() {
        const classId = this.gameData.player.currentClass;
        
        if (!classId || !this.gameData.classes[classId]) {
            return;
        }
        
        // 클래스 정보 가져오기
        const classInfo = this.getClassData(classId);
        if (!classInfo) {
            console.warn(`클래스 정보 없음: ${classId}`);
            return;
        }
        
        // 플레이어 레벨
        const level = this.gameData.classes[classId].level || 1;
        
        // 기본 스탯 계산
        const baseStats = this.calculateBaseStats(classInfo, level);
        
        // 패시브 효과 적용
        const statsWithPassives = this.applyClassPassives(classId, baseStats);
        
        // 장비 효과 적용
        const statsWithEquipment = this.applyEquipmentEffects(statsWithPassives);
        
        // 마스터리 보너스 적용
        const finalStats = this.applyMasteryBonuses(classId, statsWithEquipment);
        
        // 플레이어 스탯 업데이트
        this.gameData.player.maxHp = finalStats.maxHp;
        this.gameData.player.maxMp = finalStats.maxMp;
        
        // 현재 HP/MP가 없으면 최대값으로 설정
        if (!this.gameData.player.hp) {
            this.gameData.player.hp = finalStats.maxHp;
        }
        
        if (!this.gameData.player.mp) {
            this.gameData.player.mp = finalStats.maxMp;
        }
        
        // 기타 스탯
        this.gameData.player.stats = {
            attack: finalStats.attack,
            defense: finalStats.defense,
            speed: finalStats.speed
        };
        
        // 이벤트 발생
        this.events.emit('playerStatsUpdated', this.gameData.player);
    }
    
    /**
     * 클래스 정보 가져오기
     * @param {string} classId - 클래스 ID
     * @returns {Object} 클래스 정보
     */
    getClassData(classId) {
        // 클래스 데이터 캐시 확인
        if (!this.dataCache.classes) {
            // 필요시 캐시 로드
            this.loadClassData();
        }
        
        if (!this.dataCache.classes || !this.dataCache.classes.classes) {
            return null;
        }
        
        return this.dataCache.classes.classes.find(c => c.id === classId);
    }
    
    /**
     * 클래스 데이터 로드
     */
    loadClassData() {
        try {
            // 일반적으로 Phaser에서는 씬의 캐시에서 데이터를 가져오겠지만,
            // 테스트를 위해 직접 불러오기도 가능합니다.
            if (this.game && this.game.cache && this.game.cache.json) {
                this.dataCache.classes = this.game.cache.json.get('classes');
            } else {
                // 테스트 목적의 방법 (브라우저 환경이 아닌 경우 등)
                // const fs = require('fs');
                // const classDataRaw = fs.readFileSync('./assets/data/classes.json', 'utf8');
                // this.dataCache.classes = JSON.parse(classDataRaw);
                console.warn('게임 캐시에 접근할 수 없음, 클래스 데이터를 로드할 수 없습니다');
            }
        } catch (error) {
            console.error('클래스 데이터 로드 오류:', error);
        }
    }
    
    /**
     * 기본 스탯 계산
     * @param {Object} classInfo - 클래스 정보
     * @param {number} level - 현재 레벨
     * @returns {Object} 계산된 기본 스탯
     */
    calculateBaseStats(classInfo, level) {
        if (!classInfo || !classInfo.baseStats || !classInfo.growthStats) {
            return {
                hp: 100,
                maxHp: 100,
                mp: 50,
                maxMp: 50,
                attack: 10,
                defense: 5,
                speed: 5
            };
        }
        
        // 레벨에 따른 스탯 계산
        const levelFactor = level - 1;
        
        return {
            hp: Math.floor(classInfo.baseStats.hp + classInfo.growthStats.hp * levelFactor),
            maxHp: Math.floor(classInfo.baseStats.hp + classInfo.growthStats.hp * levelFactor),
            mp: Math.floor(classInfo.baseStats.mp + classInfo.growthStats.mp * levelFactor),
            maxMp: Math.floor(classInfo.baseStats.mp + classInfo.growthStats.mp * levelFactor),
            attack: Math.floor(classInfo.baseStats.attack + classInfo.growthStats.attack * levelFactor),
            defense: Math.floor(classInfo.baseStats.defense + classInfo.growthStats.defense * levelFactor),
            speed: Math.floor(classInfo.baseStats.speed + classInfo.growthStats.speed * levelFactor)
        };
    }
    
    /**
     * 클래스 패시브 효과 적용
     * @param {string} classId - 클래스 ID
     * @param {Object} stats - 기본 스탯
     * @returns {Object} 패시브 적용된 스탯
     */
    applyClassPassives(classId, stats) {
        const classInfo = this.getClassData(classId);
        
        if (!classInfo || !classInfo.passiveEffect) {
            return stats;
        }
        
        // 복사된 스탯
        const newStats = { ...stats };
        
        // 패시브 효과 적용
        const effect = classInfo.passiveEffect;
        
        switch (effect.type) {
            case 'hp_increase':
                newStats.maxHp = Math.floor(newStats.maxHp * (1 + effect.value / 100));
                newStats.hp = newStats.maxHp;
                break;
            case 'mp_increase':
                newStats.maxMp = Math.floor(newStats.maxMp * (1 + effect.value / 100));
                newStats.mp = newStats.maxMp;
                break;
            case 'attack_increase':
                newStats.attack = Math.floor(newStats.attack * (1 + effect.value / 100));
                break;
            case 'defense_increase':
                newStats.defense = Math.floor(newStats.defense * (1 + effect.value / 100));
                break;
            case 'speed_increase':
                newStats.speed = Math.floor(newStats.speed * (1 + effect.value / 100));
                break;
        }
        
        return newStats;
    }
    
    /**
     * 장비 효과 적용
     * @param {Object} stats - 기본 스탯
     * @returns {Object} 장비 효과 적용된 스탯
     */
    applyEquipmentEffects(stats) {
        if (!this.gameData.equipment) {
            return stats;
        }
        
        // 복사된 스탯
        const newStats = { ...stats };
        
        // 장착된 모든 장비 효과 적용
        for (const slot in this.gameData.equipment) {
            const itemId = this.gameData.equipment[slot];
            if (!itemId) continue;
            
            // 인벤토리에서 아이템 찾기
            const item = this.findItemInInventory(this.gameData.inventory, itemId);
            if (!item) continue;
            
            // 아이템 기본 스탯 적용
            if (item.stats) {
                if (item.stats.damage) {
                    newStats.attack += item.stats.damage;
                }
                
                if (item.stats.defense) {
                    newStats.defense += item.stats.defense;
                }
                
                if (item.stats.hp) {
                    newStats.maxHp += item.stats.hp;
                }
                
                if (item.stats.mp) {
                    newStats.maxMp += item.stats.mp;
                }
                
                if (item.stats.speed) {
                    newStats.speed += item.stats.speed;
                }
            }
            
            // 아이템 속성 적용
            if (item.attributes) {
                for (const attr of item.attributes) {
                    switch (attr.type) {
                        case 'hp_bonus':
                            newStats.maxHp += attr.value;
                            break;
                        case 'mp_bonus':
                            newStats.maxMp += attr.value;
                            break;
                        case 'damage_bonus':
                        case 'attack_bonus':
                            newStats.attack += attr.value;
                            break;
                        case 'defense_bonus':
                            newStats.defense += attr.value;
                            break;
                        case 'speed_bonus':
                        case 'movement_speed':
                        case 'movement_speed_bonus':
                            newStats.speed += attr.value;
                            break;
                    }
                }
            }
        }
        
        return newStats;
    }
    
    /**
     * 마스터리 보너스 적용
     * @param {string} classId - 클래스 ID
     * @param {Object} stats - 기본 스탯
     * @returns {Object} 마스터리 적용된 스탯
     */
    applyMasteryBonuses(classId, stats) {
        if (!this.gameData.masteryBonuses || !this.gameData.masteryBonuses[classId]) {
            return stats;
        }
        
        // 복사된 스탯
        const newStats = { ...stats };
        
        // 클래스 마스터리 보너스 적용
        const masteryBonuses = this.gameData.masteryBonuses[classId];
        
        for (const tier in masteryBonuses) {
            const bonus = masteryBonuses[tier];
            
            switch (bonus.type) {
                case 'stat_increase':
                    // 모든 스탯 증가
                    const multiplier = 1 + (bonus.value / 100);
                    newStats.maxHp = Math.floor(newStats.maxHp * multiplier);
                    newStats.hp = newStats.maxHp;
                    newStats.maxMp = Math.floor(newStats.maxMp * multiplier);
                    newStats.mp = newStats.maxMp;
                    newStats.attack = Math.floor(newStats.attack * multiplier);
                    newStats.defense = Math.floor(newStats.defense * multiplier);
                    newStats.speed = Math.floor(newStats.speed * multiplier);
                    break;
                // 다른 마스터리 보너스 유형에 대한 케이스 추가
            }
        }
        
        return newStats;
    }
    
    /**
     * 아이템 획득
     * @param {Object} item - 획득할 아이템
     * @returns {boolean} 획득 성공 여부
     */
    addItemToInventory(item) {
        if (!item) return false;
        
        // 인벤토리가 없으면 생성
        if (!this.gameData.inventory) {
            this.gameData.inventory = [];
        }
        
        // 소비 아이템이고 이미 인벤토리에 있는 경우
        if (item.stackable) {
            const existingItem = this.gameData.inventory.find(i => 
                i.id === item.id && i.type === 'consumable');
            
            if (existingItem) {
                // 개수 증가
                existingItem.count = (existingItem.count || 1) + (item.count || 1);
                
                // 이벤트 발생
                this.events.emit('itemUpdated', existingItem);
                
                return true;
            }
        }
        
        // 인스턴스 ID가 없는 경우 생성
        if (!item.instanceId && ['weapon', 'armor', 'accessory'].includes(item.type)) {
            item.instanceId = 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        }
        
        // 인벤토리에 추가
        this.gameData.inventory.push(item);
        
        // 통계 업데이트
        if (this.gameData.statistics) {
            this.gameData.statistics.itemsCollected = 
                (this.gameData.statistics.itemsCollected || 0) + 1;
        }
        
        // 이벤트 발생
        this.events.emit('itemAdded', item);
        
        return true;
    }
    
    /**
     * 아이템 제거
     * @param {string} itemId - 제거할 아이템 ID 또는 인스턴스 ID
     * @param {number} count - 제거할 개수 (소비 아이템의 경우)
     * @returns {boolean} 제거 성공 여부
     */
    removeItemFromInventory(itemId, count = 1) {
        if (!itemId || !this.gameData.inventory) return false;
        
        // 아이템 인덱스 찾기
        const index = this.gameData.inventory.findIndex(item => 
            item.id === itemId || item.instanceId === itemId);
        
        if (index === -1) return false;
        
        const item = this.gameData.inventory[index];
        
        // 소비 아이템의 경우 개수 감소
        if (item.stackable && count < (item.count || 1)) {
            item.count -= count;
            
            // 이벤트 발생
            this.events.emit('itemUpdated', item);
            
            return true;
        }
        
        // 아이템 제거
        this.gameData.inventory.splice(index, 1);
        
        // 이벤트 발생
        this.events.emit('itemRemoved', item);
        
        return true;
    }
    
    /**
     * 아이템 장착
     * @param {string} itemId - 장착할 아이템 ID 또는 인스턴스 ID
     * @returns {boolean} 장착 성공 여부
     */
    equipItem(itemId) {
        if (!itemId || !this.gameData.inventory) return false;
        
        // 아이템 찾기
        const item = this.findItemInInventory(this.gameData.inventory, itemId);
        
        if (!item) return false;
        
        // 장착 가능한 아이템인지 확인
        if (!this.isEquippable(item)) {
            console.warn('장착 불가능한 아이템:', item.name);
            return false;
        }
        
        // 현재 클래스 확인
        const currentClassId = this.gameData.player.currentClass;
        
        // 클래스 제한 확인
        if (item.classRestriction && 
            !item.classRestriction.includes(currentClassId)) {
            console.warn('클래스 제한으로 장착 불가능:', item.name);
            return false;
        }
        
        // 레벨 요구사항 확인
        if (item.requiredLevel) {
            const playerLevel = this.getPlayerClassLevel(currentClassId);
            if (playerLevel < item.requiredLevel) {
                console.warn(`레벨 부족 (필요: ${item.requiredLevel}, 현재: ${playerLevel})`);
                return false;
            }
        }
        
        // 슬롯 결정
        let slot;
        switch (item.type) {
            case 'weapon':
                slot = 'weapon';
                break;
            case 'armor':
                slot = item.subType || 'chest';
                break;
            case 'accessory':
                slot = item.subType || 'accessory';
                break;
            default:
                return false;
        }
        
        // 기존 장비 해제
        const currentEquipment = this.gameData.equipment[slot];
        if (currentEquipment) {
            // 같은 아이템이면 무시
            if (currentEquipment === itemId) {
                return true;
            }
        }
        
        // 장비 장착
        if (!this.gameData.equipment) {
            this.gameData.equipment = {};
        }
        
        this.gameData.equipment[slot] = item.instanceId || item.id;
        
        // 플레이어 스탯 업데이트
        this.updatePlayerStats();
        
        // 이벤트 발생
        this.events.emit('itemEquipped', {
            item: item,
            slot: slot,
            previousItem: currentEquipment
        });
        
        return true;
    }
    
    /**
     * 플레이어 클래스 레벨 가져오기
     * @param {string} classId - 클래스 ID
     * @returns {number} 클래스 레벨
     */
    getPlayerClassLevel(classId) {
        if (!this.gameData.classes || !this.gameData.classes[classId]) {
            return 1;
        }
        
        return this.gameData.classes[classId].level || 1;
    }
    
    /**
     * 아이템 장착 가능 여부 확인
     * @param {Object} item - 확인할 아이템
     * @returns {boolean} 장착 가능 여부
     */
    isEquippable(item) {
        if (!item) return false;
        
        return ['weapon', 'armor', 'accessory'].includes(item.type);
    }
    
    /**
     * 아이템 사용
     * @param {string} itemId - 사용할 아이템 ID 또는 인스턴스 ID
     * @returns {Object} 사용 결과
     */
    useItem(itemId) {
        if (!itemId || !this.gameData.inventory) {
            return { success: false, message: '아이템을 찾을 수 없습니다.' };
        }
        
        // 아이템 찾기
        const item = this.findItemInInventory(this.gameData.inventory, itemId);
        
        if (!item) {
            return { success: false, message: '아이템을 찾을 수 없습니다.' };
        }
        
        // 소비 아이템인지 확인
        if (item.type !== 'consumable') {
            return { success: false, message: '사용 가능한 아이템이 아닙니다.' };
        }
        
        // 효과 적용
        const result = this.applyItemEffect(item);
        
        if (result.success) {
            // 아이템 소비
            this.removeItemFromInventory(itemId, 1);
        }
        
        return result;
    }
    
    /**
     * 아이템 효과 적용
     * @param {Object} item - 효과를 적용할 아이템
     * @returns {Object} 적용 결과
     */
    applyItemEffect(item) {
        if (!item || !item.effect) {
            return { success: false, message: '효과가 없는 아이템입니다.' };
        }
        
        const effect = item.effect;
        
        switch (effect.type) {
            case 'heal':
                return this.applyHealingEffect(effect.value);
            case 'restore_mana':
                return this.applyManaRestoreEffect(effect.value);
            case 'buff':
                return this.applyBuffEffect(effect);
            case 'teleport':
                return { success: true, message: '텔레포트 효과가 적용되었습니다.', effect: 'teleport' };
            case 'identify':
                return { success: true, message: '감정 효과가 적용되었습니다.', effect: 'identify' };
            default:
                return { success: false, message: '지원되지 않는 효과입니다.' };
        }
    }
    
    /**
     * 체력 회복 효과 적용
     * @param {number} amount - 회복량
     * @returns {Object} 적용 결과
     */
    applyHealingEffect(amount) {
        if (!this.gameData.player) {
            return { success: false, message: '플레이어 정보가 없습니다.' };
        }
        
        const currentHp = this.gameData.player.hp || 0;
        const maxHp = this.gameData.player.maxHp || 100;
        
        // 이미 최대 체력인 경우
        if (currentHp >= maxHp) {
            return { success: false, message: '이미 최대 체력입니다.' };
        }
        
        // 체력 회복
        const newHp = Math.min(currentHp + amount, maxHp);
        const healed = newHp - currentHp;
        
        this.gameData.player.hp = newHp;
        
        // 이벤트 발생
        this.events.emit('playerHealed', healed);
        
        return {
            success: true,
            message: `${healed}의 체력을 회복했습니다.`,
            effect: 'heal',
            amount: healed
        };
    }
    
    /**
     * 마나 회복 효과 적용
     * @param {number} amount - 회복량
     * @returns {Object} 적용 결과
     */
    applyManaRestoreEffect(amount) {
        if (!this.gameData.player) {
            return { success: false, message: '플레이어 정보가 없습니다.' };
        }
        
        const currentMp = this.gameData.player.mp || 0;
        const maxMp = this.gameData.player.maxMp || 50;
        
        // 이미 최대 마나인 경우
        if (currentMp >= maxMp) {
            return { success: false, message: '이미 최대 마나입니다.' };
        }
        
        // 마나 회복
        const newMp = Math.min(currentMp + amount, maxMp);
        const restored = newMp - currentMp;
        
        this.gameData.player.mp = newMp;
        
        // 이벤트 발생
        this.events.emit('playerManaRestored', restored);
        
        return {
            success: true,
            message: `${restored}의 마나를 회복했습니다.`,
            effect: 'mana_restore',
            amount: restored
        };
    }
    
    /**
     * 버프 효과 적용
     * @param {Object} effect - 버프 효과 정보
     * @returns {Object} 적용 결과
     */
    applyBuffEffect(effect) {
        if (!this.gameData.player) {
            return { success: false, message: '플레이어 정보가 없습니다.' };
        }
        
        // 현재 적용된 버프 확인
        if (!this.gameData.player.buffs) {
            this.gameData.player.buffs = [];
        }
        
        // 버프 정보 생성
        const buff = {
            type: effect.stat || effect.type,
            value: effect.value,
            duration: effect.duration || 30, // 기본 30초
            startTime: Date.now()
        };
        
        // 버프 추가
        this.gameData.player.buffs.push(buff);
        
        // 이벤트 발생
        this.events.emit('playerBuffApplied', buff);
        
        return {
            success: true,
            message: `${effect.stat || effect.type} 버프가 적용되었습니다.`,
            effect: 'buff',
            buff: buff
        };
    }
    
    /**
     * 스킬 포인트 할당
     * @param {string} classId - 클래스 ID
     * @param {string} skillId - 스킬 ID
     * @returns {boolean} 할당 성공 여부
     */
    allocateSkillPoint(classId, skillId) {
        if (!classId || !skillId || !this.gameData.classes) {
            return false;
        }
        
        // 클래스 확인
        const classData = this.gameData.classes[classId];
        if (!classData || !classData.unlocked) {
            return false;
        }
        
        // 스킬 포인트 확인
        if (!classData.skillPoints || classData.skillPoints <= 0) {
            return false;
        }
        
        // 스킬 정보 확인
        const classInfo = this.getClassData(classId);
        if (!classInfo || !classInfo.abilities) {
            return false;
        }
        
        const skillInfo = classInfo.abilities.find(ability => ability.id === skillId);
        if (!skillInfo) {
            return false;
        }
        
        // 스킬 레벨 확인
        if (!classData.skills) {
            classData.skills = {};
        }
        
        const currentLevel = classData.skills[skillId] || 0;
        const maxLevel = skillInfo.maxLevel || 5;
        
        // 최대 레벨 체크
        if (currentLevel >= maxLevel) {
            return false;
        }
        
        // 선행 스킬 요구사항 체크
        if (skillInfo.requiredSkills) {
            for (const [reqSkillId, reqLevel] of Object.entries(skillInfo.requiredSkills)) {
                if ((classData.skills[reqSkillId] || 0) < reqLevel) {
                    return false;
                }
            }
        }
        
        // 스킬 레벨 증가
        classData.skills[skillId] = currentLevel + 1;
        
        // 스킬 포인트 차감
        classData.skillPoints -= 1;
        
        // 이벤트 발생
        this.events.emit('skillPointAllocated', {
            classId: classId,
            skillId: skillId,
            newLevel: classData.skills[skillId],
            remainingPoints: classData.skillPoints
        });
        
        return true;
    }
    
    /**
     * 경험치 획득
     * @param {number} amount - 획득량
     * @returns {Object} 레벨업 정보
     */
    gainExperience(amount) {
        if (!this.gameData.player || !this.gameData.player.currentClass) {
            return { leveledUp: false, currentLevel: 1 };
        }
        
        const classId = this.gameData.player.currentClass;
        
        // 클래스 데이터가 없으면 생성
        if (!this.gameData.classes[classId]) {
            this.gameData.classes[classId] = {
                level: 1,
                experience: 0,
                unlocked: true,
                skillPoints: 0,
                skills: {}
            };
        }
        
        const classData = this.gameData.classes[classId];
        
        // 경험치 보너스 계산
        const expBonus = this.calculateExpBonus();
        const totalExp = Math.floor(amount * (1 + expBonus / 100));
        
        // 경험치 추가
        classData.experience = (classData.experience || 0) + totalExp;
        
        // 필요 경험치 계산 및 레벨업 확인
        let leveledUp = false;
        let initialLevel = classData.level;
        
        while (true) {
            const requiredExp = this.calculateRequiredExp(classData.level);
            
            // 레벨업 조건 충족
            if (classData.experience >= requiredExp) {
                // 최대 레벨 확인
                if (classData.level >= 30) {
                    classData.level = 30;
                    classData.experience = requiredExp;
                    break;
                }
                
                // 경험치 차감
                classData.experience -= requiredExp;
                
                // 레벨업
                classData.level += 1;
                leveledUp = true;
                
                // 스킬 포인트 추가
                let skillPointsGained = 1;
                if (classData.level > 20) {
                    skillPointsGained = 3;  // 21-30레벨: 레벨당 3포인트
                } else if (classData.level > 10) {
                    skillPointsGained = 2;  // 11-20레벨: 레벨당 2포인트
                }
                
                classData.skillPoints = (classData.skillPoints || 0) + skillPointsGained;
                
                // 마스터리 보너스 확인 (10, 20, 30레벨)
                if (classData.level === 10 || classData.level === 20 || classData.level === 30) {
                    this.unlockMasteryBonus(classId, classData.level);
                }
            } else {
                break;
            }
        }
        
        // 레벨업한 경우 플레이어 스탯 업데이트
        if (leveledUp) {
            this.updatePlayerStats();
            
            // 이벤트 발생
            this.events.emit('playerLeveledUp', {
                classId: classId,
                oldLevel: initialLevel,
                newLevel: classData.level
            });
        }
        
        // 경험치 획득 이벤트
        this.events.emit('experienceGained', {
            classId: classId,
            amount: totalExp,
            bonus: expBonus
        });
        
        return {
            leveledUp: leveledUp,
            currentLevel: classData.level
        };
    }
    
    /**
     * 경험치 보너스 계산
     * @returns {number} 경험치 보너스 (%)
     */
    calculateExpBonus() {
        let bonus = 0;
        
        // 마스터리 보너스
        if (this.gameData.masteryBonuses) {
            for (const classId in this.gameData.masteryBonuses) {
                for (const tier in this.gameData.masteryBonuses[classId]) {
                    const bonusData = this.gameData.masteryBonuses[classId][tier];
                    if (bonusData && bonusData.type === 'experience_bonus') {
                        bonus += bonusData.value;
                    }
                }
            }
        }
        
        // 장비 보너스
        if (this.gameData.equipment) {
            for (const slot in this.gameData.equipment) {
                const itemId = this.gameData.equipment[slot];
                if (itemId) {
                    const item = this.findItemInInventory(this.gameData.inventory, itemId);
                    if (item && item.attributes) {
                        for (const attr of item.attributes) {
                            if (attr.type === 'experience_bonus' || attr.type === 'exp_bonus') {
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
     * 레벨업에 필요한 경험치 계산
     * @param {number} level - 현재 레벨
     * @returns {number} 필요 경험치
     */
    calculateRequiredExp(level) {
        if (level >= 30) {
            return Infinity; // 최대 레벨
        }
        
        // 경험치 계산식 (기본값 설정)
        const expBase = 100;
        const expGrowth = 1.5;
        
        // 진행 설정에서 값 가져오기 (있는 경우)
        let base = expBase;
        let growth = expGrowth;
        
        if (this.dataCache.progression) {
            base = this.dataCache.progression.expBase || expBase;
            growth = this.dataCache.progression.expGrowth || expGrowth;
        }
        
        // 기본 경험치 공식: base * (growth^(level-1))
        return Math.floor(base * Math.pow(growth, level - 1));
    }
    
    /**
     * 클래스 마스터리 보너스 해금
     * @param {string} classId - 클래스 ID
     * @param {number} level - 레벨 (10, 20, 30)
     */
    unlockMasteryBonus(classId, level) {
        if (!classId || !level || ![10, 20, 30].includes(level)) {
            return;
        }
        
        // 마스터리 레벨
        const tier = level / 10; // 1, 2, 3
        
        // 마스터리 보너스 가져오기
        const masteryBonus = this.getMasteryBonus(classId, tier);
        
        // 마스터리 보너스 저장
        if (!this.gameData.masteryBonuses) {
            this.gameData.masteryBonuses = {};
        }
        
        if (!this.gameData.masteryBonuses[classId]) {
            this.gameData.masteryBonuses[classId] = {};
        }
        
        this.gameData.masteryBonuses[classId][tier] = masteryBonus;
        
        // 이벤트 발생
        this.events.emit('masteryUnlocked', {
            classId: classId,
            tier: tier,
            level: level,
            bonus: masteryBonus
        });
    }
    
    /**
     * 마스터리 보너스 정보 가져오기
     * @param {string} classId - 클래스 ID
     * @param {number} tier - 마스터리 티어 (1, 2, 3)
     * @returns {Object} 마스터리 보너스 정보
     */
    getMasteryBonus(classId, tier) {
        // 클래스 정보 가져오기
        const classInfo = this.getClassData(classId);
        
        // 진행 설정에서 기본 마스터리 보너스 가져오기
        let defaultBonuses = [
            { type: "stat_increase", value: 5, description: "모든 스탯 +5%" },
            { type: "stat_increase", value: 10, description: "모든 스탯 +10%" },
            { type: "stat_increase", value: 15, description: "모든 스탯 +15%" }
        ];
        
        if (this.dataCache.progression && this.dataCache.progression.masteryBonuses) {
            const masteryCfg = this.dataCache.progression.masteryBonuses;
            
            if (masteryCfg['level' + (tier * 10)]) {
                const cfg = masteryCfg['level' + (tier * 10)];
                defaultBonuses[tier - 1] = {
                    type: "stat_increase",
                    value: cfg.statBonus,
                    description: cfg.description
                };
            }
        }
        
        // 클래스 특정 마스터리가 있으면 사용
        if (classInfo && classInfo.masteryBonuses && classInfo.masteryBonuses.length >= tier) {
            return classInfo.masteryBonuses[tier - 1];
        }
        
        // 기본 마스터리 반환
        return defaultBonuses[tier - 1];
    }
    
    /**
     * 골드 획득
     * @param {number} amount - 획득량
     * @returns {number} 실제 획득량
     */
    gainGold(amount) {
        if (!this.gameData) {
            return 0;
        }
        
        // 골드 보너스 계산
        const goldBonus = this.calculateGoldBonus();
        const totalGold = Math.floor(amount * (1 + goldBonus / 100));
        
        // 골드 추가
        this.gameData.gold = (this.gameData.gold || 0) + totalGold;
        
        // 통계 업데이트
        if (this.gameData.statistics) {
            this.gameData.statistics.goldCollected = 
                (this.gameData.statistics.goldCollected || 0) + totalGold;
        }
        
        // 이벤트 발생
        this.events.emit('goldGained', {
            amount: totalGold,
            bonus: goldBonus,
            total: this.gameData.gold
        });
        
        return totalGold;
    }
    
    /**
     * 골드 보너스 계산
     * @returns {number} 골드 보너스 (%)
     */
    calculateGoldBonus() {
        let bonus = 0;
        
        // 클래스 레벨 보너스
        const classId = this.gameData.player.currentClass;
        const classLevel = this.getPlayerClassLevel(classId);
        
        // 레벨당 보너스 (설정에서 가져오기)
        let levelMultiplier = 0.2; // 기본값
        
        if (this.dataCache.progression) {
            levelMultiplier = this.dataCache.progression.goldLevelMultiplier || 0.2;
        }
        
        bonus += (classLevel - 1) * levelMultiplier * 100;
        
        // 마스터리 보너스
        if (this.gameData.masteryBonuses) {
            for (const classId in this.gameData.masteryBonuses) {
                for (const tier in this.gameData.masteryBonuses[classId]) {
                    const bonusData = this.gameData.masteryBonuses[classId][tier];
                    if (bonusData && bonusData.type === 'gold_find') {
                        bonus += bonusData.value;
                    }
                }
            }
        }
        
        // 장비 보너스
        if (this.gameData.equipment) {
            for (const slot in this.gameData.equipment) {
                const itemId = this.gameData.equipment[slot];
                if (itemId) {
                    const item = this.findItemInInventory(this.gameData.inventory, itemId);
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
     * 골드 사용
     * @param {number} amount - 사용량
     * @returns {boolean} 사용 성공 여부
     */
    spendGold(amount) {
        if (!this.gameData) {
            return false;
        }
        
        // 골드 부족 체크
        if ((this.gameData.gold || 0) < amount) {
            return false;
        }
        
        // 골드 차감
        this.gameData.gold -= amount;
        
        // 이벤트 발생
        this.events.emit('goldSpent', {
            amount: amount,
            remaining: this.gameData.gold
        });
        
        return true;
    }
    
    /**
     * 클래스 조합 시도
     * @param {string} class1Id - 첫 번째 클래스 ID
     * @param {string} class2Id - 두 번째 클래스 ID
     * @returns {Object} 조합 결과
     */
    attemptClassCombination(class1Id, class2Id) {
        // 클래스 확인
        if (!this.gameData.classes[class1Id] || !this.gameData.classes[class2Id]) {
            return {
                success: false,
                error: '클래스가 존재하지 않습니다.'
            };
        }
        
        // 클래스 해금 확인
        if (!this.gameData.classes[class1Id].unlocked || !this.gameData.classes[class2Id].unlocked) {
            return {
                success: false,
                error: '해금되지 않은 클래스입니다.'
            };
        }
        
        // 레벨 확인
        if (this.gameData.classes[class1Id].level < 10 || this.gameData.classes[class2Id].level < 10) {
            return {
                success: false,
                error: '두 클래스 모두 레벨 10 이상이어야 합니다.'
            };
        }
        
        // 조합 결과 클래스 확인
        const resultClassId = this.getClassCombinationResult(class1Id, class2Id);
        
        if (!resultClassId) {
            return {
                success: false,
                error: '유효한 클래스 조합이 아닙니다.'
            };
        }
        
        // 이미 해금된 클래스 확인
        if (this.gameData.classes[resultClassId] && this.gameData.classes[resultClassId].unlocked) {
            return {
                success: false,
                error: '이미 해금된 클래스입니다.'
            };
        }
        
        // 조합 티어 확인
        const resultTier = this.getClassTier(resultClassId);
        
        // 조합 비용 계산
        const combinationCost = this.getClassCombinationCost(resultTier);
        
        // 골드 확인
        if (this.gameData.gold < combinationCost) {
            return {
                success: false,
                error: `골드가 부족합니다. (필요: ${combinationCost}, 보유: ${this.gameData.gold})`
            };
        }
        
        // 성공 확률 계산
        const { chance, factors } = this.calculateCombinationChance(class1Id, class2Id);
        
        // 확률 롤
        const roll = Math.random() * 100;
        const success = roll <= chance;
        
        // 골드 차감
        this.spendGold(combinationCost);
        
        if (success) {
            // 클래스 해금
            this.unlockClass(resultClassId);
        }
        
        // 결과 반환
        return {
            success: success,
            resultClassId: resultClassId,
            chance: chance,
            roll: roll,
            factors: factors,
            cost: combinationCost
        };
    }
    
    /**
     * 클래스 조합 결과 가져오기
     * @param {string} class1Id - 첫 번째 클래스 ID
     * @param {string} class2Id - 두 번째 클래스 ID
     * @returns {string} 결과 클래스 ID
     */
    getClassCombinationResult(class1Id, class2Id) {
        // 캐시된 조합 맵 가져오기
        if (!this.combinationMap) {
            this.initClassCombinationMap();
        }
        
        // 조합 키 생성
        const key1 = `${class1Id}_${class2Id}`;
        const key2 = `${class2Id}_${class1Id}`;
        
        // 조합 맵에서 결과 가져오기
        return this.combinationMap[key1] || this.combinationMap[key2];
    }
    
    /**
     * 클래스 조합 맵 초기화
     */
    initClassCombinationMap() {
        this.combinationMap = {};
        
        // 클래스 정보가 없으면 로드
        if (!this.dataCache.classes) {
            this.loadClassData();
        }
        
        if (!this.dataCache.classes || !this.dataCache.classes.classes) {
            return;
        }
        
        // 클래스 목록에서 조합 정보 추출
        const classes = this.dataCache.classes.classes;
        
        for (const cls of classes) {
            if (cls.requiredClasses && cls.requiredClasses.length === 2) {
                const class1 = cls.requiredClasses[0];
                const class2 = cls.requiredClasses[1];
                
                // 양방향 맵핑
                this.combinationMap[`${class1}_${class2}`] = cls.id;
                this.combinationMap[`${class2}_${class1}`] = cls.id;
            }
        }
    }
    
    /**
     * 클래스 티어 가져오기
     * @param {string} classId - 클래스 ID
     * @returns {number} 클래스 티어 (1-4)
     */
    getClassTier(classId) {
        const classInfo = this.getClassData(classId);
        return (classInfo && classInfo.tier) || 1;
    }
    
    /**
     * 클래스 조합 비용 가져오기
     * @param {number} tier - 클래스 티어
     * @returns {number} 조합 비용
     */
    getClassCombinationCost(tier) {
        // 기본 비용
        const defaultCosts = {
            2: 1000,
            3: 5000,
            4: 20000
        };
        
        // 설정에서 비용 가져오기
        let costs = defaultCosts;
        
        if (this.dataCache.progression && 
            this.dataCache.progression.classCombination && 
            this.dataCache.progression.classCombination.costs) {
            costs = this.dataCache.progression.classCombination.costs;
        }
        
        return costs[tier] || defaultCosts[tier] || 1000;
    }
    
    /**
     * 클래스 조합 성공 확률 계산
     * @param {string} class1Id - 첫 번째 클래스 ID
     * @param {string} class2Id - 두 번째 클래스 ID
     * @returns {Object} 확률 정보 {chance, factors}
     */
    calculateCombinationChance(class1Id, class2Id) {
        // 결과 클래스와 티어 확인
        const resultClassId = this.getClassCombinationResult(class1Id, class2Id);
        const resultTier = this.getClassTier(resultClassId);
        
        // 기본 확률 설정
        let baseChance;
        
        // 설정에서 확률 가져오기
        if (this.dataCache.progression && this.dataCache.progression.classCombination) {
            const cfg = this.dataCache.progression.classCombination;
            
            switch (resultTier) {
                case 2:
                    baseChance = cfg.tier2BaseChance || 80;
                    break;
                case 3:
                    baseChance = cfg.tier3BaseChance || 50;
                    break;
                case 4:
                    baseChance = cfg.tier4BaseChance || 25;
                    break;
                default:
                    baseChance = 80;
            }
        } else {
            // 기본값
            switch (resultTier) {
                case 2:
                    baseChance = 80;
                    break;
                case 3:
                    baseChance = 50;
                    break;
                case 4:
                    baseChance = 25;
                    break;
                default:
                    baseChance = 80;
            }
        }
        
        // 성공 요소
        const factors = {
            base: baseChance,
            levelBonus: 0,
            goldenKeyBonus: 0,
            alchemistBonus: 0
        };
        
        // 레벨 보너스
        const class1Level = this.gameData.classes[class1Id].level;
        const class2Level = this.gameData.classes[class2Id].level;
        
        // 레벨 10 이상일 경우 추가 보너스 (레벨당 1%)
        if (class1Level > 10) {
            factors.levelBonus += (class1Level - 10);
        }
        
        if (class2Level > 10) {
            factors.levelBonus += (class2Level - 10);
        }
        
        // 황금 열쇠 보너스 (+20%)
        if (this.hasGoldenKey()) {
            factors.goldenKeyBonus = 20;
        }
        
        // 연금술사 보너스 (연금술사 클래스 레벨에 따라 +5~15%)
        const alchemistBonus = this.getAlchemistBonus();
        if (alchemistBonus > 0) {
            factors.alchemistBonus = alchemistBonus;
        }
        
        // 최종 확률 계산 (최대 95%)
        let finalChance = baseChance + 
                          factors.levelBonus + 
                          factors.goldenKeyBonus + 
                          factors.alchemistBonus;
        
        finalChance = Math.min(95, Math.max(5, finalChance));
        
        return {
            chance: finalChance,
            factors: factors
        };
    }
    
    /**
     * 황금 열쇠 보유 여부 확인
     * @returns {boolean} 황금 열쇠 보유 여부
     */
    hasGoldenKey() {
        if (!this.gameData.inventory) {
            return false;
        }
        
        return this.gameData.inventory.some(item => 
            item.id === 'golden_key' || 
            (item.type === 'legacy' && item.id.includes('golden_key')));
    }
    
    /**
     * 연금술사 보너스 계산
     * @returns {number} 연금술사 보너스 (%)
     */
    getAlchemistBonus() {
        if (!this.gameData.classes || !this.gameData.classes['alchemist']) {
            return 0;
        }
        
        const alchemistData = this.gameData.classes['alchemist'];
        
        // 해금되지 않은 경우
        if (!alchemistData.unlocked) {
            return 0;
        }
        
        // 레벨에 따른 보너스
        const level = alchemistData.level || 1;
        
        if (level > 20) {
            return 15;
        } else if (level > 10) {
            return 10;
        } else {
            return 5;
        }
    }
    
    /**
     * 클래스 해금
     * @param {string} classId - 해금할 클래스 ID
     * @returns {boolean} 해금 성공 여부
     */
    unlockClass(classId) {
        if (!classId) {
            return false;
        }
        
        // 클래스 정보 확인
        const classInfo = this.getClassData(classId);
        if (!classInfo) {
            console.warn(`클래스 정보 없음: ${classId}`);
            return false;
        }
        
        // 이미 해금된 경우
        if (this.gameData.classes[classId] && this.gameData.classes[classId].unlocked) {
            return true;
        }
        
        // 클래스 초기화
        this.gameData.classes[classId] = {
            level: 1,
            experience: 0,
            unlocked: true,
            skillPoints: 0,
            skills: {}
        };
        
        // 이벤트 발생
        this.events.emit('classUnlocked', {
            classId: classId,
            classInfo: classInfo
        });
        
        return true;
    }
    
    /**
     * 던전 완료 처리
     * @param {string} dungeonId - 던전 ID
     * @param {Object} stats - 던전 통계
     * @returns {Object} 보상 정보
     */
    completeDungeon(dungeonId, stats) {
        if (!dungeonId || !this.gameData) {
            return null;
        }
        
        // 던전 정보 가져오기
        const dungeonInfo = this.getDungeonInfo(dungeonId);
        
        // 완료 목록에 추가
        if (!this.gameData.completedDungeons) {
            this.gameData.completedDungeons = [];
        }
        
        // 첫 완료 여부 확인
        const firstCompletion = !this.gameData.completedDungeons.includes(dungeonId);
        
        // 완료 목록에 추가
        if (firstCompletion) {
            this.gameData.completedDungeons.push(dungeonId);
        }
        
        // 보상 계산
        const rewards = this.calculateDungeonRewards(dungeonId, stats, firstCompletion);
        
        // 경험치 획득
        const expResult = this.gainExperience(rewards.experience);
        
        // 골드 획득
        const goldGained = this.gainGold(rewards.gold);
        
        // 아이템 획득
        if (rewards.items && rewards.items.length > 0) {
            for (const item of rewards.items) {
                this.addItemToInventory(item);
            }
        }
        
        // 통계 업데이트
        if (this.gameData.statistics) {
            this.gameData.statistics.dungeonRuns = 
                (this.gameData.statistics.dungeonRuns || 0) + 1;
                
            if (stats) {
                this.gameData.statistics.monstersKilled = 
                    (this.gameData.statistics.monstersKilled || 0) + (stats.monstersKilled || 0);
                    
                if (stats.bossDefeated) {
                    this.gameData.statistics.bossesKilled = 
                        (this.gameData.statistics.bossesKilled || 0) + 1;
                }
            }
        }
        
        // 던전 해금 확인
        const newUnlocks = this.checkDungeonUnlocks();
        
        // 이벤트 발생
        this.events.emit('dungeonCompleted', {
            dungeonId: dungeonId,
            dungeonInfo: dungeonInfo,
            stats: stats,
            rewards: {
                experience: rewards.experience,
                gold: goldGained,
                items: rewards.items,
                leveledUp: expResult.leveledUp
            },
            firstCompletion: firstCompletion,
            newUnlocks: newUnlocks
        });
        
        // 게임 데이터 저장
        this.saveGameData();
        
        return {
            experience: rewards.experience,
            gold: goldGained,
            items: rewards.items,
            leveledUp: expResult.leveledUp,
            firstCompletion: firstCompletion,
            newUnlocks: newUnlocks
        };
    }
    
    /**
     * 던전 정보 가져오기
     * @param {string} dungeonId - 던전 ID
     * @returns {Object} 던전 정보
     */
    getDungeonInfo(dungeonId) {
        // 던전 데이터 로드
        if (!this.dataCache.dungeons) {
            this.loadDungeonData();
        }
        
        if (!this.dataCache.dungeons || !this.dataCache.dungeons.dungeons) {
            return null;
        }
        
        return this.dataCache.dungeons.dungeons.find(d => d.id === dungeonId);
    }
    
    /**
     * 던전 데이터 로드
     */
    loadDungeonData() {
        try {
            if (this.game && this.game.cache && this.game.cache.json) {
                this.dataCache.dungeons = this.game.cache.json.get('dungeons');
            } else {
                console.warn('게임 캐시에 접근할 수 없음, 던전 데이터를 로드할 수 없습니다');
            }
        } catch (error) {
            console.error('던전 데이터 로드 오류:', error);
        }
    }
    
    /**
     * 던전 보상 계산
     * @param {string} dungeonId - 던전 ID
     * @param {Object} stats - 던전 통계
     * @param {boolean} firstCompletion - 첫 완료 여부
     * @returns {Object} 보상 정보
     */
    calculateDungeonRewards(dungeonId, stats, firstCompletion) {
        const dungeonInfo = this.getDungeonInfo(dungeonId);
        
        // 기본 보상
        const baseRewards = {
            experience: 50,
            gold: 100,
            items: []
        };
        
        if (dungeonInfo) {
            // 난이도에 따른 기본 보상 조정
            const difficulty = dungeonInfo.difficulty ? dungeonInfo.difficulty.base : 1;
            
            baseRewards.experience = 50 * difficulty;
            baseRewards.gold = 100 * difficulty;
        }
        
        // 던전 통계에 따른 보상 조정
        let expMultiplier = 1.0;
        let goldMultiplier = 1.0;
        let itemQualityBonus = 0;
        
        if (stats) {
            // 몬스터 처치 보너스
            if (stats.monstersKilled) {
                expMultiplier += 0.01 * stats.monstersKilled;
                goldMultiplier += 0.01 * stats.monstersKilled;
            }
            
            // 보스 처치 보너스
            if (stats.bossDefeated) {
                expMultiplier += 0.5;
                goldMultiplier += 0.3;
                itemQualityBonus += 20;
            }
            
            // 탐험 보너스
            if (stats.roomsExplored) {
                expMultiplier += 0.02 * stats.roomsExplored;
                goldMultiplier += 0.03 * stats.roomsExplored;
            }
            
            // 챌린지 방 보너스
            if (stats.challengesCompleted) {
                expMultiplier += 0.1 * stats.challengesCompleted;
                goldMultiplier += 0.2 * stats.challengesCompleted;
                itemQualityBonus += 5 * stats.challengesCompleted;
            }
            
            // 시간 효율 보너스
            if (stats.timeElapsed) {
                const minutes = stats.timeElapsed / 60000;
                const timeFactor = Math.max(0, 1 - (minutes / 30)); // 30분 기준
                
                expMultiplier += 0.5 * timeFactor;
                goldMultiplier += 0.3 * timeFactor;
            }
            
            // 사망 패널티
            if (stats.deaths) {
                expMultiplier -= 0.1 * stats.deaths;
                goldMultiplier -= 0.1 * stats.deaths;
            }
        }
        
        // 첫 완료 보너스
        if (firstCompletion) {
            expMultiplier *= 2;
            goldMultiplier *= 1.5;
            itemQualityBonus += 10;
        }
        
        // 경험치와 골드 계산
        const expReward = Math.floor(baseRewards.experience * Math.max(0.5, expMultiplier));
        const goldReward = Math.floor(baseRewards.gold * Math.max(0.5, goldMultiplier));
        
        // 아이템 보상 생성
        const items = this.generateDungeonItemRewards(dungeonInfo, stats, itemQualityBonus);
        
        return {
            experience: expReward,
            gold: goldReward,
            items: items
        };
    }
    
    /**
     * 던전 아이템 보상 생성
     * @param {Object} dungeonInfo - 던전 정보
     * @param {Object} stats - 던전 통계
     * @param {number} qualityBonus - 품질 보너스
     * @returns {Array} 아이템 배열
     */
    generateDungeonItemRewards(dungeonInfo, stats, qualityBonus) {
        // 로드 시스템이 있으면 가져오기
        const lootSystem = this.game.scene.getScene('dungeonScene') ? 
            this.game.scene.getScene('dungeonScene').lootSystem : null;
            
        if (lootSystem) {
            const playerClassId = this.gameData.player.currentClass;
            const playerLevel = this.getPlayerClassLevel(playerClassId);
            
            // 로드 시스템에 위임
            return lootSystem.generateDungeonItems(dungeonInfo, stats, playerLevel);
        }
        
        // 로드 시스템이 없는 경우 간단한 아이템 생성
        const items = [];
        
        // 난이도에 따른 기본 아이템 수
        const baseItemCount = dungeonInfo && dungeonInfo.difficulty ? 
            Math.ceil(dungeonInfo.difficulty.base / 2) : 1;
            
        // 통계에 따른 추가 아이템
        let bonusItems = 0;
        
        if (stats) {
            if (stats.bossDefeated) {
                bonusItems += 1;
            }
            
            if (stats.challengesCompleted) {
                bonusItems += stats.challengesCompleted;
            }
        }
        
        // 최종 아이템 수
        const itemCount = baseItemCount + bonusItems;
        
        // 간단한 아이템 생성
        for (let i = 0; i < itemCount; i++) {
            // 랜덤 아이템 타입
            const types = ['weapon', 'armor', 'accessory', 'consumable'];
            const type = types[Math.floor(Math.random() * types.length)];
            
            // 랜덤 희귀도 (품질 보너스 고려)
            const rarityRoll = Math.random() * 100 - qualityBonus;
            let rarity;
            
            if (rarityRoll < 0) {
                rarity = 'legendary';
            } else if (rarityRoll < 5) {
                rarity = 'epic';
            } else if (rarityRoll < 20) {
                rarity = 'rare';
            } else if (rarityRoll < 50) {
                rarity = 'uncommon';
            } else {
                rarity = 'common';
            }
            
            // 기본 아이템 생성
            const item = {
                id: `reward_${type}_${Date.now()}_${i}`,
                instanceId: `reward_${type}_${Date.now()}_${i}`,
                type: type,
                name: `${rarity} ${type}`,
                rarity: rarity,
                level: dungeonInfo ? dungeonInfo.recommendedLevel : 1,
                stats: {}
            };
            
            // 타입별 추가 속성
            switch (type) {
                case 'weapon':
                    item.subType = ['sword', 'axe', 'bow', 'staff', 'dagger'][Math.floor(Math.random() * 5)];
                    item.stats.damage = 5 + (item.level * 2);
                    break;
                case 'armor':
                    item.subType = ['helmet', 'chest', 'gloves', 'boots'][Math.floor(Math.random() * 4)];
                    item.stats.defense = 3 + item.level;
                    break;
                case 'accessory':
                    item.subType = ['ring', 'amulet', 'belt'][Math.floor(Math.random() * 3)];
                    break;
                case 'consumable':
                    item.subType = 'potion';
                    item.stackable = true;
                    item.count = Math.floor(Math.random() * 3) + 1;
                    item.effect = {
                        type: 'heal',
                        value: 30 + (item.level * 5)
                    };
                    break;
            }
            
            // 희귀도에 따른 속성 추가
            if (['uncommon', 'rare', 'epic', 'legendary'].includes(rarity)) {
                item.attributes = [];
                
                const attrCount = {
                    'uncommon': 1,
                    'rare': 2,
                    'epic': 3,
                    'legendary': 4
                }[rarity];
                
                for (let j = 0; j < attrCount; j++) {
                    // 랜덤 속성
                    const attrTypes = ['hp_bonus', 'mp_bonus', 'attack_bonus', 'defense_bonus', 'speed_bonus'];
                    const attrType = attrTypes[Math.floor(Math.random() * attrTypes.length)];
                    
                    item.attributes.push({
                        type: attrType,
                        value: 5 + Math.floor(Math.random() * item.level * 2)
                    });
                }
            }
            
            items.push(item);
        }
        
        return items;
    }
    
    /**
     * 던전 해금 확인
     * @returns {Array} 새로 해금된 던전 ID 배열
     */
    checkDungeonUnlocks() {
        if (!this.dataCache.progression) {
            this.loadProgressionData();
        }
        
        const newUnlocks = [];
        
        // 진행 설정에서 던전 해금 요구사항 가져오기
        if (!this.dataCache.progression || 
            !this.dataCache.progression.dungeonProgression || 
            !this.dataCache.progression.dungeonProgression.unlockRequirements) {
            return newUnlocks;
        }
        
        const unlockRequirements = this.dataCache.progression.dungeonProgression.unlockRequirements;
        
        // 현재 해금된 던전 목록
        if (!this.gameData.unlockedDungeons) {
            this.gameData.unlockedDungeons = [];
        }
        
        // 모든 요구사항 확인
        for (const [dungeonId, requirements] of Object.entries(unlockRequirements)) {
            // 이미 해금된 던전은 무시
            if (this.gameData.unlockedDungeons.includes(dungeonId)) {
                continue;
            }
            
            // 요구사항 체크
            let meetsRequirements = true;
            
            // 레벨 요구사항
            if (requirements.requiredLevel) {
                const playerClassId = this.gameData.player.currentClass;
                const playerLevel = this.getPlayerClassLevel(playerClassId);
                
                if (playerLevel < requirements.requiredLevel) {
                    meetsRequirements = false;
                }
            }
            
            // 클래스 요구사항
            if (requirements.requiredClasses && requirements.requiredClasses.length > 0) {
                const hasRequiredClass = requirements.requiredClasses.some(classId => 
                    this.gameData.classes[classId] && this.gameData.classes[classId].unlocked);
                
                if (!hasRequiredClass) {
                    meetsRequirements = false;
                }
            }
            
            // 던전 완료 요구사항
            if (requirements.requiredDungeons && requirements.requiredDungeons.length > 0) {
                const completedAll = requirements.requiredDungeons.every(reqDungeon => 
                    this.gameData.completedDungeons.includes(reqDungeon));
                
                if (!completedAll) {
                    meetsRequirements = false;
                }
            }
            
            // 모든 요구사항을 충족하면 해금
            if (meetsRequirements) {
                this.gameData.unlockedDungeons.push(dungeonId);
                newUnlocks.push(dungeonId);
                
                // 이벤트 발생
                this.events.emit('dungeonUnlocked', {
                    dungeonId: dungeonId,
                    dungeonInfo: this.getDungeonInfo(dungeonId)
                });
            }
        }
        
        return newUnlocks;
    }
    
    /**
     * 진행 데이터 로드
     */
    loadProgressionData() {
        try {
            if (this.game && this.game.cache && this.game.cache.json) {
                this.dataCache.progression = this.game.cache.json.get('progression');
            } else {
                console.warn('게임 캐시에 접근할 수 없음, 진행 데이터를 로드할 수 없습니다');
            }
        } catch (error) {
            console.error('진행 데이터 로드 오류:', error);
        }
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
    
    /**
     * 정리 (게임 종료 시 호출)
     */
    dispose() {
        // 자동 저장 타이머 정리
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // 게임 데이터 저장
        this.saveGameData();
        
        // 이벤트 리스너 정리
        this.events.removeAllListeners();
    }
}

export default DataManager;