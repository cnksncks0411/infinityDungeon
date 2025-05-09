/**
 * Dungeon Loop 게임의 적 엔티티를 구현하는 클래스
 * monsters.json 데이터를 기반으로 적 캐릭터의 상태와 행동을 관리
 */
class Enemy extends Phaser.Physics.Arcade.Sprite {
    /**
     * @param {Phaser.Scene} scene - 적이 생성될 씬
     * @param {number} x - 초기 x 위치
     * @param {number} y - 초기 y 위치
     * @param {string} monsterId - monsters.json의 몬스터 ID
     * @param {object} config - 적 생성 설정
     */
    constructor(scene, x, y, monsterId, config = {}) {
        // 기본 스프라이트 생성 (실제 texture는 loadMonsterData 후 설정)
        super(scene, x, y, 'placeholder');

        this.scene = scene;
        this.monsterId = monsterId;
        this.monsterData = null;
        this.dungeonLevel = config.dungeonLevel || 1;
        this.difficultyMultiplier = config.difficultyMultiplier || 1;
        this.isElite = config.isElite || false;
        this.patrolArea = config.patrolArea || null;
        this.eliteAbilities = config.eliteAbilities || [];

        // 기본 상태 초기화
        this.stats = {
            hp: 0,
            maxHp: 0,
            attack: 0,
            defense: 0,
            speed: 0
        };

        // 전투 관련 상태
        this.combatState = {
            isAggro: false,
            attackCooldown: 0,
            stunned: false,
            stunnedTime: 0,
            lastAbilityUsed: null,
            abilityCooldowns: {}
        };

        // 상태 효과
        this.statusEffects = [];

        // 이동 관련 변수
        this.moveSpeed = 0;
        this.aggroRange = config.aggroRange || 200;
        this.attackRange = config.attackRange || 50;
        this.wanderDelay = 0;
        this.moveDirection = new Phaser.Math.Vector2(0, 0);
        this.lastMoveTime = 0;
        this.patrolPoint = null;
        this.attackCooldownTime = 1000; // 기본 1초

        // 시각 효과
        this.tint = 0xffffff;
        this.statusContainer = null;
        this.healthBar = null;

        // 물리 설정
        scene.physics.world.enable(this);
        scene.add.existing(this);
        this.body.setSize(32, 32); // 기본 충돌 영역

        // 데이터 로드 및 초기화
        this.loadMonsterData();
        this.initializeStatusContainer();
        this.createHealthBar();
    }

    /**
     * monsters.json에서 몬스터 데이터 로드 및 적용
     */
    loadMonsterData() {
        // 캐시에서 몬스터 데이터 가져오기
        const monstersData = this.scene.cache.json.get('monsters');
        const monsterData = monstersData.find(monster => monster.id === this.monsterId);

        if (!monsterData) {
            console.error(`Monster with ID ${this.monsterId} not found in monsters.json`);
            return;
        }

        this.monsterData = monsterData;

        // 스프라이트 설정
        const spriteData = monsterData.sprite;
        this.setTexture(spriteData.key);

        // 애니메이션 생성 및 적용
        this.createAnimations();

        // 스탯 계산 및 적용
        this.calculateStats();

        // 엘리트 몬스터인 경우 추가 설정
        if (this.isElite) {
            this.applyEliteBonus();
        }

        // 능력 쿨다운 초기화
        if (monsterData.abilities) {
            monsterData.abilities.forEach(ability => {
                this.combatState.abilityCooldowns[ability.id] = 0;
            });
        }

        // 공격 쿨다운 시간 조정
        this.attackCooldownTime = Math.max(500, 2000 - (this.stats.speed * 10));

        // 이동 속도 설정
        this.moveSpeed = Math.min(150, 50 + (this.stats.speed * 5));

        // 시각적 표현 업데이트
        this.updateVisuals();
    }

    /**
     * 몬스터 레벨과 난이도에 따른 스탯 계산
     */
    calculateStats() {
        const baseStats = this.monsterData.baseStats;
        const growthRate = this.monsterData.growthRate;
        const level = this.dungeonLevel;

        // 기본 스탯 계산
        this.stats.maxHp = Math.floor(baseStats.hp * (1 + (level - 1) * growthRate.hp) * this.difficultyMultiplier);
        this.stats.hp = this.stats.maxHp;
        this.stats.attack = Math.floor(baseStats.attack * (1 + (level - 1) * growthRate.attack) * this.difficultyMultiplier);
        this.stats.defense = Math.floor(baseStats.defense * (1 + (level - 1) * growthRate.defense) * this.difficultyMultiplier);
        this.stats.speed = Math.floor(baseStats.speed * (1 + (level - 1) * growthRate.speed) * this.difficultyMultiplier);
    }

    /**
     * 엘리트 몬스터 보너스 적용
     */
    applyEliteBonus() {
        // 엘리트 몬스터는 강화된 스탯을 가짐
        const eliteBonus = this.scene.game.config.eliteBonus || {
            hp: 1.5,
            attack: 1.3,
            defense: 1.2
        };

        this.stats.maxHp = Math.floor(this.stats.maxHp * eliteBonus.hp);
        this.stats.hp = this.stats.maxHp;
        this.stats.attack = Math.floor(this.stats.attack * eliteBonus.attack);
        this.stats.defense = Math.floor(this.stats.defense * eliteBonus.defense);

        // 엘리트 몬스터 시각적 표현
        this.setScale(1.2);
        this.setTint(0xffcc00);

        // 엘리트 추가 능력 적용
        if (this.eliteAbilities && this.eliteAbilities.length > 0) {
            this.eliteAbilities.forEach(ability => {
                // 추가 능력의 쿨다운 초기화
                this.combatState.abilityCooldowns[ability.id] = 0;
            });
        }
    }

    /**
     * 보스 단계 체크 및 적용
     */
    checkAndApplyPhases() {
        if (this.monsterData.type !== 'boss' || !this.monsterData.phases) {
            return;
        }

        const hpPercent = this.stats.hp / this.stats.maxHp;

        // 현재 체력에 맞는 단계 찾기
        const activePhase = this.monsterData.phases.find(phase =>
            hpPercent <= phase.threshold &&
            !phase.activated
        );

        if (activePhase && !activePhase.activated) {
            // 단계 활성화
            activePhase.activated = true;

            // 단계 메시지 표시
            if (activePhase.message) {
                this.scene.events.emit('bossPhaseChange', {
                    boss: this,
                    message: activePhase.message
                });
            }

            // 스탯 증가가 있으면 적용
            if (activePhase.statBoost) {
                this.stats.attack = Math.floor(this.stats.attack * (1 + activePhase.statBoost));
                this.stats.defense = Math.floor(this.stats.defense * (1 + activePhase.statBoost));
                this.stats.speed = Math.floor(this.stats.speed * (1 + activePhase.statBoost));
                this.moveSpeed = Math.min(180, 50 + (this.stats.speed * 5));
            }

            // 특정 능력 활성화
            if (activePhase.activateAbility) {
                this.useAbility(activePhase.activateAbility);
            }

            // 시각적 효과
            this.scene.tweens.add({
                targets: this,
                alpha: 0.2,
                duration: 150,
                yoyo: true,
                repeat: 5,
                onComplete: () => {
                    this.setTint(this.getPhaseColor(hpPercent));
                }
            });
        }
    }

    /**
     * 현재 단계에 맞는 색상 반환
     */
    getPhaseColor(hpPercent) {
        if (hpPercent <= 0.25) {
            return 0xff0000; // 빨간색 (위험)
        } else if (hpPercent <= 0.5) {
            return 0xff6600; // 주황색 (경고)
        } else if (hpPercent <= 0.75) {
            return 0xffcc00; // 노란색 (주의)
        } else {
            return 0xffffff; // 기본색
        }
    }

    /**
     * 애니메이션 생성
     */
    createAnimations() {
        const key = this.monsterData.sprite.key;
        const frameWidth = this.monsterData.sprite.frameWidth;
        const frameHeight = this.monsterData.sprite.frameHeight;

        // 이미 생성된 애니메이션인지 확인
        if (this.scene.anims.exists(`${key}_idle`)) {
            return;
        }

        // 기본 애니메이션 생성 (키 프레임 정보가 몬스터마다 다를 수 있음)
        this.scene.anims.create({
            key: `${key}_idle`,
            frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        this.scene.anims.create({
            key: `${key}_move`,
            frames: this.scene.anims.generateFrameNumbers(key, { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1
        });

        this.scene.anims.create({
            key: `${key}_attack`,
            frames: this.scene.anims.generateFrameNumbers(key, { start: 8, end: 11 }),
            frameRate: 12,
            repeat: 0
        });

        this.scene.anims.create({
            key: `${key}_hurt`,
            frames: this.scene.anims.generateFrameNumbers(key, { start: 12, end: 13 }),
            frameRate: 8,
            repeat: 0
        });

        this.scene.anims.create({
            key: `${key}_die`,
            frames: this.scene.anims.generateFrameNumbers(key, { start: 14, end: 17 }),
            frameRate: 10,
            repeat: 0
        });

        // 기본 애니메이션 재생
        this.play(`${key}_idle`);
    }

    /**
     * 체력바 생성
     */
    createHealthBar() {
        // 체력바 컨테이너
        this.healthBar = this.scene.add.group();

        // 체력바 배경
        const barBg = this.scene.add.rectangle(0, -30, 40, 6, 0x333333);

        // 체력바
        const bar = this.scene.add.rectangle(0, -30, 40, 6, this.getHealthBarColor());
        bar.setOrigin(0, 0.5);
        bar.x = -20; // 중앙 정렬을 위해 조정

        this.healthBar.add(barBg);
        this.healthBar.add(bar);

        // hp bar는 enemy.bar로 접근
        this.bar = bar;
    }

    /**
     * 상태 효과 아이콘 컨테이너 초기화
     */
    initializeStatusContainer() {
        this.statusContainer = this.scene.add.container(0, 0);
    }

    /**
     * 체력에 따른 체력바 색상 반환
     */
    getHealthBarColor() {
        const healthPercent = this.stats.hp / this.stats.maxHp;

        if (healthPercent <= 0.2) {
            return 0xff0000; // 빨간색 (위험)
        } else if (healthPercent <= 0.5) {
            return 0xffaa00; // 주황색 (경고)
        } else {
            return 0x00cc00; // 녹색 (양호)
        }
    }

    /**
     * 시각적 요소 업데이트
     */
    updateVisuals() {
        // 체력바 위치 업데이트
        if (this.healthBar) {
            this.healthBar.getChildren().forEach(child => {
                child.x = this.x + child.originX;
                child.y = this.y - 30;
            });

            // 체력바 업데이트
            const barWidth = 40 * (this.stats.hp / this.stats.maxHp);
            this.bar.width = Math.max(0, barWidth);
            this.bar.fillColor = this.getHealthBarColor();
        }

        // 상태 효과 아이콘 위치 업데이트
        if (this.statusContainer) {
            this.statusContainer.x = this.x;
            this.statusContainer.y = this.y - 40;
            this.updateStatusEffectIcons();
        }

        // 플레이어와의 방향에 따라 뒤집기
        if (this.scene.player) {
            if (this.scene.player.x < this.x) {
                this.flipX = true;
            } else {
                this.flipX = false;
            }
        }
    }

    /**
     * 상태 효과 아이콘 업데이트
     */
    updateStatusEffectIcons() {
        // 기존 아이콘 제거
        this.statusContainer.removeAll(true);

        // 활성 상태 효과 아이콘 추가
        if (this.statusEffects.length > 0) {
            this.statusEffects.forEach((effect, index) => {
                // 아이콘 생성 (실제 게임에서는 적절한 텍스처 사용)
                const icon = this.scene.add.sprite(
                    -15 + (index * 10),
                    0,
                    'status_icons',
                    this.getStatusIconFrame(effect.type)
                );
                icon.setScale(0.5);

                // 남은 시간을 표시하는 텍스트 (선택 사항)
                if (effect.duration > 0) {
                    const timeText = this.scene.add.text(
                        icon.x,
                        icon.y + 6,
                        Math.ceil(effect.duration / 1000).toString(),
                        { fontSize: '8px', fill: '#ffffff' }
                    );
                    timeText.setOrigin(0.5);
                    this.statusContainer.add(timeText);
                }

                this.statusContainer.add(icon);
            });
        }
    }

    /**
     * 상태 효과 타입에 따른 아이콘 프레임 인덱스 반환
     */
    getStatusIconFrame(effectType) {
        const iconFrames = {
            'poison': 0,
            'burn': 1,
            'frozen': 2,
            'stun': 3,
            'slow': 4,
            'bleed': 5,
            'weakness': 6
        };

        return iconFrames[effectType] || 0;
    }

    /**
     * 데미지 처리
     * 
     * @param {object} damageInfo - 데미지 정보
     * @returns {object} - 처리된 데미지 결과
     */
    takeDamage(damageInfo) {
        if (this.isDead) return { damage: 0, isCritical: false };

        const baseDamage = damageInfo.damage || 0;
        const isCritical = damageInfo.isCritical || false;
        const attackElement = damageInfo.element || 'neutral';
        const damageType = damageInfo.type || 'physical';

        // 데미지 계산
        let calculatedDamage = baseDamage;

        // 방어력 적용
        if (damageType === 'physical') {
            calculatedDamage = Math.max(1, calculatedDamage - this.stats.defense / 2);
        }

        // 원소 상성 계산
        const elementMultiplier = this.calculateElementalEffectiveness(attackElement, this.monsterData.element);
        calculatedDamage = Math.floor(calculatedDamage * elementMultiplier);

        // 크리티컬 데미지
        if (isCritical) {
            calculatedDamage = Math.floor(calculatedDamage * 1.5);
        }

        // 최종 데미지는 최소 1
        const finalDamage = Math.max(1, calculatedDamage);

        // HP 감소
        this.stats.hp = Math.max(0, this.stats.hp - finalDamage);

        // 데미지 텍스트 표시
        this.showDamageText(finalDamage, isCritical, elementMultiplier > 1);

        // 피격 애니메이션 재생
        this.playHurtAnimation();

        // 상태 효과 적용 (공격 속성에 따라)
        this.applyElementalStatusEffect(attackElement, damageInfo.effectChance);

        // 보스 단계 체크
        if (this.monsterData.type === 'boss') {
            this.checkAndApplyPhases();
        }

        // 사망 체크
        if (this.stats.hp <= 0) {
            this.die();
        }

        // 처리된 데미지 정보 반환
        return {
            damage: finalDamage,
            isCritical: isCritical,
            isElementalEffect: elementMultiplier > 1,
            isDead: this.stats.hp <= 0
        };
    }

    /**
     * 데미지 텍스트 표시
     */
    showDamageText(damage, isCritical, isEffective) {
        // 데미지 표시 텍스트 스타일 설정
        const textStyle = {
            fontSize: isCritical ? '20px' : '16px',
            fontFamily: 'Arial',
            color: isCritical ? '#ff0000' : '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            shadow: { blur: 5, stroke: true }
        };

        // 데미지 숫자에 접두어 추가
        let displayText = damage.toString();
        if (isEffective) {
            displayText = '효과적! ' + displayText;
        }
        if (isCritical) {
            displayText = '치명타! ' + displayText;
        }

        // 텍스트 오브젝트 생성
        const text = this.scene.add.text(
            this.x,
            this.y - 20,
            displayText,
            textStyle
        );
        text.setOrigin(0.5);

        // 텍스트 애니메이션
        this.scene.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 1500,
            onComplete: () => {
                text.destroy();
            }
        });
    }

    /**
     * 원소 상성에 따른 데미지 배율 계산
     */
    calculateElementalEffectiveness(attackElement, defenseElement) {
        // 기본 상성 표
        const effectivenessChart = {
            'fire': { 'ice': 2.0, 'wind': 0.5, 'fire': 0.5 },
            'ice': { 'wind': 2.0, 'earth': 0.5, 'ice': 0.5 },
            'earth': { 'fire': 2.0, 'ice': 0.5, 'earth': 0.5 },
            'wind': { 'earth': 2.0, 'fire': 0.5, 'wind': 0.5 },
            'light': { 'dark': 2.0, 'light': 0.5 },
            'dark': { 'light': 2.0, 'dark': 0.5 },
            'poison': { 'earth': 0.5, 'poison': 0.5 }
        };

        // 원소 효과가 정의되어 있으면 해당 배율 반환
        if (
            effectivenessChart[attackElement] &&
            effectivenessChart[attackElement][defenseElement]
        ) {
            return effectivenessChart[attackElement][defenseElement];
        }

        // 기본 배율 1.0
        return 1.0;
    }

    /**
     * 원소 속성에 따른 상태 효과 적용
     */
    applyElementalStatusEffect(element, chance = 0.2) {
        // 기본 확률이 없으면 20%
        chance = chance || 0.2;

        // 확률 체크
        if (Math.random() > chance) return;

        // 원소별 상태 효과
        const elementalEffects = {
            'fire': { type: 'burn', damage: 5, duration: 3000 },
            'ice': { type: 'frozen', slow: 0.5, duration: 2000 },
            'poison': { type: 'poison', damage: 3, duration: 5000 },
            'earth': { type: 'slow', value: 0.3, duration: 2500 },
            'dark': { type: 'weakness', value: 0.2, duration: 4000 },
            'light': { type: 'stun', duration: 1000 }
        };

        // 원소에 대응하는 효과가 있으면 적용
        if (elementalEffects[element]) {
            this.addStatusEffect(elementalEffects[element]);
        }
    }

    /**
     * 상태 효과 추가
     */
    addStatusEffect(effectData) {
        // 동일한 타입 효과가 있는지 확인
        const existingEffectIndex = this.statusEffects.findIndex(
            effect => effect.type === effectData.type
        );

        // 이미 있는 효과의 경우 갱신
        if (existingEffectIndex !== -1) {
            // 기존 효과의 남은 시간과 새 효과의 지속시간 중 더 긴 것 적용
            const currentDuration = this.statusEffects[existingEffectIndex].duration;
            this.statusEffects[existingEffectIndex] = {
                ...effectData,
                duration: Math.max(currentDuration, effectData.duration),
                startTime: Date.now()
            };
        } else {
            // 새 효과 추가
            this.statusEffects.push({
                ...effectData,
                startTime: Date.now()
            });
        }

        // 효과 적용 이벤트 발생
        this.scene.events.emit('statusEffectApplied', {
            target: this,
            effect: effectData
        });

        // 상태 효과 아이콘 업데이트
        this.updateStatusEffectIcons();
    }

    /**
     * 상태 효과 업데이트
     */
    updateStatusEffects(delta) {
        if (this.statusEffects.length === 0) return;

        const currentTime = Date.now();
        const removeList = [];

        this.statusEffects.forEach((effect, index) => {
            // 지속시간 감소
            const timeElapsed = currentTime - effect.startTime;
            effect.duration = Math.max(0, effect.duration - delta);

            // 주기적 효과 발생 (틱 데미지 등)
            if (effect.damage && effect.interval) {
                if (timeElapsed % effect.interval < delta) {
                    this.takeDamage({
                        damage: effect.damage,
                        type: 'dot',
                        element: effect.type
                    });
                }
            }

            // 지속적인 효과 적용 (슬로우 등)
            if (effect.type === 'slow' || effect.type === 'frozen') {
                this.moveSpeed = this.moveSpeed * (1 - (effect.value || 0.5));
            }

            // 기절 효과
            if (effect.type === 'stun') {
                this.combatState.stunned = true;
            }

            // 약화 효과
            if (effect.type === 'weakness') {
                // 공격력 감소는 매 프레임마다 계산하지 않고, 효과 시작/종료 시에만 적용
            }

            // 효과 종료 체크
            if (effect.duration <= 0) {
                removeList.push(index);
            }
        });

        // 종료된 효과 제거 (역순으로 제거해야 인덱스 변화에 영향 없음)
        for (let i = removeList.length - 1; i >= 0; i--) {
            const index = removeList[i];
            const effect = this.statusEffects[index];

            // 종료된 효과 이벤트 발생
            this.scene.events.emit('statusEffectRemoved', {
                target: this,
                effect: effect
            });

            // 슬로우/기절 효과 종료 시 처리
            if (effect.type === 'slow' || effect.type === 'frozen') {
                // 이동 속도 복원은 updateMovement에서 처리
            }
            if (effect.type === 'stun') {
                this.combatState.stunned = false;
            }

            // 효과 제거
            this.statusEffects.splice(index, 1);
        }

        // 변경이 있으면 아이콘 업데이트
        if (removeList.length > 0) {
            this.updateStatusEffectIcons();
        }
    }

    /**
     * 피격 애니메이션 재생
     */
    playHurtAnimation() {
        const key = this.monsterData.sprite.key;

        // 이미 죽은 상태에서는 애니메이션 재생하지 않음
        if (this.isDead) return;

        // 피격 효과음 재생
        if (this.scene.sound && this.scene.sound.get) {
            const hurtSound = this.scene.sound.get('enemy_hurt');
            if (hurtSound) hurtSound.play({ volume: 0.5 });
        }

        // 피격 애니메이션
        this.play(`${key}_hurt`);

        // 깜박임 효과
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                if (!this.isDead) {
                    this.play(`${key}_idle`);
                }
            }
        });
    }

    /**
     * 사망 처리
     */
    die() {
        if (this.isDead) return;

        this.isDead = true;
        this.body.checkCollision.none = true;

        // 사망 애니메이션 재생
        const key = this.monsterData.sprite.key;
        this.play(`${key}_die`);

        // 사망 효과음 재생
        if (this.scene.sound && this.scene.sound.get) {
            const deathSound = this.scene.sound.get('enemy_death');
            if (deathSound) deathSound.play({ volume: 0.7 });
        }

        // 사망 효과 (파티클 등)
        this.createDeathEffect();

        // 루트 드롭
        this.dropLoot();

        // 경험치 지급
        this.giveExperience();

        // 사망 이벤트 발생
        this.scene.events.emit('enemyDeath', {
            enemy: this,
            monsterId: this.monsterId,
            isElite: this.isElite,
            position: { x: this.x, y: this.y }
        });

        // 몸체 페이드 아웃 및 제거
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 1000,
            delay: 1000,
            onComplete: () => {
                this.destroyEnemy();
            }
        });
    }

    /**
     * 사망 시 시각 효과 생성
     */
    createDeathEffect() {
        // 파티클 효과
        if (this.scene.particleManager) {
            const particleConfig = {
                tint: this.isElite ? 0xffcc00 : 0xffffff,
                scale: { start: 0.5, end: 0 },
                speed: { min: 50, max: 100 },
                quantity: this.isElite ? 20 : 10,
                lifespan: 800
            };

            this.scene.particleManager.createEmitter({
                ...particleConfig,
                x: this.x,
                y: this.y,
                emitCallback: () => { }
            });
        }

        // 광원 효과 (있다면)
        if (this.scene.lights && this.scene.lights.addLight) {
            const light = this.scene.lights.addLight(this.x, this.y, 100,
                this.isElite ? 0xffcc00 : 0xffffff, 1);

            this.scene.tweens.add({
                targets: light,
                radius: 0,
                intensity: 0,
                duration: 1000,
                onComplete: () => {
                    this.scene.lights.removeLight(light);
                }
            });
        }
    }

    /**
     * 적 객체 완전 제거
     */
    destroyEnemy() {
        // 체력바 제거
        if (this.healthBar) {
            this.healthBar.clear(true, true);
        }

        // 상태 효과 아이콘 제거
        if (this.statusContainer) {
            this.statusContainer.destroy();
        }

        // 물리 바디 비활성화
        this.body.enable = false;

        // 스프라이트 제거
        this.destroy();
    }

    /**
     * 전리품 드랍
     */
    dropLoot() {
        // 기본 드롭 확률
        const dropLoot = this.monsterData.loot;
        if (!dropLoot) return;

        // 골드 드롭
        const goldAmount = Phaser.Math.Between(
            dropLoot.gold.min,
            dropLoot.gold.max
        );

        if (goldAmount > 0) {
            this.scene.events.emit('goldDrop', {
                amount: goldAmount,
                x: this.x,
                y: this.y,
                isElite: this.isElite
            });
        }

        // 아이템 드롭 확률 체크
        if (Math.random() <= dropLoot.dropChance || this.isElite) {
            // 드롭 가능 아이템 목록
            const possibleItems = dropLoot.possibleItems;

            if (possibleItems && possibleItems.length > 0) {
                // 랜덤 아이템 선택
                const itemId = possibleItems[Math.floor(Math.random() * possibleItems.length)];

                // 아이템 드롭 이벤트 발생
                this.scene.events.emit('itemDrop', {
                    itemId: itemId,
                    x: this.x,
                    y: this.y,
                    isElite: this.isElite
                });
            }
        }
    }

    /**
     * 경험치 지급
     */
    giveExperience() {
        if (!this.monsterData.loot || !this.monsterData.loot.experience) return;

        // 기본 경험치 계산
        const baseExp = Phaser.Math.Between(
            this.monsterData.loot.experience.min,
            this.monsterData.loot.experience.max
        );

        // 난이도 및 엘리트 보너스 적용
        let expAmount = baseExp * this.difficultyMultiplier;

        // 엘리트 몬스터는 추가 경험치
        if (this.isElite) {
            expAmount *= 2;
        }

        // 보스는 더 많은 경험치
        if (this.monsterData.type === 'boss') {
            expAmount *= 5;
        }

        // 최종 경험치 정수화
        expAmount = Math.floor(expAmount);

        // 경험치 지급 이벤트 발생
        this.scene.events.emit('experienceGain', {
            amount: expAmount,
            source: this.monsterId
        });
    }

    /**
     * 공격 실행
     * @param {object} target - 공격 대상 (일반적으로 플레이어)
     */
    attack(target) {
        if (this.isDead || this.combatState.stunned) return false;

        // 공격 쿨다운 체크
        if (this.combatState.attackCooldown > 0) return false;

        // 공격 범위 체크
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            target.x, target.y
        );

        if (distance > this.attackRange) return false;

        // 공격 방향 설정
        if (target.x < this.x) {
            this.flipX = true;
        } else {
            this.flipX = false;
        }

        // 공격 애니메이션 재생
        const key = this.monsterData.sprite.key;
        this.play(`${key}_attack`);

        // 공격 효과음 재생
        this.playAttackSound();

        // 공격 쿨다운 설정
        this.combatState.attackCooldown = this.attackCooldownTime;

        // 공격 대미지 계산
        const damage = this.calculateAttackDamage();

        // 대미지 적용
        if (target.takeDamage) {
            // 딜레이를 주어 애니메이션과 동기화
            this.scene.time.delayedCall(300, () => {
                // 대상이 아직 유효한지 확인
                if (target.active) {
                    const damageResult = target.takeDamage({
                        damage: damage.value,
                        type: this.monsterData.attackType,
                        element: this.monsterData.element,
                        isCritical: damage.isCritical,
                        source: this
                    });

                    // 공격 효과 표시
                    this.showAttackEffect(target);

                    // 공격 결과 이벤트 발생
                    this.scene.events.emit('enemyAttackResult', {
                        attacker: this,
                        target: target,
                        damage: damageResult
                    });
                }
            });
        }

        return true;
    }

    /**
     * 공격 효과음 재생
     */
    playAttackSound() {
        if (!this.scene.sound || !this.scene.sound.get) return;

        // 공격 타입에 따른 효과음
        let soundKey;

        switch (this.monsterData.attackType) {
            case 'melee':
                soundKey = 'enemy_melee';
                break;
            case 'ranged':
                soundKey = 'enemy_ranged';
                break;
            case 'magic':
                soundKey = 'enemy_magic';
                break;
            default:
                soundKey = 'enemy_attack';
        }

        const attackSound = this.scene.sound.get(soundKey);
        if (attackSound) {
            attackSound.play({ volume: 0.5 });
        }
    }

    /**
     * 공격 대미지 계산
     */
    calculateAttackDamage() {
        // 기본 공격력
        let damage = this.stats.attack;

        // 치명타 확률 (10%)
        const isCritical = Math.random() < 0.1;

        // 치명타 대미지 증가
        if (isCritical) {
            damage = Math.floor(damage * 1.5);
        }

        // 변동성 추가 (±10%)
        const variation = 0.9 + Math.random() * 0.2;
        damage = Math.floor(damage * variation);

        // 최소 대미지는 1
        damage = Math.max(1, damage);

        return {
            value: damage,
            isCritical: isCritical
        };
    }

    /**
     * 공격 시각 효과 표시
     */
    showAttackEffect(target) {
        // 공격 타입에 따른 효과
        switch (this.monsterData.attackType) {
            case 'melee':
                this.showMeleeAttackEffect(target);
                break;
            case 'ranged':
                this.showRangedAttackEffect(target);
                break;
            case 'magic':
                this.showMagicAttackEffect(target);
                break;
            default:
                this.showDefaultAttackEffect(target);
        }
    }

    /**
     * 근접 공격 효과
     */
    showMeleeAttackEffect(target) {
        if (!this.scene.add || !this.scene.tweens) return;

        // 공격 궤적 효과
        const swipe = this.scene.add.sprite(
            (this.x + target.x) / 2,
            (this.y + target.y) / 2,
            'attack_swing'
        );

        // 공격 방향에 따라 회전
        const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        swipe.setRotation(angle);

        // 애니메이션
        swipe.play('attack_swing_anim');

        // 효과 제거
        this.scene.time.delayedCall(300, () => {
            swipe.destroy();
        });
    }

    /**
     * 원거리 공격 효과
     */
    showRangedAttackEffect(target) {
        if (!this.scene.add || !this.scene.physics) return;

        // 투사체 생성
        const projectile = this.scene.physics.add.sprite(
            this.x,
            this.y,
            'projectiles',
            this.getProjectileFrame()
        );

        // 출발 위치 조정 (몬스터 종류에 따라)
        projectile.x = this.flipX ? this.x - 20 : this.x + 20;
        projectile.y = this.y - 10;

        // 투사체 속성 설정
        projectile.setScale(0.7);

        // 투사체 이동 방향 계산
        const angle = Phaser.Math.Angle.Between(
            projectile.x, projectile.y,
            target.x, target.y
        );

        // 투사체 회전
        projectile.setRotation(angle + Math.PI / 2);

        // 목표 방향으로 속도 설정
        const speed = 300;
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;

        projectile.body.setVelocity(velocityX, velocityY);

        // 충돌 설정
        this.scene.physics.add.overlap(projectile, target, (p, t) => {
            // 투사체 제거
            p.destroy();

            // 충돌 효과
            this.createProjectileImpactEffect(p.x, p.y);
        });

        // 제한 시간 후 제거
        this.scene.time.delayedCall(2000, () => {
            if (projectile && projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * 투사체 충돌 효과
     */
    createProjectileImpactEffect(x, y) {
        if (!this.scene.add) return;

        // 충돌 효과 스프라이트
        const impact = this.scene.add.sprite(x, y, 'impact_effect');
        impact.setScale(0.8);

        // 애니메이션 재생
        impact.play('impact_anim');

        // 애니메이션 완료 후 제거
        impact.once('animationcomplete', () => {
            impact.destroy();
        });
    }

    /**
     * 원소별 투사체 프레임 선택
     */
    getProjectileFrame() {
        const elementFrames = {
            'neutral': 0,
            'fire': 1,
            'ice': 2,
            'earth': 3,
            'wind': 4,
            'dark': 5,
            'light': 6,
            'poison': 7
        };

        return elementFrames[this.monsterData.element] || 0;
    }

    /**
     * 마법 공격 효과
     */
    showMagicAttackEffect(target) {
        if (!this.scene.add || !this.scene.tweens) return;

        // 시전 효과
        const castEffect = this.scene.add.sprite(this.x, this.y - 30, 'cast_effect');
        castEffect.play('cast_anim');

        // 시전 효과 제거
        this.scene.time.delayedCall(500, () => {
            castEffect.destroy();

            // 대상 효과
            const targetEffect = this.scene.add.sprite(target.x, target.y, 'magic_impact');
            targetEffect.play('magic_impact_anim');

            // 원 효과
            const circle = this.scene.add.ellipse(target.x, target.y, 60, 20, this.getElementColor());
            circle.setAlpha(0.5);

            // 효과 애니메이션
            this.scene.tweens.add({
                targets: [circle],
                scaleX: 0.1,
                scaleY: 0.1,
                alpha: 0,
                duration: 800,
                onComplete: () => {
                    circle.destroy();
                }
            });

            // 임팩트 효과 제거
            this.scene.time.delayedCall(1000, () => {
                targetEffect.destroy();
            });
        });
    }

    /**
     * 기본 공격 효과
     */
    showDefaultAttackEffect(target) {
        if (!this.scene.add) return;

        // 단순 임팩트 효과
        const impact = this.scene.add.sprite(target.x, target.y, 'impact');
        impact.play('impact_anim');

        // 애니메이션 완료 후 제거
        impact.once('animationcomplete', () => {
            impact.destroy();
        });
    }

    /**
     * 원소별 색상 반환
     */
    getElementColor() {
        const elementColors = {
            'neutral': 0xcccccc,
            'fire': 0xff3300,
            'ice': 0x33ccff,
            'earth': 0x669933,
            'wind': 0xccffcc,
            'dark': 0x660066,
            'light': 0xffffcc,
            'poison': 0x99cc00
        };

        return elementColors[this.monsterData.element] || 0xcccccc;
    }

    /**
     * 특수 능력 사용
     */
    useAbility(abilityId) {
        if (this.isDead || this.combatState.stunned) return false;

        // 능력 찾기
        const abilities = this.monsterData.abilities;
        if (!abilities) return false;

        const ability = abilities.find(a => a.id === abilityId);
        if (!ability) return false;

        // 쿨다운 체크
        if (
            this.combatState.abilityCooldowns[abilityId] > 0 &&
            !this.monsterData.phases
        ) {
            return false;
        }

        // 대상 선택
        let target = this.scene.player;

        // 능력 사용 애니메이션
        const key = this.monsterData.sprite.key;
        this.play(`${key}_attack`);

        // 능력 타입에 따른 처리
        switch (ability.type) {
            case 'melee_attack':
                this.useAbilityMeleeAttack(ability, target);
                break;
            case 'ranged_attack':
                this.useAbilityRangedAttack(ability, target);
                break;
            case 'aoe':
                this.useAbilityAOE(ability);
                break;
            case 'summon':
                this.useAbilitySummon(ability);
                break;
            case 'buff':
                this.useAbilityBuff(ability);
                break;
            case 'debuff':
                this.useAbilityDebuff(ability, target);
                break;
            default:
                // 미구현 능력
                console.warn(`Unimplemented ability type: ${ability.type}`);
                return false;
        }

        // 쿨다운 설정
        this.combatState.abilityCooldowns[abilityId] = ability.cooldown || 5000;

        // 사용한 능력 기록
        this.combatState.lastAbilityUsed = abilityId;

        // 능력 사용 이벤트 발생
        this.scene.events.emit('enemyAbilityUsed', {
            enemy: this,
            ability: ability
        });

        return true;
    }

    /**
     * 근접 특수 공격
     */
    useAbilityMeleeAttack(ability, target) {
        if (!target || target.isDead) return;

        // 대미지 계산
        const damage = Math.floor(this.stats.attack * (ability.damageMultiplier || 1.5));

        // 공격 효과 애니메이션
        this.showAbilityEffect(ability, target);

        // 지연된 대미지 적용
        this.scene.time.delayedCall(500, () => {
            if (target.active && target.takeDamage) {
                target.takeDamage({
                    damage: damage,
                    type: 'ability',
                    element: ability.element || this.monsterData.element,
                    effectType: ability.effectType || null,
                    effectChance: ability.chance || 0.5,
                    effectValue: ability.value || null,
                    effectDuration: ability.duration || 3000,
                    knockback: ability.knockback || false,
                    source: this
                });
            }
        });
    }

    /**
     * 원거리 특수 공격
     */
    useAbilityRangedAttack(ability, target) {
        if (!target || target.isDead) return;

        // 발사체 수 (기본 1)
        const shotCount = ability.shotCount || 1;

        // 각 발사체 생성
        for (let i = 0; i < shotCount; i++) {
            // 약간의 분산
            const spread = (i - (shotCount - 1) / 2) * 10;

            // 발사체 생성 (약간의 지연)
            this.scene.time.delayedCall(i * 150, () => {
                this.createAbilityProjectile(ability, target, spread);
            });
        }
    }

    /**
     * 능력 투사체 생성
     */
    createAbilityProjectile(ability, target, angleOffset = 0) {
        if (!this.scene.physics) return;

        // 투사체 생성
        const projectile = this.scene.physics.add.sprite(
            this.x,
            this.y - 10,
            'ability_projectile',
            this.getAbilityProjectileFrame(ability)
        );

        // 투사체 속성
        projectile.setScale(0.8);
        projectile.abilityData = ability;

        // 발사 방향 계산
        let angle = Phaser.Math.Angle.Between(
            projectile.x, projectile.y,
            target.x, target.y
        );

        // 각도 오프셋 적용
        angle += Phaser.Math.DegToRad(angleOffset);

        // 투사체 회전
        projectile.setRotation(angle + Math.PI / 2);

        // 발사 속도
        const speed = ability.speed || 250;
        projectile.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );

        // 대상과 충돌 감지
        this.scene.physics.add.overlap(projectile, target, (p, t) => {
            this.onProjectileHit(p, t);
        });

        // 일정 시간 후 자동 제거
        this.scene.time.delayedCall(3000, () => {
            if (projectile && projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * 투사체 충돌 시 처리
     */
    onProjectileHit(projectile, target) {
        // 투사체 제거
        projectile.destroy();

        // 충돌 효과
        this.createAbilityImpactEffect(projectile, target);

        // 대미지 계산
        const ability = projectile.abilityData;
        const damage = Math.floor(this.stats.attack * (ability.damageMultiplier || 1));

        // 대미지 적용
        if (target.takeDamage) {
            target.takeDamage({
                damage: damage,
                type: 'ability',
                element: ability.element || this.monsterData.element,
                effectType: ability.effectType || null,
                effectChance: ability.chance || 0.3,
                effectValue: ability.value || null,
                effectDuration: ability.duration || 3000,
                source: this
            });
        }
    }

    /**
     * 능력 충돌 효과
     */
    createAbilityImpactEffect(projectile, target) {
        if (!this.scene.add) return;

        // 충돌 효과
        const impact = this.scene.add.sprite(
            target.x,
            target.y,
            'ability_impact',
            this.getAbilityImpactFrame(projectile.abilityData)
        );

        // 애니메이션 재생
        impact.play('ability_impact_anim');

        // 애니메이션 완료 후 제거
        impact.once('animationcomplete', () => {
            impact.destroy();
        });
    }

    /**
     * 광역 공격 능력
     */
    useAbilityAOE(ability) {
        // 영향 범위
        const radius = ability.radius || 150;

        // 시각 효과
        this.createAOEEffect(ability);

        // 범위 내 플레이어 찾기
        const player = this.scene.player;
        if (!player || player.isDead) return;

        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            player.x, player.y
        );

        // 범위 내에 있으면 대미지 적용
        if (distance <= radius) {
            const damage = Math.floor(this.stats.attack * (ability.damageMultiplier || 1));

            this.scene.time.delayedCall(500, () => {
                if (player.active && player.takeDamage) {
                    player.takeDamage({
                        damage: damage,
                        type: 'ability',
                        element: ability.element || this.monsterData.element,
                        effectType: ability.effectType || null,
                        effectChance: ability.chance || 0.4,
                        effectValue: ability.value || null,
                        effectDuration: ability.duration || 3000,
                        source: this
                    });
                }
            });
        }
    }

    /**
     * 광역 공격 시각 효과
     */
    createAOEEffect(ability) {
        if (!this.scene.add || !this.scene.tweens) return;

        // 효과 범위
        const radius = ability.radius || 150;

        // 원형 효과
        const circle = this.scene.add.ellipse(
            this.x,
            this.y,
            radius * 2,
            radius * 0.7, // 약간 납작하게
            this.getElementColor(ability.element)
        );
        circle.setAlpha(0.2);

        // 확장 애니메이션
        this.scene.tweens.add({
            targets: circle,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                circle.destroy();
            }
        });

        // 중심 효과
        const center = this.scene.add.sprite(this.x, this.y, 'aoe_center');
        center.play('aoe_center_anim');

        // 애니메이션 완료 후 제거
        center.once('animationcomplete', () => {
            center.destroy();
        });
    }

    /**
     * 소환 능력
     */
    useAbilitySummon(ability) {
        // 소환할 몬스터 타입
        const summonType = ability.summonType;
        if (!summonType) return;

        // 소환 수
        const count = ability.count || 1;

        // 소환 위치 오프셋 (현재 위치 주변)
        const offsetRange = 80;

        // 소환 효과
        this.createSummonEffect();

        // 소환 처리 (각 소환마다 약간의 지연)
        for (let i = 0; i < count; i++) {
            this.scene.time.delayedCall(i * 300, () => {
                // 소환 위치 계산
                const offsetX = Phaser.Math.Between(-offsetRange, offsetRange);
                const offsetY = Phaser.Math.Between(-offsetRange, offsetRange);

                // 소환 이벤트 발생
                this.scene.events.emit('enemySummon', {
                    x: this.x + offsetX,
                    y: this.y + offsetY,
                    monsterId: summonType,
                    level: this.dungeonLevel,
                    parent: this.monsterId
                });
            });
        }
    }

    /**
     * 소환 시각 효과
     */
    createSummonEffect() {
        if (!this.scene.add) return;

        // 소환 마법진 효과
        const circle = this.scene.add.sprite(this.x, this.y, 'summon_circle');
        circle.setScale(1.5);
        circle.setAlpha(0.7);

        // 회전 애니메이션
        this.scene.tweens.add({
            targets: circle,
            angle: 360,
            duration: 2000,
            onComplete: () => {
                circle.destroy();
            }
        });

        // 중심 빛 효과
        const light = this.scene.add.sprite(this.x, this.y, 'summon_light');
        light.setScale(0);

        // 빛 확장 후 축소
        this.scene.tweens.add({
            targets: light,
            scale: 1.5,
            duration: 1000,
            yoyo: true,
            onComplete: () => {
                light.destroy();
            }
        });
    }

    /**
     * 버프 능력
     */
    useAbilityBuff(ability) {
        // 버프 지속시간
        const duration = ability.duration || 5000;

        // 버프 효과
        const buff = {
            type: ability.effectType || 'stat_boost',
            value: ability.value || 0.2,
            duration: duration
        };

        // 자신에게 버프 적용
        this.addStatusEffect(buff);

        // 버프 시각 효과
        this.createBuffEffect(buff);

        // 보스인 경우 메시지 표시
        if (this.monsterData.type === 'boss') {
            this.scene.events.emit('bossAbility', {
                boss: this,
                message: `${this.monsterData.name}(이)가 ${ability.name}을(를) 사용했다!`
            });
        }
    }

    /**
     * 버프 시각 효과
     */
    createBuffEffect(buff) {
        if (!this.scene.add || !this.scene.tweens) return;

        // 버프 타입에 따른 색상
        let color;
        switch (buff.type) {
            case 'attack_boost':
                color = 0xff0000;
                break;
            case 'defense_boost':
                color = 0x0000ff;
                break;
            case 'speed_boost':
                color = 0x00ff00;
                break;
            default:
                color = 0xffff00;
        }

        // 상승 파티클 효과
        if (this.scene.particleManager) {
            this.scene.particleManager.createEmitter({
                x: this.x,
                y: this.y,
                speed: { min: 20, max: 50 },
                angle: { min: 250, max: 290 },
                scale: { start: 0.6, end: 0 },
                blendMode: 'ADD',
                lifespan: 800,
                quantity: 20,
                tint: color
            });
        }

        // 오라 효과
        const aura = this.scene.add.ellipse(
            this.x,
            this.y,
            this.width * 1.5,
            this.height * 0.7,
            color
        );
        aura.setAlpha(0.3);

        // 오라 펄싱 효과
        this.scene.tweens.add({
            targets: aura,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.1,
            duration: 1000,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                aura.destroy();
            }
        });
    }

    /**
     * 디버프 능력
     */
    useAbilityDebuff(ability, target) {
        if (!target || target.isDead) return;

        // 디버프 지속시간
        const duration = ability.duration || 4000;

        // 디버프 효과
        const debuff = {
            type: ability.effectType || 'slow',
            value: ability.value || 0.3,
            duration: duration
        };

        // 디버프 시각 효과
        this.createDebuffProjectile(ability, target, debuff);

        // 보스인 경우 메시지 표시
        if (this.monsterData.type === 'boss') {
            this.scene.events.emit('bossAbility', {
                boss: this,
                message: `${this.monsterData.name}(이)가 ${ability.name}을(를) 사용했다!`
            });
        }
    }

    /**
     * 디버프 투사체 생성
     */
    createDebuffProjectile(ability, target, debuff) {
        if (!this.scene.physics) return;

        // 투사체 생성
        const projectile = this.scene.physics.add.sprite(
            this.x,
            this.y - 10,
            'debuff_projectile',
            this.getDebuffProjectileFrame(debuff.type)
        );

        // 투사체 속성
        projectile.setScale(0.8);
        projectile.debuffData = debuff;

        // 발사 방향 계산
        const angle = Phaser.Math.Angle.Between(
            projectile.x, projectile.y,
            target.x, target.y
        );

        // 투사체 회전
        projectile.setRotation(angle + Math.PI / 2);

        // 발사 속도
        const speed = ability.speed || 220;
        projectile.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );

        // 대상과 충돌 감지
        this.scene.physics.add.overlap(projectile, target, (p, t) => {
            // 투사체 제거
            p.destroy();

            // 디버프 효과 적용
            if (t.addStatusEffect) {
                t.addStatusEffect(p.debuffData);
            }

            // 충돌 효과
            this.createDebuffImpactEffect(p, t, debuff.type);
        });

        // 일정 시간 후 자동 제거
        this.scene.time.delayedCall(3000, () => {
            if (projectile && projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * 디버프 타입에 따른 투사체 프레임
     */
    getDebuffProjectileFrame(debuffType) {
        const frames = {
            'slow': 0,
            'weakness': 1,
            'poison': 2,
            'burn': 3,
            'freeze': 4,
            'stun': 5
        };

        return frames[debuffType] || 0;
    }

    /**
     * 디버프 충돌 효과
     */
    createDebuffImpactEffect(projectile, target, debuffType) {
        if (!this.scene.add) return;

        // 디버프 타입별 색상
        const colors = {
            'slow': 0x33ccff,
            'weakness': 0x996633,
            'poison': 0x66cc00,
            'burn': 0xff3300,
            'freeze': 0x00ccff,
            'stun': 0xffcc00
        };

        const color = colors[debuffType] || 0xcccccc;

        // 충돌 효과
        const impact = this.scene.add.sprite(target.x, target.y, 'debuff_impact');
        impact.play('debuff_impact_anim');
        impact.setTint(color);

        // 애니메이션 완료 후 제거
        impact.once('animationcomplete', () => {
            impact.destroy();
        });

        // 주변 원형 효과
        const circle = this.scene.add.ellipse(
            target.x,
            target.y,
            60,
            20,
            color
        );
        circle.setAlpha(0.4);

        // 원형 효과 페이드 아웃
        this.scene.tweens.add({
            targets: circle,
            scaleX: 0.5,
            scaleY: 0.5,
            alpha: 0,
            duration: 800,
            onComplete: () => {
                circle.destroy();
            }
        });
    }

    /**
     * 능력 투사체 프레임 선택
     */
    getAbilityProjectileFrame(ability) {
        // 원소별 프레임
        const elementFrames = {
            'neutral': 0,
            'fire': 1,
            'ice': 2,
            'earth': 3,
            'wind': 4,
            'dark': 5,
            'light': 6,
            'poison': 7
        };

        return elementFrames[ability.element || this.monsterData.element] || 0;
    }

    /**
     * 능력 충돌 효과 프레임 선택
     */
    getAbilityImpactFrame(ability) {
        // 원소별 프레임
        const elementFrames = {
            'neutral': 0,
            'fire': 1,
            'ice': 2,
            'earth': 3,
            'wind': 4,
            'dark': 5,
            'light': 6,
            'poison': 7
        };

        return elementFrames[ability.element || this.monsterData.element] || 0;
    }

    /**
     * 능력 시각 효과 표시
     */
    showAbilityEffect(ability, target) {
        // 능력 타입 따른 효과
        switch (ability.type) {
            case 'melee_attack':
                // 근접 공격 효과
                this.showMeleeSpecialEffect(ability, target);
                break;
            default:
                // 기본 효과
                this.showDefaultAbilityEffect(ability, target);
        }
    }

    /**
     * 근접 특수 공격 효과
     */
    showMeleeSpecialEffect(ability, target) {
        if (!this.scene.add || !this.scene.tweens) return;

        // 공격 궤적 스프라이트 (기본 공격보다 큰 효과)
        const swipe = this.scene.add.sprite(
            (this.x + target.x) / 2,
            (this.y + target.y) / 2,
            'special_swing'
        );
        swipe.setScale(1.2);

        // 효과 색상 설정
        const elementColor = this.getElementColor(ability.element);
        swipe.setTint(elementColor);

        // 공격 방향에 따라 회전
        const angle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
        swipe.setRotation(angle);

        // 애니메이션
        swipe.play('special_swing_anim');

        // 효과 제거
        this.scene.time.delayedCall(500, () => {
            swipe.destroy();
        });
    }

    /**
     * 기본 능력 효과
     */
    showDefaultAbilityEffect(ability, target) {
        if (!this.scene.add) return;

        // 단순 플래시 효과
        const flash = this.scene.add.sprite(target.x, target.y, 'ability_flash');
        flash.play('ability_flash_anim');

        // 애니메이션 완료 후 제거
        flash.once('animationcomplete', () => {
            flash.destroy();
        });
    }

    /**
     * 게임 루프 업데이트
     */
    update(time, delta) {
        if (this.isDead) return;

        // 델타 타임 (밀리초)
        const dt = delta / 1000;

        // 체력바 및 시각 효과 업데이트
        this.updateVisuals();

        // 상태 효과 업데이트
        this.updateStatusEffects(delta);

        // 쿨다운 업데이트
        this.updateCooldowns(delta);

        // 기절 상태이면 행동 불가
        if (this.combatState.stunned) return;

        // AI 행동 업데이트
        this.updateAI(dt);
    }

    /**
     * 쿨다운 업데이트
     */
    updateCooldowns(delta) {
        // 공격 쿨다운 감소
        if (this.combatState.attackCooldown > 0) {
            this.combatState.attackCooldown = Math.max(0, this.combatState.attackCooldown - delta);
        }

        // 능력 쿨다운 감소
        for (const abilityId in this.combatState.abilityCooldowns) {
            if (this.combatState.abilityCooldowns[abilityId] > 0) {
                this.combatState.abilityCooldowns[abilityId] -= delta;
            }
        }
    }

    /**
     * AI 행동 업데이트
     */
    updateAI(dt) {
        // 플레이어 존재 확인
        const player = this.scene.player;
        if (!player || player.isDead) {
            // 플레이어가 없거나 죽었으면 어그로 제거
            this.combatState.isAggro = false;
            this.wander(dt);
            return;
        }

        // 플레이어와의 거리 계산
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            player.x, player.y
        );

        // 어그로 범위 체크
        if (!this.combatState.isAggro && distance <= this.aggroRange) {
            this.combatState.isAggro = true;

            // 어그로 효과음
            this.playAggroSound();

            // 감지 이벤트 발생
            this.scene.events.emit('enemyAggro', {
                enemy: this,
                target: player
            });
        }

        // 어그로 상태일 때 행동
        if (this.combatState.isAggro) {
            // 공격 범위 내일 때
            if (distance <= this.attackRange) {
                // 공격 시도
                this.attack(player);

                // 능력 사용 시도
                this.tryUseAbility(player);
            }
            // 공격 범위 밖이면 플레이어 추적
            else {
                this.moveTowardsPlayer(dt, player);
            }
        }
        // 비 어그로 상태일 때 행동
        else {
            this.wander(dt);
        }
    }

    /**
     * 어그로 효과음 재생
     */
    playAggroSound() {
        if (!this.scene.sound || !this.scene.sound.get) return;

        // 몬스터 타입별 다른 효과음
        let soundKey;
        if (this.monsterData.type === 'boss') {
            soundKey = 'boss_aggro';
        } else {
            soundKey = 'enemy_aggro';
        }

        const sound = this.scene.sound.get(soundKey);
        if (sound) {
            sound.play({ volume: 0.6 });
        }
    }

    /**
     * 능력 사용 시도
     */
    tryUseAbility(target) {
        // 능력이 없으면 무시
        if (
            !this.monsterData.abilities ||
            this.monsterData.abilities.length === 0
        ) {
            return false;
        }

        // 적절한 능력 선택
        const ability = this.chooseAbility();
        if (!ability) return false;

        // 능력 사용
        return this.useAbility(ability.id);
    }

    /**
     * 상황에 맞는 능력 선택
     */
    chooseAbility() {
        const abilities = this.monsterData.abilities;
        const availableAbilities = [];

        // 사용 가능한 능력 필터링
        for (const ability of abilities) {
            // 쿨다운 체크
            if (this.combatState.abilityCooldowns[ability.id] <= 0) {
                availableAbilities.push(ability);
            }
        }

        // 사용 가능한 능력이 없으면 null 반환
        if (availableAbilities.length === 0) return null;

        // 보스인 경우 전략적 선택
        if (this.monsterData.type === 'boss') {
            return this.chooseBossAbility(availableAbilities);
        }

        // 일반 몬스터는 랜덤 선택
        return availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
    }

    /**
     * 보스 능력 전략적 선택
     */
    chooseBossAbility(availableAbilities) {
        const player = this.scene.player;
        if (!player) return null;

        // 체력 비율
        const hpRatio = this.stats.hp / this.stats.maxHp;

        // 체력이 낮을 때 (25% 이하) 생존 우선 능력
        if (hpRatio <= 0.25) {
            // 치유/방어 버프 우선
            const survivalAbility = availableAbilities.find(a =>
                a.type === 'buff' ||
                a.type === 'summon' ||
                a.effectType === 'heal'
            );

            if (survivalAbility) return survivalAbility;
        }

        // 중간 체력 (25%~75%) - 공격 우선
        if (hpRatio > 0.25 && hpRatio <= 0.75) {
            // 높은 대미지 공격 우선
            const offensiveAbility = availableAbilities.find(a =>
                (a.type === 'ranged_attack' || a.type === 'aoe') &&
                a.damageMultiplier >= 1.5
            );

            if (offensiveAbility) return offensiveAbility;
        }

        // 체력 높을 때 (75% 이상) - 디버프 우선
        if (hpRatio > 0.75) {
            const debuffAbility = availableAbilities.find(a =>
                a.type === 'debuff' ||
                a.effectType === 'slow' ||
                a.effectType === 'weakness'
            );

            if (debuffAbility) return debuffAbility;
        }

        // 어느 것도 해당하지 않으면 랜덤 선택
        return availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
    }

    /**
     * 플레이어를 향해 이동
     */
    moveTowardsPlayer(dt, player) {
        // 이동 방향 계산
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            player.x, player.y
        );

        // 이동 벡터 설정
        const speedFactor = 1.0; // 기본 속도 계수

        // 상태 효과에 따른 속도 조정
        const slowEffects = this.statusEffects.filter(
            e => e.type === 'slow' || e.type === 'frozen'
        );

        // 감속 효과 적용
        let totalSlowFactor = 1.0;
        if (slowEffects.length > 0) {
            for (const effect of slowEffects) {
                totalSlowFactor *= (1 - (effect.value || 0.3));
            }
        }

        // 최종 속도 계산
        const finalSpeed = this.moveSpeed * speedFactor * totalSlowFactor;

        // 이동 속도 벡터 설정
        this.body.setVelocity(
            Math.cos(angle) * finalSpeed,
            Math.sin(angle) * finalSpeed
        );

        // 이동 애니메이션 재생
        const key = this.monsterData.sprite.key;
        if (this.anims.currentAnim && this.anims.currentAnim.key !== `${key}_move`) {
            this.play(`${key}_move`);
        }

        // 이동 방향에 따라 스프라이트 뒤집기
        if (player.x < this.x) {
            this.flipX = true;
        } else {
            this.flipX = false;
        }
    }

    /**
     * 무작위 배회
     */
    wander(dt) {
        // 유효한 대기 시간이면 이동하지 않음
        if (this.wanderDelay > 0) {
            this.wanderDelay -= dt * 1000;

            // 대기 중일 때는 휴식 애니메이션
            const key = this.monsterData.sprite.key;
            if (this.anims.currentAnim && this.anims.currentAnim.key !== `${key}_idle`) {
                this.play(`${key}_idle`);
            }

            // 속도 초기화
            this.body.setVelocity(0, 0);
            return;
        }

        // 현재 위치가 목표지점에 거의 도달했으면 새 목표 설정
        if (!this.patrolPoint || Phaser.Math.Distance.Between(
            this.x, this.y,
            this.patrolPoint.x, this.patrolPoint.y
        ) < 10) {
            this.setNewPatrolPoint();

            // 이동 후 대기 시간 설정 (2~5초)
            this.wanderDelay = Phaser.Math.Between(2000, 5000);
            return;
        }

        // 목표 지점 방향으로 이동
        const angle = Phaser.Math.Angle.Between(
            this.x, this.y,
            this.patrolPoint.x, this.patrolPoint.y
        );

        // 느린 배회 속도 (일반 이동의 50%)
        const wanderSpeed = this.moveSpeed * 0.5;

        // 이동 속도 벡터 설정
        this.body.setVelocity(
            Math.cos(angle) * wanderSpeed,
            Math.sin(angle) * wanderSpeed
        );

        // 이동 애니메이션 재생
        const key = this.monsterData.sprite.key;
        if (this.anims.currentAnim && this.anims.currentAnim.key !== `${key}_move`) {
            this.play(`${key}_move`);
        }

        // 이동 방향에 따라 스프라이트 뒤집기
        if (this.patrolPoint.x < this.x) {
            this.flipX = true;
        } else {
            this.flipX = false;
        }
    }

    /**
     * 새로운 순찰 지점 설정
     */
    setNewPatrolPoint() {
        // 스폰 지점 기반 배회 범위
        const wanderRadius = 150;

        // 초기 스폰 위치가 없으면 현재 위치로 설정
        if (!this.initialPosition) {
            this.initialPosition = {
                x: this.x,
                y: this.y
            };
        }

        // 배회 영역 제한 (초기 위치 기준)
        const minX = this.initialPosition.x - wanderRadius;
        const maxX = this.initialPosition.x + wanderRadius;
        const minY = this.initialPosition.y - wanderRadius;
        const maxY = this.initialPosition.y + wanderRadius;

        // 랜덤 지점 생성
        const randomX = Phaser.Math.Between(minX, maxX);
        const randomY = Phaser.Math.Between(minY, maxY);

        // 패트롤 지점 설정
        this.patrolPoint = { x: randomX, y: randomY };
    }

    /**
     * 사망 여부 확인
     */
    get isDead() {
        return this._isDead || this.stats.hp <= 0;
    }

    /**
     * 사망 상태 설정
     */
    set isDead(value) {
        this._isDead = value;
    }

    /**
     * 객체 정보 문자열 반환 (디버깅용)
     */
    toString() {
        return `Enemy[${this.monsterId}] - HP: ${this.stats.hp}/${this.stats.maxHp}, Level: ${this.dungeonLevel}, Elite: ${this.isElite}`;
    }
}

export default Enemy;