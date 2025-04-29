// src/systems/EffectsManager.js
class EffectsManager {
    constructor(scene) {
        this.scene = scene;

        // 파티클 이미터 저장
        this.emitters = {};

        // 애니메이션 설정
        this.setupAnimations();

        // 이펙트 그룹
        this.effectsGroup = this.scene.add.group();

        // 사운드 효과 세팅
        this.setupSoundEffects();
    }

    // 애니메이션 설정
    setupAnimations() {
        // 파티클 텍스쳐 설정 (애셋이 로드되어 있어야 함)
        try {
            const textures = [
                'particle_circle',
                'particle_square',
                'particle_star',
                'particle_triangle',
                'particle_diamond'
            ];

            // 각 파티클 텍스쳐마다 색상 변형 생성
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

            // 각 텍스쳐와 색상 조합 생성
            textures.forEach(texture => {
                colors.forEach(color => {
                    // 게임 내에서 사용할 수 있는 파티클 키 생성
                    // 예: 'particle_circle_red', 'particle_star_blue', 등
                    const key = `${texture}_${color.key}`;

                    if (this.scene.textures.exists(texture)) {
                        // 원래 텍스쳐를 복제하여 색상 버전 생성
                        this.scene.textures.generate(key, { data: this.scene.textures.getFrame(texture), tint: color.tint });
                    }
                });
            });
        } catch (error) {
            console.warn('파티클 텍스쳐 설정 중 오류 발생:', error);
        }
    }

    // 사운드 효과 설정
    setupSoundEffects() {
        // 사운드 효과 매핑
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

    // 효과음 재생
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

    // ======== 전투 효과 ========

    // 공격 효과
    playAttackEffect(attacker, target, weaponType) {
        // 공격 타입에 따른 효과
        switch (weaponType) {
            case 'sword':
                this.playSwordAttackEffect(attacker, target);
                break;
            case 'axe':
                this.playAxeAttackEffect(attacker, target);
                break;
            case 'bow':
                this.playBowAttackEffect(attacker, target);
                break;
            case 'staff':
                this.playStaffAttackEffect(attacker, target);
                break;
            case 'dagger':
                this.playDaggerAttackEffect(attacker, target);
                break;
            case 'spear':
                this.playSpearAttackEffect(attacker, target);
                break;
            default:
                this.playDefaultAttackEffect(attacker, target);
                break;
        }
    }

    // 검 공격 효과
    playSwordAttackEffect(attacker, target) {
        // 공격 궤적
        const startX = attacker.x;
        const startY = attacker.y;
        const targetX = target.x;
        const targetY = target.y;

        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);

        // 검 휘두름 효과 (원호 모양)
        const arcPoints = 8;
        const arcRadius = 40;
        const arcAngle = 2; // 라디안, 약 115도

        // 공격 시작 각도 (플레이어 바라보는 방향에서 조금 뒤)
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
                quantity: 1,
                frequency: 1
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
                    quantity: 1,
                    frequency: 1
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

    // 도끼 공격 효과
    playAxeAttackEffect(attacker, target) {
        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

        // 도끼 휘두름 효과 (더 두껍고 무거운 느낌)
        const arcPoints = 6;
        const arcRadius = 45;
        const arcAngle = 1.5; // 라디안, 약 85도

        // 공격 시작 각도
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
                quantity: 1,
                frequency: 1
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

    // 활 공격 효과
    playBowAttackEffect(attacker, target) {
        // 화살 발사 포인트 계산
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

        // 화살 경로 시뮬레이션
        const arrowSpeed = 500; // 픽셀/초
        const distance = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
        const flightTime = distance / arrowSpeed;

        // 화살 이펙트 (라인 파티클)
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
                    quantity: 1,
                    frequency: 1
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

    // 지팡이 공격 효과
    playStaffAttackEffect(attacker, target) {
        // 마법 발사 애니메이션
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

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

    // 단검 공격 효과
    playDaggerAttackEffect(attacker, target) {
        // 단검 공격은 빠른 여러 번의 공격
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

        // 빠른 공격 효과
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
            });
        }

        // 효과음 재생 (다중)
        for (let i = 0; i < slashCount; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.playSound('attack', { detune: 300 + i * 100, volume: 0.3 });
            });
        }
    }

    // 창 공격 효과
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

    // 기본 공격 효과
    playDefaultAttackEffect(attacker, target) {
        // 기본 공격 애니메이션
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

    // 적 공격 효과
    playEnemyAttackEffect(enemy, target, attackType) {
        // 적 공격 타입에 따른 효과
        switch (attackType) {
            case 'melee':
                this.playEnemyMeleeAttackEffect(enemy, target);
                break;
            case 'ranged':
                this.playEnemyRangedAttackEffect(enemy, target);
                break;
            case 'magic':
                this.playEnemyMagicAttackEffect(enemy, target);
                break;
            default:
                this.playEnemyMeleeAttackEffect(enemy, target);
                break;
        }
    }

    // 적 근접 공격 효과
    playEnemyMeleeAttackEffect(enemy, target) {
        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y);

        // 공격 이펙트 (적의 경우 색상을 약간 다르게)
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

    // 적 원거리 공격 효과
    playEnemyRangedAttackEffect(enemy, target) {
        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y);

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

    // 적 마법 공격 효과
    playEnemyMagicAttackEffect(enemy, target) {
        // 공격 방향 계산
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, target.x, target.y);

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
    // 맞는 효과
    playHitEffect(target, damageType, isCritical = false, scale = 1.0) {
        // 타겟 위치
        const x = target.x;
        const y = target.y;

        // 대미지 타입에 따른 효과
        let particleColor = 'white';

        switch (damageType) {
            case 'physical':
                particleColor = 'red';
                break;
            case 'fire':
                particleColor = 'orange';
                break;
            case 'ice':
                particleColor = 'cyan';
                break;
            case 'lightning':
                particleColor = 'yellow';
                break;
            case 'poison':
                particleColor = 'green';
                break;
            case 'magic':
                particleColor = 'purple';
                break;
            default:
                particleColor = 'white';
                break;
        }

        // 히트 효과 크기 (크리티컬이면 더 크게)
        const hitScale = isCritical ? 1.5 : 1.0;

        // 히트 효과 생성
        this.createParticleEffect({
            x: x,
            y: y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.8 * hitScale * scale, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: 80 * hitScale,
            lifespan: 300,
            follow: null,
            quantity: isCritical ? 12 : 8,
            frequency: 100
        });

        // 대미지 타입에 따른 추가 효과
        switch (damageType) {
            case 'fire':
                // 화염 효과
                this.createParticleEffect({
                    x: x,
                    y: y,
                    texture: 'particle_star_orange',
                    scale: { start: 0.6 * scale, end: 0 },
                    alpha: { start: 0.7, end: 0 },
                    speed: 60,
                    lifespan: 500,
                    follow: null,
                    quantity: 6,
                    frequency: 50
                });
                break;
            case 'ice':
                // 얼음 결정 효과
                this.createParticleEffect({
                    x: x,
                    y: y,
                    texture: 'particle_diamond_cyan',
                    scale: { start: 0.5 * scale, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 40,
                    lifespan: 600,
                    follow: null,
                    quantity: 4,
                    frequency: 60
                });
                break;
            case 'lightning':
                // 번개 효과
                this.createParticleEffect({
                    x: x,
                    y: y,
                    texture: 'particle_star_yellow',
                    scale: { start: 0.7 * scale, end: 0 },
                    alpha: { start: 0.9, end: 0 },
                    speed: 100,
                    lifespan: 300,
                    follow: null,
                    quantity: 5,
                    frequency: 40
                });
                break;
            case 'magic':
                // 마법 효과
                this.createParticleEffect({
                    x: x,
                    y: y,
                    texture: 'particle_star_purple',
                    scale: { start: 0.6 * scale, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 70,
                    lifespan: 400,
                    follow: null,
                    quantity: 7,
                    frequency: 50
                });
                break;
        }

        // 타겟 스프라이트 효과 (피격 깜빡임)
        if (target.setTint) {
            // 대미지 타입에 따른 색상
            let tintColor = 0xff0000; // 기본 빨간색

            switch (damageType) {
                case 'fire':
                    tintColor = 0xff6600;
                    break;
                case 'ice':
                    tintColor = 0x00ffff;
                    break;
                case 'lightning':
                    tintColor = 0xffff00;
                    break;
                case 'poison':
                    tintColor = 0x00ff00;
                    break;
                case 'magic':
                    tintColor = 0xff00ff;
                    break;
            }

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
        if (isCritical) {
            this.playSound('critical');
        } else {
            this.playSound('hit');
        }
    }

    // 회피 효과
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

    // 체력 회복 효과
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

    // 넉백 효과
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

    // ======== 상태 효과 ========

    // 상태 효과 적용 시각화
    playStatusEffectApply(target, effectType) {
        // 효과 타입에 따른 파티클 설정
        let particleConfig = {
            texture: 'particle_circle_white',
            color: 'white',
            scale: 0.6,
            duration: 500
        };

        switch (effectType) {
            case 'burn':
                particleConfig.texture = 'particle_circle_orange';
                particleConfig.color = 'orange';
                break;
            case 'poison':
                particleConfig.texture = 'particle_circle_green';
                particleConfig.color = 'green';
                break;
            case 'slow':
                particleConfig.texture = 'particle_circle_cyan';
                particleConfig.color = 'cyan';
                break;
            case 'stun':
                particleConfig.texture = 'particle_star_yellow';
                particleConfig.color = 'yellow';
                break;
            case 'bleed':
                particleConfig.texture = 'particle_circle_red';
                particleConfig.color = 'red';
                break;
            case 'regeneration':
                particleConfig.texture = 'particle_circle_green';
                particleConfig.color = 'green';
                break;
        }

        // 적용 애니메이션 (대상 주변 회전 효과)
        const particleCount = 8;
        const radius = 30;

        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const x = target.x + Math.cos(angle) * radius;
            const y = target.y + Math.sin(angle) * radius;

            // 파티클 생성
            const particle = this.scene.add.image(x, y, particleConfig.texture)
                .setScale(0)
                .setAlpha(0);

            // 파티클이 생겨나고 중앙으로 모이는 애니메이션
            this.scene.tweens.add({
                targets: particle,
                x: target.x,
                y: target.y,
                scale: particleConfig.scale,
                alpha: 0.8,
                duration: particleConfig.duration,
                ease: 'Quad.out',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }

        // 대상에 적용되는 효과 (색상 변화)
        if (target.setTint) {
            switch (effectType) {
                case 'burn':
                    target.setTint(0xff6600);
                    break;
                case 'poison':
                    target.setTint(0x00ff00);
                    break;
                case 'slow':
                    target.setTint(0x00ffff);
                    break;
                case 'stun':
                    target.setTint(0xffff00);
                    break;
                case 'bleed':
                    target.setTint(0xff0000);
                    break;
            }

            // 0.3초 후 원래 색상으로 복원
            this.scene.time.delayedCall(300, () => {
                if (target.clearTint) {
                    target.clearTint();
                }
            });
        }

        // 효과음 재생
        this.playSound(effectType);
    }

    // 상태 효과 갱신 효과
    playStatusEffectRefresh(target, effectType) {
        // 간단한 갱신 효과
        let particleTexture;

        switch (effectType) {
            case 'burn':
                particleTexture = 'particle_star_orange';
                break;
            case 'poison':
                particleTexture = 'particle_star_green';
                break;
            case 'slow':
                particleTexture = 'particle_star_cyan';
                break;
            case 'stun':
                particleTexture = 'particle_star_yellow';
                break;
            case 'bleed':
                particleTexture = 'particle_star_red';
                break;
            case 'regeneration':
                particleTexture = 'particle_star_green';
                break;
            default:
                particleTexture = 'particle_star_white';
                break;
        }

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

    // 상태 효과 제거 효과
    playStatusEffectRemove(target, effectType) {
        // 색상 설정
        let particleColor;

        switch (effectType) {
            case 'burn':
                particleColor = 'orange';
                break;
            case 'poison':
                particleColor = 'green';
                break;
            case 'slow':
                particleColor = 'cyan';
                break;
            case 'stun':
                particleColor = 'yellow';
                break;
            case 'bleed':
                particleColor = 'red';
                break;
            case 'regeneration':
                particleColor = 'green';
                break;
            default:
                particleColor = 'white';
                break;
        }

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

    // 기절 효과
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

    // 빙결 효과
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

    // 화염 효과
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

    // ======== 방 효과 ========

    // 방 입장 효과
    playRoomEntranceEffect(x, y, roomType) {
        // 방 타입에 따라 다른 효과
        switch (roomType) {
            case 'entrance':
                // 입구 효과 (청록색 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_cyan', 1.0, 800);
                break;
            case 'treasure':
                // 보물방 효과 (황금색 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_yellow', 1.0, 800);
                this.createParticleEffect({
                    x: x,
                    y: y,
                    texture: 'particle_star_yellow',
                    scale: { start: 0.2, end: 0.5 },
                    alpha: { start: 0.9, end: 0 },
                    speed: 50,
                    lifespan: 1000,
                    follow: null,
                    quantity: 10,
                    frequency: 50
                });
                break;
            case 'merchant':
                // 상인방 효과 (분홍색 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_purple', 0.8, 800);
                break;
            case 'shrine':
                // 신단방 효과 (녹색 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_green', 0.8, 800);
                break;
            case 'boss':
                // 보스방 효과 (빨간색 어두운 효과)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_red', 0.8, 1000);

                // 추가 이펙트 (위험 느낌의 붉은 번쩍임)
                for (let i = 0; i < 3; i++) {
                    this.scene.time.delayedCall(i * 300, () => {
                        this.createParticleEffect({
                            x: x,
                            y: y,
                            texture: 'particle_circle_red',
                            scale: { start: 0.1, end: 2.0 },
                            alpha: { start: 0.2, end: 0 },
                            speed: 0,
                            lifespan: 300,
                            follow: null,
                            quantity: 1,
                            frequency: 1
                        });
                    });
                }
                break;
            default:
                // 일반 방 효과 (흰색 작은 빛)
                this.createCircularAuraEffect({ x, y }, 'particle_circle_white', 0.6, 500);
                break;
        }
    }

    // 웨이브 시작 효과
    playWaveStartEffect(x, y) {
        // 경고 사운드
        this.playSound('alert', { volume: 0.6 });

        // 파동 효과 (붉은 원)
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_circle_red',
            scale: { start: 0.1, end: 3.0 },
            alpha: { start: 0.5, end: 0 },
            speed: 0,
            lifespan: 1000,
            follow: null,
            quantity: 1,
            frequency: 1
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
                x: spawnX,
                y: spawnY,
                texture: 'particle_circle_red',
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.8, end: 0 },
                speed: 20,
                lifespan: 800,
                follow: null,
                quantity: 10,
                frequency: 100
            });
        }

        // 카메라 효과
        this.scene.cameras.main.shake(500, 0.005);
    }

    // 적 스폰 효과
    playEnemySpawnEffect(enemy) {
        // 스폰 시각 효과
        this.createParticleEffect({
            x: enemy.x,
            y: enemy.y,
            texture: 'particle_circle_red',
            scale: { start: 0.1, end: 1.0 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 500,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 연기 효과
        this.createParticleEffect({
            x: enemy.x,
            y: enemy.y,
            texture: 'particle_circle_white',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.4, end: 0 },
            speed: 30,
            lifespan: 600,
            follow: null,
            quantity: 8,
            frequency: 50
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

    // 적 사망 효과
    playDeathEffect(entity) {
        // 사망 파티클
        const particleColor = entity.team === 'player' ? 'blue' : 'red';

        // 파티클 폭발 효과
        this.createParticleEffect({
            x: entity.x,
            y: entity.y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: 50,
            lifespan: 800,
            follow: null,
            quantity: 15,
            frequency: 50
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

    // 플레이어 사망 효과
    playPlayerDeathEffect(player) {
        // 특별한 사망 효과 (더 극적으로)

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
            x: player.x,
            y: player.y,
            texture: 'particle_circle_blue',
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.9, end: 0 },
            speed: 100,
            lifespan: 1500,
            follow: null,
            quantity: 30,
            frequency: 50
        });

        // 영혼 상승 효과
        this.scene.time.delayedCall(500, () => {
            this.createParticleEffect({
                x: player.x,
                y: player.y,
                texture: 'particle_circle_cyan',
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.7, end: 0 },
                speed: { min: 10, max: 30 },
                lifespan: 2000,
                gravityY: -50, // 상승 효과
                follow: null,
                quantity: 20,
                frequency: 50
            });
        });

        // 사망 효과음
        this.playSound('player_death');
    }

    // 부활 효과
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
            x: entity.x,
            y: entity.y,
            texture: 'particle_star_yellow',
            scale: { start: 0.2, end: 0.8 },
            alpha: { start: 0.9, end: 0 },
            speed: { min: 50, max: 100 },
            lifespan: 1500,
            follow: null,
            quantity: 20,
            frequency: 50
        });

        // 빛 기둥 효과
        for (let i = 0; i < 5; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x: entity.x,
                    y: entity.y - 50,
                    texture: 'particle_circle_white',
                    scale: { start: 0.1, end: 0.5 },
                    alpha: { start: 0.8, end: 0 },
                    speed: { min: 0, max: 10 },
                    lifespan: 800,
                    gravityY: -100, // 위로 올라가는 효과
                    follow: null,
                    quantity: 5,
                    frequency: 50
                });
            });
        }

        // 카메라 효과
        this.scene.cameras.main.flash(500, 255, 255, 255, true);

        // 효과음 재생
        this.playSound('revive');
    }

    // ======== 아이템 효과 ========

    // 보물 상자 열기 효과
    playChestOpenEffect(x, y, rarity) {
        // 희귀도에 따른 색상
        let particleColor = 'white';

        switch (rarity) {
            case 'uncommon':
                particleColor = 'green';
                break;
            case 'rare':
                particleColor = 'blue';
                break;
            case 'epic':
                particleColor = 'purple';
                break;
            case 'legendary':
                particleColor = 'orange';
                break;
            case 'mythic':
                particleColor = 'red';
                break;
            default:
                particleColor = 'white';
                break;
        }

        // 빛 폭발 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.1, end: 1.5 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 500,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 빛나는 파티클 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.9, end: 0 },
            speed: { min: 30, max: 80 },
            lifespan: 1000,
            follow: null,
            quantity: 15,
            frequency: 50
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
                    x: x,
                    y: y,
                    texture: `particle_star_${particleColor}`,
                    scale: { start: 0.2, end: 0.6 },
                    alpha: { start: 0.9, end: 0 },
                    speed: { min: 20, max: 60 },
                    lifespan: 1500,
                    follow: null,
                    quantity: 10,
                    frequency: 50
                });
            });

            // 특별 효과음
            this.playSound('legendary_item');
        }
    }

    // 아이템 획득 효과
    playItemAcquireEffect(x, y, rarity) {
        // 희귀도에 따른 색상
        let particleColor = 'white';

        switch (rarity) {
            case 'uncommon':
                particleColor = 'green';
                break;
            case 'rare':
                particleColor = 'blue';
                break;
            case 'epic':
                particleColor = 'purple';
                break;
            case 'legendary':
                particleColor = 'orange';
                break;
            case 'mythic':
                particleColor = 'red';
                break;
            default:
                particleColor = 'white';
                break;
        }

        // 아이템 획득 파티클
        this.createParticleEffect({
            x: x,
            y: y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 30, max: 60 },
            lifespan: 800,
            follow: null,
            quantity: 8,
            frequency: 50
        });

        // 위로 올라가는 빛 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.7, end: 0 },
            speed: { min: 10, max: 30 },
            lifespan: 1000,
            gravityY: -50, // 위로 올라가는 효과
            follow: null,
            quantity: 5,
            frequency: 100
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

    // 아이템 드롭 효과
    playItemDropEffect(x, y, rarity) {
        // 희귀도에 따른 색상
        let particleColor = 'white';

        switch (rarity) {
            case 'uncommon':
                particleColor = 'green';
                break;
            case 'rare':
                particleColor = 'blue';
                break;
            case 'epic':
                particleColor = 'purple';
                break;
            case 'legendary':
                particleColor = 'orange';
                break;
            case 'mythic':
                particleColor = 'red';
                break;
            default:
                particleColor = 'white';
                break;
        }

        // 드롭 효과 (떨어지는 느낌)
        this.createParticleEffect({
            x: x,
            y: y - 20,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 30, max: 50 },
            lifespan: 500,
            gravityY: 100, // 아래로 떨어지는 효과
            follow: null,
            quantity: 5,
            frequency: 50
        });

        // 빛 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.1, end: 0.8 },
            alpha: { start: 0.9, end: 0 },
            speed: 0,
            lifespan: 500,
            follow: null,
            quantity: 1,
            frequency: 1
        });
    }

    // 아이템 획득 폭발 효과
    playItemPickupEffect(x, y, rarity) {
        // 희귀도에 따른 색상
        let particleColor = 'white';

        switch (rarity) {
            case 'uncommon':
                particleColor = 'green';
                break;
            case 'rare':
                particleColor = 'blue';
                break;
            case 'epic':
                particleColor = 'purple';
                break;
            case 'legendary':
                particleColor = 'orange';
                break;
            case 'mythic':
                particleColor = 'red';
                break;
            default:
                particleColor = 'white';
                break;
        }

        // 획득 파티클 폭발
        this.createParticleEffect({
            x: x,
            y: y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: 50,
            lifespan: 500,
            follow: null,
            quantity: 10,
            frequency: 50
        });

        // 효과음 재생
        this.playSound('item_pickup');
    }

    // 포션 효과
    playPotionEffect(target, potionType) {
        // 포션 타입에 따른 색상
        let particleColor;

        switch (potionType) {
            case 'health':
                particleColor = 'red';
                break;
            case 'mana':
                particleColor = 'blue';
                break;
            case 'strength':
                particleColor = 'orange';
                break;
            case 'defense':
                particleColor = 'cyan';
                break;
            case 'speed':
                particleColor = 'yellow';
                break;
            default:
                particleColor = 'green';
                break;
        }

        // 포션 효과 (상승하는 입자)
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: `particle_circle_${particleColor}`,
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 40 },
            lifespan: 1000,
            gravityY: -40, // 위로 올라가는 효과
            follow: target,
            quantity: 10,
            frequency: 50
        });

        // 오라 효과
        this.createCircularAuraEffect(target, `particle_circle_${particleColor}`, 0.7, 500);

        // 효과음 재생
        this.playSound('potion');
    }

    // 스크롤 효과
    playScrollEffect(target, scrollType) {
        // 스크롤 타입에 따른 색상
        let particleColor;

        switch (scrollType) {
            case 'teleport':
                particleColor = 'cyan';
                break;
            case 'identify':
                particleColor = 'white';
                break;
            case 'enchant':
                particleColor = 'purple';
                break;
            case 'fireball':
                particleColor = 'orange';
                break;
            case 'frost':
                particleColor = 'cyan';
                break;
            case 'lightning':
                particleColor = 'yellow';
                break;
            case 'healing':
                particleColor = 'green';
                break;
            case 'protection':
                particleColor = 'blue';
                break;
            default:
                particleColor = 'white';
                break;
        }

        // 스크롤 사용 효과 (마법 문자 파티클)
        this.createParticleEffect({
            x: target.x,
            y: target.y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: 60,
            lifespan: 800,
            follow: null,
            quantity: 15,
            frequency: 50
        });

        // 효과음 재생
        this.playSound('scroll');
    }

    // 레거시 아이템 효과
    playLegacyItemEffect(x, y) {
        // 특별한 레거시 아이템 효과 (극적인 빛 폭발)

        // 카메라 효과
        this.scene.cameras.main.flash(800, 255, 255, 255, true);

        // 빛 기둥 효과
        for (let i = 0; i < 10; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x: x,
                    y: y - i * 10,
                    texture: 'particle_circle_white',
                    scale: { start: 0.1, end: 1.0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0,
                    lifespan: 500,
                    follow: null,
                    quantity: 1,
                    frequency: 1
                });
            });
        }

        // 무지개 입자 효과
        const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];

        for (let i = 0; i < colors.length; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x: x,
                    y: y,
                    texture: `particle_star_${colors[i]}`,
                    scale: { start: 0.2, end: 0.8 },
                    alpha: { start: 0.9, end: 0 },
                    speed: 50 + i * 10,
                    lifespan: 1500,
                    follow: null,
                    quantity: 10,
                    frequency: 50
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

    // 보상 효과
    playRewardEffect(x, y) {
        // 보상 효과 (빛나는 금색 파티클)
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_circle_yellow',
            scale: { start: 0.1, end: 1.5 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 800,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 금 입자 폭발
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_star_yellow',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.9, end: 0 },
            speed: { min: 30, max: 80 },
            lifespan: 1200,
            follow: null,
            quantity: 20,
            frequency: 50
        });

        // 효과음 재생
        this.playSound('reward');
    }

    // ======== 함정 및 환경 효과 ========

    // 함정 효과
    playTrapEffect(x, y, trapType) {
        switch (trapType) {
            case 'spike':
                this.playSpikeEffect(x, y);
                break;
            case 'poison':
                this.playPoisonTrapEffect(x, y);
                break;
            case 'fire':
                this.playFireTrapEffect(x, y);
                break;
            case 'frost':
                this.playFrostTrapEffect(x, y);
                break;
            default:
                this.playDefaultTrapEffect(x, y);
                break;
        }
    }

    // 가시 함정 효과
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
                x: endX,
                y: endY,
                texture: 'particle_circle_red',
                scale: { start: 0.3, end: 0 },
                alpha: { start: 0.8, end: 0 },
                speed: 20,
                lifespan: 500,
                follow: null,
                quantity: 3,
                frequency: 50
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

    // 독 함정 효과
    playPoisonTrapEffect(x, y) {
        // 녹색 연기 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_circle_green',
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.7, end: 0 },
            speed: { min: 20, max: 50 },
            lifespan: 1000,
            follow: null,
            quantity: 20,
            frequency: 100
        });

        // 효과음 재생
        this.playSound('trap_poison');
    }

    // 화염 함정 효과
    playFireTrapEffect(x, y) {
        // 화염 폭발 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_circle_orange',
            scale: { start: 0.1, end: 1.0 },
            alpha: { start: 0.8, end: 0 },
            speed: 0,
            lifespan: 300,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 불꽃 파티클
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_circle_orange',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 30, max: 80 },
            lifespan: 800,
            follow: null,
            quantity: 15,
            frequency: 50
        });

        // 연기 효과
        this.scene.time.delayedCall(200, () => {
            this.createParticleEffect({
                x: x,
                y: y - 10,
                texture: 'particle_circle_white',
                scale: { start: 0.4, end: 0 },
                alpha: { start: 0.3, end: 0 },
                speed: { min: 10, max: 30 },
                lifespan: 1000,
                gravityY: -30, // 위로 올라가는 연기
                follow: null,
                quantity: 10,
                frequency: 100
            });
        });

        // 효과음 재생
        this.playSound('trap_fire');
    }

    // 얼음 함정 효과
    playFrostTrapEffect(x, y) {
        // 얼음 결정 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_diamond_cyan',
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.8, end: 0 },
            speed: { min: 20, max: 50 },
            lifespan: 800,
            follow: null,
            quantity: 15,
            frequency: 50
        });

        // 차가운 안개 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_circle_cyan',
            scale: { start: 0.3, end: 1.0 },
            alpha: { start: 0.5, end: 0 },
            speed: { min: 10, max: 30 },
            lifespan: 1200,
            follow: null,
            quantity: 10,
            frequency: 100
        });

        // 효과음 재생
        this.playSound('trap_frost');
    }

    // 기본 함정 효과
    playDefaultTrapEffect(x, y) {
        // 간단한 함정 작동 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_circle_white',
            scale: { start: 0.1, end: 1.0 },
            alpha: { start: 0.7, end: 0 },
            speed: 0,
            lifespan: 300,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 효과음 재생
        this.playSound('trap_generic');
    }

    // 화살 함정 효과
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

    // 지면 균열 효과
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
            x: x,
            y: y,
            texture: 'particle_circle_white',
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.3, end: 0 },
            speed: 30,
            lifespan: 500,
            follow: null,
            quantity: 10,
            frequency: 50
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

    // 신단 활성화 효과
    playShrineActivateEffect(x, y, shrineType) {
        // 신단 타입에 따른 색상
        let particleColor;

        switch (shrineType) {
            case 'health':
                particleColor = 'red';
                break;
            case 'strength':
                particleColor = 'orange';
                break;
            case 'defense':
                particleColor = 'blue';
                break;
            case 'speed':
                particleColor = 'yellow';
                break;
            case 'mana':
                particleColor = 'purple';
                break;
            default:
                particleColor = 'white';
                break;
        }

        // 신단 활성화 효과 (빛 기둥)
        for (let i = 0; i < 5; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x: x,
                    y: y - i * 20,
                    texture: `particle_circle_${particleColor}`,
                    scale: { start: 0.8, end: 0 },
                    alpha: { start: 0.8, end: 0 },
                    speed: 0,
                    lifespan: 500,
                    follow: null,
                    quantity: 1,
                    frequency: 1
                });
            });
        }

        // 주변 파티클 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: `particle_star_${particleColor}`,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.9, end: 0 },
            speed: { min: 30, max: 80 },
            lifespan: 1000,
            follow: null,
            quantity: 20,
            frequency: 50
        });

        // 효과음 재생
        this.playSound('shrine_activate');
    }

    // 던전 완료 효과
    playDungeonCompletedEffect(player) {
        // 던전 완료 효과 (빛의 폭발)
        const x = player.x;
        const y = player.y;

        // 카메라 효과
        this.scene.cameras.main.flash(1000, 255, 255, 255, true);

        // 강렬한 빛 효과
        this.createParticleEffect({
            x: x,
            y: y,
            texture: 'particle_circle_white',
            scale: { start: 0.1, end: 3.0 },
            alpha: { start: 0.9, end: 0 },
            speed: 0,
            lifespan: 1000,
            follow: null,
            quantity: 1,
            frequency: 1
        });

        // 무지개 색 파티클 (승리 축하)
        const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];

        for (let i = 0; i < colors.length; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.createParticleEffect({
                    x: x,
                    y: y,
                    texture: `particle_star_${colors[i]}`,
                    scale: { start: 0.3, end: 0 },
                    alpha: { start: 0.9, end: 0 },
                    speed: 100,
                    lifespan: 1500,
                    follow: null,
                    quantity: 10,
                    frequency: 50
                });
            });
        }

        // 효과음 재생
        this.playSound('dungeon_complete');
        this.scene.time.delayedCall(500, () => {
            this.playSound('victory_fanfare');
        });
    }

    // ======== 유틸리티 메서드 ========

    // 파티클 이펙트 생성
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

    // 원형 오라 효과
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

    // 투사체 효과
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

    // 멀티샷 효과
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