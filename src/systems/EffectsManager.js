// src/systems/EffectsManager.js
class EffectsManager {
    constructor(scene) {
        this.scene = scene;
        this.emitters = {}; // 파티클 이미터 저장
        this.setupAnimations(); // 애니메이션 설정
        this.effectsGroup = this.scene.add.group(); // 이펙트 그룹
        this.setupSoundEffects(); // 사운드 효과 세팅
    }

    /**
     * 애니메이션 설정 - 각종 파티클 텍스쳐 초기화
     */
    setupAnimations() {
        try {
            // 기본 파티클 텍스쳐
            const textures = ['particle_circle', 'particle_square', 'particle_star', 'particle_triangle', 'particle_diamond'];
            
            // 색상 변형 목록
            const colors = [
                { key: 'red', tint: 0xff0000 },
                { key: 'green', tint: 0x00ff00 },
                { key: 'blue', tint: 0x0066ff },
                { key: 'yellow', tint: 0xffff00 },
                { key: 'purple', tint: 0xff00ff },
                { key: 'cyan', tint: 0x00ffff },
                { key: 'orange', tint: 0xff6600 },
                { key: 'white', tint: 0xffffff }
            ];

            // 모든 텍스쳐/색상 조합 생성
            textures.forEach(texture => {
                colors.forEach(color => {
                    const key = `${texture}_${color.key}`;
                    if (this.scene.textures.exists(texture)) {
                        this.scene.textures.generate(key, { 
                            data: this.scene.textures.getFrame(texture), 
                            tint: color.tint 
                        });
                    }
                });
            });
        } catch (error) {
            console.warn('파티클 텍스쳐 설정 중 오류 발생:', error);
        }
    }

    /**
     * 사운드 효과 설정 - 각종 효과음 매핑
     */
    setupSoundEffects() {
        this.sounds = {
            // 공격 효과음
            attack: 'attack_swing',
            critical: 'attack_critical',
            hit: 'attack_hit',
            miss: 'attack_miss',

            // 마법 효과음
            fire: 'magic_fire',
            ice: 'magic_ice',
            lightning: 'magic_lightning',
            arcane: 'magic_arcane',

            // 아이템 효과음
            potion: 'item_potion',
            scroll: 'item_scroll',
            gold: 'item_gold',

            // 상태이상 효과음
            poison: 'status_poison',
            burn: 'status_burn',
            freeze: 'status_freeze',

            // 환경 효과음
            door: 'env_door',
            chest: 'env_chest',
            trap: 'env_trap'
        };
    }

    /**
     * 효과음 재생
     * @param {string} key - 사운드 키
     * @param {Object} config - 재생 설정 (volume, rate, detune)
     */
    playSound(key, config = {}) {
        const soundKey = this.sounds[key] || key;

        if (this.scene.sound.get(soundKey)) {
            this.scene.sound.play(soundKey, {
                volume: config.volume || 0.5,
                rate: config.rate || 1.0,
                detune: config.detune || 0
            });
        }
    }

    //==================== 전투 효과 ====================

    /**
     * 무기 타입에 따른 공격 효과 재생
     * @param {Object} attacker - 공격자 객체
     * @param {Object} target - 대상 객체
     * @param {string} weaponType - 무기 타입 (sword, axe, bow 등)
     */
    playAttackEffect(attacker, target, weaponType) {
        const attackMethods = {
            'sword': this.playSwordAttackEffect,
            'axe': this.playAxeAttackEffect,
            'bow': this.playBowAttackEffect,
            'staff': this.playStaffAttackEffect,
            'dagger': this.playDaggerAttackEffect,
            'spear': this.playSpearAttackEffect
        };

        const method = attackMethods[weaponType] || this.playDefaultAttackEffect;
        method.call(this, attacker, target);
    }

    /**
     * 검 공격 효과
     */
    playSwordAttackEffect(attacker, target) {
        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

        // 검 휘두름 효과 (원호 모양)
        const arcPoints = 8;
        const arcRadius = 40;
        const arcAngle = 2; // 라디안, 약 115도
        const startAngle = angle - arcAngle / 2;

        // 원호 파티클 효과
        for (let i = 0; i < arcPoints; i++) {
            const pointAngle = startAngle + (arcAngle * i / (arcPoints - 1));
            const pointX = attacker.x + Math.cos(pointAngle) * arcRadius;
            const pointY = attacker.y + Math.sin(pointAngle) * arcRadius;

            // 파티클 효과
            this.createParticleEffect({
                x: pointX,
                y: pointY,
                texture: 'particle_circle_white',
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.7, end: 0 },
                speed: 50,
                lifespan: 200,
                follow: null,
                quantity: 1
            });

            // 약간의 지연으로 각 파티클 생성
            this.scene.time.delayedCall(i * 15, () => {
                this.createParticleEffect({
                    x: pointX,
                    y: pointY,
                    texture: 'particle_circle_white',
                    scale: { start: 0.7, end: 0 },
                    alpha: { start: 0.7, end: 0 },
                    speed: 50,
                    lifespan: 150,
                    follow: null,
                    quantity: 1
                });
            });
        }

        // 타겟에 충돌 효과
        this.scene.time.delayedCall(100, () => {
            this.playHitEffect(target, 'physical');
        });

        // 효과음 재생
        this.playSound('attack');
    }

    /**
     * 도끼 공격 효과
     */
    playAxeAttackEffect(attacker, target) {
        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

        // 도끼 휘두름 효과 (더 두껍고 무거운 느낌)
        const arcPoints = 6;
        const arcRadius = 45;
        const arcAngle = 1.5; // 라디안, 약 85도
        const startAngle = angle - arcAngle / 2;

        // 원호 파티클 효과
        for (let i = 0; i < arcPoints; i++) {
            const pointAngle = startAngle + (arcAngle * i / (arcPoints - 1));
            const pointX = attacker.x + Math.cos(pointAngle) * arcRadius;
            const pointY = attacker.y + Math.sin(pointAngle) * arcRadius;

            // 파티클 효과 (도끼는 더 크고 무겁게)
            this.createParticleEffect({
                x: pointX,
                y: pointY,
                texture: 'particle_diamond_red',
                scale: { start: 0.8, end: 0 },
                alpha: { start: 0.8, end: 0 },
                speed: 30,
                lifespan: 250,
                follow: null,
                quantity: 1
            });
        }

        // 타겟에 충돌 효과 (더 강력한 임팩트)
        this.scene.time.delayedCall(150, () => {
            this.playHitEffect(target, 'physical', true);

            // 지면 균열 효과 (도끼의 무게감 표현)
            this.createFloorCrackEffect(target.x, target.y, 40);
        });

        // 효과음 재생 (더 무거운 소리)
        this.playSound('attack', { detune: -300, volume: 0.7 });
    }

    /**
     * 활 공격 효과
     */
    playBowAttackEffect(attacker, target) {
        // 화살 발사 세부 설정
        const arrowSpeed = 500; // 픽셀/초
        const distance = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
        const flightTime = distance / arrowSpeed;

        // 화살 이펙트 (라인 그래픽)
        let arrowLine = this.scene.add.graphics();
        arrowLine.lineStyle(2, 0xcccccc, 0.8);
        arrowLine.beginPath();
        arrowLine.moveTo(attacker.x, attacker.y);

        // 화살 경로 애니메이션
        let elapsed = 0;
        let arrowX = attacker.x;
        let arrowY = attacker.y;

        // 화살 잔상 효과
        const arrowTrailTimer = this.scene.time.addEvent({
            delay: 30,
            callback: () => {
                // 화살 위치 업데이트
                elapsed += 0.03;
                const progress = elapsed / flightTime;

                arrowX = attacker.x + (target.x - attacker.x) * progress;
                arrowY = attacker.y + (target.y - attacker.y) * progress;

                // 화살 잔상 (작은 파티클)
                this.createParticleEffect({
                    x: arrowX,
                    y: arrowY,
                    texture: 'particle_circle_white',
                    scale: { start: 0.2, end: 0 },
                    alpha: { start: 0.5, end: 0 },
                    speed: 0,
                    lifespan: 100,
                    follow: null,
                    quantity: 1
                });

                if (progress >= 1) {
                    arrowTrailTimer.remove();
                    arrowLine.destroy();

                    // 화살 명중 효과
                    this.playHitEffect(target, 'physical');
                }
            },
            callbackScope: this,
            repeat: Math.ceil(flightTime / 0.03)
        });

        // 효과음 재생
        this.playSound('attack', { detune: 300, volume: 0.4 });
    }

    /**
     * 지팡이 공격 효과
     */
    playStaffAttackEffect(attacker, target) {
        // 마법 충전 효과
        this.createCircularAuraEffect(attacker, 'particle_star_blue', 0.5, 300);

        // 마법 투사체 효과
        this.scene.time.delayedCall(200, () => {
            const projectile = this.createProjectileEffect(
                attacker.x, attacker.y,
                target.x, target.y,
                'particle_circle_blue',
                {
                    scale: 1.2,
                    speed: 400,
                    lifespan: 2000
                }
            );

            // 투사체 충돌 효과
            projectile.onHit = () => {
                this.playHitEffect(target, 'magic');
            };
        });

        // 효과음 재생
        this.playSound('arcane');
    }

    /**
     * 단검 공격 효과
     */
    playDaggerAttackEffect(attacker, target) {
        // 단검 공격은 빠른 여러 번의 공격
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
        const slashCount = 3;

        for (let i = 0; i < slashCount; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                // 배치 위치 약간 변경
                const offsetX = (Math.random() - 0.5) * 20;
                const offsetY = (Math.random() - 0.5) * 20;

                // 공격 이펙트 (얇은 선)
                const line = this.scene.add.graphics();
                line.lineStyle(2, 0xcccccc, 0.7);
                line.beginPath();

                // 약간 각도 변형
                const slashAngle = angle + (Math.random() - 0.5) * 0.5;
                const slashLength = 30;

                const fromX = target.x + offsetX - Math.cos(slashAngle) * slashLength;
                const fromY = target.y + offsetY - Math.sin(slashAngle) * slashLength;
                const toX = target.x + offsetX + Math.cos(slashAngle) * slashLength;
                const toY = target.y + offsetY + Math.sin(slashAngle) * slashLength;

                line.moveTo(fromX, fromY);
                line.lineTo(toX, toY);
                line.strokePath();

                // 선 페이드 아웃
                this.scene.tweens.add({
                    targets: line,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => line.destroy()
                });

                // 각 공격마다 힛 이펙트
                this.playHitEffect(target, 'physical', false, 0.5);
                
                // 효과음 재생 (다중)
                this.playSound('attack', { detune: 300 + i * 100, volume: 0.3 });
            });
        }
    }

    /**
     * 창 공격 효과
     */
    playSpearAttackEffect(attacker, target) {
        // 창 공격은 직선 관통
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

        // 창 효과를 위한 직선 그래픽
        const line = this.scene.add.graphics();
        line.lineStyle(4, 0xcccccc, 0.8);
        line.beginPath();

        // 공격자로부터 타겟을 지나 일정 거리까지 연장
        const extendedLength = 80;
        const fromX = attacker.x;
        const fromY = attacker.y;
        const toX = target.x + Math.cos(angle) * extendedLength;
        const toY = target.y + Math.sin(angle) * extendedLength;

        line.moveTo(fromX, fromY);
        line.lineTo(toX, toY);
        line.strokePath();

        // 라인 애니메이션 (확장 후 사라짐)
        this.scene.tweens.add({
            targets: line,
            alpha: 0,
            duration: 300,
            onComplete: () => line.destroy()
        });

        // 충돌 이펙트
        this.scene.time.delayedCall(150, () => {
            this.playHitEffect(target, 'physical');

            // 관통 효과 (타겟 뒤에 추가 효과)
            const behindX = target.x + Math.cos(angle) * 20;
            const behindY = target.y + Math.sin(angle) * 20;

            this.createParticleEffect({
                x: behindX,
                y: behindY,
                texture: 'particle_circle_red',
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.7, end: 0 },
                speed: 50,
                lifespan: 300,
                follow: null,
                quantity: 10,
                frequency: 50
            });
        });

        // 효과음 재생
        this.playSound('attack', { detune: -100, volume: 0.6 });
    }

    /**
     * 기본 공격 효과
     */
    playDefaultAttackEffect(attacker, target) {
        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

        // 공격 이펙트 (간단한 파티클)
        this.createParticleEffect({
            x: attacker.x,
            y: attacker.y,
            texture: 'particle_circle_white',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.7, end: 0 },
            angle: angle,
            speed: 200,
            lifespan: 300,
            follow: null,
            quantity: 5,
            frequency: 50
        });

        // 타겟에 충돌 효과
        this.scene.time.delayedCall(150, () => {
            this.playHitEffect(target, 'physical');
        });

        // 효과음 재생
        this.playSound('attack');
    }

    /**
     * 적 공격 효과 재생
     * @param {Object} enemy - 적 객체
     * @param {Object} target - 대상 객체
     * @param {string} attackType - 공격 타입 (melee, ranged, magic)
     */
    playEnemyAttackEffect(enemy, target, attackType) {
        const attackMethods = {
            'melee': this.playEnemyMeleeAttackEffect,
            'ranged': this.playEnemyRangedAttackEffect,
            'magic': this.playEnemyMagicAttackEffect
        };

        const method = attackMethods[attackType] || this.playEnemyMeleeAttackEffect;
        method.call(this, enemy, target);
    }

    /**
     * 적 근접 공격 효과
     */
    playEnemyMeleeAttackEffect(enemy, target) {
        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y);
        const slashLength = 30;

        // 첫 번째 공격 라인
        const line1 = this.scene.add.graphics();
        line1.lineStyle(3, 0xff6666, 0.8);
        line1.beginPath();

        const fromX1 = enemy.x + Math.cos(angle - 0.3) * slashLength;
        const fromY1 = enemy.y + Math.sin(angle - 0.3) * slashLength;
        const toX1 = enemy.x + Math.cos(angle + 0.3) * slashLength;
        const toY1 = enemy.y + Math.sin(angle + 0.3) * slashLength;

        line1.moveTo(fromX1, fromY1);
        line1.lineTo(toX1, toY1);
        line1.strokePath();

        // 두 번째 공격 라인
        const line2 = this.scene.add.graphics();
        line2.lineStyle(3, 0xff6666, 0.8);
        line2.beginPath();

        const fromX2 = enemy.x + Math.cos(angle - 0.1) * slashLength * 0.7;
        const fromY2 = enemy.y + Math.sin(angle - 0.1) * slashLength * 0.7;
        const toX2 = enemy.x + Math.cos(angle + 0.1) * slashLength * 1.2;
        const toY2 = enemy.y + Math.sin(angle + 0.1) * slashLength * 1.2;

        line2.moveTo(fromX2, fromY2);
        line2.lineTo(toX2, toY2);
        line2.strokePath();

        // 라인 페이드 아웃
        this.scene.tweens.add({
            targets: [line1, line2],
            alpha: 0,
            duration: 200,
            onComplete: () => {
                line1.destroy();
                line2.destroy();
            }
        });

        // 플레이어 충돌 효과
        this.scene.time.delayedCall(100, () => {
            this.playHitEffect(target, 'physical');
        });

        // 효과음 재생
        this.playSound('attack', { detune: -200, volume: 0.5 });
    }

    /**
     * 적 원거리 공격 효과
     */
    playEnemyRangedAttackEffect(enemy, target) {
        // 투사체 효과
        const projectile = this.createProjectileEffect(
            enemy.x, enemy.y,
            target.x, target.y,
            'particle_diamond_red',
            {
                scale: 0.8,
                speed: 300,
                lifespan: 2000
            }
        );

        // 투사체 충돌 효과
        projectile.onHit = () => {
            this.playHitEffect(target, 'physical');
        };

        // 효과음 재생
        this.playSound('attack', { detune: 200, volume: 0.4 });
    }

    /**
     * 적 마법 공격 효과
     */
    playEnemyMagicAttackEffect(enemy, target) {
        // 마법 충전 효과
        this.createCircularAuraEffect(enemy, 'particle_star_purple', 0.6, 200);

        // 마법 투사체 효과
        this.scene.time.delayedCall(200, () => {
            const projectile = this.createProjectileEffect(
                enemy.x, enemy.y,
                target.x, target.y,
                'particle_circle_purple',
                {
                    scale: 1.0,
                    speed: 300,
                    lifespan: 2000
                }
            );

            // 투사체 충돌 효과
            projectile.onHit = () => {
                this.playHitEffect(target, 'magic');
            };
        });

        // 효과음 재생
        this.playSound('arcane', { detune: -300 });
    }

    /**
     * 맞는 효과 재생
     * @param {Object} target - 대상 객체
     * @param {string} damageType - 대미지 타입 (physical, fire, ice 등)
     * @param {boolean} isCritical - 크리티컬 여부
     * @param {number} scale - 이펙트 크기 배율 (기본값 1.0)
     */
    playHitEffect(target, damageType, isCritical = false, scale = 1.0) {
        // 대미지 타입에 따른 색상 설정
        const damageTypeColors = {
            'physical': 'red',
            'fire': 'orange',
            'ice': 'cyan',
            'lightning': 'yellow',
            'poison': 'green',
            'magic': 'purple',
            'default': 'white'
        };

        const particleColor = damageTypeColors[damageType] || damageTypeColors.default;
        
        // 히트 효과 크기 (크리티컬이면 더 크게)
        const hitScale = isCritical ? 1.5 : 1.0;

        // 히트 효과 생성
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.8 * hitScale * scale, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: 80 * hitScale,
            lifespan: 300,
            quantity: isCritical ? 12 : 8,
            frequency: 100
        });

        // 대미지 타입에 따른 추가 효과
        const additionalEffects = {
            'fire': () => {
                this.createParticleEffect({
                    x: target.x, y: target.y,
                    texture: 'particle_star_orange',
                    scale: { start: 0.6 * scale, end: 0 },
                    alpha: { start: 0.7, end: 0 },
                    speed: 60, lifespan: 500,
                    quantity: 6, frequency: 50
                });
            },
            'ice': () => {
                this.createParticleEffect({
                    x: target.x, y: target.y,
                    texture: 'particle_diamond_cyan',
                    scale: { start: 0.5 * scale, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 40, lifespan: 600,
                    quantity: 4, frequency: 60
                });
            },
            'lightning': () => {
                this.createParticleEffect({
                    x: target.x, y: target.y,
                    texture: 'particle_star_yellow',
                    scale: { start: 0.7 * scale, end: 0 },
                    alpha: { start: 0.9, end: 0 },
                    speed: 100, lifespan: 300,
                    quantity: 5, frequency: 40
                });
            },
            'magic': () => {
                this.createParticleEffect({
                    x: target.x, y: target.y,
                    texture: 'particle_star_purple',
                    scale: { start: 0.6 * scale, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 70, lifespan: 400,
                    quantity: 7, frequency: 50
                });
            }
        };

        // 추가 효과 적용
        if (additionalEffects[damageType]) {
            additionalEffects[damageType]();
        }

        // 타겟 스프라이트 효과 (피격 깜빡임)
        if (target.setTint) {
            // 대미지 타입에 따른 색상
            const tintColors = {
                'physical': 0xff0000,
                'fire': 0xff6600,
                'ice': 0x00ffff,
                'lightning': 0xffff00,
                'poison': 0x00ff00,
                'magic': 0xff00ff,
                'default': 0xff0000
            };

            const tintColor = tintColors[damageType] || tintColors.default;
            
            // 피격 효과 적용
            target.setTint(tintColor);

            // 크리티컬인 경우 카메라 효과
            if (isCritical && target === this.scene.player) {
                this.scene.cameras.main.shake(100, 0.005);
            }

            // 0.2초 후 원래 색상으로 복원
            this.scene.time.delayedCall(200, () => {
                if (target.clearTint) {
                    target.clearTint();
                }
            });
        }

        // 효과음 재생
        this.playSound(isCritical ? 'critical' : 'hit');
    }

    /**
     * 회피 효과 재생
     * @param {Object} target - 대상 객체
     */
    playDodgeEffect(target) {
        // 회피 텍스트 효과
        const dodgeText = this.scene.add.text(
            target.x,
            target.y - 20,
            'DODGE',
            {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5, 0.5);

        // 텍스트 애니메이션
        this.scene.tweens.add({
            targets: dodgeText,
            y: dodgeText.y - 30,
            alpha: 0,
            duration: 800,
            onComplete: () => {
                dodgeText.destroy();
            }
        });

        // 회피 파티클 (연기 효과)
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: 'particle_circle_white',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.5, end: 0 },
            speed: 30,
            lifespan: 400,
            follow: null,
            quantity: 10,
            frequency: 50
        });

        // 효과음 재생
        this.playSound('miss');
    }

    /**
     * 체력 회복 효과 재생
     * @param {Object} target - 대상 객체
     */
    playHealEffect(target) {
        // 회복 파티클 (상승하는 초록색 입자)
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: 'particle_star_green',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 1000,
            gravityY: -50, // 상승 효과
            follow: null,
            quantity: 15,
            frequency: 20
        });

        // 원형 오라 효과
        this.createCircularAuraEffect(target, 'particle_circle_green', 0.7, 500);

        // 효과음 재생
        this.playSound('potion');
    }

    /**
     * 넉백 효과 재생
     * @param {Object} target - 대상 객체
     * @param {number} angle - 넉백 방향 (라디안)
     */
    playKnockbackEffect(target, angle) {
        // 대상이 뒤로 밀려나는 효과
        if (target.body) {
            // 물리 엔진 있는 경우 넉백 적용
            const knockbackForce = 200;
            target.body.velocity.x = Math.cos(angle) * knockbackForce;
            target.body.velocity.y = Math.sin(angle) * knockbackForce;
        }

        // 넉백 파티클 (충격파)
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: 'particle_circle_white',
            scale: { start: 0.1, end: 1.0 },
            alpha: { start: 0.7, end: 0 },
            speed: 0,
            lifespan: 300,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 카메라 효과 (작은 흔들림)
        if (target === this.scene.player) {
            this.scene.cameras.main.shake(100, 0.005);
        }

        // 효과음 재생
        this.playSound('hit', { volume: 0.7, detune: -200 });
    }

    //==================== 상태 효과 ====================

    /**
     * 상태 효과 적용 시각화
     * @param {Object} target - 대상 객체
     * @param {string} effectType - 효과 타입 (burn, poison, slow 등)
     */
    playStatusEffectApply(target, effectType) {
        // 효과 타입에 따른 파티클 설정
        const effectConfigs = {
            'burn': { texture: 'particle_circle_orange', color: 'orange' },
            'poison': { texture: 'particle_circle_green', color: 'green' },
            'slow': { texture: 'particle_circle_cyan', color: 'cyan' },
            'stun': { texture: 'particle_star_yellow', color: 'yellow' },
            'bleed': { texture: 'particle_circle_red', color: 'red' },
            'regeneration': { texture: 'particle_circle_green', color: 'green' },
            'default': { texture: 'particle_circle_white', color: 'white' }
        };

        const config = effectConfigs[effectType] || effectConfigs.default;
        
        // 적용 애니메이션 (대상 주변 회전 효과)
        const particleCount = 8;
        const radius = 30;

        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const x = target.x + Math.cos(angle) * radius;
            const y = target.y + Math.sin(angle) * radius;

            // 파티클 생성
            const particle = this.scene.add.image(x, y, config.texture)
                .setScale(0)
                .setAlpha(0);

            // 파티클이 생겨나고 중앙으로 모이는 애니메이션
            this.scene.tweens.add({
                targets: particle,
                x: target.x,
                y: target.y,
                scale: 0.6,
                alpha: 0.8,
                duration: 500,
                ease: 'Quad.out',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }

        // 대상에 적용되는 효과 (색상 변화)
        if (target.setTint) {
            const tintColors = {
                'burn': 0xff6600,
                'poison': 0x00ff00,
                'slow': 0x00ffff,
                'stun': 0xffff00,
                'bleed': 0xff0000
            };

            if (tintColors[effectType]) {
                target.setTint(tintColors[effectType]);

                // 0.3초 후 원래 색상으로 복원
                this.scene.time.delayedCall(300, () => {
                    if (target.clearTint) {
                        target.clearTint();
                    }
                });
            }
        }

        // 효과음 재생
        this.playSound(effectType);
    }

    /**
     * 상태 효과 갱신 효과
     * @param {Object} target - 대상 객체
     * @param {string} effectType - 효과 타입 (burn, poison, slow 등)
     */
    playStatusEffectRefresh(target, effectType) {
        // 효과 타입에 따른 파티클 텍스쳐
        const textureMap = {
            'burn': 'particle_star_orange',
            'poison': 'particle_star_green',
            'slow': 'particle_star_cyan',
            'stun': 'particle_star_yellow',
            'bleed': 'particle_star_red',
            'regeneration': 'particle_star_green',
            'default': 'particle_star_white'
        };

        const particleTexture = textureMap[effectType] || textureMap.default;

        // 갱신 파티클 (작은 효과)
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: particleTexture,
            scale: { start: 0.5, end: 1.0 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 300,
            follow: null,
            quantity: 1,
            frequency: 1
        });
    }

    /**
     * 상태 효과 제거 효과
     * @param {Object} target - 대상 객체
     * @param {string} effectType - 효과 타입 (burn, poison, slow 등)
     */
    playStatusEffectRemove(target, effectType) {
        // 색상 설정
        const colorMap = {
            'burn': 'orange',
            'poison': 'green',
            'slow': 'cyan',
            'stun': 'yellow',
            'bleed': 'red',
            'regeneration': 'green',
            'default': 'white'
        };

        const particleColor = colorMap[effectType] || colorMap.default;

        // 제거 파티클 (사라지는 효과)
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.7, end: 0 },
            speed: 50,
            lifespan: 500,
            follow: null,
            quantity: 8,
            frequency: 50
        });
    }

    /**
     * 기절 효과 재생
     * @param {Object} target - 대상 객체
     */
    playStunEffect(target) {
        // 지속적인 효과를 위해 시간당 여러 번 별 아이콘 생성
        const stunTimer = this.scene.time.addEvent({
            delay: 500,
            callback: () => {
                if (!target.active || !target.isStunned) {
                    stunTimer.remove();
                    return;
                }

                // 별 아이콘 생성
                const offsetX = (Math.random() - 0.5) * 20;
                const starIcon = this.scene.add.image(
                    target.x + offsetX,
                    target.y - 30,
                    'particle_star_yellow'
                ).setScale(0.8);

                // 별 애니메이션
                this.scene.tweens.add({
                    targets: starIcon,
                    y: starIcon.y - 20,
                    alpha: 0,
                    rotation: 1,
                    scale: 0.4,
                    duration: 1000,
                    onComplete: () => {
                        starIcon.destroy();
                    }
                });
            },
            callbackScope: this,
            loop: true
        });

        // 초기 효과 (빙글빙글 돌아가는 별)
        const starCount = 3;
        for (let i = 0; i < starCount; i++) {
            const star = this.scene.add.image(
                target.x,
                target.y - 25,
                'particle_star_yellow'
            ).setScale(0.6).setAlpha(0);

            // 별 사이 간격
            const angleOffset = (Math.PI * 2 / starCount) * i;
            const radius = 15;

            // 원을 그리며 돌아가는 애니메이션
            this.scene.tweens.add({
                targets: star,
                alpha: 0.9,
                scale: 0.8,
                duration: 200
            });

            // 회전 애니메이션
            this.scene.tweens.add({
                targets: star,
                rotation: Math.PI * 4,
                duration: 2000,
                loop: -1
            });

            // 원 경로 움직임
            this.scene.tweens.add({
                targets: star,
                x: {
                    getEnd: () => target.x + Math.cos(this.scene.time.now / 500 + angleOffset) * radius
                },
                y: {
                    getEnd: () => target.y - 25 + Math.sin(this.scene.time.now / 500 + angleOffset) * radius / 2
                },
                duration: 0,
                repeat: -1
            });

            // 대상과 함께 별 아이콘도 제거
            this.scene.time.addEvent({
                delay: 100,
                callback: () => {
                    if (!target.active || !target.isStunned) {
                        star.destroy();
                    }
                },
                callbackScope: this,
                loop: true
            });
        }
    }

    /**
     * 빙결 효과 재생
     * @param {Object} target - 대상 객체
     */
    playFreezeEffect(target) {
        // 얼음 결정 생성
        const iceOverlay = this.scene.add.image(
            target.x,
            target.y,
            'particle_diamond_cyan'
        ).setScale(3).setAlpha(0.7).setDepth(target.depth + 1);

        // 얼음 효과 초기화
        if (!target.effectOverlays) {
            target.effectOverlays = {};
        }

        // 이전 빙결 효과 제거
        if (target.effectOverlays.freeze) {
            target.effectOverlays.freeze.destroy();
        }

        // 효과 저장
        target.effectOverlays.freeze = iceOverlay;

        // 얼음 효과 공전
        this.scene.tweens.add({
            targets: iceOverlay,
            scale: 3.2,
            alpha: 0.5,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // 타겟과 함께 이동
        this.scene.time.addEvent({
            delay: 10,
            callback: () => {
                if (target.active && iceOverlay && iceOverlay.active) {
                    iceOverlay.x = target.x;
                    iceOverlay.y = target.y;

                    // 빙결 상태가 사라지면 효과 제거
                    if (!target.isFrozen) {
                        iceOverlay.destroy();
                        if (target.effectOverlays) {
                            target.effectOverlays.freeze = null;
                        }
                    }
                } else {
                    iceOverlay.destroy();
                }
            },
            callbackScope: this,
            loop: true
        });

        // 효과음 재생
        this.playSound('freeze');

        // 얼음 파티클 효과
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: 'particle_diamond_cyan',
            scale: { start: 0.7, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: 40,
            lifespan: 1000,
            follow: target,
            quantity: 3,
            frequency: 500
        });
    }

    /**
     * 화염 효과 재생
     * @param {Object} target - 대상 객체
     */
    playFireEffect(target) {
        // 불꽃 파티클 효과
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: 'particle_circle_orange',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 600,
            gravityY: -50, // 화염이 위로 올라가는 효과
            follow: target,
            quantity: 5,
            frequency: 100
        });

        // 연기 효과 (더 어두운 색)
        this.scene.time.delayedCall(100, () => {
            this.createParticleEffect({
                x: target.x,
                y: target.y - 10, // 약간 위에서 발생
                texture: 'particle_circle_white',
                scale: { start: 0.3, end: 0 },
                alpha: { start: 0.3, end: 0 },
                speed: { min: 10, max: 20 },
                lifespan: 800,
                gravityY: -30,
                follow: target,
                quantity: 2,
                frequency: 200
            });
        });

        // 효과음 재생
        this.playSound('fire', { volume: 0.4 });
    }

    //==================== 방 효과 ====================

    /**
     * 방 입장 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     * @param {string} roomType - 방 타입 (entrance, treasure, merchant 등)
     */
    playRoomEntranceEffect(x, y, roomType) {
        // 방 타입에 따른 효과 설정
        const roomEffects = {
            'entrance': () => {
                // 입구 효과 (청록색 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_cyan', 1.0, 800);
            },
            'treasure': () => {
                // 보물방 효과 (황금색 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_yellow', 1.0, 800);
                this.createParticleEffect({
                    x, y,
                    texture: 'particle_star_yellow',
                    scale: { start: 0.2, end: 0.5 },
                    alpha: { start: 0.9, end: 0 },
                    speed: 50, lifespan: 1000,
                    quantity: 10, frequency: 50
                });
            },
            'merchant': () => {
                // 상인방 효과 (분홍색 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_purple', 0.8, 800);
            },
            'shrine': () => {
                // 신단방 효과 (녹색 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_green', 0.8, 800);
            },
            'boss': () => {
                // 보스방 효과 (빨간색 어두운 효과)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_red', 0.8, 1000);

                // 추가 이펙트 (위험 느낌의 붉은 번쩍임)
                for (let i = 0; i < 3; i++) {
                    this.scene.time.delayedCall(i * 300, () => {
                        this.createParticleEffect({
                            x, y,
                            texture: 'particle_circle_red',
                            scale: { start: 0.1, end: 2.0 },
                            alpha: { start: 0.2, end: 0 },
                            speed: 0, lifespan: 300,
                            quantity: 1, frequency: 1
                        });
                    });
                }
            },
            'default': () => {
                // 일반 방 효과 (흰색 작은 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_white', 0.6, 500);
            }
        };

        // 효과 실행
        const effectMethod = roomEffects[roomType] || roomEffects.default;
        effectMethod();
    }

    /**
     * 웨이브 시작 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     */
    playWaveStartEffect(x, y) {
        // 경고 사운드
        this.playSound('alert', { volume: 0.6 });

        // 파동 효과 (붉은 원)
        this.createParticleEffect({
            x, y,
            texture: 'particle_circle_red',
            scale: { start: 0.1, end: 3.0 },
            alpha: { start: 0.5, end: 0 },
            speed: 0, lifespan: 1000,
            quantity: 1, frequency: 1
        });

        // 적 소환 효과 (여러 위치에서 붉은 입자)
        const spawnPoints = 5;
        const spawnRadius = 100;

        for (let i = 0; i < spawnPoints; i++) {
            const angle = (i / spawnPoints) * Math.PI * 2;
            const spawnX = x + Math.cos(angle) * spawnRadius;
            const spawnY = y + Math.sin(angle) * spawnRadius;

            // 소환 지점 표시
            this.createParticleEffect({
                x: spawnX, y: spawnY,
                texture: 'particle_circle_red',
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.8, end: 0 },
                speed: 20, lifespan: 800,
                quantity: 10, frequency: 100
            });
        }

        // 카메라 효과
        this.scene.cameras.main.shake(500, 0.005);
    }

    /**
     * 적 스폰 효과 재생
     * @param {Object} enemy - 적 객체
     */
    playEnemySpawnEffect(enemy) {
        // 스폰 시각 효과
        this.createParticleEffect({
            x: enemy.x, y: enemy.y,
            texture: 'particle_circle_red',
            scale: { start: 0.1, end: 1.0 },
            alpha: { start: 0.8, end: 0 },
            speed: 0, lifespan: 500,
            quantity: 1, frequency: 1
        });

        // 연기 효과
        this.createParticleEffect({
            x: enemy.x, y: enemy.y,
            texture: 'particle_circle_white',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.4, end: 0 },
            speed: 30, lifespan: 600,
            quantity: 8, frequency: 50
        });

        // 초기에는 투명하게 시작
        enemy.setAlpha(0);

        // 서서히 나타나는 효과
        this.scene.tweens.add({
            targets: enemy,
            alpha: 1,
            duration: 300
        });
    }

    /**
     * 사망 효과 재생
     * @param {Object} entity - 죽는 개체 (플레이어 또는 적)
     */
    playDeathEffect(entity) {
        // 사망 파티클
        const particleColor = entity.team === 'player' ? 'blue' : 'red';

        // 파티클 폭발 효과
        this.createParticleEffect({
            x: entity.x, y: entity.y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: 50, lifespan: 800,
            quantity: 15, frequency: 50
        });

        // 사망 애니메이션
        if (entity.anims && entity.anims.play) {
            const deathAnim = entity.monsterType ?
                `${entity.monsterType}_death` : `${entity.classId}_death`;

            if (entity.anims.exists(deathAnim)) {
                entity.anims.play(deathAnim);
            }
        }

        // 페이드 아웃 효과
        this.scene.tweens.add({
            targets: entity,
            alpha: 0,
            duration: 1000,
            delay: 500,
            onComplete: () => {
                // 시체는 일정 시간 후 사라짐
                if (entity.destroy) {
                    entity.destroy();
                }
            }
        });

        // 사망 효과음
        if (entity.team === 'player') {
            this.playSound('player_death');
        } else {
            // 적 유형에 따른 사망 소리
            if (entity.type === 'boss') {
                this.playSound('boss_death');
            } else {
                this.playSound('enemy_death', {
                    detune: Math.random() * 400 - 200 // 약간 랜덤한 사운드
                });
            }
        }
    }

    /**
     * 플레이어 사망 효과 재생
     * @param {Object} player - 플레이어 객체
     */
    playPlayerDeathEffect(player) {
        // 카메라 효과
        this.scene.cameras.main.shake(500, 0.01);
        this.scene.cameras.main.flash(500, 255, 0, 0, true);

        // 빛 페이드 아웃
        const deathLight = this.scene.add.graphics();
        deathLight.fillStyle(0xffffff, 0.5);
        deathLight.fillCircle(player.x, player.y, 100);

        this.scene.tweens.add({
            targets: deathLight,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
                deathLight.destroy();
            }
        });

        // 플레이어 주변에 파티클 폭발
        this.createParticleEffect({
            x: player.x, y: player.y,
            texture: 'particle_circle_blue',
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.9, end: 0 },
            speed: 100, lifespan: 1500,
            quantity: 30, frequency: 50
        });

        // 영혼 상승 효과
        this.scene.time.delayedCall(500, () => {
            this.createParticleEffect({
                x: player.x, y: player.y,
                texture: 'particle_circle_cyan',
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.7, end: 0 },
                speed: { min: 10, max: 30 },
                lifespan: 2000,
                gravityY: -50, // 상승 효과
                quantity: 20, frequency: 50
            });
        });

        // 사망 효과음
        this.playSound('player_death');
    }

    /**
     * 부활 효과 재생
     * @param {Object} entity - 부활할 개체
     */
    playReviveEffect(entity) {
        // 부활 빛 효과
        const reviveLight = this.scene.add.graphics();
        reviveLight.fillStyle(0xffffff, 0);
        reviveLight.fillCircle(entity.x, entity.y, 100);

        // 빛 애니메이션
        this.scene.tweens.add({
            targets: reviveLight,
            alpha: 0.8,
            duration: 1000,
            yoyo: true,
            onComplete: () => {
                reviveLight.destroy();
            }
        });

        // 부활 파티클 (황금색)
        this.createParticleEffect({
            x: entity.x, y: entity.y,
            texture: 'particle_star_yellow',
            scale: { start: 0.2, end: 0.8 },
            alpha: { start: 0.9, end: 0 },
            speed: { min: 50, max: 100 },
            lifespan: 1500,
            quantity: 20, frequency: 50
        });

        // 빛 기둥 효과
        for (let i = 0; i < 5; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x: entity.x, y: entity.y - 50,
                    texture: 'particle_circle_white',
                    scale: { start: 0.1, end: 0.5 },
                    alpha: { start: 0.8, end: 0 },
                    speed: { min: 0, max: 10 },
                    lifespan: 800,
                    gravityY: -100, // 위로 올라가는 효과
                    quantity: 5, frequency: 50
                });
            });
        }

        // 카메라 효과
        this.scene.cameras.main.flash(500, 255, 255, 255, true);

        // 효과음 재생
        this.playSound('revive');
    }

    //==================== 아이템 효과 ====================

    /**
     * 보물 상자 열기 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     * @param {string} rarity - 희귀도 (common, uncommon, rare 등)
     */
    playChestOpenEffect(x, y, rarity) {
        // 희귀도에 따른 색상
        const rarityColors = {
            'uncommon': 'green',
            'rare': 'blue',
            'epic': 'purple',
            'legendary': 'orange',
            'mythic': 'red',
            'default': 'white'
        };

        const particleColor = rarityColors[rarity] || rarityColors.default;

        // 빛 폭발 효과
        this.createParticleEffect({
            x, y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.1, end: 1.5 },
            alpha: { start: 0.8, end: 0 },
            speed: 0, lifespan: 500,
            quantity: 1, frequency: 1
        });

        // 빛나는 파티클 효과
        this.createParticleEffect({
            x, y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.9, end: 0 },
            speed: { min: 30, max: 80 },
            lifespan: 1000,
            quantity: 15, frequency: 50
        });

        // 효과음 재생
        this.playSound('chest_open');

        // 특별한 상자의 경우 추가 효과
        if (rarity === 'legendary' || rarity === 'mythic') {
            // 광역 빛 효과
            this.scene.cameras.main.flash(300, 255, 255, 200, true);

            // 추가 파티클
            this.scene.time.delayedCall(300, () => {
                this.createParticleEffect({
                    x, y,
                    texture: `particle_star_${particleColor}`,
                    scale: { start: 0.2, end: 0.6 },
                    alpha: { start: 0.9, end: 0 },
                    speed: { min: 20, max: 60 },
                    lifespan: 1500,
                    quantity: 10, frequency: 50
                });
            });

            // 특별 효과음
            this.playSound('legendary_item');
        }
    }

    /**
     * 아이템 획득 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     * @param {string} rarity - 희귀도
     */
    playItemAcquireEffect(x, y, rarity) {
        // 희귀도에 따른 색상
        const rarityColors = {
            'uncommon': 'green',
            'rare': 'blue',
            'epic': 'purple',
            'legendary': 'orange',
            'mythic': 'red',
            'default': 'white'
        };

        const particleColor = rarityColors[rarity] || rarityColors.default;

        // 아이템 획득 파티클
        this.createParticleEffect({
            x, y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 30, max: 60 },
            lifespan: 800,
            quantity: 8, frequency: 50
        });

        // 위로 올라가는 빛 효과
        this.createParticleEffect({
            x, y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.7, end: 0 },
            speed: { min: 10, max: 30 },
            lifespan: 1000,
            gravityY: -50, // 위로 올라가는 효과
            quantity: 5, frequency: 100
        });

        // 효과음 재생
        if (rarity === 'legendary' || rarity === 'mythic') {
            this.playSound('legendary_item');
        } else if (rarity === 'epic') {
            this.playSound('epic_item');
        } else {
            this.playSound('item_pickup');
        }
    }

    /**
     * 아이템 드롭 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     * @param {string} rarity - 희귀도
     */
    playItemDropEffect(x, y, rarity) {
        // 희귀도에 따른 색상
        const rarityColors = {
            'uncommon': 'green',
            'rare': 'blue',
            'epic': 'purple',
            'legendary': 'orange',
            'mythic': 'red',
            'default': 'white'
        };

        const particleColor = rarityColors[rarity] || rarityColors.default;

        // 드롭 효과 (떨어지는 느낌)
        this.createParticleEffect({
            x, y: y - 20,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 30, max: 50 },
            lifespan: 500,
            gravityY: 100, // 아래로 떨어지는 효과
            quantity: 5, frequency: 50
        });

        // 빛 효과
        this.createParticleEffect({
            x, y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.1, end: 0.8 },
            alpha: { start: 0.9, end: 0 },
            speed: 0, lifespan: 500,
            quantity: 1, frequency: 1
        });
    }

    /**
     * 포션 효과 재생
     * @param {Object} target - 대상 객체
     * @param {string} potionType - 포션 타입 (health, mana 등)
     */
    playPotionEffect(target, potionType) {
        // 포션 타입에 따른 색상
        const potionColors = {
            'health': 'red',
            'mana': 'blue',
            'strength': 'orange',
            'defense': 'cyan',
            'speed': 'yellow',
            'default': 'green'
        };

        const particleColor = potionColors[potionType] || potionColors.default;

        // 포션 효과 (상승하는 입자)
        this.createParticleEffect({
            x: target.x, y: target.y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 1000,
            gravityY: -40, // 위로 올라가는 효과
            follow: target,
            quantity: 10, frequency: 50
        });

        // 오라 효과
        this.createCircularAuraEffect(target, `particle_circle_${particleColor}`, 0.7, 500);

        // 효과음 재생
        this.playSound('potion');
    }

    /**
     * 스크롤 효과 재생
     * @param {Object} target - 대상 객체
     * @param {string} scrollType - 스크롤 타입 (teleport, identify 등)
     */
    playScrollEffect(target, scrollType) {
        // 스크롤 타입에 따른 색상
        const scrollColors = {
            'teleport': 'cyan',
            'identify': 'white',
            'enchant': 'purple',
            'fireball': 'orange',
            'frost': 'cyan',
            'lightning': 'yellow',
            'healing': 'green',
            'protection': 'blue',
            'default': 'white'
        };

        const particleColor = scrollColors[scrollType] || scrollColors.default;

        // 스크롤 사용 효과 (마법 문자 파티클)
        this.createParticleEffect({
            x: target.x, y: target.y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: 60, lifespan: 800,
            quantity: 15, frequency: 50
        });

        // 효과음 재생
        this.playSound('scroll');
    }

    /**
     * 레거시 아이템 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     */
    playLegacyItemEffect(x, y) {
        // 카메라 효과
        this.scene.cameras.main.flash(800, 255, 255, 255, true);

        // 빛 기둥 효과
        for (let i = 0; i < 10; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x, y: y - i * 10,
                    texture: 'particle_circle_white',
                    scale: { start: 0.1, end: 1.0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0, lifespan: 500,
                    quantity: 1, frequency: 1
                });
            });
        }

        // 무지개 입자 효과
        const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];

        for (let i = 0; i < colors.length; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x, y,
                    texture: `particle_star_${colors[i]}`,
                    scale: { start: 0.2, end: 0.8 },
                    alpha: { start: 0.9, end: 0 },
                    speed: 50 + i * 10,
                    lifespan: 1500,
                    quantity: 10, frequency: 50
                });
            });
        }

        // 효과음 재생
        this.playSound('legendary_item', { volume: 1.0 });

        // 추가 효과음 (여러 층)
        this.scene.time.delayedCall(300, () => {
            this.playSound('choir', { volume: 0.7 });
        });
    }

    //==================== 함정 및 환경 효과 ====================

    /**
     * 함정 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     * @param {string} trapType - 함정 타입 (spike, poison 등)
     */
    playTrapEffect(x, y, trapType) {
        const trapEffects = {
            'spike': this.playSpikeEffect,
            'poison': this.playPoisonTrapEffect,
            'fire': this.playFireTrapEffect,
            'frost': this.playFrostTrapEffect,
            'default': this.playDefaultTrapEffect
        };

        const effectMethod = trapEffects[trapType] || trapEffects.default;
        effectMethod.call(this, x, y);
    }

    /**
     * 가시 함정 효과
     */
    playSpikeEffect(x, y) {
        // 가시 튀어나오는 애니메이션
        const spikeLines = [];
        const spikeCount = 8;

        for (let i = 0; i < spikeCount; i++) {
            const angle = (i / spikeCount) * Math.PI * 2;
            const length = 30;

            const graphics = this.scene.add.graphics();
            graphics.lineStyle(2, 0xaaaaaa, 0.8);
            graphics.beginPath();
            graphics.moveTo(x, y);

            const endX = x + Math.cos(angle) * length;
            const endY = y + Math.sin(angle) * length;
            graphics.lineTo(endX, endY);
            graphics.strokePath();

            spikeLines.push(graphics);

            // 작은 빨간 파티클 (피)
            this.createParticleEffect({
                x: endX, y: endY,
                texture: 'particle_circle_red',
                scale: { start: 0.3, end: 0 },
                alpha: { start: 0.8, end: 0 },
                speed: 20, lifespan: 500,
                quantity: 3, frequency: 50
            });
        }

        // 가시 사라짐
        this.scene.time.delayedCall(500, () => {
            spikeLines.forEach(spike => {
                this.scene.tweens.add({
                    targets: spike,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => spike.destroy()
                });
            });
        });

        // 효과음 재생
        this.playSound('trap_spike');
    }

    /**
     * 독 함정 효과
     */
    playPoisonTrapEffect(x, y) {
        // 녹색 연기 효과
        this.createParticleEffect({
            x, y,
            texture: 'particle_circle_green',
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.7, end: 0 },
            speed: { min: 20, max: 50 },
            lifespan: 1000,
            quantity: 20, frequency: 100
        });

        // 효과음 재생
        this.playSound('trap_poison');
    }

    /**
     * 화염 함정 효과
     */
    playFireTrapEffect(x, y) {
        // 화염 폭발 효과
        this.createParticleEffect({
            x, y,
            texture: 'particle_circle_orange',
            scale: { start: 0.1, end: 1.0 },
            alpha: { start: 0.8, end: 0 },
            speed: 0, lifespan: 300,
            quantity: 1, frequency: 1
        });

        // 불꽃 파티클
        this.createParticleEffect({
            x, y,
            texture: 'particle_circle_orange',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 30, max: 80 },
            lifespan: 800,
            quantity: 15, frequency: 50
        });

        // 연기 효과
        this.scene.time.delayedCall(200, () => {
            this.createParticleEffect({
                x, y: y - 10,
                texture: 'particle_circle_white',
                scale: { start: 0.4, end: 0 },
                alpha: { start: 0.3, end: 0 },
                speed: { min: 10, max: 30 },
                lifespan: 1000,
                gravityY: -30, // 위로 올라가는 연기
                quantity: 10, frequency: 100
            });
        });

        // 효과음 재생
        this.playSound('trap_fire');
    }

    /**
     * 얼음 함정 효과
     */
    playFrostTrapEffect(x, y) {
        // 얼음 결정 효과
        this.createParticleEffect({
            x, y,
            texture: 'particle_diamond_cyan',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 50 },
            lifespan: 800,
            quantity: 15, frequency: 50
        });

        // 차가운 안개 효과
        this.createParticleEffect({
            x, y,
            texture: 'particle_circle_cyan',
            scale: { start: 0.3, end: 1.0 },
            alpha: { start: 0.5, end: 0 },
            speed: { min: 10, max: 30 },
            lifespan: 1200,
            quantity: 10, frequency: 100
        });

        // 효과음 재생
        this.playSound('trap_frost');
    }

    /**
     * 기본 함정 효과
     */
    playDefaultTrapEffect(x, y) {
        // 간단한 함정 작동 효과
        this.createParticleEffect({
            x, y,
            texture: 'particle_circle_white',
            scale: { start: 0.1, end: 1.0 },
            alpha: { start: 0.7, end: 0 },
            speed: 0, lifespan: 300,
            quantity: 1, frequency: 1
        });

        // 효과음 재생
        this.playSound('trap_generic');
    }

    /**
     * 화살 함정 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     * @param {Object} direction - 방향 벡터 {x, y}
     */
    playArrowTrapEffect(x, y, direction) {
        // 화살 발사 효과
        const arrowLength = 30;
        const endX = x + direction.x * arrowLength;
        const endY = y + direction.y * arrowLength;

        // 화살 그래픽
        const arrowLine = this.scene.add.graphics();
        arrowLine.lineStyle(2, 0xaaaaaa, 0.8);
        arrowLine.beginPath();
        arrowLine.moveTo(x, y);
        arrowLine.lineTo(endX, endY);
        arrowLine.strokePath();

        // 화살 애니메이션
        this.scene.tweens.add({
            targets: arrowLine,
            x: direction.x * 300, // 화살 이동 거리
            y: direction.y * 300,
            duration: 500,
            onComplete: () => {
                arrowLine.destroy();
            }
        });

        // 효과음 재생
        this.playSound('trap_arrow');
    }

    /**
     * 지면 균열 효과 생성
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     * @param {number} radius - 균열 반경
     */
    createFloorCrackEffect(x, y, radius) {
        // 균열 라인 효과
        const cracks = [];
        const crackCount = 6;

        for (let i = 0; i < crackCount; i++) {
            const angle = (i / crackCount) * Math.PI * 2;

            const graphics = this.scene.add.graphics();
            graphics.lineStyle(2, 0x666666, 0.7);
            graphics.beginPath();
            graphics.moveTo(x, y);

            // 지그재그 균열 생성
            let currentX = x;
            let currentY = y;
            const segments = 3;
            const length = radius / segments;
            for (let j = 0; j < segments; j++) {
                // 약간의 무작위 각도 변화
                const segmentAngle = angle + (Math.random() - 0.5) * 0.5;
                const endX = currentX + Math.cos(segmentAngle) * length;
                const endY = currentY + Math.sin(segmentAngle) * length;

                graphics.lineTo(endX, endY);
                currentX = endX;
                currentY = endY;
            }

            graphics.strokePath();
            cracks.push(graphics);
        }

        // 파티클 효과 (먼지)
        this.createParticleEffect({
            x, y,
            texture: 'particle_circle_white',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.3, end: 0 },
            speed: 30, lifespan: 500,
            quantity: 10, frequency: 50
        });

        // 균열 사라짐
        this.scene.time.delayedCall(2000, () => {
            cracks.forEach(crack => {
                this.scene.tweens.add({
                    targets: crack,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => crack.destroy()
                });
            });
        });
    }

    /**
     * 신단 활성화 효과 재생
     * @param {number} x - 효과 X 좌표
     * @param {number} y - 효과 Y 좌표
     * @param {string} shrineType - 신단 타입 (health, strength 등)
     */
    playShrineActivateEffect(x, y, shrineType) {
        // 신단 타입에 따른 색상
        const shrineColors = {
            'health': 'red',
            'strength': 'orange',
            'defense': 'blue',
            'speed': 'yellow',
            'mana': 'purple',
            'default': 'white'
        };

        const particleColor = shrineColors[shrineType] || shrineColors.default;

        // 신단 활성화 효과 (빛 기둥)
        for (let i = 0; i < 5; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x, y: y - i * 20,
                    texture: `particle_circle_${particleColor}`,
                    scale: { start: 0.8, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0, lifespan: 500,
                    quantity: 1, frequency: 1
                });
            });
        }

        // 주변 파티클 효과
        this.createParticleEffect({
            x, y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.9, end: 0 },
            speed: { min: 30, max: 80 },
            lifespan: 1000,
            quantity: 20, frequency: 50
        });

        // 효과음 재생
        this.playSound('shrine_activate');
    }

    /**
     * 던전 완료 효과 재생
     * @param {Object} player - 플레이어 객체
     */
    playDungeonCompletedEffect(player) {
        const x = player.x;
        const y = player.y;

        // 카메라 효과
        this.scene.cameras.main.flash(1000, 255, 255, 255, true);

        // 강렬한 빛 효과
        this.createParticleEffect({
            x, y,
            texture: 'particle_circle_white',
            scale: { start: 0.1, end: 3.0 },
            alpha: { start: 0.9, end: 0 },
            speed: 0, lifespan: 1000,
            quantity: 1, frequency: 1
        });

        // 무지개 색 파티클 (승리 축하)
        const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];

        for (let i = 0; i < colors.length; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x, y,
                    texture: `particle_star_${colors[i]}`,
                    scale: { start: 0.3, end: 0 },
                    alpha: { start: 0.9, end: 0 },
                    speed: 100, lifespan: 1500,
                    quantity: 10, frequency: 50
                });
            });
        }

        // 효과음 재생
        this.playSound('dungeon_complete');
        this.scene.time.delayedCall(500, () => {
            this.playSound('victory_fanfare');
        });
    }

    //==================== 유틸리티 메서드 ====================

    /**
     * 파티클 이펙트 생성
     * @param {Object} config - 파티클 설정
     * @returns {Phaser.GameObjects.Particles.ParticleEmitter} 생성된 이미터
     */
    createParticleEffect(config) {
        try {
            // 파티클 이미터 생성 (없는 경우)
            if (!this.emitters[config.texture]) {
                this.emitters[config.texture] = this.scene.add.particles(config.texture);
            }

            // 기본값 설정
            const defaultConfig = {
                scale: { start: 1, end: 0 },
                alpha: { start: 1, end: 0 },
                speed: 50,
                lifespan: 500,
                quantity: 10,
                frequency: 100,
                follow: null,
                gravityY: 0
            };

            // 설정 병합
            const mergedConfig = { ...defaultConfig, ...config };

            // 이미터 생성 옵션
            const emitterConfig = {
                x: mergedConfig.x,
                y: mergedConfig.y,
                lifespan: mergedConfig.lifespan,
                quantity: mergedConfig.quantity,
                frequency: mergedConfig.frequency,
                gravityY: mergedConfig.gravityY || 0
            };

            // 속도 설정
            if (typeof mergedConfig.speed === 'object') {
                emitterConfig.speed = mergedConfig.speed;
            } else {
                emitterConfig.speed = { min: -mergedConfig.speed, max: mergedConfig.speed };
            }

            // 스케일 설정
            if (typeof mergedConfig.scale === 'object') {
                emitterConfig.scale = mergedConfig.scale;
            } else {
                emitterConfig.scale = { start: mergedConfig.scale, end: 0 };
            }

            // 알파 설정
            if (typeof mergedConfig.alpha === 'object') {
                emitterConfig.alpha = mergedConfig.alpha;
            } else {
                emitterConfig.alpha = { start: mergedConfig.alpha, end: 0 };
            }

            // 각도 설정
            if (mergedConfig.angle !== undefined) {
                emitterConfig.angle = mergedConfig.angle * (180 / Math.PI); // 라디안 -> 각도
                emitterConfig.speed = mergedConfig.speed; // 단일 값 속도 (방향성 있음)
            }

            // 파티클 이미터 생성
            const emitter = this.emitters[config.texture].createEmitter(emitterConfig);

            // 따라가기 객체가 있으면 설정
            if (mergedConfig.follow) {
                emitter.startFollow(mergedConfig.follow);
            }

            // 한 번만 방출하는 경우 자동 정지
            if (mergedConfig.quantity > 0 && mergedConfig.frequency === 1) {
                this.scene.time.delayedCall(100, () => {
                    emitter.stop();
                });
            }

            // 시간 제한 (필요시)
            if (mergedConfig.duration) {
                this.scene.time.delayedCall(mergedConfig.duration, () => {
                    emitter.stop();
                });
            }

            return emitter;
        } catch (error) {
            console.warn('파티클 효과 생성 중 오류:', error);
            return null;
        }
    }

    /**
     * 원형 오라 효과 생성
     * @param {Object} entity - 대상 객체 또는 좌표 {x, y}
     * @param {string} particleTexture - 파티클 텍스쳐
     * @param {number} scale - 크기 배율 (기본값 1.0)
     * @param {number} duration - 지속 시간 (밀리초)
     * @returns {Phaser.GameObjects.Graphics} 생성된 오라 객체
     */
    createCircularAuraEffect(entity, particleTexture, scale = 1.0, duration = 500) {
        // 위치 설정
        const x = entity.x !== undefined ? entity.x : entity.x;
        const y = entity.y !== undefined ? entity.y : entity.y;

        // 원형 오라 효과
        const aura = this.scene.add.graphics();
        aura.fillStyle(0xffffff, 0);
        aura.fillCircle(0, 0, 40 * scale);

        // 엔티티를 따라가도록 설정
        if (typeof entity.x !== 'undefined') {
            aura.x = entity.x;
            aura.y = entity.y;

            // 엔티티가 움직이면 따라가도록
            this.scene.time.addEvent({
                delay: 10,
                callback: () => {
                    if (aura.active && entity.active) {
                        aura.x = entity.x;
                        aura.y = entity.y;
                    }
                },
                callbackScope: this,
                loop: true,
                repeat: duration / 10
            });
        }

        // 파티클 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: particleTexture,
            scale: { start: 0.1 * scale, end: 0.5 * scale },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: duration,
            follow: aura,
            quantity: 1,
            frequency: 1
        });

        // 더 작은 파티클들이 주변을 회전
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const radius = 30 * scale;

            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;

            this.createParticleEffect({
                x: px,
                y: py,
                texture: particleTexture,
                scale: { start: 0.3 * scale, end: 0 },
                alpha: { start: 0.7, end: 0 },
                speed: 0,
                lifespan: duration,
                follow: null,
                quantity: 1,
                frequency: 1
            });
        }

        // 오라 삭제
        this.scene.time.delayedCall(duration, () => {
            aura.destroy();
        });

        return aura;
    }

    /**
     * 투사체 효과 생성
     * @param {number} fromX - 시작 X 좌표
     * @param {number} fromY - 시작 Y 좌표
     * @param {number} toX - 도착 X 좌표
     * @param {number} toY - 도착 Y 좌표
     * @param {string} particleTexture - 파티클 텍스쳐
     * @param {Object} options - 추가 옵션
     * @returns {Phaser.GameObjects.Image} 생성된 투사체 객체
     */
    createProjectileEffect(fromX, fromY, toX, toY, particleTexture, options = {}) {
        // 기본 설정
        const config = {
            scale: options.scale || 1.0,
            speed: options.speed || 300,
            lifespan: options.lifespan || 2000,
            color: options.color || 'white'
        };

        // 방향 계산
        const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
        const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
        const travelTime = distance / config.speed * 1000; // 밀리초 단위

        // 투사체 스프라이트 (또는 그래픽)
        const projectile = this.scene.add.image(fromX, fromY, particleTexture)
            .setScale(config.scale);

        // 투사체 회전
        projectile.rotation = angle;

        // 꼬리 파티클 효과
        const trailEmitter = this.createParticleEffect({
            x: fromX,
            y: fromY,
            texture: particleTexture,
            scale: { start: config.scale * 0.7, end: 0 },
            alpha: { start: 0.5, end: 0 },
            speed: 0,
            lifespan: 300,
            follow: projectile,
            quantity: 10,
            frequency: 50,
            duration: travelTime
        });

        // 투사체 이동 애니메이션
        this.scene.tweens.add({
            targets: projectile,
            x: toX,
            y: toY,
            duration: travelTime,
            onComplete: () => {
                // 충돌 효과
                if (projectile.onHit) {
                    projectile.onHit();
                }

                // 도착 파티클 효과
                this.createParticleEffect({
                    x: toX,
                    y: toY,
                    texture: particleTexture,
                    scale: { start: config.scale, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 50,
                    lifespan: 300,
                    follow: null,
                    quantity: 10,
                    frequency: 50
                });

                // 투사체 제거
                projectile.destroy();
            }
        });

        return projectile;
    }

    /**
     * 멀티샷 효과 실행
     * @param {Object} player - 플레이어 객체
     * @param {Object|Array} targets - 대상 객체 또는 객체 배열
     * @param {number} count - 샷 횟수 (기본값 3)
     */
    executeMultiShot(player, targets, count = 3) {
        // 여러 발의 투사체 발사
        if (!Array.isArray(targets)) {
            targets = [targets];
        }

        // 발사 간격
        const fireInterval = 100; // ms

        // 각 타겟에 발사
        targets.forEach((target, targetIndex) => {
            // 각 발사마다 약간의 지연
            for (let i = 0; i < count; i++) {
                this.scene.time.delayedCall(i * fireInterval + targetIndex * 200, () => {
                    if (!target.active) return;

                    // 약간의 오차 주기
                    const offsetX = (Math.random() - 0.5) * 20;
                    const offsetY = (Math.random() - 0.5) * 20;

                    // 투사체 효과
                    const projectile = this.createProjectileEffect(
                        player.x, player.y,
                        target.x + offsetX, target.y + offsetY,
                        'particle_diamond_blue',
                        {
                            scale: 0.8,
                            speed: 400,
                            lifespan: 2000
                        }
                    );

                    // 충돌 효과
                    projectile.onHit = () => {
                        this.playHitEffect(target, 'physical');
                    };

                    // 발사 효과음
                    this.playSound('attack', { detune: i * 100, volume: 0.3 });
                });
            }
        });
    }
}

export default EffectsManager;