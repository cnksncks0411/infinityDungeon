// src/ui/UserInterface.js
/**
 * 게임 UI를 관리하는 클래스
 * HUD, 인벤토리, 상점, 메뉴 등 모든 UI 요소 처리
 */
class UserInterface {
    /**
     * UserInterface 생성자
     * @param {Phaser.Scene} scene - UI가 속한 Phaser 씬
     */
    constructor(scene) {
        this.scene = scene;
        this.game = scene.game;

        // UI 컨테이너 객체
        this.containers = {
            hud: null,         // 게임 플레이 중 HUD
            menu: null,        // 일시 정지 메뉴
            inventory: null,   // 인벤토리 화면
            dialog: null,      // 대화창
            notification: null, // 알림창
            shop: null,        // 상점 화면
            gameOver: null     // 게임 오버 화면
        };

        // UI 레이어 깊이 설정
        this.depths = {
            background: 900,
            content: 910,
            foreground: 920,
            notification: 930
        };

        // 활성화된 UI 추적
        this.activeUI = null;

        // UI 색상 테마
        this.COLORS = {
            // 기본 색상
            PRIMARY: 0x333333,
            SECONDARY: 0x666666,
            ACCENT: 0xffcc00,
            
            // 텍스트 색상
            TEXT: {
                PRIMARY: '#ffffff',
                SECONDARY: '#cccccc',
                DISABLED: '#666666',
                ACCENT: '#ffcc00'
            },
            
            // 상태 색상
            STATUS: {
                SUCCESS: 0x00ff00,
                WARNING: 0xffaa00,
                DANGER: 0xff0000,
                INFO: 0x00ffff
            },
            
            // 희귀도 색상
            RARITY: {
                COMMON: 0xffffff,
                UNCOMMON: 0x00ff00,
                RARE: 0x0066ff,
                EPIC: 0xaa00ff,
                LEGENDARY: 0xff9900,
                MYTHIC: 0xff0000
            }
        };

        // 영구적인 UI 초기화
        this.initPersistentUI();
    }

    //=========================================================
    //=============== 코어 메서드 - UI 초기화/관리 =================
    //=========================================================

    /**
     * 영구적인 UI 초기화 (HUD 등)
     */
    initPersistentUI() {
        // 컨테이너 생성
        this.containers.hud = this.scene.add.container(0, 0).setDepth(this.depths.foreground);
        this.containers.notification = this.scene.add.container(0, 0).setDepth(this.depths.notification);

        // HUD는 카메라에 고정되도록 설정
        this.containers.hud.setScrollFactor(0);
        this.containers.notification.setScrollFactor(0);

        // 모든 컨테이너 비활성화
        for (const container of Object.values(this.containers)) {
            if (container) container.visible = false;
        }
    }

    /**
     * 컨테이너 초기화 - 내부 객체 제거
     * @param {Phaser.GameObjects.Container} container - 초기화할 컨테이너
     */
    clearContainer(container) {
        if (!container) return;

        while (container.list.length > 0) {
            const item = container.list[0];
            container.remove(item);
            item.destroy();
        }
    }

    /**
     * 컨테이너 생성 또는 접근
     * @param {string} key - 컨테이너 식별자
     * @param {number} depth - UI 깊이 (z-index)
     * @returns {Phaser.GameObjects.Container} 컨테이너 객체
     */
    getContainer(key, depth) {
        if (!this.containers[key]) {
            this.containers[key] = this.scene.add.container(0, 0)
                .setDepth(depth || this.depths.content)
                .setScrollFactor(0)
                .setVisible(false);
        }
        return this.containers[key];
    }

    /**
     * 컨테이너 표시 (다른 컨테이너는 자동 숨김)
     * @param {string} key - 표시할 컨테이너 식별자
     */
    showContainer(key) {
        // 모든 컨테이너 숨김 (HUD, 알림 제외)
        for (const [containerKey, container] of Object.entries(this.containers)) {
            if (containerKey !== 'hud' && containerKey !== 'notification' && container) {
                container.visible = false;
            }
        }
        
        // 요청된 컨테이너 표시
        const container = this.getContainer(key);
        container.visible = true;
        this.activeUI = key;
        
        return container;
    }

    //=========================================================
    //================= 던전 UI 관련 메서드 =====================
    //=========================================================

    /**
     * 던전 UI 생성
     * @param {Object} dungeonInfo - 던전 정보 객체
     */
    createDungeonUI(dungeonInfo) {
        // 기존 HUD 초기화
        this.clearContainer(this.containers.hud);

        // 게임 해상도 가져오기
        const { width, height } = this.scene.scale;

        // HUD 배경 (반투명 검은색 패널)
        const hudBg = this.scene.add.rectangle(width / 2, 20, width, 80, 0x000000, 0.5)
            .setOrigin(0.5, 0);

        // 던전 이름 표시
        const dungeonName = this.scene.add.text(20, 20, dungeonInfo.dungeonName, {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: this.COLORS.TEXT.PRIMARY
        }).setShadow(1, 1, '#000000', 3);

        // 난이도 표시
        const difficultyText = this.scene.add.text(20, 50, `난이도: ${dungeonInfo.difficulty}`, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: this.COLORS.TEXT.SECONDARY
        });

        // 현재 층 표시
        const floorText = this.scene.add.text(150, 50, `층: ${dungeonInfo.floor}`, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: this.COLORS.TEXT.SECONDARY
        });

        // 플레이어 클래스 표시
        const classText = this.scene.add.text(width - 150, 20, dungeonInfo.playerClass, {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: this.COLORS.TEXT.PRIMARY
        }).setOrigin(1, 0);

        // 플레이어 스탯 HUD 생성
        this.createPlayerStatsHUD();

        // 미니맵 위치 설정
        const minimapSize = 150;
        const minimapBg = this.scene.add.rectangle(
            width - minimapSize / 2 - 20,
            height - minimapSize / 2 - 20,
            minimapSize,
            minimapSize,
            0x000000,
            0.7
        ).setOrigin(0.5, 0.5);

        // 스킬 슬롯 생성
        this.createSkillBar();

        // 아이템 슬롯 생성
        this.createItemBar();

        // HUD 요소 추가
        this.containers.hud.add([
            hudBg,
            dungeonName,
            difficultyText,
            floorText,
            classText,
            minimapBg
        ]);

        // HUD 표시
        this.containers.hud.visible = true;
    }

    /**
     * 플레이어 스탯 HUD 생성
     */
    createPlayerStatsHUD() {
        const { width } = this.scene.scale;

        // HP 표시줄
        const hpBarWidth = 200;
        const hpBarHeight = 20;
        const hpBarX = width / 2 - hpBarWidth / 2;
        const hpBarY = 20;

        // HP 배경
        const hpBarBg = this.scene.add.rectangle(
            hpBarX,
            hpBarY,
            hpBarWidth,
            hpBarHeight,
            0x333333
        ).setOrigin(0, 0);

        // HP 바
        const hpBar = this.scene.add.rectangle(
            hpBarX,
            hpBarY,
            hpBarWidth,
            hpBarHeight,
            0xcc0000
        ).setOrigin(0, 0);

        // HP 텍스트
        const hpText = this.scene.add.text(
            hpBarX + hpBarWidth / 2,
            hpBarY + hpBarHeight / 2,
            "100/100",
            {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // MP 표시줄
        const mpBarWidth = 200;
        const mpBarHeight = 15;
        const mpBarX = width / 2 - mpBarWidth / 2;
        const mpBarY = hpBarY + hpBarHeight + 5;

        // MP 배경
        const mpBarBg = this.scene.add.rectangle(
            mpBarX,
            mpBarY,
            mpBarWidth,
            mpBarHeight,
            0x333333
        ).setOrigin(0, 0);

        // MP 바
        const mpBar = this.scene.add.rectangle(
            mpBarX,
            mpBarY,
            mpBarWidth,
            mpBarHeight,
            0x0066cc
        ).setOrigin(0, 0);

        // MP 텍스트
        const mpText = this.scene.add.text(
            mpBarX + mpBarWidth / 2,
            mpBarY + mpBarHeight / 2,
            "50/50",
            {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 요소 저장 (업데이트를 위해)
        this.playerHUD = {
            hpBar, hpText, mpBar, mpText
        };

        // 컨테이너에 추가
        this.containers.hud.add([hpBarBg, hpBar, hpText, mpBarBg, mpBar, mpText]);
    }

    /**
     * 스킬바 생성
     */
    createSkillBar() {
        const { width, height } = this.scene.scale;

        // 스킬 슬롯 설정
        const slotSize = 50;
        const padding = 10;
        const startX = width / 2 - (slotSize * 2 + padding * 1.5);
        const startY = height - slotSize - 20;

        // 스킬 슬롯 및 키 바인딩
        const keyBindings = ['Q', 'W', 'E', 'R'];
        this.skillSlots = [];

        for (let i = 0; i < 4; i++) {
            // 슬롯 배경
            const slotBg = this.scene.add.rectangle(
                startX + (slotSize + padding) * i,
                startY,
                slotSize,
                slotSize,
                this.COLORS.PRIMARY,
                0.8
            ).setStrokeStyle(2, 0xaaaaaa);

            // 키 바인딩 텍스트
            const keyText = this.scene.add.text(
                startX + (slotSize + padding) * i + 5,
                startY - slotSize / 2 + 5,
                keyBindings[i],
                {
                    fontFamily: 'Arial',
                    fontSize: '14px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            );

            // 쿨다운 오버레이 (처음에는 보이지 않음)
            const cooldownOverlay = this.scene.add.rectangle(
                startX + (slotSize + padding) * i,
                startY,
                slotSize,
                slotSize,
                0x000000,
                0.7
            ).setVisible(false);

            // 쿨다운 텍스트
            const cooldownText = this.scene.add.text(
                startX + (slotSize + padding) * i,
                startY,
                "",
                {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            ).setOrigin(0.5, 0.5).setVisible(false);

            // 스킬 아이콘 (기본 회색)
            const skillIcon = this.scene.add.rectangle(
                startX + (slotSize + padding) * i,
                startY,
                slotSize - 10,
                slotSize - 10,
                this.COLORS.SECONDARY
            );

            // 슬롯 구성 저장
            this.skillSlots.push({
                slot: slotBg,
                key: keyText,
                icon: skillIcon,
                cooldownOverlay: cooldownOverlay,
                cooldownText: cooldownText,
                isOnCooldown: false
            });

            // 컨테이너에 추가
            this.containers.hud.add([slotBg, keyText, skillIcon, cooldownOverlay, cooldownText]);
        }
    }

    /**
     * 아이템바 생성
     */
    createItemBar() {
        const { width, height } = this.scene.scale;

        // 아이템 슬롯 설정
        const slotSize = 40;
        const padding = 5;
        const startX = width / 2 + 50;
        const startY = height - slotSize - 20;

        // 키 바인딩
        const keyBindings = ['1', '2', '3', '4'];
        this.itemSlots = [];

        for (let i = 0; i < 4; i++) {
            // 슬롯 배경
            const slotBg = this.scene.add.rectangle(
                startX + (slotSize + padding) * i,
                startY,
                slotSize,
                slotSize,
                0x222222,
                0.8
            ).setStrokeStyle(1, 0x888888);

            // 키 바인딩 텍스트
            const keyText = this.scene.add.text(
                startX + (slotSize + padding) * i + 3,
                startY - slotSize / 2 + 3,
                keyBindings[i],
                {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            );

            // 아이템 개수 텍스트
            const countText = this.scene.add.text(
                startX + (slotSize + padding) * i + slotSize - 10,
                startY + slotSize / 2 - 10,
                "",
                {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            ).setShadow(1, 1, '#000000', 1);

            // 아이템 아이콘 (기본 비어있음)
            const itemIcon = this.scene.add.rectangle(
                startX + (slotSize + padding) * i,
                startY,
                slotSize - 8,
                slotSize - 8,
                0x444444,
                0.5
            );

            // 슬롯 구성 저장
            this.itemSlots.push({
                slot: slotBg,
                key: keyText,
                icon: itemIcon,
                countText: countText,
                itemData: null
            });

            // 컨테이너에 추가
            this.containers.hud.add([slotBg, keyText, itemIcon, countText]);
        }
    }

    /**
     * 미니맵 생성
     * @param {Object} dungeon - 던전 데이터
     */
    createMinimap(dungeon) {
        const { width, height } = this.scene.scale;

        // 미니맵 크기 및 위치
        const minimapSize = 150;
        const cellSize = 4; // 미니맵 셀 크기
        const minimapX = width - minimapSize - 20;
        const minimapY = height - minimapSize - 20;

        // 미니맵 컨테이너
        this.minimapContainer = this.scene.add.container(minimapX, minimapY);
        this.containers.hud.add(this.minimapContainer);

        // 미니맵 데이터 저장
        this.minimap = {
            container: this.minimapContainer,
            size: minimapSize,
            cellSize: cellSize,
            rooms: [],
            playerMarker: null
        };

        // 미니맵 테두리
        const border = this.scene.add.rectangle(
            minimapSize / 2,
            minimapSize / 2,
            minimapSize,
            minimapSize,
            0x000000,
            0
        ).setStrokeStyle(2, 0xffffff, 0.5);

        this.minimapContainer.add(border);
    }

    /**
     * 미니맵 업데이트
     * @param {Array} rooms - 던전 방 배열
     * @param {Object} currentRoom - 현재 방 객체
     * @param {Object} playerPosition - 플레이어 위치 {x, y}
     */
    updateMinimap(rooms, currentRoom, playerPosition) {
        if (!this.minimap) return;
        
        // 이전 방 그래픽 삭제
        this.minimap.rooms.forEach(r => r.destroy());
        this.minimap.rooms = [];

        // 플레이어 마커 삭제
        if (this.minimap.playerMarker) {
            this.minimap.playerMarker.destroy();
        }

        // 방이 없으면 반환
        if (!rooms || rooms.length === 0) return;

        // 미니맵 중앙 계산 (최소/최대 방 좌표 기준)
        const minX = Math.min(...rooms.map(r => r.x));
        const maxX = Math.max(...rooms.map(r => r.x + r.width));
        const minY = Math.min(...rooms.map(r => r.y));
        const maxY = Math.max(...rooms.map(r => r.y + r.height));

        const dungeonWidth = maxX - minX;
        const dungeonHeight = maxY - minY;

        // 미니맵 스케일 계산
        const scaleX = this.minimap.size / (dungeonWidth + 10);
        const scaleY = this.minimap.size / (dungeonHeight + 10);
        const scale = Math.min(scaleX, scaleY);

        // 방 타입별 색상 매핑
        const roomTypeColors = {
            'entrance': 0x00ffff, // 청록색
            'boss': 0xff0000,     // 빨간색
            'treasure': 0xffff00, // 노란색
            'merchant': 0xff00ff, // 분홍색
            'shrine': 0x00ff00,   // 녹색
            'challenge': 0xff6600,// 주황색
            'default': 0x666666   // 기본 회색
        };

        // 방 그리기
        rooms.forEach(room => {
            if (!room.explored) return; // 탐색하지 않은 방은 표시하지 않음

            // 방 색상 결정 (방 타입에 따라)
            const color = roomTypeColors[room.type] || roomTypeColors.default;

            // 현재 방은 더 밝게 표시
            const alpha = room.id === currentRoom.id ? 1 : 0.6;

            // 방 위치 계산 (맵 중앙 기준)
            const roomX = (room.x - minX) * scale;
            const roomY = (room.y - minY) * scale;
            const roomW = room.width * scale;
            const roomH = room.height * scale;

            // 방 그래픽 생성
            const roomGraphic = this.scene.add.rectangle(
                roomX + roomW / 2,
                roomY + roomH / 2,
                roomW,
                roomH,
                color,
                alpha
            );

            this.minimap.rooms.push(roomGraphic);
            this.minimapContainer.add(roomGraphic);

            // 문 그리기 (방에 문이 있는 경우)
            if (room.doors && Array.isArray(room.doors)) {
                room.doors.forEach(door => {
                    if (!door || typeof door.x !== 'number' || typeof door.y !== 'number') return;
                
                    const doorX = (door.x - minX) * scale;
                    const doorY = (door.y - minY) * scale;

                    const doorSize = 2;
                    const doorGraphic = this.scene.add.rectangle(
                        doorX,
                        doorY,
                        doorSize,
                        doorSize,
                        0xffffff,
                        alpha
                    );

                    this.minimap.rooms.push(doorGraphic);
                    this.minimapContainer.add(doorGraphic);
                });
            }
        });

        // 플레이어 마커
        if (playerPosition && typeof playerPosition.x === 'number' && typeof playerPosition.y === 'number') {
            const markerX = (playerPosition.x - minX) * scale;
            const markerY = (playerPosition.y - minY) * scale;

            this.minimap.playerMarker = this.scene.add.circle(
                markerX,
                markerY,
                3,
                0xffffff,
                1
            );

            this.minimapContainer.add(this.minimap.playerMarker);
        }
    }

    /**
     * 플레이어 HUD 업데이트
     * @param {Object} player - 플레이어 객체
     */
    updatePlayerHUD(player) {
        if (!this.playerHUD || !player || !player.stats) return;

        const { hpBar, hpText, mpBar, mpText } = this.playerHUD;

        // HP 업데이트
        const hpRatio = player.stats.hp / player.stats.maxHp;
        hpBar.width = 200 * hpRatio;
        hpText.setText(`${Math.floor(player.stats.hp)}/${player.stats.maxHp}`);

        // HP가 낮으면 색상 변경
        if (hpRatio < 0.3) {
            hpBar.fillColor = this.COLORS.STATUS.DANGER; // 빨간색
        } else if (hpRatio < 0.6) {
            hpBar.fillColor = this.COLORS.STATUS.WARNING; // 주황색
        } else {
            hpBar.fillColor = 0xcc0000; // 어두운 빨간색
        }

        // MP 업데이트
        const mpRatio = player.stats.mp / player.stats.maxMp;
        mpBar.width = 200 * mpRatio;
        mpText.setText(`${Math.floor(player.stats.mp)}/${player.stats.maxMp}`);
    }

    /**
     * 스킬 쿨다운 업데이트
     * @param {number} skillIndex - 스킬 슬롯 인덱스
     * @param {number} cooldownTime - 쿨다운 시간(초)
     */
    updateSkillCooldown(skillIndex, cooldownTime) {
        if (!this.skillSlots || skillIndex >= this.skillSlots.length) return;

        const slot = this.skillSlots[skillIndex];
        slot.isOnCooldown = true;
        slot.cooldownOverlay.setVisible(true);
        slot.cooldownText.setVisible(true);

        // 쿨다운 타이머
        let remainingTime = cooldownTime;

        // 이전 타이머가 있으면 삭제
        if (slot.cooldownTimer) {
            slot.cooldownTimer.remove();
        }

        // 쿨다운 타이머 시작
        slot.cooldownTimer = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                remainingTime -= 0.1;

                // 쿨다운 오버레이 업데이트 (남은 쿨다운에 따라 높이 조정)
                const ratio = Math.max(0, remainingTime / cooldownTime);
                slot.cooldownOverlay.height = slot.slot.height * ratio;
                slot.cooldownOverlay.y = slot.slot.y - slot.slot.height / 2 + slot.cooldownOverlay.height / 2;

                // 남은 시간 표시
                if (remainingTime > 0) {
                    slot.cooldownText.setText(remainingTime.toFixed(1));
                } else {
                    // 쿨다운 종료
                    slot.cooldownOverlay.setVisible(false);
                    slot.cooldownText.setVisible(false);
                    slot.isOnCooldown = false;
                    slot.cooldownTimer.remove();
                    slot.cooldownTimer = null;
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    /**
     * 콤보 UI 업데이트
     * @param {number} comboCount - 현재 콤보 수
     * @param {number} comboMultiplier - 콤보 배율
     */
    updateComboUI(comboCount, comboMultiplier) {
        // 이전 콤보 UI가 있으면 삭제
        if (this.comboText) {
            this.comboText.destroy();
        }

        // 콤보가 없으면 표시하지 않음
        if (comboCount <= 1) return;

        const { width, height } = this.scene.scale;

        // 콤보 텍스트 생성
        this.comboText = this.scene.add.text(
            width / 2,
            height / 2 - 100,
            `${comboCount}x Combo! (${comboMultiplier.toFixed(1)}x)`,
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5, 0.5);

        // 간단한 애니메이션 효과
        this.scene.tweens.add({
            targets: this.comboText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            yoyo: true
        });

        // 컨테이너에 추가
        this.containers.hud.add(this.comboText);
    }

    /**
     * 시간 UI 업데이트
     * @param {number} elapsedTime - 경과 시간(밀리초)
     */
    updateTimeUI(elapsedTime) {
        // 이전 시간 텍스트가 있으면 업데이트, 없으면 생성
        if (!this.timeText) {
            const { width } = this.scene.scale;

            this.timeText = this.scene.add.text(
                width - 20,
                60,
                '',
                {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            ).setOrigin(1, 0);

            this.containers.hud.add(this.timeText);
        }

        // 시간 포맷 (분:초)
        const totalSeconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        this.timeText.setText(timeString);
    }

    /**
     * 진행도 UI 업데이트
     * @param {number} explorationPercent - 던전 탐험 진행도(%)
     */
    updateProgressUI(explorationPercent) {
        // 이전 진행도 텍스트가 있으면 업데이트, 없으면 생성
        if (!this.progressText) {
            const { width } = this.scene.scale;

            this.progressText = this.scene.add.text(
                width - 150,
                50,
                '',
                {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: this.COLORS.TEXT.SECONDARY
                }
            ).setOrigin(1, 0);

            this.containers.hud.add(this.progressText);
        }

        this.progressText.setText(`탐험: ${explorationPercent}%`);
    }

    /**
     * 상태 이상 UI 업데이트
     */
    updateStatusUI() {
        // 기존 상태 이상 아이콘 제거
        if (this.statusIcons) {
            this.statusIcons.forEach(icon => icon.destroy());
        }

        this.statusIcons = [];

        // 활성 상태 이상 가져오기
        const activeEffects = this.scene.combatSystem?.activeStatusEffects || [];
        if (activeEffects.length === 0) return;

        // 플레이어에게 적용된 상태 이상만 필터링
        const playerEffects = activeEffects.filter(effect => effect.target === this.scene.player);
        if (playerEffects.length === 0) return;

        const { width, height } = this.scene.scale;
        const iconSize = 30;
        const padding = 5;
        const startX = width / 2 - ((playerEffects.length * (iconSize + padding)) / 2);

        // 상태 이상 타입별 색상 매핑
        const effectColors = {
            'burn': 0xff6600,
            'poison': 0x00ff00,
            'slow': 0x00ffff,
            'stun': 0xffff00,
            'bleed': 0xff0000,
            'regeneration': 0x00cc00,
            'default': 0xffffff
        };

        // 상태 이상 아이콘 생성
        playerEffects.forEach((effect, index) => {
            const x = startX + index * (iconSize + padding);
            const y = 70;

            // 상태 이상 색상
            const color = effectColors[effect.type] || effectColors.default;

            // 아이콘 배경
            const iconBg = this.scene.add.circle(x, y, iconSize / 2, color, 0.7);

            // 남은 시간 텍스트
            const timeText = this.scene.add.text(
                x,
                y,
                Math.ceil(effect.duration).toString(),
                {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            ).setOrigin(0.5, 0.5);

            this.statusIcons.push(iconBg, timeText);
            this.containers.hud.add([iconBg, timeText]);
        });
    }

    /**
     * 쿨다운 UI 업데이트 (스킬 ID로)
     * @param {string} skillId - 스킬 ID
     * @param {number} duration - 쿨다운 시간(초)
     */
    updateCooldownUI(skillId, duration) {
        // 해당 스킬 슬롯 찾기
        const skillIndex = this.scene.player?.skills?.findIndex(skill => skill.id === skillId);

        if (skillIndex !== -1) {
            this.updateSkillCooldown(skillIndex, duration);
        }
    }

    //=========================================================
    //=============== 알림 및 메시지 메서드 =====================
    //=========================================================

    /**
     * 알림 표시
     * @param {string} message - 알림 메시지
     * @param {number} color - 알림 색상 (16진수)
     * @param {number} duration - 지속 시간(밀리초)
     * @returns {Object} 생성된 알림 객체
     */
    showNotification(message, color = 0xffffff, duration = 3000) {
        const { width, height } = this.scene.scale;

        // 알림 배경
        const notificationBg = this.scene.add.rectangle(
            width / 2,
            height / 4,
            width / 2,
            40,
            0x000000,
            0.7
        ).setOrigin(0.5, 0.5);

        // 알림 텍스트
        const notificationText = this.scene.add.text(
            width / 2,
            height / 4,
            message,
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: `#${color.toString(16).padStart(6, '0')}`,
                align: 'center'
            }
        ).setOrigin(0.5, 0.5);

        // 컨테이너에 추가
        const notification = {
            bg: notificationBg,
            text: notificationText
        };

        this.containers.notification.add([notificationBg, notificationText]);
        this.containers.notification.visible = true;

        // 알림 자동 제거 타이머
        this.scene.time.delayedCall(duration, () => {
            notificationBg.destroy();
            notificationText.destroy();

            // 모든 알림이 제거되었는지 확인
            if (this.containers.notification.list.length === 0) {
                this.containers.notification.visible = false;
            }
        });

        return notification;
    }

    /**
     * 아이템 알림
     * @param {Object} item - 획득한 아이템 객체
     * @returns {Object} 생성된 알림 객체
     */
    showItemNotification(item) {
        if (!item) return;

        // 아이템 희귀도에 따른 색상
        const rarityColors = {
            common: this.COLORS.RARITY.COMMON,
            uncommon: this.COLORS.RARITY.UNCOMMON,
            rare: this.COLORS.RARITY.RARE,
            epic: this.COLORS.RARITY.EPIC,
            legendary: this.COLORS.RARITY.LEGENDARY,
            mythic: this.COLORS.RARITY.MYTHIC
        };

        const color = rarityColors[item.rarity] || rarityColors.common;
        const message = `획득: ${item.name || item.id}`;

        return this.showNotification(message, color, 2000);
    }

    /**
     * 골드 알림
     * @param {number} amount - 획득한 골드 양
     * @returns {Object} 생성된 알림 객체
     */
    showGoldNotification(amount) {
        return this.showNotification(`골드 +${amount}`, 0xffdd00, 2000);
    }

    /**
     * 키 알림
     * @returns {Object} 생성된 알림 객체
     */
    showKeyNotification() {
        return this.showNotification('열쇠를 획득했습니다!', 0xffaa00, 2000);
    }

    /**
     * 버프 알림
     * @param {string} buffType - 버프 타입
     * @param {number} value - 버프 효과 수치
     * @param {number} duration - 버프 지속 시간(초)
     * @returns {Object} 생성된 알림 객체
     */
    showBuffNotification(buffType, value, duration) {
        // 버프 타입별 한글 이름
        const buffNames = {
            health: '체력',
            strength: '공격력',
            defense: '방어력',
            speed: '속도',
            mana: '마나',
            default: buffType
        };

        const buffName = buffNames[buffType] || buffNames.default;
        const message = `${buffName} +${value}% (${Math.floor(duration)}초)`;

        return this.showNotification(message, 0x00ffff, 3000);
    }

    /**
     * 버프 종료 알림
     * @param {string} buffType - 종료된 버프 타입
     * @returns {Object} 생성된 알림 객체
     */
    showBuffExpiredNotification(buffType) {
        const buffNames = {
            health: '체력',
            strength: '공격력',
            defense: '방어력',
            speed: '속도',
            mana: '마나',
            default: buffType
        };

        const buffName = buffNames[buffType] || buffNames.default;
        const message = `${buffName} 버프가 종료되었습니다.`;

        return this.showNotification(message, 0xaaaaaa, 2000);
    }

    /**
     * 보스 경고 메시지
     * @param {string} bossName - 보스 이름
     */
    showBossWarning(bossName) {
        const { width, height } = this.scene.scale;

        // 배경 오버레이 (전체 화면)
        const overlay = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x000000,
            0.5
        ).setScrollFactor(0);

        // 경고 텍스트
        const warningText = this.scene.add.text(
            width / 2,
            height / 2 - 40,
            '주의!',
            {
                fontFamily: 'Arial',
                fontSize: '36px',
                color: '#ff0000',
                stroke: '#000000',
                strokeThickness: 5
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);

        // 보스 이름 텍스트
        const bossNameText = this.scene.add.text(
            width / 2,
            height / 2 + 20,
            bossName,
            {
                fontFamily: 'Arial',
                fontSize: '48px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 5
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);

        // 애니메이션 효과
        this.scene.tweens.add({
            targets: [warningText, bossNameText],
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: 1
        });

        // 일정 시간 후 경고 메시지 제거
        this.scene.time.delayedCall(3000, () => {
            overlay.destroy();
            warningText.destroy();
            bossNameText.destroy();
        });
    }

    /**
     * 보스 처치 메시지
     * @param {string} bossName - 처치한 보스 이름
     */
    showBossDefeatedMessage(bossName) {
        const { width, height } = this.scene.scale;

        // 배경 오버레이
        const overlay = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x000000,
            0.3
        ).setScrollFactor(0);

        // 승리 텍스트
        const victoryText = this.scene.add.text(
            width / 2,
            height / 2 - 40,
            '승리!',
            {
                fontFamily: 'Arial',
                fontSize: '48px',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 5
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);

        // 보스 처치 텍스트
        const defeatText = this.scene.add.text(
            width / 2,
            height / 2 + 20,
            `${bossName} 처치`,
            {
                fontFamily: 'Arial',
                fontSize: '36px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);

        // 애니메이션 효과
        this.scene.tweens.add({
            targets: victoryText,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 1000,
            ease: 'Bounce'
        });

        // 일정 시간 후 메시지 제거
        this.scene.time.delayedCall(5000, () => {
            overlay.destroy();
            victoryText.destroy();
            defeatText.destroy();
        });
    }

    /**
     * 웨이브 알림
     * @param {number} currentWave - 현재 웨이브 번호
     * @param {number} totalWaves - 총 웨이브 수
     */
    showWaveNotification(currentWave, totalWaves) {
        const { width, height } = this.scene.scale;

        // 웨이브 텍스트
        const waveText = this.scene.add.text(
            width / 2,
            height / 3,
            `웨이브 ${currentWave} / ${totalWaves}`,
            {
                fontFamily: 'Arial',
                fontSize: '32px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);

        // 애니메이션 효과
        this.scene.tweens.add({
            targets: waveText,
            y: waveText.y - 50,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
                waveText.destroy();
            }
        });
    }

    /**
     * 도전 완료 알림
     * @returns {Object} 생성된 알림 객체
     */
    showChallengeCompletedNotification() {
        const message = '도전 완료! 보상이 지급되었습니다.';
        return this.showNotification(message, 0xffcc00, 4000);
    }

    /**
     * 도전 정보 표시
     * @param {number} waveCount - 웨이브 수
     */
    showChallengeInfo(waveCount) {
        const { width, height } = this.scene.scale;

        // 배경 오버레이
        const overlay = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x000000,
            0.3
        ).setScrollFactor(0);

        // 도전 텍스트
        const challengeText = this.scene.add.text(
            width / 2,
            height / 2 - 60,
            '도전 방!',
            {
                fontFamily: 'Arial',
                fontSize: '32px',
                color: '#ff9900',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);

        // 설명 텍스트
        const descText = this.scene.add.text(
            width / 2,
            height / 2,
            `총 ${waveCount}개의 웨이브를 물리치세요.`,
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);

        // 보상 텍스트
        const rewardText = this.scene.add.text(
            width / 2,
            height / 2 + 50,
            '성공 시 추가 보상이 제공됩니다!',
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5, 0.5).setScrollFactor(0);

        // 일정 시간 후 메시지 제거
        this.scene.time.delayedCall(4000, () => {
            overlay.destroy();
            challengeText.destroy();
            descText.destroy();
            rewardText.destroy();
        });
    }

    /**
     * 던전 해금 알림
     * @param {string} dungeonName - 해금된 던전 이름
     * @returns {Object} 생성된 알림 객체
     */
    showDungeonUnlockNotification(dungeonName) {
        const message = `새 던전 해금: ${dungeonName}`;
        return this.showNotification(message, 0x00ffff, 5000);
    }

    //=========================================================
    //============= 인벤토리 및 아이템 관련 메서드 ================
    //=========================================================

    /**
     * 인벤토리 화면 표시
     * @param {Array} inventory - 인벤토리 아이템 배열
     * @param {Object} player - 플레이어 객체
     */
    showInventory(inventory, player) {
        // 기존 인벤토리 컨테이너 초기화
        if (!this.containers.inventory) {
            this.containers.inventory = this.scene.add.container(0, 0)
                .setDepth(this.depths.content)
                .setScrollFactor(0);
        } else {
            this.clearContainer(this.containers.inventory);
        }

        const { width, height } = this.scene.scale;

        // 배경 오버레이
        const overlay = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x000000,
            0.7
        );

        // 인벤토리 패널
        const panel = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width - 200,
            height - 150,
            this.COLORS.PRIMARY,
            0.9
        ).setStrokeStyle(2, 0xaaaaaa);

        // 인벤토리 제목
        const titleText = this.scene.add.text(
            width / 2,
            height / 2 - panel.height / 2 + 30,
            '인벤토리',
            {
                fontFamily: 'Arial',
                fontSize: '28px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 닫기 버튼
        const closeButton = this.scene.add.text(
            width / 2 + panel.width / 2 - 20,
            height / 2 - panel.height / 2 + 20,
            'X',
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#ff0000'
            }
        ).setOrigin(0.5, 0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.closeInventory();
            });

        // 플레이어 정보 패널
        const playerPanel = this.scene.add.rectangle(
            width / 2 - panel.width / 2 + 150,
            height / 2,
            250,
            panel.height - 100,
            0x222222,
            0.8
        ).setStrokeStyle(1, 0x666666);

        // 플레이어 정보 텍스트
        const playerInfo = this.createPlayerInfoPanel(player, width / 2 - panel.width / 2 + 150, height / 2);

        // 아이템 슬롯 생성
        const itemsContainer = this.createInventoryItemSlots(inventory, width / 2 + 150, height / 2, panel.width - 350);

        // 컨테이너에 추가
        this.containers.inventory.add([
            overlay, panel, titleText, closeButton,
            playerPanel, ...playerInfo, ...itemsContainer
        ]);

        // 인벤토리 표시
        this.containers.inventory.visible = true;
        this.activeUI = 'inventory';
    }

    /**
     * 플레이어 정보 패널 생성
     * @param {Object} player - 플레이어 객체
     * @param {number} x - 패널 X 좌표
     * @param {number} y - 패널 Y 좌표
     * @returns {Array} 생성된 UI 요소 배열
     */
    createPlayerInfoPanel(player, x, y) {
        const elements = [];

        // 기본 플레이어 정보
        const playerData = player || {
            classId: '전사',
            level: 1,
            stats: {
                hp: 100,
                maxHp: 100,
                mp: 50,
                maxMp: 50,
                attack: 10,
                defense: 5,
                speed: 5
            },
            gold: 0
        };

        // 플레이어 클래스 아이콘 (임시 사각형)
        const classIcon = this.scene.add.rectangle(
            x,
            y - 100,
            80,
            80,
            this.COLORS.SECONDARY
        ).setStrokeStyle(2, 0xaaaaaa);

        // 플레이어 클래스 텍스트
        const classText = this.scene.add.text(
            x,
            y - 50,
            playerData.classId || '전사',
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 플레이어 레벨 텍스트
        const levelText = this.scene.add.text(
            x,
            y - 25,
            `Lv. ${playerData.level || 1}`,
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ffff00'
            }
        ).setOrigin(0.5, 0.5);

        // 스탯 정보 텍스트 (HP, MP, 공격력, 방어력, 속도)
        const statLabels = ['HP', 'MP', '공격력', '방어력', '속도'];
        const statValues = [
            `${playerData.stats.hp}/${playerData.stats.maxHp}`,
            `${playerData.stats.mp}/${playerData.stats.maxMp}`,
            `${playerData.stats.attack}`,
            `${playerData.stats.defense}`,
            `${playerData.stats.speed}`
        ];

        for (let i = 0; i < statLabels.length; i++) {
            // 라벨
            const label = this.scene.add.text(
                x - 80,
                y + 10 + i * 30,
                statLabels[i],
                {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: this.COLORS.TEXT.SECONDARY
                }
            ).setOrigin(0, 0.5);

            // 값
            const value = this.scene.add.text(
                x + 80,
                y + 10 + i * 30,
                statValues[i],
                {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            ).setOrigin(1, 0.5);

            elements.push(label, value);
        }

        // 골드 정보
        const goldIcon = this.scene.add.rectangle(
            x - 80,
            y + 180,
            20,
            20,
            this.COLORS.ACCENT
        );

        const goldText = this.scene.add.text(
            x + 80,
            y + 180,
            `${playerData.gold || 0}`,
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: this.COLORS.TEXT.ACCENT
            }
        ).setOrigin(1, 0.5);

        elements.push(classIcon, classText, levelText, goldIcon, goldText);
        return elements;
    }

    /**
     * 인벤토리 아이템 슬롯 생성
     * @param {Array} inventory - 인벤토리 아이템 배열
     * @param {number} centerX - 중앙 X 좌표
     * @param {number} centerY - 중앙 Y 좌표
     * @param {number} width - 전체 슬롯 영역 너비
     * @returns {Array} 생성된 UI 요소 배열
     */
    createInventoryItemSlots(inventory, centerX, centerY, width) {
        const elements = [];

        // 인벤토리 타이틀
        const inventoryTitle = this.scene.add.text(
            centerX,
            centerY - 200,
            '아이템',
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        elements.push(inventoryTitle);

        // 아이템이 없는 경우
        if (!inventory || inventory.length === 0) {
            const emptyText = this.scene.add.text(
                centerX,
                centerY,
                '인벤토리가 비어있습니다.',
                {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: this.COLORS.TEXT.SECONDARY
                }
            ).setOrigin(0.5, 0.5);

            elements.push(emptyText);
            return elements;
        }

        // 아이템 슬롯 설정
        const slotSize = 60;
        const padding = 10;
        const slotsPerRow = Math.floor(width / (slotSize + padding));
        const startX = centerX - (slotsPerRow * (slotSize + padding)) / 2 + slotSize / 2;
        const startY = centerY - 150;

        // 아이템 슬롯 생성
        inventory.forEach((item, index) => {
            const row = Math.floor(index / slotsPerRow);
            const col = index % slotsPerRow;

            const x = startX + col * (slotSize + padding);
            const y = startY + row * (slotSize + padding);

            // 아이템 희귀도에 따른 색상
            const rarityColor = this.COLORS.RARITY[item.rarity?.toUpperCase()] || this.COLORS.RARITY.COMMON;

            // 슬롯 배경
            const slotBg = this.scene.add.rectangle(
                x,
                y,
                slotSize,
                slotSize,
                0x222222,
                0.8
            ).setStrokeStyle(2, rarityColor);

            // 아이템 아이콘 (임시로 사각형으로 표시)
            const itemIcon = this.scene.add.rectangle(
                x,
                y,
                slotSize - 10,
                slotSize - 10,
                rarityColor,
                0.6
            );

            // 장착한 아이템인 경우 표시
            const isEquipped = this.checkIfItemEquipped(item.id);
            if (isEquipped) {
                const equippedMarker = this.scene.add.text(
                    x + slotSize / 2 - 8,
                    y - slotSize / 2 + 8,
                    'E',
                    {
                        fontFamily: 'Arial',
                        fontSize: '16px',
                        color: '#ffff00'
                    }
                ).setOrigin(0.5, 0.5);

                elements.push(equippedMarker);
            }

            // 소비 아이템인 경우 개수 표시
            if (item.type === 'consumable' && item.count > 1) {
                const countText = this.scene.add.text(
                    x + slotSize / 2 - 5,
                    y + slotSize / 2 - 5,
                    item.count.toString(),
                    {
                        fontFamily: 'Arial',
                        fontSize: '14px',
                        color: this.COLORS.TEXT.PRIMARY
                    }
                ).setOrigin(1, 1);

                elements.push(countText);
            }

            // 슬롯 상호작용 설정
            slotBg.setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    this.showItemTooltip(item, x, y + slotSize / 2 + 20);
                })
                .on('pointerout', () => {
                    this.hideItemTooltip();
                })
                .on('pointerdown', () => {
                    this.onItemSlotClicked(item);
                });

            elements.push(slotBg, itemIcon);
        });

        return elements;
    }

    /**
     * 아이템이 장착되었는지 확인
     * @param {string} itemId - 확인할 아이템 ID
     * @returns {boolean} 장착 여부
     */
    checkIfItemEquipped(itemId) {
        const player = this.scene.player;

        if (!player || !player.equipment) return false;

        // 장비 슬롯 확인
        for (const slot in player.equipment) {
            if (player.equipment[slot] === itemId) {
                return true;
            }
        }

        return false;
    }

    /**
     * 아이템 툴팁 표시
     * @param {Object} item - 아이템 객체
     * @param {number} x - 툴팁 X 좌표
     * @param {number} y - 툴팁 Y 좌표
     */
    showItemTooltip(item, x, y) {
        // 이전 툴팁 제거
        this.hideItemTooltip();

        // 희귀도 색상
        const rarityColor = this.getRarityColorString(item.rarity);

        // 툴팁 텍스트 생성
        const itemName = item.name || item.id;
        const rarityName = this.capitalizeFirstLetter(item.rarity || 'common');
        const itemType = this.getItemTypeText(item.type, item.subType);

        let tooltipText = `${itemName}\n[${rarityName}] ${itemType}`;

        // 무기/방어구인 경우 추가 속성 표시
        if (item.type === 'weapon' && item.attack) {
            tooltipText += `\n공격력: +${item.attack}`;
        } else if (item.type === 'armor' && item.defense) {
            tooltipText += `\n방어력: +${item.defense}`;
        }

        // 추가 속성 표시
        if (item.attributes && item.attributes.length > 0) {
            tooltipText += '\n\n추가 속성:';
            item.attributes.forEach(attr => {
                tooltipText += `\n${this.getAttributeText(attr)}`;
            });
        }

        // 특수 효과 표시
        if (item.specialEffect && item.specialEffect.length > 0) {
            tooltipText += '\n\n특수 효과:';
            item.specialEffect.forEach(effect => {
                tooltipText += `\n${this.getSpecialEffectText(effect)}`;
            });
        }

        // 소비 아이템인 경우 효과 표시
        if (item.type === 'consumable') {
            tooltipText += '\n\n효과:';
            if (item.potionType) {
                tooltipText += `\n${this.getPotionEffectText(item)}`;
            } else if (item.scrollType) {
                tooltipText += `\n${this.getScrollEffectText(item)}`;
            }
        }

        // 레벨 요구치 표시
        if (item.requiredLevel) {
            tooltipText += `\n\n필요 레벨: ${item.requiredLevel}`;
        }

        // 툴팁 배경
        const tooltipBg = this.scene.add.rectangle(
            x,
            y,
            300,
            200,
            0x000000,
            0.9
        ).setStrokeStyle(2, parseInt(rarityColor.replace('#', '0x')))
            .setOrigin(0.5, 0);

        // 툴팁 텍스트
        const tooltip = this.scene.add.text(
            x - tooltipBg.width / 2 + 10,
            y + 10,
            tooltipText,
            {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: rarityColor,
                lineSpacing: 5
            }
        );

        // 툴팁 배경 크기 조정
        tooltipBg.height = tooltip.height + 20;

        // 툴팁 객체 저장
        this.currentTooltip = {
            bg: tooltipBg,
            text: tooltip
        };

        // 인벤토리 컨테이너에 추가
        this.containers.inventory.add([tooltipBg, tooltip]);
    }

    /**
     * 아이템 툴팁 숨기기
     */
    hideItemTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.bg.destroy();
            this.currentTooltip.text.destroy();
            this.currentTooltip = null;
        }
    }

    /**
     * 아이템 슬롯 클릭 처리
     * @param {Object} item - 클릭한 아이템 객체
     */
    onItemSlotClicked(item) {
        // 아이템 사용 또는 장착 메뉴 표시
        this.showItemActionMenu(item);
    }

    /**
     * 아이템 액션 메뉴 표시
     * @param {Object} item - 대상 아이템 객체
     */
    showItemActionMenu(item) {
        // 이전 메뉴 제거
        this.hideItemActionMenu();

        const { width, height } = this.scene.scale;

        // 메뉴 배경
        const menuBg = this.scene.add.rectangle(
            width / 2,
            height / 2,
            200,
            250,
            0x000000,
            0.9
        ).setStrokeStyle(2, 0xaaaaaa);

        // 아이템 이름
        const itemName = this.scene.add.text(
            width / 2,
            height / 2 - 100,
            item.name || item.id,
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 액션 버튼 생성
        const actions = [];

        // 아이템 타입에 따른 액션
        if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
            actions.push({
                text: this.checkIfItemEquipped(item.id) ? '장착 해제' : '장착',
                action: () => this.equipItem(item)
            });
        }

        if (item.type === 'consumable') {
            actions.push({
                text: '사용',
                action: () => this.useItem(item)
            });
        }

        // 공통 액션
        actions.push({
            text: '버리기',
            action: () => this.dropItem(item)
        });

        actions.push({
            text: '취소',
            action: () => this.hideItemActionMenu()
        });

        // 액션 버튼 생성
        const actionButtons = [];
        actions.forEach((action, index) => {
            const button = this.scene.add.rectangle(
                width / 2,
                height / 2 - 50 + index * 40,
                180,
                30,
                this.COLORS.PRIMARY,
                0.8
            ).setInteractive({ useHandCursor: true })
                .on('pointerdown', action.action);

            const buttonText = this.scene.add.text(
                width / 2,
                height / 2 - 50 + index * 40,
                action.text,
                {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            ).setOrigin(0.5, 0.5);

            actionButtons.push(button, buttonText);
        });

        // 메뉴 저장
        this.itemActionMenu = {
            bg: menuBg,
            title: itemName,
            buttons: actionButtons
        };

        // 컨테이너에 추가
        this.containers.inventory.add([menuBg, itemName, ...actionButtons]);
    }

    /**
     * 아이템 액션 메뉴 숨기기
     */
    hideItemActionMenu() {
        if (this.itemActionMenu) {
            this.itemActionMenu.bg.destroy();
            this.itemActionMenu.title.destroy();
            this.itemActionMenu.buttons.forEach(button => button.destroy());
            this.itemActionMenu = null;
        }
    }

    /**
     * 아이템 장착
     * @param {Object} item - 장착할 아이템 객체
     */
    equipItem(item) {
        // 인벤토리 시스템을 통해 아이템 장착
        this.scene.inventorySystem.equipItem(item.id);

        // 아이템 액션 메뉴 닫기
        this.hideItemActionMenu();

        // 인벤토리 UI 갱신
        this.refreshInventory();
    }

    /**
     * 아이템 사용
     * @param {Object} item - 사용할 아이템 객체
     */
    useItem(item) {
        // 인벤토리 시스템을 통해 아이템 사용
        this.scene.inventorySystem.useItem(item.id);

        // 아이템 액션 메뉴 닫기
        this.hideItemActionMenu();

        // 인벤토리 UI 갱신
        this.refreshInventory();
    }

    /**
     * 아이템 버리기
     * @param {Object} item - 버릴 아이템 객체
     */
    dropItem(item) {
        // 인벤토리 시스템을 통해 아이템 제거
        this.scene.inventorySystem.removeItem(item.id, 1);

        // 아이템 액션 메뉴 닫기
        this.hideItemActionMenu();

        // 인벤토리 UI 갱신
        this.refreshInventory();
    }

    /**
     * 인벤토리 UI 갱신
     */
    refreshInventory() {
        // 인벤토리 데이터 가져오기
        const inventory = this.scene.inventorySystem.getInventory();
        const player = this.scene.player;

        // 인벤토리 UI 갱신
        this.showInventory(inventory, player);
    }

    /**
     * 인벤토리 닫기
     */
    closeInventory() {
        if (this.containers.inventory) {
            this.containers.inventory.visible = false;
        }

        this.activeUI = null;

        // 일시 정지 해제
        this.scene.resumeGame();
    }

    //=========================================================
    //==================== 상점 관련 메서드 =====================
    //=========================================================

    /**
     * 상점 창 열기
     * @param {Array} merchantInventory - 상인 인벤토리 아이템 배열
     */
    openMerchantShop(merchantInventory) {
        // 기존 상점 컨테이너 초기화
        if (!this.containers.shop) {
            this.containers.shop = this.scene.add.container(0, 0)
                .setDepth(this.depths.content)
                .setScrollFactor(0);
        } else {
            this.clearContainer(this.containers.shop);
        }

        const { width, height } = this.scene.scale;

        // 배경 오버레이
        const overlay = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x000000,
            0.7
        );

        // 상점 패널
        const panel = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width - 200,
            height - 150,
            this.COLORS.PRIMARY,
            0.9
        ).setStrokeStyle(2, 0xccaa00);

        // 상점 제목
        const titleText = this.scene.add.text(
            width / 2,
            height / 2 - panel.height / 2 + 30,
            '상인의 상점',
            {
                fontFamily: 'Arial',
                fontSize: '28px',
                color: this.COLORS.TEXT.ACCENT
            }
        ).setOrigin(0.5, 0.5);

        // 닫기 버튼
        const closeButton = this.scene.add.text(
            width / 2 + panel.width / 2 - 20,
            height / 2 - panel.height / 2 + 20,
            'X',
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#ff0000'
            }
        ).setOrigin(0.5, 0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.closeMerchantShop();
            });

        // 플레이어 골드 표시
        const goldIcon = this.scene.add.rectangle(
            width / 2 - 100,
            height / 2 - panel.height / 2 + 80,
            20,
            20,
            this.COLORS.ACCENT
        );

        const goldText = this.scene.add.text(
            width / 2 - 70,
            height / 2 - panel.height / 2 + 80,
            `골드: ${this.scene.player.gold || 0}`,
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: this.COLORS.TEXT.ACCENT
            }
        ).setOrigin(0, 0.5);

        // 상점 아이템 슬롯 생성
        const shopItems = this.createShopItemSlots(merchantInventory, width / 2, height / 2);

        // 컨테이너에 추가
        this.containers.shop.add([
            overlay, panel, titleText, closeButton,
            goldIcon, goldText, ...shopItems
        ]);

        // 상점 표시
        this.containers.shop.visible = true;
        this.activeUI = 'shop';
    }

    /**
     * 상점 아이템 슬롯 생성
     * @param {Array} merchantInventory - 상인 인벤토리 아이템 배열
     * @param {number} centerX - 중앙 X 좌표
     * @param {number} centerY - 중앙 Y 좌표
     * @returns {Array} 생성된 UI 요소 배열
     */
    createShopItemSlots(merchantInventory, centerX, centerY) {
        const elements = [];

        // 아이템이 없는 경우
        if (!merchantInventory || merchantInventory.length === 0) {
            const emptyText = this.scene.add.text(
                centerX,
                centerY,
                '상인의 물건이 없습니다.',
                {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: this.COLORS.TEXT.SECONDARY
                }
            ).setOrigin(0.5, 0.5);

            elements.push(emptyText);
            return elements;
        }

        // 아이템 슬롯 설정
        const slotWidth = 300;
        const slotHeight = 80;
        const padding = 10;
        const startY = centerY - 100;

        // 상점 아이템 슬롯 생성
        merchantInventory.forEach((item, index) => {
            const y = startY + index * (slotHeight + padding);

            // 슬롯 배경
            const slotBg = this.scene.add.rectangle(
                centerX,
                y,
                slotWidth,
                slotHeight,
                0x222222,
                0.8
            ).setStrokeStyle(2, 0x666666);

            // 아이템 희귀도 색상
            const rarityColor = this.COLORS.RARITY[item.rarity?.toUpperCase()] || this.COLORS.RARITY.COMMON;

            // 아이템 아이콘 (임시로 사각형으로 표시)
            const itemIcon = this.scene.add.rectangle(
                centerX - slotWidth / 2 + 30,
                y,
                slotHeight - 20,
                slotHeight - 20,
                rarityColor,
                0.6
            );

            // 아이템 이름
            const itemName = this.scene.add.text(
                centerX - slotWidth / 2 + 70,
                y - 15,
                item.name || item.id,
                {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: this.getRarityColorString(item.rarity)
                }
            );

            // 아이템 설명 (타입)
            const itemType = this.getItemTypeText(item.type, item.subType);
            const itemDesc = this.scene.add.text(
                centerX - slotWidth / 2 + 70,
                y + 10,
                itemType,
                {
                    fontFamily: 'Arial',
                    fontSize: '14px',
                    color: this.COLORS.TEXT.SECONDARY
                }
            );

            // 아이템 가격
            const priceText = this.scene.add.text(
                centerX + slotWidth / 2 - 20,
                y,
                `${item.price}`,
                {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: this.COLORS.TEXT.ACCENT
                }
            ).setOrigin(1, 0.5);

            // 구매 버튼
            const buyButton = this.scene.add.rectangle(
                centerX + slotWidth / 2 - 80,
                y,
                60,
                30,
                0x004400,
                0.8
            ).setStrokeStyle(1, 0x008800);

            const buyText = this.scene.add.text(
                centerX + slotWidth / 2 - 80,
                y,
                '구매',
                {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: '#00ff00'
                }
            ).setOrigin(0.5, 0.5);

            // 구매 버튼 상호작용
            buyButton.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.buyItem(item);
                });

            // 슬롯 상호작용 설정 (툴팁 표시)
            slotBg.setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    this.showItemTooltip(item, centerX, y + slotHeight / 2 + 20);
                })
                .on('pointerout', () => {
                    this.hideItemTooltip();
                });

            elements.push(slotBg, itemIcon, itemName, itemDesc, priceText, buyButton, buyText);
        });

        return elements;
    }

    /**
     * 아이템 구매
     * @param {Object} item - 구매할 아이템 객체
     */
    buyItem(item) {
        // 골드 확인
        if (this.scene.player.gold < item.price) {
            this.showNotification('골드가 부족합니다!', this.COLORS.STATUS.DANGER);
            return;
        }

        // 인벤토리 공간 확인 (30개로 가정)
        if (this.scene.inventorySystem.getInventory().length >= 30) {
            this.showNotification('인벤토리가 가득 찼습니다!', this.COLORS.STATUS.DANGER);
            return;
        }

        // 골드 차감
        this.scene.player.gold -= item.price;

        // 아이템 추가
        this.scene.inventorySystem.addItem(item);

        // 구매 알림
        this.showNotification(`${item.name || item.id} 구매 완료!`, this.COLORS.STATUS.SUCCESS);

        // 상점 UI 갱신
        this.refreshShop();
    }

    /**
     * 상점 UI 갱신
     */
    refreshShop() {
        // 상인 인벤토리 다시 가져오기
        const merchantInventory = this.scene.currentRoom?.entities?.find(e => e.type === 'merchant')?.inventory;

        // 상점 UI 갱신
        this.openMerchantShop(merchantInventory);
    }

    /**
     * 상점 닫기
     */
    closeMerchantShop() {
        if (this.containers.shop) {
            this.containers.shop.visible = false;
        }

        this.activeUI = null;

        // 일시 정지 해제
        this.scene.resumeGame();
    }

    //=========================================================
    //=================== 메뉴 관련 메서드 =====================
    //=========================================================

    /**
     * 일시 정지 메뉴 표시
     */
    showPauseMenu() {
        // 기존 일시 정지 메뉴 초기화
        if (!this.containers.menu) {
            this.containers.menu = this.scene.add.container(0, 0)
                .setDepth(this.depths.content)
                .setScrollFactor(0);
        } else {
            this.clearContainer(this.containers.menu);
        }

        const { width, height } = this.scene.scale;

        // 배경 오버레이
        const overlay = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            0x000000,
            0.7
        );

        // 메뉴 패널
        const panel = this.scene.add.rectangle(
            width / 2,
            height / 2,
            300,
            400,
            0x222222,
            0.9
        ).setStrokeStyle(2, 0xaaaaaa);

        // 제목
        const titleText = this.scene.add.text(
            width / 2,
            height / 2 - 150,
            '일시 정지',
            {
                fontFamily: 'Arial',
                fontSize: '32px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 메뉴 버튼 생성
        const menuItems = [
            {
                text: '게임으로 돌아가기',
                action: () => this.hidePauseMenu()
            },
            {
                text: '인벤토리',
                action: () => {
                    this.hidePauseMenu();
                    this.scene.openInventory();
                }
            },
            {
                text: '게임 저장',
                action: () => this.saveGame()
            },
            {
                text: '설정',
                action: () => this.showSettings()
            },
            {
                text: '메인 메뉴로',
                action: () => this.confirmExitToMainMenu()
            }
        ];

        // 버튼 생성
        const buttons = [];
        menuItems.forEach((item, index) => {
            const buttonY = height / 2 - 70 + index * 60;

            const button = this.scene.add.rectangle(
                width / 2,
                buttonY,
                250,
                50,
                this.COLORS.PRIMARY,
                0.8
            ).setStrokeStyle(2, 0x666666);

            const buttonText = this.scene.add.text(
                width / 2,
                buttonY,
                item.text,
                {
                    fontFamily: 'Arial',
                    fontSize: '20px',
                    color: this.COLORS.TEXT.PRIMARY
                }
            ).setOrigin(0.5, 0.5);

            // 버튼 상호작용 설정
            button.setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    button.fillColor = 0x444444;
                })
                .on('pointerout', () => {
                    button.fillColor = this.COLORS.PRIMARY;
                })
                .on('pointerdown', () => {
                    item.action();
                });

            buttons.push(button, buttonText);
        });

        // 컨테이너에 추가
        this.containers.menu.add([overlay, panel, titleText, ...buttons]);

        // 메뉴 표시
        this.containers.menu.visible = true;
        this.activeUI = 'menu';
    }

    /**
     * 일시 정지 메뉴 숨기기
     */
    hidePauseMenu() {
        if (this.containers.menu) {
            this.containers.menu.visible = false;
        }

        this.activeUI = null;

        // 일시 정지 해제
        this.scene.resumeGame();
    }

    /**
     * 게임 저장
     */
    saveGame() {
        // 게임 데이터 저장
        this.game.saveGameData()
            .then(success => {
                if (success) {
                    this.showNotification('게임이 저장되었습니다.', this.COLORS.STATUS.SUCCESS);
                } else {
                    this.showNotification('게임 저장에 실패했습니다.', this.COLORS.STATUS.DANGER);
                }
            })
            .catch(() => {
                this.showNotification('게임 저장 중 오류가 발생했습니다.', this.COLORS.STATUS.DANGER);
            });
    }

    /**
     * 설정 화면 표시
     */
    showSettings() {
        // 개발 중 메시지
        this.showNotification('설정 기능은 아직 개발 중입니다.', this.COLORS.STATUS.WARNING);
    }

    /**
     * 메인 메뉴 나가기 확인
     */
    confirmExitToMainMenu() {
        // 이전 확인 창 초기화
        if (this.confirmDialog) {
            this.confirmDialog.bg.destroy();
            this.confirmDialog.text.destroy();
            this.confirmDialog.buttons.forEach(button => button.destroy());
            this.confirmDialog = null;
        }

        const { width, height } = this.scene.scale;

        // 확인 창 배경
        const dialogBg = this.scene.add.rectangle(
            width / 2,
            height / 2,
            400,
            200,
            0x000000,
            0.9
        ).setStrokeStyle(2, 0xff0000);

        // 확인 메시지
        const dialogText = this.scene.add.text(
            width / 2,
            height / 2 - 50,
            '메인 메뉴로 돌아가시겠습니까?\n저장되지 않은 진행사항은 유실됩니다.',
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: this.COLORS.TEXT.PRIMARY,
                align: 'center'
            }
        ).setOrigin(0.5, 0.5);

        // 확인 버튼
        const confirmButton = this.scene.add.rectangle(
            width / 2 - 100,
            height / 2 + 30,
            150,
            40,
            0x660000,
            0.8
        ).setStrokeStyle(2, 0xff0000);

        const confirmText = this.scene.add.text(
            width / 2 - 100,
            height / 2 + 30,
            '확인',
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 취소 버튼
        const cancelButton = this.scene.add.rectangle(
            width / 2 + 100,
            height / 2 + 30,
            150,
            40,
            this.COLORS.PRIMARY,
            0.8
        ).setStrokeStyle(2, 0xaaaaaa);

        const cancelText = this.scene.add.text(
            width / 2 + 100,
            height / 2 + 30,
            '취소',
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 버튼 상호작용 설정
        confirmButton.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // 메인 메뉴로 이동
                this.scene.scene.start('MainMenu');
            });

        cancelButton.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // 확인 창 닫기
                this.closeConfirmDialog();
            });

        // 확인 창 저장
        this.confirmDialog = {
            bg: dialogBg,
            text: dialogText,
            buttons: [confirmButton, confirmText, cancelButton, cancelText]
        };

        // 컨테이너에 추가
        this.containers.menu.add([dialogBg, dialogText, confirmButton, confirmText, cancelButton, cancelText]);
    }

    /**
     * 확인 창 닫기
     */
    closeConfirmDialog() {
        if (this.confirmDialog) {
            this.confirmDialog.bg.destroy();
            this.confirmDialog.text.destroy();
            this.confirmDialog.buttons.forEach(button => button.destroy());
            this.confirmDialog = null;
        }
    }

    /**
     * 게임 오버 화면 표시
     * @param {boolean} isVictory - 승리 여부
     * @param {Object} stats - 게임 통계 객체
     */
    showGameOverScreen(isVictory, stats) {
        // 기존 게임 오버 화면 초기화
        if (!this.containers.gameOver) {
            this.containers.gameOver = this.scene.add.container(0, 0)
                .setDepth(this.depths.foreground)
                .setScrollFactor(0);
        } else {
            this.clearContainer(this.containers.gameOver);
        }

        const { width, height } = this.scene.scale;

        // 배경 오버레이
        const overlay = this.scene.add.rectangle(
            width / 2,
            height / 2,
            width,
            height,
            isVictory ? 0x000066 : 0x660000,
            0.8
        );

        // 타이틀 텍스트
        const titleText = this.scene.add.text(
            width / 2,
            height / 3 - 50,
            isVictory ? '던전 클리어!' : '게임 오버',
            {
                fontFamily: 'Arial',
                fontSize: '48px',
                color: isVictory ? '#ffff00' : '#ff0000',
                stroke: '#000000',
                strokeThickness: 5
            }
        ).setOrigin(0.5, 0.5);

        // 기본 통계 객체
        const defaultStats = {
            dungeonName: '알 수 없는 던전',
            difficulty: '보통',
            timeElapsed: 0,
            roomsExplored: 0,
            totalRooms: 0,
            monstersKilled: 0,
            itemsCollected: 0,
            goldEarned: 0
        };

        // 통계 병합
        const gameStats = { ...defaultStats, ...stats };

        // 던전 정보
        const dungeonText = this.scene.add.text(
            width / 2,
            height / 3,
            `던전: ${gameStats.dungeonName} (난이도 ${gameStats.difficulty})`,
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 플레이 통계
        const statsTexts = [];
        const statsY = height / 2 - 50;

        // 단위 변환 (밀리초 -> 분:초)
        const convertTime = (ms) => {
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        // 통계 항목
        const statsItems = [
            `진행 시간: ${convertTime(gameStats.timeElapsed)}`,
            `탐험한 방: ${gameStats.roomsExplored} / ${gameStats.totalRooms}`,
            `처치한 몬스터: ${gameStats.monstersKilled}`,
            `획득한 아이템: ${gameStats.itemsCollected}`,
            `획득한 골드: ${gameStats.goldEarned}`
        ];

        // 통계 텍스트 생성
        statsItems.forEach((stat, index) => {
            const statText = this.scene.add.text(
                width / 2,
                statsY + index * 30,
                stat,
                {
                    fontFamily: 'Arial',
                    fontSize: '20px',
                    color: this.COLORS.TEXT.SECONDARY
                }
            ).setOrigin(0.5, 0.5);

            statsTexts.push(statText);
        });

        // 계속하기 버튼
        const continueButton = this.scene.add.rectangle(
            width / 2,
            height * 2 / 3 + 50,
            250,
            60,
            this.COLORS.PRIMARY,
            0.8
        ).setStrokeStyle(2, 0xaaaaaa);

        const continueText = this.scene.add.text(
            width / 2,
            height * 2 / 3 + 50,
            '허브로 귀환',
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: this.COLORS.TEXT.PRIMARY
            }
        ).setOrigin(0.5, 0.5);

        // 버튼 상호작용 설정
        continueButton.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                continueButton.fillColor = 0x444444;
            })
            .on('pointerout', () => {
                continueButton.fillColor = this.COLORS.PRIMARY;
            })
            .on('pointerdown', () => {
                this.scene.returnToHub();
            });

        // 컨테이너에 추가
        this.containers.gameOver.add([
            overlay, titleText, dungeonText,
            ...statsTexts,
            continueButton, continueText
        ]);

        // 게임 오버 화면 표시
        this.containers.gameOver.visible = true;
    }

    //=========================================================
    //=================== 유틸리티 메서드 ======================
    //=========================================================

    /**
     * 아이템 타입 텍스트 가져오기
     * @param {string} type - 아이템 타입
     * @param {string} subType - 아이템 서브타입
     * @returns {string} 타입 텍스트
     */
    getItemTypeText(type, subType) {
        const typeNames = {
            weapon: '무기',
            armor: '방어구',
            accessory: '장신구',
            consumable: '소비 아이템',
            material: '재료',
            special: '특수 아이템',
            legacy: '레거시 아이템'
        };

        const subTypeNames = {
            // 무기
            sword: '검',
            axe: '도끼',
            mace: '철퇴',
            spear: '창',
            bow: '활',
            staff: '지팡이',
            dagger: '단검',
            wand: '완드',

            // 방어구
            helmet: '투구',
            chest: '갑옷',
            gloves: '장갑',
            boots: '신발',
            shield: '방패',

            // 장신구
            ring: '반지',
            amulet: '목걸이',
            bracelet: '팔찌',
            belt: '벨트',
            cloak: '망토',

            // 소비 아이템
            potion: '포션',
            scroll: '스크롤',
            food: '음식',
            bomb: '폭탄'
        };

        const typeName = typeNames[type] || type;
        const subTypeName = subType ? (subTypeNames[subType] || subType) : '';

        return subTypeName ? `${typeName} - ${subTypeName}` : typeName;
    }

    /**
     * 아이템 속성 텍스트 가져오기
     * @param {Object} attribute - 속성 객체
     * @returns {string} 속성 텍스트
     */
    getAttributeText(attribute) {
        const attrNames = {
            hp_bonus: 'HP',
            mp_bonus: 'MP',
            hp_regen: 'HP 회복',
            mp_regen: 'MP 회복',
            attack_bonus: '공격력',
            critical_chance: '치명타 확률',
            critical_damage: '치명타 대미지',
            attack_speed: '공격 속도',
            elemental_damage: '원소 대미지',
            defense_bonus: '방어력',
            damage_reduction: '대미지 감소',
            elemental_resistance: '원소 저항',
            status_resistance: '상태이상 저항',
            max_hp_percent: '최대 HP',
            gold_find: '골드 획득량',
            item_find: '아이템 획득 확률',
            experience_bonus: '경험치 획득량',
            skill_cooldown: '스킬 쿨다운 감소',
            dodge_chance: '회피 확률',
            movement_speed: '이동 속도'
        };

        const name = attrNames[attribute.type] || attribute.type;
        let value = attribute.value;

        // 퍼센트로 표시할 속성들
        const percentAttributes = [
            'critical_chance', 'critical_damage', 'attack_speed',
            'damage_reduction', 'elemental_resistance', 'status_resistance',
            'max_hp_percent', 'gold_find', 'item_find', 'experience_bonus',
            'skill_cooldown', 'dodge_chance', 'movement_speed'
        ];

        const valueText = percentAttributes.includes(attribute.type) ? `${value}%` : value;

        return `${name} +${valueText}`;
    }

    /**
     * 특수 효과 텍스트 가져오기
     * @param {Object} effect - 효과 객체
     * @returns {string} 효과 텍스트
     */
    getSpecialEffectText(effect) {
        const effectNames = {
            life_steal: '생명력 흡수',
            execute_damage: '처형 대미지',
            armor_break: '방어구 관통',
            elemental_burst: '원소 폭발',
            bleed: '출혈',
            stun: '기절',
            knock_back: '넉백',
            magic_find: '마법 아이템 발견',
            gold_find: '골드 획득량'
        };

        const name = effectNames[effect.type] || effect.type;
        return `${name}: ${effect.value}%`;
    }

    /**
     * 포션 효과 텍스트 가져오기
     * @param {Object} item - 포션 아이템 객체
     * @returns {string} 포션 효과 텍스트
     */
    getPotionEffectText(item) {
        const potionEffects = {
            health: 'HP를 회복합니다',
            mana: 'MP를 회복합니다',
            strength: '일시적으로 공격력이 증가합니다',
            defense: '일시적으로 방어력이 증가합니다',
            speed: '일시적으로 이동 속도가 증가합니다'
        };

        return `${potionEffects[item.potionType] || ''} (${item.effectValue || 0})`;
    }

    /**
     * 스크롤 효과 텍스트 가져오기
     * @param {Object} item - 스크롤 아이템 객체
     * @returns {string} 스크롤 효과 텍스트
     */
    getScrollEffectText(item) {
        const scrollEffects = {
            teleport: '즉시 안전한 장소로 이동합니다',
            identify: '모든 아이템을 감정합니다',
            enchant: '장착 중인 무기를 강화합니다',
            fireball: '대규모 화염 대미지를 입힙니다',
            frost: '적들을 빙결시킵니다',
            lightning: '여러 적에게 연쇄 번개 대미지를 입힙니다',
            healing: '광역 치유 효과를 발동합니다',
            protection: '일시적인 대미지 보호막을 생성합니다'
        };

        return `${scrollEffects[item.scrollType] || ''} (${item.effectValue || 0})`;
    }

    /**
     * 희귀도 색상 문자열 가져오기
     * @param {string} rarity - 희귀도
     * @returns {string} 색상 16진수 문자열 (#rrggbb)
     */
    getRarityColorString(rarity) {
        const rarityColors = {
            common: '#ffffff',
            uncommon: '#00ff00',
            rare: '#0066ff',
            epic: '#aa00ff',
            legendary: '#ff9900',
            mythic: '#ff0000'
        };

        return rarityColors[rarity] || '#ffffff';
    }

    /**
     * 첫 글자를 대문자로 변환
     * @param {string} string - 변환할 문자열
     * @returns {string} 변환된 문자열
     */
    capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}

export default UserInterface;