// src/ui/HUD.js

import config from '../utils/Config';

/**
 * 게임 HUD(Heads-Up Display) 관리 클래스
 * 플레이어 스탯 바, 스킬 슬롯, 미니맵 등 게임 내 UI 요소 관리
 */
class HUD {
    /**
     * HUD 생성자
     * @param {Phaser.Scene} scene - 현재 씬
     */
    constructor(scene) {
        this.scene = scene;
        this.config = config;
        
        // HUD 컨테이너 생성
        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(100); // UI는 항상 최상위에 표시
        
        // HUD 구성 요소
        this.components = {
            statsBar: null,
            skillBar: null,
            minimap: null,
            bossBar: null,
            statusIcons: null,
            comboCounter: null,
            damageNumbers: [],
            notificationContainer: null,
            timeDisplay: null
        };
        
        // HUD 설정
        this.settings = {
            statsBarHeight: 40,
            skillBarHeight: 60,
            minimapSize: config.get('ui', 'minimapSize', 150),
            minimapOpacity: config.get('ui', 'minimapOpacity', 0.7),
            statusIconSize: 24,
            notificationDuration: 3000,
            damageNumberRiseDistance: config.get('effects', 'damageNumberRiseDistance', 30),
            damageNumberLifetime: config.get('effects', 'damageNumberLifetime', 1000)
        };
        
        // 알림 큐
        this.notificationQueue = [];
        this.notificationActive = false;
        
        // 초기화
        this.initialize();
    }
    
    /**
     * HUD 초기화
     */
    initialize() {
        this.createStatsBar();
        this.createSkillBar();
        this.createConsumableBar();
        this.createStatusIcons();
        this.createComboCounter();
        this.createTimeDisplay();
        this.createNotificationContainer();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 화면 크기 변경 대응
        this.scene.scale.on('resize', this.onResize, this);
        this.adjustToScreenSize();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 플레이어 스탯 변경 이벤트
        if (this.scene.events) {
            this.scene.events.on('playerStatsChanged', this.updateStatsBar, this);
            this.scene.events.on('skillCooldownChanged', this.updateSkillCooldown, this);
            this.scene.events.on('comboChanged', this.updateComboCounter, this);
            this.scene.events.on('statusEffectChanged', this.updateStatusIcons, this);
            this.scene.events.on('roomChanged', this.updateMinimap, this);
            this.scene.events.on('timeUpdated', this.updateTimeDisplay, this);
            this.scene.events.on('bossHealthChanged', this.updateBossBar, this);
        }
        
        // 씬 종료 시 이벤트 해제
        this.scene.events.once('shutdown', this.destroy, this);
    }
    
    /**
     * 플레이어 스탯 바 생성 (HP/MP)
     */
    createStatsBar() {
        const { width, height } = this.scene.scale;
        const barHeight = this.settings.statsBarHeight;
        
        // 컨테이너 생성
        const statsBar = this.scene.add.container(10, 10);
        
        // 배경
        const bg = this.scene.add.rectangle(0, 0, 300, barHeight, 0x000000, 0.7);
        bg.setOrigin(0, 0);
        statsBar.add(bg);
        
        // HP 바
        const hpBar = this.scene.add.rectangle(5, 5, 290, (barHeight / 2) - 7, 0xE74C3C);
        hpBar.setOrigin(0, 0);
        statsBar.add(hpBar);
        
        // MP 바
        const mpBar = this.scene.add.rectangle(5, (barHeight / 2) + 2, 290, (barHeight / 2) - 7, 0x3498DB);
        mpBar.setOrigin(0, 0);
        statsBar.add(mpBar);
        
        // HP 텍스트
        const hpText = this.scene.add.text(150, 5 + ((barHeight / 2) - 7) / 2, 'HP: 100/100', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').normal,
            color: '#FFFFFF'
        });
        hpText.setOrigin(0.5, 0.5);
        statsBar.add(hpText);
        
        // MP 텍스트
        const mpText = this.scene.add.text(150, (barHeight / 2) + 2 + ((barHeight / 2) - 7) / 2, 'MP: 50/50', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').normal,
            color: '#FFFFFF'
        });
        mpText.setOrigin(0.5, 0.5);
        statsBar.add(mpText);
        
        // 참조 저장
        statsBar.hp = { bar: hpBar, text: hpText };
        statsBar.mp = { bar: mpBar, text: mpText };
        
        this.components.statsBar = statsBar;
        this.container.add(statsBar);
    }
    
    /**
     * 스킬 바 생성
     */
    createSkillBar() {
        const { width, height } = this.scene.scale;
        const barHeight = this.settings.skillBarHeight;
        const skillSlots = config.get('player', 'skillSlots', 4);
        
        // 컨테이너 생성
        const skillBar = this.scene.add.container(width / 2, height - barHeight - 10);
        skillBar.setDepth(100);
        
        // 스킬 슬롯 배열
        const slots = [];
        const slotSize = 50;
        const slotMargin = 10;
        const totalWidth = (slotSize + slotMargin) * skillSlots - slotMargin;
        
        for (let i = 0; i < skillSlots; i++) {
            const x = (i * (slotSize + slotMargin)) - (totalWidth / 2) + (slotSize / 2);
            const slotBg = this.scene.add.rectangle(x, 0, slotSize, slotSize, 0x000000, 0.7);
            slotBg.setStrokeStyle(2, 0xFFFFFF, 0.5);
            
            const icon = this.scene.add.rectangle(x, 0, slotSize - 6, slotSize - 6, 0x666666);
            
            const keyText = this.scene.add.text(x + (slotSize / 2) - 10, -(slotSize / 2) + 10, this.getSkillKeyText(i), {
                fontFamily: config.get('ui', 'fontFamily'),
                fontSize: config.get('ui', 'fontSize').small,
                color: '#FFFFFF'
            });
            
            const cooldownOverlay = this.scene.add.rectangle(x, 0, slotSize - 6, slotSize - 6, 0x000000, 0.7);
            cooldownOverlay.visible = false;
            
            const cooldownText = this.scene.add.text(x, 0, '', {
                fontFamily: config.get('ui', 'fontFamily'),
                fontSize: config.get('ui', 'fontSize').normal,
                color: '#FFFFFF'
            });
            cooldownText.setOrigin(0.5, 0.5);
            cooldownText.visible = false;
            
            // 슬롯 데이터 저장
            const slotData = {
                background: slotBg,
                icon: icon,
                keyText: keyText,
                cooldownOverlay: cooldownOverlay,
                cooldownText: cooldownText,
                skillInfo: null,
                progress: 0
            };
            
            slots.push(slotData);
            
            // 컨테이너에 추가
            skillBar.add(slotBg);
            skillBar.add(icon);
            skillBar.add(keyText);
            skillBar.add(cooldownOverlay);
            skillBar.add(cooldownText);
        }
        
        // 참조 저장
        skillBar.slots = slots;
        
        this.components.skillBar = skillBar;
        this.container.add(skillBar);
    }
    
    /**
     * 소비 아이템 바 생성
     */
    createConsumableBar() {
        const { width, height } = this.scene.scale;
        const barHeight = this.settings.skillBarHeight;
        const consumableSlots = config.get('player', 'consumableSlots', 4);
        
        // 컨테이너 생성
        const consumableBar = this.scene.add.container(width - 10, height - barHeight - 10);
        consumableBar.setDepth(100);
        
        // 슬롯 배열
        const slots = [];
        const slotSize = 40;
        const slotMargin = 10;
        const totalWidth = (slotSize + slotMargin) * consumableSlots - slotMargin;
        
        for (let i = 0; i < consumableSlots; i++) {
            const x = -totalWidth + (i * (slotSize + slotMargin)) + (slotSize / 2);
            const slotBg = this.scene.add.rectangle(x, 0, slotSize, slotSize, 0x000000, 0.7);
            slotBg.setStrokeStyle(2, 0xFFFFFF, 0.5);
            
            const icon = this.scene.add.rectangle(x, 0, slotSize - 6, slotSize - 6, 0x666666);
            
            const keyText = this.scene.add.text(x + (slotSize / 2) - 5, -(slotSize / 2) + 10, (i + 1).toString(), {
                fontFamily: config.get('ui', 'fontFamily'),
                fontSize: config.get('ui', 'fontSize').small,
                color: '#FFFFFF'
            });
            
            const countText = this.scene.add.text(x + (slotSize / 2) - 10, (slotSize / 2) - 10, '0', {
                fontFamily: config.get('ui', 'fontFamily'),
                fontSize: config.get('ui', 'fontSize').small,
                color: '#FFFFFF'
            });
            
            // 슬롯 데이터 저장
            const slotData = {
                background: slotBg,
                icon: icon,
                keyText: keyText,
                countText: countText,
                itemInfo: null
            };
            
            slots.push(slotData);
            
            // 컨테이너에 추가
            consumableBar.add(slotBg);
            consumableBar.add(icon);
            consumableBar.add(keyText);
            consumableBar.add(countText);
        }
        
        // 참조 저장
        consumableBar.slots = slots;
        
        this.components.consumableBar = consumableBar;
        this.container.add(consumableBar);
    }
    
    /**
     * 스킬 키 텍스트 가져오기
     * @param {number} index - 스킬 인덱스
     * @returns {string} 키 텍스트
     */
    getSkillKeyText(index) {
        const keyMap = ['Q', 'R', 'F', 'C'];
        
        // 설정된 키 확인
        const configKeys = ['skill1', 'skill2', 'skill3', 'skill4'];
        if (index < configKeys.length) {
            const configKey = config.get('keys', configKeys[index]);
            if (configKey) {
                return configKey;
            }
        }
        
        return keyMap[index] || '';
    }
    
    /**
     * 미니맵 생성
     * @param {Object} dungeon - 던전 데이터
     */
    createMinimap(dungeon) {
        const { width, height } = this.scene.scale;
        const minimapSize = this.settings.minimapSize;
        
        // 이전 미니맵 제거
        if (this.components.minimap) {
            this.components.minimap.destroy();
        }
        
        // 컨테이너 생성
        const minimap = this.scene.add.container(width - minimapSize / 2 - 10, minimapSize / 2 + 10);
        
        // 배경
        const bg = this.scene.add.rectangle(0, 0, minimapSize, minimapSize, 0x000000, this.settings.minimapOpacity);
        bg.setStrokeStyle(2, 0xFFFFFF, 0.5);
        minimap.add(bg);
        
        // 방 그룹
        const roomGroup = this.scene.add.container(0, 0);
        minimap.add(roomGroup);
        
        // 플레이어 아이콘
        const playerIcon = this.scene.add.circle(0, 0, 3, 0xFFFFFF);
        minimap.add(playerIcon);
        
        // 미니맵 데이터 저장
        minimap.roomGroup = roomGroup;
        minimap.playerIcon = playerIcon;
        minimap.dungeon = dungeon;
        minimap.discovered = {}; // 발견된 방
        
        this.components.minimap = minimap;
        this.container.add(minimap);
    }
    
    /**
     * 상태 아이콘 컨테이너 생성
     */
    createStatusIcons() {
        const statusContainer = this.scene.add.container(10, this.settings.statsBarHeight + 20);
        
        // 아이콘 배열
        statusContainer.icons = [];
        
        this.components.statusIcons = statusContainer;
        this.container.add(statusContainer);
    }
    
    /**
     * 콤보 카운터 생성
     */
    createComboCounter() {
        const { width, height } = this.scene.scale;
        
        // 컨테이너 생성
        const comboCounter = this.scene.add.container(width / 2, height / 2 - 100);
        comboCounter.setVisible(false);
        
        // 카운터 텍스트
        const comboText = this.scene.add.text(0, 0, '0 COMBO', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').header,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        });
        comboText.setOrigin(0.5, 0.5);
        comboCounter.add(comboText);
        
        // 콤보 배수 텍스트
        const multiplierText = this.scene.add.text(0, 30, 'x1.0', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').normal,
            color: '#FFDD00',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        multiplierText.setOrigin(0.5, 0.5);
        comboCounter.add(multiplierText);
        
        // 참조 저장
        comboCounter.comboText = comboText;
        comboCounter.multiplierText = multiplierText;
        comboCounter.value = 0;
        comboCounter.multiplier = 1;
        comboCounter.timer = null;
        
        this.components.comboCounter = comboCounter;
        this.container.add(comboCounter);
    }
    
    /**
     * 시간 표시 컴포넌트 생성
     */
    createTimeDisplay() {
        const { width, height } = this.scene.scale;
        
        // 컨테이너 생성
        const timeDisplay = this.scene.add.container(width / 2, 20);
        
        // 시간 텍스트
        const timeText = this.scene.add.text(0, 0, '00:00', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').large,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        timeText.setOrigin(0.5, 0.5);
        timeDisplay.add(timeText);
        
        // 참조 저장
        timeDisplay.timeText = timeText;
        timeDisplay.elapsedTime = 0;
        
        this.components.timeDisplay = timeDisplay;
        this.container.add(timeDisplay);
    }
    
    /**
     * 알림 컨테이너 생성
     */
    createNotificationContainer() {
        const { width, height } = this.scene.scale;
        
        // 컨테이너 생성
        const notificationContainer = this.scene.add.container(width / 2, height / 4);
        
        // 배경
        const bg = this.scene.add.rectangle(0, 0, 400, 50, 0x000000, 0.7);
        bg.setStrokeStyle(2, 0xFFFFFF, 0.5);
        bg.setVisible(false);
        notificationContainer.add(bg);
        
        // 텍스트
        const text = this.scene.add.text(0, 0, '', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').large,
            color: '#FFFFFF',
            align: 'center'
        });
        text.setOrigin(0.5, 0.5);
        text.setVisible(false);
        notificationContainer.add(text);
        
        // 참조 저장
        notificationContainer.bg = bg;
        notificationContainer.text = text;
        
        this.components.notificationContainer = notificationContainer;
        this.container.add(notificationContainer);
    }
    
    /**
     * 보스 체력바 생성
     * @param {Object} boss - 보스 객체
     */
    createBossBar(boss) {
        const { width, height } = this.scene.scale;
        
        // 이전 보스바 제거
        if (this.components.bossBar) {
            this.components.bossBar.destroy();
        }
        
        if (!boss) {
            return;
        }
        
        // 컨테이너 생성
        const bossBar = this.scene.add.container(width / 2, 60);
        
        // 보스 이름 표시
        const bossName = this.scene.add.text(0, -20, boss.name || '보스', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').large,
            color: '#FF0000',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        bossName.setOrigin(0.5, 0.5);
        bossBar.add(bossName);
        
        // 체력바 배경
        const barWidth = 400;
        const barHeight = 20;
        const barBg = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x000000, 0.7);
        barBg.setStrokeStyle(2, 0xFFFFFF, 0.8);
        bossBar.add(barBg);
        
        // 체력바
        const healthBar = this.scene.add.rectangle(-barWidth / 2, -barHeight / 2, barWidth, barHeight, 0xFF0000);
        healthBar.setOrigin(0, 0);
        bossBar.add(healthBar);
        
        // 체력 텍스트
        const healthText = this.scene.add.text(0, 0, `${boss.hp}/${boss.maxHp}`, {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').normal,
            color: '#FFFFFF',
            align: 'center'
        });
        healthText.setOrigin(0.5, 0.5);
        bossBar.add(healthText);
        
        // 보스 상태 아이콘 (선택적)
        const bossPhaseIcon = this.scene.add.container(barWidth / 2 + 20, 0);
        bossBar.add(bossPhaseIcon);
        
        // 참조 저장
        bossBar.boss = boss;
        bossBar.healthBar = healthBar;
        bossBar.healthText = healthText;
        bossBar.phaseIcon = bossPhaseIcon;
        
        this.components.bossBar = bossBar;
        this.container.add(bossBar);
    }
    
    /**
     * 대미지 숫자 생성
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} damage - 대미지 값
     * @param {string} type - 대미지 타입 (normal, critical, heal, mana)
     */
    createDamageNumber(x, y, damage, type = 'normal') {
        const { width, height } = this.scene.scale;
        
        // 최대 대미지 숫자 제한
        if (this.components.damageNumbers.length > 20) {
            const oldestNumber = this.components.damageNumbers.shift();
            oldestNumber.destroy();
        }
        
        // 대미지 색상
        const colors = config.get('ui', 'damageColors');
        const color = colors[type] || colors.normal;
        
        // 폰트 설정
        let fontSize = config.get('ui', 'damageFontSize');
        let fontStyle = { 
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: fontSize,
            color: color,
            stroke: '#000000',
            strokeThickness: 3
        };
        
        // 치명타는 더 크게 표시
        if (type === 'critical') {
            fontSize *= 1.5;
            fontStyle.fontSize = fontSize;
        }
        
        // 대미지 텍스트 생성
        let displayValue = damage;
        if (type === 'heal') {
            displayValue = '+' + damage;
        } else if (damage > 0) {
            displayValue = '-' + damage;
        }
        
        const damageText = this.scene.add.text(x, y, displayValue.toString(), fontStyle);
        damageText.setOrigin(0.5, 0.5);
        damageText.setDepth(200); // 대미지 숫자는 항상 최상위에
        
        // 상승 및 페이드 아웃 애니메이션
        this.scene.tweens.add({
            targets: damageText,
            y: y - this.settings.damageNumberRiseDistance,
            alpha: 0,
            duration: this.settings.damageNumberLifetime,
            ease: 'Power1',
            onComplete: () => {
                // 대미지 숫자 제거
                const index = this.components.damageNumbers.indexOf(damageText);
                if (index !== -1) {
                    this.components.damageNumbers.splice(index, 1);
                }
                damageText.destroy();
            }
        });
        
        // 치명타는 좌우 흔들림 추가
        if (type === 'critical') {
            this.scene.tweens.add({
                targets: damageText,
                x: { from: x - 5, to: x + 5 },
                duration: 50,
                yoyo: true,
                repeat: 3
            });
        }
        
        // 배열에 추가
        this.components.damageNumbers.push(damageText);
    }
    
    /**
     * 플레이어 스탯 바 업데이트
     * @param {Object} stats - 플레이어 스탯
     */
    updateStatsBar(stats) {
        if (!this.components.statsBar) return;
        
        const statsBar = this.components.statsBar;
        
        // 체력 업데이트
        if (stats.hp !== undefined && stats.maxHp !== undefined) {
            const hpRatio = Math.max(0, Math.min(1, stats.hp / stats.maxHp));
            statsBar.hp.bar.width = 290 * hpRatio;
            statsBar.hp.text.setText(`HP: ${Math.ceil(stats.hp)}/${stats.maxHp}`);
            
            // 낮은 체력 경고 효과
            if (hpRatio < 0.3) {
                statsBar.hp.bar.fillColor = 0xFF0000;
                
                // 깜빡임 효과
                if (!statsBar.hp.blinkTween) {
                    statsBar.hp.blinkTween = this.scene.tweens.add({
                        targets: statsBar.hp.bar,
                        alpha: { from: 1, to: 0.5 },
                        duration: 500,
                        yoyo: true,
                        repeat: -1
                    });
                }
            } else {
                statsBar.hp.bar.fillColor = 0xE74C3C;
                
                // 깜빡임 효과 제거
                if (statsBar.hp.blinkTween) {
                    statsBar.hp.blinkTween.stop();
                    statsBar.hp.blinkTween = null;
                    statsBar.hp.bar.alpha = 1;
                }
            }
        }
        
        // 마나 업데이트
        if (stats.mp !== undefined && stats.maxMp !== undefined) {
            const mpRatio = Math.max(0, Math.min(1, stats.mp / stats.maxMp));
            statsBar.mp.bar.width = 290 * mpRatio;
            statsBar.mp.text.setText(`MP: ${Math.ceil(stats.mp)}/${stats.maxMp}`);
        }
    }
    
    /**
     * 스킬 슬롯 업데이트
     * @param {Array} skills - 플레이어 스킬 배열
     */
    updateSkillSlots(skills) {
        if (!this.components.skillBar) return;
        
        const skillBar = this.components.skillBar;
        const slots = skillBar.slots;
        
        // 스킬 슬롯 업데이트
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const skill = skills[i];
            
            if (skill) {
                // 스킬 아이콘 업데이트
                slot.icon.fillColor = this.getSkillColor(skill.element);
                
                // 스킬 정보 저장
                slot.skillInfo = skill;
                
                // 쿨다운 업데이트
                this.updateSkillCooldown(i, skill.cooldownRemaining, skill.cooldown);
            } else {
                // 빈 슬롯
                slot.icon.fillColor = 0x666666;
                slot.skillInfo = null;
                slot.cooldownOverlay.visible = false;
                slot.cooldownText.visible = false;
            }
        }
    }
    
    /**
     * 스킬 쿨다운 업데이트
     * @param {number} index - 스킬 인덱스
     * @param {number} remaining - 남은 쿨다운 시간 (밀리초)
     * @param {number} total - 전체 쿨다운 시간 (밀리초)
     */
    updateSkillCooldown(index, remaining, total) {
        if (!this.components.skillBar) return;
        
        const slots = this.components.skillBar.slots;
        if (index < 0 || index >= slots.length) return;
        
        const slot = slots[index];
        
        if (remaining > 0 && total > 0) {
            // 쿨다운 진행 중
            const progress = 1 - (remaining / total);
            slot.progress = progress;
            
            // 쿨다운 오버레이 표시
            slot.cooldownOverlay.visible = true;
            slot.cooldownOverlay.height = (slot.icon.height) * (1 - progress);
            slot.cooldownOverlay.y = -(slot.icon.height / 2) + (slot.cooldownOverlay.height / 2);
            
            // 남은 시간 표시
            const secondsRemaining = Math.ceil(remaining / 1000);
            slot.cooldownText.setText(secondsRemaining.toString());
            slot.cooldownText.visible = true;
        } else {
            // 쿨다운 완료
            slot.cooldownOverlay.visible = false;
            slot.cooldownText.visible = false;
            slot.progress = 0;
            
            // 쿨다운 완료 효과
            if (slot.skillInfo) {
                this.scene.tweens.add({
                    targets: slot.icon,
                    alpha: { from: 0.6, to: 1 },
                    duration: 200,
                    yoyo: true,
                    repeat: 1
                });
            }
        }
    }
    
    /**
     * 소비 아이템 슬롯 업데이트
     * @param {Array} consumables - 플레이어 소비 아이템 배열
     */
    updateConsumableSlots(consumables) {
        if (!this.components.consumableBar) return;
        
        const consumableBar = this.components.consumableBar;
        const slots = consumableBar.slots;
        
        // 소비 아이템 슬롯 업데이트
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const item = consumables[i];
            
            if (item) {
                // 아이템 아이콘 업데이트
                slot.icon.fillColor = this.getItemRarityColor(item.rarity);
                
                // 아이템 정보 저장
                slot.itemInfo = item;
                
                // 아이템 개수 표시
                slot.countText.setText(item.count || '1');
                slot.countText.visible = true;
            } else {
                // 빈 슬롯
                slot.icon.fillColor = 0x666666;
                slot.itemInfo = null;
                slot.countText.visible = false;
            }
        }
    }
    
    /**
     * 미니맵 업데이트
     * @param {Array} rooms - 방 배열
     * @param {Object} currentRoom - 현재 방
     * @param {Object} playerPosition - 플레이어 위치
     */
    updateMinimap(rooms, currentRoom, playerPosition) {
        if (!this.components.minimap) return;
        
        const minimap = this.components.minimap;
        const minimapSize = this.settings.minimapSize;
        
        // 던전 데이터가 없으면 미니맵을 업데이트하지 않음
        if (!minimap.dungeon) return;
        
        // 던전 바운딩 박스 계산
        const dungeonBounds = this.calculateDungeonBounds(rooms);
        const roomWidth = dungeonBounds.maxX - dungeonBounds.minX;
        const roomHeight = dungeonBounds.maxY - dungeonBounds.minY;
        
        // 스케일 계산 (미니맵 크기에 맞추기)
        const scaleX = minimapSize / (roomWidth + 2); // 여백 추가
        const scaleY = minimapSize / (roomHeight + 2);
        const scale = Math.min(scaleX, scaleY);
        
        // 룸 그룹 초기화
        minimap.roomGroup.removeAll();
        
        // 방 그리기
        for (const room of rooms) {
            // 발견하지 않은 방은 표시하지 않음
            if (!room.discovered && !config.get('player', 'revealFullMap', false)) {
                continue;
            }
            
            // 이 방을 발견된 방으로 표시
            minimap.discovered[room.id] = true;
            
            // 미니맵 좌표 계산
            const x = (room.x - dungeonBounds.minX - roomWidth / 2) * scale;
            const y = (room.y - dungeonBounds.minY - roomHeight / 2) * scale;
            
            // 방 타입에 따른 색상
            let color;
            if (room === currentRoom) {
                color = 0xFFFFFF; // 현재 방
            } else if (room.type === 'boss') {
                color = 0xFF0000; // 보스 방
            } else if (room.type === 'treasure') {
                color = 0xFFD700; // 보물 방
            } else if (room.type === 'merchant') {
                color = 0x00BFFF; // 상인 방
            } else if (room.type === 'challenge') {
                color = 0xFF6600; // 도전 방
            } else if (room.type === 'shrine') {
                color = 0xA020F0; // 신단 방
            } else if (room.type === 'entrance') {
                color = 0x00FF00; // 입구
            } else if (room.type === 'exit') {
                color = 0x800080; // 출구
            } else {
                color = 0x808080; // 일반 방
            }
            
            // 방 사각형 생성
            const roomRect = this.scene.add.rectangle(x, y, scale, scale, color);
            
            // 현재 방은 테두리 강조
            if (room === currentRoom) {
                roomRect.setStrokeStyle(2, 0xFFFFFF, 1);
            }
            
            minimap.roomGroup.add(roomRect);
        }
        
        // 플레이어 위치 업데이트
        if (currentRoom && playerPosition) {
            // 방 내 상대 위치 계산 (0.0 ~ 1.0)
            const roomWidth = currentRoom.width || 1;
            const roomHeight = currentRoom.height || 1;
            const relativeX = (playerPosition.x - currentRoom.x) / roomWidth;
            const relativeY = (playerPosition.y - currentRoom.y) / roomHeight;
            
            // 미니맵 내 방 위치 계산
            const roomX = (currentRoom.x - dungeonBounds.minX - roomWidth / 2) * scale;
            const roomY = (currentRoom.y - dungeonBounds.minY - roomHeight / 2) * scale;
            
            // 플레이어 아이콘 위치 설정
            minimap.playerIcon.x = roomX + relativeX * scale * 0.8;
            minimap.playerIcon.y = roomY + relativeY * scale * 0.8;
        }
    }
    
    /**
     * 던전 바운딩 박스 계산
     * @param {Array} rooms - 방 배열
     * @returns {Object} 바운딩 박스 {minX, minY, maxX, maxY}
     */
    calculateDungeonBounds(rooms) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        
        for (const room of rooms) {
            minX = Math.min(minX, room.x - room.width / 2);
            minY = Math.min(minY, room.y - room.height / 2);
            maxX = Math.max(maxX, room.x + room.width / 2);
            maxY = Math.max(maxY, room.y + room.height / 2);
        }
        
        return { minX, minY, maxX, maxY };
    }
    
    /**
     * 콤보 카운터 업데이트
     * @param {number} combo - 콤보 수
     * @param {number} multiplier - 콤보 배수
     */
    updateComboCounter(combo, multiplier) {
        if (!this.components.comboCounter) return;
        
        const comboCounter = this.components.comboCounter;
        
        // 콤보 타이머 제거
        if (comboCounter.timer) {
            this.scene.time.removeEvent(comboCounter.timer);
        }
        
        // 콤보 0이면 숨김
        if (combo === 0) {
            comboCounter.setVisible(false);
            comboCounter.value = 0;
            comboCounter.multiplier = 1;
            return;
        }
        
        // 기존 콤보보다 높으면 효과 추가
        if (combo > comboCounter.value) {
            this.scene.tweens.add({
                targets: comboCounter.comboText,
                scale: { from: 1.2, to: 1 },
                duration: 200,
                ease: 'Back.easeOut'
            });
        }
        
        // 콤보 텍스트 업데이트
        comboCounter.value = combo;
        comboCounter.multiplier = multiplier;
        comboCounter.comboText.setText(`${combo} COMBO`);
        comboCounter.multiplierText.setText(`x${multiplier.toFixed(1)}`);
        
        // 콤보 표시
        comboCounter.setVisible(true);
        
        // 콤보 타이머 설정 (콤보 창 시간)
        const comboTimeWindow = config.get('combat', 'comboTimeWindow', 2000);
        comboCounter.timer = this.scene.time.delayedCall(comboTimeWindow, () => {
            // 콤보 시간 초과
            this.scene.tweens.add({
                targets: comboCounter,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    comboCounter.setVisible(false);
                    comboCounter.alpha = 1;
                    comboCounter.value = 0;
                    comboCounter.multiplier = 1;
                }
            });
        });
    }
    
    /**
     * 상태 효과 아이콘 업데이트
     * @param {Array} activeEffects - 활성화된 상태 효과 배열
     */
    updateStatusIcons(activeEffects) {
        if (!this.components.statusIcons) return;
        
        const statusContainer = this.components.statusIcons;
        
        // 기존 아이콘 제거
        statusContainer.removeAll();
        statusContainer.icons = [];
        
        if (!activeEffects || activeEffects.length === 0) {
            return;
        }
        
        // 아이콘 크기
        const iconSize = this.settings.statusIconSize;
        const margin = 5;
        
        // 상태 효과 아이콘 생성
        for (let i = 0; i < activeEffects.length; i++) {
            const effect = activeEffects[i];
            
            // 아이콘 배경
            const bg = this.scene.add.circle(i * (iconSize + margin), 0, iconSize / 2, 0x000000, 0.7);
            statusContainer.add(bg);
            
            // 아이콘 생성
            const icon = this.scene.add.circle(i * (iconSize + margin), 0, iconSize / 2 - 2, this.getStatusEffectColor(effect.type));
            statusContainer.add(icon);
            
            // 남은 시간 텍스트 (있는 경우)
            if (effect.duration > 0) {
                const remainingSeconds = Math.ceil(effect.duration / 1000);
                const timeText = this.scene.add.text(i * (iconSize + margin), iconSize / 2 + 2, remainingSeconds.toString(), {
                    fontFamily: config.get('ui', 'fontFamily'),
                    fontSize: config.get('ui', 'fontSize').small,
                    color: '#FFFFFF',
                    align: 'center'
                });
                timeText.setOrigin(0.5, 0);
                statusContainer.add(timeText);
                
                // 남은 시간 업데이트 함수
                timeText.update = (time, delta) => {
                    effect.duration -= delta;
                    if (effect.duration <= 0) {
                        timeText.setText('0');
                    } else {
                        timeText.setText(Math.ceil(effect.duration / 1000).toString());
                    }
                };
                
                // 씬의 업데이트 루프에 추가
                this.scene.sys.updateList.add(timeText);
                
                // 참조 저장
                statusContainer.icons.push({ icon, timeText, effect });
            } else {
                // 지속시간 없는 효과
                statusContainer.icons.push({ icon, effect });
            }
        }
    }
    
    /**
     * 보스 체력바 업데이트
     * @param {Object} boss - 보스 객체
     */
    updateBossBar(boss) {
        if (!this.components.bossBar || !boss) return;
        
        const bossBar = this.components.bossBar;
        const barWidth = 400;
        
        // 체력바 업데이트
        const hpRatio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
        bossBar.healthBar.width = barWidth * hpRatio;
        bossBar.healthText.setText(`${Math.ceil(boss.hp)}/${boss.maxHp}`);
        
        // 보스 페이즈 변경 시 (선택적)
        if (boss.phase !== bossBar.currentPhase) {
            bossBar.currentPhase = boss.phase;
            
            // 페이즈 변경 효과
            this.scene.tweens.add({
                targets: bossBar,
                y: { from: bossBar.y - 10, to: bossBar.y },
                duration: 300,
                ease: 'Bounce'
            });
            
            // 페이즈 아이콘 업데이트 (있는 경우)
            if (boss.phases && boss.phases[boss.phase]) {
                const phaseIcon = bossBar.phaseIcon;
                phaseIcon.removeAll();
                
                // 페이즈 아이콘 생성
                const phaseColor = this.getBossPhaseColor(boss.phase);
                const icon = this.scene.add.circle(0, 0, 10, phaseColor);
                phaseIcon.add(icon);
                
                // 깜빡임 효과
                this.scene.tweens.add({
                    targets: icon,
                    alpha: { from: 0.5, to: 1 },
                    duration: 500,
                    yoyo: true,
                    repeat: -1
                });
            }
        }
        
        // 낮은 체력 경고 효과
        if (hpRatio < 0.3 && !bossBar.lowHealthEffect) {
            bossBar.lowHealthEffect = true;
            
            // 체력바 색상 변경
            this.scene.tweens.add({
                targets: bossBar.healthBar,
                fillColor: { from: 0xFF0000, to: 0xFF6000 },
                duration: 500,
                yoyo: true,
                repeat: -1
            });
            
            // 이름 깜빡임
            this.scene.tweens.add({
                targets: bossBar.children[0], // 보스 이름 텍스트
                alpha: { from: 1, to: 0.7 },
                duration: 300,
                yoyo: true,
                repeat: -1
            });
        } else if (hpRatio >= 0.3 && bossBar.lowHealthEffect) {
            // 경고 효과 제거
            bossBar.lowHealthEffect = false;
            
            this.scene.tweens.killTweensOf(bossBar.healthBar);
            this.scene.tweens.killTweensOf(bossBar.children[0]);
            
            bossBar.healthBar.fillColor = 0xFF0000;
            bossBar.children[0].alpha = 1;
        }
    }
    
    /**
     * 시간 표시 업데이트
     * @param {number} elapsedTime - 경과 시간 (밀리초)
     */
    updateTimeDisplay(elapsedTime) {
        if (!this.components.timeDisplay) return;
        
        const timeDisplay = this.components.timeDisplay;
        timeDisplay.elapsedTime = elapsedTime;
        
        // 분:초 형식으로 표시
        const minutes = Math.floor(elapsedTime / 60000);
        const seconds = Math.floor((elapsedTime % 60000) / 1000);
        
        // 00:00 형식
        const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timeDisplay.timeText.setText(timeText);
        
        // 시간 경과에 따른 경고 효과
        const timeScaleBase = config.get('dungeon', 'timeScaleBase', 30 * 60 * 1000);
        const warningThreshold = timeScaleBase * 0.7;
        const dangerThreshold = timeScaleBase * 0.9;
        
        if (elapsedTime > dangerThreshold) {
            // 위험 수준 (빨간색 깜빡임)
            timeDisplay.timeText.setTint(0xFF0000);
            
            if (!timeDisplay.blinkTween) {
                timeDisplay.blinkTween = this.scene.tweens.add({
                    targets: timeDisplay.timeText,
                    alpha: { from: 1, to: 0.5 },
                    duration: 300,
                    yoyo: true,
                    repeat: -1
                });
            }
        } else if (elapsedTime > warningThreshold) {
            // 경고 수준 (노란색)
            timeDisplay.timeText.setTint(0xFFFF00);
            
            if (timeDisplay.blinkTween) {
                timeDisplay.blinkTween.stop();
                timeDisplay.blinkTween = null;
                timeDisplay.timeText.alpha = 1;
            }
        } else {
            // 정상 (흰색)
            timeDisplay.timeText.setTint(0xFFFFFF);
            
            if (timeDisplay.blinkTween) {
                timeDisplay.blinkTween.stop();
                timeDisplay.blinkTween = null;
                timeDisplay.timeText.alpha = 1;
            }
        }
    }
    
    /**
     * 알림 표시
     * @param {string} message - 알림 메시지
     * @param {string} color - 알림 색상 (hex 또는 CSS 색상)
     * @param {number} duration - 표시 시간 (밀리초)
     */
    showNotification(message, color = '#FFFFFF', duration = 3000) {
        // 큐에 알림 추가
        this.notificationQueue.push({
            message,
            color,
            duration
        });
        
        // 대기 중인 알림이 없으면 즉시 표시
        if (!this.notificationActive) {
            this.processNextNotification();
        }
    }
    
    /**
     * 다음 알림 처리
     */
    processNextNotification() {
        if (this.notificationQueue.length === 0) {
            this.notificationActive = false;
            return;
        }
        
        this.notificationActive = true;
        const notification = this.notificationQueue.shift();
        const container = this.components.notificationContainer;
        
        // 알림 설정
        container.text.setText(notification.message);
        container.text.setColor(notification.color);
        
        // 배경 크기 조정
        const padding = 20;
        container.bg.width = container.text.width + padding * 2;
        container.bg.height = container.text.height + padding;
        
        // 표시
        container.bg.setVisible(true);
        container.text.setVisible(true);
        
        // 알파 애니메이션
        container.alpha = 0;
        this.scene.tweens.add({
            targets: container,
            alpha: 1,
            duration: 200,
            onComplete: () => {
                // 지정된 시간 후 사라짐
                this.scene.time.delayedCall(notification.duration, () => {
                    this.scene.tweens.add({
                        targets: container,
                        alpha: 0,
                        duration: 200,
                        onComplete: () => {
                            container.bg.setVisible(false);
                            container.text.setVisible(false);
                            
                            // 다음 알림 처리
                            this.processNextNotification();
                        }
                    });
                });
            }
        });
    }
    
    /**
     * 아이템 획득 알림 표시
     * @param {Object} item - 획득한 아이템
     */
    showItemNotification(item) {
        if (!item) return;
        
        // 희귀도에 따른 색상
        const color = this.getItemRarityColor(item.rarity);
        
        // 알림 메시지
        let message = `${item.name} 획득!`;
        
        // 스택 가능한 아이템은 개수 표시
        if (item.stackable && item.count > 1) {
            message = `${item.name} x${item.count} 획득!`;
        }
        
        // 알림 표시
        this.showNotification(message, color);
    }
    
    /**
     * 골드 획득 알림 표시
     * @param {number} amount - 획득한 골드량
     */
    showGoldNotification(amount) {
        this.showNotification(`${amount} 골드 획득!`, '#FFD700');
    }
    
    /**
     * 보스 경고 표시
     * @param {string} bossName - 보스 이름
     */
    showBossWarning(bossName) {
        // 화면 중앙에 큰 경고
        const { width, height } = this.scene.scale;
        
        // 경고 텍스트 생성
        const warningText = this.scene.add.text(width / 2, height / 2, `${bossName}\n등장!`, {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').title,
            color: '#FF0000',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        });
        warningText.setOrigin(0.5, 0.5);
        warningText.setDepth(200);
        warningText.setAlpha(0);
        
        // 경고 애니메이션
        this.scene.tweens.add({
            targets: warningText,
            alpha: 1,
            scale: { from: 2, to: 1 },
            duration: 1000,
            ease: 'Bounce',
            onComplete: () => {
                this.scene.time.delayedCall(1500, () => {
                    this.scene.tweens.add({
                        targets: warningText,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            warningText.destroy();
                        }
                    });
                });
            }
        });
    }
    
    /**
     * 화면 크기 변경 대응
     */
    onResize() {
        this.adjustToScreenSize();
    }
    
    /**
     * 화면 크기에 맞게 HUD 조정
     */
    adjustToScreenSize() {
        const { width, height } = this.scene.scale;
        
        // 스탯 바 위치
        if (this.components.statsBar) {
            this.components.statsBar.setPosition(10, 10);
        }
        
        // 스킬 바 위치
        if (this.components.skillBar) {
            this.components.skillBar.setPosition(width / 2, height - this.settings.skillBarHeight - 10);
        }
        
        // 소비 아이템 바 위치
        if (this.components.consumableBar) {
            this.components.consumableBar.setPosition(width - 10, height - this.settings.skillBarHeight - 10);
        }
        
        // 미니맵 위치
        if (this.components.minimap) {
            this.components.minimap.setPosition(width - this.settings.minimapSize / 2 - 10, this.settings.minimapSize / 2 + 10);
        }
        
        // 시간 표시 위치
        if (this.components.timeDisplay) {
            this.components.timeDisplay.setPosition(width / 2, 20);
        }
        
        // 알림 컨테이너 위치
        if (this.components.notificationContainer) {
            this.components.notificationContainer.setPosition(width / 2, height / 4);
        }
        
        // 보스 바 위치
        if (this.components.bossBar) {
            this.components.bossBar.setPosition(width / 2, 60);
        }
        
        // 콤보 카운터 위치
        if (this.components.comboCounter) {
            this.components.comboCounter.setPosition(width / 2, height / 2 - 100);
        }
    }
    
    /**
     * 희귀도에 따른 아이템 색상 가져오기
     * @param {string} rarity - 아이템 희귀도
     * @returns {number} 색상 값
     */
    getItemRarityColor(rarity) {
        const colors = {
            'common': 0xFFFFFF,
            'uncommon': 0x2ECC71,
            'rare': 0x3498DB,
            'epic': 0x9B59B6,
            'legendary': 0xF39C12,
            'mythic': 0xE74C3C
        };
        
        // config에서 색상 가져오기 시도
        const configColors = config.get('ui', 'itemRarityColors');
        if (configColors && configColors[rarity]) {
            // hex 문자열을 숫자로 변환
            const hexColor = configColors[rarity].replace('#', '0x');
            return parseInt(hexColor, 16);
        }
        
        return colors[rarity] || 0xFFFFFF;
    }
    
    /**
     * 스킬 원소에 따른 색상 가져오기
     * @param {string} element - 스킬 원소
     * @returns {number} 색상 값
     */
    getSkillColor(element) {
        const colors = {
            'fire': 0xFF4500,
            'water': 0x4682B4,
            'earth': 0x8B4513,
            'air': 0xF5F5F5,
            'ice': 0x87CEEB,
            'lightning': 0xFFD700,
            'light': 0xFFFFFF,
            'dark': 0x800080,
            'nature': 0x32CD32,
            'arcane': 0x9400D3,
            'physical': 0xA0A0A0
        };
        
        return colors[element] || 0xA0A0A0;
    }
    
    /**
     * 상태 효과에 따른 색상 가져오기
     * @param {string} effectType - 상태 효과 타입
     * @returns {number} 색상 값
     */
    getStatusEffectColor(effectType) {
        const colors = {
            'burn': 0xFF4500,
            'freeze': 0x87CEEB,
            'shock': 0xFFD700,
            'poison': 0x32CD32,
            'stun': 0xFFFF00,
            'slow': 0x4682B4,
            'buff_attack': 0xFF6347,
            'buff_defense': 0x4682B4,
            'buff_speed': 0xFFD700,
            'buff_magic': 0x9400D3,
            'debuff_attack': 0xA0A0A0,
            'debuff_defense': 0xA0A0A0,
            'debuff_speed': 0xA0A0A0
        };
        
        return colors[effectType] || 0xFFFFFF;
    }
    
    /**
     * 보스 페이즈에 따른 색상 가져오기
     * @param {number} phase - 보스 페이즈
     * @returns {number} 색상 값
     */
    getBossPhaseColor(phase) {
        const colors = [
            0xFFFFFF, // 페이즈 0 (기본)
            0xFF6600, // 페이즈 1
            0xFF0000, // 페이즈 2
            0xFF00FF  // 페이즈 3
        ];
        
        return colors[phase] || 0xFFFFFF;
    }
    
    /**
     * HUD 업데이트 (게임 루프에서 호출)
     * @param {number} time - 현재 시간
     * @param {number} delta - 이전 프레임과의 시간 차이
     */
    update(time, delta) {
        // 상태 아이콘 업데이트
        if (this.components.statusIcons && this.components.statusIcons.icons) {
            for (const iconData of this.components.statusIcons.icons) {
                if (iconData.timeText && iconData.timeText.update) {
                    iconData.timeText.update(time, delta);
                }
            }
        }
    }
    
    /**
     * HUD 정리 (씬 종료 시 호출)
     */
    destroy() {
        // 이벤트 리스너 제거
        this.scene.scale.off('resize', this.onResize, this);
        
        if (this.scene.events) {
            this.scene.events.off('playerStatsChanged', this.updateStatsBar, this);
            this.scene.events.off('skillCooldownChanged', this.updateSkillCooldown, this);
            this.scene.events.off('comboChanged', this.updateComboCounter, this);
            this.scene.events.off('statusEffectChanged', this.updateStatusIcons, this);
            this.scene.events.off('roomChanged', this.updateMinimap, this);
            this.scene.events.off('timeUpdated', this.updateTimeDisplay, this);
            this.scene.events.off('bossHealthChanged', this.updateBossBar, this);
        }
        
        // 트윈 중지
        this.scene.tweens.killAll();
        
        // 상태 아이콘 업데이트 함수 제거
        if (this.components.statusIcons && this.components.statusIcons.icons) {
            for (const iconData of this.components.statusIcons.icons) {
                if (iconData.timeText) {
                    this.scene.sys.updateList.remove(iconData.timeText);
                }
            }
        }
        
        // 모든 컴포넌트 제거
        for (const key in this.components) {
            if (this.components[key] && this.components[key].destroy) {
                this.components[key].destroy();
            }
        }
        
        // 컨테이너 제거
        this.container.destroy();
        
        // 참조 해제
        this.components = null;
        this.scene = null;
    }
    
    /**
     * HUD 표시/숨김 설정
     * @param {boolean} visible - 표시 여부
     */
    setVisible(visible) {
        this.container.setVisible(visible);
    }
    
    /**
     * 특정 HUD 요소 표시/숨김 설정
     * @param {string} componentKey - 컴포넌트 키
     * @param {boolean} visible - 표시 여부
     */
    setComponentVisible(componentKey, visible) {
        const component = this.components[componentKey];
        if (component) {
            component.setVisible(visible);
        }
    }
    
    /**
     * HUD 투명도 설정
     * @param {number} alpha - 투명도 (0.0 ~ 1.0)
     */
    setAlpha(alpha) {
        this.container.setAlpha(alpha);
    }
    
    /**
     * 사용자 인터페이스 스케일 설정
     * @param {number} scale - 스케일 계수
     */
    setScale(scale) {
        this.container.setScale(scale);
    }
    
    /**
     * 미니맵 확대/축소
     * @param {number} zoomLevel - 확대/축소 레벨
     */
    setMinimapZoom(zoomLevel) {
        if (!this.components.minimap) return;
        
        // 미니맵 룸 그룹 스케일 조정
        this.components.minimap.roomGroup.setScale(zoomLevel);
    }
    
    /**
     * 모든 알림 제거
     */
    clearNotifications() {
        this.notificationQueue = [];
        
        if (this.components.notificationContainer) {
            const container = this.components.notificationContainer;
            container.bg.setVisible(false);
            container.text.setVisible(false);
            container.alpha = 1;
            
            // 진행 중인 트윈 중지
            this.scene.tweens.killTweensOf(container);
            
            this.notificationActive = false;
        }
    }
    
    /**
     * 채팅 창 생성
     */
    createChatDisplay() {
        const { width, height } = this.scene.scale;
        
        // 컨테이너 생성
        const chatContainer = this.scene.add.container(10, height - 200);
        chatContainer.setVisible(false);
        
        // 배경
        const chatBg = this.scene.add.rectangle(0, 0, 300, 150, 0x000000, 0.7);
        chatBg.setOrigin(0, 0);
        chatBg.setStrokeStyle(1, 0xFFFFFF, 0.5);
        chatContainer.add(chatBg);
        
        // 메시지 목록
        const messages = [];
        const maxMessages = 5;
        
        // 채팅 창 숨기기 타이머
        let hideTimer = null;
        
        // 메시지 추가 함수
        const addMessage = (sender, text, color = '#FFFFFF') => {
            // 메시지 객체 생성
            const message = {
                sender: sender,
                text: text,
                color: color,
                textObj: null
            };
            
            // 기존 메시지 위로 이동
            for (let i = 0; i < messages.length; i++) {
                if (messages[i].textObj) {
                    messages[i].textObj.y -= 25;
                }
            }
            
            // 새 메시지 텍스트 생성
            const messageText = this.scene.add.text(10, 10 + (messages.length * 25), `${sender}: ${text}`, {
                fontFamily: config.get('ui', 'fontFamily'),
                fontSize: config.get('ui', 'fontSize').normal,
                color: color,
                wordWrap: { width: 280 }
            });
            
            message.textObj = messageText;
            chatContainer.add(messageText);
            
            // 메시지 배열에 추가
            messages.push(message);
            
            // 최대 메시지 개수 초과 시 제거
            if (messages.length > maxMessages) {
                const oldMessage = messages.shift();
                if (oldMessage.textObj) {
                    oldMessage.textObj.destroy();
                }
            }
            
            // 채팅 창 표시
            chatContainer.setVisible(true);
            
            // 이전 타이머 취소
            if (hideTimer) {
                this.scene.time.removeEvent(hideTimer);
            }
            
            // 일정 시간 후 채팅 창 숨김
            hideTimer = this.scene.time.delayedCall(5000, () => {
                chatContainer.setVisible(false);
            });
        };
        
        // 채팅 창 객체 저장
        const chatDisplay = {
            container: chatContainer,
            background: chatBg,
            messages: messages,
            addMessage: addMessage,
            hideTimer: hideTimer
        };
        
        this.components.chatDisplay = chatDisplay;
        this.container.add(chatContainer);
        
        return chatDisplay;
    }
    
    /**
     * 인벤토리 버튼 생성
     */
    createInventoryButton() {
        const { width, height } = this.scene.scale;
        
        // 버튼 컨테이너
        const buttonContainer = this.scene.add.container(width - 50, 50);
        
        // 버튼 배경
        const buttonBg = this.scene.add.circle(0, 0, 20, 0x000000, 0.7);
        buttonBg.setStrokeStyle(2, 0xFFFFFF, 0.5);
        buttonContainer.add(buttonBg);
        
        // 버튼 아이콘 (간단한 가방 모양)
        const buttonIcon = this.scene.add.rectangle(0, 0, 16, 16, 0xA0A0A0);
        buttonContainer.add(buttonIcon);
        
        // 버튼 텍스트
        const buttonText = this.scene.add.text(0, 25, 'I', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').small,
            color: '#FFFFFF'
        });
        buttonText.setOrigin(0.5, 0.5);
        buttonContainer.add(buttonText);
        
        // 인터랙티브 설정
        buttonBg.setInteractive({ useHandCursor: true });
        
        // 호버 효과
        buttonBg.on('pointerover', () => {
            buttonBg.fillColor = 0x333333;
        });
        
        buttonBg.on('pointerout', () => {
            buttonBg.fillColor = 0x000000;
        });
        
        // 클릭 효과
        buttonBg.on('pointerdown', () => {
            buttonBg.fillColor = 0x555555;
        });
        
        buttonBg.on('pointerup', () => {
            buttonBg.fillColor = 0x333333;
            
            // 인벤토리 열기 이벤트 발생
            this.scene.events.emit('openInventory');
        });
        
        this.components.inventoryButton = buttonContainer;
        this.container.add(buttonContainer);
    }
    
    /**
     * 일시 정지 버튼 생성
     */
    createPauseButton() {
        const { width, height } = this.scene.scale;
        
        // 버튼 컨테이너
        const buttonContainer = this.scene.add.container(width - 50, 100);
        
        // 버튼 배경
        const buttonBg = this.scene.add.circle(0, 0, 20, 0x000000, 0.7);
        buttonBg.setStrokeStyle(2, 0xFFFFFF, 0.5);
        buttonContainer.add(buttonBg);
        
        // 버튼 아이콘 (간단한 일시 정지 아이콘)
        const pauseIcon1 = this.scene.add.rectangle(-5, 0, 4, 12, 0xFFFFFF);
        const pauseIcon2 = this.scene.add.rectangle(5, 0, 4, 12, 0xFFFFFF);
        buttonContainer.add(pauseIcon1);
        buttonContainer.add(pauseIcon2);
        
        // 버튼 텍스트
        const buttonText = this.scene.add.text(0, 25, 'ESC', {
            fontFamily: config.get('ui', 'fontFamily'),
            fontSize: config.get('ui', 'fontSize').small,
            color: '#FFFFFF'
        });
        buttonText.setOrigin(0.5, 0.5);
        buttonContainer.add(buttonText);
        
        // 인터랙티브 설정
        buttonBg.setInteractive({ useHandCursor: true });
        
        // 호버 효과
        buttonBg.on('pointerover', () => {
            buttonBg.fillColor = 0x333333;
        });
        
        buttonBg.on('pointerout', () => {
            buttonBg.fillColor = 0x000000;
        });
        
        // 클릭 효과
        buttonBg.on('pointerdown', () => {
            buttonBg.fillColor = 0x555555;
        });
        
        buttonBg.on('pointerup', () => {
            buttonBg.fillColor = 0x333333;
            
            // 일시 정지 이벤트 발생
            this.scene.events.emit('pauseGame');
        });
        
        this.components.pauseButton = buttonContainer;
        this.container.add(buttonContainer);
    }
    
    /**
     * HUD 설정 업데이트
     * @param {Object} settings - 업데이트할 설정
     */
    updateSettings(settings) {
        if (!settings) return;
        
        // 설정 병합
        Object.assign(this.settings, settings);
        
        // 화면 조정
        this.adjustToScreenSize();
    }
}

export default HUD;