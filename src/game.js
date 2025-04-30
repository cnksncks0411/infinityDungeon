import Phaser from 'phaser';
const { ipcRenderer } = require('electron');

// 게임 씬 가져오기
import BootScene from './scenes/Boot';
import PreloaderScene from './scenes/Preloader';
import MainMenuScene from './scenes/MainMenu';
import CharacterScene from './scenes/Character';
import DungeonScene from './scenes/DungeonScene';
import CombatScene from './scenes/Combat';
import InventoryScene from './scenes/Inventory';
import GameOverScene from './scenes/GameOver';

// 게임 설정
const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  parent: 'game-container',
  pixelArt: true, // 픽셀 아트 스타일을 위한 설정
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: process.env.NODE_ENV === 'development'
    }
  },
  scene: [
    BootScene,
    PreloaderScene,
    MainMenuScene,
    CharacterScene,
    DungeonScene,
    CombatScene,
    InventoryScene,
    GameOverScene
  ]
};

class DungeonLoopGame extends Phaser.Game {
  constructor() {
    super(config);
    this.initializeGameData();
    this.setupEventListeners();
    this.setupAutoSave();
  }

  // 게임 데이터 초기화 및 이벤트 리스너 설정
  initializeGameData() {
    this.gameData = {
      player: null,
      inventory: [],
      unlockedClasses: [],
      currentRun: {
        dungeonLevel: 1,
        elapsedTime: 0,
        monstersKilled: 0
      }
    };
  }

  // 이벤트 리스너 설정
  setupEventListeners() {
    window.addEventListener('load', () => this.loadGameData());
    ipcRenderer.on('request-save-game', () => this.saveGameData());
  }

  // 자동 저장 설정
  setupAutoSave() {
    setInterval(() => this.saveGameData(), 5 * 60 * 1000); // 5분마다 자동 저장
  }

  // 게임 데이터 로드
  async loadGameData() {
    try {
      const savedData = await ipcRenderer.invoke('load-game');

      if (savedData) {
        console.log('게임 데이터 로드 성공!');
        this.gameData = savedData;
        this.events.emit('gameDataLoaded', this.gameData);
      } else {
        console.log('저장된 게임 데이터가 없습니다. 새 게임을 시작합니다.');
        this.initNewGameData();
      }
    } catch (error) {
      console.error('게임 데이터 로드 실패:', error);
      this.initNewGameData();
    }
  }

  // 새 게임 데이터 초기화
  initNewGameData() {
    this.initializeClasses();
    this.initializeInventory();
    this.initializePlayer();
    this.initializeStatistics();
    
    this.gameData.legacyItems = [];
    this.events.emit('gameDataInitialized', this.gameData);
  }

  // 기본 클래스 초기화
  initializeClasses() {
    this.gameData.unlockedClasses = [
      { id: 'warrior', level: 1, exp: 0 },
      { id: 'archer', level: 1, exp: 0 },
      { id: 'mage', level: 1, exp: 0 }
    ];
  }

  // 초기 인벤토리 설정
  initializeInventory() {
    this.gameData.inventory = [
      { id: 'basic_sword', type: 'weapon', rarity: 'common' },
      { id: 'basic_bow', type: 'weapon', rarity: 'common' },
      { id: 'basic_staff', type: 'weapon', rarity: 'common' },
      { id: 'health_potion', type: 'consumable', rarity: 'common', count: 3 }
    ];
  }

  // 초기 플레이어 설정
  initializePlayer() {
    this.gameData.player = {
      currentClass: 'warrior',
      level: 1,
      exp: 0,
      gold: 100,
      stats: {
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        attack: 10,
        defense: 5,
        speed: 5
      },
      equipment: {
        weapon: 'basic_sword',
        armor: null,
        accessory: null
      }
    };
  }

  // 플레이 통계 초기화
  initializeStatistics() {
    this.gameData.statistics = {
      totalPlayTime: 0,
      dungeonsCompleted: 0,
      monstersKilled: 0,
      itemsCollected: 0,
      classesUnlocked: 3
    };
  }

  // 게임 데이터 저장
  async saveGameData() {
    try {
      this.updateGameDataForSaving();
      
      const success = await ipcRenderer.invoke('save-game', this.gameData);

      if (success) {
        console.log('게임 데이터 저장 성공!');
        this.events.emit('gameSaved');
      } else {
        console.error('게임 데이터 저장 실패!');
      }

      return success;
    } catch (error) {
      console.error('게임 저장 중 오류 발생:', error);
      return false;
    }
  }

  // 저장 전 게임 데이터 업데이트
  updateGameDataForSaving() {
    // 현재 시간 기록
    this.gameData.lastSaved = Date.now();

    // 통계 업데이트
    this.updatePlayTimeStatistics();

    // 현재 씬에서 플레이어 데이터 업데이트
    this.updatePlayerDataFromCurrentScene();
  }

  // 플레이 시간 통계 업데이트
  updatePlayTimeStatistics() {
    if (this.gameData.currentRun && this.gameData.currentRun.startTime) {
      const elapsedSeconds = (Date.now() - this.gameData.currentRun.startTime) / 1000;
      this.gameData.statistics.totalPlayTime += elapsedSeconds;
    }
  }

  // 현재 씬에서 플레이어 데이터 업데이트
  updatePlayerDataFromCurrentScene() {
    const activeScene = this.scene.getScenes(true)[0];
    if (activeScene && activeScene.updatePlayerDataForSave) {
      activeScene.updatePlayerDataForSave(this.gameData);
    }
  }

  // 클래스 해금
  unlockClass(classId, initialLevel = 1) {
    // 이미 해금되었는지 확인
    if (this.isClassAlreadyUnlocked(classId)) {
      return false;
    }

    // 새 클래스 추가
    this.gameData.unlockedClasses.push({
      id: classId,
      level: initialLevel,
      exp: 0
    });

    // 통계 업데이트
    this.gameData.statistics.classesUnlocked++;

    // 클래스 해금 이벤트 발생
    this.events.emit('classUnlocked', classId);

    // 자동 저장
    this.saveGameData();

    return true;
  }

  // 클래스가 이미 해금되었는지 확인
  isClassAlreadyUnlocked(classId) {
    return this.gameData.unlockedClasses.some(c => c.id === classId);
  }

  // 던전 진입 시작
  startDungeonRun(dungeonId, selectedClass) {
    // 현재 던전 실행 정보 초기화
    this.initializeDungeonRun(dungeonId, selectedClass);

    // 선택한 클래스에 따라 플레이어 스탯 조정
    this.updatePlayerStatsForClass(selectedClass);

    // 던전 시작 이벤트 발생
    this.events.emit('dungeonStarted', this.gameData.currentRun);

    // 던전 씬으로 전환
    this.scene.start('Dungeon', { 
      dungeonId, 
      difficulty: this.gameData.currentRun.level 
    });
  }

  // 던전 실행 데이터 초기화
  initializeDungeonRun(dungeonId, selectedClass) {
    this.gameData.currentRun = {
      dungeonId,
      selectedClass,
      startTime: Date.now(),
      level: 1,
      elapsedTime: 0,
      monstersKilled: 0,
      itemsCollected: 0,
      rooms: {
        explored: 0,
        total: 0
      },
      floor: 1
    };
  }

  // 선택한 클래스에 따라 플레이어 스탯 업데이트
  updatePlayerStatsForClass(classId) {
    // 클래스 데이터 가져오기
    const classData = this.getClassData(classId);
    if (!classData) return;

    // 해당 클래스의 플레이어 레벨 가져오기
    const playerClassLevel = this.getPlayerClassLevel(classId);

    // 기본 스탯 계산
    const baseStats = this.calculateBaseStats(classData, playerClassLevel);

    // 플레이어 현재 스탯 업데이트
    this.updatePlayerStats(classId, playerClassLevel, baseStats);

    // 클래스에 맞는 무기 장착
    this.equipClassWeapon(classId);
  }

  // 클래스 데이터 가져오기
  getClassData(classId) {
    return this.registry.get('classData')?.find(c => c.id === classId);
  }

  // 특정 클래스의 플레이어 레벨 가져오기
  getPlayerClassLevel(classId) {
    return this.gameData.unlockedClasses.find(c => c.id === classId)?.level || 1;
  }

  // 기본 스탯 계산
  calculateBaseStats(classData, playerClassLevel) {
    return {
      hp: classData.baseStats.hp + (classData.growthStats.hp * playerClassLevel),
      mp: classData.baseStats.mp + (classData.growthStats.mp * playerClassLevel),
      attack: classData.baseStats.attack + (classData.growthStats.attack * playerClassLevel),
      defense: classData.baseStats.defense + (classData.growthStats.defense * playerClassLevel),
      speed: classData.baseStats.speed + (classData.growthStats.speed * playerClassLevel)
    };
  }

  // 플레이어 스탯 업데이트
  updatePlayerStats(classId, playerClassLevel, baseStats) {
    this.gameData.player = {
      ...this.gameData.player,
      currentClass: classId,
      level: playerClassLevel,
      stats: {
        ...baseStats,
        maxHp: baseStats.hp,
        maxMp: baseStats.mp,
        // 클래스 패시브 보너스 적용
        ...this.applyClassPassives(classId, baseStats)
      }
    };
  }

  // 클래스 패시브 능력 적용
  applyClassPassives(classId, stats) {
    const modifiedStats = { ...stats };

    // 클래스 별 패시브 보너스 적용
    switch (classId) {
      case 'warrior':
        modifiedStats.hp *= 1.1; // HP 10% 증가
        modifiedStats.maxHp = modifiedStats.hp;
        break;
      case 'archer':
        modifiedStats.speed *= 1.1; // 이동속도 10% 증가
        break;
      case 'mage':
        modifiedStats.mp *= 1.15; // MP 15% 증가
        modifiedStats.maxMp = modifiedStats.mp;
        break;
      case 'cleric':
        // HP 회복 효과는 별도로 처리
        break;
      // 기타 클래스 패시브 처리...
    }

    return modifiedStats;
  }

  // 클래스에 맞는 무기 장착
  equipClassWeapon(classId) {
    // 클래스 기본 무기 맵핑
    const defaultWeapon = this.getDefaultWeaponForClass(classId);

    // 인벤토리에서 해당 클래스에 적합한 무기 중 가장 좋은 것 찾기
    const bestWeapon = this.findBestWeaponForClass(classId);

    // 찾은 무기 장착
    this.gameData.player.equipment.weapon = bestWeapon || defaultWeapon;
  }

  // 클래스 기본 무기 가져오기
  getDefaultWeaponForClass(classId) {
    const defaultWeapons = {
      'warrior': 'basic_sword',
      'archer': 'basic_bow',
      'mage': 'basic_staff',
      'thief': 'basic_dagger',
      'lancer': 'basic_spear',
      'monk': 'basic_fist',
      'cleric': 'basic_mace',
      'hunter': 'basic_crossbow',
      'knight': 'basic_shield',
      'alchemist': 'basic_potion'
    };

    return defaultWeapons[classId] || 'basic_sword';
  }

  // 클래스에 적합한 최상의 무기 찾기
  findBestWeaponForClass(classId) {
    // 클래스별 무기 타입 맵핑
    const allowedTypes = this.getClassWeaponTypes(classId);

    // 인벤토리에서 해당 클래스가 사용 가능한 무기 필터링
    const compatibleWeapons = this.findCompatibleWeapons(classId, allowedTypes);

    // 가장 좋은 무기 찾기
    return this.getBestWeapon(compatibleWeapons);
  }

  // 클래스별 무기 타입 가져오기
  getClassWeaponTypes(classId) {
    const classWeaponTypes = {
      'warrior': ['sword', 'axe', 'hammer'],
      'archer': ['bow', 'longbow'],
      'mage': ['staff', 'wand'],
      'thief': ['dagger', 'shortsword'],
      // 기타 클래스 무기 맵핑...
    };

    return classWeaponTypes[classId] || [];
  }

  // 호환되는 무기 찾기
  findCompatibleWeapons(classId, allowedTypes) {
    return this.gameData.inventory.filter(item =>
      item.type === 'weapon' &&
      (allowedTypes.includes(item.subType) || item.compatibleClasses?.includes(classId))
    );
  }

  // 최상의 무기 가져오기
  getBestWeapon(compatibleWeapons) {
    if (compatibleWeapons.length === 0) return null;

    // 무기 등급 순서
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

    // 희귀도와 레벨 요구치로 정렬하여 최상의 무기 반환
    return compatibleWeapons.sort((a, b) => {
      // 희귀도 비교
      const rarityDiff = rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
      if (rarityDiff !== 0) return rarityDiff;

      // 레벨 요구치 비교 (높은 것이 더 좋음)
      return (b.requiredLevel || 0) - (a.requiredLevel || 0);
    })[0].id;
  }

  // 던전 완료 처리
  completeDungeon(results) {
    // 던전 통계 업데이트
    this.gameData.statistics.dungeonsCompleted++;

    // 보상 처리
    this.processRewards(results);

    // 현재 던전 실행 정보 리셋
    this.gameData.currentRun = null;

    // 던전 완료 이벤트 발생
    this.events.emit('dungeonCompleted', results);

    // 게임 데이터 저장
    this.saveGameData();

    // 캐릭터 씬으로 전환
    this.scene.start('Character');
  }

  // 던전 보상 처리
  processRewards(results) {
    this.awardExperience(results.experience || 0);
    this.awardGold(results.gold || 0);
    this.addItemsToInventory(results.items || []);
  }

  // 경험치 지급
  awardExperience(amount) {
    // 현재 클래스 찾기
    const currentClassId = this.gameData.player.currentClass;
    const classIndex = this.gameData.unlockedClasses.findIndex(c => c.id === currentClassId);

    if (classIndex === -1) return;

    // 경험치 증가
    this.gameData.unlockedClasses[classIndex].exp += amount;

    // 레벨업 체크
    this.checkLevelUp(classIndex);
  }

  // 레벨업 확인
  checkLevelUp(classIndex) {
    const classData = this.gameData.unlockedClasses[classIndex];

    // 레벨업에 필요한 경험치 계산
    const expRequired = this.calculateRequiredExp(classData.level);

    // 충분한 경험치가 쌓였으면 레벨업
    if (classData.exp >= expRequired) {
      this.performLevelUp(classIndex, classData, expRequired);
    }
  }

  // 레벨업에 필요한 경험치 계산
  calculateRequiredExp(level) {
    return Math.floor(100 * level * 1.5);
  }

  // 레벨업 실행
  performLevelUp(classIndex, classData, expRequired) {
    // 남은 경험치 계산
    classData.exp -= expRequired;
    classData.level++;

    // 레벨업 이벤트 발생
    this.events.emit('levelUp', {
      classId: classData.id,
      level: classData.level
    });

    // 연속 레벨업 체크
    this.checkLevelUp(classIndex);
  }

  // 골드 지급
  awardGold(amount) {
    this.gameData.player.gold = (this.gameData.player.gold || 0) + amount;

    // 골드 획득 이벤트 발생
    this.events.emit('goldAcquired', amount);
  }

  // 아이템 인벤토리에 추가
  addItemsToInventory(items) {
    items.forEach(item => this.addItemToInventory(item));
  }

  // 단일 아이템 인벤토리에 추가
  addItemToInventory(item) {
    // 이미 있는 소비 아이템인 경우
    const existingItem = this.findExistingConsumableItem(item);

    if (existingItem) {
      this.updateConsumableItemCount(existingItem, item);
    } else {
      this.addNewItemToInventory(item);
    }

    // 아이템 획득 이벤트 발생
    this.events.emit('itemAcquired', item);
  }

  // 기존 소비 아이템 찾기
  findExistingConsumableItem(item) {
    return item.type === 'consumable' ? 
      this.gameData.inventory.find(i => i.id === item.id && i.type === 'consumable') : 
      null;
  }

  // 소비 아이템 수량 업데이트
  updateConsumableItemCount(existingItem, newItem) {
    existingItem.count = (existingItem.count || 1) + (newItem.count || 1);
  }

  // 새 아이템 인벤토리에 추가
  addNewItemToInventory(item) {
    this.gameData.inventory.push(item);
    this.gameData.statistics.itemsCollected++;
  }

  // 클래스 조합 시도
  async attemptClassCombination(class1Id, class2Id) {
    // 조합 가능 여부 체크
    const validationResult = await this.validateClassCombination(class1Id, class2Id);
    if (!validationResult.valid) return validationResult.result;

    // 골드 차감
    this.gameData.player.gold -= validationResult.goldCost;

    // 조합 성공 여부 결정
    if (validationResult.isSuccess) {
      // 새 클래스 해금
      this.unlockClass(validationResult.resultClassId);

      return {
        success: true,
        newClass: validationResult.resultClassId,
        goldSpent: validationResult.goldCost,
        chance: validationResult.successChance
      };
    } else {
      return {
        success: false,
        reason: '조합에 실패했습니다.',
        goldSpent: validationResult.goldCost,
        chance: validationResult.successChance
      };
    }
  }

  // 클래스 조합 유효성 검사
  async validateClassCombination(class1Id, class2Id) {
    // 클래스 존재 여부 확인
    const class1 = this.gameData.unlockedClasses.find(c => c.id === class1Id);
    const class2 = this.gameData.unlockedClasses.find(c => c.id === class2Id);

    if (!class1 || !class2) {
      return { 
        valid: false, 
        result: { success: false, reason: '클래스가 존재하지 않습니다.' } 
      };
    }
    
    // 레벨 요구치 확인
    if (class1.level < 10 || class2.level < 10) {
      return { 
        valid: false, 
        result: { success: false, reason: '두 클래스 모두 레벨 10 이상이어야 합니다.' } 
      };
    }

    // 조합 결과 클래스 ID 가져오기
    const resultClassId = this.getClassCombinationResult(class1Id, class2Id);
    if (!resultClassId) {
      return { 
        valid: false, 
        result: { success: false, reason: '유효하지 않은 조합입니다.' } 
      };
    }

    // 이미 해금된 클래스인지 확인
    if (this.isClassAlreadyUnlocked(resultClassId)) {
      return { 
        valid: false, 
        result: { success: false, reason: '이미 해금된 클래스입니다.' } 
      };
    }

    // 골드 비용 계산
    const combinationTier = this.getClassCombinationTier(class1Id, class2Id);
    const goldCost = this.getClassCombinationCost(combinationTier);

    // 골드 부족 체크
    if (this.gameData.player.gold < goldCost) {
      return { 
        valid: false, 
        result: { success: false, reason: `골드가 부족합니다. (필요: ${goldCost})` } 
      };
    }

    // 성공 확률 계산 관련 데이터 준비
    const combinationChanceData = this.prepareCombinationChanceData(class1, class2);
    
    // 성공 확률 계산 (IPC 통해 메인 프로세스에 요청)
    const successChance = await ipcRenderer.invoke('calculate-combination-chance', combinationChanceData);

    // 성공 여부 결정
    const isSuccess = Math.random() * 100 < successChance;

    return {
      valid: true,
      goldCost,
      successChance,
      isSuccess,
      resultClassId
    };
  }

  // 클래스 조합 확률 계산을 위한 데이터 준비
  prepareCombinationChanceData(class1, class2) {
    // 황금 열쇠 소유 여부 확인
    const hasGoldenKey = this.gameData.legacyItems.includes('golden_key');

    // 연금술사 보너스 체크
    const alchemistClass = this.gameData.unlockedClasses.find(c => c.id === 'alchemist');
    const alchemistBonus = alchemistClass ? Math.min(15, alchemistClass.level / 2) : 0;

    return {
      class1Level: class1.level,
      class2Level: class2.level,
      hasGoldenKey,
      alchemistBonus
    };
  }

  // 클래스 조합 결과 가져오기
  getClassCombinationResult(class1Id, class2Id) {
    // 클래스 조합 맵핑
    const combinationMap = {
      'warrior+mage': 'magic_knight',
      'mage+warrior': 'battle_mage',
      'archer+hunter': 'ranger',
      'hunter+archer': 'ranger',
      'thief+hunter': 'assassin',
      'hunter+thief': 'assassin',
      // 추가 조합...
    };

    // 순서 무관하게 조합 결과 찾기
    return combinationMap[`${class1Id}+${class2Id}`] || combinationMap[`${class2Id}+${class1Id}`];
  }

  // 클래스 조합 티어 가져오기
  getClassCombinationTier(class1Id, class2Id) {
    // 클래스별 티어 정보
    const classTiers = {
      'warrior': 1, 'archer': 1, 'mage': 1, 'thief': 1, 'lancer': 1,
      'monk': 1, 'cleric': 1, 'hunter': 1, 'knight': 1, 'alchemist': 1,

      'magic_knight': 2, 'ranger': 2, 'assassin': 2, 'battle_mage': 2,
      // 티어 2 클래스들...

      'death_knight': 3, 'arcane_ranger': 3, 'shadow_dancer': 3,
      // 티어 3 클래스들...

      'dragon_knight': 4, 'celestial_sage': 4, 'eternal_champion': 4,
      // 티어 4 클래스들...
    };

    // 조합 결과 클래스 ID
    const resultClassId = this.getClassCombinationResult(class1Id, class2Id);

    // 결과 클래스의 티어 반환
    return classTiers[resultClassId] || 0;
  }

  // 클래스 조합 비용 계산
  getClassCombinationCost(tier) {
    // 티어별 기본 비용
    const baseCosts = {
      2: 1000,  // 티어 2 조합 비용
      3: 5000,  // 티어 3 조합 비용
      4: 20000  // 티어 4 조합 비용
    };

    return baseCosts[tier] || 500;
  }
}