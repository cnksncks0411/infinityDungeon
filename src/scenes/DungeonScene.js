// src/scenes/Dungeon.js
import Phaser from 'phaser';
import Player from '../entities/Player';
import DungeonGenerator from '../systems/DungeonGenerator';
import CombatSystem from '../systems/CombatSystem';
import ClassSystem from '../systems/ClassSystem';
import InventorySystem from '../systems/InventorySystem';
import EffectsManager from '../systems/EffectsManager';
import UIManager from '../ui/UserInterface';

class DungeonScene extends Phaser.Scene {
    constructor() {
        super('Dungeon');

        // 시스템 초기화
        this.dungeonGenerator = null;
        this.combatSystem = null;
        this.classSystem = null;
        this.inventorySystem = null;
        this.effectsManager = null;
        this.uiManager = null;

        // 던전 상태
        this.currentDungeon = null;
        this.player = null;
        this.enemies = [];
        this.summons = [];
        this.allies = [];
        this.items = [];
        this.traps = [];

        // 게임 상태
        this.isPaused = false;
        this.gameOver = false;
        this.dungeonStartTime = 0;
        this.elapsedTime = 0;

        // 키보드 입력
        this.cursors = null;
        this.actionKeys = null;

        // 카메라
        this.targetCameraZoom = 1;
    }

    init(data) {
        // 데이터 초기화
        this.dungeonId = data.dungeonId || 'sword_forest';
        this.difficulty = data.difficulty || 1;
        this.selectedClass = data.selectedClass || 'warrior';

        // 시간 초기화
        this.dungeonStartTime = Date.now();
        this.elapsedTime = 0;

        // 게임 상태 초기화
        this.isPaused = false;
        this.gameOver = false;

        // 던전 진행도
        this.exploredRooms = 0;
        this.totalRooms = 0;
    }

    preload() {
        // 필요한 에셋 로드 (이미 Boot 씬에서 대부분 로드됨)
        // 던전 특정 에셋이 필요한 경우 여기서 로드
    }

    create() {
        // 시스템 초기화
        this.initSystems();

        // 던전 생성
        this.generateDungeon();

        // 플레이어 생성
        this.createPlayer();

        // 방 탐색 시작
        this.exploreCurrentRoom();

        // 입력 설정
        this.setupInput();

        // UI 설정
        this.setupUI();

        // 카메라 설정
        this.setupCamera();

        // 이벤트 리스너 설정
        this.setupEventListeners();

        // 던전 시작 이벤트
        this.events.emit('dungeonStarted', {
            dungeonId: this.dungeonId,
            difficulty: this.difficulty,
            selectedClass: this.selectedClass
        });

        // 배경 음악 재생
        this.sound.play('dungeon_music', {
            loop: true,
            volume: 0.5
        });
    }

    update(time, delta) {
        // 게임 중지 상태면 업데이트 건너뜀
        if (this.isPaused || this.gameOver) return;

        // 시간 업데이트
        this.updateGameTime();

        // 플레이어 입력 및 이동 처리
        this.handlePlayerInput();

        // 적 AI 업데이트
        this.updateEnemies(delta);

        // 소환수 업데이트
        this.updateSummons(delta);

        // 방 탐색 체크
        this.checkRoomExploration();

        // 충돌 감지
        this.checkCollisions();

        // 트랩 감지
        this.checkTraps();

        // 아이템 획득 체크
        this.checkItemPickup();

        // 카메라 업데이트
        this.updateCamera();

        // UI 업데이트
        this.uiManager.update(delta);

        // 전투 시스템 효과 업데이트
        this.combatSystem.updateDamageNumbers(delta);
    }

    render() {
        // 대미지 숫자 렌더링
        this.combatSystem.renderDamageNumbers(this.renderer);
    }

    // === 초기화 메서드 ===

    initSystems() {
        // 시스템 초기화
        this.dungeonGenerator = new DungeonGenerator(this);
        this.combatSystem = new CombatSystem(this);
        this.classSystem = new ClassSystem(this);
        this.inventorySystem = new InventorySystem(this);
        this.effectsManager = new EffectsManager(this);
        this.uiManager = new UIManager(this);

        // 게임 데이터 참조
        this.gameData = this.game.gameData;
    }

    setupInput() {
        // 방향키 설정
        this.cursors = this.input.keyboard.createCursorKeys();

        // 액션 키 설정
        this.actionKeys = {
            attack: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            skill1: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
            skill2: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            skill3: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            skill4: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
            interact: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
            inventory: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I),
            pause: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
        };

        // 일시 정지 키 이벤트
        this.actionKeys.pause.on('down', () => {
            this.togglePause();
        });

        // 인벤토리 키 이벤트
        this.actionKeys.inventory.on('down', () => {
            this.openInventory();
        });
    }

    setupCamera() {
        // 카메라 설정
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(1.5);
        this.targetCameraZoom = 1.5;

        // 던전 경계 설정
        const dungeonWidth = this.currentDungeon.width * this.tileSize;
        const dungeonHeight = this.currentDungeon.height * this.tileSize;
        this.cameras.main.setBounds(0, 0, dungeonWidth, dungeonHeight);

        // 페이드 인 효과
        this.cameras.main.fadeIn(1000, 0, 0, 0);
    }

    setupEventListeners() {
        // 던전 완료 이벤트
        this.events.on('bossDefeated', this.onBossDefeated, this);

        // 클래스 스킬 이벤트
        this.events.on('skillUsed', this.onSkillUsed, this);

        // 아이템 획득 이벤트
        this.events.on('itemPickup', this.onItemPickup, this);

        // 씬 종료 시 이벤트 정리
        this.events.once('shutdown', this.onSceneShutdown, this);
    }

    setupUI() {
        // UI 초기화
        this.uiManager.createDungeonUI({
            dungeonName: this.getDungeonName(),
            difficulty: this.difficulty,
            playerClass: this.selectedClass,
            floor: Math.ceil(this.difficulty / 3)
        });

        // 플레이어 HUD 업데이트
        this.updatePlayerHUD();

        // 미니맵 생성
        this.createMinimap();
    }

    // === 던전 생성 메서드 ===

    generateDungeon() {
        // 던전 생성
        this.currentDungeon = this.dungeonGenerator.generateDungeon(this.dungeonId, this.difficulty);

        // 타일 크기 설정
        this.tileSize = 32;

        // 던전 타일맵 생성
        this.createDungeonTilemap();

        // 총 방 개수 기록
        this.totalRooms = this.currentDungeon.rooms.length;

        // 몬스터 및 아이템 초기화
        this.enemies = [];
        this.items = [];
        this.traps = [];

        // 현재 방 설정 (시작방)
        this.currentRoom = this.currentDungeon.rooms[this.currentDungeon.startRoom];
    }

    createDungeonTilemap() {
        // 던전 맵 크기에 맞는 이차원 배열 생성
        const mapWidth = this.currentDungeon.width;
        const mapHeight = this.currentDungeon.height;

        // 던전 타입에 따른 타일셋 선택
        const dungeonType = this.currentDungeon.type;
        const tilesetKey = `tileset_${dungeonType}`;

        // 바닥, 벽, 물체 레이어를 위한 배열 초기화
        const floorLayer = Array(mapHeight).fill().map(() => Array(mapWidth).fill(-1));
        const wallLayer = Array(mapHeight).fill().map(() => Array(mapWidth).fill(-1));
        const objectLayer = Array(mapHeight).fill().map(() => Array(mapWidth).fill(-1));

        // 모든 방과 복도를 타일맵에 표시
        this.currentDungeon.rooms.forEach(room => {
            // 방 영역 바닥 채우기
            for (let y = room.y; y < room.y + room.height; y++) {
                for (let x = room.x; x < room.x + room.width; x++) {
                    if (y >= 0 && y < mapHeight && x >= 0 && x < mapWidth) {
                        // 방 유형에 따른 타일 설정
                        floorLayer[y][x] = this.getFloorTileIndex(room.type);
                        wallLayer[y][x] = -1; // 벽 제거

                        // 방 경계에 벽 추가
                        if (x === room.x || x === room.x + room.width - 1 ||
                            y === room.y || y === room.y + room.height - 1) {
                            wallLayer[y][x] = this.getWallTileIndex(room.type);
                        }
                    }
                }
            }

            // 문 추가
            room.doors.forEach(door => {
                const doorX = Math.floor(door.x);
                const doorY = Math.floor(door.y);

                if (doorY >= 0 && doorY < mapHeight && doorX >= 0 && doorX < mapWidth) {
                    wallLayer[doorY][doorX] = -1; // 벽에서 문 위치 제거
                    objectLayer[doorY][doorX] = this.getDoorTileIndex(room.type);
                }
            });

            // 특별한 오브젝트 배치 (방 유형에 따라)
            this.placeRoomObjects(room, objectLayer);
        });

        // 복도 그리기
        this.currentDungeon.doors.forEach(door => {
            const fromX = Math.floor(door.fromX);
            const fromY = Math.floor(door.fromY);
            const toX = Math.floor(door.toX);
            const toY = Math.floor(door.toY);

            // 복도 방향 확인
            const isHorizontal = Math.abs(fromX - toX) > Math.abs(fromY - toY);

            // 복도 그리기
            this.drawCorridor(fromX, fromY, toX, toY, isHorizontal, floorLayer, wallLayer);
        });

        // 타일맵 생성 및 레이어 설정
        const map = this.make.tilemap({
            tileWidth: this.tileSize,
            tileHeight: this.tileSize,
            width: mapWidth,
            height: mapHeight
        });

        // 타일셋 추가
        const tileset = map.addTilesetImage(tilesetKey);

        // 레이어 생성
        this.floorLayer = map.createBlankLayer('floor', tileset).fill(-1);
        this.wallLayer = map.createBlankLayer('walls', tileset).fill(-1);
        this.objectLayer = map.createBlankLayer('objects', tileset).fill(-1);

        // 레이어에 타일 데이터 채우기
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                if (floorLayer[y][x] !== -1) {
                    this.floorLayer.putTileAt(floorLayer[y][x], x, y);
                }
                if (wallLayer[y][x] !== -1) {
                    this.wallLayer.putTileAt(wallLayer[y][x], x, y);
                }
                if (objectLayer[y][x] !== -1) {
                    this.objectLayer.putTileAt(objectLayer[y][x], x, y);
                }
            }
        }

        // 충돌 설정
        this.wallLayer.setCollisionByExclusion([-1]);
        this.objectLayer.setCollisionByExclusion([-1]);

        // 데코레이션 (던전 타입에 따라 장식 추가)
        this.addDungeonDecorations(dungeonType);
    }

    drawCorridor(fromX, fromY, toX, toY, isHorizontal, floorLayer, wallLayer) {
        // 시작점과 끝점 정렬
        let startX = Math.min(fromX, toX);
        let endX = Math.max(fromX, toX);
        let startY = Math.min(fromY, toY);
        let endY = Math.max(fromY, toY);

        // 복도 그리기
        if (isHorizontal) {
            // 가로 복도
            for (let x = startX; x <= endX; x++) {
                // 바닥 타일
                floorLayer[fromY][x] = this.getCorridorFloorTile();

                // 벽 타일 (복도 위, 아래)
                if (fromY > 0) wallLayer[fromY - 1][x] = this.getCorridorWallTile();
                if (fromY < floorLayer.length - 1) wallLayer[fromY + 1][x] = this.getCorridorWallTile();
            }
        } else {
            // 세로 복도
            for (let y = startY; y <= endY; y++) {
                // 바닥 타일
                floorLayer[y][fromX] = this.getCorridorFloorTile();

                // 벽 타일 (복도 좌, 우)
                if (fromX > 0) wallLayer[y][fromX - 1] = this.getCorridorWallTile();
                if (fromX < floorLayer[0].length - 1) wallLayer[y][fromX + 1] = this.getCorridorWallTile();
            }
        }
    }

    placeRoomObjects(room, objectLayer) {
        // 방 중앙 좌표
        const centerX = Math.floor(room.centerX);
        const centerY = Math.floor(room.centerY);

        // 방 유형에 따라 다른 오브젝트 배치
        switch (room.type) {
            case 'entrance':
                // 입구 계단
                objectLayer[centerY][centerX] = this.getEntranceStairsTile();
                break;
            case 'boss':
                // 보스 방 장식
                objectLayer[centerY][centerX] = this.getBossRoomObjectTile();
                break;
            case 'treasure':
                // 보물 상자
                room.entities.forEach(entity => {
                    if (entity.type === 'chest') {
                        const x = Math.floor(entity.x);
                        const y = Math.floor(entity.y);
                        objectLayer[y][x] = this.getTreasureChestTile(entity.rarity);
                    }
                });
                break;
            case 'merchant':
                // 상인 NPC
                room.entities.forEach(entity => {
                    if (entity.type === 'merchant') {
                        const x = Math.floor(entity.x);
                        const y = Math.floor(entity.y);
                        objectLayer[y][x] = this.getMerchantTile();
                    }
                });
                break;
            case 'shrine':
                // 신단
                room.entities.forEach(entity => {
                    if (entity.type === 'shrine') {
                        const x = Math.floor(entity.x);
                        const y = Math.floor(entity.y);
                        objectLayer[y][x] = this.getShrineTile(entity.shrineType);
                    }
                });
                break;
        }
    }

    addDungeonDecorations(dungeonType) {
        // 던전 타입에 따른 장식 추가
        const decorations = {
            forest: ['tree', 'bush', 'mushroom', 'flower'],
            cave: ['stalagmite', 'crystal', 'rock', 'puddle'],
            ruins: ['pillar', 'statue', 'rubble', 'pot'],
            tower: ['bookshelf', 'desk', 'candelabra', 'carpet'],
            castle: ['banner', 'armor', 'weapon_rack', 'throne']
        };

        // 데코레이션 그룹 생성
        this.decorations = this.physics.add.group();

        // 해당 던전 타입의 장식 선택
        const availableDecorations = decorations[dungeonType] || decorations.ruins;

        // 각 방에 장식 추가
        this.currentDungeon.rooms.forEach(room => {
            // 특수 방은 이미 특별한 오브젝트가 있으므로 일반 방만 장식
            if (room.type === 'normal') {
                // 방 크기에 비례한 장식 개수
                const decorCount = Math.floor((room.width * room.height) / 30);

                for (let i = 0; i < decorCount; i++) {
                    // 랜덤 위치 (방 경계에서 1칸 안쪽)
                    const x = Phaser.Math.Between(room.x + 1, room.x + room.width - 2);
                    const y = Phaser.Math.Between(room.y + 1, room.y + room.height - 2);

                    // 랜덤 장식 타입
                    const decorType = Phaser.Utils.Array.GetRandom(availableDecorations);

                    // 장식 생성
                    this.createDecoration(x, y, decorType);
                }
            }
        });
    }

    createDecoration(x, y, decorType) {
        // 장식 스프라이트 생성
        const decoration = this.decorations.create(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            'decorations',
            `${decorType}_0${Phaser.Math.Between(1, 3)}`
        );

        // 충돌 조정 (일부 장식은 통과 가능)
        const nonCollidingTypes = ['flower', 'mushroom', 'puddle', 'carpet'];

        if (!nonCollidingTypes.includes(decorType)) {
            decoration.body.immovable = true;
        } else {
            decoration.body.checkCollision.none = true;
        }

        // 깊이 설정 (플레이어 뒤/앞)
        const behindPlayer = ['flower', 'mushroom', 'puddle', 'carpet'];
        decoration.setDepth(behindPlayer.includes(decorType) ? 5 : 15);

        return decoration;
    }

    // 타일 인덱스 가져오기 메서드들
    getFloorTileIndex(roomType) {
        // 방 유형에 따른 바닥 타일 인덱스
        const floorTiles = {
            entrance: 0,
            normal: 1,
            treasure: 2,
            challenge: 3,
            merchant: 4,
            shrine: 5,
            boss: 6
        };

        return floorTiles[roomType] || 1;
    }

    getWallTileIndex(roomType) {
        // 방 유형에 따른 벽 타일 인덱스
        const wallTiles = {
            entrance: 10,
            normal: 11,
            treasure: 12,
            challenge: 13,
            merchant: 14,
            shrine: 15,
            boss: 16
        };

        return wallTiles[roomType] || 11;
    }

    getDoorTileIndex(roomType) {
        // 방 유형에 따른 문 타일 인덱스
        return 20;
    }

    getCorridorFloorTile() {
        return 7;
    }

    getCorridorWallTile() {
        return 17;
    }

    getEntranceStairsTile() {
        return 30;
    }

    getBossRoomObjectTile() {
        return 31;
    }

    getTreasureChestTile(rarity) {
        // 희귀도에 따른 보물상자 타일
        const chestTiles = {
            common: 40,
            uncommon: 41,
            rare: 42,
            epic: 43,
            legendary: 44,
            mythic: 45
        };

        return chestTiles[rarity] || 40;
    }

    getMerchantTile() {
        return 50;
    }

    getShrineTile(shrineType) {
        // 신단 타입에 따른 타일
        const shrineTiles = {
            health: 60,
            strength: 61,
            defense: 62,
            speed: 63,
            mana: 64
        };

        return shrineTiles[shrineType] || 60;
    }

    // === 플레이어 관련 메서드 ===

    createPlayer() {
        // 시작 방 위치
        const startRoom = this.currentDungeon.rooms[this.currentDungeon.startRoom];
        const startX = startRoom.centerX * this.tileSize;
        const startY = startRoom.centerY * this.tileSize;

        // 플레이어 생성
        this.player = new Player(this, startX, startY, this.selectedClass);

        // 물리 설정
        this.physics.world.enable(this.player);
        this.player.body.setCollideWorldBounds(true);

        // 충돌 설정
        this.physics.add.collider(this.player, this.wallLayer);
        this.physics.add.collider(this.player, this.objectLayer, this.handleObjectCollision, null, this);

        // 플레이어 데이터 초기화
        this.initializePlayerData();

        // 카메라 팔로우
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }

    initializePlayerData() {
        // 플레이어 데이터 초기화
        const playerData = this.gameData.player;
        const classData = this.gameData.unlockedClasses.find(c => c.id === this.selectedClass);

        if (!classData) return;

        // 클래스 레벨 설정
        this.player.classId = this.selectedClass;
        this.player.level = classData.level;

        // 클래스 시스템을 통해 스탯 계산
        const stats = this.classSystem.calculateClassStats(this.selectedClass, classData.level);

        // 플레이어 스탯 설정
        this.player.stats = {
            hp: stats.hp,
            maxHp: stats.hp,
            mp: stats.mp,
            maxMp: stats.mp,
            attack: stats.attack,
            defense: stats.defense,
            speed: stats.speed,
            attackSpeed: 100 // 기본 공격 속도
        };

        // 전투 스탯 초기화
        this.player.combatStats = {
            critChance: 0.05,
            critMultiplier: 2.0,
            dodgeChance: 0.05,
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

        // 패시브 효과 적용
        const passiveEffects = this.classSystem.getPassiveEffects(this.selectedClass);
        this.combatSystem.applyPassiveEffects(passiveEffects);

        // 장비 적용
        if (playerData.equipment) {
            this.player.equipment = { ...playerData.equipment };
            this.combatSystem.applyEquipmentEffects();
        }

        // 스킬 설정
        this.player.skills = this.classSystem.getClassSkills(this.selectedClass);
    }

    handlePlayerInput() {
        if (!this.player.active || this.player.isStunned) return;

        // 이동 입력
        const speed = this.player.stats.speed / 50; // 스피드를 이동 단위로 변환
        let dx = 0;
        let dy = 0;

        if (this.cursors.left.isDown) {
            dx = -speed;
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            dx = speed;
            this.player.setFlipX(false);
        }

        if (this.cursors.up.isDown) {
            dy = -speed;
        } else if (this.cursors.down.isDown) {
            dy = speed;
        }

        // 대각선 이동 속도 정규화
        if (dx !== 0 && dy !== 0) {
            dx = dx / Math.sqrt(2);
            dy = dy / Math.sqrt(2);
        }

        // 플레이어 이동
        this.player.body.velocity.x = dx * 100;
        this.player.body.velocity.y = dy * 100;

        // 애니메이션 설정
        if (dx !== 0 || dy !== 0) {
            this.player.play(`${this.player.classId}_walk`, true);
        } else {
            this.player.play(`${this.player.classId}_idle`, true);
        }

        // 공격 입력
        if (this.actionKeys.attack.isDown) {
            this.handlePlayerAttack();
        }

        // 스킬 입력
        this.handleSkillInputs();

        // 상호작용 입력
        if (Phaser.Input.Keyboard.JustDown(this.actionKeys.interact)) {
            this.handleInteraction();
        }
    }

    handlePlayerAttack() {
        // 공격 쿨다운 확인
        if (this.combatSystem.isAttackOnCooldown()) return;

        // 가장 가까운 적 찾기
        const target = this.findNearestEnemy();

        if (target) {
            // 공격 범위 확인 (무기 유형에 따라 다름)
            const attackRange = this.getWeaponRange();

            // 적과의 거리 계산
            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                target.x, target.y
            );

            if (distance <= attackRange) {
                // 공격 애니메이션
                this.player.play(`${this.player.classId}_attack`, true);

                // 무기 유형 가져오기
                const weaponType = this.getEquippedWeaponType();

                // 공격 실행
                this.combatSystem.playerAttack(target, weaponType);

                // 공격 이펙트
                this.effectsManager.playAttackEffect(this.player, target, weaponType);
            }
        }
    }

    handleSkillInputs() {
        // 스킬 1-4 입력 확인
        if (Phaser.Input.Keyboard.JustDown(this.actionKeys.skill1)) {
            this.usePlayerSkill(0);
        } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.skill2)) {
            this.usePlayerSkill(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.skill3)) {
            this.usePlayerSkill(2);
        } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.skill4)) {
            this.usePlayerSkill(3);
        }
    }

    usePlayerSkill(skillIndex) {
        // 플레이어 스킬 목록 확인
        if (!this.player.skills || !this.player.skills[skillIndex]) return;

        const skill = this.player.skills[skillIndex];

        // 스킬 타입에 따라 타겟 설정
        let target = null;

        if (skill.targetType === 'enemy') {
            // 적 타겟 스킬
            target = this.findNearestEnemy();
        } else if (skill.targetType === 'self') {
            // 자기 자신 타겟 스킬
            target = this.player;
        } else if (skill.targetType === 'position') {
            // 위치 타겟 스킬 (마우스 위치)
            const worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);
            target = worldPoint;
        } else if (skill.targetType === 'allies') {
            // 아군 타겟 스킬 (가장 낮은 HP)
            target = this.findLowestHealthAlly();
        }

        // 스킬 사용
        if (target) {
            const success = this.combatSystem.useSkill(this.player, skill.id, target);

            if (success) {
                // 스킬 애니메이션
                this.player.play(`${this.player.classId}_skill${skillIndex + 1}`, true);

                // 쿨다운 UI 업데이트
                this.uiManager.updateSkillCooldown(skillIndex, skill.cooldown);
            }
        }
    }

    handleInteraction() {
        // 상호작용 가능한 오브젝트 찾기
        const interactRange = 2 * this.tileSize;
        const interactables = this.findInteractableObjects(interactRange);

        if (interactables.length > 0) {
            // 가장 가까운 상호작용 오브젝트와 상호작용
            this.interactWithObject(interactables[0]);
        }
    }

    findInteractableObjects(range) {
        const interactables = [];

        // 보물상자 확인
        this.items.forEach(item => {
            if (item.type === 'chest' && !item.opened) {
                const distance = Phaser.Math.Distance.Between(
                    this.player.x, this.player.y,
                    item.x * this.tileSize, item.y * this.tileSize
                );

                if (distance <= range) {
                    interactables.push({
                        ...item,
                        distance: distance,
                        interactType: 'chest'
                    });
                }
            }
        });

        // 상인 확인
        if (this.currentRoom.type === 'merchant') {
            this.currentRoom.entities.forEach(entity => {
                if (entity.type === 'merchant') {
                    const distance = Phaser.Math.Distance.Between(
                        this.player.x, this.player.y,
                        entity.x * this.tileSize, entity.y * this.tileSize
                    );

                    if (distance <= range) {
                        interactables.push({
                            ...entity,
                            distance: distance,
                            interactType: 'merchant'
                        });
                    }
                }
            });
        }

        // 신단 확인
        if (this.currentRoom.type === 'shrine') {
            this.currentRoom.entities.forEach(entity => {
                if (entity.type === 'shrine' && !entity.used) {
                    const distance = Phaser.Math.Distance.Between(
                        this.player.x, this.player.y,
                        entity.x * this.tileSize, entity.y * this.tileSize
                    );

                    if (distance <= range) {
                        interactables.push({
                            ...entity,
                            distance: distance,
                            interactType: 'shrine'
                        });
                    }
                }
            });
        }

        // 거리에 따라 정렬
        interactables.sort((a, b) => a.distance - b.distance);

        return interactables;
    }

    interactWithObject(object) {
        switch (object.interactType) {
            case 'chest':
                this.openTreasureChest(object);
                break;
            case 'merchant':
                this.openMerchantShop(object);
                break;
            case 'shrine':
                this.activateShrine(object);
                break;
        }
    }

    openTreasureChest(chest) {
        // 보물 상자 열기 효과
        this.effectsManager.playChestOpenEffect(chest.x * this.tileSize, chest.y * this.tileSize, chest.rarity);

        // 아이템 생성
        const itemCount = chest.rarity === 'legendary' || chest.rarity === 'mythic' ?
            Phaser.Math.Between(2, 3) : Phaser.Math.Between(1, 2);

        for (let i = 0; i < itemCount; i++) {
            // 아이템 생성 (보물 상자는 더 좋은 아이템 드롭)
            const item = this.dungeonGenerator.createItem(
                this.currentDungeon,
                this.difficulty,
                true
            );

            // 인벤토리에 추가
            this.inventorySystem.addItem(item);

            // 아이템 획득 이펙트
            this.effectsManager.playItemAcquireEffect(
                chest.x * this.tileSize,
                chest.y * this.tileSize,
                item.rarity
            );

            // 아이템 알림
            this.uiManager.showItemNotification(item);
        }

        // 골드 획득
        const goldAmount = this.calculateChestGoldReward(chest.rarity);
        this.gameData.player.gold += goldAmount;

        // 골드 획득 알림
        this.uiManager.showGoldNotification(goldAmount);

        // 보물상자 상태 변경
        chest.opened = true;

        // 오브젝트 타일 변경 (열린 상자로)
        const tileX = Math.floor(chest.x);
        const tileY = Math.floor(chest.y);
        this.objectLayer.putTileAt(this.getTreasureChestTile(chest.rarity) + 100, tileX, tileY);

        // 사운드 재생
        this.sound.play('chest_open');

        // 통계 업데이트
        this.gameData.statistics.chestsOpened = (this.gameData.statistics.chestsOpened || 0) + 1;
    }

    calculateChestGoldReward(rarity) {
        // 희귀도에 따른 골드 보상
        const baseGold = 20 * this.difficulty;
        const rarityMultiplier = {
            common: 1,
            uncommon: 1.5,
            rare: 2.5,
            epic: 4,
            legendary: 7,
            mythic: 12
        };

        return Math.floor(baseGold * (rarityMultiplier[rarity] || 1) * (0.8 + Math.random() * 0.4));
    }

    openMerchantShop(merchant) {
        // 상점 UI 열기
        this.uiManager.openMerchantShop(merchant.inventory);

        // 게임 일시 정지
        this.pauseGame();

        // 사운드 재생
        this.sound.play('merchant_greeting');
    }

    activateShrine(shrine) {
        // 신단 활성화
        shrine.used = true;

        // 신단 효과 적용
        const buffDuration = shrine.duration || 300; // 기본 5분
        const buffStrength = shrine.buffStrength || 20; // 기본 20%

        switch (shrine.shrineType) {
            case 'health':
                // 체력 회복 및 최대 HP 증가
                this.player.stats.maxHp *= (1 + buffStrength / 100);
                this.player.stats.hp = this.player.stats.maxHp;
                break;
            case 'strength':
                // 공격력 증가
                this.player.stats.attack *= (1 + buffStrength / 100);
                break;
            case 'defense':
                // 방어력 증가
                this.player.stats.defense *= (1 + buffStrength / 100);
                break;
            case 'speed':
                // 이동 속도 및 공격 속도 증가
                this.player.stats.speed *= (1 + buffStrength / 100);
                this.player.stats.attackSpeed *= (1 + buffStrength / 100);
                break;
            case 'mana':
                // 마나 회복 및 최대 MP 증가
                this.player.stats.maxMp *= (1 + buffStrength / 100);
                this.player.stats.mp = this.player.stats.maxMp;
                break;
        }

        // 버프 알림
        this.uiManager.showBuffNotification(shrine.shrineType, buffStrength, buffDuration);

        // 신단 활성화 이펙트
        this.effectsManager.playShrineActivateEffect(
            shrine.x * this.tileSize,
            shrine.y * this.tileSize,
            shrine.shrineType
        );

        // 오브젝트 타일 변경 (활성화된 신단으로)
        const tileX = Math.floor(shrine.x);
        const tileY = Math.floor(shrine.y);
        this.objectLayer.putTileAt(this.getShrineTile(shrine.shrineType) + 100, tileX, tileY);

        // 사운드 재생
        this.sound.play('shrine_activate');

        // 버프 지속시간 타이머
        this.time.delayedCall(buffDuration * 1000, () => {
            // 버프 효과 제거
            switch (shrine.shrineType) {
                case 'health':
                    this.player.stats.maxHp /= (1 + buffStrength / 100);
                    this.player.stats.hp = Math.min(this.player.stats.hp, this.player.stats.maxHp);
                    break;
                case 'strength':
                    this.player.stats.attack /= (1 + buffStrength / 100);
                    break;
                case 'defense':
                    this.player.stats.defense /= (1 + buffStrength / 100);
                    break;
                case 'speed':
                    this.player.stats.speed /= (1 + buffStrength / 100);
                    this.player.stats.attackSpeed /= (1 + buffStrength / 100);
                    break;
                case 'mana':
                    this.player.stats.maxMp /= (1 + buffStrength / 100);
                    this.player.stats.mp = Math.min(this.player.stats.mp, this.player.stats.maxMp);
                    break;
            }

            // 버프 종료 알림
            this.uiManager.showBuffExpiredNotification(shrine.shrineType);

            // HUD 업데이트
            this.updatePlayerHUD();
        });

        // HUD 업데이트
        this.updatePlayerHUD();
    }

    // === 적 관련 메서드 ===

    spawnEnemiesInRoom(room) {
        // 방에 이미 생성된 적이 있는지 확인
        if (room.enemiesSpawned) return;

        // 방에 배치된 적 생성
        if (room.entities) {
            room.entities.forEach(entity => {
                if (entity.type === 'monster' || entity.type === 'boss') {
                    this.createEnemy(entity);
                } else if (entity.type === 'trap') {
                    this.createTrap(entity);
                } else if (entity.type === 'chest') {
                    this.createChest(entity);
                }
            });
        }

        // 웨이브 방인 경우 첫 웨이브 소환
        if (room.type === 'challenge' && room.waves && room.waveEntities) {
            this.startChallengeWave(room, 0);
        }

        // 적 생성 완료 표시
        room.enemiesSpawned = true;
    }

    createEnemy(entityData) {
        // 적 스프라이트 생성
        const enemy = this.physics.add.sprite(
            entityData.x * this.tileSize,
            entityData.y * this.tileSize,
            'enemies',
            `${entityData.monsterType}_idle_01`
        );

        // 물리 설정
        enemy.body.setSize(this.tileSize * 0.8, this.tileSize * 0.8);
        enemy.body.setOffset(this.tileSize * 0.1, this.tileSize * 0.2);

        // 몬스터 데이터 복사
        Object.assign(enemy, entityData);

        // 추가 속성 설정
        enemy.active = true;
        enemy.team = 'enemy';
        enemy.lastAttackTime = 0;

        // 보스인 경우 크기 키우기
        if (entityData.type === 'boss') {
            enemy.setScale(2);
            enemy.body.setSize(this.tileSize * 1.6, this.tileSize * 1.6);
            enemy.body.setOffset(this.tileSize * 0.2, this.tileSize * 0.4);
        } else if (entityData.isElite) {
            enemy.setScale(1.5);
            enemy.body.setSize(this.tileSize * 1.2, this.tileSize * 1.2);
            enemy.body.setOffset(this.tileSize * 0.15, this.tileSize * 0.3);
        }

        // 충돌 설정
        this.physics.add.collider(enemy, this.wallLayer);
        this.physics.add.collider(enemy, this.objectLayer);

        // 적 애니메이션 생성
        this.createEnemyAnimations(enemy);

        // 적 배열에 추가
        this.enemies.push(enemy);

        // 적 등장 이펙트
        this.effectsManager.playEnemySpawnEffect(enemy);

        return enemy;
    }

    createEnemyAnimations(enemy) {
        // 이미 생성된 애니메이션인지 확인
        const monsterType = enemy.monsterType;
        const animKey = `${monsterType}_idle`;

        if (this.anims.exists(animKey)) return;

        // 기본 애니메이션 생성
        this.anims.create({
            key: `${monsterType}_idle`,
            frames: this.anims.generateFrameNames('enemies', {
                prefix: `${monsterType}_idle_`,
                start: 1,
                end: 4,
                zeroPad: 2
            }),
            frameRate: 8,
            repeat: -1
        });

        // 걷기 애니메이션
        this.anims.create({
            key: `${monsterType}_walk`,
            frames: this.anims.generateFrameNames('enemies', {
                prefix: `${monsterType}_walk_`,
                start: 1,
                end: 4,
                zeroPad: 2
            }),
            frameRate: 10,
            repeat: -1
        });

        // 공격 애니메이션
        this.anims.create({
            key: `${monsterType}_attack`,
            frames: this.anims.generateFrameNames('enemies', {
                prefix: `${monsterType}_attack_`,
                start: 1,
                end: 4,
                zeroPad: 2
            }),
            frameRate: 12,
            repeat: 0
        });

        // 사망 애니메이션
        this.anims.create({
            key: `${monsterType}_death`,
            frames: this.anims.generateFrameNames('enemies', {
                prefix: `${monsterType}_death_`,
                start: 1,
                end: 5,
                zeroPad: 2
            }),
            frameRate: 10,
            repeat: 0
        });

        // 기본 애니메이션 재생
        enemy.play(`${monsterType}_idle`);
    }

    createTrap(trapData) {
        // 함정 객체 생성
        const trap = {
            x: trapData.x * this.tileSize,
            y: trapData.y * this.tileSize,
            type: 'trap',
            trapType: trapData.trapType,
            damage: trapData.damage,
            triggered: false,
            visible: trapData.visible
        };

        // 함정 시각화 (보이는 함정인 경우)
        if (trap.visible) {
            trap.sprite = this.add.sprite(
                trap.x,
                trap.y,
                'traps',
                `${trapData.trapType}_idle_01`
            );

            // 함정 애니메이션
            this.createTrapAnimations(trap);
        }

        // 함정 배열에 추가
        this.traps.push(trap);

        return trap;
    }

    createTrapAnimations(trap) {
        // 함정 타입에 따른 애니메이션
        const trapType = trap.trapType;

        // 대기 애니메이션
        this.anims.create({
            key: `${trapType}_idle`,
            frames: this.anims.generateFrameNames('traps', {
                prefix: `${trapType}_idle_`,
                start: 1,
                end: 4,
                zeroPad: 2
            }),
            frameRate: 5,
            repeat: -1
        });

        // 발동 애니메이션
        this.anims.create({
            key: `${trapType}_trigger`,
            frames: this.anims.generateFrameNames('traps', {
                prefix: `${trapType}_trigger_`,
                start: 1,
                end: 5,
                zeroPad: 2
            }),
            frameRate: 10,
            repeat: 0
        });

        // 기본 애니메이션 재생
        trap.sprite.play(`${trapType}_idle`);
    }

    createChest(chestData) {
        // 보물상자가 이미 아이템 목록에 있는지 확인
        const existingChest = this.items.find(item =>
            item.type === 'chest' &&
            item.x === chestData.x &&
            item.y === chestData.y
        );

        if (existingChest) return;

        // 보물상자 객체 생성
        const chest = {
            x: chestData.x,
            y: chestData.y,
            type: 'chest',
            rarity: chestData.rarity,
            opened: false
        };

        // 아이템 배열에 추가
        this.items.push(chest);

        return chest;
    }

    startChallengeWave(room, waveIndex) {
        // 현재 웨이브 설정
        room.waves.current = waveIndex;

        // 웨이브 시작 알림
        this.uiManager.showWaveNotification(waveIndex + 1, room.waves.total);

        // 웨이브 적 생성
        const waveMonsters = room.waveEntities[waveIndex];

        waveMonsters.forEach(monsterData => {
            // 방 중앙을 기준으로 위치 조정
            monsterData.x = room.centerX + (Math.random() * 6 - 3);
            monsterData.y = room.centerY + (Math.random() * 6 - 3);

            // 적 생성
            this.createEnemy(monsterData);
        });

        // 웨이브 시작 이펙트
        this.effectsManager.playWaveStartEffect(room.centerX * this.tileSize, room.centerY * this.tileSize);

        // 웨이브 음악 변경
        this.sound.play('battle_music', { volume: 0.7 });

        // 모든 적이 죽었는지 확인하는 타이머 (주기적 체크)
        this.challengeWaveCheckTimer = this.time.addEvent({
            delay: 1000,
            callback: () => this.checkChallengeWaveCompletion(room),
            loop: true
        });
    }

    checkChallengeWaveCompletion(room) {
        // 방 안의 적 확인
        const roomEnemies = this.enemies.filter(enemy =>
            Phaser.Math.Distance.Between(
                enemy.x / this.tileSize, enemy.y / this.tileSize,
                room.centerX, room.centerY
            ) < Math.max(room.width, room.height) / 2
        );

        // 모든 적이 처치되었는지 확인
        if (roomEnemies.length === 0) {
            // 타이머 정지
            if (this.challengeWaveCheckTimer) {
                this.challengeWaveCheckTimer.remove();
            }

            // 다음 웨이브가 있는지 확인
            if (room.waves.current < room.waves.total - 1) {
                // 다음 웨이브 시작 전 짧은 대기 시간
                this.time.delayedCall(2000, () => {
                    this.startChallengeWave(room, room.waves.current + 1);
                });
            } else {
                // 모든 웨이브 완료
                room.waves.completed = true;

                // 도전 완료 알림
                this.uiManager.showChallengeCompletedNotification();

                // 보상 지급
                this.giveChallengeReward(room);

                // 일반 음악으로 복귀
                this.sound.stopByKey('battle_music');
                this.sound.play('dungeon_music', { volume: 0.5 });
            }
        }
    }

    giveChallengeReward(room) {
        if (!room.reward) return;

        // 골드 보상
        if (room.reward.gold) {
            this.gameData.player.gold += room.reward.gold;
            this.uiManager.showGoldNotification(room.reward.gold);
        }

        // 아이템 보상
        if (room.reward.items && room.reward.items.length > 0) {
            room.reward.items.forEach(item => {
                // 아이템 생성 위치
                const itemX = room.centerX * this.tileSize;
                const itemY = room.centerY * this.tileSize;

                // 인벤토리에 추가
                this.inventorySystem.addItem(item);

                // 아이템 획득 이펙트
                this.effectsManager.playItemAcquireEffect(itemX, itemY, item.rarity);

                // 아이템 알림
                this.uiManager.showItemNotification(item);
            });
        }

        // 보상 이펙트
        this.effectsManager.playRewardEffect(room.centerX * this.tileSize, room.centerY * this.tileSize);
    }

    updateEnemies(delta) {
        // 각 적 AI 업데이트
        this.enemies.forEach(enemy => {
            if (!enemy.active) return;

            // 기절 상태이면 움직이지 않음
            if (enemy.isStunned || enemy.isFrozen) {
                enemy.body.velocity.x = 0;
                enemy.body.velocity.y = 0;
                return;
            }

            // 적 행동 결정
            this.updateEnemyBehavior(enemy, delta);
        });
    }

    updateEnemyBehavior(enemy, delta) {
        // 플레이어와의 거리 계산
        const distToPlayer = Phaser.Math.Distance.Between(
            enemy.x, enemy.y,
            this.player.x, this.player.y
        );

        // 시야 범위 (타입에 따라 다름)
        const sightRange = enemy.type === 'boss' ? 15 * this.tileSize : 10 * this.tileSize;

        // 공격 범위
        const attackRange = enemy.attackType === 'melee' ? 1.5 * this.tileSize : 5 * this.tileSize;

        // 플레이어가 시야 범위 안에 있는지 확인
        if (distToPlayer <= sightRange) {
            // 공격 범위에 있으면 공격
            if (distToPlayer <= attackRange) {
                this.enemyAttack(enemy);
            } else {
                // 공격 범위에 없으면 플레이어 추적
                this.moveEnemyTowardsPlayer(enemy);
            }
        } else {
            // 시야 범위 밖이면 무작위 이동 또는 정지
            this.moveEnemyRandomly(enemy, delta);
        }
    }

    moveEnemyTowardsPlayer(enemy) {
        // 적이 플레이어를 향해 이동
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);

        // 이동 속도 계산
        const speed = enemy.speed;

        // 이동 방향
        enemy.body.velocity.x = Math.cos(angle) * speed;
        enemy.body.velocity.y = Math.sin(angle) * speed;

        // 애니메이션 설정
        enemy.play(`${enemy.monsterType}_walk`, true);

        // 이동 방향에 따라 스프라이트 반전
        enemy.setFlipX(enemy.body.velocity.x < 0);
    }

    moveEnemyRandomly(enemy, delta) {
        // 랜덤 이동 업데이트 (일정 시간마다)
        if (!enemy.nextMoveTime || enemy.nextMoveTime <= 0) {
            // 50% 확률로 움직임 or 정지
            if (Math.random() < 0.5) {
                // 랜덤 방향
                const angle = Math.random() * Math.PI * 2;
                const speed = enemy.speed * 0.5; // 더 느리게 이동

                enemy.body.velocity.x = Math.cos(angle) * speed;
                enemy.body.velocity.y = Math.sin(angle) * speed;

                // 이동 애니메이션
                enemy.play(`${enemy.monsterType}_walk`, true);

                // 방향에 따라 스프라이트 반전
                enemy.setFlipX(enemy.body.velocity.x < 0);
            } else {
                // 정지
                enemy.body.velocity.x = 0;
                enemy.body.velocity.y = 0;

                // 정지 애니메이션
                enemy.play(`${enemy.monsterType}_idle`, true);
            }

            // 다음 이동 결정 시간 (2-5초)
            enemy.nextMoveTime = 2000 + Math.random() * 3000;
        } else {
            // 타이머 감소
            enemy.nextMoveTime -= delta;
        }
    }

    enemyAttack(enemy) {
        // 공격 쿨다운 확인
        const now = Date.now();
        const attackCooldown = 1500; // 1.5초 기본 쿨다운

        if (now - enemy.lastAttackTime < attackCooldown) return;

        // 공격 애니메이션
        enemy.play(`${enemy.monsterType}_attack`, true);

        // 공격 타이밍 (애니메이션 중간 즈음에 데미지 적용)
        this.time.delayedCall(300, () => {
            if (enemy.active) {
                // 플레이어 공격
                this.combatSystem.monsterAttack(enemy, this.player);

                // 공격 효과
                this.effectsManager.playEnemyAttackEffect(enemy, this.player, enemy.attackType);
            }
        });

        // 공격 후 속도 멈춤
        enemy.body.velocity.x = 0;
        enemy.body.velocity.y = 0;

        // 쿨다운 업데이트
        enemy.lastAttackTime = now;
    }

    // === 유틸리티 메서드 ===

    findNearestEnemy() {
        // 가장 가까운 적 찾기
        let nearestEnemy = null;
        let minDistance = Number.MAX_VALUE;

        this.enemies.forEach(enemy => {
            if (!enemy.active) return;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestEnemy = enemy;
            }
        });

        return nearestEnemy;
    }

    findLowestHealthAlly() {
        // 체력이 가장 낮은 아군 찾기 (현재는 플레이어만 존재)
        if (this.allies.length === 0) return this.player;

        let lowestHealthAlly = this.player;
        let lowestHealthRatio = this.player.stats.hp / this.player.stats.maxHp;

        this.allies.forEach(ally => {
            if (!ally.active) return;

            const healthRatio = ally.stats.hp / ally.stats.maxHp;
            if (healthRatio < lowestHealthRatio) {
                lowestHealthRatio = healthRatio;
                lowestHealthAlly = ally;
            }
        });

        return lowestHealthAlly;
    }

    getEquippedWeaponType() {
        // 장착된 무기 ID
        const weaponId = this.player.equipment?.weapon;

        if (!weaponId) return 'sword'; // 기본값

        // 인벤토리에서 무기 정보 가져오기
        const weapon = this.inventorySystem.getItemById(weaponId);

        return weapon?.subType || 'sword';
    }

    getWeaponRange() {
        // 무기 타입에 따른 공격 범위
        const weaponType = this.getEquippedWeaponType();

        // 무기별 범위 (타일 단위)
        const weaponRanges = {
            sword: 1.5,
            dagger: 1.0,
            axe: 1.5,
            mace: 1.5,
            spear: 2.0,
            bow: 6.0,
            crossbow: 5.0,
            staff: 4.0,
            wand: 3.5
        };

        return (weaponRanges[weaponType] || 1.5) * this.tileSize;
    }

    getDungeonName() {
        // 던전 ID를 표시 이름으로 변환
        const dungeonNames = {
            'sword_forest': '검의 숲',
            'staff_tower': '지팡이 타워',
            'temple_ruins': '신전 유적',
            'crystal_caves': '크리스탈 동굴',
            'dark_castle': '어둠의 성',
            'forbidden_library': '금단의 도서관',
            'abandoned_mine': '버려진 광산',
            'ancient_city': '고대 도시'
        };

        return dungeonNames[this.dungeonId] || this.dungeonId;
    }

    // === 게임 흐름 관리 메서드 ===

    exploreCurrentRoom() {
        // 현재 방 탐색
        if (!this.currentRoom.explored) {
            // 방 탐색 표시
            this.currentRoom.explored = true;

            // 탐색한 방 수 증가
            this.exploredRooms++;

            // 미니맵 업데이트
            this.updateMinimap();

            // 방 입장 이벤트
            this.events.emit('roomEntered', this.currentRoom);

            // 방 타입에 따른 특별 처리
            this.handleRoomTypeSpecifics();
        }

        // 적 스폰
        this.spawnEnemiesInRoom(this.currentRoom);

        // 진행률 업데이트
        this.updateProgressUI();
    }

    handleRoomTypeSpecifics() {
        // 방 타입별 특수 처리
        switch (this.currentRoom.type) {
            case 'entrance':
                // 입구 방 - 진입 효과
                this.playRoomEntranceEffect('entrance');
                break;
            case 'boss':
                // 보스 방 - 보스 알림
                this.showBossRoomWarning();
                break;
            case 'treasure':
                // 보물 방 - 특별 효과
                this.playRoomEntranceEffect('treasure');
                break;
            case 'merchant':
                // 상인 방 - 상인 대사
                this.playRoomEntranceEffect('merchant');
                break;
            case 'challenge':
                // 도전 방 - 도전 설명
                this.showChallengeRoomInfo();
                break;
            case 'shrine':
                // 신단 방 - 신비한 효과
                this.playRoomEntranceEffect('shrine');
                break;
            default:
                // 일반 방
                this.playRoomEntranceEffect('normal');
                break;
        }
    }

    playRoomEntranceEffect(roomType) {
        // 방 입장 효과
        const effectX = this.player.x;
        const effectY = this.player.y;

        // 효과 재생
        this.effectsManager.playRoomEntranceEffect(effectX, effectY, roomType);

        // 방 타입별 사운드
        const soundEffects = {
            'entrance': 'room_enter',
            'treasure': 'treasure_room',
            'merchant': 'merchant_room',
            'shrine': 'shrine_room',
            'boss': 'boss_room',
            'challenge': 'challenge_room',
            'normal': 'room_enter'
        };

        // 사운드 재생
        const soundKey = soundEffects[roomType] || 'room_enter';
        this.sound.play(soundKey);
    }

    showBossRoomWarning() {
        // 보스방 경고
        this.uiManager.showBossWarning(this.currentDungeon.bossName || '던전 보스');

        // 카메라 효과
        this.cameras.main.shake(500, 0.01);

        // 보스 음악 재생
        this.sound.stopByKey('dungeon_music');
        this.sound.play('boss_music', { volume: 0.7 });
    }

    showChallengeRoomInfo() {
        // 도전방 정보 표시
        const room = this.currentRoom;

        // 웨이브 정보
        const waveCount = room.waves ? room.waves.total : 3;

        // 도전 정보 UI
        this.uiManager.showChallengeInfo(waveCount);
    }

    checkRoomExploration() {
        // 플레이어가 다른 방에 들어갔는지 확인
        const playerTileX = Math.floor(this.player.x / this.tileSize);
        const playerTileY = Math.floor(this.player.y / this.tileSize);

        // 현재 방 안에 있는지 확인
        const inCurrentRoom =
            playerTileX >= this.currentRoom.x &&
            playerTileX < this.currentRoom.x + this.currentRoom.width &&
            playerTileY >= this.currentRoom.y &&
            playerTileY < this.currentRoom.y + this.currentRoom.height;

        if (!inCurrentRoom) {
            // 새로운 방 찾기
            const newRoom = this.findRoomAtPosition(playerTileX, playerTileY);

            if (newRoom && newRoom !== this.currentRoom) {
                // 방 변경
                this.changeRoom(newRoom);
            }
        }
    }

    findRoomAtPosition(tileX, tileY) {
        // 해당 위치의 방 찾기
        return this.currentDungeon.rooms.find(room =>
            tileX >= room.x &&
            tileX < room.x + room.width &&
            tileY >= room.y &&
            tileY < room.y + room.height
        );
    }

    changeRoom(newRoom) {
        // 이전 방
        const previousRoom = this.currentRoom;

        // 현재 방 변경
        this.currentRoom = newRoom;

        // 도전방 타이머 정리
        if (previousRoom.type === 'challenge' && this.challengeWaveCheckTimer) {
            this.challengeWaveCheckTimer.remove();
        }

        // 새 방 탐색
        this.exploreCurrentRoom();

        // 일반 음악으로 복귀 (보스방이 아닌 경우)
        if (previousRoom.type === 'boss' && newRoom.type !== 'boss') {
            this.sound.stopByKey('boss_music');
            this.sound.play('dungeon_music', { volume: 0.5 });
        }
    }

    checkCollisions() {
        // 플레이어와 적 충돌
        this.physics.overlap(
            this.player,
            this.enemies,
            this.handlePlayerEnemyCollision,
            null,
            this
        );

        // 적 끼리의 충돌 방지
        this.physics.collide(this.enemies, this.enemies);
    }

    handlePlayerEnemyCollision(player, enemy) {
        // 적과 충돌 시 약간의 넉백
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        const knockbackForce = 100;

        player.body.velocity.x += Math.cos(angle) * knockbackForce;
        player.body.velocity.y += Math.sin(angle) * knockbackForce;
    }

    checkTraps() {
        // 플레이어가 함정 위에 있는지 확인
        this.traps.forEach(trap => {
            if (trap.triggered) return;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                trap.x, trap.y
            );

            // 함정 발동 거리
            const triggerDistance = this.tileSize * 0.7;

            if (distance < triggerDistance) {
                this.triggerTrap(trap);
            }
        });
    }

    triggerTrap(trap) {
        // 함정 발동
        trap.triggered = true;

        // 함정 애니메이션
        if (trap.sprite) {
            trap.sprite.play(`${trap.trapType}_trigger`);
        }

        // 함정 효과
        switch (trap.trapType) {
            case 'spike':
                // 가시 함정 - 즉시 대미지
                this.dealTrapDamage(trap);
                this.effectsManager.playTrapEffect(trap.x, trap.y, 'spike');
                break;
            case 'poison':
                // 독 함정 - 독 상태 효과
                this.combatSystem.addStatusEffect(null, this.player, 'poison', trap.damage / 3, 5);
                this.effectsManager.playTrapEffect(trap.x, trap.y, 'poison');
                break;
            case 'arrow':
                // 화살 함정 - 여러 방향에서 화살 발사
                this.shootTrapArrows(trap);
                break;
            case 'fire':
                // 화염 함정 - 화상 상태 효과
                this.combatSystem.addStatusEffect(null, this.player, 'burn', trap.damage / 3, 4);
                this.effectsManager.playTrapEffect(trap.x, trap.y, 'fire');
                break;
            case 'frost':
                // 냉기 함정 - 감속 효과
                this.combatSystem.addStatusEffect(null, this.player, 'slow', 30, 5);
                this.effectsManager.playTrapEffect(trap.x, trap.y, 'frost');
                break;
        }

        // 함정 발동 사운드
        this.sound.play(`trap_${trap.trapType}`);
    }

    dealTrapDamage(trap) {
        // 함정 대미지 적용
        const damage = trap.damage || 10;

        // 플레이어 체력 감소
        this.player.stats.hp = Math.max(0, this.player.stats.hp - damage);

        // 대미지 숫자 표시
        this.combatSystem.showDamageNumber(this.player, damage, 0xFF0000);

        // HUD 업데이트
        this.updatePlayerHUD();

        // 사망 확인
        if (this.player.stats.hp <= 0) {
            this.playerDeath();
        }
    }

    shootTrapArrows(trap) {
        // 화살 함정 - 4방향 화살 발사
        const directions = [
            { x: 1, y: 0 },  // 오른쪽
            { x: -1, y: 0 }, // 왼쪽
            { x: 0, y: 1 },  // 아래
            { x: 0, y: -1 }  // 위
        ];

        directions.forEach((dir, index) => {
            // 화살 딜레이 (약간의 간격으로 발사)
            this.time.delayedCall(index * 100, () => {
                // 화살 이펙트
                this.effectsManager.playArrowTrapEffect(trap.x, trap.y, dir);

                // 화살이 플레이어에게 맞는지 검사
                this.time.delayedCall(500, () => {
                    const playerDir = {
                        x: this.player.x - trap.x,
                        y: this.player.y - trap.y
                    };

                    // 방향 일치 확인 (화살이 플레이어 방향으로 발사됐는지)
                    const dotProduct = playerDir.x * dir.x + playerDir.y * dir.y;

                    // 같은 방향이고 거리가 가까우면 명중
                    if (dotProduct > 0 &&
                        Phaser.Math.Distance.Between(trap.x, trap.y, this.player.x, this.player.y) < this.tileSize * 3) {
                        // 대미지 적용
                        this.dealTrapDamage(trap);
                    }
                });
            });
        });
    }

    checkItemPickup() {
        // 플레이어 주변 아이템 확인
        const pickupRange = this.tileSize;

        this.items.forEach(item => {
            // 상자가 아닌 일반 아이템만 처리 (상자는 상호작용으로 열림)
            if (item.type === 'chest') return;

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                item.x, item.y
            );

            if (distance <= pickupRange) {
                this.pickupItem(item);
            }
        });
    }

    pickupItem(item) {
        // 아이템 획득
        const index = this.items.indexOf(item);
        if (index !== -1) {
            this.items.splice(index, 1);
        }

        // 아이템 획득 이펙트
        this.effectsManager.playItemPickupEffect(item.x, item.y, item.rarity || 'common');

        // 아이템 효과 적용
        this.applyItemEffect(item);

        // 아이템 획득 사운드
        this.sound.play('item_pickup');

        // 이벤트 발생
        this.events.emit('itemPickup', item);
    }

    applyItemEffect(item) {
        switch (item.type) {
            case 'potion':
                // 포션 효과
                this.usePotion(item);
                break;
            case 'gold':
                // 골드 획득
                this.gameData.player.gold += item.amount || 10;
                this.uiManager.showGoldNotification(item.amount || 10);
                break;
            case 'key':
                // 열쇠 획득
                this.gameData.keys = (this.gameData.keys || 0) + 1;
                this.uiManager.showKeyNotification();
                break;
            case 'scroll':
                // 스크롤 효과
                this.useScroll(item);
                break;
            // 기타 아이템 타입 처리
        }
    }

    usePotion(potion) {
        switch (potion.potionType) {
            case 'health':
                // 체력 회복
                const healAmount = potion.effectValue || 20;
                this.player.stats.hp = Math.min(this.player.stats.hp + healAmount, this.player.stats.maxHp);
                this.combatSystem.showDamageNumber(this.player, healAmount, 0x00FF00, true);
                this.updatePlayerHUD();
                break;
            case 'mana':
                // 마나 회복
                const manaAmount = potion.effectValue || 15;
                this.player.stats.mp = Math.min(this.player.stats.mp + manaAmount, this.player.stats.maxMp);
                this.combatSystem.showDamageNumber(this.player, manaAmount, 0x0000FF, true);
                this.updatePlayerHUD();
                break;
            case 'strength':
                // 공격력 증가 버프
                const strBuff = potion.effectValue || 10;
                this.player.stats.attack *= (1 + strBuff / 100);
                this.uiManager.showBuffNotification('strength', strBuff, 60);
                break;
            case 'defense':
                // 방어력 증가 버프
                const defBuff = potion.effectValue || 10;
                this.player.stats.defense *= (1 + defBuff / 100);
                this.uiManager.showBuffNotification('defense', defBuff, 60);
                break;
            case 'speed':
                // 속도 증가 버프
                const spdBuff = potion.effectValue || 10;
                this.player.stats.speed *= (1 + spdBuff / 100);
                this.player.stats.attackSpeed *= (1 + spdBuff / 100);
                this.uiManager.showBuffNotification('speed', spdBuff, 60);
                break;
        }

        // 포션 사용 이펙트
        this.effectsManager.playPotionEffect(this.player, potion.potionType);
    }

    useScroll(scroll) {
        switch (scroll.scrollType) {
            case 'teleport':
                // 무작위 방으로 텔레포트
                this.teleportToRandomRoom();
                break;
            case 'identify':
                // 모든 아이템 확인
                this.identifyAllItems();
                break;
            case 'enchant':
                // 장착 무기 강화
                this.enchantEquippedWeapon();
                break;
            case 'fireball':
                // 주변 적에게 화염 대미지
                this.castAreaSpell('fire', scroll.effectValue || 30);
                break;
            case 'frost':
                // 주변 적 빙결
                this.castAreaSpell('frost', scroll.effectValue || 20, 'slow');
                break;
            case 'lightning':
                // 적들에게 번개 대미지
                this.castChainLightning(scroll.effectValue || 40);
                break;
            case 'healing':
                // 대규모 치유
                this.castAreaHeal(scroll.effectValue || 50);
                break;
            case 'protection':
                // 보호막 생성
                this.createProtectionShield(scroll.effectValue || 30);
                break;
        }

        // 스크롤 사용 이펙트
        this.effectsManager.playScrollEffect(this.player, scroll.scrollType);
    }

    // === UI 관련 메서드 ===

    createMinimap() {
        // 미니맵 생성
        this.uiManager.createMinimap(this.currentDungeon);

        // 초기 미니맵 업데이트
        this.updateMinimap();
    }

    updateMinimap() {
        // 미니맵 업데이트 (탐색한 방 표시)
        this.uiManager.updateMinimap(
            this.currentDungeon.rooms,
            this.currentRoom,
            { x: this.player.x / this.tileSize, y: this.player.y / this.tileSize }
        );
    }

    updatePlayerHUD() {
        // 플레이어 HUD 업데이트
        this.uiManager.updatePlayerHUD(this.player);
    }

    updateProgressUI() {
        // 진행도 UI 업데이트
        const explorationPercent = Math.floor((this.exploredRooms / this.totalRooms) * 100);
        this.uiManager.updateProgressUI(explorationPercent);
    }

    updateGameTime() {
        // 게임 시간 업데이트
        const now = Date.now();
        this.elapsedTime = now - this.dungeonStartTime;

        // 던전 런 데이터 업데이트
        if (this.game.gameData.currentRun) {
            this.game.gameData.currentRun.elapsedTime = this.elapsedTime / 1000; // 초 단위
        }

        // 시간 UI 업데이트
        this.uiManager.updateTimeUI(this.elapsedTime);
    }

    updateCamera() {
        // 카메라 줌 업데이트 (부드러운 전환)
        const zoomDiff = this.targetCameraZoom - this.cameras.main.zoom;
        if (Math.abs(zoomDiff) > 0.01) {
            this.cameras.main.zoom += zoomDiff * 0.05;
        }
    }

    // === 게임 상태 관리 메서드 ===

    pauseGame() {
        // 게임 일시 정지
        this.isPaused = true;
        this.physics.pause();
        this.uiManager.showPauseMenu();
    }

    resumeGame() {
        // 게임 재개
        this.isPaused = false;
        this.physics.resume();
        this.uiManager.hidePauseMenu();
    }

    togglePause() {
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    openInventory() {
        // 인벤토리 열기
        this.pauseGame();
        this.uiManager.showInventory(this.inventorySystem.getInventory(), this.player);
    }

    playerDeath() {
        if (this.gameOver) return;

        // 게임 오버 상태로 전환
        this.gameOver = true;

        // 사망 애니메이션
        this.player.play(`${this.player.classId}_death`);

        // 사망 이펙트
        this.effectsManager.playPlayerDeathEffect(this.player);

        // 사망 사운드
        this.sound.play('player_death');

        // 카메라 효과
        this.cameras.main.shake(500, 0.02);
        this.cameras.main.fade(2000, 0, 0, 0);

        // 게임 오버 화면 표시 (지연)
        this.time.delayedCall(2500, () => {
            this.showGameOverScreen(false);
        });
    }

    dungeonCompleted() {
        if (this.gameOver) return;

        // 게임 완료 상태로 전환
        this.gameOver = true;

        // 완료 이펙트
        this.effectsManager.playDungeonCompletedEffect(this.player);

        // 완료 사운드
        this.sound.play('dungeon_complete');

        // 카메라 효과
        this.cameras.main.flash(1000, 255, 255, 255);
        this.cameras.main.fade(2000, 0, 0, 0);

        // 던전 완료 통계 업데이트
        this.gameData.statistics.dungeonsCompleted++;

        // 완료 화면 표시 (지연)
        this.time.delayedCall(2500, () => {
            this.showGameOverScreen(true);
        });
    }

    showGameOverScreen(isVictory) {
        // 게임 오버/클리어 화면 표시
        const stats = {
            dungeonName: this.getDungeonName(),
            difficulty: this.difficulty,
            timeElapsed: this.elapsedTime,
            roomsExplored: this.exploredRooms,
            totalRooms: this.totalRooms,
            monstersKilled: this.game.gameData.currentRun.monstersKilled,
            itemsCollected: this.game.gameData.currentRun.itemsCollected,
            goldEarned: this.gameData.player.gold - this.gameData.currentRun.startingGold
        };

        // 게임 오버 또는 클리어 UI 표시
        this.uiManager.showGameOverScreen(isVictory, stats);

        // 현재 런 데이터 리셋
        this.game.gameData.currentRun = null;

        // 게임 데이터 저장
        this.game.saveGameData();
    }

    returnToHub() {
        // 허브 씬으로 이동
        this.scene.start('Hub');
    }

    // === 이벤트 핸들러 ===

    onBossDefeated(boss) {
        // 보스 처치 축하 메시지
        this.uiManager.showBossDefeatedMessage(boss.name || '던전 보스');

        // 던전 클리어 타이머 (3초 후 클리어 처리)
        this.time.delayedCall(3000, () => {
            this.dungeonCompleted();
        });

        // 보스 처치 통계 업데이트
        this.gameData.statistics.bossesDefeated = (this.gameData.statistics.bossesDefeated || 0) + 1;

        // 난이도 증가에 따른 다음 던전 해금
        if (this.difficulty % 3 === 0) {
            this.unlockNextDungeon();
        }
    }

    onSkillUsed(data) {
        // 스킬 사용 통계 업데이트
        this.gameData.statistics.skillsUsed = (this.gameData.statistics.skillsUsed || 0) + 1;
    }

    onItemPickup(item) {
        // 아이템 획득 통계 업데이트
        this.gameData.statistics.itemsCollected = (this.gameData.statistics.itemsCollected || 0) + 1;

        if (this.gameData.currentRun) {
            this.gameData.currentRun.itemsCollected++;
        }
    }

    onSceneShutdown() {
        // 이벤트 리스너 정리
        this.events.off('bossDefeated', this.onBossDefeated, this);
        this.events.off('skillUsed', this.onSkillUsed, this);
        this.events.off('itemPickup', this.onItemPickup, this);

        // 타이머 정리
        if (this.challengeWaveCheckTimer) {
            this.challengeWaveCheckTimer.remove();
        }

        // 음악 정지
        this.sound.stopAll();
    }

    unlockNextDungeon() {
        // 던전 순서
        const dungeonOrder = [
            'sword_forest',
            'staff_tower',
            'temple_ruins',
            'crystal_caves',
            'dark_castle',
            'forbidden_library',
            'abandoned_mine',
            'ancient_city'
        ];

        // 현재 던전 인덱스
        const currentIndex = dungeonOrder.indexOf(this.dungeonId);

        // 다음 던전이 있으면 해금
        if (currentIndex >= 0 && currentIndex < dungeonOrder.length - 1) {
            const nextDungeonId = dungeonOrder[currentIndex + 1];

            // 해금 여부 확인
            if (!this.gameData.unlockedDungeons) {
                this.gameData.unlockedDungeons = [];
            }

            if (!this.gameData.unlockedDungeons.includes(nextDungeonId)) {
                // 새 던전 해금
                this.gameData.unlockedDungeons.push(nextDungeonId);

                // 해금 알림
                const nextDungeonName = this.getDungeonNameById(nextDungeonId);
                this.uiManager.showDungeonUnlockNotification(nextDungeonName);
            }
        }
    }

    getDungeonNameById(dungeonId) {
        // 던전 ID를 표시 이름으로 변환
        const dungeonNames = {
            'sword_forest': '검의 숲',
            'staff_tower': '지팡이 타워',
            'temple_ruins': '신전 유적',
            'crystal_caves': '크리스탈 동굴',
            'dark_castle': '어둠의 성',
            'forbidden_library': '금단의 도서관',
            'abandoned_mine': '버려진 광산',
            'ancient_city': '고대 도시'
        };

        return dungeonNames[dungeonId] || dungeonId;
    }
}

export default DungeonScene;