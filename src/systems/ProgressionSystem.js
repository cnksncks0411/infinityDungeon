// src/systems/ProgressionSystem.js

/**
 * 플레이어 진행, 레벨업, 클래스 해금 등을 관리하는 시스템
 * JSON 기반 데이터 관리
 */
class ProgressionSystem {
    /**
     * ProgressionSystem 생성자
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
        this.classData = this.scene.cache.json.get('classes');
        this.dungeonData = this.scene.cache.json.get('dungeons');
        this.progressionConfig = this.scene.cache.json.get('progression');
        
        // 설정 데이터
        this.config = this.progressionConfig || {
            // 기본값 설정
            expBase: 100,
            expGrowth: 1.5,
            classExpBonus: 0.1,
            goldBaseDrops: 10,
            goldLevelMultiplier: 0.2,
            
            // 클래스 조합 설정
            classCombination: {
                tier2BaseChance: 80,
                tier3BaseChance: 50,
                tier4BaseChance: 25,
                costs: {
                    2: 1000,
                    3: 5000,
                    4: 20000
                }
            }
        };
        
        // 클래스 조합 결과 맵 초기화
        this.initializeClassCombinations();
        
        // 던전 해금 요구사항 설정
        this.setupDungeonRequirements();
    }
    
    /**
     * 클래스 조합 결과 맵 초기화
     */
    initializeClassCombinations() {
        // JSON에서 클래스 조합 정보 로드
        this.classCombinations = {};
        this.tier3Combinations = {};
        this.tier4Combinations = {};
        
        // 클래스 데이터 확인
        if (!this.classData || !this.classData.classes) {
            console.warn('클래스 데이터가 로드되지 않았습니다');
            return;
        }
        
        // JSON에서 티어 2 클래스 조합 정보 추출
        const tier2Classes = this.classData.classes.filter(c => c.tier === 2);
        
        tier2Classes.forEach(classInfo => {
            if (classInfo.requiredClasses && classInfo.requiredClasses.length === 2) {
                const key = `${classInfo.requiredClasses[0]}_${classInfo.requiredClasses[1]}`;
                this.classCombinations[key] = classInfo.id;
                
                // 순서 반대인 경우도 추가
                const reverseKey = `${classInfo.requiredClasses[1]}_${classInfo.requiredClasses[0]}`;
                this.classCombinations[reverseKey] = classInfo.id;
            }
        });
        
        // JSON에서 티어 3 클래스 조합 정보 추출
        const tier3Classes = this.classData.classes.filter(c => c.tier === 3);
        
        tier3Classes.forEach(classInfo => {
            if (classInfo.requiredClasses && classInfo.requiredClasses.length === 2) {
                const key = `${classInfo.requiredClasses[0]}_${classInfo.requiredClasses[1]}`;
                this.tier3Combinations[key] = classInfo.id;
                
                // 순서 반대인 경우도 추가
                const reverseKey = `${classInfo.requiredClasses[1]}_${classInfo.requiredClasses[0]}`;
                this.tier3Combinations[reverseKey] = classInfo.id;
            }
        });
        
        // JSON에서 티어 4 클래스 조합 정보 추출
        const tier4Classes = this.classData.classes.filter(c => c.tier === 4);
        
        tier4Classes.forEach(classInfo => {
            if (classInfo.requiredClasses && classInfo.requiredClasses.length === 2) {
                const key = `${classInfo.requiredClasses[0]}_${classInfo.requiredClasses[1]}`;
                this.tier4Combinations[key] = classInfo.id;
                
                // 순서 반대인 경우도 추가
                const reverseKey = `${classInfo.requiredClasses[1]}_${classInfo.requiredClasses[0]}`;
                this.tier4Combinations[reverseKey] = classInfo.id;
            }
        });
    }
    
    /**
     * 던전 해금 요구사항 설정
     */
    setupDungeonRequirements() {
        this.dungeonRequirements = {};
        
        // 던전 데이터 확인
        if (!this.dungeonData || !this.dungeonData.dungeons) {
            console.warn('던전 데이터가 로드되지 않았습니다');
            return;
        }
        
        // 던전 별 해금 요구사항 설정
        this.dungeonData.dungeons.forEach(dungeon => {
            if (dungeon.unlockRequirements) {
                this.dungeonRequirements[dungeon.id] = dungeon.unlockRequirements;
            }
        });
    }
    
    /**
     * 경험치 획득 및 레벨업 처리
     * @param {number} exp - 획득한 경험치
     * @param {string} classId - 경험치를 얻을 클래스 ID
     * @returns {Object} 레벨업 정보 (leveledUp, newLevel)
     */
    gainExperience(exp, classId) {
        if (!classId || !this.game || !this.game.gameData) {
            return { leveledUp: false, newLevel: 0 };
        }
        
        // 게임 데이터에서 현재 클래스 정보 가져오기
        const playerClasses = this.game.gameData.classes || {};
        let classData = playerClasses[classId];
        
        // 클래스가 없으면 기본값으로 생성
        if (!classData) {
            classData = {
                level: 1,
                experience: 0,
                unlocked: true,
                skillPoints: 0
            };
            
            if (!playerClasses[classId]) {
                playerClasses[classId] = classData;
            }
        }
        
        // 현재 경험치와 레벨
        const currentExp = classData.experience || 0;
        const currentLevel = classData.level || 1;
        
        // 이미 최대 레벨인 경우
        const maxLevel = 30;
        if (currentLevel >= maxLevel) {
            return { leveledUp: false, newLevel: currentLevel };
        }
        
        // 경험치 추가
        classData.experience = currentExp + exp;
        
        // 레벨업 확인
        let leveledUp = false;
        while (classData.experience >= this.getRequiredExp(classData.level)) {
            // 최대 레벨 체크
            if (classData.level >= maxLevel) {
                classData.level = maxLevel;
                classData.experience = this.getRequiredExp(maxLevel);
                break;
            }
            
            // 레벨업
            classData.level++;
            leveledUp = true;
            
            // 스킬 포인트 지급
            let skillPointsGained = 1;
            if (classData.level > 20) {
                skillPointsGained = 3;  // 21-30레벨: 레벨당 3포인트
            } else if (classData.level > 10) {
                skillPointsGained = 2;  // 11-20레벨: 레벨당 2포인트
            }
            
            classData.skillPoints = (classData.skillPoints || 0) + skillPointsGained;
            
            // 레벨업 이벤트 발생
            this.events.emit('levelUp', {
                classId: classId,
                newLevel: classData.level,
                skillPointsGained: skillPointsGained
            });
            
            // 10, 20, 30레벨에서 마스터리 보너스 획득
            if (classData.level === 10 || classData.level === 20 || classData.level === 30) {
                this.unlockMasteryBonus(classId, classData.level);
            }
        }
        
        // 레벨업된 경우 데이터 갱신
        if (leveledUp) {
            this.checkDungeonUnlocks();
        }
        
        return {
            leveledUp: leveledUp,
            newLevel: classData.level
        };
    }
    
    /**
     * 특정 레벨에 필요한 경험치 계산
     * @param {number} level - 현재 레벨
     * @returns {number} 다음 레벨로 필요한 경험치
     */
    getRequiredExp(level) {
        if (level >= 30) {
            return Infinity; // 최대 레벨에 도달하면 무한대 경험치 필요
        }
        
        const expBase = this.config.expBase || 100;
        const expGrowth = this.config.expGrowth || 1.5;
        
        // 기본 경험치 공식: base * (growth^(level-1))
        return Math.floor(expBase * Math.pow(expGrowth, level - 1));
    }
    
    /**
     * 클래스의 마스터리 보너스 해금
     * @param {string} classId - 클래스 ID
     * @param {number} level - 현재 레벨 (10/20/30)
     */
    unlockMasteryBonus(classId, level) {
        if (!classId || !this.game || !this.game.gameData) {
            return;
        }
        
        const tierLevel = level / 10; // 1, 2, 3 중 하나
        const masteryBonus = this.getMasteryBonus(classId, tierLevel);
        
        // 기존 마스터리 목록에 추가
        if (!this.game.gameData.masteryBonuses) {
            this.game.gameData.masteryBonuses = {};
        }
        
        if (!this.game.gameData.masteryBonuses[classId]) {
            this.game.gameData.masteryBonuses[classId] = {};
        }
        
        this.game.gameData.masteryBonuses[classId][tierLevel] = masteryBonus;
        
        // 마스터리 해금 이벤트 발생
        this.events.emit('masteryUnlocked', {
            classId: classId,
            tier: tierLevel,
            bonus: masteryBonus
        });
    }
    
    /**
     * 클래스 및 티어별 마스터리 보너스 가져오기
     * @param {string} classId - 클래스 ID
     * @param {number} tier - 마스터리 티어 (1, 2, 3)
     * @returns {Object} 마스터리 보너스 정보
     */
    getMasteryBonus(classId, tier) {
        // 클래스 정보 가져오기
        const classInfo = this.findClassById(classId);
        
        // 클래스에 마스터리 정보가 있는 경우
        if (classInfo && classInfo.masteryBonuses && classInfo.masteryBonuses.length >= tier) {
            return classInfo.masteryBonuses[tier - 1]; // 티어는 1부터 시작하므로 -1
        }
        
        // 기본 보너스
        const defaultBonuses = [
            { type: "stat_increase", value: 5, description: "모든 스탯 +5%" },
            { type: "stat_increase", value: 10, description: "모든 스탯 +10%" },
            { type: "stat_increase", value: 15, description: "모든 스탯 +15%" }
        ];
        
        return defaultBonuses[tier - 1];
    }
    
    /**
     * 클래스 ID로 클래스 정보 찾기
     * @param {string} classId - 찾을 클래스 ID
     * @returns {Object} 클래스 정보 객체
     */
    findClassById(classId) {
        if (!this.classData || !this.classData.classes) {
            return null;
        }
        
        return this.classData.classes.find(c => c.id === classId);
    }
    
    /**
     * 골드 획득
     * @param {number} amount - 기본 획득량
     * @param {number} multiplier - 추가 배수 (선택적)
     * @returns {number} 최종 획득한 골드량
     */
    gainGold(amount, multiplier = 1) {
        if (!this.game || !this.game.gameData) {
            return 0;
        }
        
        // 현재 클래스 레벨 기반 추가 보너스
        const classLevel = this.getCurrentClassLevel();
        const goldLevelMultiplier = this.config.goldLevelMultiplier || 0.2;
        const levelBonus = 1 + (classLevel - 1) * goldLevelMultiplier;
        
        // 골드 찾기 보너스 (마스터리 등에서 얻은)
        const goldFindBonus = this.getGoldFindBonus();
        
        // 최종 골드 계산
        const finalGold = Math.floor(amount * multiplier * levelBonus * (1 + goldFindBonus / 100));
        
        // 골드 추가
        this.game.gameData.gold = (this.game.gameData.gold || 0) + finalGold;
        
        // 골드 획득 이벤트 발생
        this.events.emit('goldGained', {
            amount: finalGold,
            total: this.game.gameData.gold
        });
        
        return finalGold;
    }
    
    /**
     * 현재 선택된 클래스의 레벨 가져오기
     * @returns {number} 현재 클래스 레벨
     */
    getCurrentClassLevel() {
        if (!this.game || !this.game.gameData || !this.game.gameData.currentClass) {
            return 1;
        }
        
        const currentClassId = this.game.gameData.currentClass;
        const classData = this.game.gameData.classes && this.game.gameData.classes[currentClassId];
        
        return (classData && classData.level) || 1;
    }
    
    /**
     * 골드 찾기 보너스 계산 (마스터리, 아이템 등에서 온 보너스)
     * @returns {number} 골드 찾기 보너스 (%)
     */
    getGoldFindBonus() {
        if (!this.game || !this.game.gameData) {
            return 0;
        }
        
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
     * 장착된 아이템 정보 찾기
     * @param {string} itemId - 아이템 ID
     * @returns {Object} 아이템 정보
     */
    findEquippedItem(itemId) {
        if (!this.game || !this.game.gameData || !this.game.gameData.inventory) {
            return null;
        }
        
        return this.game.gameData.inventory.find(item => item.id === itemId);
    }
    
    /**
     * 던전 완료 처리
     * @param {string} dungeonId - 완료한 던전 ID
     * @param {Object} stats - 던전 통계 (시간, 처치 수 등)
     * @returns {Object} 보상 정보
     */
    completeDungeon(dungeonId, stats) {
        if (!this.game || !this.game.gameData) {
            return { exp: 0, gold: 0 };
        }
        
        // 던전 완료 추가
        if (!this.game.gameData.completedDungeons) {
            this.game.gameData.completedDungeons = [];
        }
        
        // 이미 완료했는지 확인
        const alreadyCompleted = this.game.gameData.completedDungeons.includes(dungeonId);
        
        // 완료 목록에 추가
        if (!alreadyCompleted) {
            this.game.gameData.completedDungeons.push(dungeonId);
        }
        
        // 현재 클래스 정보
        const currentClassId = this.game.gameData.currentClass;
        
        // 보상 계산
        const baseExp = this.calculateDungeonExp(dungeonId, stats);
        const baseGold = this.calculateDungeonGold(dungeonId, stats);
        
        // 첫 완료 보너스 (경험치 2배, 골드 1.5배)
        const expMultiplier = alreadyCompleted ? 1 : 2;
        const goldMultiplier = alreadyCompleted ? 1 : 1.5;
        
        // 경험치 획득
        const expResult = this.gainExperience(baseExp * expMultiplier, currentClassId);
        
        // 골드 획득
        const goldGained = this.gainGold(baseGold, goldMultiplier);
        
        // 새 던전 해금 확인
        const newUnlocks = this.checkDungeonUnlocks();
        
        // 던전 완료 이벤트 발생
        this.events.emit('dungeonCompleted', {
            dungeonId: dungeonId,
            stats: stats,
            rewards: {
                exp: baseExp * expMultiplier,
                gold: goldGained,
                leveledUp: expResult.leveledUp,
                newLevel: expResult.newLevel
            },
            firstCompletion: !alreadyCompleted,
            newUnlocks: newUnlocks
        });
        
        return {
            exp: baseExp * expMultiplier,
            gold: goldGained,
            leveledUp: expResult.leveledUp,
            newLevel: expResult.newLevel,
            firstCompletion: !alreadyCompleted,
            newUnlocks: newUnlocks
        };
    }
    
    /**
     * 던전 기반 경험치 보상 계산
     * @param {string} dungeonId - 던전 ID
     * @param {Object} stats - 던전 통계
     * @returns {number} 기본 경험치 보상
     */
    calculateDungeonExp(dungeonId, stats) {
        // 던전 정보 가져오기
        const dungeonInfo = this.findDungeonById(dungeonId);
        const difficulty = dungeonInfo ? dungeonInfo.difficulty.base : 1;
        
        // 기본 경험치 계산
        let baseExp = 100 * difficulty;
        
        // 추가 경험치 (몬스터 처치, 방 탐색 등에 따라)
        if (stats) {
            baseExp += (stats.monstersKilled || 0) * 5;
            baseExp += (stats.roomsExplored || 0) * 10;
            
            // 보스 처치 보너스
            if (stats.bossDefeated) {
                baseExp += 100 * difficulty;
            }
            
            // 시간 기반 보너스 (빠를수록 더 많은 보너스)
            if (stats.timeElapsed) {
                const minutes = stats.timeElapsed / 60000;
                const timeFactor = Math.max(0, 1 - (minutes / 30)); // 30분 기준
                baseExp += Math.floor(baseExp * timeFactor * 0.5); // 최대 50% 보너스
            }
        }
        
        return Math.floor(baseExp);
    }
    
    /**
     * 던전 기반 골드 보상 계산
     * @param {string} dungeonId - 던전 ID
     * @param {Object} stats - 던전 통계
     * @returns {number} 기본 골드 보상
     */
    calculateDungeonGold(dungeonId, stats) {
        // 던전 정보 가져오기
        const dungeonInfo = this.findDungeonById(dungeonId);
        const difficulty = dungeonInfo ? dungeonInfo.difficulty.base : 1;
        
        // 기본 골드 계산
        const goldBaseDrops = this.config.goldBaseDrops || 10;
        let baseGold = goldBaseDrops * difficulty * 5;
        
        // 추가 골드 (몬스터 처치, 방 탐색 등에 따라)
        if (stats) {
            baseGold += (stats.monstersKilled || 0) * 2 * difficulty;
            baseGold += (stats.roomsExplored || 0) * 5 * difficulty;
            
            // 보스 처치 보너스
            if (stats.bossDefeated) {
                baseGold += 50 * difficulty;
            }
            
            // 챌린지 룸 완료 보너스
            if (stats.challengesCompleted) {
                baseGold += 30 * stats.challengesCompleted * difficulty;
            }
            
            // 보물 방 보너스
            if (stats.treasureRoomsFound) {
                baseGold += 40 * stats.treasureRoomsFound * difficulty;
            }
        }
        
        return Math.floor(baseGold);
    }
    
    /**
     * 던전 ID로 던전 정보 찾기
     * @param {string} dungeonId - 찾을 던전 ID
     * @returns {Object} 던전 정보 객체
     */
    findDungeonById(dungeonId) {
        if (!this.dungeonData || !this.dungeonData.dungeons) {
            return null;
        }
        
        return this.dungeonData.dungeons.find(d => d.id === dungeonId);
    }
    
    /**
     * 새로운 던전 해금 확인
     * @returns {Array} 새로 해금된 던전 ID 배열
     */
    checkDungeonUnlocks() {
        if (!this.game || !this.game.gameData) {
            return [];
        }
        
        // 기본 데이터 준비
        const completedDungeons = this.game.gameData.completedDungeons || [];
        const unlockedDungeons = this.game.gameData.unlockedDungeons || [];
        const playerClasses = this.game.gameData.classes || {};
        
        // 해금 가능한 던전 확인
        const newlyUnlocked = [];
        
        for (const [dungeonId, requirements] of Object.entries(this.dungeonRequirements)) {
            // 이미 해금된 던전은 건너뛰기
            if (unlockedDungeons.includes(dungeonId)) {
                continue;
            }
            
            // 요구사항 체크
            let levelOk = true;
            let classesOk = true;
            let dungeonsOk = true;
            
            // 레벨 체크
            if (requirements.requiredLevel) {
                const currentLevel = this.getCurrentClassLevel();
                levelOk = currentLevel >= requirements.requiredLevel;
            }
            
            // 클래스 체크
            if (requirements.requiredClasses && requirements.requiredClasses.length > 0) {
                for (const classId of requirements.requiredClasses) {
                    if (!playerClasses[classId] || !playerClasses[classId].unlocked) {
                        classesOk = false;
                        break;
                    }
                }
            }
            
            // 던전 완료 체크
            if (requirements.requiredDungeons && requirements.requiredDungeons.length > 0) {
                for (const reqDungeonId of requirements.requiredDungeons) {
                    if (!completedDungeons.includes(reqDungeonId)) {
                        dungeonsOk = false;
                        break;
                    }
                }
            }
            
            // 모든 요구사항 충족 시 해금
            if (levelOk && classesOk && dungeonsOk) {
                // 새로 해금된 던전 목록에 추가
                newlyUnlocked.push(dungeonId);
                
                // 게임 데이터에 추가
                if (!this.game.gameData.unlockedDungeons) {
                    this.game.gameData.unlockedDungeons = [];
                }
                
                if (!this.game.gameData.unlockedDungeons.includes(dungeonId)) {
                    this.game.gameData.unlockedDungeons.push(dungeonId);
                    
                    // 던전 해금 이벤트 발생
                    this.events.emit('dungeonUnlocked', {
                        dungeonId: dungeonId,
                        dungeonInfo: this.findDungeonById(dungeonId)
                    });
                }
            }
        }
        
        return newlyUnlocked;
    }
    
    /**
     * 클래스 해금
     * @param {string} classId - 해금할 클래스 ID
     * @returns {boolean} 해금 성공 여부
     */
    unlockClass(classId) {
        if (!this.game || !this.game.gameData) {
            return false;
        }
        
        // 클래스 정보 확인
        const classInfo = this.findClassById(classId);
        if (!classInfo) {
            console.warn(`클래스 정보를 찾을 수 없음: ${classId}`);
            return false;
        }
        
        // 이미 해금되었는지 확인
        if (this.isClassUnlocked(classId)) {
            return true;
        }
        
        // 클래스 해금
        if (!this.game.gameData.classes) {
            this.game.gameData.classes = {};
        }
        
        // 클래스 추가
        this.game.gameData.classes[classId] = {
            level: 1,
            experience: 0,
            unlocked: true,
            skillPoints: 0
        };
        
        // 클래스 해금 이벤트 발생
        this.events.emit('classUnlocked', {
            classId: classId,
            classInfo: classInfo
        });
        
        // 새 던전 해금 확인
        this.checkDungeonUnlocks();
        
        return true;
    }
    
    /**
     * 클래스 해금 여부 확인
     * @param {string} classId - 확인할 클래스 ID
     * @returns {boolean} 해금 여부
     */
    isClassUnlocked(classId) {
        if (!this.game || !this.game.gameData || !this.game.gameData.classes) {
            return false;
        }
        
        return !!(this.game.gameData.classes[classId] && this.game.gameData.classes[classId].unlocked);
    }
    
    /**
     * 클래스 조합 시도
     * @param {string} class1Id - 첫 번째 클래스 ID
     * @param {string} class2Id - 두 번째 클래스 ID
     * @returns {Object} 조합 결과 {success, resultClassId, chance}
     */
    attemptClassCombination(class1Id, class2Id) {
        if (!this.game || !this.game.gameData) {
            return { success: false, resultClassId: null, chance: 0 };
        }
        
        // 요구사항 확인
        const validationResult = this.validateClassCombination(class1Id, class2Id);
        if (!validationResult.valid) {
            return { 
                success: false, 
                resultClassId: null, 
                chance: 0, 
                error: validationResult.error 
            };
        }
        
        // 결과 클래스 ID 가져오기
        const resultClassId = this.getClassCombinationResult(class1Id, class2Id);
        if (!resultClassId) {
            return {
                success: false,
                resultClassId: null,
                chance: 0,
                error: "조합 결과를 찾을 수 없습니다"
            };
        }
        
        // 조합 티어 확인
        const resultTier = this.getClassTier(resultClassId);
        
        // 골드 차감
        const combinationCost = this.getClassCombinationCost(resultTier);
        this.game.gameData.gold -= combinationCost;
        
        // 성공 확률 계산
        const { chance, successFactors } = this.calculateCombinationChance(class1Id, class2Id);
        
        // 성공 여부 결정
        const roll = Math.random() * 100;
        const success = roll <= chance;
        
        // 성공한 경우 클래스 해금
        if (success) {
            this.unlockClass(resultClassId);
        }
        
        // 조합 결과 이벤트 발생
        this.events.emit('classCombination', {
            class1Id: class1Id,
            class2Id: class2Id,
            resultClassId: resultClassId,
            success: success,
            chance: chance,
            cost: combinationCost,
            factors: successFactors
        });
        
        return {
            success: success,
            resultClassId: resultClassId,
            chance: chance,
            cost: combinationCost,
            factors: successFactors
        };
    }
    
    /**
     * 클래스 조합 유효성 검사
     * @param {string} class1Id - 첫 번째 클래스 ID
     * @param {string} class2Id - 두 번째 클래스 ID
     * @returns {Object} 검사 결과 {valid, error}
     */
    validateClassCombination(class1Id, class2Id) {
        if (!this.game || !this.game.gameData) {
            return { valid: false, error: "게임 데이터가 없습니다" };
        }
        
        // 클래스 존재 확인
        const class1Data = this.game.gameData.classes && this.game.gameData.classes[class1Id];
        const class2Data = this.game.gameData.classes && this.game.gameData.classes[class2Id];
        
        if (!class1Data || !class1Data.unlocked) {
            return { valid: false, error: "첫 번째 클래스가 없거나 해금되지 않았습니다" };
        }
        
        if (!class2Data || !class2Data.unlocked) {
            return { valid: false, error: "두 번째 클래스가 없거나 해금되지 않았습니다" };
        }
        
        // 클래스 레벨 확인 (최소 레벨 10 필요)
        if (class1Data.level < 10) {
            return { valid: false, error: "첫 번째 클래스 레벨이 10 미만입니다" };
        }
        
        if (class2Data.level < 10) {
            return { valid: false, error: "두 번째 클래스 레벨이 10 미만입니다" };
        }
        
        // 결과 클래스 확인
        const resultClassId = this.getClassCombinationResult(class1Id, class2Id);
        if (!resultClassId) {
            return { valid: false, error: "유효한 클래스 조합이 아닙니다" };
        }
        
        // 이미 해금된 클래스 확인
        if (this.isClassUnlocked(resultClassId)) {
            return { valid: false, error: "이미 해금된 클래스입니다" };
        }
        
        // 조합 티어 확인
        const resultTier = this.getClassTier(resultClassId);
        
        // 골드 충분 확인
        const combinationCost = this.getClassCombinationCost(resultTier);
        if (this.game.gameData.gold < combinationCost) {
            return { valid: false, error: `골드가 부족합니다 (필요: ${combinationCost})` };
        }
        
        return { valid: true };
    }
    
    /**
     * 클래스 조합 결과 가져오기
     * @param {string} class1Id - 첫 번째 클래스 ID
     * @param {string} class2Id - 두 번째 클래스 ID
     * @returns {string} 결과 클래스 ID
     */
    getClassCombinationResult(class1Id, class2Id) {
        // 클래스 티어 확인
        const class1Tier = this.getClassTier(class1Id);
        const class2Tier = this.getClassTier(class2Id);
        
        // 조합 키 생성
        const combinationKey = `${class1Id}_${class2Id}`;
        const reverseCombinationKey = `${class2Id}_${class1Id}`;
        
        // 티어에 따른 조합 결과 확인
        if (class1Tier === 1 && class2Tier === 1) {
            // 티어 1 + 티어 1 = 티어 2
            return this.classCombinations[combinationKey] || this.classCombinations[reverseCombinationKey];
        } else if ((class1Tier === 2 && class2Tier === 2)) {
            // 티어 2 + 티어 2 = 티어 3
            return this.tier3Combinations[combinationKey] || this.tier3Combinations[reverseCombinationKey];
        } else if ((class1Tier === 3 && class2Tier === 3)) {
            // 티어 3 + 티어 3 = 티어 4
            return this.tier4Combinations[combinationKey] || this.tier4Combinations[reverseCombinationKey];
        }
        
        return null;
    }
    
    /**
     * 클래스 티어 가져오기
     * @param {string} classId - 클래스 ID
     * @returns {number} 클래스 티어 (1-4)
     */
    getClassTier(classId) {
        const classInfo = this.findClassById(classId);
        return (classInfo && classInfo.tier) || 1;
    }
    
    /**
     * 클래스 조합 비용 가져오기
     * @param {number} tier - 결과 클래스 티어
     * @returns {number} 조합 비용 (골드)
     */
    getClassCombinationCost(tier) {
        const costs = this.config.classCombination.costs || {
            2: 1000,
            3: 5000,
            4: 20000
        };
        
        return costs[tier] || 1000;
    }
    
    /**
     * 클래스 조합 성공 확률 계산
     * @param {string} class1Id - 첫 번째 클래스 ID
     * @param {string} class2Id - 두 번째 클래스 ID
     * @returns {Object} 확률 정보 {chance, successFactors}
     */
    calculateCombinationChance(class1Id, class2Id) {
        // 기본 성공 확률 설정
        const resultClassId = this.getClassCombinationResult(class1Id, class2Id);
        const resultTier = this.getClassTier(resultClassId);
        
        let baseChance;
        switch (resultTier) {
            case 2:
                baseChance = this.config.classCombination.tier2BaseChance || 80;
                break;
            case 3:
                baseChance = this.config.classCombination.tier3BaseChance || 50;
                break;
            case 4:
                baseChance = this.config.classCombination.tier4BaseChance || 25;
                break;
            default:
                baseChance = 80;
        }
        
        // 성공률 보정 요소
        const successFactors = {
            base: baseChance,
            levelBonus: 0,
            goldenKeyBonus: 0,
            alchemistBonus: 0
        };
        
        // 클래스 레벨 보너스 (최소 레벨 이상이면 레벨당 +1%)
        const class1Data = this.game.gameData.classes[class1Id];
        const class2Data = this.game.gameData.classes[class2Id];
        
        const minLevel = 10;
        
        if (class1Data.level > minLevel) {
            successFactors.levelBonus += (class1Data.level - minLevel);
        }
        
        if (class2Data.level > minLevel) {
            successFactors.levelBonus += (class2Data.level - minLevel);
        }
        
        // 황금 열쇠 보너스 (보유 시 +20%)
        const hasGoldenKey = this.checkForGoldenKey();
        if (hasGoldenKey) {
            successFactors.goldenKeyBonus = 20;
        }
        
        // 연금술사 보너스 (해금 시 +5~15%)
        const alchemistBonus = this.getAlchemistBonus();
        if (alchemistBonus > 0) {
            successFactors.alchemistBonus = alchemistBonus;
        }
        
        // 최종 성공 확률 계산 (최대 95%)
        let finalChance = baseChance + 
                          successFactors.levelBonus + 
                          successFactors.goldenKeyBonus + 
                          successFactors.alchemistBonus;
        
        finalChance = Math.min(95, finalChance);
        
        return {
            chance: finalChance,
            successFactors: successFactors
        };
    }
    
    /**
     * 황금 열쇠 보유 확인
     * @returns {boolean} 보유 여부
     */
    checkForGoldenKey() {
        if (!this.game || !this.game.gameData || !this.game.gameData.inventory) {
            return false;
        }
        
        return this.game.gameData.inventory.some(item => 
            item.id === 'golden_key' || 
            (item.type === 'special' && item.subType === 'key' && item.rarity === 'legendary')
        );
    }
    
    /**
     * 연금술사 보너스 계산
     * @returns {number} 연금술사 보너스 (%)
     */
    getAlchemistBonus() {
        if (!this.game || !this.game.gameData || !this.game.gameData.classes) {
            return 0;
        }
        
        // 연금술사 클래스 해금 확인
        const alchemistData = this.game.gameData.classes['alchemist'];
        if (!alchemistData || !alchemistData.unlocked) {
            return 0;
        }
        
        // 레벨에 따른 보너스 계산
        const alchemistLevel = alchemistData.level || 1;
        
        // 레벨 1-10: 5%, 11-20: 10%, 21-30: 15%
        if (alchemistLevel > 20) {
            return 15;
        } else if (alchemistLevel > 10) {
            return 10;
        } else {
            return 5;
        }
    }
    
    /**
     * 경험치 획득률 보너스 계산
     * @returns {number} 경험치 보너스 (%)
     */
    getExpBonus() {
        if (!this.game || !this.game.gameData) {
            return 0;
        }
        
        let bonus = 0;
        
        // 마스터리 보너스 체크
        const masteryBonuses = this.game.gameData.masteryBonuses || {};
        for (const classId in masteryBonuses) {
            for (const tier in masteryBonuses[classId]) {
                const bonusData = masteryBonuses[classId][tier];
                if (bonusData && bonusData.type === 'experience_bonus') {
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
                            if (attr.type === 'experience_bonus') {
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
     * 현재 해금 가능한 클래스 목록 가져오기
     * @returns {Array} 해금 가능한 클래스 ID 배열
     */
    getUnlockableClasses() {
        if (!this.game || !this.game.gameData || !this.game.gameData.classes) {
            return [];
        }
        
        const unlockedClasses = Object.keys(this.game.gameData.classes)
            .filter(classId => this.game.gameData.classes[classId].unlocked);
        
        // 해금 가능한 조합 목록 수집
        const unlockableClasses = new Set();
        
        // 티어 1+1 조합
        for (let i = 0; i < unlockedClasses.length; i++) {
            const class1 = unlockedClasses[i];
            if (this.getClassTier(class1) !== 1) continue;
            
            for (let j = i; j < unlockedClasses.length; j++) {
                const class2 = unlockedClasses[j];
                if (this.getClassTier(class2) !== 1) continue;
                
                const resultClass = this.getClassCombinationResult(class1, class2);
                if (resultClass && !this.isClassUnlocked(resultClass)) {
                    unlockableClasses.add(resultClass);
                }
            }
        }
        
        // 티어 2+2 조합
        for (let i = 0; i < unlockedClasses.length; i++) {
            const class1 = unlockedClasses[i];
            if (this.getClassTier(class1) !== 2) continue;
            
            for (let j = i; j < unlockedClasses.length; j++) {
                const class2 = unlockedClasses[j];
                if (this.getClassTier(class2) !== 2) continue;
                
                const resultClass = this.getClassCombinationResult(class1, class2);
                if (resultClass && !this.isClassUnlocked(resultClass)) {
                    unlockableClasses.add(resultClass);
                }
            }
        }
        
        // 티어 3+3 조합
        for (let i = 0; i < unlockedClasses.length; i++) {
            const class1 = unlockedClasses[i];
            if (this.getClassTier(class1) !== 3) continue;
            
            for (let j = i; j < unlockedClasses.length; j++) {
                const class2 = unlockedClasses[j];
                if (this.getClassTier(class2) !== 3) continue;
                
                const resultClass = this.getClassCombinationResult(class1, class2);
                if (resultClass && !this.isClassUnlocked(resultClass)) {
                    unlockableClasses.add(resultClass);
                }
            }
        }
        
        return Array.from(unlockableClasses).map(classId => {
            const classInfo = this.findClassById(classId);
            return {
                id: classId,
                name: classInfo ? classInfo.name : classId,
                tier: this.getClassTier(classId),
                description: classInfo ? classInfo.description : ""
            };
        });
    }
    
    /**
     * 특정 클래스의 가능한 조합 경로 가져오기
     * @param {string} targetClassId - 목표 클래스 ID
     * @returns {Array} 조합 경로 배열 [{class1, class2, result}]
     */
    getClassCombinationPaths(targetClassId) {
        const classInfo = this.findClassById(targetClassId);
        
        if (!classInfo || !classInfo.requiredClasses || classInfo.requiredClasses.length !== 2) {
            return [];
        }
        
        const class1Id = classInfo.requiredClasses[0];
        const class2Id = classInfo.requiredClasses[1];
        
        const paths = [{
            class1: {
                id: class1Id,
                name: this.findClassById(class1Id)?.name || class1Id,
                tier: this.getClassTier(class1Id)
            },
            class2: {
                id: class2Id,
                name: this.findClassById(class2Id)?.name || class2Id,
                tier: this.getClassTier(class2Id)
            },
            result: {
                id: targetClassId,
                name: classInfo.name || targetClassId,
                tier: classInfo.tier
            }
        }];
        
        // 재귀적으로 조합 경로 찾기
        const class1Paths = this.getClassCombinationPaths(class1Id);
        const class2Paths = this.getClassCombinationPaths(class2Id);
        
        return [...paths, ...class1Paths, ...class2Paths];
    }
    
    /**
     * 스킬 포인트 할당
     * @param {string} classId - 클래스 ID
     * @param {string} skillId - 스킬 ID
     * @returns {boolean} 할당 성공 여부
     */
    allocateSkillPoint(classId, skillId) {
        if (!this.game || !this.game.gameData || !this.game.gameData.classes) {
            return false;
        }
        
        // 클래스 확인
        const classData = this.game.gameData.classes[classId];
        if (!classData || !classData.unlocked) {
            return false;
        }
        
        // 스킬 포인트 확인
        if (!classData.skillPoints || classData.skillPoints <= 0) {
            return false;
        }
        
        // 스킬 정보 확인
        const classInfo = this.findClassById(classId);
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
        
        // 스킬 포인트 할당 이벤트 발생
        this.events.emit('skillPointAllocated', {
            classId: classId,
            skillId: skillId,
            newLevel: classData.skills[skillId],
            remainingPoints: classData.skillPoints
        });
        
        return true;
    }
    
    /**
     * 스킬 트리 정보 가져오기
     * @param {string} classId - 클래스 ID
     * @returns {Object} 스킬 트리 정보 {skills, points}
     */
    getSkillTreeInfo(classId) {
        if (!this.game || !this.game.gameData || !this.game.gameData.classes) {
            return { skills: [], points: 0 };
        }
        
        // 클래스 확인
        const classData = this.game.gameData.classes[classId];
        if (!classData || !classData.unlocked) {
            return { skills: [], points: 0 };
        }
        
        // 클래스 정보 가져오기
        const classInfo = this.findClassById(classId);
        if (!classInfo || !classInfo.abilities) {
            return { skills: [], points: 0 };
        }
        
        // 스킬 정보 변환
        const skills = classInfo.abilities.map(ability => {
            return {
                id: ability.id,
                name: ability.name,
                description: ability.description,
                level: (classData.skills && classData.skills[ability.id]) || 0,
                maxLevel: ability.maxLevel || 5,
                requiredSkills: ability.requiredSkills || {},
                manaCost: ability.manaCost,
                cooldown: ability.cooldown,
                effects: ability.effects
            };
        });
        
        return {
            skills: skills,
            points: classData.skillPoints || 0
        };
    }
    
    /**
     * 레벨업 시 플레이어 스탯 업데이트
     * @param {string} classId - 클래스 ID
     * @param {number} level - 새 레벨
     * @returns {Object} 업데이트된 스탯 정보
     */
    updatePlayerStatsForLevelUp(classId, level) {
        // 클래스 정보 가져오기
        const classInfo = this.findClassById(classId);
        if (!classInfo) {
            return null;
        }
        
        // 기본 스탯 계산
        const baseStats = this.calculateBaseStats(classInfo, level);
        
        // 마스터리 보너스 적용
        const statsWithMastery = this.applyMasteryBonuses(classId, baseStats);
        
        // 플레이어 스탯 업데이트 이벤트 발생
        this.events.emit('playerStatsUpdated', {
            classId: classId,
            level: level,
            stats: statsWithMastery
        });
        
        return statsWithMastery;
    }
    
    /**
     * 기본 스탯 계산
     * @param {Object} classInfo - 클래스 정보
     * @param {number} level - 레벨
     * @returns {Object} 기본 스탯 정보
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
     * 마스터리 보너스 적용
     * @param {string} classId - 클래스 ID
     * @param {Object} baseStats - 기본 스탯
     * @returns {Object} 마스터리 적용된 스탯
     */
    applyMasteryBonuses(classId, baseStats) {
        if (!this.game || !this.game.gameData || !this.game.gameData.masteryBonuses) {
            return baseStats;
        }
        
        // 해당 클래스의 마스터리 보너스 가져오기
        const classMasteries = this.game.gameData.masteryBonuses[classId];
        if (!classMasteries) {
            return baseStats;
        }
        
        // 복사된 스탯
        const newStats = { ...baseStats };
        
        // 마스터리 보너스 적용
        for (const tier in classMasteries) {
            const mastery = classMasteries[tier];
            
            switch (mastery.type) {
                case 'hp_increase':
                    newStats.maxHp = Math.floor(newStats.maxHp * (1 + mastery.value / 100));
                    newStats.hp = newStats.maxHp;
                    break;
                case 'mp_increase':
                    newStats.maxMp = Math.floor(newStats.maxMp * (1 + mastery.value / 100));
                    newStats.mp = newStats.maxMp;
                    break;
                case 'attack_increase':
                    newStats.attack = Math.floor(newStats.attack * (1 + mastery.value / 100));
                    break;
                case 'defense_increase':
                    newStats.defense = Math.floor(newStats.defense * (1 + mastery.value / 100));
                    break;
                case 'stat_increase':
                    // 모든 스탯 증가
                    newStats.maxHp = Math.floor(newStats.maxHp * (1 + mastery.value / 100));
                    newStats.hp = newStats.maxHp;
                    newStats.maxMp = Math.floor(newStats.maxMp * (1 + mastery.value / 100));
                    newStats.mp = newStats.maxMp;
                    newStats.attack = Math.floor(newStats.attack * (1 + mastery.value / 100));
                    newStats.defense = Math.floor(newStats.defense * (1 + mastery.value / 100));
                    newStats.speed = Math.floor(newStats.speed * (1 + mastery.value / 100));
                    break;
            }
        }
        
        return newStats;
    }
}

export default ProgressionSystem;