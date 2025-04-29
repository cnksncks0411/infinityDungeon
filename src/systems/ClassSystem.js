// src/systems/ClassSystem.js
class ClassSystem {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;

    // 클래스 데이터 로드
    this.classData = this.loadClassData();

    // 클래스 데이터를 게임 레지스트리에 저장 (다른 씬에서도 접근 가능)
    this.game.registry.set('classData', this.classData);
  }

  // 클래스 데이터 로드
  loadClassData() {
    const rawData = this.scene.cache.json.get('classes');
    return this.processClassData(rawData);
  }

  // 클래스 데이터 처리 및 변환
  processClassData(rawData) {
    // 클래스 관계 맵핑
    const processedData = rawData.map(classInfo => {
      return {
        ...classInfo,
        // 필요한 추가 처리
        abilities: this.processAbilities(classInfo.abilities),
        tier: this.getClassTier(classInfo.id)
      };
    });

    return processedData;
  }

  // 클래스 티어 결정
  getClassTier(classId) {
    const tierMap = {
      // 티어 1 (기본) 클래스
      'warrior': 1, 'archer': 1, 'mage': 1, 'thief': 1, 'lancer': 1,
      'monk': 1, 'cleric': 1, 'hunter': 1, 'knight': 1, 'alchemist': 1,

      // 티어 2 (조합) 클래스
      'magic_knight': 2, 'ranger': 2, 'assassin': 2, 'battle_mage': 2,
      'crusader': 2, 'druid': 2, 'ninja': 2, 'paladin': 2, 'gunner': 2,
      'berserker': 2, 'bard': 2, 'summoner': 2, 'dark_mage': 2, 'guardian': 2,
      'spellblade': 2, 'scout': 2, 'warden': 2, 'shadowdancer': 2, 'elementalist': 2,
      'herbalist': 2,

      // 티어 3 (상급) 클래스
      'death_knight': 3, 'arcane_ranger': 3, 'shadow_dancer': 3, 'battle_saint': 3,
      'archmage': 3, 'demon_hunter': 3, 'chronomancer': 3, 'dragon_tamer': 3,
      'blade_dancer': 3, 'spirit_walker': 3, 'holy_inquisitor': 3, 'blood_mage': 3,
      'forest_guardian': 3, 'void_stalker': 3, 'runesmith': 3,

      // 티어 4 (전설) 클래스
      'dragon_knight': 4, 'celestial_sage': 4, 'eternal_champion': 4,
      'apocalypse_bringer': 4, 'divine_arbiter': 4
    };

    return tierMap[classId] || 1;
  }

  // 클래스 스킬/능력 처리
  processAbilities(abilities) {
    if (!abilities) return [];

    return abilities.map(ability => {
      return {
        ...ability,
        cooldown: ability.cooldown || 0,
        manaCost: ability.manaCost || 0,
        range: ability.range || 1,
        // 효과 처리를 위한 함수 참조 추가
        effectFunction: this.getAbilityFunction(ability.id)
      };
    });
  }

  // 능력 효과 함수 가져오기
  getAbilityFunction(abilityId) {
    // 실제 구현에서는 능력별 효과 함수를 맵핑
    const abilityFunctions = {
      // 액티브 스킬
      'whirlwind': (player, targets) => this.executeWhirlwind(player, targets),
      'precise_shot': (player, target) => this.executePreciseShot(player, target),
      'backstab': (player, target) => this.executeBackstab(player, target),
      'arcane_bolt': (player, target) => this.executeArcaneBolt(player, target),
      'piercing_thrust': (player, targets) => this.executePiercingThrust(player, targets),
      'flying_kick': (player, target) => this.executeFlyingKick(player, target),
      'holy_light': (player, allies) => this.executeHolyLight(player, allies),
      'trap_setting': (player, position) => this.executeTrapSetting(player, position),
      'shield_bash': (player, target) => this.executeShieldBash(player, target),
      'explosive_flask': (player, position) => this.executeExplosiveFlask(player, position),

      // 티어 2 스킬
      'enchanted_blade': (player, target) => this.executeEnchantedBlade(player, target),
      'multi_shot': (player, targets) => this.executeMultiShot(player, targets),
      'shadow_strike': (player, target) => this.executeShadowStrike(player, target),

      // 티어 3 궁극기
      'army_of_the_dead': (player) => this.executeArmyOfTheDead(player),
      'arrow_storm': (player) => this.executeArrowStorm(player),
      'thousand_cuts': (player, target) => this.executeThousandCuts(player, target),

      // 티어 4 궁극기
      'eternal_flame': (player) => this.executeEternalFlame(player),
      'galaxy_collapse': (player) => this.executeGalaxyCollapse(player),
      'limit_break': (player) => this.executeLimitBreak(player),

      // 기타 스킬들...
    };

    return abilityFunctions[abilityId] || null;
  }

  // 액티브 스킬 실행 메서드들
  executeWhirlwind(player, targets) {
    console.log('Executing Whirlwind skill');
    // 회오리 베기 로직
    const damage = player.stats.attack * 0.8;
    targets.forEach(target => {
      this.scene.combat.dealDamage(player, target, damage, 'physical');
    });

    // 시각 효과
    this.scene.effects.playWhirlwindEffect(player);

    return true;
  }

  executePreciseShot(player, target) {
    console.log('Executing Precise Shot skill');
    // 정밀 사격 로직 - 치명타 확률 증가
    const critChance = 0.5; // 50% 치명타 확률
    const isCritical = Math.random() < critChance;
    const damage = player.stats.attack * (isCritical ? 2 : 1);

    this.scene.combat.dealDamage(player, target, damage, 'physical', isCritical);

    // 시각 효과
    this.scene.effects.playPreciseShotEffect(player, target, isCritical);

    return true;
  }

  executeBackstab(player, target) {
    console.log('Executing Backstab skill');
    // 암습 로직 - 타겟 후방에서 공격 시 3배 대미지
    const isFromBehind = this.isAttackingFromBehind(player, target);
    const damageMultiplier = isFromBehind ? 3 : 1.5;
    const damage = player.stats.attack * damageMultiplier;

    this.scene.combat.dealDamage(player, target, damage, 'physical');

    // 시각 효과
    this.scene.effects.playBackstabEffect(player, target, isFromBehind);

    return true;
  }

  executeArcaneBolt(player, target) {
    console.log('Executing Arcane Bolt skill');
    // 비전 화살 로직 - 마법 투사체
    const damage = player.stats.attack * 1.2;
    this.scene.combat.dealDamage(player, target, damage, 'magic');

    // 시각 효과
    this.scene.effects.playArcaneBoltEffect(player, target);

    return true;
  }

  executePiercingThrust(player, targets) {
    console.log('Executing Piercing Thrust skill');
    // 관통 찌르기 로직 - 여러 적 관통
    const damage = player.stats.attack * 1.1;
    targets.forEach(target => {
      this.scene.combat.dealDamage(player, target, damage, 'physical');
    });

    // 시각 효과
    this.scene.effects.playPiercingThrustEffect(player, targets);

    return true;
  }

  // 이하 다른 스킬 실행 메서드들...

  // 공격이 후방에서 이루어졌는지 확인
  isAttackingFromBehind(attacker, target) {
    // 실제 구현에서는 위치 계산 필요
    // 간단한 구현: 적의 방향과 플레이어 위치를 비교
    const targetFacingRad = target.rotation; // 타겟이 바라보는 각도 (라디안)
    const targetFacingDeg = (targetFacingRad * 180 / Math.PI) % 360;

    // 플레이어와 타겟 사이의 각도 계산
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const attackerAngleDeg = (Math.atan2(dy, dx) * 180 / Math.PI) % 360;

    // 차이가 135도 이상이면 후방 공격
    const angleDiff = Math.abs(targetFacingDeg - attackerAngleDeg);
    return angleDiff > 135 && angleDiff < 225;
  }

  // 클래스 조합 결과 가져오기
  getCombinationResult(class1Id, class2Id) {
    // 클래스 조합 매핑 테이블
    const combinationMap = {
      // 티어 2 조합 (티어 1 + 티어 1)
      'warrior+mage': 'magic_knight',
      'mage+warrior': 'battle_mage',
      'archer+hunter': 'ranger',
      'thief+hunter': 'assassin',
      'knight+cleric': 'crusader',
      'mage+hunter': 'druid',
      'monk+thief': 'ninja',
      'knight+cleric': 'paladin',
      'alchemist+archer': 'gunner',
      'warrior+monk': 'berserker',
      'thief+cleric': 'bard',
      'mage+alchemist': 'summoner',
      'mage+thief': 'dark_mage',
      'knight+warrior': 'guardian',
      'mage+lancer': 'spellblade',
      'archer+thief': 'scout',
      'hunter+knight': 'warden',
      'thief+monk': 'shadowdancer',
      'mage+mage': 'elementalist',
      'alchemist+cleric': 'herbalist',

      // 티어 3 조합 (티어 2 + 티어 2)
      'berserker+dark_mage': 'death_knight',
      'ranger+elementalist': 'arcane_ranger',
      'ninja+shadowdancer': 'shadow_dancer',
      'crusader+paladin': 'battle_saint',
      'elementalist+summoner': 'archmage',
      'assassin+guardian': 'demon_hunter',
      'dark_mage+elementalist': 'chronomancer',
      'warden+summoner': 'dragon_tamer',
      'magic_knight+shadowdancer': 'blade_dancer',
      'druid+herbalist': 'spirit_walker',
      'battle_saint+gunner': 'holy_inquisitor',
      'dark_mage+berserker': 'blood_mage',
      'druid+battle_saint': 'forest_guardian',
      'shadow_dancer+chronomancer': 'void_stalker',
      'spellblade+alchemist': 'runesmith',

      // 티어 4 조합 (티어 3 + 티어 3)
      'death_knight+dragon_tamer': 'dragon_knight',
      'archmage+spirit_walker': 'celestial_sage',
      'blade_dancer+holy_inquisitor': 'eternal_champion',
      'blood_mage+void_stalker': 'apocalypse_bringer',
      'celestial_sage+battle_saint': 'divine_arbiter'
    };

    // 순서 무관하게 조합 결과 찾기
    return combinationMap[`${class1Id}+${class2Id}`] || combinationMap[`${class2Id}+${class1Id}`];
  }

  // 클래스 성장 통계 계산
  calculateClassStats(classId, level = 1) {
    const classInfo = this.classData.find(c => c.id === classId);
    if (!classInfo) return null;

    const baseStats = classInfo.baseStats || {};
    const growthStats = classInfo.growthStats || {};

    // 레벨에 따른 스탯 계산
    return {
      hp: Math.floor(baseStats.hp + (growthStats.hp * (level - 1))),
      mp: Math.floor(baseStats.mp + (growthStats.mp * (level - 1))),
      attack: Math.floor(baseStats.attack + (growthStats.attack * (level - 1))),
      defense: Math.floor(baseStats.defense + (growthStats.defense * (level - 1))),
      speed: Math.floor(baseStats.speed + (growthStats.speed * (level - 1)))
    };
  }

  // 경험치 테이블 계산
  getRequiredExperience(level) {
    // 레벨업에 필요한 기본 경험치
    const baseExp = 100;

    // 레벨이 높아질수록 필요 경험치 증가
    return Math.floor(baseExp * Math.pow(level, 1.5));
  }

  // 티어별 클래스 목록 가져오기
  getClassesByTier(tier) {
    return this.classData.filter(c => c.tier === tier);
  }

  // 클래스 스킬 목록 가져오기
  getClassSkills(classId) {
    const classInfo = this.classData.find(c => c.id === classId);
    if (!classInfo) return [];

    return classInfo.abilities || [];
  }

  // 클래스 특수 능력 가져오기
  getClassSpecialAbility(classId) {
    const classInfo = this.classData.find(c => c.id === classId);
    if (!classInfo) return null;

    return classInfo.specialAbility;
  }

  // 클래스 패시브 효과 적용
  applyClassPassives(classId, stats) {
    const classInfo = this.classData.find(c => c.id === classId);
    if (!classInfo || !classInfo.passiveEffect) return stats;

    const newStats = { ...stats };
    const passive = classInfo.passiveEffect;

    // 패시브 효과 적용
    if (passive.type === 'stat_increase') {
      // 특정 스탯 증가
      if (passive.stat && passive.value) {
        if (newStats[passive.stat] !== undefined) {
          newStats[passive.stat] *= (1 + passive.value / 100);
          newStats[passive.stat] = Math.floor(newStats[passive.stat]);
        }
      }
    } else if (passive.type === 'special_effect') {
      // 특수 효과는 CombatSystem에서 처리
      // 여기서는 플래그만 설정
      newStats.specialEffects = newStats.specialEffects || [];
      newStats.specialEffects.push(passive.effect);
    }

    return newStats;
  }

  // 클래스 궁극기 실행
  executeUltimateSkill(player, targets) {
    const classId = player.classId;
    const classInfo = this.classData.find(c => c.id === classId);

    if (!classInfo || !classInfo.ultimateSkill) return false;

    const ultimate = classInfo.ultimateSkill;

    // 궁극기 실행 함수 호출
    const ultimateFunction = this.getAbilityFunction(ultimate.id);
    if (!ultimateFunction) return false;

    return ultimateFunction(player, targets);
  }

  // 클래스 전용 무기 확인
  isClassWeapon(classId, weaponId) {
    const classInfo = this.classData.find(c => c.id === classId);
    if (!classInfo) return false;

    // 클래스 전용 무기 목록
    const classWeapons = classInfo.exclusiveWeapons || [];
    return classWeapons.includes(weaponId);
  }

  // 티어 3 이상 클래스의 특수 능력 활성화
  activateSpecialAbility(player) {
    const classId = player.classId;
    const classInfo = this.classData.find(c => c.id === classId);

    if (!classInfo || classInfo.tier < 3) return false;

    const specialAbility = classInfo.specialAbility;
    if (!specialAbility) return false;

    // 특수 능력 활성화 효과
    switch (specialAbility.type) {
      case 'life_steal':
        // 생명력 흡수 효과 추가
        player.addStatusEffect('life_steal', specialAbility.value, specialAbility.duration);
        break;
      case 'elemental_arrows':
        // 원소 화살 효과 추가
        player.addStatusEffect('elemental_arrows', specialAbility.element, specialAbility.duration);
        break;
      case 'permanent_stealth':
        // 영구 은신 효과 추가 (이동 중에만)
        player.addStatusEffect('stealth_on_move', 1, -1); // -1은 무한 지속
        break;
      // 기타 특수 능력...
    }

    return true;
  }

  // 두 클래스의 조합 성공 확률 계산
  calculateCombinationChance(class1, class2, hasGoldenKey, alchemistLevel) {
    // 기본 성공 확률 결정
    let baseChance = 80; // 티어 2 조합 기본 확률

    // 결과 클래스 티어에 따라 기본 확률 조정
    const resultClassId = this.getCombinationResult(class1.id, class2.id);
    if (!resultClassId) return 0; // 유효하지 않은 조합

    const resultTier = this.getClassTier(resultClassId);

    switch (resultTier) {
      case 3:
        baseChance = 50; // 티어 3 조합 기본 확률
        break;
      case 4:
        baseChance = 25; // 티어 4 조합 기본 확률
        break;
    }

    // 추가 보너스 계산
    // 1. 레벨 보너스: 최소 요구치 이상의 레벨당 +1%
    const levelBonus = Math.min(40, (class1.level + class2.level - 20)); // 최대 +40%

    // 2. 황금 열쇠 보너스
    const keyBonus = hasGoldenKey ? 20 : 0;

    // 3. 연금술사 보너스
    const alchemistBonus = alchemistLevel ? Math.min(15, Math.floor(alchemistLevel / 2)) : 0;

    // 최종 성공 확률 계산 (최대 100%)
    return Math.min(100, baseChance + levelBonus + keyBonus + alchemistBonus);
  }

  // 클래스 마스터리 보너스 적용
  applyMasteryBonus(player) {
    const classId = player.classId;
    const classLevel = player.classLevel;

    // 마스터리 레벨에 따른 보너스
    const masteryBonuses = {
      10: { type: 'stat_boost', stats: ['attack', 'defense'], value: 5 }, // +5% 공격력, 방어력
      20: { type: 'skill_enhance', value: 10 }, // 스킬 효과 +10%
      30: { type: 'cooldown_reduction', value: 15 } // 쿨다운 -15%
    };

    // 적용 가능한 마스터리 보너스 확인
    Object.keys(masteryBonuses).forEach(level => {
      if (classLevel >= parseInt(level)) {
        const bonus = masteryBonuses[level];

        // 보너스 적용
        switch (bonus.type) {
          case 'stat_boost':
            bonus.stats.forEach(stat => {
              player.stats[stat] *= (1 + bonus.value / 100);
              player.stats[stat] = Math.floor(player.stats[stat]);
            });
            break;
          case 'skill_enhance':
            player.skillBoost = (player.skillBoost || 0) + bonus.value;
            break;
          case 'cooldown_reduction':
            player.cooldownReduction = (player.cooldownReduction || 0) + bonus.value;
            break;
        }
      }
    });
  }
}