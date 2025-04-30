// src/systems/CombatSystem.js
class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;

    // 플레이어와 적 그룹 참조
    this.player = null;
    this.enemies = null;

    // 전투 상태 변수
    this.activeStatusEffects = [];
    this.damageNumbers = [];
    this.activeCooldowns = {};

    // 전투 설정
    this.config = {
      baseCritMultiplier: 2.0,
      baseDodgeChance: 0.05,
      damageVariance: 0.2,  // 대미지의 20% 랜덤 변동
      statusEffectInterval: 1000, // 상태 효과 틱 간격 (ms)
      maxComboMultiplier: 2.5,
      comboDecayTime: 3000, // 콤보 유지 시간 (ms)
    };

    // AI 시스템 관련 변수
    this.aiConfig = {
      decisionInterval: 1000, // AI 결정 간격 (ms)
      aggroRange: 10, // 기본 어그로 범위
      chaseRange: 15, // 추적 범위
      patrolRadius: 5, // 기본 정찰 범위
      fleeThreshold: 0.2, // 도망칠 HP 비율 (20%)
    };

    // 몬스터 AI 행동 상태
    this.aiStates = {
      IDLE: 'idle',       // 휴식/대기
      PATROL: 'patrol',   // 정찰
      CHASE: 'chase',     // 추적
      ATTACK: 'attack',   // 공격
      FLEE: 'flee',       // 도망
      SPECIAL: 'special', // 특수 능력 사용
      SUMMON: 'summon',   // 소환
      HEAL: 'heal'        // 치유
    };

    // 몬스터 유형별 AI 패턴 설정
    this.monsterAIPatterns = {
      // 기본 몬스터 패턴 (다른 패턴의 기본이 됨)
      default: {
        aggroRange: this.aiConfig.aggroRange,
        chaseRange: this.aiConfig.chaseRange,
        attackRange: 1.5, // 기본 공격 범위
        fleeThreshold: this.aiConfig.fleeThreshold,
        patrolRadius: this.aiConfig.patrolRadius,
        behaviors: [
          { state: this.aiStates.ATTACK, weight: 0.7, cooldown: 0 },
          { state: this.aiStates.CHASE, weight: 0.3, cooldown: 0 },
        ],
        specialAbilityChance: 0.3, // 특수 능력 사용 확률
        targetPreference: 'closest', // 가장 가까운 대상 우선
      },

      // 근접 공격 몬스터
      melee: {
        extends: 'default',
        attackRange: 1.5,
        behaviors: [
          { state: this.aiStates.ATTACK, weight: 0.8, cooldown: 0 },
          { state: this.aiStates.CHASE, weight: 0.2, cooldown: 0 },
        ],
        fleeThreshold: 0.15, // 체력이 더 낮을 때 도망감
        movementSpeed: 1.0, // 기본 이동 속도 배율
      },

      // 원거리 공격 몬스터
      ranged: {
        extends: 'default',
        attackRange: 7, // 원거리 공격 범위
        behaviors: [
          { state: this.aiStates.ATTACK, weight: 0.6, cooldown: 0 },
          { state: this.aiStates.FLEE, weight: 0.4, cooldown: 2000 }, // 거리 유지를 위한 도망 행동
        ],
        fleeThreshold: 0.3, // 더 일찍 도망가기 시작
        kiting: true, // 키팅 행동 (공격 후 거리두기)
        kitingDistance: 5, // 키팅 시 유지할 거리
        movementSpeed: 0.9, // 약간 느린 이동 속도
      },

      // 마법 공격 몬스터
      magic: {
        extends: 'ranged',
        attackRange: 6,
        behaviors: [
          { state: this.aiStates.ATTACK, weight: 0.5, cooldown: 0 },
          { state: this.aiStates.SPECIAL, weight: 0.3, cooldown: 5000 }, // 특수 마법 공격 사용
          { state: this.aiStates.FLEE, weight: 0.2, cooldown: 3000 },
        ],
        spellCastTime: 1000, // 주문 시전 시간 (ms)
        specialAbilityChance: 0.5, // 더 높은 특수 능력 사용 확률
        movementSpeed: 0.8, // 더 느린 이동 속도
      },

      // 정찰 중심 몬스터
      scout: {
        extends: 'default',
        aggroRange: this.aiConfig.aggroRange * 1.5, // 더 넓은 어그로 범위
        behaviors: [
          { state: this.aiStates.PATROL, weight: 0.6, cooldown: 0 },
          { state: this.aiStates.ATTACK, weight: 0.4, cooldown: 0 },
        ],
        alertsNearby: true, // 주변 몬스터 경보
        alertRange: 8, // 경보 범위
        movementSpeed: 1.2, // 더 빠른 이동 속도
      },

      // 탱커 유형 몬스터
      tank: {
        extends: 'melee',
        attackRange: 1.5,
        behaviors: [
          { state: this.aiStates.ATTACK, weight: 0.9, cooldown: 0 },
          { state: this.aiStates.SPECIAL, weight: 0.1, cooldown: 10000 }, // 가끔 특수 능력 사용
        ],
        fleeThreshold: 0.1, // 거의 도망가지 않음
        movementSpeed: 0.7, // 느린 이동 속도
        aggroMultiplier: 1.5, // 어그로 우선순위 높음
        damageReduction: 0.3, // 30% 대미지 감소
      },

      // 소환사 유형 몬스터
      summoner: {
        extends: 'magic',
        attackRange: 7,
        behaviors: [
          { state: this.aiStates.SUMMON, weight: 0.4, cooldown: 15000 }, // 소환 우선
          { state: this.aiStates.ATTACK, weight: 0.3, cooldown: 0 },
          { state: this.aiStates.FLEE, weight: 0.3, cooldown: 3000 },
        ],
        fleeThreshold: 0.4, // 높은 도망 임계값
        summonLimit: 3, // 최대 소환 수
        summonCooldown: 15000, // 소환 쿨다운 (ms)
        movementSpeed: 0.8,
      },

      // 힐러 유형 몬스터
      healer: {
        extends: 'magic',
        attackRange: 6,
        behaviors: [
          { state: this.aiStates.HEAL, weight: 0.5, cooldown: 8000 }, // 치유 우선
          { state: this.aiStates.ATTACK, weight: 0.3, cooldown: 0 },
          { state: this.aiStates.FLEE, weight: 0.2, cooldown: 3000 },
        ],
        healThreshold: 0.6, // 동료의 체력이 60% 이하일 때 치유
        healRange: 8, // 치유 범위
        healCooldown: 8000, // 치유 쿨다운 (ms)
        movementSpeed: 0.9,
      },

      // 엘리트 몬스터 공통 패턴
      elite: {
        extends: 'default',
        attackRange: 2,
        behaviors: [
          { state: this.aiStates.ATTACK, weight: 0.6, cooldown: 0 },
          { state: this.aiStates.SPECIAL, weight: 0.4, cooldown: 8000 }, // 빈번한 특수 능력 사용
        ],
        fleeThreshold: 0.2,
        specialAbilityChance: 0.6, // 높은 특수 능력 사용 확률
        enrageThreshold: 0.3, // 30% 체력 이하에서 격노
        enrageMultiplier: 1.5, // 격노 시 공격력/속도 증가
        aggroMultiplier: 1.2, // 어그로 우선순위 약간 높음
        movementSpeed: 1.1, // 약간 빠른 이동 속도
      },

      // 보스 몬스터 공통 패턴
      boss: {
        extends: 'elite',
        attackRange: 3,
        behaviors: [
          { state: this.aiStates.ATTACK, weight: 0.4, cooldown: 0 },
          { state: this.aiStates.SPECIAL, weight: 0.4, cooldown: 12000 }, // 특수 능력 사용
          { state: this.aiStates.SUMMON, weight: 0.2, cooldown: 25000 }, // 소환 능력
        ],
        phaseChanges: true, // 페이즈 변화 사용
        enrageThreshold: 0.25, // 25% 체력 이하에서 격노
        enrageMultiplier: 2.0, // 격노 시 더 큰 공격력/속도 증가
        specialSequence: true, // 특정 순서로 능력 사용
        aggroMultiplier: 1.5, // 어그로 우선순위 높음
        movementSpeed: 1.0, // 기본 이동 속도
      },

      // 속성별 특수 패턴 - 화염
      fire: {
        aoeAttacks: true, // 광역 공격 사용
        burnEffect: {
          chance: 0.4, // 화상 효과 발생 확률
          damage: 0.1, // 최대 체력의 10% 지속 대미지
          duration: 3, // 3초 지속
        },
        explosionOnDeath: { // 사망 시 폭발
          enabled: true,
          range: 3,
          damage: 20,
        },
      },

      // 속성별 특수 패턴 - 얼음
      ice: {
        slowEffect: {
          chance: 0.5, // 감속 효과 발생 확률
          amount: 0.3, // 30% 감속
          duration: 2, // 2초 지속
        },
        freezeEffect: {
          chance: 0.2, // 빙결 효과 발생 확률
          duration: 1, // 1초 지속
        },
      },

      // 속성별 특수 패턴 - 번개
      lightning: {
        chainAttack: { // 연쇄 공격
          enabled: true,
          targets: 3, // 최대 대상 수
          damageReduction: 0.2, // 대상당 대미지 감소율
        },
        stunEffect: {
          chance: 0.3, // 기절 효과 발생 확률
          duration: 1, // 1초 지속
        },
      },

      // 속성별 특수 패턴 - 독
      poison: {
        dotEffect: { // 지속 대미지 효과
          chance: 0.6, // 중독 효과 발생 확률
          damage: 0.05, // 최대 체력의 5% 지속 대미지
          duration: 5, // 5초 지속
        },
        poisonCloud: { // 독 구름 생성
          onAttack: 0.2, // 공격 시 생성 확률
          onDeath: 0.5, // 사망 시 생성 확률
          duration: 4, // 4초 지속
          radius: 2, // 반경
        },
      },

      // 속성별 특수 패턴 - 어둠
      dark: {
        lifeSteal: { // 생명력 흡수
          enabled: true,
          amount: 0.3, // 대미지의 30% 회복
        },
        fearEffect: { // 공포 효과
          chance: 0.3, // 공포 효과 발생 확률
          duration: 2, // 2초 지속
        },
      },

      // 속성별 특수 패턴 - 빛
      light: {
        blindEffect: { // 실명 효과
          chance: 0.3, // 실명 효과 발생 확률
          duration: 2, // 2초 지속
        },
        healingAura: { // 치유 오라
          enabled: true,
          amount: 0.05, // 최대 체력의 5%
          interval: 3, // 3초마다
          radius: 4, // 반경
        },
      },

      // 속성별 특수 패턴 - 대지
      earth: {
        armorBoost: { // 방어력 증가
          enabled: true,
          amount: 0.3, // 30% 방어력 증가
        },
        groundSlam: { // 대지 강타
          chance: 0.3, // 사용 확률
          stunDuration: 1.5, // 기절 지속시간
          radius: 3, // 반경
          cooldown: 10, // 쿨다운 (초)
        },
      },

      // 속성별 특수 패턴 - 물
      water: {
        healingWave: { // 치유 파동
          enabled: true,
          amount: 0.2, // 최대 체력의 20%
          cooldown: 15, // 쿨다운 (초)
          radius: 5, // 반경
        },
        slipperySurface: { // 미끄러운 표면 생성
          chance: 0.3, // 생성 확률
          duration: 4, // 4초 지속
          radius: 3, // 반경
        },
      },

      // 미니언 패턴 (보스/엘리트가 소환한 적)
      minion: {
        extends: 'default',
        attackRange: 1.5,
        behaviors: [
          { state: this.aiStates.ATTACK, weight: 0.9, cooldown: 0 },
          { state: this.aiStates.CHASE, weight: 0.1, cooldown: 0 },
        ],
        leashToMaster: true, // 주인에게 묶임
        leashRange: 10, // 묶임 범위
        sacrificeForMaster: 0.3, // 30% 확률로 주인을 위해 희생
        movementSpeed: 1.2, // 빠른 이동 속도
      },
    };

    // 타이머 설정
    this.statusEffectTimer = null;
    this.aiDecisionTimer = null;

    // 이벤트 리스너 설정
    this.setupEventListeners();
  }

  // 초기화
  init(player, enemies) {
    this.player = player;
    this.enemies = enemies;

    // 상태 효과 처리 타이머 시작
    this.startStatusEffectTimer();

    // AI 결정 타이머 시작
    this.startAIDecisionTimer();

    // 플레이어 전투 설정 초기화
    this.initializePlayerCombatStats();

    // 몬스터 AI 초기화
    this.initializeMonsterAI();
  }

  // 몬스터 AI 초기화
  initializeMonsterAI() {
    if (!this.enemies) return;

    this.enemies.forEach(monster => {
      // 몬스터 AI 상태 초기화
      monster.aiState = {
        currentState: this.aiStates.IDLE,
        lastStateChange: Date.now(),
        lastDecision: Date.now(),
        lastAttackTime: 0,
        lastSpecialTime: 0,
        lastSummonTime: 0,
        lastHealTime: 0,
        patrolPoints: [],
        patrolIndex: 0,
        homePosition: { x: monster.x, y: monster.y },
        target: null,
        fleePosition: null,
        summonedEntities: [],
      };

      // 몬스터 유형에 따른 AI 패턴 설정
      this.assignMonsterAIPattern(monster);
    });
  }

  // 몬스터 유형에 따른 AI 패턴 할당
  assignMonsterAIPattern(monster) {
    // 기본 패턴 설정
    let basePattern = 'default';

    // 몬스터 유형에 따른 기본 패턴 결정
    if (monster.type === 'boss') {
      basePattern = 'boss';
    } else if (monster.type === 'elite') {
      basePattern = 'elite';
    } else if (monster.type === 'minion') {
      basePattern = 'minion';
    } else if (monster.attackType) {
      basePattern = monster.attackType; // 'melee', 'ranged', 'magic' 등
    }

    // 기본 패턴 복사
    monster.aiPattern = JSON.parse(JSON.stringify(this.monsterAIPatterns[basePattern]));

    // 몬스터 속성에 따른 특수 패턴 추가
    if (monster.element && this.monsterAIPatterns[monster.element]) {
      const elementPattern = this.monsterAIPatterns[monster.element];
      monster.aiPattern = { ...monster.aiPattern, ...elementPattern };
    }

    // 몬스터별 커스텀 설정 (아이디 기반)
    if (monster.monsterId && this.applyCustomMonsterSettings(monster)) {
      // 커스텀 설정 적용됨
    }

    // 보스의 경우 페이즈 정보 설정
    if (monster.phases) {
      monster.aiPattern.phases = monster.phases;
      monster.aiPattern.currentPhase = 0;
    }

    // 패턴 확장 (extends 속성이 있는 경우)
    if (monster.aiPattern.extends && this.monsterAIPatterns[monster.aiPattern.extends]) {
      const parentPattern = this.monsterAIPatterns[monster.aiPattern.extends];
      monster.aiPattern = { ...parentPattern, ...monster.aiPattern };
      delete monster.aiPattern.extends; // 확장 속성 제거
    }

    // 순찰 경로 생성
    this.generatePatrolPath(monster);
  }

  // 몬스터별 커스텀 설정 적용
  applyCustomMonsterSettings(monster) {
    // monsters.json 데이터에서 해당 몬스터의 특수 설정을 가져옴
    const monsterData = this.scene.cache.json.get('monsters')?.find(m => m.id === monster.monsterId);

    if (!monsterData) return false;

    // 능력치 적용
    if (monsterData.abilities) {
      monster.specialAbilities = monsterData.abilities;
    }

    // 특수 행동 패턴 적용
    if (monsterData.behaviorType === 'aggressive') {
      monster.aiPattern.behaviors = [
        { state: this.aiStates.ATTACK, weight: 0.8, cooldown: 0 },
        { state: this.aiStates.CHASE, weight: 0.2, cooldown: 0 },
      ];
      monster.aiPattern.aggroRange *= 1.5;
    } else if (monsterData.behaviorType === 'defensive') {
      monster.aiPattern.behaviors = [
        { state: this.aiStates.ATTACK, weight: 0.5, cooldown: 0 },
        { state: this.aiStates.FLEE, weight: 0.3, cooldown: 3000 },
        { state: this.aiStates.PATROL, weight: 0.2, cooldown: 0 },
      ];
      monster.aiPattern.fleeThreshold = 0.4;
    } else if (monsterData.behaviorType === 'passive') {
      monster.aiPattern.behaviors = [
        { state: this.aiStates.PATROL, weight: 0.7, cooldown: 0 },
        { state: this.aiStates.ATTACK, weight: 0.3, cooldown: 0 },
      ];
      monster.aiPattern.aggroRange *= 0.7;
    }

    return true;
  }

  // 순찰 경로 생성
  generatePatrolPath(monster) {
    // 몬스터 주변에 랜덤한 순찰 지점 생성
    const numPoints = Phaser.Math.Between(3, 6);
    const radius = monster.aiPattern.patrolRadius || this.aiConfig.patrolRadius;

    monster.aiState.patrolPoints = [];

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const distance = Phaser.Math.Between(radius / 2, radius);

      monster.aiState.patrolPoints.push({
        x: monster.aiState.homePosition.x + Math.cos(angle) * distance,
        y: monster.aiState.homePosition.y + Math.sin(angle) * distance
      });
    }
  }

  // 플레이어 전투 스탯 초기화
  initializePlayerCombatStats() {
    // 클래스별 특성 적용
    const classSystem = this.scene.classSystem;
    const classId = this.player.classId;

    // 기본 전투 스탯 설정
    this.player.combatStats = {
      critChance: 0.05, // 기본 5% 크리티컬 확률
      critMultiplier: this.config.baseCritMultiplier,
      dodgeChance: this.config.baseDodgeChance,
      blockChance: 0,
      comboCounter: 0,
      comboMultiplier: 1.0,
      lastHitTime: 0,
      elementalResistances: {
        fire: 0,
        ice: 0,
        lightning: 0,
        earth: 0,
        dark: 0,
        light: 0,
        poison: 0,
        water: 0
      }
    };

    // 아이템 효과 적용
    this.applyEquipmentEffects();

    // 클래스 패시브 효과 적용
    if (classSystem) {
      const passiveEffects = classSystem.getPassiveEffects(classId);
      this.applyPassiveEffects(passiveEffects);
    }
  }

  // 이벤트 리스너 설정
  setupEventListeners() {
    // 씬 종료 시 정리
    this.scene.events.once('shutdown', this.onSceneShutdown, this);

    // 플레이어 레벨업 이벤트
    this.game.events.on('levelUp', this.onPlayerLevelUp, this);

    // 아이템 장착 이벤트
    this.game.events.on('equipmentChanged', this.onEquipmentChanged, this);

    // 몬스터 사망 이벤트
    this.game.events.on('monsterKilled', this.onMonsterKilled, this);
  }

  // 씬 종료 시 정리 작업
  onSceneShutdown() {
    // 타이머 정리
    if (this.statusEffectTimer) {
      clearInterval(this.statusEffectTimer);
      this.statusEffectTimer = null;
    }

    if (this.aiDecisionTimer) {
      clearInterval(this.aiDecisionTimer);
      this.aiDecisionTimer = null;
    }

    // 이벤트 리스너 정리
    this.game.events.off('levelUp', this.onPlayerLevelUp, this);
    this.game.events.off('equipmentChanged', this.onEquipmentChanged, this);
    this.game.events.off('monsterKilled', this.onMonsterKilled, this);
  }

  // 플레이어 레벨업 시 호출
  onPlayerLevelUp(data) {
    if (data.classId === this.player.classId) {
      this.initializePlayerCombatStats();
    }
  }

  // 장비 변경 시 호출
  onEquipmentChanged() {
    this.applyEquipmentEffects();
  }

  // 몬스터 사망 시 호출
  onMonsterKilled(data) {
    const monster = data.monster;

    // 소환된 미니언 관리
    if (monster.master) {
      const master = this.enemies.find(m => m === monster.master);
      if (master && master.aiState) {
        // 주인의 소환 목록에서 제거
        const index = master.aiState.summonedEntities.indexOf(monster);
        if (index !== -1) {
          master.aiState.summonedEntities.splice(index, 1);
        }
      }
    }

    // 사망 시 특수 효과
    if (monster.aiPattern) {
      // 사망 시 폭발 효과 (화염 속성 등)
      if (monster.aiPattern.explosionOnDeath && monster.aiPattern.explosionOnDeath.enabled) {
        this.createDeathExplosion(monster);
      }

      // 사망 시 독 구름 생성 (독 속성)
      if (monster.aiPattern.poisonCloud && Math.random() < monster.aiPattern.poisonCloud.onDeath) {
        this.createPoisonCloud(monster);
      }
    }
  }

  // 장비 효과 적용
  applyEquipmentEffects() {
    // 기존 장비 효과 초기화 (기본값으로)
    this.resetEquipmentEffects();

    // 장착 중인 아이템 가져오기
    const equipment = this.player.equipment || {};
    const inventorySystem = this.scene.inventorySystem;

    // 각 장비 슬롯 처리
    for (const slot in equipment) {
      const itemId = equipment[slot];
      if (!itemId) continue;

      // 아이템 정보 가져오기
      const item = inventorySystem ? inventorySystem.getItemById(itemId) : null;
      if (!item) continue;

      // 아이템 속성 적용
      if (item.attributes) {
        item.attributes.forEach(attr => {
          this.applyAttributeEffect(attr);
        });
      }

      // 아이템 특수 효과 적용
      if (item.specialEffect) {
        item.specialEffect.forEach(effect => {
          this.applySpecialEffect(effect, slot);
        });
      }
    }
  }

  // 장비 효과 초기화
  resetEquipmentEffects() {
    const stats = this.player.combatStats;

    // 기본값으로 재설정
    stats.critChance = 0.05;
    stats.critMultiplier = this.config.baseCritMultiplier;
    stats.dodgeChance = this.config.baseDodgeChance;
    stats.blockChance = 0;

    // 저항 초기화
    for (const element in stats.elementalResistances) {
      stats.elementalResistances[element] = 0;
    }
  }

  // 아이템 속성 효과 적용
  applyAttributeEffect(attribute) {
    const stats = this.player.combatStats;
    const playerStats = this.player.stats;

    switch (attribute.type) {
      case 'critical_chance':
        stats.critChance += attribute.value / 100;
        break;
      case 'critical_damage':
        stats.critMultiplier += attribute.value / 100;
        break;
      case 'dodge_chance':
        stats.dodgeChance += attribute.value / 100;
        break;
      case 'block_chance':
        stats.blockChance += attribute.value / 100;
        break;
      case 'elemental_resistance':
        if (attribute.element && stats.elementalResistances[attribute.element] !== undefined) {
          stats.elementalResistances[attribute.element] += attribute.value;
        }
        break;
      case 'hp_bonus':
        playerStats.maxHp += attribute.value;
        break;
      case 'mp_bonus':
        playerStats.maxMp += attribute.value;
        break;
      case 'attack_bonus':
        playerStats.attack += attribute.value;
        break;
      case 'defense_bonus':
        playerStats.defense += attribute.value;
        break;
      case 'speed_bonus':
        playerStats.speed += attribute.value;
        break;
      // 기타 속성...
    }
  }

  // 아이템 특수 효과 적용
  applySpecialEffect(effect, slot) {
    // 특수 효과는 전투 중에 활성화되는 것들이므로 필요한 정보만 저장
    this.player.specialEffects = this.player.specialEffects || [];

    // 이미 동일한 효과가 있는지 확인 (중복 방지)
    const existingEffect = this.player.specialEffects.find(e => e.type === effect.type);

    if (existingEffect) {
      // 더 강한 효과로 업데이트
      if (effect.value > existingEffect.value) {
        existingEffect.value = effect.value;
        existingEffect.source = slot;
      }
    } else {
      // 새 효과 추가
      this.player.specialEffects.push({
        ...effect,
        source: slot
      });
    }
  }

  // 패시브 효과 적용
  applyPassiveEffects(passiveEffects) {
    if (!passiveEffects) return;

    passiveEffects.forEach(effect => {
      switch (effect.type) {
        case 'critical_bonus':
          this.player.combatStats.critChance += effect.value / 100;
          break;
        case 'hp_increase':
          this.player.stats.maxHp *= (1 + effect.value / 100);
          this.player.stats.hp = this.player.stats.maxHp;
          break;
        case 'mp_regen':
          // MP 회복 효과는 업데이트 루프에서 처리
          this.player.passiveMpRegen = effect.value;
          break;
        case 'damage_resistance':
          // 대미지 감소는 대미지 계산 시 처리
          this.player.damageResistance = effect.value / 100;
          break;
        // 기타 패시브 효과...
      }
    });
  }

  // 상태 효과 타이머 시작
  startStatusEffectTimer() {
    if (this.statusEffectTimer) {
      clearInterval(this.statusEffectTimer);
    }

    this.statusEffectTimer = setInterval(() => {
      this.processStatusEffects();
    }, this.config.statusEffectInterval);
  }

  // AI 결정 타이머 시작
  startAIDecisionTimer() {
    if (this.aiDecisionTimer) {
      clearInterval(this.aiDecisionTimer);
    }

    this.aiDecisionTimer = setInterval(() => {
      this.updateMonsterAI();
    }, this.aiConfig.decisionInterval);
  }

  // 몬스터 AI 업데이트
  updateMonsterAI() {
    if (!this.enemies || !this.player) return;

    this.enemies.forEach(monster => {
      if (!monster.active || monster.hp <= 0) return;

      // 현재 시간 기록
      const now = Date.now();

      // 몬스터의 AI 상태가 없으면 초기화
      if (!monster.aiState) {
        this.assignMonsterAIPattern(monster);
        return;
      }

      // 결정 간격 체크 (몬스터마다 살짝 다른 타이밍에 결정하도록)
      if (now - monster.aiState.lastDecision < this.aiConfig.decisionInterval * (0.8 + Math.random() * 0.4)) {
        return;
      }

      // 결정 시간 업데이트
      monster.aiState.lastDecision = now;

      // 보스 페이즈 변화 확인
      if (monster.type === 'boss' && monster.aiPattern.phaseChanges) {
        this.checkBossPhaseTransition(monster);
      }

      // 몬스터 상태 결정 (상황에 따라 다른 행동 선택)
      this.decideMonsterState(monster);

      // 선택된 상태에 따른 행동 실행
      this.executeMonsterAction(monster);
    });
  }

  // 보스 페이즈 전환 확인
  checkBossPhaseTransition(boss) {
    if (!boss || !boss.phases || boss.phases.length === 0) return;

    // 현재 체력 비율
    const hpRatio = boss.hp / boss.maxHp;

    // 현재 페이즈 인덱스
    const currentPhaseIndex = boss.aiPattern.currentPhase || 0;

    // 다음 페이즈 확인
    if (currentPhaseIndex < boss.phases.length) {
      const phase = boss.phases[currentPhaseIndex];

      // 임계값 이하로 체력이 떨어졌는지 확인
      if (hpRatio <= phase.threshold) {
        // 페이즈 전환
        this.activateBossPhase(boss, phase);

        // 다음 페이즈로 인덱스 증가
        boss.aiPattern.currentPhase = currentPhaseIndex + 1;
      }
    }
  }

  // 보스 페이즈 활성화
  activateBossPhase(boss, phase) {
    // 페이즈 전환 메시지 표시
    if (phase.message) {
      this.scene.showMessageAbove(boss, phase.message, 0xFFFF00);
    }

    // 능력치 증가 적용
    if (phase.statBoost) {
      boss.attack *= phase.statBoost;
      boss.defense *= phase.statBoost;
      boss.speedModifier = (boss.speedModifier || 1) * phase.statBoost;
    }

    // 특정 능력 활성화
    if (phase.activateAbility) {
      const ability = boss.specialAbilities?.find(a => a.id === phase.activateAbility);
      if (ability) {
        // 쿨다운 초기화
        ability.lastUsed = 0;

        // 특정 능력 즉시 사용
        if (boss.aiState.target) {
          this.useMonsterSpecialAbility(boss, ability, boss.aiState.target);
        }
      }
    }

    // 페이즈 전환 효과
    this.scene.effects.playBossPhaseTransitionEffect(boss);

    // 카메라 효과
    this.scene.cameras.main.shake(500, 0.01);
  }

  // 몬스터 상태 결정
  decideMonsterState(monster) {
    // 현재 타겟 확인 및 갱신
    this.updateMonsterTarget(monster);

    // 주변 상황 분석
    const stateOptions = this.analyzeMonsterSituation(monster);

    // AI 패턴에 따른 행동 가중치 적용
    monster.aiPattern.behaviors.forEach(behavior => {
      if (stateOptions.includes(behavior.state)) {
        // 쿨다운 확인
        const lastTime = monster.aiState[`last${behavior.state.charAt(0).toUpperCase() + behavior.state.slice(1)}Time`] || 0;
        if (Date.now() - lastTime < behavior.cooldown) {
          return; // 쿨다운 중이면 건너뜀
        }

        // 가중치에 따른 확률로 상태 선택
        if (Math.random() < behavior.weight) {
          monster.aiState.currentState = behavior.state;
          monster.aiState.lastStateChange = Date.now();
        }
      }
    });

    // 비상 상황 대응 (HP가 낮으면 도망)
    const fleeThreshold = monster.aiPattern.fleeThreshold || this.aiConfig.fleeThreshold;
    if (monster.hp / monster.maxHp < fleeThreshold && stateOptions.includes(this.aiStates.FLEE)) {
      monster.aiState.currentState = this.aiStates.FLEE;
      monster.aiState.lastStateChange = Date.now();
    }

    // 격노 상태 확인 (HP가 낮으면 공격적으로 변함)
    if (monster.aiPattern.enrageThreshold &&
      monster.hp / monster.maxHp < monster.aiPattern.enrageThreshold &&
      !monster.isEnraged) {
      this.enrageMonster(monster);
    }
  }

  // 몬스터 주변 상황 분석
  analyzeMonsterSituation(monster) {
    const stateOptions = [];
    const target = monster.aiState.target;

    // 기본적으로 항상 유휴 상태는 가능
    stateOptions.push(this.aiStates.IDLE);

    // 정찰 상태 가능 여부
    if (monster.aiState.patrolPoints.length > 0) {
      stateOptions.push(this.aiStates.PATROL);
    }

    // 타겟이 있으면 공격/추적 가능
    if (target) {
      const distanceToTarget = Phaser.Math.Distance.Between(
        monster.x, monster.y, target.x, target.y
      );

      // 공격 범위 내면 공격 가능
      const attackRange = monster.aiPattern.attackRange || 1.5;
      if (distanceToTarget <= attackRange) {
        stateOptions.push(this.aiStates.ATTACK);
      } else {
        // 공격 범위 밖이면 추적 가능
        stateOptions.push(this.aiStates.CHASE);
      }

      // 특수 능력 사용 가능 여부
      if (monster.specialAbilities && monster.specialAbilities.length > 0) {
        stateOptions.push(this.aiStates.SPECIAL);
      }

      // 도망 가능 여부
      stateOptions.push(this.aiStates.FLEE);
    }

    // 소환 능력 있는지 확인
    if ((monster.specialAbilities && monster.specialAbilities.some(ability => ability.type === 'summon')) ||
      (monster.abilities && monster.abilities.some(ability => ability.type === 'summon'))) {
      stateOptions.push(this.aiStates.SUMMON);
    }

    // 치유 능력 있는지 확인
    if ((monster.specialAbilities && monster.specialAbilities.some(ability => ability.type === 'heal')) ||
      (monster.abilities && monster.abilities.some(ability => ability.type === 'heal')) ||
      monster.aiPattern.healingAura) {
      // 주변에 치유가 필요한 아군이 있는지 체크
      const allies = this.enemies.filter(e =>
        e !== monster &&
        e.active &&
        e.hp > 0 &&
        e.hp / e.maxHp < (monster.aiPattern.healThreshold || 0.6) &&
        Phaser.Math.Distance.Between(monster.x, monster.y, e.x, e.y) <= (monster.aiPattern.healRange || 8)
      );

      if (allies.length > 0 || monster.hp / monster.maxHp < (monster.aiPattern.healThreshold || 0.6)) {
        stateOptions.push(this.aiStates.HEAL);
      }
    }

    return stateOptions;
  }

  // 몬스터 타겟 업데이트
  updateMonsterTarget(monster) {
    // 현재 타겟 확인
    let currentTarget = monster.aiState.target;

    // 타겟 유효성 검증
    if (currentTarget && (!currentTarget.active || currentTarget.hp <= 0)) {
      currentTarget = null;
      monster.aiState.target = null;
    }

    // 어그로 범위 계산
    const aggroRange = monster.aiPattern.aggroRange || this.aiConfig.aggroRange;

    // 타겟이 없으면 새 타겟 찾기
    if (!currentTarget) {
      // 플레이어 거리 계산
      const distToPlayer = Phaser.Math.Distance.Between(
        monster.x, monster.y, this.player.x, this.player.y
      );

      // 플레이어가 어그로 범위 내에 있으면 타겟으로 설정
      if (distToPlayer <= aggroRange && this.player.active && this.player.hp > 0) {
        monster.aiState.target = this.player;
      }
    }
    // 타겟이 있지만 추적 범위를 벗어나면 놓침
    else if (currentTarget === this.player) {
      const chaseRange = monster.aiPattern.chaseRange || this.aiConfig.chaseRange;
      const distToTarget = Phaser.Math.Distance.Between(
        monster.x, monster.y, currentTarget.x, currentTarget.y
      );

      if (distToTarget > chaseRange) {
        monster.aiState.target = null;
      }
    }

    // 주변 몬스터 경보 기능
    if (monster.aiState.target && monster.aiPattern.alertsNearby) {
      const alertRange = monster.aiPattern.alertRange || 8;
      this.alertNearbyMonsters(monster, monster.aiState.target, alertRange);
    }
  }

  // 주변 몬스터 경보
  alertNearbyMonsters(alertingMonster, target, alertRange) {
    this.enemies.forEach(monster => {
      if (monster === alertingMonster || !monster.active || monster.hp <= 0 || monster.aiState.target) {
        return; // 이미 타겟이 있거나 비활성 상태면 건너뜀
      }

      const distance = Phaser.Math.Distance.Between(
        alertingMonster.x, alertingMonster.y, monster.x, monster.y
      );

      if (distance <= alertRange) {
        monster.aiState.target = target;

        // 경보 받은 시각 효과
        this.scene.effects.playAlertEffect(monster);
      }
    });
  }

  // 격노 상태 적용
  enrageMonster(monster) {
    const multiplier = monster.aiPattern.enrageMultiplier || 1.5;

    // 공격력 증가
    monster.attack *= multiplier;

    // 공격 속도 증가
    monster.attackSpeed = (monster.attackSpeed || 1) * multiplier;

    // 이동 속도 증가
    monster.speedModifier = (monster.speedModifier || 1) * multiplier;

    // 격노 상태 표시
    monster.isEnraged = true;

    // 격노 시각 효과
    this.scene.effects.playEnrageEffect(monster);

    // 격노 메시지
    const messages = [
      "격노합니다!",
      "분노의 힘을 얻습니다!",
      "더 강해집니다!"
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];
    this.scene.showMessageAbove(monster, message, 0xFF0000);
  }

  // 몬스터 행동 실행
  executeMonsterAction(monster) {
    switch (monster.aiState.currentState) {
      case this.aiStates.IDLE:
        this.executeIdleAction(monster);
        break;
      case this.aiStates.PATROL:
        this.executePatrolAction(monster);
        break;
      case this.aiStates.CHASE:
        this.executeChaseAction(monster);
        break;
      case this.aiStates.ATTACK:
        this.executeAttackAction(monster);
        break;
      case this.aiStates.FLEE:
        this.executeFleeAction(monster);
        break;
      case this.aiStates.SPECIAL:
        this.executeSpecialAction(monster);
        break;
      case this.aiStates.SUMMON:
        this.executeSummonAction(monster);
        break;
      case this.aiStates.HEAL:
        this.executeHealAction(monster);
        break;
      default:
        this.executeIdleAction(monster);
    }
  }

  // 대기 행동 실행
  executeIdleAction(monster) {
    // 대기 중에는 가끔 랜덤 방향으로 살짝 움직임
    if (Math.random() < 0.2) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.5; // 짧은 거리

      monster.x += Math.cos(angle) * distance;
      monster.y += Math.sin(angle) * distance;
    }

    // 주변 상황을 살핌 (가끔)
    if (Math.random() < 0.3) {
      this.updateMonsterTarget(monster);
    }
  }

  // 정찰 행동 실행
  executePatrolAction(monster) {
    // 정찰 지점이 없으면 생성
    if (!monster.aiState.patrolPoints || monster.aiState.patrolPoints.length === 0) {
      this.generatePatrolPath(monster);
      return;
    }

    // 현재 목표 지점
    const targetPoint = monster.aiState.patrolPoints[monster.aiState.patrolIndex];

    // 목표 지점까지의 거리
    const distance = Phaser.Math.Distance.Between(
      monster.x, monster.y, targetPoint.x, targetPoint.y
    );

    // 목표 지점에 도달했으면 다음 지점으로
    if (distance < 1) {
      monster.aiState.patrolIndex = (monster.aiState.patrolIndex + 1) % monster.aiState.patrolPoints.length;
      return;
    }

    // 목표 지점을 향해 이동
    const angle = Phaser.Math.Angle.Between(
      monster.x, monster.y, targetPoint.x, targetPoint.y
    );

    const speed = this.getMonsterSpeed(monster);
    monster.x += Math.cos(angle) * speed;
    monster.y += Math.sin(angle) * speed;

    // 이동 방향에 따른 스프라이트 방향 설정
    this.updateMonsterDirection(monster, angle);
  }

  // 추적 행동 실행
  executeChaseAction(monster) {
    const target = monster.aiState.target;
    if (!target || !target.active || target.hp <= 0) {
      monster.aiState.currentState = this.aiStates.IDLE;
      return;
    }

    // 목표까지의 거리
    const distance = Phaser.Math.Distance.Between(
      monster.x, monster.y, target.x, target.y
    );

    // 공격 범위에 들어오면 공격 상태로 전환
    const attackRange = monster.aiPattern.attackRange || 1.5;
    if (distance <= attackRange) {
      monster.aiState.currentState = this.aiStates.ATTACK;
      return;
    }

    // 목표를 향해 이동
    const angle = Phaser.Math.Angle.Between(
      monster.x, monster.y, target.x, target.y
    );

    const speed = this.getMonsterSpeed(monster);
    monster.x += Math.cos(angle) * speed;
    monster.y += Math.sin(angle) * speed;

    // 이동 방향에 따른 스프라이트 방향 설정
    this.updateMonsterDirection(monster, angle);

    // 키팅 행동 (원거리 적)
    if (monster.aiPattern.kiting && distance < monster.aiPattern.kitingDistance) {
      monster.aiState.currentState = this.aiStates.FLEE;
      monster.aiState.lastStateChange = Date.now();
      monster.aiState.fleeTime = 1000; // 짧은 도망 시간
    }
  }

  // 공격 행동 실행
  executeAttackAction(monster) {
    const target = monster.aiState.target;
    if (!target || !target.active || target.hp <= 0) {
      monster.aiState.currentState = this.aiStates.IDLE;
      return;
    }

    // 거리 확인
    const distance = Phaser.Math.Distance.Between(
      monster.x, monster.y, target.x, target.y
    );

    // 공격 범위 밖이면 추적으로 전환
    const attackRange = monster.aiPattern.attackRange || 1.5;
    if (distance > attackRange) {
      monster.aiState.currentState = this.aiStates.CHASE;
      return;
    }

    // 타겟 방향으로 몬스터 회전
    const angle = Phaser.Math.Angle.Between(
      monster.x, monster.y, target.x, target.y
    );
    this.updateMonsterDirection(monster, angle);

    // 마지막 공격 시간 확인
    const now = Date.now();
    const attackCooldown = 1000 / (monster.attackSpeed || 1);

    if (now - monster.aiState.lastAttackTime < attackCooldown) {
      return; // 아직 공격 쿨다운 중
    }

    // 공격 실행
    this.monsterAttack(monster, target);
    monster.aiState.lastAttackTime = now;

    // 공격 후 키팅 행동 (원거리 적)
    if (monster.aiPattern.kiting) {
      monster.aiState.currentState = this.aiStates.FLEE;
      monster.aiState.lastStateChange = Date.now();
      monster.aiState.fleeTime = 1000; // 짧은 도망 시간
    }
  }

  // 도망 행동 실행
  executeFleeAction(monster) {
    const target = monster.aiState.target;

    // 도망칠 타겟이 없으면 대기 상태로
    if (!target || !target.active) {
      monster.aiState.currentState = this.aiStates.IDLE;
      return;
    }

    // 도망 방향 계산 (타겟으로부터 반대 방향)
    const angle = Phaser.Math.Angle.Between(
      target.x, target.y, monster.x, monster.y
    );

    // 도망 속도 (일반 속도보다 약간 빠름)
    const speed = this.getMonsterSpeed(monster) * 1.2;
    monster.x += Math.cos(angle) * speed;
    monster.y += Math.sin(angle) * speed;

    // 이동 방향에 따른 스프라이트 방향 설정
    this.updateMonsterDirection(monster, angle);

    // 일정 시간 또는 충분한 거리가 확보되면 다른 상태로 전환
    const fleeTime = monster.aiState.fleeTime || 2000; // 기본 2초

    if (Date.now() - monster.aiState.lastStateChange > fleeTime) {
      if (monster.hp / monster.maxHp < (monster.aiPattern.fleeThreshold || this.aiConfig.fleeThreshold)) {
        // 체력이 여전히 낮으면 계속 도망
        monster.aiState.lastStateChange = Date.now();
      } else {
        // 충분히 도망쳤으면 다른 상태로 전환
        this.decideMonsterState(monster);
      }
    }
  }

  // 특수 능력 행동 실행
  executeSpecialAction(monster) {
    // 특수 능력이 없으면 공격 상태로
    if (!monster.specialAbilities || monster.specialAbilities.length === 0) {
      monster.aiState.currentState = this.aiStates.ATTACK;
      return;
    }

    const target = monster.aiState.target;
    if (!target || !target.active || target.hp <= 0) {
      monster.aiState.currentState = this.aiStates.IDLE;
      return;
    }

    // 마지막 특수 능력 사용 시간 확인
    const now = Date.now();
    const specialCooldown = monster.aiPattern.specialCooldown || 8000; // 기본 8초

    if (now - monster.aiState.lastSpecialTime < specialCooldown) {
      // 아직 특수 능력 쿨다운 중이면 다른 행동
      monster.aiState.currentState = this.aiStates.ATTACK;
      return;
    }

    // 사용할 특수 능력 선택
    const ability = this.selectSpecialAbility(monster);

    if (ability) {
      // 특수 능력 사용
      this.useMonsterSpecialAbility(monster, ability, target);
      monster.aiState.lastSpecialTime = now;
    } else {
      // 사용할 능력이 없으면 공격 상태로
      monster.aiState.currentState = this.aiStates.ATTACK;
    }
  }

  // 소환 행동 실행
  executeSummonAction(monster) {
    // 소환 능력이 없으면 다른 상태로
    const summonAbility = this.getMonsterSummonAbility(monster);
    if (!summonAbility) {
      monster.aiState.currentState = this.aiStates.ATTACK;
      return;
    }

    // 이미 최대 소환 수에 도달했는지 확인
    const summonLimit = monster.aiPattern.summonLimit || 3;
    if (monster.aiState.summonedEntities && monster.aiState.summonedEntities.length >= summonLimit) {
      monster.aiState.currentState = this.aiStates.ATTACK;
      return;
    }

    // 마지막 소환 시간 확인
    const now = Date.now();
    const summonCooldown = monster.aiPattern.summonCooldown || 15000; // 기본 15초

    if (now - monster.aiState.lastSummonTime < summonCooldown) {
      // 아직 소환 쿨다운 중이면 다른 행동
      monster.aiState.currentState = this.aiStates.ATTACK;
      return;
    }

    // 소환 실행
    this.performMonsterSummon(monster, summonAbility);
    monster.aiState.lastSummonTime = now;

    // 소환 후 다른 상태로 전환
    monster.aiState.currentState = this.aiStates.ATTACK;
  }

  // 치유 행동 실행
  executeHealAction(monster) {
    // 치유 능력이 없으면 다른 상태로
    const healAbility = this.getMonsterHealAbility(monster);
    if (!healAbility && !monster.aiPattern.healingAura) {
      monster.aiState.currentState = this.aiStates.ATTACK;
      return;
    }

    // 마지막 치유 시간 확인
    const now = Date.now();
    const healCooldown = monster.aiPattern.healCooldown || 8000; // 기본 8초

    if (now - monster.aiState.lastHealTime < healCooldown) {
      // 아직 치유 쿨다운 중이면 다른 행동
      monster.aiState.currentState = this.aiStates.ATTACK;
      return;
    }

    // 자신이나 동료 중 치유가 필요한 대상 찾기
    const healTarget = this.findHealTarget(monster);

    if (healTarget) {
      // 치유 실행
      if (healAbility) {
        this.useMonsterHealAbility(monster, healAbility, healTarget);
      } else if (monster.aiPattern.healingAura) {
        this.useHealingAura(monster);
      }
      monster.aiState.lastHealTime = now;
    }

    // 치유 후 다른 상태로 전환
    monster.aiState.currentState = this.aiStates.ATTACK;
  }

  // 몬스터 이동 속도 계산
  getMonsterSpeed(monster) {
    // 기본 이동 속도 계산
    let baseSpeed = monster.stats.speed / 100 || 0.05;

    // 이동 속도 배율 적용
    const speedModifier = monster.speedModifier || 1.0;
    const patternSpeedModifier = monster.aiPattern.movementSpeed || 1.0;

    // 최종 이동 속도
    return baseSpeed * speedModifier * patternSpeedModifier;
  }

  // 몬스터 방향 업데이트
  updateMonsterDirection(monster, angle) {
    // 각도에 따른 방향 설정 (스프라이트 애니메이션 변경)
    // 예: 좌측, 우측, 위, 아래 방향 등

    // 방향을 8방향으로 나눔
    const degrees = Phaser.Math.RadToDeg(angle);
    let direction = '';

    if (degrees >= -22.5 && degrees < 22.5) {
      direction = 'right';
    } else if (degrees >= 22.5 && degrees < 67.5) {
      direction = 'down_right';
    } else if (degrees >= 67.5 && degrees < 112.5) {
      direction = 'down';
    } else if (degrees >= 112.5 && degrees < 157.5) {
      direction = 'down_left';
    } else if (degrees >= 157.5 || degrees < -157.5) {
      direction = 'left';
    } else if (degrees >= -157.5 && degrees < -112.5) {
      direction = 'up_left';
    } else if (degrees >= -112.5 && degrees < -67.5) {
      direction = 'up';
    } else if (degrees >= -67.5 && degrees < -22.5) {
      direction = 'up_right';
    }

    // 몬스터 방향 속성 설정
    monster.direction = direction;

    // 몬스터 애니메이션 업데이트 (구현된 경우)
    if (monster.sprite && monster.sprite.anims) {
      const anim = `${monster.monsterId}_${direction}`;
      if (monster.sprite.anims.exists(anim)) {
        monster.sprite.anims.play(anim, true);
      }
    }
  }

  // 특수 능력 선택
  selectSpecialAbility(monster) {
    const abilities = monster.specialAbilities || [];
    if (abilities.length === 0) return null;

    // 보스의 경우 능력 시퀀스 사용
    if (monster.type === 'boss' && monster.aiPattern.specialSequence) {
      // 순서대로 능력 사용
      monster.abilityIndex = monster.abilityIndex || 0;
      const ability = abilities[monster.abilityIndex];
      monster.abilityIndex = (monster.abilityIndex + 1) % abilities.length;
      return ability;
    }

    // 사용 가능한 능력 필터링
    const availableAbilities = abilities.filter(ability => {
      // 쿨다운 확인
      const lastUsed = ability.lastUsed || 0;
      const cooldown = ability.cooldown * 1000 || 10000; // ms 단위로 변환

      return Date.now() - lastUsed >= cooldown;
    });

    if (availableAbilities.length === 0) return null;

    // 특수한 조건부 능력 확인 (체력 임계치 등)
    const conditionalAbilities = availableAbilities.filter(ability => {
      // 체력 임계치 능력
      if (ability.threshold) {
        const hpRatio = monster.hp / monster.maxHp;
        if (hpRatio <= ability.threshold) {
          return true;
        }
      }
      return false;
    });

    // 조건부 능력이 있으면 우선 사용
    if (conditionalAbilities.length > 0) {
      return conditionalAbilities[Math.floor(Math.random() * conditionalAbilities.length)];
    }

    // 일반 능력 중 하나 선택
    return availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
  }

  // 몬스터 특수 능력 사용
  useMonsterSpecialAbility(monster, ability, target) {
    // 능력 마지막 사용 시간 업데이트
    ability.lastUsed = Date.now();

    // 능력 타입에 따른 처리
    switch (ability.type) {
      case 'ranged_attack':
        this.useRangedAttackAbility(monster, ability, target);
        break;
      case 'melee_attack':
        this.useMeleeAttackAbility(monster, ability, target);
        break;
      case 'aoe':
        this.useAOEAbility(monster, ability, target);
        break;
      case 'buff':
        this.useBuffAbility(monster, ability);
        break;
      case 'debuff':
        this.useDebuffAbility(monster, ability, target);
        break;
      case 'summon':
        this.useSummonAbility(monster, ability);
        break;
      case 'utility':
        this.useUtilityAbility(monster, ability, target);
        break;
      case 'transform':
        this.useTransformAbility(monster, ability);
        break;
      default:
        console.warn(`Unknown ability type: ${ability.type}`);
    }

    // 능력 사용 효과음 및 애니메이션
    this.scene.effects.playAbilityEffect(monster, ability);
  }

  // 원거리 공격 능력 사용
  useRangedAttackAbility(monster, ability, target) {
    // 대미지 계산
    const damageMultiplier = ability.damageMultiplier || 1.0;
    const baseDamage = monster.attack * damageMultiplier;

    // 속성 요소 적용
    const element = ability.element || monster.element || 'neutral';

    // 크리티컬 확인
    const isCritical = Math.random() < (ability.criticalChance || 0.05);

    // 대미지 적용
    this.dealDamage(monster, target, baseDamage, element, isCritical);

    // 다중 공격 (여러 발의 투사체)
    if (ability.count && ability.count > 1) {
      for (let i = 1; i < ability.count; i++) {
        // 약간의 딜레이 후 추가 공격
        this.scene.time.delayedCall(i * 200, () => {
          if (monster.active && target.active && target.hp > 0) {
            const damage = baseDamage * 0.7; // 추가 공격은 약간 약화
            this.dealDamage(monster, target, damage, element, false);
          }
        });
      }
    }

    // 특수 효과 적용 (knockback, slow 등)
    if (ability.knockback) {
      this.applyKnockback(target, monster, ability.knockbackDistance || 3);
    }

    if (ability.slow) {
      this.addStatusEffect(monster, target, 'slow', ability.slow.value, ability.slow.duration);
    }

    // 생명력 흡수 효과
    if (ability.lifeSteal) {
      const healAmount = baseDamage * ability.lifeSteal;
      this.healTarget(monster, healAmount);
    }
  }

  // 근접 공격 능력 사용
  useMeleeAttackAbility(monster, ability, target) {
    // 대미지 계산
    const damageMultiplier = ability.damageMultiplier || 1.0;
    const baseDamage = monster.attack * damageMultiplier;

    // 속성 요소 적용
    const element = ability.element || monster.element || 'neutral';

    // 크리티컬 확인
    const isCritical = Math.random() < (ability.criticalChance || 0.05);

    // 대미지 적용
    this.dealDamage(monster, target, baseDamage, element, isCritical);

    // 특수 효과 적용
    if (ability.stun && Math.random() < ability.stun.chance) {
      this.addStatusEffect(monster, target, 'stun', 1, ability.stun.duration);
    }

    if (ability.bleed && Math.random() < ability.bleed.chance) {
      this.addStatusEffect(monster, target, 'bleed', ability.bleed.value || monster.attack * 0.2, ability.bleed.duration || 3);
    }

    // 생명력 흡수 효과
    if (ability.lifeSteal) {
      const healAmount = baseDamage * ability.lifeSteal;
      this.healTarget(monster, healAmount);
    }
  }

  // 광역 공격 능력 사용
  useAOEAbility(monster, ability, target) {
    // 영향 범위 내의 대상 찾기
    const radius = ability.radius || 3;
    const center = target ? { x: target.x, y: target.y } : { x: monster.x, y: monster.y };

    const targets = [this.player]; // 플레이어는 항상 포함

    // 다른 영향받는 대상들 (아군 등) 추가 가능

    // 각 대상에게 대미지 적용
    const damageMultiplier = ability.damageMultiplier || 1.0;
    const baseDamage = monster.attack * damageMultiplier;
    const element = ability.element || monster.element || 'neutral';

    targets.forEach(target => {
      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(center.x, center.y, target.x, target.y);

      if (distance <= radius) {
        // 거리에 따른 대미지 감소 (선택적)
        const distanceFactor = ability.distanceFalloff ?
          Math.max(0.5, 1 - (distance / radius)) : 1;

        // 대미지 적용
        const finalDamage = baseDamage * distanceFactor;
        const isCritical = Math.random() < (ability.criticalChance || 0.05);

        this.dealDamage(monster, target, finalDamage, element, isCritical);

        // 상태 효과 적용
        if (ability.effectType === 'stun' && Math.random() < (ability.chance || 0.3)) {
          this.addStatusEffect(monster, target, 'stun', 1, ability.duration || 2);
        }

        if (ability.effectType === 'slow' && Math.random() < (ability.chance || 0.5)) {
          this.addStatusEffect(monster, target, 'slow', ability.slow || 30, ability.duration || 3);
        }

        if (ability.effectType === 'dot' && Math.random() < (ability.chance || 0.7)) {
          this.addStatusEffect(monster, target, 'dot', ability.damageOverTime || 0.05, ability.duration || 5);
        }
      }
    });

    // 광역 효과 시각화
    this.scene.effects.playAoEEffect(center, radius, element);
  }

  // 버프 능력 사용
  useBuffAbility(monster, ability) {
    // 버프 타입에 따른 처리
    switch (ability.effectType) {
      case 'attack_up':
        monster.attackBuff = (monster.attackBuff || 1) * (1 + ability.value / 100);
        monster.attack *= (1 + ability.value / 100);
        this.addStatusEffect(monster, monster, 'attack_up', ability.value, ability.duration);
        break;
      case 'defense_up':
        monster.defenseBuff = (monster.defenseBuff || 1) * (1 + ability.value / 100);
        monster.defense *= (1 + ability.value / 100);
        this.addStatusEffect(monster, monster, 'defense_up', ability.value, ability.duration);
        break;
      case 'speed_up':
        monster.speedModifier = (monster.speedModifier || 1) * (1 + ability.value / 100);
        this.addStatusEffect(monster, monster, 'speed_up', ability.value, ability.duration);
        break;
      case 'shield':
        monster.shield = (monster.shield || 0) + ability.value;
        this.addStatusEffect(monster, monster, 'shield', ability.value, ability.duration);
        break;
      case 'reflect':
        monster.reflectDamage = (monster.reflectDamage || 0) + ability.value;
        this.addStatusEffect(monster, monster, 'reflect', ability.value, ability.duration);
        break;
    }

    // 버프 효과 시각화
    this.scene.effects.playBuffEffect(monster, ability.element || 'neutral');
  }

  // 디버프 능력 사용
  useDebuffAbility(monster, ability, target) {
    // 디버프 저항 확인
    const resistChance = this.calculateStatusResistChance(target, ability.effectType);

    if (Math.random() < resistChance) {
      // 저항 성공
      this.showDamageNumber(target, 'RESIST', 0xAAAAAA);
      return;
    }

    // 디버프 타입에 따른 처리
    switch (ability.effectType) {
      case 'fear':
        this.addStatusEffect(monster, target, 'fear', ability.value || 25, ability.duration || 3);
        break;
      case 'slow':
        this.addStatusEffect(monster, target, 'slow', ability.value || 30, ability.duration || 4);
        break;
      case 'root':
      case 'snare':
        this.addStatusEffect(monster, target, 'root', 1, ability.duration || 2);
        break;
      case 'blind':
        this.addStatusEffect(monster, target, 'blind', 1, ability.duration || 3);
        break;
      case 'confusion':
        this.addStatusEffect(monster, target, 'confusion', 1, ability.duration || 4);
        break;
    }

    // 디버프 효과 시각화
    this.scene.effects.playDebuffEffect(target, ability.element || 'neutral');
  }

  // 소환 능력 사용
  useSummonAbility(monster, ability) {
    // 최대 소환 수 확인
    const summonLimit = monster.aiPattern.summonLimit || 3;
    if (!monster.aiState.summonedEntities) {
      monster.aiState.summonedEntities = [];
    }

    if (monster.aiState.summonedEntities.length >= summonLimit) {
      return;
    }

    // 소환할 몬스터 수
    const count = ability.count || 1;

    // 소환 타입
    const summonType = ability.summonType || 'minion';

    // 소환물 생성
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 300, () => {
        if (!monster.active) return;

        // 소환 위치 결정 (몬스터 주변)
        const angle = Math.random() * Math.PI * 2;
        const distance = Phaser.Math.Between(1, 3);
        const x = monster.x + Math.cos(angle) * distance;
        const y = monster.y + Math.sin(angle) * distance;

        // 소환물 생성
        const minion = this.createSummonedMinion(monster, summonType, x, y);

        if (minion) {
          // 소환물 등록
          monster.aiState.summonedEntities.push(minion);

          // 소환 효과 시각화
          this.scene.effects.playSummonEffect({ x, y }, summonType);
        }
      });
    }
  }

  // 소환물 생성
  createSummonedMinion(master, type, x, y) {
    // 몬스터 데이터 찾기
    let monsterData = this.scene.cache.json.get('monsters')?.find(m => m.id === type);

    if (!monsterData) {
      // 기본 미니언 데이터 사용
      monsterData = {
        id: 'minion',
        type: 'minion',
        name: '하수인',
        baseStats: {
          hp: 20,
          attack: 5,
          defense: 2,
          speed: 70
        },
        element: master.element,
        attackType: master.attackType
      };
    }

    // 몬스터 레벨 계산
    const level = master.level || 1;

    // 기본 스탯 계산
    const hp = monsterData.baseStats.hp + (monsterData.growthRate?.hp || 1) * level;
    const attack = monsterData.baseStats.attack + (monsterData.growthRate?.attack || 0.5) * level;
    const defense = monsterData.baseStats.defense + (monsterData.growthRate?.defense || 0.2) * level;
    const speed = monsterData.baseStats.speed + (monsterData.growthRate?.speed || 0.5) * level;

    // 소환물 객체 생성
    const minion = {
      x,
      y,
      monsterId: monsterData.id,
      name: monsterData.name,
      type: 'minion',
      element: monsterData.element || master.element,
      attackType: monsterData.attackType || master.attackType,
      level,
      hp,
      maxHp: hp,
      attack,
      defense,
      speed,
      master, // 주인 참조
      active: true
    };

    // 소환물 AI 패턴 설정
    this.assignMonsterAIPattern(minion);

    // 소환물을 적 목록에 추가
    this.enemies.push(minion);

    return minion;
  }

  // 유틸리티 능력 사용
  useUtilityAbility(monster, ability, target) {
    switch (ability.effectType) {
      case 'teleport':
        // 순간이동
        if (target) {
          // 타겟 주변으로 이동
          const angle = Math.random() * Math.PI * 2;
          const distance = Phaser.Math.Between(1, 2);
          monster.x = target.x + Math.cos(angle) * distance;
          monster.y = target.y + Math.sin(angle) * distance;

          // 텔레포트 이펙트
          this.scene.effects.playTeleportEffect(monster, { x: monster.x, y: monster.y }, { x: target.x, y: target.y });
        }
        break;
      case 'escape':
        // 도망
        if (target) {
          // 타겟에서 반대 방향으로 이동
          const angle = Phaser.Math.Angle.Between(target.x, target.y, monster.x, monster.y);
          const distance = ability.distance || 5;
          monster.x += Math.cos(angle) * distance;
          monster.y += Math.sin(angle) * distance;

          // 도망 이펙트
          this.scene.effects.playEscapeEffect(monster);
        }
        break;
      case 'stealth':
        // 은신
        monster.isStealthed = true;
        this.addStatusEffect(monster, monster, 'stealth', 1, ability.duration || 5);

        // 은신 이펙트
        this.scene.effects.playStealthEffect(monster);
        break;
    }
  }

  // 변신 능력 사용
  useTransformAbility(monster, ability) {
    // 변신 상태 적용
    monster.isTransformed = true;

    // 스탯 강화
    const statBoost = ability.statBoost || 1.5;
    monster.attack *= statBoost;
    monster.defense *= statBoost;
    monster.speedModifier = (monster.speedModifier || 1) * statBoost;

    // 시각적 변환 효과
    this.scene.effects.playTransformEffect(monster);

    // 변신 지속시간 설정
    const duration = ability.duration || 15; // 초 단위

    // 지속시간 후 원래 형태로 복귀
    this.scene.time.delayedCall(duration * 1000, () => {
      if (monster.active) {
        monster.isTransformed = false;
        monster.attack /= statBoost;
        monster.defense /= statBoost;
        monster.speedModifier = (monster.speedModifier || 1) / statBoost;

        // 변신 해제 효과
        this.scene.effects.playDetransformEffect(monster);
      }
    });
  }

  // 몬스터 소환 능력 가져오기
  getMonsterSummonAbility(monster) {
    // 특수 능력에서 소환 능력 찾기
    if (monster.specialAbilities) {
      const summonAbility = monster.specialAbilities.find(ability => ability.type === 'summon');
      if (summonAbility) return summonAbility;
    }

    // 일반 능력에서 소환 능력 찾기
    if (monster.abilities) {
      const summonAbility = monster.abilities.find(ability => ability.type === 'summon');
      if (summonAbility) return summonAbility;
    }

    return null;
  }

  // 몬스터 치유 능력 가져오기
  getMonsterHealAbility(monster) {
    // 특수 능력에서 치유 능력 찾기
    if (monster.specialAbilities) {
      const healAbility = monster.specialAbilities.find(ability => ability.type === 'heal');
      if (healAbility) return healAbility;
    }

    // 일반 능력에서 치유 능력 찾기
    if (monster.abilities) {
      const healAbility = monster.abilities.find(ability => ability.type === 'heal');
      if (healAbility) return healAbility;
    }

    return null;
  }

  // 치유 대상 찾기
  findHealTarget(monster) {
    // 자신의 체력이 낮으면 자신을 치유
    const selfHpRatio = monster.hp / monster.maxHp;
    const healThreshold = monster.aiPattern.healThreshold || 0.6;

    if (selfHpRatio < healThreshold) {
      return monster;
    }

    // 주변 아군 중 체력이 가장 낮은 대상 찾기
    const healRange = monster.aiPattern.healRange || 8;
    let lowestHpRatio = 1.0;
    let healTarget = null;

    this.enemies.forEach(ally => {
      if (ally !== monster && ally.active && ally.hp > 0) {
        const distance = Phaser.Math.Distance.Between(monster.x, monster.y, ally.x, ally.y);

        if (distance <= healRange) {
          const allyHpRatio = ally.hp / ally.maxHp;

          if (allyHpRatio < healThreshold && allyHpRatio < lowestHpRatio) {
            lowestHpRatio = allyHpRatio;
            healTarget = ally;
          }
        }
      }
    });

    return healTarget || monster;
  }

  // 치유 오라 사용
  useHealingAura(monster) {
    // 치유 범위
    const range = monster.aiPattern.healingAura.radius || 4;

    // 치유량
    const healAmount = monster.maxHp * (monster.aiPattern.healingAura.amount || 0.05);

    // 범위 내 아군 찾기
    this.enemies.forEach(ally => {
      if (ally.active && ally.hp > 0) {
        const distance = Phaser.Math.Distance.Between(monster.x, monster.y, ally.x, ally.y);

        if (distance <= range) {
          // 치유 적용
          this.healTarget(ally, healAmount);
        }
      }
    });

    // 치유 오라 효과 시각화
    this.scene.effects.playHealingAuraEffect(monster, range);
  }

  // 몬스터 치유 능력 사용
  useMonsterHealAbility(monster, ability, target) {
    // 치유량 계산
    let healAmount = 0;

    if (ability.healAmount) {
      // 비율 기반 치유
      if (typeof ability.healAmount === 'number' && ability.healAmount <= 1) {
        healAmount = target.maxHp * ability.healAmount;
      }
      // 고정값 치유
      else {
        healAmount = ability.healAmount;
      }
    }
    // 공격력 기반 치유
    else {
      healAmount = monster.attack * (ability.healMultiplier || 1.0);
    }

    // 치유 적용
    this.healTarget(target, healAmount);

    // 지속 회복 효과
    if (ability.duration && ability.duration > 0) {
      this.addStatusEffect(monster, target, 'regeneration', healAmount / ability.duration, ability.duration);
    }

    // 치유 효과 시각화
    this.scene.effects.playHealEffect(target);
  }

  // 사망 시 폭발 효과 생성
  createDeathExplosion(monster) {
    if (!monster.aiPattern.explosionOnDeath) return;

    // 폭발 범위 및 대미지
    const range = monster.aiPattern.explosionOnDeath.range || 3;
    const damage = monster.aiPattern.explosionOnDeath.damage || monster.attack;

    // 범위 내 대상 찾기
    const targets = this.findEntitiesInRadius(monster, range, 'player');

    // 대미지 적용
    targets.forEach(target => {
      this.dealDamage(monster, target, damage, 'fire', false, false);
    });

    // 폭발 효과 시각화
    this.scene.effects.playExplosionEffect(monster, range, 'fire');
  }

  // 독 구름 생성
  createPoisonCloud(monster) {
    if (!monster.aiPattern.poisonCloud) return;

    // 독 구름 범위 및 지속시간
    const radius = monster.aiPattern.poisonCloud.radius || 2;
    const duration = monster.aiPattern.poisonCloud.duration || 4;

    // 시각 효과
    this.scene.effects.playPoisonCloudEffect(monster, radius, duration);

    // 독 구름 영역 생성
    const poisonCloud = {
      x: monster.x,
      y: monster.y,
      radius,
      damage: monster.attack * 0.2, // 독 구름 대미지
      element: 'poison',
      duration,
      tickInterval: 1, // 초당 대미지
      lastTick: Date.now(),
      source: monster
    };

    // 독 구름 목록에 추가
    this.scene.poisonClouds = this.scene.poisonClouds || [];
    this.scene.poisonClouds.push(poisonCloud);

    // 지속시간 후 제거
    this.scene.time.delayedCall(duration * 1000, () => {
      const index = this.scene.poisonClouds.indexOf(poisonCloud);
      if (index !== -1) {
        this.scene.poisonClouds.splice(index, 1);
      }
    });
  }

  // 범위 내 엔티티 찾기
  findEntitiesInRadius(center, radius, team) {
    const entities = [];

    // 대상 리스트 결정
    if (team === 'player') {
      // 플레이어 팀 (플레이어 자신만)
      if (this.player && this.player.active && this.player.hp > 0) {
        const distance = Phaser.Math.Distance.Between(
          center.x, center.y, this.player.x, this.player.y
        );

        if (distance <= radius) {
          entities.push(this.player);
        }
      }
    } else if (team === 'enemy') {
      // 적 팀 (모든 몬스터)
      this.enemies.forEach(enemy => {
        if (enemy.active && enemy.hp > 0) {
          const distance = Phaser.Math.Distance.Between(
            center.x, center.y, enemy.x, enemy.y
          );

          if (distance <= radius) {
            entities.push(enemy);
          }
        }
      });
    } else {
      // 모든 엔티티
      if (this.player && this.player.active && this.player.hp > 0) {
        const distance = Phaser.Math.Distance.Between(
          center.x, center.y, this.player.x, this.player.y
        );

        if (distance <= radius) {
          entities.push(this.player);
        }
      }

      this.enemies.forEach(enemy => {
        if (enemy.active && enemy.hp > 0) {
          const distance = Phaser.Math.Distance.Between(
            center.x, center.y, enemy.x, enemy.y
          );

          if (distance <= radius) {
            entities.push(enemy);
          }
        }
      });
    }

    return entities;
  }

  // 넉백 효과 적용
  applyKnockback(target, source, distance) {
    // 방향 계산
    const angle = Phaser.Math.Angle.Between(
      source.x, source.y, target.x, target.y
    );

    // 새 위치 계산
    target.x += Math.cos(angle) * distance;
    target.y += Math.sin(angle) * distance;

    // 넉백 효과 시각화
    this.scene.effects.playKnockbackEffect(target, angle);
  }

  // 상태 효과 처리
  processStatusEffects() {
    // 각 상태 효과 처리
    for (let i = this.activeStatusEffects.length - 1; i >= 0; i--) {
      const effect = this.activeStatusEffects[i];

      // 대상 또는 적용자가 비활성 상태면 효과 제거
      if (!effect.target.active || (effect.source && !effect.source.active)) {
        this.removeStatusEffect(effect);
        continue;
      }

      // 효과 틱 적용
      this.applyStatusEffectTick(effect);

      // 지속시간 감소
      effect.duration -= this.config.statusEffectInterval / 1000;

      // 효과 만료 확인
      if (effect.duration <= 0) {
        this.removeStatusEffect(effect);
      }
    }

    // 독 구름 처리
    if (this.scene.poisonClouds) {
      this.scene.poisonClouds.forEach(cloud => {
        const now = Date.now();
        if (now - cloud.lastTick >= cloud.tickInterval * 1000) {
          // 구름 범위 내 엔티티 대상으로 대미지 적용
          const targets = this.findEntitiesInRadius(cloud, cloud.radius, 'player');
          targets.forEach(target => {
            this.dealDamage(cloud.source, target, cloud.damage, cloud.element, false, true);
          });

          cloud.lastTick = now;
        }
      });
    }

    // 상태 UI 업데이트
    this.scene.updateStatusUI();
  }

  // 상태 효과 틱 적용
  applyStatusEffectTick(effect) {
    const target = effect.target;
    const type = effect.type;

    switch (type) {
      case 'burn':
        // 화상 - 시간당 HP 감소
        this.dealDamage(effect.source, target, effect.value, 'fire', false, true);
        break;

      case 'poison':
        // 중독 - 시간당 HP 감소
        this.dealDamage(effect.source, target, effect.value, 'poison', false, true);
        break;

      case 'bleed':
        // 출혈 - 시간당 HP 감소
        this.dealDamage(effect.source, target, effect.value, 'physical', false, true);
        break;

      case 'regeneration':
        // 재생 - 시간당 HP 회복
        this.healTarget(target, effect.value);
        break;

      case 'mana_regen':
        // 마나 재생
        if (target.stats && target.stats.mp < target.stats.maxMp) {
          target.stats.mp = Math.min(target.stats.mp + effect.value, target.stats.maxMp);
        }
        break;

      case 'attack_up':
      case 'defense_up':
      case 'speed_up':
      case 'slow':
      case 'stun':
      case 'root':
      case 'blind':
      case 'fear':
      case 'confusion':
      case 'stealth':
      case 'shield':
        // 지속 효과들은 틱마다 처리할 필요 없음
        // 효과 적용/제거는 addStatusEffect/removeStatusEffect에서 처리
        break;

      default:
        // 처리되지 않은 상태 효과 타입
        console.warn(`Unhandled status effect type: ${type}`);
    }
  }

  // 상태 효과 추가
  addStatusEffect(source, target, type, value, duration) {
    // 이미 같은 타입의 효과가 있는지 확인
    const existingEffect = this.activeStatusEffects.find(
      e => e.target === target && e.type === type
    );

    if (existingEffect) {
      // 기존 효과 갱신 (더 강한 효과 또는 긴 지속시간 적용)
      if (value > existingEffect.value || duration > existingEffect.duration) {
        existingEffect.value = Math.max(value, existingEffect.value);
        existingEffect.duration = Math.max(duration, existingEffect.duration);
        existingEffect.source = source;

        // 갱신 시각 효과
        this.scene.effects.playStatusEffectRefresh(target, type);
      }
    } else {
      // 새 효과 추가
      this.activeStatusEffects.push({
        source,
        target,
        type,
        value,
        duration,
        startTime: Date.now()
      });

      // 효과 적용 시각 효과
      this.scene.effects.playStatusEffectApply(target, type);

      // 효과 초기 적용
      this.applyInitialStatusEffect(source, target, type, value);
    }

    // 상태 UI 업데이트
    this.scene.updateStatusUI();
  }

  // 초기 상태 효과 적용
  applyInitialStatusEffect(source, target, type, value) {
    switch (type) {
      case 'slow':
        // 감속 효과
        target.speedModifier = target.speedModifier || 1.0;
        target.speedModifier *= (1 - value / 100);
        break;

      case 'stun':
        // 기절 효과
        target.isStunned = true;
        this.scene.effects.playStunEffect(target);
        break;

      case 'root':
        // 속박 효과
        target.isRooted = true;
        this.scene.effects.playRootEffect(target);
        break;

      case 'blind':
        // 실명 효과
        target.isBlinded = true;
        target.accuracyPenalty = (target.accuracyPenalty || 0) + 0.3; // 30% 명중률 감소
        this.scene.effects.playBlindEffect(target);
        break;

      case 'fear':
        // 공포 효과
        target.isFeared = true;
        target.attackPenalty = (target.attackPenalty || 0) + (value / 100); // 공격력 감소
        target.defensePenalty = (target.defensePenalty || 0) + (value / 100); // 방어력 감소
        this.scene.effects.playFearEffect(target);
        break;

      case 'confusion':
        // 혼란 효과
        target.isConfused = true;
        this.scene.effects.playConfusionEffect(target);
        break;

      case 'stealth':
        // 은신 효과
        target.isStealthed = true;
        this.scene.effects.playStealthEffect(target);
        break;

      case 'shield':
        // 보호막 효과
        target.shield = (target.shield || 0) + value;
        this.scene.effects.playShieldEffect(target);
        break;

      case 'attack_up':
        // 공격력 증가
        target.attackBoost = (target.attackBoost || 1) * (1 + value / 100);
        if (target.stats && target.stats.attack) {
          target.stats.attack *= (1 + value / 100);
        }
        this.scene.effects.playBuffEffect(target, 'attack');
        break;

      case 'defense_up':
        // 방어력 증가
        target.defenseBoost = (target.defenseBoost || 1) * (1 + value / 100);
        if (target.stats && target.stats.defense) {
          target.stats.defense *= (1 + value / 100);
        }
        this.scene.effects.playBuffEffect(target, 'defense');
        break;

      case 'speed_up':
        // 속도 증가
        target.speedModifier = (target.speedModifier || 1) * (1 + value / 100);
        this.scene.effects.playBuffEffect(target, 'speed');
        break;
    }
  }

  // 상태 효과 제거
  removeStatusEffect(effect) {
    const index = this.activeStatusEffects.indexOf(effect);
    if (index === -1) return;

    const { target, type, value } = effect;

    // 효과 제거 전 정리 작업
    switch (type) {
      case 'slow':
        // 감속 효과 제거
        if (target.speedModifier) {
          // 정확한 복원을 위해 원래 속도의 비율로 계산
          target.speedModifier = target.speedModifier / (1 - value / 100);
        }
        break;

      case 'stun':
        // 기절 효과 제거
        target.isStunned = false;
        break;

      case 'root':
        // 속박 효과 제거
        target.isRooted = false;
        break;

      case 'blind':
        // 실명 효과 제거
        target.isBlinded = false;
        target.accuracyPenalty = (target.accuracyPenalty || 0) - 0.3;
        break;

      case 'fear':
        // 공포 효과 제거
        target.isFeared = false;
        target.attackPenalty = (target.attackPenalty || 0) - (value / 100);
        target.defensePenalty = (target.defensePenalty || 0) - (value / 100);
        break;

      case 'confusion':
        // 혼란 효과 제거
        target.isConfused = false;
        break;

      case 'stealth':
        // 은신 효과 제거
        target.isStealthed = false;
        break;

      case 'shield':
        // 보호막 효과 제거
        target.shield = 0;
        break;

      case 'attack_up':
        // 공격력 증가 제거
        if (target.attackBoost) {
          target.attackBoost = target.attackBoost / (1 + value / 100);
          if (target.stats && target.stats.attack) {
            target.stats.attack /= (1 + value / 100);
          }
        }
        break;

      case 'defense_up':
        // 방어력 증가 제거
        if (target.defenseBoost) {
          target.defenseBoost = target.defenseBoost / (1 + value / 100);
          if (target.stats && target.stats.defense) {
            target.stats.defense /= (1 + value / 100);
          }
        }
        break;

      case 'speed_up':
        // 속도 증가 제거
        if (target.speedModifier) {
          target.speedModifier = target.speedModifier / (1 + value / 100);
        }
        break;
    }

    // 배열에서 효과 제거
    this.activeStatusEffects.splice(index, 1);

    // 효과 제거 시각 효과
    this.scene.effects.playStatusEffectRemove(target, type);

    // 상태 UI 업데이트
    this.scene.updateStatusUI();
  }

  // 상태 이상 저항 확률 계산
  calculateStatusResistChance(target, statusType) {
    // 기본 저항 확률
    let baseResistChance = 0;

    // 타겟의 상태 저항 확인
    if (target.combatStats?.statusResistance) {
      baseResistChance = target.combatStats.statusResistance / 100;
    }

    // 특정 상태에 대한 추가 저항
    if (target.combatStats?.specificResistances?.[statusType]) {
      baseResistChance += target.combatStats.specificResistances[statusType] / 100;
    }

    // 최종 저항 확률 (최소 0%, 최대 90%)
    return Math.min(0.9, Math.max(0, baseResistChance));
  }

  // 대미지 처리
  dealDamage(attacker, target, baseDamage, damageType = 'physical', isCritical = false, isDoT = false) {
    // 대상이 이미 죽었는지 확인
    if (!target.active || target.hp <= 0) return 0;

    // 회피 확인 (상태 효과가 아닌 경우만)
    if (!isDoT && this.checkDodge(attacker, target)) {
      // 회피 성공
      this.showDamageNumber(target, 'MISS', 0xFFFFFF);
      this.scene.effects.playDodgeEffect(target);
      return 0;
    }

    // 방어력 및 속성 저항을 고려한 대미지 계산
    let finalDamage = this.calculateDamage(attacker, target, baseDamage, damageType, isCritical);

    // 보호막 처리
    if (target.shield && target.shield > 0) {
      const shieldAbsorb = Math.min(target.shield, finalDamage);
      finalDamage -= shieldAbsorb;
      target.shield -= shieldAbsorb;

      // 보호막 파괴 효과
      if (target.shield <= 0) {
        this.scene.effects.playShieldBreakEffect(target);
      } else {
        this.scene.effects.playShieldHitEffect(target);
      }
    }

    // 대미지 반사 처리
    if (target.reflectDamage && !isDoT) {
      const reflectAmount = finalDamage * (target.reflectDamage / 100);
      if (reflectAmount > 0 && attacker.active && attacker.hp > 0) {
        this.dealDamage(target, attacker, reflectAmount, damageType, false, true);
        this.scene.effects.playReflectEffect(target, attacker);
      }
    }

    // 대미지 적용
    target.hp -= finalDamage;

    // 콤보 시스템 업데이트 (플레이어 공격인 경우)
    if (attacker === this.player && !isDoT) {
      this.updateCombo();
    }

    // 대미지 숫자 표시
    const color = this.getDamageColor(damageType, isCritical);
    this.showDamageNumber(target, finalDamage, color);

    // 피격 효과
    if (!isDoT) {
      this.scene.effects.playHitEffect(target, damageType);
    }

    // 사망 확인
    if (target.hp <= 0) {
      this.handleEntityDeath(attacker, target);
    }

    return finalDamage;
  }

  // 대미지 계산
  calculateDamage(attacker, target, baseDamage, damageType, isCritical) {
    // 기본 대미지에 무작위 변동 적용 (±20%)
    const variance = 1 + (Math.random() * this.config.damageVariance * 2 - this.config.damageVariance);
    let damage = baseDamage * variance;

    // 공격자의 공격 페널티 적용
    if (attacker.attackPenalty) {
      damage *= (1 - attacker.attackPenalty);
    }

    // 치명타 대미지 계산
    if (isCritical) {
      const critMultiplier = attacker.combatStats?.critMultiplier || this.config.baseCritMultiplier;
      damage *= critMultiplier;
    }

    // 콤보 대미지 적용 (플레이어 공격인 경우)
    if (attacker === this.player && attacker.combatStats) {
      damage *= attacker.combatStats.comboMultiplier;
    }

    // 공격자의 특수 효과 적용
    damage = this.applyAttackerSpecialEffects(attacker, target, damage, damageType);

    // 물리 대미지인 경우 방어력 적용
    if (damageType === 'physical') {
      const defense = target.stats?.defense || target.defense || 0;
      // 방어력 공식: 방어력이 높을수록 대미지 감소, 최대 90%까지
      let damageReduction = Math.min(0.9, defense / (defense + 100));

      // 타겟의 방어력 페널티 적용
      if (target.defensePenalty) {
        damageReduction *= (1 - target.defensePenalty);
      }

      damage *= (1 - damageReduction);
    }

    // 속성 저항 적용
    if (damageType !== 'physical' && damageType !== 'true') {
      const resistance = this.getElementalResistance(target, damageType);
      damage *= (1 - resistance / 100);
    }

    // 대미지 감소 효과 적용 (타겟에 있는 경우)
    if (target.damageResistance) {
      damage *= (1 - target.damageResistance);
    }

    // 최소 대미지 보장 (1)
    return Math.max(1, Math.floor(damage));
  }

  // 공격자의 특수 효과 적용
  applyAttackerSpecialEffects(attacker, target, damage, damageType) {
    let modifiedDamage = damage;

    // 공격자의 특수 효과 확인
    const specialEffects = attacker.specialEffects || [];

    specialEffects.forEach(effect => {
      switch (effect.type) {
        case 'life_steal':
          // 생명력 흡수
          if (attacker.hp < attacker.maxHp) {
            const healAmount = Math.floor(damage * (effect.value / 100));
            this.healTarget(attacker, healAmount);
            this.scene.effects.playLifeStealEffect(attacker);
          }
          break;

        case 'execute_damage':
          // 처형 대미지 (체력이 낮은 적에게 추가 대미지)
          if (target.hp / target.maxHp < 0.3) { // 30% 미만 체력
            modifiedDamage *= (1 + effect.value / 100);
            this.scene.effects.playExecuteEffect(target);
          }
          break;

        case 'armor_break':
          // 방어구 관통 (방어력 무시)
          if (damageType === 'physical' && Math.random() < 0.3) { // 30% 확률
            // 방어력 일부 무시
            modifiedDamage *= (1 + effect.value / 100);
            this.scene.effects.playArmorBreakEffect(target);
          }
          break;

        case 'elemental_damage':
          // 속성 대미지 추가
          if (damageType === 'physical' && effect.element) {
            // 속성 대미지 추가 효과
            const elementalDamage = damage * (effect.value / 100);
            const resist = this.getElementalResistance(target, effect.element);
            const finalElementalDamage = elementalDamage * (1 - resist / 100);

            // 추가 대미지 적용
            modifiedDamage += finalElementalDamage;

            // 속성 효과 표시
            this.scene.effects.playElementalEffect(target, effect.element);
          }
          break;
      }
    });

    // 몬스터 속성 효과 (fire, ice 등)
    if (attacker.aiPattern) {
      // 화염 속성 화상 효과
      if (attacker.element === 'fire' && attacker.aiPattern.burnEffect &&
        Math.random() < attacker.aiPattern.burnEffect.chance) {
        const burnDamage = target.maxHp * attacker.aiPattern.burnEffect.damage;
        const burnDuration = attacker.aiPattern.burnEffect.duration || 3;
        this.addStatusEffect(attacker, target, 'burn', burnDamage, burnDuration);
      }

      // 얼음 속성 감속/빙결 효과
      if (attacker.element === 'ice') {
        // 감속 효과
        if (attacker.aiPattern.slowEffect && Math.random() < attacker.aiPattern.slowEffect.chance) {
          const slowAmount = attacker.aiPattern.slowEffect.amount * 100 || 30;
          const slowDuration = attacker.aiPattern.slowEffect.duration || 2;
          this.addStatusEffect(attacker, target, 'slow', slowAmount, slowDuration);
        }

        // 빙결 효과
        if (attacker.aiPattern.freezeEffect && Math.random() < attacker.aiPattern.freezeEffect.chance) {
          const freezeDuration = attacker.aiPattern.freezeEffect.duration || 1;
          this.addStatusEffect(attacker, target, 'stun', 1, freezeDuration);
          this.scene.effects.playFreezeEffect(target);
        }
      }

      // 번개 속성 기절 효과
      if (attacker.element === 'lightning' && attacker.aiPattern.stunEffect &&
        Math.random() < attacker.aiPattern.stunEffect.chance) {
        const stunDuration = attacker.aiPattern.stunEffect.duration || 1;
        this.addStatusEffect(attacker, target, 'stun', 1, stunDuration);
      }

      // 독 속성 중독 효과
      if (attacker.element === 'poison' && attacker.aiPattern.dotEffect &&
        Math.random() < attacker.aiPattern.dotEffect.chance) {
        const poisonDamage = target.maxHp * attacker.aiPattern.dotEffect.damage;
        const poisonDuration = attacker.aiPattern.dotEffect.duration || 5;
        this.addStatusEffect(attacker, target, 'poison', poisonDamage, poisonDuration);
      }

      // 암흑 속성 공포 효과
      if (attacker.element === 'dark' && attacker.aiPattern.fearEffect &&
        Math.random() < attacker.aiPattern.fearEffect.chance) {
        const fearValue = 25; // 공격력/방어력 25% 감소
        const fearDuration = attacker.aiPattern.fearEffect.duration || 2;
        this.addStatusEffect(attacker, target, 'fear', fearValue, fearDuration);
      }

      // 빛 속성 실명 효과
      if (attacker.element === 'light' && attacker.aiPattern.blindEffect &&
        Math.random() < attacker.aiPattern.blindEffect.chance) {
        const blindDuration = attacker.aiPattern.blindEffect.duration || 2;
        this.addStatusEffect(attacker, target, 'blind', 1, blindDuration);
      }
    }

    return modifiedDamage;
  }

  // 속성 저항 계산
  getElementalResistance(target, element) {
    // 대상의 속성 저항 확인
    if (target.combatStats?.elementalResistances &&
      target.combatStats.elementalResistances[element] !== undefined) {
      return target.combatStats.elementalResistances[element];
    }

    // 몬스터의 경우 속성별 약점/저항 확인
    if (target.type === 'monster' || target.type === 'boss' || target.type === 'elite' || target.type === 'minion') {
      // 속성 상성 시스템
      const resistances = {
        fire: { ice: -50, water: -50, fire: 75, earth: 25 },
        ice: { fire: -50, lightning: -25, ice: 75, water: 50 },
        lightning: { earth: -50, water: -50, lightning: 75 },
        earth: { lightning: -50, fire: -25, earth: 75 },
        dark: { light: -75, dark: 75 },
        light: { dark: -75, light: 75 },
        poison: { earth: 50, poison: 75 },
        water: { fire: 50, lightning: -75, water: 75 },
        neutral: {} // 상성 없음
      };

      // 몬스터의 속성
      const monsterElement = target.element || 'neutral';

      // 상성표에서 저항 확인
      if (resistances[monsterElement] && resistances[monsterElement][element] !== undefined) {
        return resistances[monsterElement][element];
      }
    }

    // 기본 저항 없음
    return 0;
  }

  // 회피 확인
  checkDodge(attacker, target) {
    // 기절 상태인 경우 회피 불가
    if (target.isStunned || target.isFrozen) return false;

    // 속박 상태인 경우 회피 불가
    if (target.isRooted) return false;

    // 회피 확률 계산
    const dodgeChance = target.combatStats?.dodgeChance || this.config.baseDodgeChance;

    // 정확도 감소 효과 적용 (공격자에게 있는 경우)
    const accuracyPenalty = attacker.accuracyPenalty || 0;

    // 혼란 상태인 경우 명중률 크게 감소
    let confusedPenalty = 0;
    if (attacker.isConfused) {
      confusedPenalty = 0.3; // 30% 명중률 감소
    }

    // 최종 회피 확률 (최소 1%, 최대 80%)
    const finalDodgeChance = Math.min(0.8, Math.max(0.01, dodgeChance + accuracyPenalty + confusedPenalty));

    // 회피 판정
    return Math.random() < finalDodgeChance;
  }

  // 치명타 확인
  checkCritical(attacker) {
    const critChance = attacker.combatStats?.critChance || 0.05;
    return Math.random() < critChance;
  }

  // 콤보 시스템 업데이트
  updateCombo() {
    const now = Date.now();
    const combatStats = this.player.combatStats;

    // 마지막 공격으로부터 경과 시간
    const timeSinceLastHit = now - combatStats.lastHitTime;

    if (timeSinceLastHit <= this.config.comboDecayTime) {
      // 콤보 증가
      combatStats.comboCounter++;

      // 콤보 배율 계산 (최대 한계 있음)
      combatStats.comboMultiplier = Math.min(
        this.config.maxComboMultiplier,
        1.0 + (combatStats.comboCounter * 0.05)
      );
    } else {
      // 콤보 리셋
      combatStats.comboCounter = 1;
      combatStats.comboMultiplier = 1.0;
    }

    // 타임스탬프 업데이트
    combatStats.lastHitTime = now;

    // 콤보 UI 업데이트
    this.scene.updateComboUI(combatStats.comboCounter, combatStats.comboMultiplier);
  }

  // 치유 처리
  healTarget(target, amount) {
    if (!target.active || target.hp <= 0) return 0;

    // 치유 효과 계산 (최대 HP 이상으로 회복 불가)
    const healAmount = Math.min(amount, target.maxHp - target.hp);
    target.hp += healAmount;

    // 치유 숫자 표시
    this.showDamageNumber(target, healAmount, 0x00FF00, true);

    // 치유 효과 표시
    this.scene.effects.playHealEffect(target);

    return healAmount;
  }

  // 엔티티 사망 처리
  handleEntityDeath(attacker, target) {
    // 사망 이펙트
    this.scene.effects.playDeathEffect(target);

    if (target === this.player) {
      // 플레이어 사망 처리
      this.handlePlayerDeath();
    } else {
      // 몬스터 사망 처리
      this.handleMonsterDeath(attacker, target);
    }
  }

  // 플레이어 사망 처리
  handlePlayerDeath() {
    // 게임 오버 상태로 전환
    this.scene.gameOver(false);

    // 부활 아이템 체크 (영혼 수호석)
    const inventory = this.scene.inventorySystem;
    if (inventory && inventory.hasItem('soul_guardian_stone')) {
      // 한 번만 사용 가능한 부활 아이템
      inventory.consumeItem('soul_guardian_stone', 1);

      // 플레이어 부활
      this.player.hp = Math.floor(this.player.maxHp * 0.3); // 30% 체력으로 부활

      // 부활 이펙트
      this.scene.effects.playReviveEffect(this.player);

      // 게임 계속
      this.scene.resumeFromGameOver();
    }
  }

  // 몬스터 사망 처리
  handleMonsterDeath(attacker, monster) {
    // 몬스터 비활성화
    monster.active = false;

    // 전리품 드롭
    this.dropLoot(monster);

    // 경험치 지급
    if (attacker === this.player) {
      const expValue = monster.loot?.experience || 10;
      this.game.events.emit('experienceGained', expValue);

      // 경험치 텍스트 표시
      this.showDamageNumber(monster, `+${expValue} EXP`, 0xFFFF00, false, true);
    }

    // 보스인 경우 특별한 처리
    if (monster.type === 'boss') {
      this.handleBossDeath(monster);
    }

    // 몬스터 제거 (시체는 잠시 후 사라짐)
    this.scene.time.delayedCall(2000, () => {
      if (this.scene.enemies) {
        const index = this.scene.enemies.indexOf(monster);
        if (index !== -1) {
          this.scene.enemies.splice(index, 1);
        }
      }
    });

    // 몬스터 처치 통계 업데이트
    this.game.gameData.statistics.monstersKilled++;
    if (this.game.gameData.currentRun) {
      this.game.gameData.currentRun.monstersKilled++;
    }

    // 몬스터 처치 이벤트 발생
    this.game.events.emit('monsterKilled', {
      monster: monster,
      isElite: monster.isElite || false,
      isBoss: monster.type === 'boss'
    });
  }

  // 보스 사망 처리
  handleBossDeath(boss) {
    // 보스 사망 이벤트 발생
    this.game.events.emit('bossDefeated', boss);

    // 보스 보상 지급
    if (boss.reward) {
      // 골드 보상
      if (boss.reward.gold) {
        this.game.gameData.player.gold += boss.reward.gold;
        this.showDamageNumber(boss, `+${boss.reward.gold} Gold`, 0xFFD700, false, true);
      }

      // 경험치 보상
      if (boss.reward.experience) {
        this.game.events.emit('experienceGained', boss.reward.experience);
        this.showDamageNumber(boss, `+${boss.reward.experience} EXP`, 0xFFFF00, false, true);
      }

      // 아이템 보상
      if (boss.reward.items && boss.reward.items.length > 0) {
        boss.reward.items.forEach(item => {
          this.scene.inventorySystem?.addItem(item);
          this.scene.effects.playItemDropEffect(boss.x, boss.y, item.rarity);
        });
      }

      // 레거시 아이템 보상
      if (boss.reward.legacyItem) {
        this.game.gameData.legacyItems = this.game.gameData.legacyItems || [];

        // 이미 가지고 있는지 확인
        if (!this.game.gameData.legacyItems.includes(boss.reward.legacyItem)) {
          this.game.gameData.legacyItems.push(boss.reward.legacyItem);

          // 레거시 아이템 획득 알림
          this.scene.showNotification(`레거시 아이템 획득: ${this.getLegacyItemName(boss.reward.legacyItem)}`, 0xFFC0CB);

          // 특별 이펙트
          this.scene.effects.playLegacyItemEffect(boss.x, boss.y);
        }
      }
    }

    // 던전 완료 처리
    this.scene.time.delayedCall(3000, () => {
      this.scene.dungeonCompleted();
    });
  }

  // 레거시 아이템 이름 가져오기
  getLegacyItemName(itemId) {
    const legacyItemNames = {
      'soul_guardian_stone': '영혼 수호석',
      'golden_key': '황금 열쇠',
      'ancient_compass': '고대 나침반',
      'philosopher_stone': '현자의 돌',
      'kings_crown': '왕의 왕관',
      'dragon_heart': '드래곤 하트',
      'time_hourglass': '시간 모래시계',
      'dimensional_pocket': '차원 주머니',
      'alchemist_pendant': '연금술사의 펜던트',
      'book_of_secrets': '비밀의 책'
    };

    return legacyItemNames[itemId] || itemId;
  }

  // 전리품 드롭
  dropLoot(monster) {
    if (!monster.loot) return;

    // 골드 드롭
    if (monster.loot.gold) {
      this.game.gameData.player.gold += monster.loot.gold;
      this.showDamageNumber(monster, `+${monster.loot.gold} Gold`, 0xFFD700, false, true);
    }

    // 아이템 드롭 확률 계산
    if (Math.random() < monster.loot.dropChance) {
      // 아이템 생성
      const itemLevel = monster.level || 1;
      const isEliteOrBoss = monster.isElite || monster.type === 'boss';

      const item = this.scene.dungeonGenerator.createItem(
        this.scene.currentDungeon,
        itemLevel,
        isEliteOrBoss
      );

      // 인벤토리에 추가
      this.scene.inventorySystem?.addItem(item);

      // 아이템 드롭 이펙트
      this.scene.effects.playItemDropEffect(monster.x, monster.y, item.rarity);

      // 아이템 획득 통계 업데이트
      this.game.gameData.statistics.itemsCollected++;
      if (this.game.gameData.currentRun) {
        this.game.gameData.currentRun.itemsCollected++;
      }
    }
  }

  // 스킬 사용
  useSkill(player, skillId, target) {
    // 스킬 정보 가져오기
    const classSystem = this.scene.classSystem;
    const skill = classSystem.getSkillById(player.classId, skillId);

    if (!skill) return false;

    // 쿨다운 확인
    if (this.isSkillOnCooldown(skillId)) return false;

    // 마나 비용 확인
    if (player.stats.mp < skill.manaCost) return false;

    // 마나 소모
    player.stats.mp -= skill.manaCost;

    // 쿨다운 설정
    this.startCooldown(skillId, skill.cooldown);

    // 스킬 효과 적용
    this.applySkillEffect(player, skill, target);

    // 스킬 사용 이벤트
    this.game.events.emit('skillUsed', {
      skillId: skillId,
      player: player,
      target: target
    });

    return true;
  }

  // 스킬 효과 적용
  applySkillEffect(player, skill, target) {
    // 스킬 유형에 따른 처리
    switch (skill.type) {
      case 'damage':
        // 단일 대상 대미지 스킬
        this.applyDamageSkill(player, skill, target);
        break;
      case 'aoe':
        // 광역 대미지 스킬
        this.applyAoESkill(player, skill, target);
        break;
      case 'heal':
        // 치유 스킬
        this.applyHealSkill(player, skill, target);
        break;
      case 'buff':
        // 버프 스킬
        this.applyBuffSkill(player, skill, target);
        break;
      case 'debuff':
        // 디버프 스킬
        this.applyDebuffSkill(player, skill, target);
        break;
      case 'summon':
        // 소환 스킬
        this.applySummonSkill(player, skill, target);
        break;
      case 'utility':
        // 유틸리티 스킬
        this.applyUtilitySkill(player, skill, target);
        break;
      default:
        // 지원하지 않는 스킬 유형
        console.warn(`Unsupported skill type: ${skill.type}`);
        return false;
    }

    // 스킬 이펙트 표시
    this.scene.effects.playSkillEffect(skill.id, player, target);

    return true;
  }

  // 대미지 스킬 적용
  applyDamageSkill(player, skill, target) {
    // 기본 스킬 대미지 계산
    const baseDamage = this.calculateSkillDamage(player, skill);

    // 치명타 확인
    const isCritical = this.checkCritical(player);

    // 대미지 타입 결정
    const damageType = skill.damageType || 'physical';

    // 대미지 적용
    this.dealDamage(player, target, baseDamage, damageType, isCritical);

    // 추가 효과 적용
    if (skill.effects) {
      skill.effects.forEach(effect => {
        if (effect.type === 'status' && Math.random() < (effect.chance || 1.0)) {
          this.addStatusEffect(player, target, effect.status, effect.value, effect.duration);
        }
      });
    }
  }

  // 광역 스킬 적용
  applyAoESkill(player, skill, targetPosition) {
    // 영향 범위 내의 적 찾기
    const radius = skill.radius || 3;
    const affected = this.findEntitiesInRadius(targetPosition, radius, 'enemy');

    // 기본 스킬 대미지 계산
    const baseDamage = this.calculateSkillDamage(player, skill);

    // 각 대상에게 대미지 적용
    affected.forEach(target => {
      // 대상과의 거리에 따른 대미지 감소 (선택적)
      const distance = Phaser.Math.Distance.Between(targetPosition.x, targetPosition.y, target.x, target.y);
      const distanceFactor = skill.distanceFalloff ? Math.max(0.5, 1 - (distance / radius)) : 1;

      // 대미지 적용
      const adjustedDamage = baseDamage * distanceFactor;
      const damageType = skill.damageType || 'physical';
      const isCritical = this.checkCritical(player);

      this.dealDamage(player, target, adjustedDamage, damageType, isCritical);

      // 추가 효과 적용
      if (skill.effects) {
        skill.effects.forEach(effect => {
          if (effect.type === 'status' && Math.random() < (effect.chance || 1.0)) {
            this.addStatusEffect(player, target, effect.status, effect.value, effect.duration);
          }
        });
      }
    });

    // 광역 효과 표시
    this.scene.effects.playAoEEffect(targetPosition, radius, skill.element || 'neutral');
  }

  // 치유 스킬 적용
  applyHealSkill(player, skill, target) {
    // 기본 치유량 계산
    const baseHeal = this.calculateSkillHealing(player, skill);

    // 대상이 지정되지 않았거나 자기 자신을 타겟으로 한 경우
    if (!target || target === player) {
      // 자기 치유
      this.healTarget(player, baseHeal);

      // 광역 치유 스킬인 경우 아군 모두 치유
      if (skill.targetType === 'allies') {
        const allies = this.scene.allies || [];
        allies.forEach(ally => {
          if (ally !== player && ally.active) {
            this.healTarget(ally, baseHeal);
          }
        });
      }
    } else {
      // 타겟 치유
      this.healTarget(target, baseHeal);
    }

    // 추가 효과 적용
    if (skill.effects) {
      const affectedTargets = target ? [target] : [player];

      skill.effects.forEach(effect => {
        if (effect.type === 'status') {
          affectedTargets.forEach(t => {
            this.addStatusEffect(player, t, effect.status, effect.value, effect.duration);
          });
        }
      });
    }

    // 치유 효과 표시
    if (target) {
      this.scene.effects.playHealEffect(target);
    } else {
      this.scene.effects.playHealEffect(player);
    }
  }

  // 버프 스킬 적용
  applyBuffSkill(player, skill, target) {
    // 대상이 지정되지 않았거나 자기 자신을 타겟으로 한 경우
    const targets = [];

    if (!target || target === player) {
      // 자기 자신 버프
      targets.push(player);

      // 모든 아군 버프인 경우
      if (skill.targetType === 'allies') {
        const allies = this.scene.allies || [];
        allies.forEach(ally => {
          if (ally !== player && ally.active) {
            targets.push(ally);
          }
        });
      }
    } else {
      // 타겟 버프
      targets.push(target);
    }

    // 각 대상에게 버프 적용
    if (skill.buffs) {
      targets.forEach(t => {
        skill.buffs.forEach(buff => {
          this.addStatusEffect(player, t, buff.type, buff.value, buff.duration);
        });
      });
    }

    // 버프 효과 표시
    targets.forEach(t => {
      this.scene.effects.playBuffEffect(t, skill.element || 'neutral');
    });
  }

  // 디버프 스킬 적용
  applyDebuffSkill(player, skill, target) {
    // 단일 대상 디버프
    if (target) {
      if (skill.debuffs) {
        skill.debuffs.forEach(debuff => {
          // 저항 확인
          const resistChance = this.calculateStatusResistChance(target, debuff.type);

          if (Math.random() > resistChance) {
            this.addStatusEffect(player, target, debuff.type, debuff.value, debuff.duration);
          } else {
            // 저항 성공
            this.showDamageNumber(target, 'RESIST', 0xAAAAAA);
          }
        });
      }

      // 디버프 효과 표시
      this.scene.effects.playDebuffEffect(target, skill.element || 'dark');
    } else if (skill.targetType === 'aoe') {
      // 광역 디버프
      const radius = skill.radius || 3;
      const affected = this.findEntitiesInRadius(player, radius, 'enemy');

      affected.forEach(t => {
        if (skill.debuffs) {
          skill.debuffs.forEach(debuff => {
            // 저항 확인
            const resistChance = this.calculateStatusResistChance(t, debuff.type);

            if (Math.random() > resistChance) {
              this.addStatusEffect(player, t, debuff.type, debuff.value, debuff.duration);
            } else {
              // 저항 성공
              this.showDamageNumber(t, 'RESIST', 0xAAAAAA);
            }
          });
        }
      });

      // 광역 디버프 효과 표시
      this.scene.effects.playAoEEffect(player, radius, skill.element || 'dark');
    }
  }

  // 소환 스킬 적용
  applySummonSkill(player, skill, targetPosition) {
    // 소환 가능한 최대 수 확인
    const maxSummons = skill.maxSummons || 1;
    const currentSummons = this.scene.summons ? this.scene.summons.filter(s => s.owner === player).length : 0;

    if (currentSummons >= maxSummons) {
      // 최대 소환 수 초과
      this.showDamageNumber(player, 'MAX SUMMONS', 0xAAAAAA);
      return false;
    }

    // 소환물 생성
    const summonType = skill.summonType || 'elemental';
    const summonLevel = player.level || 1;
    const summon = this.createSummon(player, summonType, summonLevel, targetPosition);

    // 소환물 등록
    if (!this.scene.summons) this.scene.summons = [];
    this.scene.summons.push(summon);

    // 소환 효과 표시
    this.scene.effects.playSummonEffect(targetPosition, summonType);

    return true;
  }

  // 유틸리티 스킬 적용
  applyUtilitySkill(player, skill, target) {
    switch (skill.utilityType) {
      case 'teleport':
        // 순간이동
        if (target && typeof target.x === 'number' && typeof target.y === 'number') {
          this.scene.effects.playTeleportEffect(player, { x: player.x, y: player.y }, target);
          player.x = target.x;
          player.y = target.y;
        }
        break;
      case 'stealth':
        // 은신
        player.isStealthed = true;
        this.addStatusEffect(player, player, 'stealth', 1, skill.duration || 5);
        this.scene.effects.playStealthEffect(player);
        break;
      case 'trap':
        // 함정 설치
        if (target && typeof target.x === 'number' && typeof target.y === 'number') {
          this.placeTrap(player, target, skill);
        }
        break;
      // 기타 유틸리티 스킬...
    }
  }

  // 함정 설치
  placeTrap(player, position, skill) {
    // 함정 객체 생성
    const trap = {
      x: position.x,
      y: position.y,
      owner: player,
      type: 'trap',
      trapType: skill.trapType || 'damage',
      damage: this.calculateSkillDamage(player, skill),
      radius: skill.radius || 1.5,
      duration: skill.duration || 30,
      triggered: false,
      effects: skill.effects || []
    };

    // 함정 등록
    if (!this.scene.traps) this.scene.traps = [];
    this.scene.traps.push(trap);

    // 함정 설치 효과
    this.scene.effects.playTrapSetEffect(position);
  }

  // 소환물 생성
  createSummon(owner, summonType, level, position) {
    // 소환물 기본 스탯 설정
    const baseStats = {
      hp: 20 + (level * 5),
      attack: 5 + (level * 2),
      defense: 3 + level,
      speed: 80 + (level * 3)
    };

    // 소환물 타입별 특성
    const summonTraits = {
      'elemental': {
        name: '정령',
        element: owner.element || 'neutral',
        attackType: 'magic',
        modifiers: { hp: 0.8, attack: 1.2, defense: 0.7, speed: 1.1 }
      },
      'undead': {
        name: '언데드',
        element: 'dark',
        attackType: 'physical',
        modifiers: { hp: 1.2, attack: 1.0, defense: 0.9, speed: 0.8 }
      },
      'beast': {
        name: '야수',
        element: 'earth',
        attackType: 'physical',
        modifiers: { hp: 1.0, attack: 1.1, defense: 0.8, speed: 1.2 }
      },
      'construct': {
        name: '구성체',
        element: 'neutral',
        attackType: 'physical',
        modifiers: { hp: 1.5, attack: 0.9, defense: 1.3, speed: 0.7 }
      },
      'spirit': {
        name: '영혼',
        element: 'light',
        attackType: 'magic',
        modifiers: { hp: 0.7, attack: 1.3, defense: 0.6, speed: 1.3 }
      }
    };

    // 해당 타입의 트레이트 가져오기
    const traits = summonTraits[summonType] || summonTraits.elemental;

    // 소환물 스탯 계산
    const stats = {};
    for (const stat in baseStats) {
      stats[stat] = Math.floor(baseStats[stat] * (traits.modifiers[stat] || 1.0));
    }

    // 소환물 객체 생성
    const summon = {
      x: position.x,
      y: position.y,
      name: `${traits.name} ${level}`,
      type: 'summon',
      summonType: summonType,
      owner: owner,
      level: level,
      active: true,
      team: owner.team,
      element: traits.element,
      attackType: traits.attackType,
      attackRange: summonType === 'elemental' || summonType === 'spirit' ? 5 : 1.5,
      stats: {
        hp: stats.hp,
        maxHp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        speed: stats.speed
      },
      combatStats: {
        critChance: 0.05,
        critMultiplier: 1.5,
        dodgeChance: 0.03,
        elementalResistances: {}
      },
      behaviorType: 'aggressive', // 또는 'defensive', 'passive'
      lifespan: 30 // 30초 유지
    };

    // 소환물 강화 효과
    if (owner.summonBoost) {
      summon.stats.attack *= (1 + owner.summonBoost / 100);
      summon.stats.hp *= (1 + owner.summonBoost / 100);
      summon.stats.maxHp = summon.stats.hp;
    }

    // 소환물 행동 업데이트 등록
    this.scene.time.addEvent({
      delay: 1000, // 1초마다 업데이트
      repeat: summon.lifespan - 1,
      callback: () => this.updateSummonBehavior(summon)
    });

    // 소환물 수명 제한
    this.scene.time.delayedCall(summon.lifespan * 1000, () => {
      // 소환물 소멸
      summon.active = false;

      // 소환물 소멸 효과
      this.scene.effects.playSummonExpireEffect(summon);

      // 소환물 리스트에서 제거
      if (this.scene.summons) {
        const index = this.scene.summons.indexOf(summon);
        if (index !== -1) {
          this.scene.summons.splice(index, 1);
        }
      }
    });

    return summon;
  }

  // 소환물 행동 업데이트
  updateSummonBehavior(summon) {
    if (!summon.active) return;

    // 타겟 찾기
    let target = this.findSummonTarget(summon);

    if (target) {
      // 타겟과의 거리 계산
      const distance = Phaser.Math.Distance.Between(
        summon.x, summon.y, target.x, target.y
      );

      if (distance <= summon.attackRange) {
        // 공격 범위 내라면 공격
        this.summonAttack(summon, target);
      } else {
        // 거리가 멀다면 이동
        this.moveSummonTowardsTarget(summon, target);
      }
    } else {
      // 타겟이 없으면 주인 근처로 이동
      this.moveSummonTowardsOwner(summon);
    }
  }

  // 소환물 타겟 찾기
  findSummonTarget(summon) {
    // 타겟 리스트 (적 진영)
    const targets = summon.team === 'player' ? (this.scene.enemies || []) : [this.player];

    // 활성 상태인 타겟만 필터링
    const activeTargets = targets.filter(t => t.active && t.hp > 0);
    if (activeTargets.length === 0) return null;

    // 행동 타입에 따라 타겟 선택
    switch (summon.behaviorType) {
      case 'aggressive':
        // 가장 가까운 적
        return activeTargets.reduce((closest, current) => {
          const closestDist = Phaser.Math.Distance.Between(summon.x, summon.y, closest.x, closest.y);
          const currentDist = Phaser.Math.Distance.Between(summon.x, summon.y, current.x, current.y);
          return currentDist < closestDist ? current : closest;
        });
      case 'defensive':
        // the owner is attacked by the enemy
        const ownerAttackers = activeTargets.filter(t => t.target === summon.owner);
        if (ownerAttackers.length > 0) {
          return ownerAttackers[0];
        }
        // 주인을 공격하는 적이 없으면 가장 가까운 적
        return this.findClosestEntity(summon, activeTargets);
      default:
        // 기본값: 가장 가까운 적
        return this.findClosestEntity(summon, activeTargets);
    }
  }

  // 가장 가까운 엔티티 찾기
  findClosestEntity(source, entities) {
    if (entities.length === 0) return null;

    return entities.reduce((closest, current) => {
      const closestDist = Phaser.Math.Distance.Between(source.x, source.y, closest.x, closest.y);
      const currentDist = Phaser.Math.Distance.Between(source.x, source.y, current.x, current.y);
      return currentDist < closestDist ? current : closest;
    });
  }

  // 소환물 공격
  summonAttack(summon, target) {
    // 기본 대미지 계산
    const baseDamage = summon.stats.attack;

    // 치명타 확인
    const isCritical = Math.random() < summon.combatStats.critChance;

    // 공격 타입에 따른 대미지 타입
    const damageType = summon.attackType === 'magic' ? summon.element : 'physical';

    // 대미지 적용
    this.dealDamage(summon, target, baseDamage, damageType, isCritical);

    // 공격 이펙트
    this.scene.effects.playSummonAttackEffect(summon, target, damageType);
  }

  // 소환물 이동
  moveSummonTowardsTarget(summon, target) {
    // 방향 계산
    const angle = Phaser.Math.Angle.Between(summon.x, summon.y, target.x, target.y);

    // 이동 속도 계산
    const speed = summon.stats.speed / 100; // 속도를 적절한 이동 단위로 변환

    // 새 위치 계산
    summon.x += Math.cos(angle) * speed;
    summon.y += Math.sin(angle) * speed;

    // 이동 이펙트
    this.scene.effects.playSummonMoveEffect(summon);
  }

  // 소환물을 주인 근처로 이동
  moveSummonTowardsOwner(summon) {
    const owner = summon.owner;

    // 주인이 없거나 비활성 상태면 무시
    if (!owner || !owner.active) return;

    // 주인과의 거리 계산
    const distance = Phaser.Math.Distance.Between(summon.x, summon.y, owner.x, owner.y);

    // 일정 거리 내면 이동하지 않음
    if (distance < 3) return;

    // 방향 계산
    const angle = Phaser.Math.Angle.Between(summon.x, summon.y, owner.x, owner.y);

    // 이동 속도
    const speed = summon.stats.speed / 100;

    // 새 위치 계산
    summon.x += Math.cos(angle) * speed;
    summon.y += Math.sin(angle) * speed;

    // 이동 이펙트
    this.scene.effects.playSummonMoveEffect(summon);
  }

  // 스킬 쿨다운 시작
  startCooldown(skillId, duration) {
    this.activeCooldowns[skillId] = {
      startTime: Date.now(),
      duration: duration * 1000 // 초 -> 밀리초
    };

    // 쿨다운 UI 업데이트
    this.scene.updateCooldownUI(skillId, duration);
  }

  // 스킬 쿨다운 확인
  isSkillOnCooldown(skillId) {
    const cooldown = this.activeCooldowns[skillId];
    if (!cooldown) return false;

    const elapsed = Date.now() - cooldown.startTime;
    return elapsed < cooldown.duration;
  }

  // 스킬 쿨다운 남은 시간
  getSkillCooldownRemaining(skillId) {
    const cooldown = this.activeCooldowns[skillId];
    if (!cooldown) return 0;

    const elapsed = Date.now() - cooldown.startTime;
    return Math.max(0, cooldown.duration - elapsed) / 1000; // 밀리초 -> 초
  }

  // 스킬 대미지 계산
  calculateSkillDamage(player, skill) {
    // 기본 대미지 계산
    const attackStat = player.stats.attack || 10;
    const baseDamage = skill.baseDamage || 10;

    // 스킬 배율 (%)
    const damageMultiplier = skill.damageMultiplier || 100;

    // 스킬 강화 효과 적용
    const skillBoost = player.skillBoost || 0;

    // 최종 대미지 계산
    return Math.floor(attackStat * (baseDamage / 10) * (damageMultiplier / 100) * (1 + skillBoost / 100));
  }

  // 스킬 치유량 계산
  calculateSkillHealing(player, skill) {
    // 스탯에 따른 치유량 계산
    const healingStat = player.stats.attack || 10; // 또는 특별한 치유 스탯
    const baseHealing = skill.baseHealing || 20;

    // 치유 배율 (%)
    const healingMultiplier = skill.healingMultiplier || 100;

    // 치유 강화 효과 적용
    const healingBoost = player.healingBoost || 0;

    // 최종 치유량 계산
    return Math.floor(healingStat * (baseHealing / 10) * (healingMultiplier / 100) * (1 + healingBoost / 100));
  }

  // 몬스터 공격
  monsterAttack(monster, target) {
    if (!monster || !monster.active || !target || !target.active) return;

    // 몬스터 기본 대미지
    const baseDamage = monster.attack;

    // 공격 타입에 따른 대미지 타입
    const damageType = monster.attackType === 'magic' ? monster.element : 'physical';

    // 크리티컬 확인 (몬스터도 낮은 확률로 크리티컬 가능)
    const isCritical = Math.random() < 0.05;

    // 대미지 적용
    this.dealDamage(monster, target, baseDamage, damageType, isCritical);

    // 몬스터 특수 능력 발동
    this.triggerMonsterAbilities(monster, target);

    // 공격 이벤트
    this.game.events.emit('monsterAttack', {
      monster: monster,
      target: target,
      damage: baseDamage,
      damageType: damageType,
      isCritical: isCritical
    });
  }

  // 몬스터 특수 능력 발동
  triggerMonsterAbilities(monster, target) {
    if (!monster.specialAbilities || monster.specialAbilities.length === 0) return;

    // 각 특수 능력 확인
    monster.specialAbilities.forEach(ability => {
      // 쿨다운 확인
      if (ability.lastUsed && Date.now() - ability.lastUsed < ability.cooldown * 1000) return;

      // 발동 확률 확인
      if (Math.random() > ability.chance) return;

      // 능력 발동
      this.activateMonsterAbility(monster, target, ability);

      // 쿨다운 설정
      ability.lastUsed = Date.now();
    });
  }

  // 몬스터 특수 능력 활성화
  activateMonsterAbility(monster, target, ability) {
    switch (ability.type) {
      case 'knockback':
        // 넉백 효과
        const angle = Phaser.Math.Angle.Between(monster.x, monster.y, target.x, target.y);
        target.x += Math.cos(angle) * 3;
        target.y += Math.sin(angle) * 3;
        this.scene.effects.playKnockbackEffect(target, angle);
        break;
      case 'stun':
        // 기절 효과
        this.addStatusEffect(monster, target, 'stun', 1, ability.duration || 2);
        break;
      case 'bleed':
        // 출혈 효과
        this.addStatusEffect(monster, target, 'bleed', ability.damage || monster.attack * 0.2, ability.duration || 3);
        break;
      case 'multi_attack':
        // 연속 공격
        const attackCount = ability.count || 3;
        for (let i = 0; i < attackCount; i++) {
          this.scene.time.delayedCall(i * 200, () => {
            if (monster.active && target.active) {
              this.dealDamage(monster, target, ability.damage || monster.attack * 0.5, 'physical', false);
              this.scene.effects.playMultiAttackEffect(monster, target, i);
            }
          });
        }
        break;
      case 'poison':
        // 독 효과
        this.addStatusEffect(monster, target, 'poison', ability.damage || monster.attack * 0.15, ability.duration || 4);
        break;
      case 'fire':
        // 화염 효과
        this.addStatusEffect(monster, target, 'burn', ability.damage || monster.attack * 0.2, ability.duration || 3);
        this.scene.effects.playFireEffect(target);
        break;
      case 'summon_minion':
        // 하수인 소환
        this.scene.time.delayedCall(500, () => {
          const position = {
            x: monster.x + (Math.random() * 4 - 2),
            y: monster.y + (Math.random() * 4 - 2)
          };

          // 소환할 몬스터 종류
          const minionType = monster.minionType || 'minion';

          // 미니언 생성 (원래 몬스터보다 약함)
          const minion = this.scene.dungeonGenerator.createMonster(
            this.scene.currentDungeon,
            { x: 0, y: 0, width: 10, height: 10 }, // 더미 룸
            Math.max(1, monster.level - 2),
            false
          );

          // 위치 설정
          minion.x = position.x;
          minion.y = position.y;

          // 미니언 표시
          minion.isMinion = true;

          // 몬스터 리스트에 추가
          this.scene.enemies.push(minion);

          // 소환 이펙트
          this.scene.effects.playSummonEffect(position, 'minion');
        });
        break;
      // 기타 몬스터 능력...
    }
  }

  // 대미지 색상 가져오기
  getDamageColor(damageType, isCritical) {
    // 치명타는 항상 노란색
    if (isCritical) return 0xFFFF00;

    // 대미지 타입별 색상
    const typeColors = {
      physical: 0xFFFFFF, // 흰색
      fire: 0xFF4500,     // 주황색
      ice: 0x00FFFF,      // 하늘색
      lightning: 0xFFFF00, // 노란색
      earth: 0x8B4513,    // 갈색
      dark: 0x800080,     // 보라색
      light: 0xFFFFAA,    // 밝은 노란색
      poison: 0x00FF00,   // 녹색
      water: 0x0000FF,    // 파란색
      true: 0xFF0000      // 붉은색 (고정 대미지)
    };

    return typeColors[damageType] || 0xFFFFFF;
  }

  // 대미지 숫자 표시
  showDamageNumber(target, value, color, isHealing = false, isSpecial = false) {
    // 문자열로 변환
    const text = isHealing ? `+${value}` : (typeof value === 'number' ? `-${value}` : value);

    // 화면 위치 계산
    const x = target.x;
    const y = target.y - 20; // 대상 머리 위에 표시

    // 이동 방향 (약간의 랜덤성)
    const dirX = (Math.random() - 0.5) * 2;
    const dirY = -1; // 위로 이동

    // 시간에 따른 움직임과 페이드 아웃을 위한 객체
    const damageNumber = {
      x,
      y,
      text,
      color,
      alpha: 1,
      scale: isSpecial ? 1.5 : 1.0,
      dirX,
      dirY,
      lifespan: 1000, // 1초
      createdAt: Date.now()
    };

    // 배열에 추가
    this.damageNumbers.push(damageNumber);

    // 일정 시간 후 제거
    this.scene.time.delayedCall(damageNumber.lifespan, () => {
      const index = this.damageNumbers.indexOf(damageNumber);
      if (index !== -1) {
        this.damageNumbers.splice(index, 1);
      }
    });
  }

  // 대미지 숫자 업데이트 (게임 루프에서 호출)
  updateDamageNumbers(delta) {
    this.damageNumbers.forEach(number => {
      // 경과 시간
      const elapsed = Date.now() - number.createdAt;
      const progress = elapsed / number.lifespan;

      // 움직임
      number.x += number.dirX * 0.5;
      number.y += number.dirY * 0.8;

      // 페이드 아웃
      number.alpha = 1 - progress;

      // 스케일 약간 커짐
      number.scale = Math.min(1.5, number.scale + 0.01);
    });
  }

  // 대미지 숫자 렌더링 (게임 렌더 루프에서 호출)
  renderDamageNumbers(renderer) {
    this.damageNumbers.forEach(number => {
      const textStyle = {
        font: `${Math.floor(16 * number.scale)}px Arial`,
        fill: `#${number.color.toString(16).padStart(6, '0')}`,
        stroke: '#000000',
        strokeThickness: 2
      };

      renderer.text(number.text, number.x, number.y, textStyle, 0.5, 0.5, number.alpha);
    });
  }

  // 플레이어 공격
  playerAttack(target, weaponType) {
    if (!this.player || !target || !target.active) return;

    // 공격 속도 확인
    if (this.isAttackOnCooldown()) return;

    // 기본 대미지 계산
    const baseDamage = this.player.stats.attack;

    // 치명타 확인
    const isCritical = this.checkCritical(this.player);

    // 무기 타입에 따른 전용 효과
    this.applyWeaponTypeEffect(weaponType, target);

    // 대미지 적용
    this.dealDamage(this.player, target, baseDamage, 'physical', isCritical);

    // 공격 쿨다운 설정
    this.startAttackCooldown();

    // 공격 이벤트 발생
    this.game.events.emit('playerAttack', {
      player: this.player,
      target: target,
      damage: baseDamage,
      isCritical: isCritical
    });
  }

  // 무기 타입 효과 적용
  applyWeaponTypeEffect(weaponType, target) {
    if (!weaponType) return;

    // 무기 타입별 특수 효과
    switch (weaponType) {
      case 'sword':
        // 검: 낮은 확률로 출혈 효과
        if (Math.random() < 0.15) {
          this.addStatusEffect(this.player, target, 'bleed', this.player.stats.attack * 0.2, 3);
        }
        break;
      case 'axe':
        // 도끼: 방어력 감소 효과
        if (Math.random() < 0.2) {
          this.addStatusEffect(this.player, target, 'defense_down', 15, 5);
        }
        break;
      case 'mace':
        // 철퇴: 기절 효과
        if (Math.random() < 0.1) {
          this.addStatusEffect(this.player, target, 'stun', 1, 1);
        }
        break;
      case 'spear':
        // 창: 관통 대미지 (뒤에 있는 적에게도 적용)
        const behindTargets = this.findEntitiesBehindTarget(target, 2);
        behindTargets.forEach(behind => {
          this.dealDamage(this.player, behind, this.player.stats.attack * 0.5, 'physical', false);
        });
        break;
      case 'dagger':
        // 단검: 중독 효과
        if (Math.random() < 0.25) {
          this.addStatusEffect(this.player, target, 'poison', this.player.stats.attack * 0.15, 4);
        }
        break;
      case 'staff':
        // 지팡이: 마법 대미지 추가
        const elementTypes = ['fire', 'ice', 'lightning'];
        const element = elementTypes[Math.floor(Math.random() * elementTypes.length)];
        this.dealDamage(this.player, target, this.player.stats.attack * 0.3, element, false);
        break;
      case 'bow':
        // 활: 정확도 증가 및 약점 공격
        // 치명타 확률 증가 처리는 전투 시스템에서 이미 처리됨
        break;
      case 'wand':
        // 완드: 마법 속성 대미지
        const wandElements = ['fire', 'ice', 'lightning', 'light'];
        const wandElement = wandElements[Math.floor(Math.random() * wandElements.length)];
        this.dealDamage(this.player, target, this.player.stats.attack * 0.4, wandElement, false);
        break;
      // 기타 무기 타입...
    }
  }

  // 대상 뒤의 엔티티 찾기
  findEntitiesBehindTarget(target, distance) {
    // 플레이어 -> 타겟 방향
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);

    // 타겟 뒤의 지점 계산
    const behindX = target.x + Math.cos(angle) * distance;
    const behindY = target.y + Math.sin(angle) * distance;

    // 해당 지점 근처의 적 찾기
    return this.findEntitiesInRadius({ x: behindX, y: behindY }, 1.5, 'enemy').filter(e => e !== target);
  }

  // 공격 쿨다운 시작
  startAttackCooldown() {
    const attackSpeed = this.player.stats.attackSpeed || 100;
    const cooldownDuration = 1000 / (attackSpeed / 100);

    this.attackCooldownEndTime = Date.now() + cooldownDuration;
  }

  // 공격 쿨다운 확인
  isAttackOnCooldown() {
    if (!this.attackCooldownEndTime) return false;
    return Date.now() < this.attackCooldownEndTime;
  }

  // 플레이어 움직임 처리
  handlePlayerMovement(direction, delta) {
    if (!this.player || !this.player.active) return;

    // 기절 상태일 때는 움직임 불가
    if (this.player.isStunned) return;

    // 속박 상태일 때는 움직임 불가
    if (this.player.isRooted) return;

    // 혼란 상태일 때는 방향이 불규칙적으로 변함
    if (this.player.isConfused) {
      if (Math.random() < 0.3) { // 30% 확률로 방향 변경
        const directions = ['up', 'down', 'left', 'right'];
        direction = directions[Math.floor(Math.random() * directions.length)];
      }
    }

    // 이동 속도 계산
    let speed = (this.player.stats.speed || 100) / 100; // 기본 속도

    // 속도 수정자 적용
    if (this.player.speedModifier) {
      speed *= this.player.speedModifier;
    }

    // 델타 시간으로 속도 보정
    speed *= delta / 16; // 60fps 기준

    // 방향에 따른 이동
    switch (direction) {
      case 'up':
        this.player.y -= speed;
        this.player.direction = 'up';
        break;
      case 'down':
        this.player.y += speed;
        this.player.direction = 'down';
        break;
      case 'left':
        this.player.x -= speed;
        this.player.direction = 'left';
        break;
      case 'right':
        this.player.x += speed;
        this.player.direction = 'right';
        break;
    }

    // 충돌 처리 (여기서는 간단하게 구현)
    this.handleCollisions();

    // 이동 애니메이션
    this.updatePlayerAnimation(direction);
  }

  // 충돌 처리
  handleCollisions() {
    // 던전 경계 내에 플레이어 유지
    const dungeon = this.scene.currentDungeon;
    if (dungeon) {
      this.player.x = Phaser.Math.Clamp(this.player.x, 0, dungeon.width);
      this.player.y = Phaser.Math.Clamp(this.player.y, 0, dungeon.height);
    }

    // 벽, 장애물과의 충돌 처리
    // (실제 게임 구현에서는 타일 기반 또는 물리 엔진 충돌 시스템을 사용)
  }

  // 플레이어 애니메이션 업데이트
  updatePlayerAnimation(direction) {
    if (!this.player.sprite) return;

    // 방향에 따라 적절한 애니메이션 설정
    const anim = `player_${this.player.classId}_${direction}`;
    if (this.player.sprite.anims.exists(anim)) {
      this.player.sprite.anims.play(anim, true);
    }
  }

  // 주기적인 업데이트 (게임 루프에서 호출)
  update(time, delta) {
    // 대미지 숫자 업데이트
    this.updateDamageNumbers(delta);

    // 플레이어 자동 회복 (마나, HP 등)
    this.updatePlayerRegeneration(delta);

    // 함정 검사
    this.checkTraps();

    // 전투 중 지속적인 효과 (오라 등) 처리
    this.updateCombatEffects(delta);
  }

  // 플레이어 자동 회복
  updatePlayerRegeneration(delta) {
    if (!this.player || !this.player.active) return;

    // 시간 경과에 따른 회복 (초당)
    const secondsPassed = delta / 1000;

    // 마나 회복
    if (this.player.stats.mp < this.player.stats.maxMp) {
      // 기본 회복 + 패시브 회복
      const manaRegen = (this.player.stats.manaRegen || 1) + (this.player.passiveMpRegen || 0);
      this.player.stats.mp = Math.min(
        this.player.stats.maxMp,
        this.player.stats.mp + manaRegen * secondsPassed
      );
    }

    // HP 자동 회복 (전투 중이 아닐 때만)
    if (this.player.stats.hp < this.player.stats.maxHp && !this.isPlayerInCombat()) {
      const hpRegen = this.player.stats.hpRegen || 0.5;
      this.player.stats.hp = Math.min(
        this.player.stats.maxHp,
        this.player.stats.hp + hpRegen * secondsPassed
      );
    }
  }

  // 전투 중인지 확인
  isPlayerInCombat() {
    // 최근 타격 받은 시간 또는 공격한 시간으로 판단
    const now = Date.now();
    const combatTimeout = 5000; // 5초

    return (now - this.player.lastHitTime < combatTimeout) ||
      (now - this.player.lastAttackTime < combatTimeout);
  }

  // 함정 검사
  checkTraps() {
    if (!this.player || !this.player.active || !this.scene.traps) return;

    this.scene.traps.forEach(trap => {
      if (trap.triggered) return;

      // 플레이어가 함정 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(
        trap.x, trap.y, this.player.x, this.player.y
      );

      if (distance <= trap.radius) {
        // 함정 발동
        trap.triggered = true;

        // 함정 효과 적용
        this.applyTrapEffect(trap);

        // 함정 발동 효과
        this.scene.effects.playTrapTriggerEffect(trap);
      }
    });
  }

  // 함정 효과 적용
  applyTrapEffect(trap) {
    // 함정 타입에 따른 효과
    switch (trap.trapType) {
      case 'damage':
        // 대미지 함정
        this.dealDamage(trap.owner, this.player, trap.damage, 'physical', false);
        break;
      case 'poison':
        // 독 함정
        this.addStatusEffect(trap.owner, this.player, 'poison', trap.damage * 0.2, 5);
        break;
      case 'fire':
        // 화염 함정
        this.dealDamage(trap.owner, this.player, trap.damage, 'fire', false);
        this.addStatusEffect(trap.owner, this.player, 'burn', trap.damage * 0.1, 3);
        break;
      case 'frost':
        // 얼음 함정
        this.dealDamage(trap.owner, this.player, trap.damage, 'ice', false);
        this.addStatusEffect(trap.owner, this.player, 'slow', 30, 4);
        break;
      case 'stun':
        // 기절 함정
        this.dealDamage(trap.owner, this.player, trap.damage, 'lightning', false);
        this.addStatusEffect(trap.owner, this.player, 'stun', 1, 2);
        break;
    }

    // 추가 효과 적용
    if (trap.effects) {
      trap.effects.forEach(effect => {
        if (effect.type === 'status') {
          this.addStatusEffect(trap.owner, this.player, effect.status, effect.value, effect.duration);
        }
      });
    }

    // 트랩 제거 (일회성 트랩인 경우)
    if (!trap.persistent) {
      const index = this.scene.traps.indexOf(trap);
      if (index !== -1) {
        this.scene.traps.splice(index, 1);
      }
    }
  }

  // 전투 중 지속적인 효과 처리
  updateCombatEffects(delta) {
    // 플레이어 오라 효과 처리 (있는 경우)
    this.updatePlayerAuras(delta);

    // 몬스터 오라 효과 처리
    this.updateMonsterAuras(delta);

    // 지속 효과가 있는 지역 처리 (독 구름, 화염 지대 등)
    this.updateEnvironmentalEffects(delta);
  }

  // 플레이어 오라 효과 업데이트
  updatePlayerAuras(delta) {
    if (!this.player || !this.player.active) return;

    // 플레이어가 가진 오라 효과 확인
    const auras = this.player.auras || [];

    auras.forEach(aura => {
      // 오라 지속시간 확인 및 감소
      if (aura.duration !== -1) { // -1은 영구 지속
        aura.duration -= delta / 1000;

        if (aura.duration <= 0) {
          // 오라 효과 제거
          const index = this.player.auras.indexOf(aura);
          if (index !== -1) {
            this.player.auras.splice(index, 1);
          }
          return;
        }
      }

      // 마지막 효과 적용 시간 확인
      const now = Date.now();
      if (now - aura.lastApplied < aura.interval) return;

      // 효과 적용 시간 갱신
      aura.lastApplied = now;

      // 오라 유형에 따른 효과 적용
      switch (aura.type) {
        case 'healing':
          // 치유 오라
          this.applyHealingAura(this.player, aura);
          break;
        case 'damage':
          // 대미지 오라
          this.applyDamageAura(this.player, aura);
          break;
        case 'protection':
          // 보호 오라
          this.applyProtectionAura(this.player, aura);
          break;
        case 'mana':
          // 마나 재생 오라
          this.applyManaAura(this.player, aura);
          break;
      }
    });
  }

  // 몬스터 오라 효과 업데이트
  updateMonsterAuras(delta) {
    if (!this.enemies) return;

    this.enemies.forEach(monster => {
      if (!monster.active || monster.hp <= 0) return;

      // 몬스터가 가진 오라 효과 확인
      const auras = monster.auras || [];

      auras.forEach(aura => {
        // 오라 지속시간 확인 및 감소
        if (aura.duration !== -1) {
          aura.duration -= delta / 1000;

          if (aura.duration <= 0) {
            // 오라 효과 제거
            const index = monster.auras.indexOf(aura);
            if (index !== -1) {
              monster.auras.splice(index, 1);
            }
            return;
          }
        }

        // 마지막 효과 적용 시간 확인
        const now = Date.now();
        if (now - aura.lastApplied < aura.interval) return;

        // 효과 적용 시간 갱신
        aura.lastApplied = now;

        // 몬스터 오라 효과 적용
        switch (aura.type) {
          case 'healing':
            // 치유 오라 (아군 몬스터에게 적용)
            this.applyMonsterHealingAura(monster, aura);
            break;
          case 'damage':
            // 대미지 오라 (플레이어에게 적용)
            this.applyMonsterDamageAura(monster, aura);
            break;
          case 'buff':
            // 버프 오라 (아군 몬스터에게 적용)
            this.applyMonsterBuffAura(monster, aura);
            break;
        }
      });
    });
  }

  // 환경 효과 업데이트
  updateEnvironmentalEffects(delta) {
    // 독 구름 처리
    if (this.scene.poisonClouds) {
      this.scene.poisonClouds.forEach(cloud => {
        // 지속시간 감소
        cloud.duration -= delta / 1000;

        if (cloud.duration <= 0) {
          // 독 구름 제거
          const index = this.scene.poisonClouds.indexOf(cloud);
          if (index !== -1) {
            this.scene.poisonClouds.splice(index, 1);
          }
          return;
        }

        // 플레이어가 독 구름 범위 내에 있는지 확인
        if (this.player && this.player.active) {
          const distance = Phaser.Math.Distance.Between(
            cloud.x, cloud.y, this.player.x, this.player.y
          );

          if (distance <= cloud.radius) {
            // 마지막 대미지 시간 확인
            const now = Date.now();
            if (now - cloud.lastTick >= cloud.tickInterval * 1000) {
              // 독 대미지 적용
              this.dealDamage(cloud.source, this.player, cloud.damage, 'poison', false, true);
              cloud.lastTick = now;
            }
          }
        }
      });
    }

    // 화염 지대 처리
    if (this.scene.fireZones) {
      this.scene.fireZones.forEach(zone => {
        // 지속시간 감소
        zone.duration -= delta / 1000;

        if (zone.duration <= 0) {
          // 화염 지대 제거
          const index = this.scene.fireZones.indexOf(zone);
          if (index !== -1) {
            this.scene.fireZones.splice(index, 1);
          }
          return;
        }

        // 플레이어가 화염 지대 범위 내에 있는지 확인
        if (this.player && this.player.active) {
          const distance = Phaser.Math.Distance.Between(
            zone.x, zone.y, this.player.x, this.player.y
          );

          if (distance <= zone.radius) {
            // 마지막 대미지 시간 확인
            const now = Date.now();
            if (now - zone.lastTick >= zone.tickInterval * 1000) {
              // 화염 대미지 적용
              this.dealDamage(zone.source, this.player, zone.damage, 'fire', false, true);
              zone.lastTick = now;

              // 화상 효과 적용 (확률에 따라)
              if (Math.random() < 0.3) {
                this.addStatusEffect(zone.source, this.player, 'burn', zone.damage * 0.5, 3);
              }
            }
          }
        }
      });
    }

    // 얼음 지대 처리
    if (this.scene.frostZones) {
      this.scene.frostZones.forEach(zone => {
        // 지속시간 감소
        zone.duration -= delta / 1000;

        if (zone.duration <= 0) {
          // 얼음 지대 제거
          const index = this.scene.frostZones.indexOf(zone);
          if (index !== -1) {
            this.scene.frostZones.splice(index, 1);
          }
          return;
        }

        // 플레이어가 얼음 지대 범위 내에 있는지 확인
        if (this.player && this.player.active) {
          const distance = Phaser.Math.Distance.Between(
            zone.x, zone.y, this.player.x, this.player.y
          );

          if (distance <= zone.radius) {
            // 감속 효과 적용
            if (!this.player.isSlowed) {
              this.addStatusEffect(zone.source, this.player, 'slow', zone.slowAmount, 1);

              // 얼음 지대에 처음 진입했을 때 대미지 적용
              if (!zone.playerAffected) {
                this.dealDamage(zone.source, this.player, zone.damage, 'ice', false, false);
                zone.playerAffected = true;
              }
            }
          } else {
            // 플레이어가 얼음 지대를 벗어남
            zone.playerAffected = false;
          }
        }
      });
    }
  }

  // 치유 오라 효과 적용
  applyHealingAura(source, aura) {
    // 범위 내 아군 찾기 (플레이어 팀)
    const allies = [this.player]; // 플레이어 자신

    // 플레이어 소환수 추가
    if (this.scene.summons) {
      allies.push(...this.scene.summons.filter(s => s.owner === this.player && s.active));
    }

    // 각 아군에게 치유 효과 적용
    allies.forEach(ally => {
      if (!ally.active || ally.hp <= 0) return;

      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 치유량 계산
        let healAmount = aura.value;

        // 퍼센트 기반 치유인 경우
        if (aura.isPercent) {
          healAmount = ally.maxHp * (aura.value / 100);
        }

        // 치유 적용
        this.healTarget(ally, healAmount);

        // 치유 시각 효과 (틱당 한 번)
        this.scene.effects.playHealEffect(ally, 'aura');
      }
    });
  }

  // 대미지 오라 효과 적용
  applyDamageAura(source, aura) {
    // 범위 내 적 찾기
    const enemies = this.enemies || [];

    // 각 적에게 대미지 효과 적용
    enemies.forEach(enemy => {
      if (!enemy.active || enemy.hp <= 0) return;

      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, enemy.x, enemy.y);

      if (distance <= aura.radius) {
        // 대미지 계산
        let damageAmount = aura.value;

        // 퍼센트 기반 대미지인 경우
        if (aura.isPercent) {
          damageAmount = enemy.maxHp * (aura.value / 100);
        }

        // 대미지 적용
        this.dealDamage(source, enemy, damageAmount, aura.element || 'neutral', false, true);

        // 추가 효과가 있는 경우
        if (aura.statusEffect && Math.random() < aura.statusChance) {
          this.addStatusEffect(source, enemy, aura.statusEffect, aura.statusValue, aura.statusDuration);
        }
      }
    });
  }

  // 보호 오라 효과 적용
  applyProtectionAura(source, aura) {
    // 범위 내 아군 찾기 (플레이어 팀)
    const allies = [this.player]; // 플레이어 자신

    // 플레이어 소환수 추가
    if (this.scene.summons) {
      allies.push(...this.scene.summons.filter(s => s.owner === this.player && s.active));
    }

    // 각 아군에게 보호 효과 적용
    allies.forEach(ally => {
      if (!ally.active) return;

      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 보호막 갱신 (기존 보호막보다 강할 경우)
        if (!ally.shield || ally.shield < aura.value) {
          // 이전 보호막 효과 제거
          if (ally.shield) {
            this.removeStatusEffect(ally.statusEffects.find(e => e.type === 'shield'));
          }

          // 새 보호막 적용
          ally.shield = aura.value;
          this.addStatusEffect(source, ally, 'shield', aura.value, 2); // 짧은 지속시간으로 갱신

          // 보호막 시각 효과
          this.scene.effects.playShieldEffect(ally, 'aura');
        }
      }
    });
  }

  // 마나 오라 효과 적용
  applyManaAura(source, aura) {
    // 범위 내 아군 찾기 (플레이어 팀)
    const allies = [this.player]; // 플레이어 자신

    // 플레이어 소환수 추가 (마나가 있는 경우)
    if (this.scene.summons) {
      allies.push(...this.scene.summons.filter(s => s.owner === this.player && s.active && s.stats && s.stats.mp !== undefined));
    }

    // 각 아군에게 마나 회복 효과 적용
    allies.forEach(ally => {
      if (!ally.active || !ally.stats || ally.stats.mp === undefined) return;

      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 마나가 최대가 아닌 경우만 회복
        if (ally.stats.mp < ally.stats.maxMp) {
          // 마나 회복량 계산
          let manaAmount = aura.value;

          // 퍼센트 기반 회복인 경우
          if (aura.isPercent) {
            manaAmount = ally.stats.maxMp * (aura.value / 100);
          }

          // 마나 회복 적용
          ally.stats.mp = Math.min(ally.stats.maxMp, ally.stats.mp + manaAmount);

          // 마나 회복 시각 효과 (틱당 한 번)
          this.scene.effects.playManaEffect(ally);
        }
      }
    });
  }

  // 몬스터 치유 오라 효과 적용
  applyMonsterHealingAura(source, aura) {
    // 범위 내 아군 몬스터 찾기
    const allies = this.enemies.filter(e => e !== source && e.active && e.hp > 0);

    // 각 아군에게 치유 효과 적용
    allies.forEach(ally => {
      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 치유량 계산
        let healAmount = aura.value;

        // 퍼센트 기반 치유인 경우
        if (aura.isPercent) {
          healAmount = ally.maxHp * (aura.value / 100);
        }

        // 치유 적용
        this.healTarget(ally, healAmount);

        // 치유 시각 효과
        this.scene.effects.playHealEffect(ally, 'aura');
      }
    });
  }

  // 몬스터 대미지 오라 효과 적용
  applyMonsterDamageAura(source, aura) {
    // 플레이어가 범위 내에 있는지 확인
    if (!this.player || !this.player.active) return;

    const distance = Phaser.Math.Distance.Between(source.x, source.y, this.player.x, this.player.y);

    if (distance <= aura.radius) {
      // 대미지 계산
      let damageAmount = aura.value;

      // 퍼센트 기반 대미지인 경우
      if (aura.isPercent) {
        damageAmount = this.player.stats.maxHp * (aura.value / 100);
      }

      // 대미지 적용
      this.dealDamage(source, this.player, damageAmount, aura.element || 'neutral', false, true);

      // 추가 효과가 있는 경우
      if (aura.statusEffect && Math.random() < aura.statusChance) {
        this.addStatusEffect(source, this.player, aura.statusEffect, aura.statusValue, aura.statusDuration);
      }
    }

    // 플레이어 소환수에게도 적용
    if (this.scene.summons) {
      this.scene.summons.forEach(summon => {
        if (!summon.active || summon.hp <= 0 || summon.owner !== this.player) return;

        const summonDistance = Phaser.Math.Distance.Between(source.x, source.y, summon.x, summon.y);

        if (summonDistance <= aura.radius) {
          // 대미지 계산
          let summonDamage = aura.value;

          // 퍼센트 기반 대미지인 경우
          if (aura.isPercent) {
            summonDamage = summon.maxHp * (aura.value / 100);
          }

          // 대미지 적용
          this.dealDamage(source, summon, summonDamage, aura.element || 'neutral', false, true);
        }
      });
    }
  }

  // 몬스터 버프 오라 효과 적용
  applyMonsterBuffAura(source, aura) {
    // 범위 내 아군 몬스터 찾기
    const allies = this.enemies.filter(e => e !== source && e.active && e.hp > 0);

    // 각 아군에게 버프 효과 적용
    allies.forEach(ally => {
      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 버프 유형에 따른 처리
        switch (aura.buffType) {
          case 'attack':
            // 공격력 버프
            if (!ally.attackBuff || ally.attackBuff < (1 + aura.value / 100)) {
              ally.attackBuff = 1 + aura.value / 100;
              ally.attack = ally.baseAttack * ally.attackBuff;
              this.scene.effects.playBuffEffect(ally, 'attack');
            }
            break;
          case 'defense':
            // 방어력 버프
            if (!ally.defenseBuff || ally.defenseBuff < (1 + aura.value / 100)) {
              ally.defenseBuff = 1 + aura.value / 100;
              ally.defense = ally.baseDefense * ally.defenseBuff;
              this.scene.effects.playBuffEffect(ally, 'defense');
            }
            break;
          case 'speed':
            // 속도 버프
            if (!ally.speedBuff || ally.speedBuff < (1 + aura.value / 100)) {
              ally.speedBuff = 1 + aura.value / 100;
              ally.speedModifier = ally.speedModifier * ally.speedBuff;
              this.scene.effects.playBuffEffect(ally, 'speed');
            }
            break;
        }
      } else {
        // 범위를 벗어난 경우 버프 제거
        switch (aura.buffType) {
          case 'attack':
            if (ally.attackBuff) {
              ally.attack = ally.baseAttack;
              ally.attackBuff = 1;
            }
            break;
          case 'defense':
            if (ally.defenseBuff) {
              ally.defense = ally.baseDefense;
              ally.defenseBuff = 1;
            }
            break;
          case 'speed':
            if (ally.speedBuff) {
              ally.speedModifier = ally.speedModifier / ally.speedBuff;
              ally.speedBuff = 1;
            }
            break;
        }
      }
    });


    if (trap.effects) {
      trap.effects.forEach(effect => {
        if (effect.type === 'status') {
          this.addStatusEffect(trap.owner, this.player, effect.status, effect.value, effect.duration);
        }
      });
    }

    // 트랩 제거 (일회성 트랩인 경우)
    if (!trap.persistent) {
      const index = this.scene.traps.indexOf(trap);
      if (index !== -1) {
        this.scene.traps.splice(index, 1);
      }
    }
  }
  // 전투 중 지속적인 효과 처리
  updateCombatEffects(delta) {
    // 플레이어 오라 효과 처리 (있는 경우)
    this.updatePlayerAuras(delta);

    // 몬스터 오라 효과 처리
    this.updateMonsterAuras(delta);

    // 지속 효과가 있는 지역 처리 (독 구름, 화염 지대 등)
    this.updateEnvironmentalEffects(delta);
  }

  // 플레이어 오라 효과 업데이트
  updatePlayerAuras(delta) {
    if (!this.player || !this.player.active) return;

    // 플레이어가 가진 오라 효과 확인
    const auras = this.player.auras || [];

    auras.forEach(aura => {
      // 오라 지속시간 확인 및 감소
      if (aura.duration !== -1) { // -1은 영구 지속
        aura.duration -= delta / 1000;

        if (aura.duration <= 0) {
          // 오라 효과 제거
          const index = this.player.auras.indexOf(aura);
          if (index !== -1) {
            this.player.auras.splice(index, 1);
          }
          return;
        }
      }

      // 마지막 효과 적용 시간 확인
      const now = Date.now();
      if (now - aura.lastApplied < aura.interval) return;

      // 효과 적용 시간 갱신
      aura.lastApplied = now;

      // 오라 유형에 따른 효과 적용
      switch (aura.type) {
        case 'healing':
          // 치유 오라
          this.applyHealingAura(this.player, aura);
          break;
        case 'damage':
          // 대미지 오라
          this.applyDamageAura(this.player, aura);
          break;
        case 'protection':
          // 보호 오라
          this.applyProtectionAura(this.player, aura);
          break;
        case 'mana':
          // 마나 재생 오라
          this.applyManaAura(this.player, aura);
          break;
      }
    });
  }

  // 몬스터 오라 효과 업데이트
  updateMonsterAuras(delta) {
    if (!this.enemies) return;

    this.enemies.forEach(monster => {
      if (!monster.active || monster.hp <= 0) return;

      // 몬스터가 가진 오라 효과 확인
      const auras = monster.auras || [];

      auras.forEach(aura => {
        // 오라 지속시간 확인 및 감소
        if (aura.duration !== -1) {
          aura.duration -= delta / 1000;

          if (aura.duration <= 0) {
            // 오라 효과 제거
            const index = monster.auras.indexOf(aura);
            if (index !== -1) {
              monster.auras.splice(index, 1);
            }
            return;
          }
        }

        // 마지막 효과 적용 시간 확인
        const now = Date.now();
        if (now - aura.lastApplied < aura.interval) return;

        // 효과 적용 시간 갱신
        aura.lastApplied = now;

        // 몬스터 오라 효과 적용
        switch (aura.type) {
          case 'healing':
            // 치유 오라 (아군 몬스터에게 적용)
            this.applyMonsterHealingAura(monster, aura);
            break;
          case 'damage':
            // 대미지 오라 (플레이어에게 적용)
            this.applyMonsterDamageAura(monster, aura);
            break;
          case 'buff':
            // 버프 오라 (아군 몬스터에게 적용)
            this.applyMonsterBuffAura(monster, aura);
            break;
        }
      });
    });
  }

  // 환경 효과 업데이트
  updateEnvironmentalEffects(delta) {
    // 독 구름 처리
    if (this.scene.poisonClouds) {
      this.scene.poisonClouds.forEach(cloud => {
        // 지속시간 감소
        cloud.duration -= delta / 1000;

        if (cloud.duration <= 0) {
          // 독 구름 제거
          const index = this.scene.poisonClouds.indexOf(cloud);
          if (index !== -1) {
            this.scene.poisonClouds.splice(index, 1);
          }
          return;
        }

        // 플레이어가 독 구름 범위 내에 있는지 확인
        if (this.player && this.player.active) {
          const distance = Phaser.Math.Distance.Between(
            cloud.x, cloud.y, this.player.x, this.player.y
          );

          if (distance <= cloud.radius) {
            // 마지막 대미지 시간 확인
            const now = Date.now();
            if (now - cloud.lastTick >= cloud.tickInterval * 1000) {
              // 독 대미지 적용
              this.dealDamage(cloud.source, this.player, cloud.damage, 'poison', false, true);
              cloud.lastTick = now;
            }
          }
        }
      });
    }

    // 화염 지대 처리
    if (this.scene.fireZones) {
      this.scene.fireZones.forEach(zone => {
        // 지속시간 감소
        zone.duration -= delta / 1000;

        if (zone.duration <= 0) {
          // 화염 지대 제거
          const index = this.scene.fireZones.indexOf(zone);
          if (index !== -1) {
            this.scene.fireZones.splice(index, 1);
          }
          return;
        }

        // 플레이어가 화염 지대 범위 내에 있는지 확인
        if (this.player && this.player.active) {
          const distance = Phaser.Math.Distance.Between(
            zone.x, zone.y, this.player.x, this.player.y
          );

          if (distance <= zone.radius) {
            // 마지막 대미지 시간 확인
            const now = Date.now();
            if (now - zone.lastTick >= zone.tickInterval * 1000) {
              // 화염 대미지 적용
              this.dealDamage(zone.source, this.player, zone.damage, 'fire', false, true);
              zone.lastTick = now;

              // 화상 효과 적용 (확률에 따라)
              if (Math.random() < 0.3) {
                this.addStatusEffect(zone.source, this.player, 'burn', zone.damage * 0.5, 3);
              }
            }
          }
        }
      });
    }

    // 얼음 지대 처리
    if (this.scene.frostZones) {
      this.scene.frostZones.forEach(zone => {
        // 지속시간 감소
        zone.duration -= delta / 1000;

        if (zone.duration <= 0) {
          // 얼음 지대 제거
          const index = this.scene.frostZones.indexOf(zone);
          if (index !== -1) {
            this.scene.frostZones.splice(index, 1);
          }
          return;
        }

        // 플레이어가 얼음 지대 범위 내에 있는지 확인
        if (this.player && this.player.active) {
          const distance = Phaser.Math.Distance.Between(
            zone.x, zone.y, this.player.x, this.player.y
          );

          if (distance <= zone.radius) {
            // 감속 효과 적용
            if (!this.player.isSlowed) {
              this.addStatusEffect(zone.source, this.player, 'slow', zone.slowAmount, 1);

              // 얼음 지대에 처음 진입했을 때 대미지 적용
              if (!zone.playerAffected) {
                this.dealDamage(zone.source, this.player, zone.damage, 'ice', false, false);
                zone.playerAffected = true;
              }
            }
          } else {
            // 플레이어가 얼음 지대를 벗어남
            zone.playerAffected = false;
          }
        }
      });
    }
  }

  // 치유 오라 효과 적용
  applyHealingAura(source, aura) {
    // 범위 내 아군 찾기 (플레이어 팀)
    const allies = [this.player]; // 플레이어 자신

    // 플레이어 소환수 추가
    if (this.scene.summons) {
      allies.push(...this.scene.summons.filter(s => s.owner === this.player && s.active));
    }

    // 각 아군에게 치유 효과 적용
    allies.forEach(ally => {
      if (!ally.active || ally.hp <= 0) return;

      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 치유량 계산
        let healAmount = aura.value;

        // 퍼센트 기반 치유인 경우
        if (aura.isPercent) {
          healAmount = ally.maxHp * (aura.value / 100);
        }

        // 치유 적용
        this.healTarget(ally, healAmount);

        // 치유 시각 효과 (틱당 한 번)
        this.scene.effects.playHealEffect(ally, 'aura');
      }
    });
  }

  // 대미지 오라 효과 적용
  applyDamageAura(source, aura) {
    // 범위 내 적 찾기
    const enemies = this.enemies || [];

    // 각 적에게 대미지 효과 적용
    enemies.forEach(enemy => {
      if (!enemy.active || enemy.hp <= 0) return;

      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, enemy.x, enemy.y);

      if (distance <= aura.radius) {
        // 대미지 계산
        let damageAmount = aura.value;

        // 퍼센트 기반 대미지인 경우
        if (aura.isPercent) {
          damageAmount = enemy.maxHp * (aura.value / 100);
        }

        // 대미지 적용
        this.dealDamage(source, enemy, damageAmount, aura.element || 'neutral', false, true);

        // 추가 효과가 있는 경우
        if (aura.statusEffect && Math.random() < aura.statusChance) {
          this.addStatusEffect(source, enemy, aura.statusEffect, aura.statusValue, aura.statusDuration);
        }
      }
    });
  }

  // 보호 오라 효과 적용
  applyProtectionAura(source, aura) {
    // 범위 내 아군 찾기 (플레이어 팀)
    const allies = [this.player]; // 플레이어 자신

    // 플레이어 소환수 추가
    if (this.scene.summons) {
      allies.push(...this.scene.summons.filter(s => s.owner === this.player && s.active));
    }

    // 각 아군에게 보호 효과 적용
    allies.forEach(ally => {
      if (!ally.active) return;

      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 보호막 갱신 (기존 보호막보다 강할 경우)
        if (!ally.shield || ally.shield < aura.value) {
          // 이전 보호막 효과 제거
          if (ally.shield) {
            this.removeStatusEffect(ally.statusEffects.find(e => e.type === 'shield'));
          }

          // 새 보호막 적용
          ally.shield = aura.value;
          this.addStatusEffect(source, ally, 'shield', aura.value, 2); // 짧은 지속시간으로 갱신

          // 보호막 시각 효과
          this.scene.effects.playShieldEffect(ally, 'aura');
        }
      }
    });
  }

  // 마나 오라 효과 적용
  applyManaAura(source, aura) {
    // 범위 내 아군 찾기 (플레이어 팀)
    const allies = [this.player]; // 플레이어 자신

    // 플레이어 소환수 추가 (마나가 있는 경우)
    if (this.scene.summons) {
      allies.push(...this.scene.summons.filter(s => s.owner === this.player && s.active && s.stats && s.stats.mp !== undefined));
    }

    // 각 아군에게 마나 회복 효과 적용
    allies.forEach(ally => {
      if (!ally.active || !ally.stats || ally.stats.mp === undefined) return;

      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 마나가 최대가 아닌 경우만 회복
        if (ally.stats.mp < ally.stats.maxMp) {
          // 마나 회복량 계산
          let manaAmount = aura.value;

          // 퍼센트 기반 회복인 경우
          if (aura.isPercent) {
            manaAmount = ally.stats.maxMp * (aura.value / 100);
          }

          // 마나 회복 적용
          ally.stats.mp = Math.min(ally.stats.maxMp, ally.stats.mp + manaAmount);

          // 마나 회복 시각 효과 (틱당 한 번)
          this.scene.effects.playManaEffect(ally);
        }
      }
    });
  }

  // 몬스터 치유 오라 효과 적용
  applyMonsterHealingAura(source, aura) {
    // 범위 내 아군 몬스터 찾기
    const allies = this.enemies.filter(e => e !== source && e.active && e.hp > 0);

    // 각 아군에게 치유 효과 적용
    allies.forEach(ally => {
      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 치유량 계산
        let healAmount = aura.value;

        // 퍼센트 기반 치유인 경우
        if (aura.isPercent) {
          healAmount = ally.maxHp * (aura.value / 100);
        }

        // 치유 적용
        this.healTarget(ally, healAmount);

        // 치유 시각 효과
        this.scene.effects.playHealEffect(ally, 'aura');
      }
    });
  }

  // 몬스터 대미지 오라 효과 적용
  applyMonsterDamageAura(source, aura) {
    // 플레이어가 범위 내에 있는지 확인
    if (!this.player || !this.player.active) return;

    const distance = Phaser.Math.Distance.Between(source.x, source.y, this.player.x, this.player.y);

    if (distance <= aura.radius) {
      // 대미지 계산
      let damageAmount = aura.value;

      // 퍼센트 기반 대미지인 경우
      if (aura.isPercent) {
        damageAmount = this.player.stats.maxHp * (aura.value / 100);
      }

      // 대미지 적용
      this.dealDamage(source, this.player, damageAmount, aura.element || 'neutral', false, true);

      // 추가 효과가 있는 경우
      if (aura.statusEffect && Math.random() < aura.statusChance) {
        this.addStatusEffect(source, this.player, aura.statusEffect, aura.statusValue, aura.statusDuration);
      }
    }

    // 플레이어 소환수에게도 적용
    if (this.scene.summons) {
      this.scene.summons.forEach(summon => {
        if (!summon.active || summon.hp <= 0 || summon.owner !== this.player) return;

        const summonDistance = Phaser.Math.Distance.Between(source.x, source.y, summon.x, summon.y);

        if (summonDistance <= aura.radius) {
          // 대미지 계산
          let summonDamage = aura.value;

          // 퍼센트 기반 대미지인 경우
          if (aura.isPercent) {
            summonDamage = summon.maxHp * (aura.value / 100);
          }

          // 대미지 적용
          this.dealDamage(source, summon, summonDamage, aura.element || 'neutral', false, true);
        }
      });
    }
  }

  // 몬스터 버프 오라 효과 적용
  applyMonsterBuffAura(source, aura) {
    // 범위 내 아군 몬스터 찾기
    const allies = this.enemies.filter(e => e !== source && e.active && e.hp > 0);

    // 각 아군에게 버프 효과 적용
    allies.forEach(ally => {
      // 범위 내에 있는지 확인
      const distance = Phaser.Math.Distance.Between(source.x, source.y, ally.x, ally.y);

      if (distance <= aura.radius) {
        // 버프 유형에 따른 처리
        switch (aura.buffType) {
          case 'attack':
            // 공격력 버프
            if (!ally.attackBuff || ally.attackBuff < (1 + aura.value / 100)) {
              ally.attackBuff = 1 + aura.value / 100;
              ally.attack = ally.baseAttack * ally.attackBuff;
              this.scene.effects.playBuffEffect(ally, 'attack');
            }
            break;
          case 'defense':
            // 방어력 버프
            if (!ally.defenseBuff || ally.defenseBuff < (1 + aura.value / 100)) {
              ally.defenseBuff = 1 + aura.value / 100;
              ally.defense = ally.baseDefense * ally.defenseBuff;
              this.scene.effects.playBuffEffect(ally, 'defense');
            }
            break;
          case 'speed':
            // 속도 버프
            if (!ally.speedBuff || ally.speedBuff < (1 + aura.value / 100)) {
              ally.speedBuff = 1 + aura.value / 100;
              ally.speedModifier = ally.speedModifier * ally.speedBuff;
              this.scene.effects.playBuffEffect(ally, 'speed');
            }
            break;
        }
      } else {
        // 범위를 벗어난 경우 버프 제거
        switch (aura.buffType) {
          case 'attack':
            if (ally.attackBuff) {
              ally.attack = ally.baseAttack;
              ally.attackBuff = 1;
            }
            break;
          case 'defense':
            if (ally.defenseBuff) {
              ally.defense = ally.baseDefense;
              ally.defenseBuff = 1;
            }
            break;
          case 'speed':
            if (ally.speedBuff) {
              ally.speedModifier = ally.speedModifier / ally.speedBuff;
              ally.speedBuff = 1;
            }
            break;
        }
      }
    });
  }

  // 아이템 스킬 사용
  useItemSkill(player, itemId, target) {
    // 인벤토리 시스템 참조 확인
    const inventorySystem = this.scene.inventorySystem;
    if (!inventorySystem) return false;

    // 아이템 정보 가져오기
    const item = inventorySystem.getItemById(itemId);
    if (!item || !item.skill) return false;

    // 소모성 아이템인 경우 소비
    if (item.consumable) {
      // 아이템 수량 확인
      const count = inventorySystem.getItemCount(itemId);
      if (count <= 0) return false;

      // 아이템 소비
      inventorySystem.consumeItem(itemId, 1);
    } else {
      // 재사용 가능한 아이템의 경우 쿨다운 확인
      if (this.isItemOnCooldown(itemId)) return false;

      // 쿨다운 설정
      this.startItemCooldown(itemId, item.skill.cooldown || 30);
    }

    // 아이템 스킬 효과 적용
    this.applyItemSkillEffect(player, item.skill, target);

    // 아이템 사용 이벤트
    this.game.events.emit('itemUsed', {
      itemId: itemId,
      player: player,
      target: target
    });

    return true;
  }

  // 아이템 스킬 효과 적용
  applyItemSkillEffect(player, skill, target) {
    // 스킬 유형에 따른 처리
    switch (skill.type) {
      case 'heal':
        // 치유 포션 등
        const healAmount = typeof skill.value === 'string' && skill.value.endsWith('%')
          ? player.stats.maxHp * (parseInt(skill.value) / 100)
          : skill.value;

        this.healTarget(player, healAmount);
        this.scene.effects.playItemEffect(player, 'heal');
        break;

      case 'mana':
        // 마나 포션 등
        const manaAmount = typeof skill.value === 'string' && skill.value.endsWith('%')
          ? player.stats.maxMp * (parseInt(skill.value) / 100)
          : skill.value;

        player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + manaAmount);
        this.scene.effects.playItemEffect(player, 'mana');
        break;

      case 'damage':
        // 폭탄 등 대미지 아이템
        if (!target) {
          // 타겟이 없으면 AOE 대미지
          const radius = skill.radius || 3;
          const enemies = this.findEntitiesInRadius(player, radius, 'enemy');

          enemies.forEach(enemy => {
            this.dealDamage(player, enemy, skill.value, skill.element || 'physical', false);
          });

          this.scene.effects.playAoEEffect(player, radius, skill.element || 'physical');
        } else {
          // 단일 대상 대미지
          this.dealDamage(player, target, skill.value, skill.element || 'physical', false);
          this.scene.effects.playItemEffect(target, 'damage');
        }
        break;

      case 'buff':
        // 버프 아이템
        const duration = skill.duration || 30;

        skill.effects.forEach(effect => {
          this.addStatusEffect(player, player, effect.type, effect.value, duration);
        });

        this.scene.effects.playItemEffect(player, 'buff');
        break;

      case 'summon':
        // 소환 아이템
        if (!target) target = { x: player.x, y: player.y };

        const summonType = skill.summonType || 'elemental';
        const summonLevel = player.level || 1;
        const summon = this.createSummon(player, summonType, summonLevel, target);

        // 소환물 등록
        if (!this.scene.summons) this.scene.summons = [];
        this.scene.summons.push(summon);

        // 소환 효과 표시
        this.scene.effects.playSummonEffect(target, summonType);
        break;

      case 'teleport':
        // 텔레포트 아이템
        if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
          // 임의의 안전한 위치로 텔레포트
          const room = this.scene.dungeonGenerator.getRandomRoom();
          if (room) {
            const oldPos = { x: player.x, y: player.y };
            player.x = room.centerX;
            player.y = room.centerY;
            this.scene.effects.playTeleportEffect(player, oldPos, { x: player.x, y: player.y });
          }
        } else {
          // 지정된 위치로 텔레포트
          const oldPos = { x: player.x, y: player.y };
          player.x = target.x;
          player.y = target.y;
          this.scene.effects.playTeleportEffect(player, oldPos, target);
        }
        break;

      case 'identify':
        // 감정 주문서
        if (this.scene.inventorySystem) {
          const identified = this.scene.inventorySystem.identifyUnidentifiedItems();
          if (identified > 0) {
            this.scene.showNotification(`${identified}개의 아이템을 감정했습니다!`, 0x00FFFF);
          } else {
            this.scene.showNotification('감정할 아이템이 없습니다.', 0xFFFFFF);
          }
        }
        break;

      case 'reveal':
        // 지도 공개 아이템
        if (this.scene.revealMap) {
          this.scene.revealMap();
          this.scene.showNotification('던전 지도를 공개했습니다!', 0xFFFF00);
        }
        break;
    }
  }

  // 아이템 쿨다운 시작
  startItemCooldown(itemId, duration) {
    this.activeItemCooldowns = this.activeItemCooldowns || {};

    this.activeItemCooldowns[itemId] = {
      startTime: Date.now(),
      duration: duration * 1000 // 초 -> 밀리초
    };

    // 쿨다운 UI 업데이트
    this.scene.updateItemCooldownUI(itemId, duration);
  }

  // 아이템 쿨다운 확인
  isItemOnCooldown(itemId) {
    this.activeItemCooldowns = this.activeItemCooldowns || {};

    const cooldown = this.activeItemCooldowns[itemId];
    if (!cooldown) return false;

    const elapsed = Date.now() - cooldown.startTime;
    return elapsed < cooldown.duration;
  }

  // 아이템 쿨다운 남은 시간
  getItemCooldownRemaining(itemId) {
    this.activeItemCooldowns = this.activeItemCooldowns || {};

    const cooldown = this.activeItemCooldowns[itemId];
    if (!cooldown) return 0;

    const elapsed = Date.now() - cooldown.startTime;
    return Math.max(0, cooldown.duration - elapsed) / 1000; // 밀리초 -> 초
  }

  // 플레이어 상태 확인
  getPlayerStatusEffects() {
    // 플레이어에게 적용된 모든 상태 효과 반환
    return this.activeStatusEffects.filter(effect => effect.target === this.player);
  }

  // 몬스터 상태 확인
  getMonsterStatusEffects(monster) {
    // 특정 몬스터에게 적용된 모든 상태 효과 반환
    return this.activeStatusEffects.filter(effect => effect.target === monster);
  }

  // 상태 효과 UI 정보 가져오기
  getStatusEffectUIInfo(effect) {
    // 상태 효과 타입별 UI 정보
    const effectInfo = {
      burn: { icon: 'burn_icon', color: 0xFF4500, name: '화상' },
      poison: { icon: 'poison_icon', color: 0x00FF00, name: '중독' },
      bleed: { icon: 'bleed_icon', color: 0xFF0000, name: '출혈' },
      slow: { icon: 'slow_icon', color: 0x888888, name: '감속' },
      stun: { icon: 'stun_icon', color: 0xFFD700, name: '기절' },
      root: { icon: 'root_icon', color: 0x8B4513, name: '속박' },
      blind: { icon: 'blind_icon', color: 0x000000, name: '실명' },
      fear: { icon: 'fear_icon', color: 0x800080, name: '공포' },
      confusion: { icon: 'confusion_icon', color: 0xFF00FF, name: '혼란' },
      stealth: { icon: 'stealth_icon', color: 0x0000FF, name: '은신' },
      shield: { icon: 'shield_icon', color: 0xC0C0C0, name: '보호막' },
      attack_up: { icon: 'attack_up_icon', color: 0xFF6347, name: '공격력 증가' },
      defense_up: { icon: 'defense_up_icon', color: 0x4682B4, name: '방어력 증가' },
      speed_up: { icon: 'speed_up_icon', color: 0x32CD32, name: '속도 증가' },
      regeneration: { icon: 'regen_icon', color: 0x00FF7F, name: '재생' },
      mana_regen: { icon: 'mana_regen_icon', color: 0x1E90FF, name: '마나 재생' }
    };

    // 상태 효과 정보 반환
    return effectInfo[effect.type] || { icon: 'default_icon', color: 0xFFFFFF, name: '알 수 없음' };
  }

  // 합성 아이템 능력치 계산
  calculateCombinedItemStats(baseItem, materialItem) {
    // 두 아이템을 합성하여 새로운 능력치 계산
    const newStats = { ...baseItem.stats };

    // 재료 아이템의 능력치 일부 합성
    for (const stat in materialItem.stats) {
      // 기본 아이템에 없는 능력치는 30%만 합성
      if (newStats[stat] === undefined) {
        newStats[stat] = materialItem.stats[stat] * 0.3;
      }
      // 기존 능력치는 15% 보너스
      else {
        newStats[stat] += materialItem.stats[stat] * 0.15;
      }
    }

    // 특수 능력 합성 확률
    const specialAbilityChance = 0.3; // 30%

    // 특수 능력 목록 합치기
    const specialAbilities = [...(baseItem.specialAbilities || [])];

    // 재료 아이템의 특수 능력 일부 합성
    if (materialItem.specialAbilities) {
      materialItem.specialAbilities.forEach(ability => {
        // 중복 확인
        const existingAbility = specialAbilities.find(a => a.type === ability.type);

        if (existingAbility) {
          // 기존 능력 강화 (확률 기반)
          if (Math.random() < specialAbilityChance) {
            existingAbility.value = Math.max(existingAbility.value, ability.value);
          }
        } else {
          // 새 능력 추가 (확률 기반)
          if (Math.random() < specialAbilityChance) {
            specialAbilities.push({ ...ability });
          }
        }
      });
    }

    return {
      stats: newStats,
      specialAbilities: specialAbilities
    };
  }

  // 아이템 강화 계산
  calculateEnhancementBonus(item, enhancementLevel) {
    // 강화 레벨에 따른 능력치 보너스 계산
    const bonusMultiplier = 1 + (enhancementLevel * 0.1); // 강화 레벨당 10% 증가

    // 새 능력치 계산
    const enhancedStats = {};

    for (const stat in item.stats) {
      enhancedStats[stat] = item.stats[stat] * bonusMultiplier;
    }

    // 특수 능력 강화
    const enhancedAbilities = item.specialAbilities
      ? item.specialAbilities.map(ability => {
        // 값이 있는 능력치만 강화
        if (ability.value !== undefined) {
          return {
            ...ability,
            value: ability.value * bonusMultiplier
          };
        }
        return ability;
      })
      : [];

    return {
      stats: enhancedStats,
      specialAbilities: enhancedAbilities,
      enhancementLevel
    };
  }

  // 레벨업 보너스 계산
  calculateLevelUpBonus(player, newLevel) {
    // 기본 스탯 증가량
    const statIncrease = {
      maxHp: 5 + Math.floor(newLevel / 5) * 3,
      maxMp: 3 + Math.floor(newLevel / 5) * 2,
      attack: 1 + Math.floor(newLevel / 10),
      defense: 1 + Math.floor(newLevel / 15),
      speed: 0.5 + Math.floor(newLevel / 20) * 0.5
    };

    // 클래스별 보너스 계산
    const classSystem = this.scene.classSystem;
    if (classSystem) {
      const classBonus = classSystem.getLevelUpBonus(player.classId, newLevel);

      // 클래스 보너스 적용
      for (const stat in classBonus) {
        if (statIncrease[stat] !== undefined) {
          statIncrease[stat] += classBonus[stat];
        } else {
          statIncrease[stat] = classBonus[stat];
        }
      }
    }

    return statIncrease;
  }

  // 던전 난이도에 따른 몬스터 능력치 스케일링
  calculateMonsterScaling(baseStats, dungeonLevel, timeFactor) {
    // 기본 스탯 복사
    const scaledStats = { ...baseStats };

    // 던전 레벨에 따른 기본 스케일링
    const levelScaling = 1 + (dungeonLevel * 0.15); // 던전 레벨당 15% 증가

    // 시간 경과에 따른 추가 스케일링 (최대 50% 추가)
    const timeScaling = 1 + Math.min(0.5, timeFactor * 0.01);

    // 최종 스케일링 계수
    const totalScaling = levelScaling * timeScaling;

    // 스탯별 스케일링 적용
    for (const stat in scaledStats) {
      // 체력과 공격력은 더 큰 스케일링
      if (stat === 'hp' || stat === 'maxHp') {
        scaledStats[stat] = Math.floor(scaledStats[stat] * totalScaling * 1.2);
      }
      else if (stat === 'attack') {
        scaledStats[stat] = Math.floor(scaledStats[stat] * totalScaling * 1.1);
      }
      // 기타 스탯은 기본 스케일링
      else {
        scaledStats[stat] = Math.floor(scaledStats[stat] * totalScaling);
      }
    }

    return scaledStats;
  }

  // 몬스터 드롭 테이블 생성
  generateMonsterDropTable(monster, playerLuck) {
    // 기본 드롭 테이블
    const dropTable = [];

    // 몬스터 레벨과 종류에 따른 기본 드롭 확률
    const baseDropChance = monster.type === 'boss' ? 1.0 :
      monster.type === 'elite' ? 0.7 :
        monster.type === 'minion' ? 0.2 : 0.4;

    // 플레이어 행운 보정 (행운 10당 5% 드롭률 증가)
    const luckBonus = (playerLuck || 0) * 0.005;

    // 최종 드롭 확률
    const finalDropChance = Math.min(1.0, baseDropChance + luckBonus);

    // 몬스터 레벨과 종류에 따른 희귀도 확률
    let rarityChances = {
      common: 0.6,
      uncommon: 0.3,
      rare: 0.08,
      epic: 0.018,
      legendary: 0.002,
      mythic: 0.0002
    };

    // 보스는 최소 희귀 이상 보장
    if (monster.type === 'boss') {
      rarityChances = {
        rare: 0.65,
        epic: 0.3,
        legendary: 0.04,
        mythic: 0.01
      };
    }
    // 엘리트는 최소 고급 이상 보장
    else if (monster.type === 'elite') {
      rarityChances = {
        uncommon: 0.7,
        rare: 0.25,
        epic: 0.04,
        legendary: 0.009,
        mythic: 0.001
      };
    }

    // 행운 보정 적용 (희귀한 아이템 확률 약간 증가)
    if (playerLuck > 0) {
      // 일반 확률 감소
      rarityChances.common = Math.max(0.1, rarityChances.common - luckBonus);

      // 희귀 이상 확률 증가
      const rareIncrease = luckBonus * 0.5;
      rarityChances.rare = rarityChances.rare + rareIncrease * 0.4;
      rarityChances.epic = rarityChances.epic + rareIncrease * 0.3;
      rarityChances.legendary = rarityChances.legendary + rareIncrease * 0.2;
      rarityChances.mythic = rarityChances.mythic + rareIncrease * 0.1;
    }

    // 드롭 테이블에 골드 추가
    const goldBase = monster.level * 5;
    const goldVariance = monster.level * 3;
    const goldAmount = goldBase + Math.floor(Math.random() * goldVariance);

    dropTable.push({
      type: 'gold',
      amount: goldAmount,
      chance: finalDropChance + 0.2 // 골드는 아이템보다 드롭률 높음
    });

    // 경험치 추가
    const expBase = monster.level * 10;
    const expBonus = monster.type === 'boss' ? 5 : monster.type === 'elite' ? 2 : 1;

    dropTable.push({
      type: 'experience',
      amount: expBase * expBonus,
      chance: 1.0 // 경험치는 항상 지급
    });

    // 재료 아이템 추가
    const materialChance = finalDropChance * (monster.type === 'boss' ? 1.0 : monster.type === 'elite' ? 0.7 : 0.3);

    // 몬스터 타입과 원소에 따른 재료 결정
    let materialType = 'generic';

    if (monster.element) {
      materialType = monster.element + '_essence';
    }

    if (monster.type === 'boss') {
      materialType = 'boss_' + materialType;
    } else if (monster.type === 'elite') {
      materialType = 'elite_' + materialType;
    }

    dropTable.push({
      type: 'material',
      itemId: materialType,
      amount: monster.type === 'boss' ? 3 : monster.type === 'elite' ? 2 : 1,
      chance: materialChance
    });

    // 장비 아이템 추가
    // 몬스터 레벨과 타입에 따른 장비 결정
    const equipmentChance = finalDropChance * (monster.type === 'boss' ? 1.0 : monster.type === 'elite' ? 0.6 : 0.25);

    // 희귀도 롤링
    const rarityRoll = Math.random();
    let rarity = 'common';
    let cumulativeChance = 0;

    for (const [r, chance] of Object.entries(rarityChances)) {
      cumulativeChance += chance;
      if (rarityRoll < cumulativeChance) {
        rarity = r;
        break;
      }
    }

    dropTable.push({
      type: 'equipment',
      level: monster.level,
      rarity: rarity,
      chance: equipmentChance
    });

    // 보스 전용 드롭 (레거시 아이템, 스킬 책 등)
    if (monster.type === 'boss') {
      // 레거시 아이템 (매우 낮은 확률)
      dropTable.push({
        type: 'legacy',
        chance: 0.01 + (luckBonus * 0.1) // 1% + 행운 보너스
      });

      // 스킬 책
      dropTable.push({
        type: 'skillbook',
        chance: 0.2 + (luckBonus * 0.3) // 20% + 행운 보너스
      });

      // 클래스 해금 아이템
      dropTable.push({
        type: 'class_unlock',
        chance: 0.15 + (luckBonus * 0.2) // 15% + 행운 보너스
      });
    }

    // 엘리트 전용 드롭
    if (monster.type === 'elite') {
      // 강화 재료
      dropTable.push({
        type: 'enhancement_material',
        chance: 0.3 + (luckBonus * 0.2) // 30% + 행운 보너스
      });
    }

    return dropTable;
  }

  // 공격 이펙트 생성
  createAttackEffect(attacker, target, attackType) {
    // 각 공격 유형별 이펙트 생성
    switch (attackType) {
      case 'melee':
        // 근접 공격 이펙트
        this.scene.effects.playMeleeAttackEffect(attacker, target);
        break;
      case 'ranged':
        // 원거리 공격 이펙트
        this.scene.effects.playRangedAttackEffect(attacker, target);
        break;
      case 'magic':
        // 마법 공격 이펙트 (속성에 따라 다름)
        const element = attacker.element || 'neutral';
        this.scene.effects.playMagicAttackEffect(attacker, target, element);
        break;
      case 'special':
        // 특수 공격 이펙트
        this.scene.effects.playSpecialAttackEffect(attacker, target);
        break;
      default:
        // 기본 공격 이펙트
        this.scene.effects.playBasicAttackEffect(attacker, target);
    }
  }

  // 객체 풀링을 위한 파티클 효과 관리
  getParticleFromPool(type) {
    // 파티클 풀 초기화 (아직 없는 경우)
    this.particlePools = this.particlePools || {};
    this.particlePools[type] = this.particlePools[type] || [];

    // 비활성 파티클 찾기
    for (let i = 0; i < this.particlePools[type].length; i++) {
      if (!this.particlePools[type][i].active) {
        return this.particlePools[type][i];
      }
    }

    // 새 파티클 생성
    const particle = this.createNewParticle(type);
    this.particlePools[type].push(particle);
    return particle;
  }

  // 새 파티클 생성
  createNewParticle(type) {
    // 파티클 타입에 따른 초기 설정
    const particleSettings = {
      hit: {
        color: 0xFFFFFF,
        scale: 0.5,
        lifespan: 300,
        speed: 0.5
      },
      fire: {
        color: 0xFF4500,
        scale: 0.7,
        lifespan: 600,
        speed: 0.3
      },
      ice: {
        color: 0x00FFFF,
        scale: 0.6,
        lifespan: 500,
        speed: 0.2
      },
      lightning: {
        color: 0xFFFF00,
        scale: 0.5,
        lifespan: 200,
        speed: 1.0
      },
      heal: {
        color: 0x00FF00,
        scale: 0.6,
        lifespan: 800,
        speed: 0.2
      },
      magic: {
        color: 0x9370DB,
        scale: 0.6,
        lifespan: 700,
        speed: 0.4
      }
    };

    // 기본 설정 또는 지정된 타입 설정
    const settings = particleSettings[type] || particleSettings.hit;

    // 파티클 객체 생성
    return {
      type,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: settings.color,
      scale: settings.scale,
      alpha: 1,
      lifespan: settings.lifespan,
      maxLifespan: settings.lifespan,
      speed: settings.speed,
      active: false
    };
  }

  // 파티클 효과 시작
  startParticleEffect(type, x, y, count = 5) {
    // 여러 파티클 생성
    for (let i = 0; i < count; i++) {
      const particle = this.getParticleFromPool(type);

      // 파티클 위치 설정
      particle.x = x;
      particle.y = y;

      // 무작위 방향
      const angle = Math.random() * Math.PI * 2;
      const speed = particle.speed * (0.5 + Math.random() * 0.5);

      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;

      // 약간의 스케일 변화
      particle.scale = particle.scale * (0.8 + Math.random() * 0.4);

      // 활성화
      particle.active = true;
      particle.lifespan = particle.maxLifespan;
      particle.alpha = 1;
    }
  }

  // 파티클 업데이트
  updateParticles(delta) {
    // 모든 파티클 풀 순회
    for (const type in this.particlePools) {
      this.particlePools[type].forEach(particle => {
        if (!particle.active) return;

        // 위치 업데이트
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;

        // 수명 감소
        particle.lifespan -= delta;

        // 점점 투명해짐
        particle.alpha = particle.lifespan / particle.maxLifespan;

        // 수명 종료 확인
        if (particle.lifespan <= 0) {
          particle.active = false;
        }
      });
    }
  }

  // 파티클 렌더링
  renderParticles(renderer) {
    // 모든 활성 파티클 렌더링
    for (const type in this.particlePools) {
      this.particlePools[type].forEach(particle => {
        if (!particle.active) return;

        // 파티클 그리기
        renderer.particle(
          particle.x,
          particle.y,
          particle.scale,
          particle.color,
          particle.alpha
        );
      });
    }
  }

  // 보스 페이즈 변화 체크
  checkBossPhaseTransition(boss) {
    // 보스가 아니거나 페이즈 정보가 없으면 무시
    if (!boss || boss.type !== 'boss' || !boss.phases) return;

    // 보스 체력 비율
    const healthRatio = boss.hp / boss.maxHp;

    // 현재 페이즈
    const currentPhase = boss.currentPhase || 0;

    // 다음 페이즈 체크
    if (currentPhase < boss.phases.length &&
      healthRatio <= boss.phases[currentPhase].healthThreshold) {
      // 페이즈 변화 실행
      this.triggerBossPhaseChange(boss, currentPhase);

      // 페이즈 인덱스 증가
      boss.currentPhase = currentPhase + 1;
    }
  }

  // 보스 페이즈 변화 실행
  triggerBossPhaseChange(boss, phaseIndex) {
    const phase = boss.phases[phaseIndex];

    // 페이즈 변화 메시지
    this.scene.showMessage(phase.message || `${boss.name}의 새로운 힘이 발현됩니다!`);

    // 페이즈 변화 효과
    this.scene.effects.playBossPhaseChangeEffect(boss);

    // 페이즈별 효과 적용
    switch (phase.effect) {
      case 'power_up':
        // 공격력 증가
        boss.attack *= phase.powerMultiplier || 1.5;

        // 시각 효과
        this.scene.effects.playPowerUpEffect(boss);
        break;

      case 'summon_minions':
        // 하수인 소환
        const count = phase.minionCount || 3;

        for (let i = 0; i < count; i++) {
          this.scene.time.delayedCall(i * 500, () => {
            // 소환할 위치 계산
            const angle = (i / count) * Math.PI * 2;
            const distance = 3;

            const x = boss.x + Math.cos(angle) * distance;
            const y = boss.y + Math.sin(angle) * distance;

            // 하수인 생성
            const minion = this.createSummonedMinion(boss, phase.minionType || 'minion', x, y);

            // 하수인 등록
            if (minion) {
              if (!boss.aiState.summonedEntities) {
                boss.aiState.summonedEntities = [];
              }

              boss.aiState.summonedEntities.push(minion);

              // 소환 효과
              this.scene.effects.playSummonEffect({ x, y }, phase.minionType || 'minion');
            }
          });
        }
        break;

      case 'heal':
        // 자가 치유
        const healAmount = boss.maxHp * (phase.healPercent || 0.2);
        this.healTarget(boss, healAmount);

        // 치유 효과
        this.scene.effects.playHealEffect(boss, 'massive');
        break;

      case 'shield':
        // 보호막 생성
        const shieldAmount = boss.maxHp * (phase.shieldPercent || 0.3);
        boss.shield = shieldAmount;

        // 보호막 상태 효과 추가
        this.addStatusEffect(boss, boss, 'shield', shieldAmount, -1); // 무제한 지속

        // 보호막 효과
        this.scene.effects.playShieldEffect(boss, 'massive');
        break;

      case 'environment_change':
        // 전장 환경 변화
        this.scene.changeEnvironment(phase.environmentType);

        // 환경 변화 효과
        this.scene.effects.playEnvironmentChangeEffect(phase.environmentType);
        break;

      case 'rage':
        // 격노 상태
        boss.isEnraged = true;
        boss.attack *= phase.rageDamageMultiplier || 2.0;
        boss.attackSpeed *= phase.rageSpeedMultiplier || 1.5;

        // 격노 효과
        this.scene.effects.playEnrageEffect(boss, 'massive');
        break;
    }

    // 보스 페이즈 변화 이벤트
    this.game.events.emit('bossPhaseChange', {
      boss,
      phaseIndex,
      phase
    });
  }

  // 던전 완료 보상 계산
  calculateDungeonRewards(dungeonData, clearTime, playerLevel) {
    // 기본 보상
    const rewards = {
      gold: 0,
      experience: 0,
      items: []
    };

    // 던전 등급에 따른 기본 보상
    const baseGold = dungeonData.level * 50;
    const baseExp = dungeonData.level * 100;

    // 클리어 시간에 따른 보너스
    let timeBonus = 1.0;
    if (clearTime < dungeonData.parTime) {
      // 파 타임보다 빠르면 보너스
      timeBonus = 1.5;
    } else if (clearTime < dungeonData.parTime * 1.5) {
      // 적당한 시간
      timeBonus = 1.2;
    }

    // 던전 난이도 보너스
    const difficultyBonus = 1 + (dungeonData.difficulty * 0.2);

    // 최종 골드와 경험치
    rewards.gold = Math.floor(baseGold * timeBonus * difficultyBonus);
    rewards.experience = Math.floor(baseExp * timeBonus * difficultyBonus);

    // 아이템 보상
    // 기본 아이템 수 (던전 난이도에 따라 다름)
    const baseItemCount = Math.ceil(dungeonData.difficulty / 2);

    // 시간 보너스에 따른 추가 아이템
    const bonusItems = timeBonus > 1.3 ? 2 : timeBonus > 1.0 ? 1 : 0;

    // 최종 아이템 수
    const totalItems = baseItemCount + bonusItems;

    // 아이템 생성
    for (let i = 0; i < totalItems; i++) {
      // 희귀도 결정 (던전 난이도와 플레이어 레벨에 따라)
      const rarity = this.determineRewardRarity(dungeonData.difficulty, playerLevel);

      // 아이템 종류 결정 (무기, 방어구, 악세사리 등)
      const itemType = this.determineRewardItemType();

      // 아이템 생성
      const item = this.scene.dungeonGenerator.createItem(
        dungeonData,
        playerLevel,
        rarity,
        itemType
      );

      rewards.items.push(item);
    }

    // 특별 보상 (던전 타입에 따라)
    if (dungeonData.type === 'boss') {
      // 보스 던전은 클래스 조합 재료 추가
      rewards.items.push({
        id: 'class_combination_material',
        name: '클래스 조합 재료',
        type: 'material',
        rarity: 'rare',
        description: '클래스 조합에 필요한 희귀한 재료입니다.'
      });
    } else if (dungeonData.type === 'treasure') {
      // 보물 던전은 골드 대폭 증가
      rewards.gold *= 2;
    } else if (dungeonData.type === 'challenge') {
      // 도전 던전은 경험치 대폭 증가
      rewards.experience *= 2;
    }

    return rewards;
  }

  // 보상 아이템 희귀도 결정
  determineRewardRarity(dungeonDifficulty, playerLevel) {
    // 기본 희귀도 확률
    const baseChances = {
      common: 0.5,
      uncommon: 0.3,
      rare: 0.15,
      epic: 0.04,
      legendary: 0.009,
      mythic: 0.001
    };

    // 던전 난이도와 플레이어 레벨에 따른 보정
    const difficultyFactor = dungeonDifficulty * 0.05; // 난이도 당 5% 증가
    const levelFactor = playerLevel * 0.002; // 레벨 당 0.2% 증가

    // 최종 확률 계산
    const finalChances = {};
    finalChances.common = Math.max(0.1, baseChances.common - difficultyFactor - levelFactor);
    finalChances.uncommon = baseChances.uncommon;
    finalChances.rare = baseChances.rare + (difficultyFactor * 0.5);
    finalChances.epic = baseChances.epic + (difficultyFactor * 0.3) + (levelFactor * 0.3);
    finalChances.legendary = baseChances.legendary + (difficultyFactor * 0.15) + (levelFactor * 0.5);
    finalChances.mythic = baseChances.mythic + (difficultyFactor * 0.05) + (levelFactor * 0.2);

    // 확률 정규화
    const totalChance = Object.values(finalChances).reduce((sum, chance) => sum + chance, 0);
    for (const rarity in finalChances) {
      finalChances[rarity] /= totalChance;
    }

    // 희귀도 결정 (난수 기반)
    const roll = Math.random();
    let cumulativeChance = 0;

    for (const [rarity, chance] of Object.entries(finalChances)) {
      cumulativeChance += chance;
      if (roll < cumulativeChance) {
        return rarity;
      }
    }

    // 기본값
    return 'common';
  }

  // 보상 아이템 타입 결정
  determineRewardItemType() {
    // 아이템 타입별 확률
    const typeChances = {
      weapon: 0.25,
      armor: 0.25,
      accessory: 0.2,
      consumable: 0.15,
      material: 0.15
    };

    // 타입 결정 (난수 기반)
    const roll = Math.random();
    let cumulativeChance = 0;

    for (const [type, chance] of Object.entries(typeChances)) {
      cumulativeChance += chance;
      if (roll < cumulativeChance) {
        return type;
      }
    }

    // 기본값
    return 'weapon';
  }

  // 게임 난이도 조정
  adjustGameDifficulty(playerPerformance) {
    // 플레이어 성능에 따른 난이도 조정
    // playerPerformance는 0~1 사이 값 (높을수록 플레이어가 잘함)

    // 몬스터 능력치 조정 비율
    let monsterStatAdjustment = 1.0;

    if (playerPerformance > 0.8) {
      // 플레이어가 매우 잘하는 경우 - 난이도 상승
      monsterStatAdjustment = 1.2;
    } else if (playerPerformance > 0.6) {
      // 플레이어가 잘하는 경우 - 소폭 난이도 상승
      monsterStatAdjustment = 1.1;
    } else if (playerPerformance < 0.3) {
      // 플레이어가 어려움을 겪는 경우 - 난이도 하락
      monsterStatAdjustment = 0.9;
    }

    // 아이템 드롭률 조정
    let dropRateAdjustment = 1.0;

    if (playerPerformance < 0.4) {
      // 플레이어가 어려움을 겪는 경우 - 드롭률 증가
      dropRateAdjustment = 1.2;
    } else if (playerPerformance > 0.7) {
      // 플레이어가 잘하는 경우 - 소폭 드롭률 감소
      dropRateAdjustment = 0.9;
    }

    // 전투 시스템 밸런스 조정
    this.dynamicDifficultySettings = {
      monsterStatAdjustment,
      dropRateAdjustment,
      experienceMultiplier: 1.0 + (0.5 - playerPerformance) * 0.4, // 성능 낮을수록 경험치 증가
      damageReductionPlayer: Math.max(0, 0.1 - (playerPerformance * 0.1)), // 성능 낮을수록 대미지 감소
      criticalChanceBonus: Math.max(0, 0.05 - (playerPerformance * 0.05)) // 성능 낮을수록 치명타 증가
    };

    // 게임 난이도 조정 이벤트 발생
    this.game.events.emit('difficultyAdjusted', this.dynamicDifficultySettings);

    return this.dynamicDifficultySettings;
  }

  // 플레이어 성능 평가
  evaluatePlayerPerformance() {
    // 플레이어 성능 평가를 위한 지표들
    const playerStats = this.player.stats;
    const gameData = this.game.gameData;

    // 체력 유지율 (현재 체력 / 최대 체력)
    const healthRatio = playerStats.hp / playerStats.maxHp;

    // 평균 클리어 시간 대비 현재 속도
    const avgClearTimePerRoom = gameData.statistics.avgClearTimePerRoom || 60; // 기본값 60초
    const currentClearTimePerRoom = gameData.currentRun ?
      gameData.currentRun.totalTime / gameData.currentRun.roomsCleared : avgClearTimePerRoom;

    const speedRatio = avgClearTimePerRoom / Math.max(1, currentClearTimePerRoom);

    // 처치/사망 비율
    const killDeathRatio = gameData.statistics.monstersKilled / Math.max(1, gameData.statistics.playerDeaths);
    const normalizedKDR = Math.min(1, killDeathRatio / 20); // 최대 20으로 정규화

    // 아이템 효율
    const gearScore = this.calculatePlayerGearScore();
    const expectedGearScore = playerStats.level * 10; // 레벨당 기대 장비 점수
    const gearRatio = Math.min(1, gearScore / expectedGearScore);

    // 종합 성능 점수 계산 (0~1 사이 값)
    const performanceScore = (
      healthRatio * 0.3 + // 체력 비중 30%
      speedRatio * 0.2 + // 속도 비중 20%
      normalizedKDR * 0.3 + // 킬/데스 비중 30%
      gearRatio * 0.2 // 장비 비중 20%
    );

    return Math.max(0, Math.min(1, performanceScore));
  }

  // 플레이어 장비 점수 계산
  calculatePlayerGearScore() {
    // 장비 없으면 0 반환
    if (!this.player.equipment) return 0;

    // 슬롯별 가중치
    const slotWeights = {
      weapon: 1.2,
      armor: 1.0,
      helmet: 0.8,
      gloves: 0.6,
      boots: 0.6,
      accessory1: 0.7,
      accessory2: 0.7
    };

    // 희귀도별 가중치
    const rarityWeights = {
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 5,
      legendary: 8,
      mythic: 12
    };

    let totalScore = 0;

    // 각 장비 슬롯 검사
    for (const slot in this.player.equipment) {
      const itemId = this.player.equipment[slot];
      if (!itemId) continue;

      // 아이템 정보 가져오기
      const item = this.scene.inventorySystem.getItemById(itemId);
      if (!item) continue;

      // 아이템 점수 계산
      const baseScore = item.level || 1;
      const rarityMultiplier = rarityWeights[item.rarity] || 1;
      const slotMultiplier = slotWeights[slot] || 1;

      // 강화 보너스
      const enhancementBonus = item.enhancementLevel ?
        item.enhancementLevel * 0.2 : 0;

      // 슬롯별 점수 계산
      const itemScore = baseScore * rarityMultiplier * slotMultiplier * (1 + enhancementBonus);

      // 총 점수에 추가
      totalScore += itemScore;
    }

    return totalScore;
  }

  // 몬스터 인공지능 정보 (디버그용)
  getMonsterAIInfo(monster) {
    if (!monster || !monster.aiState) return null;

    return {
      currentState: monster.aiState.currentState,
      targetInfo: monster.aiState.target ? {
        id: monster.aiState.target.id,
        hp: monster.aiState.target.hp,
        maxHp: monster.aiState.target.maxHp,
        distance: Phaser.Math.Distance.Between(
          monster.x, monster.y,
          monster.aiState.target.x,
          monster.aiState.target.y
        )
      } : 'No target',
      lastStateChange: Date.now() - monster.aiState.lastStateChange,
      lastAttackTime: Date.now() - monster.aiState.lastAttackTime,
      lastSpecialTime: Date.now() - monster.aiState.lastSpecialTime,
      summonedEntities: monster.aiState.summonedEntities ?
        monster.aiState.summonedEntities.length : 0,
      isEnraged: monster.isEnraged || false,
      currentPatrolIndex: monster.aiState.patrolIndex,
      behaviors: monster.aiPattern ? monster.aiPattern.behaviors : []
    };
  }

  // 던전 진행도 계산
  calculateDungeonProgress() {
    // 던전 정보 가져오기
    const dungeonData = this.scene.currentDungeon;
    if (!dungeonData) return 0;

    // 던전 진행도 계산 방법
    // 1. 방 기반 진행도
    let roomProgress = 0;
    if (dungeonData.totalRooms && dungeonData.clearedRooms) {
      roomProgress = dungeonData.clearedRooms / dungeonData.totalRooms;
    }

    // 2. 보스 기반 진행도
    let bossProgress = 0;
    if (dungeonData.bosses) {
      const killedBosses = dungeonData.bosses.filter(boss => boss.isDefeated).length;
      bossProgress = killedBosses / dungeonData.bosses.length;
    }

    // 3. 미션 기반 진행도
    let missionProgress = 0;
    if (dungeonData.missions) {
      const completedMissions = dungeonData.missions.filter(mission => mission.isCompleted).length;
      missionProgress = completedMissions / dungeonData.missions.length;
    }

    // 최종 진행도 계산 (가중 평균)
    let finalProgress = 0;
    let totalWeight = 0;

    if (dungeonData.totalRooms) {
      finalProgress += roomProgress * 1;
      totalWeight += 1;
    }

    if (dungeonData.bosses) {
      finalProgress += bossProgress * 2; // 보스 진행도는 2배 중요
      totalWeight += 2;
    }

    if (dungeonData.missions) {
      finalProgress += missionProgress * 1.5; // 미션 진행도는 1.5배 중요
      totalWeight += 1.5;
    }

    // 가중 평균 계산
    const weightedProgress = totalWeight > 0 ? finalProgress / totalWeight : 0;

    return Math.min(1, Math.max(0, weightedProgress));
  }

  // 공식 기반 대미지 계산 (외부 참조용)
  calculateDamageFormula(attackerStats, targetStats, baseDamage, damageType, isCritical) {
    // 기본 대미지에 무작위 변동 적용 (±20%)
    const variance = 1 + (Math.random() * this.config.damageVariance * 2 - this.config.damageVariance);
    let damage = baseDamage * variance;

    // 공격자의 공격 페널티 적용
    if (attackerStats.attackPenalty) {
      damage *= (1 - attackerStats.attackPenalty);
    }

    // 치명타 대미지 계산
    if (isCritical) {
      const critMultiplier = attackerStats.critMultiplier || this.config.baseCritMultiplier;
      damage *= critMultiplier;
    }

    // 물리 대미지인 경우 방어력 적용
    if (damageType === 'physical') {
      const defense = targetStats.defense || 0;
      // 방어력 공식: 방어력이 높을수록 대미지 감소, 최대 90%까지
      let damageReduction = Math.min(0.9, defense / (defense + 100));

      // 타겟의 방어력 페널티 적용
      if (targetStats.defensePenalty) {
        damageReduction *= (1 - targetStats.defensePenalty);
      }

      damage *= (1 - damageReduction);
    }

    // 속성 저항 적용
    if (damageType !== 'physical' && damageType !== 'true' && targetStats.elementalResistances) {
      const resistance = targetStats.elementalResistances[damageType] || 0;
      damage *= (1 - resistance / 100);
    }

    // 대미지 감소 효과 적용 (타겟에 있는 경우)
    if (targetStats.damageResistance) {
      damage *= (1 - targetStats.damageResistance);
    }

    // 최소 대미지 보장 (1)
    return Math.max(1, Math.floor(damage));
  }

  // 폭발 효과 생성
  createExplosion(position, radius, damage, element, source) {
    // 폭발 시각 효과
    this.scene.effects.playExplosionEffect(position, radius, element);

    // 범위 내 대상 찾기
    const targets = this.findEntitiesInRadius(position, radius, 'all');

    // 각 대상에게 대미지 적용
    targets.forEach(target => {
      // 대미지 원천이 자기 자신인 경우 제외
      if (target === source) return;

      // 거리에 따른 대미지 감소
      const distance = Phaser.Math.Distance.Between(
        position.x, position.y, target.x, target.y
      );

      const distanceFactor = 1 - (distance / radius);
      const finalDamage = damage * distanceFactor;

      // 대미지 적용
      this.dealDamage(source, target, finalDamage, element, false, false);

      // 폭발 효과에 따른 넉백
      if (distanceFactor > 0.5) {
        const angle = Phaser.Math.Angle.Between(
          position.x, position.y, target.x, target.y
        );

        const knockbackDistance = radius * distanceFactor * 0.5;
        target.x += Math.cos(angle) * knockbackDistance;
        target.y += Math.sin(angle) * knockbackDistance;
      }

      // 원소 효과 적용
      this.applyElementalEffectOnExplosion(source, target, element, distanceFactor);
    });

    // 폭발 이벤트 발생
    this.game.events.emit('explosion', {
      position,
      radius,
      damage,
      element,
      source
    });

    return targets.length; // 영향 받은 대상 수 반환
  }

  // 폭발의 원소 효과 적용
  applyElementalEffectOnExplosion(source, target, element, intensity) {
    // 강도에 따라 효과 적용 확률 조정 (0.5~1.0)
    const effectChance = 0.5 + (intensity * 0.5);

    // 원소별 효과
    switch (element) {
      case 'fire':
        // 화염 - 화상 효과
        if (Math.random() < effectChance) {
          const burnDamage = target.maxHp * 0.02; // 최대 체력의 2%
          const burnDuration = 3; // 3초 지속
          this.addStatusEffect(source, target, 'burn', burnDamage, burnDuration);
        }
        break;

      case 'ice':
        // 얼음 - 감속 및 빙결 효과
        if (Math.random() < effectChance) {
          const slowAmount = 30; // 30% 감속
          const slowDuration = 3; // 3초 지속
          this.addStatusEffect(source, target, 'slow', slowAmount, slowDuration);

          // 높은 강도에서는 빙결 효과 추가
          if (intensity > 0.8 && Math.random() < 0.3) {
            this.addStatusEffect(source, target, 'stun', 1, 1); // 1초 기절
          }
        }
        break;

      case 'lightning':
        // 번개 - 기절 효과
        if (Math.random() < effectChance * 0.7) { // 번개는 확률 감소
          const stunDuration = 1; // 1초 기절
          this.addStatusEffect(source, target, 'stun', 1, stunDuration);
        }
        break;

      case 'poison':
        // 독 - 중독 효과
        if (Math.random() < effectChance) {
          const poisonDamage = target.maxHp * 0.015; // 최대 체력의 1.5%
          const poisonDuration = 5; // 5초 지속
          this.addStatusEffect(source, target, 'poison', poisonDamage, poisonDuration);
        }
        break;

      case 'dark':
        // 암흑 - 공포 효과
        if (Math.random() < effectChance * 0.8) { // 암흑은 확률 감소
          const fearValue = 20; // 공격력/방어력 20% 감소
          const fearDuration = 2; // 2초 지속
          this.addStatusEffect(source, target, 'fear', fearValue, fearDuration);
        }
        break;
    }
  }

  // 파편 생성 (폭발 등에서 사용)
  createShrapnel(position, count, damage, element, source) {
    for (let i = 0; i < count; i++) {
      // 파편의 방향 (랜덤)
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 3; // 5~8 거리

      // 파편의 목표 위치
      const targetX = position.x + Math.cos(angle) * distance;
      const targetY = position.y + Math.sin(angle) * distance;

      // 파편의 경로상 대상 찾기
      const hit = this.raycastToFindTarget(
        position.x, position.y,
        targetX, targetY,
        'all', source
      );

      if (hit) {
        // 대상에게 대미지
        this.dealDamage(source, hit.target, damage, element, false, false);

        // 파편 시각 효과
        this.scene.effects.playShrapnelEffect(
          position, { x: hit.position.x, y: hit.position.y }, element
        );
      } else {
        // 파편이 아무것도 맞추지 않음
        this.scene.effects.playShrapnelEffect(
          position, { x: targetX, y: targetY }, element
        );
      }
    }
  }

  // 레이캐스트로 대상 찾기
  raycastToFindTarget(startX, startY, endX, endY, targetTeam, source) {
    // 대상 리스트 준비
    let targets = [];

    if (targetTeam === 'player' || targetTeam === 'all') {
      if (this.player && this.player !== source && this.player.active && this.player.hp > 0) {
        targets.push(this.player);
      }
    }

    if (targetTeam === 'enemy' || targetTeam === 'all') {
      if (this.enemies) {
        targets = targets.concat(this.enemies.filter(
          e => e !== source && e.active && e.hp > 0
        ));
      }
    }

    // 가장 가까운 충돌 찾기
    let closestHit = null;
    let closestDistance = Infinity;

    targets.forEach(target => {
      // 대상과의 충돌 검사
      const hit = this.lineCircleIntersection(
        startX, startY, endX, endY,
        target.x, target.y, target.radius || 1
      );

      if (hit) {
        const distance = Phaser.Math.Distance.Between(startX, startY, hit.x, hit.y);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestHit = {
            target,
            position: { x: hit.x, y: hit.y },
            distance
          };
        }
      }
    });

    return closestHit;
  }

  // 선과 원의 교차점 계산
  lineCircleIntersection(x1, y1, x2, y2, cx, cy, r) {
    // 선분의 방향 벡터
    const dx = x2 - x1;
    const dy = y2 - y1;

    // 원점에서 선분 시작점까지의 벡터
    const fx = x1 - cx;
    const fy = y1 - cy;

    // 이차방정식 계수
    const a = dx * dx + dy * dy;
    const b = 2 * (dx * fx + dy * fy);
    const c = fx * fx + fy * fy - r * r;

    // 판별식
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      // 교차점 없음
      return null;
    }

    // 교차점 계산
    const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);

    // 선분 범위 내에서 가장 가까운 교차점 찾기
    let t = -1;

    if (t1 >= 0 && t1 <= 1) {
      t = t1;
    }

    if (t2 >= 0 && t2 <= 1 && (t < 0 || t2 < t1)) {
      t = t2;
    }

    if (t < 0) {
      // 유효한 교차점 없음
      return null;
    }

    // 교차점 좌표
    return {
      x: x1 + t * dx,
      y: y1 + t * dy
    };
  }

  // 컴뱃 로그 생성
  createCombatLog(actor, target, action, result) {
    // 컴뱃 로그 시스템이 없으면 무시
    if (!this.scene.combatLog) return;

    // 행동자 이름
    const actorName = actor.name ||
      (actor === this.player ? '플레이어' : '알 수 없음');

    // 대상 이름
    const targetName = target ? (target.name ||
      (target === this.player ? '플레이어' : '알 수 없음')) : '';

    // 로그 메시지 생성
    let message = '';

    switch (action) {
      case 'attack':
        // 공격 로그
        if (result.isCritical) {
          message = `${actorName}(이)가 ${targetName}에게 치명타! ${result.damage} 대미지`;
        } else if (result.damage === 0) {
          message = `${actorName}의 공격이 ${targetName}에게 빗나감`;
        } else {
          message = `${actorName}(이)가 ${targetName}에게 ${result.damage} 대미지`;
        }
        break;

      case 'skill':
        // 스킬 사용 로그
        message = `${actorName}(이)가 ${result.skillName} 스킬 사용! `;

        if (targetName) {
          message += `${targetName}에게 `;

          if (result.damage) {
            message += `${result.damage} 대미지`;
          } else if (result.heal) {
            message += `${result.heal} 회복`;
          } else {
            message += `효과 적용`;
          }
        }
        break;

      case 'status':
        // 상태 효과 로그
        message = `${targetName}(이)가 ${result.statusName} 상태가 됨 (${result.duration}초)`;
        break;

      case 'heal':
        // 치유 로그
        message = `${actorName}(이)가 ${targetName}의 체력을 ${result.amount} 회복`;
        break;

      case 'death':
        // 사망 로그
        message = `${targetName}(이)가 사망함!`;
        break;

      case 'item':
        // 아이템 사용 로그
        message = `${actorName}(이)가 ${result.itemName} 아이템 사용`;
        break;
    }

    // 로그 추가
    this.scene.combatLog.addEntry(message, action, actor, target);
  }

  // 씬 종료 시 마무리 작업
  dispose() {
    // 이벤트 리스너 제거
    this.scene.events.off('shutdown', this.onSceneShutdown, this);
    this.game.events.off('levelUp', this.onPlayerLevelUp, this);
    this.game.events.off('equipmentChanged', this.onEquipmentChanged, this);
    this.game.events.off('monsterKilled', this.onMonsterKilled, this);

    // 타이머 제거
    if (this.statusEffectTimer) {
      clearInterval(this.statusEffectTimer);
      this.statusEffectTimer = null;
    }

    if (this.aiDecisionTimer) {
      clearInterval(this.aiDecisionTimer);
      this.aiDecisionTimer = null;
    }

    // 파티클 풀 정리
    this.particlePools = null;

    // 참조 정리
    this.player = null;
    this.enemies = null;
    this.activeStatusEffects = [];
    this.damageNumbers = [];
    this.activeCooldowns = {};
    this.scene = null;
  }
}
// CombatSystem 클래스 내보내기
export default CombatSystem;