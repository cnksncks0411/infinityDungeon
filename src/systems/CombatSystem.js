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
      
      // 타이머 설정
      this.statusEffectTimer = null;
      
      // 이벤트 리스너 설정
      this.setupEventListeners();
    }
    
    // 초기화
    init(player, enemies) {
      this.player = player;
      this.enemies = enemies;
      
      // 상태 효과 처리 타이머 시작
      this.startStatusEffectTimer();
      
      // 플레이어 전투 설정 초기화
      this.initializePlayerCombatStats();
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
          light: 0
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
    }
    
    // 씬 종료 시 정리 작업
    onSceneShutdown() {
      // 타이머 정리
      if (this.statusEffectTimer) {
        clearInterval(this.statusEffectTimer);
        this.statusEffectTimer = null;
      }
      
      // 이벤트 리스너 정리
      this.game.events.off('levelUp', this.onPlayerLevelUp, this);
      this.game.events.off('equipmentChanged', this.onEquipmentChanged, this);
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
    
    // 상태 효과 처리
    processStatusEffects() {
      // 상태 효과 복사본 생성 (처리 중 배열 변경 방지)
      const effects = [...this.activeStatusEffects];
      
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        
        // 효과 처리
        this.applyStatusEffectTick(effect);
        
        // 지속시간 감소
        effect.duration -= this.config.statusEffectInterval / 1000;
        
        // 효과 만료 확인
        if (effect.duration <= 0) {
          this.removeStatusEffect(effect);
        }
      }
      
      // 상태 UI 업데이트
      this.scene.updateStatusUI();
    }
    
    // 상태 효과 틱 적용
    applyStatusEffectTick(effect) {
      const target = effect.target;
      if (!target.active) return; // 대상이 비활성 상태면 건너뜀
      
      switch (effect.type) {
        case 'burn':
          // 화상 (시간당 HP 감소)
          this.dealDamage(effect.source, target, effect.damage, 'fire', false, true);
          break;
        case 'poison':
          // 중독 (시간당 HP 감소)
          this.dealDamage(effect.source, target, effect.damage, 'poison', false, true);
          break;
        case 'regeneration':
          // 재생 (시간당 HP 회복)
          this.healTarget(target, effect.healing);
          break;
        case 'mana_regen':
          // 마나 재생
          if (target.stats.mp < target.stats.maxMp) {
            target.stats.mp = Math.min(target.stats.mp + effect.value, target.stats.maxMp);
          }
          break;
        case 'slow':
          // 감속 (이동/공격 속도 감소)
          // 지속 효과라 매 틱마다 처리 불필요
          break;
        case 'stun':
          // 기절 (행동 불가)
          // 지속 효과라 매 틱마다 처리 불필요
          break;
        // 기타 상태 효과...
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
          
          // 효과 갱신 시각 효과
          this.scene.effects.playStatusEffectRefresh(target, type);
        }
      } else {
        // 새 효과 추가
        this.activeStatusEffects.push({
          source,
          target,
          type,
          value,
          damage: type === 'burn' || type === 'poison' ? value : 0,
          healing: type === 'regeneration' ? value : 0,
          duration,
          startTime: Date.now()
        });
        
        // 상태 효과 적용 시각 효과
        this.scene.effects.playStatusEffectApply(target, type);
        
        // 상태 효과에 따른 추가 처리
        this.applyInitialStatusEffect(source, target, type, value);
      }
      
      // 상태 UI 업데이트
      this.scene.updateStatusUI();
    }
    
    // 초기 상태 효과 적용 (시작 시 1회 적용)
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
          
          // 기절 시각 효과
          this.scene.effects.playStunEffect(target);
          break;
        case 'freeze':
          // 빙결 효과
          target.isFrozen = true;
          target.speedModifier = 0;
          
          // 빙결 시각 효과
          this.scene.effects.playFreezeEffect(target);
          break;
        // 기타 초기 상태 효과...
      }
    }
    
    // 상태 효과 제거
    removeStatusEffect(effect) {
      const index = this.activeStatusEffects.indexOf(effect);
      if (index === -1) return;
      
      const { target, type } = effect;
      
      // 효과 제거 전 정리 작업
      switch (type) {
        case 'slow':
          // 감속 효과 제거
          if (target.speedModifier) {
            // 정확한 복원을 위해 원래 속도의 비율로 계산
            target.speedModifier = target.speedModifier / (1 - effect.value / 100);
          }
          break;
        case 'stun':
          // 기절 효과 제거
          target.isStunned = false;
          break;
        case 'freeze':
          // 빙결 효과 제거
          target.isFrozen = false;
          target.speedModifier = 1.0;
          break;
        // 기타 상태 효과 제거...
      }
      
      // 배열에서 효과 제거
      this.activeStatusEffects.splice(index, 1);
      
      // 효과 제거 시각 효과
      this.scene.effects.playStatusEffectRemove(target, type);
      
      // 상태 UI 업데이트
      this.scene.updateStatusUI();
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
      
      // 치명타 대미지 계산
      if (isCritical) {
        const critMultiplier = attacker.combatStats?.critMultiplier || this.config.baseCritMultiplier;
        damage *= critMultiplier;
      }
      
      // 콤보 대미지 적용 (플레이어 공격인 경우)
      if (attacker === this.player) {
        damage *= attacker.combatStats.comboMultiplier;
      }
      
      // 공격자의 특수 효과 적용
      damage = this.applyAttackerSpecialEffects(attacker, target, damage, damageType);
      
      // 물리 대미지인 경우 방어력 적용
      if (damageType === 'physical') {
        const defense = target.stats.defense || 0;
        // 방어력 공식: 방어력이 높을수록 대미지 감소, 최대 90%까지
        const damageReduction = Math.min(0.9, defense / (defense + 100));
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
          // 기타 공격 특수 효과...
        }
      });
      
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
      if (target.type === 'monster' || target.type === 'boss') {
        // 속성 상성 시스템
        const resistances = {
          fire: { ice: -50, water: -50, fire: 75, earth: 25 },
          ice: { fire: -50, lightning: -25, ice: 75, water: 50 },
          lightning: { earth: -50, water: -50, lightning: 75 },
          earth: { lightning: -50, fire: -25, earth: 75 },
          dark: { light: -75, dark: 75 },
          light: { dark: -75, light: 75 },
          poison: { earth: 50, poison: 75 },
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
      
      // 회피 확률 계산
      const dodgeChance = target.combatStats?.dodgeChance || this.config.baseDodgeChance;
      
      // 정확도 감소 효과 적용 (공격자에게 있는 경우)
      const accuracyPenalty = attacker.accuracyPenalty || 0;
      
      // 최종 회피 확률 (최소 1%, 최대 80%)
      const finalDodgeChance = Math.min(0.8, Math.max(0.01, dodgeChance - accuracyPenalty));
      
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
  const affected = this.findEntitiesInRadius(targetPosition, radius, player.team === 'player' ? 'enemy' : 'player');
  
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
    const affected = this.findEntitiesInRadius(player, radius, player.team === 'player' ? 'enemy' : 'player');
    
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

// 대상 주변 엔티티 찾기
findEntitiesInRadius(center, radius, team) {
  const entities = [];
  
  // 대상 리스트 결정
  let targetList = [];
  if (team === 'enemy') {
    targetList = this.scene.enemies || [];
  } else if (team === 'player') {
    targetList = [this.player, ...(this.scene.allies || [])];
  } else {
    // 모든 엔티티
    targetList = [this.player, ...(this.scene.allies || []), ...(this.scene.enemies || [])];
  }
  
  // 반경 내 엔티티 필터링
  targetList.forEach(entity => {
    if (!entity.active) return;
    
    const distance = Phaser.Math.Distance.Between(center.x, center.y, entity.x, entity.y);
    if (distance <= radius) {
      entities.push(entity);
    }
  });
  
  return entities;
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
      const distance = Phaser.Math.Distance.Between(summon.x, summon.y, target.x, target.y);
      
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
        // 주인을 공격하는 적
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
    return this.findEntitiesInRadius({x: behindX, y: behindY}, 1.5, 'enemy').filter(e => e !== target);
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
  
  // 보스 페이즈 전환 확인
  checkBossPhaseTransition(boss) {
    if (!boss || !boss.phases || boss.phases.length === 0) return;
    
    // 현재 체력 비율
    const hpRatio = boss.hp / boss.maxHp;
    
    // 다음 페이즈 임계값 확인
    const nextPhase = boss.phases[boss.currentPhase];
    if (!nextPhase) return;
    
    // 임계값 이하로 체력이 떨어졌는지 확인
    if (hpRatio <= nextPhase.threshold) {
      // 페이즈 전환
      this.activateBossPhase(boss, nextPhase);
      
      // 다음 페이즈로 인덱스 증가
      boss.currentPhase++;
    }
  }
  
  // 보스 페이즈 활성화
  activateBossPhase(boss, phase) {
    // 페이즈 전환 메시지
    this.scene.showBossMessage(phase.message);
    
    // 스탯 강화
    if (phase.statBoost) {
      boss.attack *= phase.statBoost;
      boss.defense *= phase.statBoost;
      boss.speed *= phase.statBoost;
    }
    
    // 특수 능력 활성화
    if (phase.activateAbility) {
      const ability = boss.abilities.find(a => a.type === phase.activateAbility);
      if (ability) {
        // 쿨다운 초기화 및 즉시 사용
        ability.lastUsed = 0;
      }
    }
    
    // 페이즈 전환 이펙트
    this.scene.effects.playBossPhaseTransitionEffect(boss);
    
    // 카메라 효과
    this.scene.cameras.main.shake(500, 0.01);
  }
}

export default CombatSystem;