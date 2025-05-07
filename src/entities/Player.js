/**
 * Player.js
 * 
 * 던전 루프의 플레이어 캐릭터를 관리하는 클래스입니다.
 * 게임 내 클래스 시스템, 스탯, 장비, 스킬 등을 처리합니다.
 */
class Player extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, config = {}) {
        // 기본 스프라이트 생성
        super(scene, x, y, 'character', 0);
        
        // 씬에 추가
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // 기본 속성 설정
        this.scene = scene;
        this.classId = config.classId || 'warrior';
        this.direction = 'down';
        this.isMoving = false;
        this.isAttacking = false;
        this.isDead = false;
        this.actionCooldown = 0;
        
        // 물리 속성 설정
        this.body.setCollideWorldBounds(true);
        this.body.setSize(28, 20);
        this.body.setOffset(2, 44);
        
        // 스프라이트 설정
        this.setOrigin(0.5, 1);
        this.setScale(1.2);
        this.setDepth(10); // 플레이어는 항상 전경에 표시
        
        // 플레이어 데이터 로드
        this.loadPlayerData();
        
        // 애니메이션 생성
        this.createAnimations();
        
        // 상태 효과 배열
        this.statusEffects = [];
        this.statusIcons = [];
        
        // 스킬 쿨다운
        this.skillCooldowns = {};
        
        // 피격 무적 시간
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        
        // 마지막 위치 저장 (충돌 처리용)
        this.lastX = x;
        this.lastY = y;
        
        // 이벤트 발생기
        this.events = new Phaser.Events.EventEmitter();
    }

    /**
     * 플레이어 데이터 로드
     */
    loadPlayerData() {
        // 게임 데이터 매니저에서 플레이어 데이터 가져오기
        const dataManager = this.scene.game.config.dataManager;
        const playerData = dataManager.getPlayerData();
        
        // 현재 선택된 클래스 정보 가져오기
        this.classData = dataManager.getClassData(this.classId);
        
        // 데이터 적용
        this.level = playerData.level || 1;
        this.experience = playerData.experience || 0;
        this.equipment = playerData.equipment || {
            weapon: null,
            armor: null,
            accessory1: null,
            accessory2: null,
            special: null,
            legacy: null
        };
        
        // 기본 스탯 계산
        this.initializeStats();
        
        // 장비 효과 적용
        this.applyEquipmentEffects();
        
        // 클래스 패시브 적용
        this.applyClassPassives();
        
        // 플레이어 이름
        this.name = playerData.name || '모험가';
    }

    /**
     * 기본 스탯 초기화
     */
    initializeStats() {
        if (!this.classData) {
            console.error('클래스 데이터가 없습니다!');
            return;
        }
        
        // 클래스 기본 스탯 적용
        const baseStats = this.classData.baseStats;
        const growthStats = this.classData.growthStats;
        
        // 레벨에 따른 스탯 성장
        const levelBonus = this.level - 1;
        
        // 최종 스탯 계산
        this.stats = {
            maxHp: Math.floor(baseStats.hp + (growthStats.hp * levelBonus)),
            hp: Math.floor(baseStats.hp + (growthStats.hp * levelBonus)),
            maxMp: Math.floor(baseStats.mp + (growthStats.mp * levelBonus)),
            mp: Math.floor(baseStats.mp + (growthStats.mp * levelBonus)),
            attack: Math.floor(baseStats.attack + (growthStats.attack * levelBonus)),
            defense: Math.floor(baseStats.defense + (growthStats.defense * levelBonus)),
            speed: Math.floor(baseStats.speed + (growthStats.speed * levelBonus)),
            critRate: 0.05,  // 기본 치명타 확률 5%
            critDamage: 1.5  // 기본 치명타 대미지 50% 증가
        };
    }

    /**
     * 클래스 패시브 효과 적용
     */
    applyClassPassives() {
        if (!this.classData || !this.classData.passiveEffect) return;
        
        const passive = this.classData.passiveEffect;
        
        // 패시브 효과 유형에 따라 적용
        switch (passive.type) {
            // 스탯 증가 (stat_increase)
            case 'stat_increase':
                if (passive.stat === 'hp') {
                    // HP 증가 (전사)
                    this.stats.maxHp = Math.floor(this.stats.maxHp * (1 + passive.value / 100));
                    this.stats.hp = this.stats.maxHp;
                } else if (passive.stat === 'mp') {
                    // MP 증가 (마법사)
                    this.stats.maxMp = Math.floor(this.stats.maxMp * (1 + passive.value / 100));
                    this.stats.mp = this.stats.maxMp;
                } else if (passive.stat === 'speed') {
                    // 이동 속도 증가 (궁수)
                    this.stats.speed = Math.floor(this.stats.speed * (1 + passive.value / 100));
                }
                break;
                
            // 특수 효과 (special_effect)
            case 'special_effect':
                if (passive.effect === 'dodge_chance') {
                    // 회피 확률 (도적)
                    this.dodgeChance = passive.value / 100;
                } else if (passive.effect === 'attack_range') {
                    // 공격 범위 증가 (창병)
                    this.attackRangeBonus = passive.value / 100;
                } else if (passive.effect === 'attack_speed') {
                    // 공격 속도 증가 (무도가)
                    this.attackSpeedBonus = passive.value / 100;
                } else if (passive.effect === 'healing_bonus') {
                    // 치유 효과 증가 (성직자)
                    this.healingBonus = passive.value / 100;
                } else if (passive.effect === 'enemy_detection') {
                    // 적 탐지 (사냥꾼)
                    this.enemyDetection = true;
                    this.enemyDetectionRadius = passive.value || 100;
                }
                break;
                
            // 대미지 감소 (damage_reduction)
            case 'damage_reduction':
                // 피해 감소 (기사)
                this.damageReduction = passive.value / 100;
                break;
                
            // 포션 효과 (potion_effect)
            case 'potion_effect':
                // 포션 효과 증가 (연금술사)
                this.potionEffectBonus = passive.value / 100;
                break;
                
            // 이중 저항 (dual_resistance)
            case 'dual_resistance':
                // 물리/마법 저항 (마검사)
                if (!this.elementResistance) this.elementResistance = {};
                this.physicalResistance = passive.value / 100;
                this.magicalResistance = passive.value / 100;
                break;
                
            // 적 탐지 (enemy_detection)
            case 'enemy_detection':
                // 적 탐지 (레인저)
                this.enemyDetection = true;
                this.enemyDetectionRadius = passive.radius || 50;
                break;
                
            // 치명타 피해 (critical_damage)
            case 'critical_damage':
                // 치명타 피해 증가 (암살자)
                this.stats.critDamage += passive.value / 100;
                break;
                
            // HP를 공격력으로 (hp_to_damage)
            case 'hp_to_damage':
                // HP의 일부를 공격력으로 변환 (배틀메이지)
                const hpBonus = Math.floor(this.stats.maxHp * (passive.ratio / 100));
                this.stats.attack += hpBonus;
                break;
                
            // 성스러운 보호 (holy_protection)
            case 'holy_protection':
                // 언데드 피해 감소 (십자군)
                this.undeadDamageReduction = passive.dmgReduction / 100;
                this.allyHealingAura = passive.allyHeal / 100;
                break;
                
            // 생명력 흡수 (life_steal)
            case 'life_steal':
                // 공격 시 생명력 흡수 (죽음의 기사)
                this.lifeStealPercent = passive.value / 100;
                break;
                
            // 신성한 심판 (divine_favor)
            case 'divine_favor':
                // 회복 효과 및 언데드 피해 감소 (팔라딘)
                this.healingBonus = passive.value / 100;
                this.undeadDamageReduction = 0.2; // 20%
                break;
                
            // 불사 (immortality)
            case 'immortality':
                // 던전당 1회 사망 방지 (영원의 챔피언)
                this.immortalityUsed = false;
                break;
                
            // 기타 패시브 효과...
            default:
                console.log(`적용되지 않은 패시브 효과: ${passive.type}`);
                break;
        }
    }

    /**
     * 장비 효과 적용
     */
    applyEquipmentEffects() {
        // 데이터 매니저에서 장비 정보 가져오기
        const dataManager = this.scene.game.config.dataManager;
        
        // 장착 중인 모든 장비 순회
        for (const slotKey in this.equipment) {
            const itemId = this.equipment[slotKey];
            if (!itemId) continue;
            
            // 아이템 정보 가져오기
            const item = dataManager.getItemData(itemId);
            if (!item) continue;
            
            // 기본 스탯 보너스 적용
            if (item.stats) {
                for (const [stat, value] of Object.entries(item.stats)) {
                    if (stat in this.stats) {
                        this.stats[stat] += value;
                    }
                }
            }
            
            // 아이템 특수 효과 적용
            if (item.effects) {
                for (const effect of item.effects) {
                    this.applyItemEffect(effect);
                }
            }
            
            // 단일 효과 적용
            if (item.effect) {
                this.applyItemEffect(item.effect);
            }
        }
        
        // 최소값 보정
        this.stats.attack = Math.max(1, this.stats.attack);
        this.stats.defense = Math.max(0, this.stats.defense);
        this.stats.speed = Math.max(1, this.stats.speed);
    }
    
    /**
     * 아이템 효과 적용
     * @param {Object} effect - 효과 데이터
     */
    applyItemEffect(effect) {
        if (!effect || !effect.type) return;
        
        switch (effect.type) {
            case 'stat_boost':
                // 스탯 증가
                if (effect.stat && effect.value && this.stats[effect.stat] !== undefined) {
                    if (effect.isPercentage) {
                        this.stats[effect.stat] *= effect.value;
                    } else {
                        this.stats[effect.stat] += effect.value;
                    }
                }
                break;
                
            case 'crit_boost':
                // 치명타 증가
                if (effect.value) {
                    this.stats.critRate += effect.value;
                }
                break;
                
            case 'life_steal':
                // 생명력 흡수
                this.lifeStealPercent = (this.lifeStealPercent || 0) + effect.value;
                break;
                
            case 'movement_speed':
                // 이동 속도
                this.stats.speed *= effect.value;
                break;
                
            case 'element_resistance':
                // 속성 저항
                if (!this.elementResistance) this.elementResistance = {};
                if (effect.element) {
                    this.elementResistance[effect.element] = (this.elementResistance[effect.element] || 0) + effect.value;
                }
                break;
        }
    }

    /**
     * 애니메이션 생성
     */
    createAnimations() {
        // 클래스별 스프라이트 인덱스
        const classToFrame = {
            'warrior': 0,
            'archer': 1,
            'mage': 2,
            'thief': 3,
            'spearman': 4,
            'monk': 5,
            'cleric': 6,
            'hunter': 7,
            'knight': 8,
            'alchemist': 9
        };
        
        // 현재 클래스에 따른 베이스 프레임
        const baseFrame = (classToFrame[this.classId] || 0) * 40;
        const animKey = `player-${this.classId}`;
        
        // 방향별 애니메이션
        const directions = ['down', 'left', 'right', 'up'];
        
        // 애니메이션 키 존재 여부 확인
        const checkAnim = (key) => !this.scene.anims.exists(key);
        
        // 각 방향별 기본 애니메이션 생성
        for (let i = 0; i < directions.length; i++) {
            const dir = directions[i];
            
            // 대기 애니메이션
            if (checkAnim(`${animKey}-idle-${dir}`)) {
                this.scene.anims.create({
                    key: `${animKey}-idle-${dir}`,
                    frames: this.scene.anims.generateFrameNumbers('character', { 
                        start: baseFrame + i * 10, 
                        end: baseFrame + i * 10 + 3 
                    }),
                    frameRate: 5,
                    repeat: -1
                });
            }
            
            // 걷기 애니메이션
            if (checkAnim(`${animKey}-walk-${dir}`)) {
                this.scene.anims.create({
                    key: `${animKey}-walk-${dir}`,
                    frames: this.scene.anims.generateFrameNumbers('character', { 
                        start: baseFrame + i * 10 + 4, 
                        end: baseFrame + i * 10 + 7 
                    }),
                    frameRate: 10,
                    repeat: -1
                });
            }
            
            // 공격 애니메이션
            if (checkAnim(`${animKey}-attack-${dir}`)) {
                this.scene.anims.create({
                    key: `${animKey}-attack-${dir}`,
                    frames: this.scene.anims.generateFrameNumbers('character', { 
                        start: baseFrame + 8 + i * 8, 
                        end: baseFrame + 11 + i * 8 
                    }),
                    frameRate: 12,
                    repeat: 0
                });
            }
        }
        
        // 스킬 애니메이션
        if (checkAnim(`${animKey}-skill`)) {
            this.scene.anims.create({
                key: `${animKey}-skill`,
                frames: this.scene.anims.generateFrameNumbers('character', { 
                    start: baseFrame + 32, 
                    end: baseFrame + 35 
                }),
                frameRate: 10,
                repeat: 0
            });
        }
        
        // 사망 애니메이션
        if (checkAnim(`${animKey}-death`)) {
            this.scene.anims.create({
                key: `${animKey}-death`,
                frames: this.scene.anims.generateFrameNumbers('character', { 
                    start: baseFrame + 36, 
                    end: baseFrame + 39 
                }),
                frameRate: 8,
                repeat: 0
            });
        }
    }

    /**
     * 업데이트 메서드 (매 프레임)
     * @param {number} time - 현재 시간
     * @param {number} delta - 경과 시간 (ms)
     */
    update(time, delta) {
        // 사망 상태면 추가 동작 중지
        if (this.isDead) return;
        
        // 무적 시간 업데이트
        if (this.invulnerable) {
            this.invulnerableTimer -= delta / 1000;
            
            // 깜빡임 효과
            this.alpha = Math.sin(time / 50) * 0.5 + 0.5;
            
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
                this.alpha = 1;
            }
        }
        
        // 쿨다운 업데이트
        if (this.actionCooldown > 0) {
            this.actionCooldown -= delta / 1000;
        }
        
        // 스킬 쿨다운 업데이트
        for (const skillId in this.skillCooldowns) {
            if (this.skillCooldowns[skillId] > 0) {
                this.skillCooldowns[skillId] -= delta / 1000;
                
                // 쿨다운 완료 이벤트
                if (this.skillCooldowns[skillId] <= 0) {
                    delete this.skillCooldowns[skillId];
                    this.events.emit('skillCooldownComplete', skillId);
                }
            }
        }
        
        // 상태 효과 업데이트
        this.updateStatusEffects(delta);
        
        // 입력 처리 및 이동
        if (!this.isAttacking && this.actionCooldown <= 0) {
            this.handleMovement();
        }
        
        // 이전 위치 저장
        this.lastX = this.x;
        this.lastY = this.y;
    }

    /**
     * 이동 입력 처리
     */
    handleMovement() {
        // 키보드 입력 확인
        const cursors = this.scene.input.keyboard.createCursorKeys();
        const wasd = {
            up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };
        
        // 이동 속도 계산 (스탯 기반)
        const moveSpeed = this.stats.speed * 0.5;
        
        // 이동 방향 및 속도 초기화
        this.body.setVelocity(0);
        
        // 이동 중인지 확인
        let isMoving = false;
        
        // 상하 이동
        if (cursors.up.isDown || wasd.up.isDown) {
            this.body.setVelocityY(-moveSpeed);
            this.direction = 'up';
            isMoving = true;
        } else if (cursors.down.isDown || wasd.down.isDown) {
            this.body.setVelocityY(moveSpeed);
            this.direction = 'down';
            isMoving = true;
        }
        
        // 좌우 이동
        if (cursors.left.isDown || wasd.left.isDown) {
            this.body.setVelocityX(-moveSpeed);
            this.direction = 'left';
            isMoving = true;
        } else if (cursors.right.isDown || wasd.right.isDown) {
            this.body.setVelocityX(moveSpeed);
            this.direction = 'right';
            isMoving = true;
        }
        
        // 대각선 이동 보정 (45도 각도로 이동)
        if (this.body.velocity.x !== 0 && this.body.velocity.y !== 0) {
            this.body.velocity.x *= 0.7071; // 1 / sqrt(2)
            this.body.velocity.y *= 0.7071; // 1 / sqrt(2)
        }
        
        // 애니메이션 업데이트
        const animKey = `player-${this.classId}`;
        
        if (isMoving) {
            this.play(`${animKey}-walk-${this.direction}`, true);
            this.isMoving = true;
        } else {
            this.play(`${animKey}-idle-${this.direction}`, true);
            this.isMoving = false;
        }
    }

    /**
     * 공격 실행
     */
    attack() {
        // 공격 중이거나 쿨다운 중이면 리턴
        if (this.isAttacking || this.actionCooldown > 0) return;
        
        // 공격 상태 설정
        this.isAttacking = true;
        this.actionCooldown = 0.5; // 0.5초 쿨다운
        
        // 공격 애니메이션 재생
        const animKey = `player-${this.classId}`;
        this.play(`${animKey}-attack-${this.direction}`, true);
        
        // 공격 효과음
        this.scene.sound.play('player-attack', { volume: 0.5 });
        
        // 공격 이벤트 발생
        this.events.emit('playerAttack', this.getAttackData());
        
        // 애니메이션 완료 이벤트
        this.once('animationcomplete', () => {
            this.isAttacking = false;
            
            // 대기 애니메이션으로 복귀
            if (!this.isMoving) {
                this.play(`${animKey}-idle-${this.direction}`, true);
            }
        });
    }

    /**
     * 공격 데이터 가져오기
     * @returns {Object} 공격 데이터
     */
    getAttackData() {
        // 무기 타입에 따른 범위 및 대미지 계산
        const weaponType = this.getEquippedWeaponType();
        const attackRange = this.getAttackRange();
        const attackBox = this.getAttackBox(attackRange);
        
        // 대미지 계산
        const damage = this.stats.attack;
        const critChance = this.stats.critRate;
        const critMultiplier = this.stats.critDamage;
        
        // 공격 데이터 반환
        return {
            attacker: this,
            damage: damage,
            critChance: critChance,
            critMultiplier: critMultiplier,
            weaponType: weaponType,
            attackBox: attackBox,
            element: this.getAttackElement()
        };
    }

    /**
     * 스킬 사용
     * @param {number} skillIndex - 스킬 인덱스
     */
    useSkill(skillIndex) {
        // 공격 중이거나 쿨다운 중이면 리턴
        if (this.isAttacking || this.actionCooldown > 0) return;
        
        // 클래스 정보에서 스킬 정보 가져오기
        const skill = this.classData.abilities[skillIndex];
        if (!skill) return;
        
        // 스킬 쿨다운 확인
        if (this.skillCooldowns[skill.id] > 0) {
            this.events.emit('message', `${skill.name}은(는) 쿨다운 중입니다! (${Math.ceil(this.skillCooldowns[skill.id])}초)`);
            return;
        }
        
        // MP 확인
        if (this.stats.mp < skill.manaCost) {
            this.events.emit('message', '마나가 부족합니다!');
            return;
        }
        
        // MP 소모
        this.stats.mp -= skill.manaCost;
        this.events.emit('statsChanged', this.stats);
        
        // 스킬 상태 설정
        this.isAttacking = true;
        this.actionCooldown = 0.8; // 0.8초 쿨다운
        
        // 쿨다운 설정
        this.skillCooldowns[skill.id] = skill.cooldown || 5;
        
        // 스킬 애니메이션 재생
        const animKey = `player-${this.classId}`;
        this.play(`${animKey}-skill`, true);
        
        // 스킬 효과음
        this.scene.sound.play('skill-cast', { volume: 0.6 });
        
        // 스킬 사용 이벤트
        this.events.emit('skillUsed', {
            player: this,
            skill: skill
        });
        
        // 애니메이션 완료 이벤트
        this.once('animationcomplete', () => {
            this.isAttacking = false;
            
            // 대기 애니메이션으로 복귀
            if (!this.isMoving) {
                this.play(`${animKey}-idle-${this.direction}`, true);
            }
        });
    }

    /**
     * 궁극기 사용
     */
    useUltimateSkill() {
        // 공격 중이거나 쿨다운 중이면 리턴
        if (this.isAttacking || this.actionCooldown > 0) return;
        
        // 클래스 정보에서 궁극기 정보 가져오기
        const ultimateSkill = this.classData.ultimateSkill;
        if (!ultimateSkill) return;
        
        // 궁극기 쿨다운 확인
        if (this.skillCooldowns[ultimateSkill.id] > 0) {
            this.events.emit('message', `${ultimateSkill.name}은(는) 쿨다운 중입니다! (${Math.ceil(this.skillCooldowns[ultimateSkill.id])}초)`);
            return;
        }
        
        // MP 확인
        if (this.stats.mp < ultimateSkill.manaCost) {
            this.events.emit('message', '마나가 부족합니다!');
            return;
        }
        
        // MP 소모
        this.stats.mp -= ultimateSkill.manaCost;
        this.events.emit('statsChanged', this.stats);
        
        // 궁극기 상태 설정
        this.isAttacking = true;
        this.actionCooldown = 1.5; // 1.5초 쿨다운
        
        // 쿨다운 설정
        this.skillCooldowns[ultimateSkill.id] = ultimateSkill.cooldown || 20;
        
        // 궁극기 애니메이션 재생
        const animKey = `player-${this.classId}`;
        this.play(`${animKey}-skill`, true);
        
        // 궁극기 효과음
        this.scene.sound.play('ultimate-cast', { volume: 0.8 });
        
        // 카메라 효과
        this.scene.cameras.main.shake(500, 0.005);
        
        // 궁극기 사용 이벤트
        this.events.emit('ultimateSkillUsed', {
            player: this,
            skill: ultimateSkill
        });
        
        // 애니메이션 완료 이벤트
        this.once('animationcomplete', () => {
            this.isAttacking = false;
            
            // 대기 애니메이션으로 복귀
            if (!this.isMoving) {
                this.play(`${animKey}-idle-${this.direction}`, true);
            }
        });
    }

    /**
     * 피격 처리
     * @param {Object} damageInfo - 대미지 정보
     */
    takeDamage(damageInfo) {
        // 무적 상태면 대미지 무시
        if (this.invulnerable) return;
        
        // 대미지 값
        const damage = damageInfo.damage || 0;
        
        // 회피 체크 (무도가 패시브)
        if (this.dodgeChance && Math.random() < this.dodgeChance) {
            // 회피 이펙트
            this.events.emit('effectRequest', { type: 'dodge', target: this });
            
            // 회피 텍스트
            this.events.emit('floatingText', { x: this.x, y: this.y - 50, text: '회피!', color: 0xFFFFFF });
            
            // 회피 효과음
            this.scene.sound.play('dodge', { volume: 0.4 });
            
            return;
        }
        
        // 체력 감소
        this.stats.hp = Math.max(0, this.stats.hp - damage);
        
        // 피격 이펙트
        this.events.emit('effectRequest', { 
            type: 'hit', 
            target: this, 
            element: damageInfo.element || 'neutral',
            isCritical: damageInfo.isCritical
        });
        
        // 피격 효과음
        this.scene.sound.play('player-hit', { volume: 0.5 });
        
        // 피격 애니메이션
        if (!this.isAttacking) {
            const animKey = `player-${this.classId}`;
            this.play(`${animKey}-idle-${this.direction}`, true);
        }
        
        // 대미지 텍스트
        this.events.emit('floatingText', {
            x: this.x,
            y: this.y - 50,
            text: damage.toString(),
            color: damageInfo.isCritical ? 0xFF0000 : 0xFFFFFF
        });
        
        // 스탯 변경 이벤트
        this.events.emit('statsChanged', this.stats);
        
        // 무적 시간 설정
        this.invulnerable = true;
        this.invulnerableTimer = 0.5; // 0.5초
        
        // 사망 처리
        if (this.stats.hp <= 0) {
            this.die();
        }
    }

    /**
     * 체력 회복
     * @param {number} amount - 회복량
     */
    heal(amount) {
        // 회복 효과 증가 (성직자 패시브 적용)
        if (this.healingBonus) {
            amount = Math.floor(amount * (1 + this.healingBonus));
        }
        
        // 체력 회복
        const oldHp = this.stats.hp;
        this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
        
        // 실제 회복량
        const actualHeal = this.stats.hp - oldHp;
        
        // 회복 이펙트
        if (actualHeal > 0) {
            this.events.emit('effectRequest', { type: 'heal', target: this });
            
            // 회복 텍스트
            this.events.emit('floatingText', {
                x: this.x,
                y: this.y - 50,
                text: `+${actualHeal}`,
                color: 0x00FF00
            });
            
            // 회복 효과음
            this.scene.sound.play('heal', { volume: 0.5 });
            
            // 스탯 변경 이벤트
            this.events.emit('statsChanged', this.stats);
        }
    }

    /**
     * 마나 회복
     * @param {number} amount - 회복량
     */
    restoreMana(amount) {
        // 마나 회복 효과 증가 (마법사 패시브 적용)
        if (this.mpRegenBonus) {
            amount = Math.floor(amount * (1 + this.mpRegenBonus));
        }
        
        // 마나 회복
        const oldMp = this.stats.mp;
        this.stats.mp = Math.min(this.stats.maxMp, this.stats.mp + amount);
        
        // 실제 회복량
        const actualRestore = this.stats.mp - oldMp;
        
        // 회복 이펙트
        if (actualRestore > 0) {
            // 마나 회복 이펙트
            this.events.emit('effectRequest', { type: 'mana', target: this });
            
            // 마나 회복 텍스트
            this.events.emit('floatingText', {
                x: this.x,
                y: this.y - 30,
                text: `+${actualRestore} MP`,
                color: 0x0088FF
            });
            
            // 마나 회복 효과음
            this.scene.sound.play('mana-restore', { volume: 0.3 });
            
            // 스탯 변경 이벤트
            this.events.emit('statsChanged', this.stats);
        }
    }

    /**
     * 상태 효과 추가
     * @param {Object} effectData - 효과 데이터
     */
    addStatusEffect(effectData) {
        // 기존 효과 확인
        const existingIndex = this.statusEffects.findIndex(
            effect => effect.type === effectData.type && effect.name === effectData.name
        );
        
        if (existingIndex >= 0) {
            // 기존 효과 갱신
            this.statusEffects[existingIndex].duration = effectData.duration;
            
            // 갱신 이펙트
            this.events.emit('effectRequest', { 
                type: 'statusRefresh', 
                effectType: effectData.type,
                target: this 
            });
        } else {
            // 새 효과 추가
            this.statusEffects.push({ ...effectData });
            
            // 적용 이펙트
            this.events.emit('effectRequest', { 
                type: 'statusApply', 
                effectType: effectData.type,
                target: this 
            });
        }
        
        // 즉시 상태 효과 적용
        this.applyStatusEffects();
    }

    /**
     * 상태 효과 적용
     */
    applyStatusEffects() {
        // 기본 스탯으로 초기화
        this.initializeStats();
        this.applyEquipmentEffects();
        this.applyClassPassives();
        
        // 각 상태 효과 적용
        for (const effect of this.statusEffects) {
            if (effect.effects) {
                // 각 효과 속성 적용
                for (const [stat, value] of Object.entries(effect.effects)) {
                    if (stat in this.stats) {
                        this.stats[stat] *= value;
                    }
                }
            }
        }
        
        // 스탯 변경 이벤트
        this.events.emit('statsChanged', this.stats);
    }

    /**
     * 상태 효과 업데이트
     * @param {number} delta - 경과 시간 (ms)
     */
    updateStatusEffects(delta) {
        const deltaSeconds = delta / 1000;
        
        // 각 상태 효과 처리
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            const effect = this.statusEffects[i];
            
            // 시간 경과에 따른 효과 적용
            if (effect.tickTimer === undefined) {
                effect.tickTimer = 0;
            }
            
            effect.tickTimer += deltaSeconds;
            
            // 1초마다 지속 효과 적용
            if (effect.tickTimer >= 1) {
                effect.tickTimer -= 1;
                
                // 지속 대미지/회복 효과
                if (effect.type === 'poison' || effect.type === 'burn') {
                    const dotDamage = Math.ceil(this.stats.maxHp * (effect.type === 'poison' ? 0.05 : 0.08));
                    this.stats.hp = Math.max(1, this.stats.hp - dotDamage);
                    
                    // 도트 대미지 이펙트
                    this.events.emit('effectRequest', { 
                        type: effect.type,
                        target: this 
                    });
                    
                    // 도트 대미지 텍스트
                    this.events.emit('floatingText', {
                        x: this.x,
                        y: this.y - 40,
                        text: dotDamage.toString(),
                        color: effect.type === 'poison' ? 0x00FF00 : 0xFF4400
                    });
                    
                    // 스탯 변경 이벤트
                    this.events.emit('statsChanged', this.stats);
                } else if (effect.type === 'regen') {
                    const healAmount = Math.ceil(this.stats.maxHp * 0.03);
                    this.heal(healAmount);
                }
            }
            
            // 지속 시간 감소
            effect.duration -= deltaSeconds;
            
            // 효과 종료
            if (effect.duration <= 0) {
                // 효과 제거
                this.statusEffects.splice(i, 1);
                
                // 효과 제거 이펙트
                this.events.emit('effectRequest', { 
                    type: 'statusRemove',
                    effectType: effect.type,
                    target: this 
                });
                
                // 효과 제거 후 스탯 다시 계산
                this.applyStatusEffects();
            }
        }
    }

    /**
     * 현재 장착 무기의 공격 속성 가져오기
     * @returns {string} 공격 속성
     */
    getAttackElement() {
        // 장착 중인 무기
        const weaponId = this.equipment.weapon;
        if (!weaponId) return 'neutral';
        
        // 무기 정보 가져오기
        const dataManager = this.scene.game.config.dataManager;
        const weapon = dataManager.getItemData(weaponId);
        
        // 무기의 속성 반환
        return (weapon && weapon.element) ? weapon.element : 'neutral';
    }

    /**
     * 현재 장착 무기 타입 가져오기
     * @returns {string} 무기 타입
     */
    getEquippedWeaponType() {
        // 장착 중인 무기
        const weaponId = this.equipment.weapon;
        if (!weaponId) {
            // 클래스별 기본 무기 타입
            const defaultWeapons = {
                'warrior': 'sword',
                'archer': 'bow',
                'mage': 'staff',
                'thief': 'dagger',
                'spearman': 'spear',
                'monk': 'fist',
                'cleric': 'mace',
                'hunter': 'crossbow',
                'knight': 'sword',
                'alchemist': 'flask'
            };
            
            return defaultWeapons[this.classId] || 'sword';
        }
        
        // 무기 정보 가져오기
        const dataManager = this.scene.game.config.dataManager;
        const weapon = dataManager.getItemData(weaponId);
        
        // 무기 타입 반환
        return (weapon && weapon.subType) ? weapon.subType : 'sword';
    }

    /**
     * 공격 범위 가져오기
     * @returns {number} 공격 범위 (픽셀)
     */
    getAttackRange() {
        // 무기 타입별 기본 범위
        const weaponRanges = {
            'sword': 50,
            'dagger': 30,
            'bow': 250,
            'crossbow': 200,
            'staff': 150,
            'wand': 120,
            'spear': 70,
            'fist': 35,
            'mace': 45,
            'axe': 60,
            'flask': 100
        };
        
        // 무기 타입 가져오기
        const weaponType = this.getEquippedWeaponType();
        
        // 범위 반환
        return weaponRanges[weaponType] || 50;
    }

    /**
     * 공격 방향에 따른 공격 박스 계산
     * @param {number} range - 공격 범위
     * @returns {Object} 공격 박스 좌표 (x, y, width, height)
     */
    getAttackBox(range) {
        // 무기 타입
        const weaponType = this.getEquippedWeaponType();
        const isRanged = ['bow', 'crossbow', 'staff', 'wand', 'flask'].includes(weaponType);
        
        // 기본 박스 크기
        let width = 40;
        let height = 40;
        
        // 원거리 무기는 원 모양 영역으로 취급
        if (isRanged) {
            width = height = range * 2;
            return {
                x: this.x,
                y: this.y,
                width: width,
                height: height,
                isCircle: true,
                radius: range
            };
        }
        
        // 방향에 따른 위치 계산
        let x, y;
        
        switch (this.direction) {
            case 'up':
                x = this.x;
                y = this.y - range / 2;
                width = 40;
                height = range;
                break;
                
            case 'down':
                x = this.x;
                y = this.y + range / 2;
                width = 40;
                height = range;
                break;
                
            case 'left':
                x = this.x - range / 2;
                y = this.y;
                width = range;
                height = 40;
                break;
                
            case 'right':
                x = this.x + range / 2;
                y = this.y;
                width = range;
                height = 40;
                break;
        }
        
        return { x, y, width, height, isCircle: false };
    }

    /**
     * 경험치 획득
     * @param {number} amount - 경험치량
     */
    gainExperience(amount) {
        // 경험치 보너스 적용
        const expBonus = 1 + (this.expBonus || 0);
        const finalAmount = Math.floor(amount * expBonus);
        
        // 경험치 추가
        this.experience += finalAmount;
        
        // 경험치 획득 이벤트
        this.events.emit('experienceGained', {
            amount: finalAmount,
            total: this.experience
        });
        
        // 레벨업 확인
        this.checkLevelUp();
    }
    
    /**
     * 레벨업 확인
     */
    checkLevelUp() {
        // 데이터 매니저에서 필요 경험치 가져오기
        const dataManager = this.scene.game.config.dataManager;
        const requiredExp = dataManager.getRequiredExperience(this.level + 1);
        
        // 레벨업 가능 확인
        if (this.experience >= requiredExp) {
            // 경험치 차감
            this.experience -= requiredExp;
            
            // 레벨 증가
            this.level++;
            
            // 스탯 업데이트
            this.initializeStats();
            this.applyEquipmentEffects();
            this.applyClassPassives();
            
            // 체력/마나 완전 회복
            this.stats.hp = this.stats.maxHp;
            this.stats.mp = this.stats.maxMp;
            
            // 레벨업 이펙트
            this.events.emit('effectRequest', { type: 'levelUp', target: this });
            
            // 레벨업 효과음
            this.scene.sound.play('level-up', { volume: 0.7 });
            
            // 레벨업 메시지
            this.events.emit('message', `레벨 업! ${this.level}레벨이 되었습니다!`);
            
            // 레벨업 이벤트
            this.events.emit('levelUp', {
                player: this,
                level: this.level,
                stats: this.stats
            });
            
            // 추가 레벨업 확인 (여러 레벨 동시에 오를 경우)
            this.checkLevelUp();
        }
    }

    /**
     * 사망 처리
     */
    die() {
        // 이미 사망 상태면 리턴
        if (this.isDead) return;
        
        // 사망 상태 설정
        this.isDead = true;
        
        // 사망 애니메이션 재생
        const animKey = `player-${this.classId}`;
        this.play(`${animKey}-death`, true);
        
        // 사망 효과음
        this.scene.sound.play('player-death', { volume: 0.7 });
        
        // 사망 이펙트
        this.events.emit('effectRequest', { type: 'death', target: this });
        
        // 이동 중지
        this.body.setVelocity(0);
        
        // 사망 이벤트
        this.events.emit('playerDeath', this);
    }

    /**
     * 부활 처리
     */
    revive() {
        // 사망 상태가 아니면 리턴
        if (!this.isDead) return;
        
        // 사망 상태 해제
        this.isDead = false;
        
        // 체력 회복 (절반)
        this.stats.hp = Math.ceil(this.stats.maxHp * 0.5);
        
        // 부활 애니메이션
        const animKey = `player-${this.classId}`;
        this.play(`${animKey}-idle-down`, true);
        
        // 부활 효과음
        this.scene.sound.play('revive', { volume: 0.6 });
        
        // 부활 이펙트
        this.events.emit('effectRequest', { type: 'revive', target: this });
        
        // 무적 상태 설정
        this.invulnerable = true;
        this.invulnerableTimer = 3; // 3초 무적
        
        // 스탯 업데이트
        this.events.emit('statsChanged', this.stats);
        
        // 부활 이벤트
        this.events.emit('playerRevive', this);
    }

    /**
     * 상호작용 시도
     * @returns {boolean} 상호작용 성공 여부
     */
    interact() {
        // 상호작용 방향 (플레이어 앞)
        const interactDistance = 50;
        let interactX = this.x;
        let interactY = this.y;
        
        switch (this.direction) {
            case 'up':
                interactY -= interactDistance;
                break;
            case 'down':
                interactY += interactDistance;
                break;
            case 'left':
                interactX -= interactDistance;
                break;
            case 'right':
                interactX += interactDistance;
                break;
        }
        
        // 상호작용 이벤트 발생
        this.events.emit('playerInteract', {
            player: this,
            x: interactX,
            y: interactY,
            direction: this.direction
        });
        
        return true; // 상호작용 시도 여부만 리턴 (성공 여부는 이벤트 리스너에서 처리)
    }

    /**
     * 자원 드랍 확인 (골드, 재료 등)
     * @returns {Object} 드랍 정보
     */
    getLootBonus() {
        return {
            goldBonus: this.goldFindBonus || 0,
            itemBonus: this.itemFindBonus || 0
        };
    }
    
    /**
     * 객체 파괴 및 정리
     */
    destroy() {
        // 이벤트 리스너 정리
        this.events.removeAllListeners();
        
        // 타이머 정리
        if (this.statusEffects) {
            this.statusEffects = [];
        }
        
        // 아이콘 정리
        if (this.statusIcons) {
            for (const icon of this.statusIcons) {
                if (icon.icon) icon.icon.destroy();
                if (icon.text) icon.text.destroy();
            }
            this.statusIcons = [];
        }
        
        // 물리 바디 비활성화
        if (this.body) {
            this.body.enable = false;
        }
        
        // 상위 클래스 destroy 호출
        super.destroy();
    }
}

export default Player;