// src/systems/ClassSystem.js
class ClassSystem {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    this.classData = this.loadClassData();
    this.game.registry.set('classData', this.classData);
  }

  // 클래스 데이터 로드 및 처리 메서드
  loadClassData() {
    const rawData = this.scene.cache.json.get('classes');
    return this.processClassData(rawData);
  }

  processClassData(rawData) {
    return rawData.map(classInfo => ({
      ...classInfo,
      abilities: this.processAbilities(classInfo.abilities),
      tier: this.getClassTier(classInfo.id)
    }));
  }

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

  // 능력/스킬 처리 메서드
  processAbilities(abilities) {
    if (!abilities) return [];
    return abilities.map(ability => ({
      ...ability,
      cooldown: ability.cooldown || 0,
      manaCost: ability.manaCost || 0,
      range: ability.range || 1,
      effectFunction: this.getAbilityFunction(ability.id)
    }));
  }

  getAbilityFunction(abilityId) {
    const abilityFunctions = {
      // 티어 1 스킬
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
    };
    return abilityFunctions[abilityId] || null;
  }

  // 스킬 실행 메서드
  executeWhirlwind(player, targets) {
    const damage = player.stats.attack * 0.8;
    targets.forEach(target => {
      this.scene.combat.dealDamage(player, target, damage, 'physical');
    });
    this.scene.effects.playWhirlwindEffect(player);
    return true;
  }

  executePreciseShot(player, target) {
    const critChance = 0.5;
    const isCritical = Math.random() < critChance;
    const damage = player.stats.attack * (isCritical ? 2 : 1);
    this.scene.combat.dealDamage(player, target, damage, 'physical', isCritical);
    this.scene.effects.playPreciseShotEffect(player, target, isCritical);
    return true;
  }

  executeBackstab(player, target) {
    const isFromBehind = this.isAttackingFromBehind(player, target);
    const damageMultiplier = isFromBehind ? 3 : 1.5;
    const damage = player.stats.attack * damageMultiplier;
    this.scene.combat.dealDamage(player, target, damage, 'physical');
    this.scene.effects.playBackstabEffect(player, target, isFromBehind);
    return true;
  }

  executeArcaneBolt(player, target) {
    const damage = player.stats.attack * 1.2;
    this.scene.combat.dealDamage(player, target, damage, 'magic');
    this.scene.effects.playArcaneBoltEffect(player, target);
    return true;
  }

  executePiercingThrust(player, targets) {
    const damage = player.stats.attack * 1.1;
    targets.forEach(target => {
      this.scene.combat.dealDamage(player, target, damage, 'physical');
    });
    this.scene.effects.playPiercingThrustEffect(player, targets);
    return true;
  }

  // 전투 유틸리티 메서드
  isAttackingFromBehind(attacker, target) {
    const targetFacingRad = target.rotation;
    const targetFacingDeg = (targetFacingRad * 180 / Math.PI) % 360;
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const attackerAngleDeg = (Math.atan2(dy, dx) * 180 / Math.PI) % 360;
    const angleDiff = Math.abs(targetFacingDeg - attackerAngleDeg);
    return angleDiff > 135 && angleDiff < 225;
  }

  // 클래스 조합 및 진행 메서드
  getCombinationResult(class1Id, class2Id) {
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
    return combinationMap[`${class1Id}+${class2Id}`] || combinationMap[`${class2Id}+${class1Id}`];
  }

  calculateClassStats(classId, level = 1) {
    const classInfo = this.classData.find(c => c.id === classId);
    if (!classInfo) return null;

    const baseStats = classInfo.baseStats || {};
    const growthStats = classInfo.growthStats || {};

    return {
      hp: Math.floor(baseStats.hp + (growthStats.hp * (level - 1))),
      mp: Math.floor(baseStats.mp + (growthStats.mp * (level - 1))),
      attack: Math.floor(baseStats.attack + (growthStats.attack * (level - 1))),
      defense: Math.floor(baseStats.defense + (growthStats.defense * (level - 1))),
      speed: Math.floor(baseStats.speed + (growthStats.speed * (level - 1)))
    };
  }

  getRequiredExperience(level) {
    const baseExp = 100;
    return Math.floor(baseExp * Math.pow(level, 1.5));
  }

  // 클래스 쿼리 및 정보 메서드
  getClassesByTier(tier) {
    return this.classData.filter(c => c.tier === tier);
  }

  getClassSkills(classId) {
    const classInfo = this.classData.find(c => c.id === classId);
    return classInfo ? (classInfo.abilities || []) : [];
  }

  getClassSpecialAbility(classId) {
    const classInfo = this.classData.find(c => c.id === classId);
    return classInfo ? classInfo.specialAbility : null;
  }

  // 클래스 특수 효과 적용 메서드
  applyClassPassives(classId, stats) {
    const classInfo = this.classData.find(c => c.id === classId);
    if (!classInfo || !classInfo.passiveEffect) return stats;

    const newStats = { ...stats };
    const passive = classInfo.passiveEffect;

    if (passive.type === 'stat_increase') {
      if (passive.stat && passive.value && newStats[passive.stat] !== undefined) {
        newStats[passive.stat] *= (1 + passive.value / 100);
        newStats[passive.stat] = Math.floor(newStats[passive.stat]);
      }
    } else if (passive.type === 'special_effect') {
      newStats.specialEffects = newStats.specialEffects || [];
      newStats.specialEffects.push(passive.effect);
    }

    return newStats;
  }

  executeUltimateSkill(player, targets) {
    const classId = player.classId;
    const classInfo = this.classData.find(c => c.id === classId);

    if (!classInfo || !classInfo.ultimateSkill) return false;

    const ultimate = classInfo.ultimateSkill;
    const ultimateFunction = this.getAbilityFunction(ultimate.id);
    return ultimateFunction ? ultimateFunction(player, targets) : false;
  }

  isClassWeapon(classId, weaponId) {
    const classInfo = this.classData.find(c => c.id === classId);
    if (!classInfo) return false;

    const classWeapons = classInfo.exclusiveWeapons || [];
    return classWeapons.includes(weaponId);
  }

  // 고급 클래스 기능 메서드
  activateSpecialAbility(player) {
    const classId = player.classId;
    const classInfo = this.classData.find(c => c.id === classId);

    if (!classInfo || classInfo.tier < 3 || !classInfo.specialAbility) return false;

    const specialAbility = classInfo.specialAbility;
    switch (specialAbility.type) {
      case 'life_steal':
        player.addStatusEffect('life_steal', specialAbility.value, specialAbility.duration);
        break;
      case 'elemental_arrows':
        player.addStatusEffect('elemental_arrows', specialAbility.element, specialAbility.duration);
        break;
      case 'permanent_stealth':
        player.addStatusEffect('stealth_on_move', 1, -1);
        break;
    }
    return true;
  }

  calculateCombinationChance(class1, class2, hasGoldenKey, alchemistLevel) {
    let baseChance = 80;
    const resultClassId = this.getCombinationResult(class1.id, class2.id);
    if (!resultClassId) return 0;

    const resultTier = this.getClassTier(resultClassId);
    switch (resultTier) {
      case 3: baseChance = 50; break;
      case 4: baseChance = 25; break;
    }

    const levelBonus = Math.min(40, (class1.level + class2.level - 20));
    const keyBonus = hasGoldenKey ? 20 : 0;
    const alchemistBonus = alchemistLevel ? Math.min(15, Math.floor(alchemistLevel / 2)) : 0;

    return Math.min(100, baseChance + levelBonus + keyBonus + alchemistBonus);
  }

  applyMasteryBonus(player) {
    const classId = player.classId;
    const classLevel = player.classLevel;

    const masteryBonuses = {
      10: { type: 'stat_boost', stats: ['attack', 'defense'], value: 5 },
      20: { type: 'skill_enhance', value: 10 },
      30: { type: 'cooldown_reduction', value: 15 }
    };

    Object.keys(masteryBonuses).forEach(level => {
      if (classLevel >= parseInt(level)) {
        const bonus = masteryBonuses[level];

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

export default ClassSystem;