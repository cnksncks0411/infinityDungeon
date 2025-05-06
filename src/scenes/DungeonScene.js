// src/scenes/DungeonScene.js
import Phaser from 'phaser';
import Player from '../entities/Player';
import Enemy from '../entities/Enemy';
import Item from '../entities/Item';
import CombatSystem from '../systems/CombatSystem';
import ClassSystem from '../systems/ClassSystem';
import LootSystem from '../systems/LootSystem';
import ProgressionSystem from '../systems/ProgressionSystem';
import DungeonGenerator from '../systems/DungeonGenerator';
import HUD from '../ui/HUD';
import DataManager from '../utils/DataManager';

/**
 * DungeonScene 클래스 - 던전 내 게임플레이를 관리
 * 
 * 주요 책임:
 * - 던전 맵 생성 및 렌더링
 * - 플레이어, 적, 아이템 등의 엔티티 관리
 * - 충돌 및 상호작용 처리
 * - 방 탐색 및 던전 진행 관리
 * - UI 및 카메라 관리
 */
class DungeonScene extends Phaser.Scene {
    constructor() {
        super('DungeonScene');
        
        // 시스템 컴포넌트
        this.dungeonGenerator = null;
        this.combatSystem = null;
        this.classSystem = null;
        this.lootSystem = null;
        this.progressionSystem = null;
        this.hud = null;
        this.dataManager = null;
        
        // 던전 상태
        this.dungeonData = null;
        this.currentRoom = null;
        this.exploredRooms = 0;
        this.totalRooms = 0;
        this.difficultyLevel = 1;
        this.dungeonStartTime = 0;
        this.elapsedTime = 0;
        
        // 엔티티 그룹
        this.player = null;
        this.enemies = null;
        this.items = null;
        this.traps = null;
        this.decorations = null;
        this.summons = null;
        
        // 게임 상태
        this.isPaused = false;
        this.gameOver = false;
        this.dungeonCompleted = false;
        
        // 타일맵 관련
        this.map = null;
        this.tileset = null;
        this.floorLayer = null;
        this.wallLayer = null;
        this.objectLayer = null;
        this.tileSize = 32;
        
        // 입력 관리
        this.cursors = null;
        this.actionKeys = null;
        
        // 카메라 설정
        this.targetCameraZoom = 1.5;
        
        // 이벤트 타이머
        this.timers = {};
    }

    /**
     * 씬 초기화 - 외부 데이터 설정
     * @param {Object} data - 씬 초기화 데이터
     */
    init(data) {
        // 데이터 매니저 참조
        this.dataManager = this.scene.get('Boot').dataManager || new DataManager();
        
        // 입력 데이터 처리
        this.dungeonId = data.dungeonId || 'sword_forest';
        this.difficultyLevel = data.difficulty || 1;
        this.selectedClass = data.selectedClass || 'warrior';
        
        // 게임 상태 초기화
        this.isPaused = false;
        this.gameOver = false;
        this.dungeonCompleted = false;
        this.dungeonStartTime = Date.now();
        this.elapsedTime = 0;
        
        // 던전 진행도 초기화
        this.exploredRooms = 0;
        this.totalRooms = 0;
        
        // 플레이어 데이터 참조
        this.playerData = this.dataManager.getPlayerData();
        
        // 현재 런 데이터 초기화
        this.dataManager.initRunData({
            dungeonId: this.dungeonId,
            difficulty: this.difficultyLevel,
            class: this.selectedClass,
            startingGold: this.playerData.gold,
            startTime: this.dungeonStartTime
        });
        
        console.log(`Dungeon initialized: ${this.dungeonId}, Difficulty: ${this.difficultyLevel}`);
    }

    /**
     * 에셋 및 데이터 로드
     */
    preload() {
        // 대부분의 에셋은 Boot 씬에서 로드되지만, 던전 특정 에셋이 있다면 여기서 로드
        // 던전 데이터 로드
        this.dungeonData = this.dataManager.getDungeonById(this.dungeonId);
        
        if (!this.dungeonData) {
            console.error(`Dungeon data not found for ID: ${this.dungeonId}`);
            this.returnToHub();
            return;
        }
    }

    /**
     * 씬 생성 및 구성 요소 초기화
     */
    create() {
        // 시스템 초기화
        this.initSystems();
        
        // 물리 시스템 설정
        this.physics.world.setBounds(0, 0, 5000, 5000);
        
        // 던전 생성
        this.generateDungeon();
        
        // 입력 설정
        this.setupInput();
        
        // UI 설정
        this.setupUI();
        
        // 플레이어 생성
        this.createPlayer();
        
        // 카메라 설정
        this.setupCamera();
        
        // 충돌 설정
        this.setupCollisions();
        
        // 방 탐색 시작
        this.exploreCurrentRoom();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 배경 음악 재생
        this.sound.play('dungeon_music', {
            loop: true,
            volume: 0.5
        });
        
        // 던전 시작 이벤트 발생
        this.events.emit('dungeonStarted', {
            dungeonId: this.dungeonId,
            difficulty: this.difficultyLevel,
            selectedClass: this.selectedClass
        });
        
        console.log(`Dungeon created: ${this.dungeonData.name}`);
    }

    /**
     * 매 프레임 업데이트
     * @param {number} time - 현재 시간
     * @param {number} delta - 이전 프레임과의 시간 차이(ms)
     */
    update(time, delta) {
        // 게임 중지 상태면 업데이트 건너뜀
        if (this.isPaused || this.gameOver) return;
        
        // 시간 업데이트
        this.updateGameTime(delta);
        
        // 플레이어 업데이트
        if (this.player && this.player.active) {
            // 플레이어 입력 및 이동 처리
            this.handlePlayerInput(delta);
            
            // 공격 쿨다운 업데이트
            this.combatSystem.updateCooldowns(delta);
            
            // 현재 방 확인 (방 이동 감지)
            this.checkRoomChange();
        }
        
        // 적 업데이트
        this.updateEnemies(delta);
        
        // 소환수 업데이트
        this.updateSummons(delta);
        
        // 아이템 획득 체크
        this.checkItemPickup();
        
        // 함정 체크
        this.checkTraps();
        
        // 카메라 업데이트
        this.updateCamera();
        
        // HUD 업데이트
        this.hud.update(delta);
    }

    // === 초기화 메서드 ===

    /**
     * 시스템 컴포넌트 초기화
     */
    initSystems() {
        // 필요한 시스템 초기화
        this.dungeonGenerator = new DungeonGenerator(this, this.dataManager);
        this.combatSystem = new CombatSystem(this, this.dataManager);
        this.classSystem = new ClassSystem(this, this.dataManager);
        this.lootSystem = new LootSystem(this, this.dataManager);
        this.progressionSystem = new ProgressionSystem(this, this.dataManager);
        this.hud = new HUD(this);
        
        // 엔티티 그룹 초기화
        this.enemies = this.physics.add.group();
        this.items = this.physics.add.group();
        this.traps = this.physics.add.group();
        this.decorations = this.physics.add.group();
        this.summons = this.physics.add.group();
        
        console.log('Systems initialized');
    }

    /**
     * 던전 맵 생성
     */
    generateDungeon() {
        // 던전 제너레이터를 통해 던전 데이터 생성
        const dungeonLayout = this.dungeonGenerator.generateDungeon(
            this.dungeonData,
            this.difficultyLevel
        );
        
        this.currentDungeon = dungeonLayout;
        this.totalRooms = dungeonLayout.rooms.length;
        
        // 맵 타일을 생성하고 월드에 배치
        this.createDungeonTilemap();
        
        // 시작 방 설정
        this.currentRoom = dungeonLayout.rooms[dungeonLayout.startRoom];
        
        console.log(`Dungeon generated with ${this.totalRooms} rooms`);
    }

    /**
     * 던전 타일맵 생성
     */
    createDungeonTilemap() {
        const dungeonType = this.dungeonData.type;
        const tilesetKey = `tileset_${dungeonType}`;
        
        // 맵 크기 설정
        const mapWidth = this.currentDungeon.width;
        const mapHeight = this.currentDungeon.height;
        
        // 타일맵 생성
        this.map = this.make.tilemap({
            tileWidth: this.tileSize,
            tileHeight: this.tileSize,
            width: mapWidth,
            height: mapHeight
        });
        
        // 타일셋 추가
        this.tileset = this.map.addTilesetImage(tilesetKey);
        
        // 레이어 생성
        this.floorLayer = this.map.createBlankLayer('floor', this.tileset).fill(-1);
        this.wallLayer = this.map.createBlankLayer('walls', this.tileset).fill(-1);
        this.objectLayer = this.map.createBlankLayer('objects', this.tileset).fill(-1);
        
        // 던전 타일 배치
        this.placeDungeonTiles();
        
        // 충돌 설정
        this.wallLayer.setCollisionByExclusion([-1]);
        this.objectLayer.setCollisionByExclusion([-1, 20, 21, 22, 30, 31]); // 통과 가능한 타일은 제외
        
        // 장식 추가
        this.addDungeonDecorations(dungeonType);
    }

    /**
     * 던전 타일 배치
     */
    placeDungeonTiles() {
        // 방 타일 배치
        this.currentDungeon.rooms.forEach(room => {
            // 방 바닥 채우기
            for (let y = room.y; y < room.y + room.height; y++) {
                for (let x = room.x; x < room.x + room.width; x++) {
                    // 바닥 타일 배치
                    this.floorLayer.putTileAt(this.getTileIndex('floor', room.type), x, y);
                    
                    // 방 경계에 벽 배치
                    if (x === room.x || x === room.x + room.width - 1 ||
                        y === room.y || y === room.y + room.height - 1) {
                        this.wallLayer.putTileAt(this.getTileIndex('wall', room.type), x, y);
                    }
                }
            }
            
            // 문 추가
            if (room.doors) {
                room.doors.forEach(door => {
                    const doorX = Math.floor(door.x);
                    const doorY = Math.floor(door.y);
                    
                    // 벽에 문 위치 표시
                    this.wallLayer.putTileAt(-1, doorX, doorY);
                    this.objectLayer.putTileAt(this.getTileIndex('door', room.type), doorX, doorY);
                });
            }
            
            // 방 유형에 따른 특수 오브젝트 배치
            this.placeRoomObjects(room);
        });
        
        // 복도 배치
        if (this.currentDungeon.corridors) {
            this.currentDungeon.corridors.forEach(corridor => {
                for (let i = 0; i < corridor.tiles.length; i++) {
                    const tile = corridor.tiles[i];
                    this.floorLayer.putTileAt(this.getTileIndex('corridor', 'floor'), tile.x, tile.y);
                    
                    // 복도 벽 확인
                    if (corridor.walls && corridor.walls[i]) {
                        const wall = corridor.walls[i];
                        this.wallLayer.putTileAt(this.getTileIndex('corridor', 'wall'), wall.x, wall.y);
                    }
                }
            });
        }
    }

    /**
     * 방에 특수 오브젝트 배치
     * @param {Object} room - 방 데이터
     */
    placeRoomObjects(room) {
        // 방 유형에 따른 특수 오브젝트 배치
        switch (room.type) {
            case 'entrance':
                // 입구 계단
                this.objectLayer.putTileAt(
                    this.getTileIndex('special', 'entrance'),
                    Math.floor(room.centerX),
                    Math.floor(room.centerY)
                );
                break;
                
            case 'boss':
                // 보스 방 장식
                this.objectLayer.putTileAt(
                    this.getTileIndex('special', 'boss'),
                    Math.floor(room.centerX),
                    Math.floor(room.centerY)
                );
                break;
                
            case 'treasure':
                // 보물 상자
                if (room.entities) {
                    room.entities.forEach(entity => {
                        if (entity.type === 'chest') {
                            this.objectLayer.putTileAt(
                                this.getTileIndex('chest', entity.rarity),
                                Math.floor(entity.x),
                                Math.floor(entity.y)
                            );
                            // 상자 엔티티 생성
                            this.createChest(entity);
                        }
                    });
                }
                break;
                
            case 'merchant':
                // 상인 NPC
                if (room.entities) {
                    room.entities.forEach(entity => {
                        if (entity.type === 'merchant') {
                            this.objectLayer.putTileAt(
                                this.getTileIndex('special', 'merchant'),
                                Math.floor(entity.x),
                                Math.floor(entity.y)
                            );
                        }
                    });
                }
                break;
                
            case 'shrine':
                // 신단
                if (room.entities) {
                    room.entities.forEach(entity => {
                        if (entity.type === 'shrine') {
                            this.objectLayer.putTileAt(
                                this.getTileIndex('shrine', entity.shrineType),
                                Math.floor(entity.x),
                                Math.floor(entity.y)
                            );
                        }
                    });
                }
                break;
        }
    }

    /**
     * 던전에 장식 요소 추가
     * @param {string} dungeonType - 던전 타입
     */
    addDungeonDecorations(dungeonType) {
        // 던전 타입에 따른 장식 선택
        const decorations = this.getDungeonDecorations(dungeonType);
        
        // 각 방에 장식 추가
        this.currentDungeon.rooms.forEach(room => {
            // 특수 방이 아닌 일반 방에만 장식 추가
            if (room.type === 'normal') {
                const decorCount = Math.floor((room.width * room.height) / 30);
                
                for (let i = 0; i < decorCount; i++) {
                    // 랜덤 위치 선택 (방 경계 안쪽으로)
                    const x = Phaser.Math.Between(room.x + 1, room.x + room.width - 2);
                    const y = Phaser.Math.Between(room.y + 1, room.y + room.height - 2);
                    
                    // 이미 오브젝트가 있는지 확인
                    const objectTile = this.objectLayer.getTileAt(x, y);
                    if (objectTile && objectTile.index !== -1) continue;
                    
                    // 랜덤 장식 선택 및 생성
                    const decorType = Phaser.Utils.Array.GetRandom(decorations);
                    this.createDecoration(x, y, decorType);
                }
            }
        });
    }

    /**
     * 던전 타입에 따른 장식 목록 반환
     * @param {string} dungeonType - 던전 타입
     * @returns {Array} - 장식 배열
     */
    getDungeonDecorations(dungeonType) {
        // 던전 타입에 따른 장식 종류
        const decorationsByType = {
            'forest': ['tree', 'bush', 'mushroom', 'flower'],
            'cave': ['stalagmite', 'crystal', 'rock', 'puddle'],
            'ruins': ['pillar', 'statue', 'rubble', 'pot'],
            'tower': ['bookshelf', 'desk', 'candelabra', 'carpet'],
            'castle': ['banner', 'armor', 'weapon_rack', 'throne']
        };
        
        return decorationsByType[dungeonType] || decorationsByType.ruins;
    }

    /**
     * 장식 오브젝트 생성
     * @param {number} x - 타일 X 좌표
     * @param {number} y - 타일 Y 좌표
     * @param {string} decorType - 장식 유형
     * @returns {Object} - 생성된 장식 오브젝트
     */
    createDecoration(x, y, decorType) {
        // 장식 스프라이트 생성
        const decoration = this.decorations.create(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            'decorations',
            `${decorType}_0${Phaser.Math.Between(1, 3)}`
        );
        
        // 물리 특성 설정
        decoration.body.setImmovable(true);
        
        // 통과 가능한 장식인지 확인
        const nonCollidingTypes = ['flower', 'mushroom', 'puddle', 'carpet'];
        if (nonCollidingTypes.includes(decorType)) {
            decoration.body.checkCollision.none = true;
        }
        
        // 깊이 설정 (플레이어 앞/뒤)
        const behindPlayer = ['flower', 'mushroom', 'puddle', 'carpet'];
        decoration.setDepth(behindPlayer.includes(decorType) ? 5 : 15);
        
        return decoration;
    }

    /**
     * 특정 타입 타일의 인덱스 반환
     * @param {string} category - 타일 카테고리
     * @param {string} type - 타일 타입
     * @returns {number} - 타일 인덱스
     */
    getTileIndex(category, type) {
        // 타일 인덱스 맵핑
        const tileIndices = {
            'floor': {
                'entrance': 0,
                'normal': 1,
                'treasure': 2,
                'challenge': 3,
                'merchant': 4,
                'shrine': 5,
                'boss': 6
            },
            'wall': {
                'entrance': 10,
                'normal': 11,
                'treasure': 12,
                'challenge': 13,
                'merchant': 14,
                'shrine': 15,
                'boss': 16
            },
            'door': {
                'entrance': 20,
                'normal': 20,
                'treasure': 21,
                'challenge': 21,
                'merchant': 22,
                'shrine': 22,
                'boss': 23
            },
            'corridor': {
                'floor': 7,
                'wall': 17
            },
            'special': {
                'entrance': 30,
                'exit': 31,
                'boss': 32,
                'merchant': 50
            },
            'chest': {
                'common': 40,
                'uncommon': 41,
                'rare': 42,
                'epic': 43,
                'legendary': 44,
                'mythic': 45
            },
            'shrine': {
                'health': 60,
                'strength': 61,
                'defense': 62,
                'speed': 63,
                'mana': 64
            }
        };
        
        return tileIndices[category]?.[type] || 0;
    }

    /**
     * 플레이어 생성 및 초기화
     */
    createPlayer() {
        // 시작 방 위치 계산
        const startRoom = this.currentDungeon.rooms[this.currentDungeon.startRoom];
        const startX = startRoom.centerX * this.tileSize;
        const startY = startRoom.centerY * this.tileSize;
        
        // 플레이어 생성
        this.player = new Player(
            this,
            startX,
            startY,
            this.selectedClass,
            this.dataManager
        );
        
        // 물리 설정
        this.physics.world.enable(this.player);
        this.player.body.setCollideWorldBounds(true);
        
        // 클래스 스탯 및 스킬 적용
        this.classSystem.applyClassToPlayer(this.player, this.selectedClass);
        
        // 플레이어 상태 정보 표시
        this.hud.updatePlayerStatus(this.player);
        
        console.log(`Player created as ${this.selectedClass}`);
    }

    /**
     * 입력 설정
     */
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
        
        console.log('Input setup complete');
    }

    /**
     * UI 설정
     */
    setupUI() {
        // HUD 초기화
        this.hud.createDungeonUI({
            dungeonName: this.getDungeonName(),
            difficulty: this.difficultyLevel,
            playerClass: this.selectedClass
        });
        
        // 미니맵 생성
        this.hud.createMinimap(this.currentDungeon);
        
        console.log('UI setup complete');
    }

    /**
     * 카메라 설정
     */
    setupCamera() {
        // 카메라가 플레이어를 따라가도록 설정
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(1.5);
        this.targetCameraZoom = 1.5;
        
        // 던전 경계 설정
        const dungeonWidth = this.currentDungeon.width * this.tileSize;
        const dungeonHeight = this.currentDungeon.height * this.tileSize;
        this.cameras.main.setBounds(0, 0, dungeonWidth, dungeonHeight);
        
        // 페이드 인 효과
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        
        console.log('Camera setup complete');
    }

    /**
     * 물리 충돌 설정
     */
    setupCollisions() {
        // 플레이어 충돌 설정
        this.physics.add.collider(this.player, this.wallLayer);
        this.physics.add.collider(this.player, this.objectLayer, this.handleObjectCollision, null, this);
        this.physics.add.collider(this.player, this.decorations, null, this.handleDecorationCollision, this);
        
        // 적 충돌 설정
        this.physics.add.collider(this.enemies, this.wallLayer);
        this.physics.add.collider(this.enemies, this.objectLayer);
        this.physics.add.collider(this.enemies, this.enemies);
        
        // 플레이어-적 충돌
        this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        
        // 소환수 충돌 설정
        this.physics.add.collider(this.summons, this.wallLayer);
        this.physics.add.collider(this.summons, this.enemies, this.handleSummonEnemyCollision, null, this);
        
        console.log('Collision setup complete');
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 던전 완료 이벤트
        this.events.on('bossDefeated', this.onBossDefeated, this);
        
        // 몬스터 처치 이벤트
        this.events.on('enemyDefeated', this.onEnemyDefeated, this);
        
        // 아이템 획득 이벤트
        this.events.on('itemPickup', this.onItemPickup, this);
        
        // 레벨업 이벤트
        this.events.on('playerLevelUp', this.onPlayerLevelUp, this);
        
        // 씬 종료 시 이벤트 정리
        this.events.once('shutdown', this.onSceneShutdown, this);
        
        console.log('Event listeners setup complete');
    }

    // === 게임플레이 메서드 ===

    /**
     * 플레이어 입력 처리
     * @param {number} delta - 프레임 간 시간 차이
     */
    handlePlayerInput(delta) {
        // 플레이어가 비활성 상태면 처리 안 함
        if (!this.player.active || this.player.isStunned) return;
        
        // 이동 입력 처리
        this.handleMovementInput();
        
        // 공격 입력 처리
        if (this.actionKeys.attack.isDown) {
            this.handlePlayerAttack();
        }
        
        // 스킬 입력 처리
        this.handleSkillInputs();
        
        // 상호작용 입력 처리
        if (Phaser.Input.Keyboard.JustDown(this.actionKeys.interact)) {
            this.handleInteraction();
        }
    }

    /**
     * 플레이어 이동 처리
     */
    handleMovementInput() {
        // 이동 속도 계산
        const speed = this.player.stats.speed / 50; // 스피드를 이동 단위로 변환
        let dx = 0;
        let dy = 0;

        // 방향키 입력에 따른 이동 방향 계산
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
    }

    /**
     * 플레이어 공격 처리
     */
    handlePlayerAttack() {
        // 공격 쿨다운 확인
        if (this.combatSystem.isAttackOnCooldown(this.player)) return;

        // 가장 가까운 적 찾기
        const target = this.findNearestEnemy();

        if (target) {
            // 공격 범위 확인
            const attackRange = this.getWeaponRange();

            // 적과의 거리 계산
            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                target.x, target.y
            );

            if (distance <= attackRange) {
                // 공격 애니메이션
                this.player.play(`${this.player.classId}_attack`, true);

                // 무기 타입 가져오기
                const weaponType = this.getEquippedWeaponType();

                // 공격 실행
                this.combatSystem.executePlayerAttack(this.player, target, weaponType);
            }
        }
    }

    /**
     * 스킬 입력 처리
     */
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

    /**
     * 플레이어 스킬 사용
     * @param {number} skillIndex - 스킬 인덱스 (0-3)
     */
    usePlayerSkill(skillIndex) {
        // 플레이어 스킬 목록 확인
        if (!this.player.skills || !this.player.skills[skillIndex]) return;

        const skill = this.player.skills[skillIndex];

        // 스킬이 쿨다운 중인지 확인
        if (this.combatSystem.isSkillOnCooldown(this.player, skillIndex)) return;

        // MP 확인
        if (this.player.stats.mp < skill.manaCost) {
            this.hud.showMessage('마나가 부족합니다!', 0x0000ff);
            return;
        }

        // 타겟 설정
        let target = null;

        switch (skill.targetType) {
            case 'enemy':
                // 가장 가까운 적
                target = this.findNearestEnemy();
                break;
            case 'self':
                // 자기 자신
                target = this.player;
                break;
            case 'position':
                // 마우스 위치
                const worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);
                target = worldPoint;
                break;
            case 'ally':
            case 'allies':
                // 가장 체력이 낮은 아군
                target = this.findLowestHealthAlly();
                break;
            case 'aoe':
                // 플레이어 위치 기준 광역
                target = this.player;
                break;
        }

        // 스킬 사용
        if (target) {
            // 스킬 사용 성공 여부
            const success = this.combatSystem.executeSkill(this.player, skill, target, skillIndex);

            if (success) {
                // 스킬 애니메이션
                this.player.play(`${this.player.classId}_skill${skillIndex + 1}`, true);

                // MP 소모
                this.player.stats.mp -= skill.manaCost;

                // HUD 업데이트
                this.hud.updatePlayerStatus(this.player);
                this.hud.updateSkillCooldown(skillIndex, skill.cooldown);

                // 스킬 사용 이벤트 발생
                this.events.emit('skillUsed', {
                    skillId: skill.id,
                    skillName: skill.name,
                    caster: this.player
                });
            }
        } else if (skill.targetType === 'enemy') {
            this.hud.showMessage('주변에 적이 없습니다!', 0xff0000);
        }
    }

    /**
     * 상호작용 처리
     */
    handleInteraction() {
        // 상호작용 가능한 오브젝트 찾기
        const interactRange = 2 * this.tileSize;
        const interactables = this.findInteractableObjects(interactRange);

        if (interactables.length > 0) {
            // 가장 가까운 오브젝트와 상호작용
            this.interactWithObject(interactables[0]);
        }
    }

    /**
     * 상호작용 가능한 오브젝트 찾기
     * @param {number} range - 상호작용 가능 범위
     * @returns {Array} - 상호작용 가능한 오브젝트 배열
     */
    findInteractableObjects(range) {
        const interactables = [];
        const playerX = this.player.x / this.tileSize;
        const playerY = this.player.y / this.tileSize;

        // 현재 방의 특수 오브젝트 확인
        if (this.currentRoom && this.currentRoom.entities) {
            this.currentRoom.entities.forEach(entity => {
                // 상호작용 가능한 엔티티 타입 확인
                if (['chest', 'merchant', 'shrine'].includes(entity.type) && !entity.used) {
                    const distance = Phaser.Math.Distance.Between(
                        playerX, playerY,
                        entity.x, entity.y
                    );

                    if (distance <= range / this.tileSize) {
                        interactables.push({
                            ...entity,
                            distance: distance,
                            interactType: entity.type
                        });
                    }
                }
            });
        }

        // 거리에 따라 정렬
        interactables.sort((a, b) => a.distance - b.distance);

        return interactables;
    }

    /**
     * 오브젝트와 상호작용
     * @param {Object} object - 상호작용할 오브젝트
     */
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

    /**
     * 보물상자 열기
     * @param {Object} chest - 보물상자 데이터
     */
    openTreasureChest(chest) {
        // 이미 열린 상자면 무시
        if (chest.opened) return;

        // 보물상자 열기 효과
        this.playEffect('chest_open', chest.x * this.tileSize, chest.y * this.tileSize);

        // 아이템 생성
        const items = this.lootSystem.generateChestLoot(
            chest.rarity || 'common',
            this.difficultyLevel
        );

        // 아이템 획득
        items.forEach(item => {
            // 인벤토리에 추가
            this.player.inventory.addItem(item);

            // 아이템 획득 효과
            this.playEffect('item_acquire', chest.x * this.tileSize, chest.y * this.tileSize);

            // 아이템 알림
            this.hud.showItemNotification(item);
        });

        // 골드 획득
        const goldAmount = this.calculateChestGoldReward(chest.rarity);
        this.playerData.gold += goldAmount;

        // 골드 획득 알림
        this.hud.showGoldNotification(goldAmount);

        // 보물상자 상태 변경
        chest.opened = true;

        // 오브젝트 타일 변경 (열린 상자로)
        const tileX = Math.floor(chest.x);
        const tileY = Math.floor(chest.y);
        this.objectLayer.putTileAt(
            this.getTileIndex('chest', chest.rarity) + 100,
            tileX,
            tileY
        );

        // 사운드 재생
        this.sound.play('chest_open');

        // 통계 업데이트
        this.dataManager.updateStatistic('chestsOpened', 1);
    }

    /**
     * 보물상자 골드 보상 계산
     * @param {string} rarity - 보물상자 희귀도
     * @returns {number} - 골드 금액
     */
    calculateChestGoldReward(rarity) {
        // 희귀도에 따른 골드 보상
        const baseGold = 20 * this.difficultyLevel;
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

    /**
     * 상인 상점 열기
     * @param {Object} merchant - 상인 데이터
     */
    openMerchantShop(merchant) {
        // 상인 인벤토리가 없으면 생성
        if (!merchant.inventory) {
            merchant.inventory = this.lootSystem.generateMerchantInventory(
                merchant.merchantType || 'general',
                this.difficultyLevel
            );
        }

        // 상점 UI 열기
        this.hud.openShop(merchant.inventory, this.player);

        // 게임 일시 정지
        this.pauseGame();

        // 사운드 재생
        this.sound.play('merchant_greeting');
    }

    /**
     * 신단 활성화
     * @param {Object} shrine - 신단 데이터
     */
    activateShrine(shrine) {
        // 이미 사용한 신단이면 무시
        if (shrine.used) return;

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
        this.hud.showBuffNotification(shrine.shrineType, buffStrength, buffDuration);

        // 신단 활성화 이펙트
        this.playEffect('shrine_activate', shrine.x * this.tileSize, shrine.y * this.tileSize);

        // 오브젝트 타일 변경 (활성화된 신단으로)
        const tileX = Math.floor(shrine.x);
        const tileY = Math.floor(shrine.y);
        this.objectLayer.putTileAt(
            this.getTileIndex('shrine', shrine.shrineType) + 100,
            tileX,
            tileY
        );

        // 사운드 재생
        this.sound.play('shrine_activate');

        // 버프 지속시간 타이머
        this.time.delayedCall(buffDuration * 1000, () => {
            this.removeShrineEffect(shrine, buffStrength);
        });

        // HUD 업데이트
        this.hud.updatePlayerStatus(this.player);
    }

    /**
     * 신단 효과 제거
     * @param {Object} shrine - 신단 데이터
     * @param {number} buffStrength - 버프 강도
     */
    removeShrineEffect(shrine, buffStrength) {
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
        this.hud.showBuffExpiredNotification(shrine.shrineType);

        // HUD 업데이트
        this.hud.updatePlayerStatus(this.player);
    }

    /**
     * 현재 방 탐색
     */
    exploreCurrentRoom() {
        // 방이 이미 탐색되었는지 확인
        if (this.currentRoom.explored) return;

        // 방 탐색 표시
        this.currentRoom.explored = true;
        this.exploredRooms++;

        // 미니맵 업데이트
        this.hud.updateMinimap(this.currentDungeon.rooms, this.currentRoom);

        // 방 유형에 따른 특별 처리
        this.handleRoomTypeSpecifics();

        // 적 스폰
        this.spawnEnemiesInRoom(this.currentRoom);

        // 진행률 업데이트
        this.hud.updateProgress(this.exploredRooms, this.totalRooms);

        // 방 탐색 이벤트 발생
        this.events.emit('roomExplored', this.currentRoom);
    }

    /**
     * 방 유형에 따른 특별 처리
     */
    handleRoomTypeSpecifics() {
        // 방 타입별 특수 처리
        switch (this.currentRoom.type) {
            case 'entrance':
                // 입구 방 효과
                this.playRoomEntranceEffect('entrance');
                break;
            case 'boss':
                // 보스 방 경고
                this.showBossRoomWarning();
                break;
            case 'treasure':
                // 보물 방 효과
                this.playRoomEntranceEffect('treasure');
                break;
            case 'merchant':
                // 상인 방 대사
                this.playRoomEntranceEffect('merchant');
                break;
            case 'challenge':
                // 도전 방 정보
                this.showChallengeRoomInfo();
                break;
            case 'shrine':
                // 신단 방 효과
                this.playRoomEntranceEffect('shrine');
                break;
            default:
                // 일반 방
                this.playRoomEntranceEffect('normal');
                break;
        }
    }

    /**
     * 방 입장 효과 재생
     * @param {string} roomType - 방 타입
     */
    playRoomEntranceEffect(roomType) {
        // 효과 위치 (플레이어 위치)
        const effectX = this.player.x;
        const effectY = this.player.y;

        // 방 타입별 이펙트 재생
        this.playEffect('room_enter_' + roomType, effectX, effectY);

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

    /**
     * 보스 방 경고 표시
     */
    showBossRoomWarning() {
        // 보스 이름
        const bossName = this.currentRoom.bossName || '던전 보스';

        // 보스 경고 UI
        this.hud.showBossWarning(bossName);

        // 카메라 효과
        this.cameras.main.shake(500, 0.01);

        // 보스 음악 재생
        this.sound.stopByKey('dungeon_music');
        this.sound.play('boss_music', { volume: 0.7 });
    }

    /**
     * 도전 방 정보 표시
     */
    showChallengeRoomInfo() {
        // 도전 방 정보
        const room = this.currentRoom;
        const waveCount = room.waves ? room.waves.total : 3;

        // 도전 정보 UI
        this.hud.showChallengeInfo(waveCount);
    }

    /**
     * 방 안의 적 생성
     * @param {Object} room - 방 데이터
     */
    spawnEnemiesInRoom(room) {
        // 방에 이미 적이 생성되었는지 확인
        if (room.enemiesSpawned) return;

        // 방 타입이 boss인 경우 보스 생성
        if (room.type === 'boss') {
            this.spawnBoss(room);
        }
        // 일반/도전 방인 경우 일반 몬스터 생성
        else if (room.type === 'normal' || room.type === 'challenge') {
            this.spawnRegularEnemies(room);
        }

        // 방에 배치된 함정 생성
        if (room.entities) {
            room.entities.forEach(entity => {
                if (entity.type === 'trap') {
                    this.createTrap(entity, room);
                }
            });
        }

        // 적 생성 완료 표시
        room.enemiesSpawned = true;
    }

    /**
     * 보스 몬스터 생성
     * @param {Object} room - 보스 방 데이터
     */
    spawnBoss(room) {
        // 던전 데이터에서 보스 ID 가져오기
        const bossId = this.dungeonData.monsters.boss;
        
        // 보스 데이터 가져오기
        const bossData = this.dataManager.getMonsterById(bossId);
        
        if (!bossData) {
            console.error(`Boss data not found for ID: ${bossId}`);
            return;
        }
        
        // 방 중앙 위치 계산
        const centerX = Math.floor(room.centerX) * this.tileSize;
        const centerY = Math.floor(room.centerY) * this.tileSize;
        
        // 보스 몬스터 생성
        const boss = new Enemy(
            this,
            centerX,
            centerY,
            bossData,
            this.difficultyLevel,
            true // isBoss
        );
        
        // 보스 이름 설정
        room.bossName = bossData.name;
        
        // 보스 생성 이펙트
        this.playEffect('boss_spawn', centerX, centerY);
        
        // 보스 등장 사운드
        this.sound.play('boss_appear');
        
        // 적 그룹에 추가
        this.enemies.add(boss);
    }

    /**
     * 일반 적 생성
     * @param {Object} room - 방 데이터
     */
    spawnRegularEnemies(room) {
        // 도전 방인 경우 웨이브 설정
        if (room.type === 'challenge' && !room.waves) {
            room.waves = {
                current: 0,
                total: Phaser.Math.Between(2, 4),
                completed: false
            };
        }
        
        // 방 크기에 따른 몬스터 수 계산
        const roomArea = room.width * room.height;
        const baseCount = Math.floor(roomArea / 30);
        
        // 도전 방은 몬스터가 더 많음
        const monsterCount = room.type === 'challenge' 
            ? baseCount * 1.5 
            : baseCount;
        
        // 최종 몬스터 수 (최소 1, 최대 8)
        const finalCount = Phaser.Math.Clamp(
            Math.floor(monsterCount * (0.8 + Math.random() * 0.4)),
            1,
            8
        );
        
        // 엘리트 몬스터 출현 확률
        const eliteChance = 0.1 + (this.difficultyLevel * 0.02);
        
        // 몬스터 생성
        for (let i = 0; i < finalCount; i++) {
            // 방 내 랜덤 위치 선택
            const x = Phaser.Math.Between(room.x + 1, room.x + room.width - 2);
            const y = Phaser.Math.Between(room.y + 1, room.y + room.height - 2);
            
            // 위치 유효성 확인 (다른 몬스터/오브젝트와 겹치지 않는지)
            if (this.isPositionOccupied(x, y)) {
                i--; // 재시도
                continue;
            }
            
            // 엘리트 몬스터 여부
            const isElite = Math.random() < eliteChance;
            
            // 던전에 맞는 몬스터 ID 선택
            const monsterPool = isElite 
                ? this.dungeonData.monsters.elite 
                : this.dungeonData.monsters.normal;
                
            const monsterId = Phaser.Utils.Array.GetRandom(monsterPool);
            
            // 몬스터 데이터 가져오기
            const monsterData = this.dataManager.getMonsterById(monsterId);
            
            if (!monsterData) continue;
            
            // 몬스터 생성
            const monster = new Enemy(
                this,
                x * this.tileSize,
                y * this.tileSize,
                monsterData,
                this.difficultyLevel,
                isElite
            );
            
            // 적 그룹에 추가
            this.enemies.add(monster);
        }
    }

    /**
     * 함정 생성
     * @param {Object} trapData - 함정 데이터
     * @param {Object} room - 방 데이터
     */
    createTrap(trapData, room) {
        // 함정 스프라이트 생성
        const trap = this.traps.create(
            trapData.x * this.tileSize,
            trapData.y * this.tileSize,
            'traps',
            `${trapData.trapType}_idle_01`
        );
        
        // 물리 설정
        trap.body.setImmovable(true);
        trap.body.setSize(this.tileSize * 0.8, this.tileSize * 0.8);
        
        // 함정 데이터 설정
        trap.trapType = trapData.trapType;
        trap.damage = trapData.damage || (10 * this.difficultyLevel);
        trap.triggered = false;
        trap.visible = trapData.visible !== false;
        
        // 보이지 않는 함정인 경우 알파값 설정
        if (!trap.visible) {
            trap.setAlpha(0.2);
        }
        
        // 함정 애니메이션 생성
        this.createTrapAnimations(trap);
        
        return trap;
    }

    /**
     * 함정 애니메이션 생성
     * @param {Object} trap - 함정 스프라이트
     */
    createTrapAnimations(trap) {
        const trapType = trap.trapType;
        const animKey = `${trapType}_idle`;
        
        // 이미 생성된 애니메이션인지 확인
        if (this.anims.exists(animKey)) {
            trap.play(animKey);
            return;
        }
        
        // 대기 애니메이션
        this.anims.create({
            key: animKey,
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
        trap.play(animKey);
    }

    /**
     * 위치가 이미 점유됐는지 확인
     * @param {number} x - 타일 X 좌표
     * @param {number} y - 타일 Y 좌표
     * @returns {boolean} - 점유 여부
     */
    isPositionOccupied(x, y) {
        // 타일 충돌 확인
        const wallTile = this.wallLayer.getTileAt(x, y);
        const objectTile = this.objectLayer.getTileAt(x, y);
        
        if ((wallTile && wallTile.index !== -1) ||
            (objectTile && objectTile.index !== -1)) {
            return true;
        }
        
        // 이미 존재하는 적 확인
        let occupied = false;
        this.enemies.getChildren().forEach(enemy => {
            const enemyTileX = Math.floor(enemy.x / this.tileSize);
            const enemyTileY = Math.floor(enemy.y / this.tileSize);
            
            if (enemyTileX === x && enemyTileY === y) {
                occupied = true;
            }
        });
        
        return occupied;
    }

    /**
     * 적 업데이트
     * @param {number} delta - 프레임 간 시간 차이
     */
    updateEnemies(delta) {
        // 각 적 AI 업데이트
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            
            // 기절 상태이면 움직이지 않음
            if (enemy.isStunned || enemy.isFrozen) {
                enemy.body.velocity.x = 0;
                enemy.body.velocity.y = 0;
                return;
            }
            
            // 적 AI 업데이트
            this.updateEnemyBehavior(enemy, delta);
        });
    }

    /**
     * 적 행동 업데이트
     * @param {Object} enemy - 적 객체
     * @param {number} delta - 프레임 간 시간 차이
     */
    updateEnemyBehavior(enemy, delta) {
        // 플레이어와의 거리 계산
        const distToPlayer = Phaser.Math.Distance.Between(
            enemy.x, enemy.y,
            this.player.x, this.player.y
        );
        
        // 시야 범위
        const sightRange = enemy.isBoss ? 15 * this.tileSize : 10 * this.tileSize;
        
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

    /**
     * 적이 플레이어를 향해 이동
     * @param {Object} enemy - 적 객체
     */
    moveEnemyTowardsPlayer(enemy) {
        // 적이 플레이어를 향해 이동
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        
        // 이동 속도 계산
        const speed = enemy.stats.speed;
        
        // 이동 방향
        enemy.body.velocity.x = Math.cos(angle) * speed;
        enemy.body.velocity.y = Math.sin(angle) * speed;
        
        // 애니메이션 설정
        enemy.play(`${enemy.monsterType}_walk`, true);
        
        // 이동 방향에 따라 스프라이트 반전
        enemy.setFlipX(enemy.body.velocity.x < 0);
    }

    /**
     * 적의 랜덤 이동
     * @param {Object} enemy - 적 객체
     * @param {number} delta - 프레임 간 시간 차이
     */
    moveEnemyRandomly(enemy, delta) {
        // 랜덤 이동 업데이트 (일정 시간마다)
        if (!enemy.nextMoveTime || enemy.nextMoveTime <= 0) {
            // 50% 확률로 움직임 or 정지
            if (Math.random() < 0.5) {
                // 랜덤 방향
                const angle = Math.random() * Math.PI * 2;
                const speed = enemy.stats.speed * 0.5; // 더 느리게 이동
                
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

    /**
     * 적 공격 처리
     * @param {Object} enemy - 적 객체
     */
    enemyAttack(enemy) {
        // 공격 쿨다운 확인
        const now = Date.now();
        const attackCooldown = enemy.attackSpeed || 1500; // 기본 1.5초 쿨다운
        
        if (now - enemy.lastAttackTime < attackCooldown) return;
        
        // 공격 애니메이션
        enemy.play(`${enemy.monsterType}_attack`, true);
        
        // 공격 타이밍 (애니메이션 중간 즈음에 데미지 적용)
        this.time.delayedCall(300, () => {
            if (enemy.active) {
                // 플레이어 공격
                this.combatSystem.executeMonsterAttack(enemy, this.player);
            }
        });
        
        // 공격 후 속도 멈춤
        enemy.body.velocity.x = 0;
        enemy.body.velocity.y = 0;
        
        // 쿨다운 업데이트
        enemy.lastAttackTime = now;
    }

    /**
     * 소환수 업데이트
     * @param {number} delta - 프레임 간 시간 차이
     */
    updateSummons(delta) {
        this.summons.getChildren().forEach(summon => {
            if (!summon.active) return;
            
            // 소환수 수명 확인
            if (summon.lifetime) {
                summon.lifetime -= delta;
                if (summon.lifetime <= 0) {
                    // 소환수 사라짐 효과
                    this.playEffect('summon_disappear', summon.x, summon.y);
                    summon.destroy();
                    return;
                }
            }
            
            // 소환수 AI 업데이트
            this.updateSummonBehavior(summon, delta);
        });
    }

    /**
     * 소환수 행동 업데이트
     * @param {Object} summon - 소환수 객체
     * @param {number} delta - 프레임 간 시간 차이
     */
    updateSummonBehavior(summon, delta) {
        // 가장 가까운 적 찾기
        const target = this.findNearestEnemyToPosition(summon.x, summon.y);
        
        if (target) {
            // 적과의 거리 계산
            const distance = Phaser.Math.Distance.Between(
                summon.x, summon.y,
                target.x, target.y
            );
            
            // 공격 범위
            const attackRange = summon.attackRange || 1.5 * this.tileSize;
            
            // 공격 범위 안이면 공격
            if (distance <= attackRange) {
                this.summonAttack(summon, target);
            } else {
                // 공격 범위 밖이면 적 추적
                this.moveSummonToTarget(summon, target);
            }
        } else {
            // 주변에 적이 없으면 플레이어 근처로 이동
            this.moveSummonToOwner(summon);
        }
    }

    /**
     * 소환수가 적을 공격
     * @param {Object} summon - 소환수 객체
     * @param {Object} target - 공격 대상
     */
    summonAttack(summon, target) {
        // 공격 쿨다운 확인
        const now = Date.now();
        const attackCooldown = summon.attackSpeed || 1000;
        
        if (now - (summon.lastAttackTime || 0) < attackCooldown) return;
        
        // 공격 애니메이션
        summon.play(`${summon.summonType}_attack`, true);
        
        // 공격 실행
        this.time.delayedCall(200, () => {
            if (summon.active && target.active) {
                // 데미지 계산
                const damage = summon.stats.attack;
                
                // 데미지 적용
                this.combatSystem.applyDamage(target, damage, summon);
            }
        });
        
        // 쿨다운 업데이트
        summon.lastAttackTime = now;
    }

    /**
     * 소환수가 대상으로 이동
     * @param {Object} summon - 소환수 객체
     * @param {Object} target - 이동 목표
     */
    moveSummonToTarget(summon, target) {
        // 목표를 향한 각도
        const angle = Phaser.Math.Angle.Between(summon.x, summon.y, target.x, target.y);
        
        // 이동 속도
        const speed = summon.stats.speed;
        
        // 이동 방향
        summon.body.velocity.x = Math.cos(angle) * speed;
        summon.body.velocity.y = Math.sin(angle) * speed;
        
        // 애니메이션
        summon.play(`${summon.summonType}_walk`, true);
        
        // 방향에 따라 스프라이트 반전
        summon.setFlipX(summon.body.velocity.x < 0);
    }

    /**
     * 소환수가 주인(플레이어)에게 돌아옴
     * @param {Object} summon - 소환수 객체
     */
    moveSummonToOwner(summon) {
        // 플레이어와의 거리
        const distance = Phaser.Math.Distance.Between(
            summon.x, summon.y,
            this.player.x, this.player.y
        );
        
        // 일정 거리 이상이면 플레이어에게 이동
        if (distance > 3 * this.tileSize) {
            // 플레이어를 향한 각도
            const angle = Phaser.Math.Angle.Between(summon.x, summon.y, this.player.x, this.player.y);
            
            // 이동 속도
            const speed = summon.stats.speed;
            
            // 이동 방향
            summon.body.velocity.x = Math.cos(angle) * speed;
            summon.body.velocity.y = Math.sin(angle) * speed;
            
            // 애니메이션
            summon.play(`${summon.summonType}_walk`, true);
            
            // 방향에 따라 스프라이트 반전
            summon.setFlipX(summon.body.velocity.x < 0);
        } else {
            // 가까우면 정지
            summon.body.velocity.x = 0;
            summon.body.velocity.y = 0;
            
            // 정지 애니메이션
            summon.play(`${summon.summonType}_idle`, true);
        }
    }

    /**
     * 함정 확인
     */
    checkTraps() {
        // 플레이어가 함정 위에 있는지 확인
        this.traps.getChildren().forEach(trap => {
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

    /**
     * 함정 발동
     * @param {Object} trap - 함정 객체
     */
    triggerTrap(trap) {
        // 함정 발동
        trap.triggered = true;
        
        // 함정 애니메이션
        trap.play(`${trap.trapType}_trigger`);
        
        // 함정 효과
        switch (trap.trapType) {
            case 'spike':
                // 가시 함정 - 즉시 대미지
                this.dealTrapDamage(trap);
                this.playEffect('trap_spike', trap.x, trap.y);
                break;
                
            case 'poison':
                // 독 함정 - 독 상태 효과
                this.combatSystem.applyStatusEffect(this.player, 'poison', trap.damage / 3, 5);
                this.playEffect('trap_poison', trap.x, trap.y);
                break;
                
            case 'arrow':
                // 화살 함정 - 여러 방향에서 화살 발사
                this.shootTrapArrows(trap);
                break;
                
            case 'fire':
                // 화염 함정 - 화상 상태 효과
                this.combatSystem.applyStatusEffect(this.player, 'burn', trap.damage / 3, 4);
                this.playEffect('trap_fire', trap.x, trap.y);
                break;
                
            case 'frost':
                // 냉기 함정 - 감속 효과
                this.combatSystem.applyStatusEffect(this.player, 'slow', 30, 5);
                this.playEffect('trap_frost', trap.x, trap.y);
                break;
        }
        
        // 함정 발동 사운드
        this.sound.play(`trap_${trap.trapType}`);
    }

    /**
     * 함정 대미지 적용
     * @param {Object} trap - 함정 객체
     */
    dealTrapDamage(trap) {
        // 함정 대미지 적용
        const damage = trap.damage || 10;
        
        // 대미지 적용
        this.combatSystem.applyDamage(this.player, damage);
        
        // 플레이어 체력 0 확인
        if (this.player.stats.hp <= 0) {
            this.playerDeath();
        }
    }

    /**
     * 화살 함정 화살 발사
     * @param {Object} trap - 함정 객체
     */
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
                this.playEffect('trap_arrow', trap.x, trap.y, { direction: dir });
                
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

    /**
     * 아이템 획득 확인
     */
    checkItemPickup() {
        this.items.getChildren().forEach(item => {
            // 플레이어와의 거리 확인
            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                item.x, item.y
            );
            
            // 획득 범위 내인지 확인
            if (distance <= this.tileSize * 1.2) {
                this.pickupItem(item);
            }
        });
    }

    /**
     * 아이템 획득
     * @param {Object} item - 아이템 객체
     */
    pickupItem(item) {
        // 아이템 정보 저장
        const itemData = {
            id: item.itemId,
            name: item.name,
            type: item.type,
            rarity: item.rarity
        };
        
        // 아이템 획득 효과
        this.playEffect('item_pickup', item.x, item.y);
        
        // 아이템 타입 확인
        switch (item.type) {
            case 'gold':
                // 골드 획득
                const goldAmount = item.value || 10;
                this.playerData.gold += goldAmount;
                this.hud.showGoldNotification(goldAmount);
                break;
                
            case 'potion':
                // 포션 효과 적용
                this.usePotion(item);
                break;
                
            case 'scroll':
                // 스크롤 사용
                this.useScroll(item);
                break;
                
            default:
                // 일반 아이템 인벤토리에 추가
                this.player.inventory.addItem(itemData);
                this.hud.showItemNotification(itemData);
                break;
        }
        
        // 아이템 삭제
        item.destroy();
        
        // 아이템 획득 사운드
        this.sound.play('item_pickup');
        
        // 아이템 획득 이벤트 발생
        this.events.emit('itemPickup', itemData);
    }

    /**
     * 포션 사용
     * @param {Object} potion - 포션 객체
     */
    usePotion(potion) {
        switch (potion.potionType) {
            case 'health':
                // 체력 회복
                const healAmount = potion.effectValue || 20;
                this.player.stats.hp = Math.min(this.player.stats.hp + healAmount, this.player.stats.maxHp);
                this.hud.showFloatingText(this.player.x, this.player.y, `+${healAmount} HP`, 0x00FF00);
                break;
                
            case 'mana':
                // 마나 회복
                const manaAmount = potion.effectValue || 15;
                this.player.stats.mp = Math.min(this.player.stats.mp + manaAmount, this.player.stats.maxMp);
                this.hud.showFloatingText(this.player.x, this.player.y, `+${manaAmount} MP`, 0x0000FF);
                break;
                
            case 'strength':
            case 'defense':
            case 'speed':
                // 스탯 버프
                this.applyPotionBuff(potion);
                break;
        }
        
        // 포션 효과 이펙트
        this.playEffect('potion_use', this.player.x, this.player.y, { type: potion.potionType });
        
        // HUD 업데이트
        this.hud.updatePlayerStatus(this.player);
    }

    /**
     * 포션 버프 적용
     * @param {Object} potion - 포션 객체
     */
    applyPotionBuff(potion) {
        const buffValue = potion.effectValue || 10;
        const duration = potion.duration || 60; // 기본 60초
        const statType = potion.potionType;
        
        // 기존 버프가 있다면 제거
        if (this.player.buffs && this.player.buffs[statType]) {
            // 이전 타이머 제거
            if (this.timers[`buff_${statType}`]) {
                this.time.removeEvent(this.timers[`buff_${statType}`]);
            }
            
            // 기존 버프 효과 제거
            const oldValue = this.player.buffs[statType].value;
            this.player.stats[statType] /= (1 + oldValue / 100);
        }
        
        // 새로운 버프 적용
        if (!this.player.buffs) this.player.buffs = {};
        
        this.player.buffs[statType] = {
            value: buffValue,
            duration: duration
        };
        
        // 스탯 증가
        this.player.stats[statType] *= (1 + buffValue / 100);
        
        // 버프 알림
        this.hud.showBuffNotification(statType, buffValue, duration);
        
        // 지속시간 타이머
        this.timers[`buff_${statType}`] = this.time.delayedCall(duration * 1000, () => {
            // 버프 종료 시 효과 제거
            if (this.player.buffs && this.player.buffs[statType]) {
                this.player.stats[statType] /= (1 + buffValue / 100);
                delete this.player.buffs[statType];
                
                // 버프 종료 알림
                this.hud.showBuffExpiredNotification(statType);
                
                // HUD 업데이트
                this.hud.updatePlayerStatus(this.player);
            }
        });
    }

    /**
     * 스크롤 사용
     * @param {Object} scroll - 스크롤 객체
     */
    useScroll(scroll) {
        switch (scroll.scrollType) {
            case 'teleport':
                // 무작위 방으로 텔레포트
                this.teleportToRandomRoom();
                break;
                
            case 'identify':
                // 인벤토리 아이템 확인
                this.identifyItems();
                break;
                
            case 'fireball':
                // 화염구 공격
                this.castAreaSpell('fire', scroll.effectValue || 30);
                break;
                
            case 'frost':
                // 냉기 공격
                this.castAreaSpell('ice', scroll.effectValue || 20, 'slow');
                break;
                
            case 'lightning':
                // 번개 공격
                this.castChainLightning(scroll.effectValue || 40);
                break;
                
            case 'healing':
                // 광역 치유
                this.castAreaHeal(scroll.effectValue || 50);
                break;
        }
        
        // 스크롤 사용 효과
        this.playEffect('scroll_use', this.player.x, this.player.y, { type: scroll.scrollType });
    }

    /**
     * 광역 주문 시전
     * @param {string} element - 원소 유형
     * @param {number} damage - 데미지
     * @param {string} effect - 상태 효과
     */
    castAreaSpell(element, damage, effect = null) {
        // 광역 효과 반경
        const radius = 3 * this.tileSize;
        
        // 효과 재생
        this.playEffect('spell_cast', this.player.x, this.player.y, { element: element });
        
        // 범위 내 적 찾기
        this.enemies.getChildren().forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );
            
            if (distance <= radius) {
                // 대미지 계산 (거리에 따라 감소)
                const distanceFactor = 1 - (distance / radius * 0.5);
                const finalDamage = Math.floor(damage * distanceFactor);
                
                // 대미지 적용
                this.combatSystem.applyDamage(enemy, finalDamage, this.player, { element: element });
                
                // 추가 효과 적용
                if (effect) {
                    let duration = 3; // 기본 지속시간
                    let value = 30;   // 기본 효과 강도
                    
                    switch (effect) {
                        case 'slow':
                            value = 50; // 50% 감속
                            break;
                        case 'burn':
                            value = finalDamage / 4; // 화상 대미지
                            break;
                        case 'freeze':
                            duration = 2; // 빙결 지속시간
                            break;
                    }
                    
                    this.combatSystem.applyStatusEffect(enemy, effect, value, duration);
                }
            }
        });
    }

    /**
     * 연쇄 번개 시전
     * @param {number} damage - 데미지
     */
    castChainLightning(damage) {
        // 첫 번째 타겟
        const firstTarget = this.findNearestEnemy();
        
        if (!firstTarget) return;
        
        // 효과 재생
        this.playEffect('lightning_cast', this.player.x, this.player.y);
        
        // 번개 연쇄 시작
        this.chainLightningEffect(this.player, firstTarget, damage, 3);
    }

    /**
     * 연쇄 번개 효과
     * @param {Object} source - 출발점
     * @param {Object} target - 타겟
     * @param {number} damage - 데미지
     * @param {number} jumpsLeft - 남은 연쇄 횟수
     */
    chainLightningEffect(source, target, damage, jumpsLeft) {
        // 번개 효과
        this.playEffect('lightning_hit', target.x, target.y);
        
        // 대미지 적용
        this.combatSystem.applyDamage(target, damage, this.player, { element: 'lightning' });
        
        // 더 이상 연쇄가 없으면 종료
        if (jumpsLeft <= 0) return;
        
        // 다음 타겟 찾기 (현재 타겟에서 가장 가까운 적)
        const nextTargets = this.findNearestEnemiesExcept(target, 1);
        
        if (nextTargets.length > 0) {
            const nextTarget = nextTargets[0];
            
            // 약간의 지연 후 다음 연쇄
            this.time.delayedCall(200, () => {
                this.chainLightningEffect(target, nextTarget, damage * 0.7, jumpsLeft - 1);
            });
        }
    }

    /**
     * 광역 치유 시전
     * @param {number} healAmount - 치유량
     */
    castAreaHeal(healAmount) {
        // 치유 효과
        this.playEffect('healing_cast', this.player.x, this.player.y);
        
        // 플레이어 체력 회복
        this.player.stats.hp = Math.min(this.player.stats.hp + healAmount, this.player.stats.maxHp);
        
        // 체력 회복 표시
        this.hud.showFloatingText(this.player.x, this.player.y, `+${healAmount} HP`, 0x00FF00);
        
        // 소환수 체력 회복
        this.summons.getChildren().forEach(summon => {
            // 소환수 체력 회복
            summon.stats.hp = Math.min(summon.stats.hp + healAmount * 0.5, summon.stats.maxHp);
            
            // 체력 회복 표시
            this.hud.showFloatingText(summon.x, summon.y, `+${Math.floor(healAmount * 0.5)} HP`, 0x00FF00);
        });
        
        // HUD 업데이트
        this.hud.updatePlayerStatus(this.player);
    }

    /**
     * 텔레포트 주문 시전
     */
    teleportToRandomRoom() {
        // 무작위 방 선택 (현재 방 제외)
        const availableRooms = this.currentDungeon.rooms.filter(room => 
            room !== this.currentRoom && room.type !== 'boss');
        
        if (availableRooms.length === 0) return;
        
        // 무작위 방 선택
        const randomRoom = Phaser.Utils.Array.GetRandom(availableRooms);
        
        // 텔레포트 이펙트 (사라짐)
        this.playEffect('teleport_out', this.player.x, this.player.y);
        
        // 카메라 효과
        this.cameras.main.flash(500, 255, 255, 255);
        
        // 지연 후 이동
        this.time.delayedCall(500, () => {
            // 플레이어 위치 변경
            this.player.x = randomRoom.centerX * this.tileSize;
            this.player.y = randomRoom.centerY * this.tileSize;
            
            // 텔레포트 이펙트 (나타남)
            this.playEffect('teleport_in', this.player.x, this.player.y);
            
            // 플레이어 방 변경
            this.currentRoom = randomRoom;
            this.exploreCurrentRoom();
        });
    }

    /**
     * 인벤토리 아이템 확인 (감정 주문)
     */
    identifyItems() {
        // 미확인 아이템 감정
        let identifiedCount = 0;
        
        if (this.player.inventory && this.player.inventory.items) {
            this.player.inventory.items.forEach(item => {
                if (item.identified === false) {
                    item.identified = true;
                    identifiedCount++;
                }
            });
        }
        
        // 감정 결과 알림
        if (identifiedCount > 0) {
            this.hud.showMessage(`${identifiedCount}개의 아이템을 감정했습니다.`, 0xFFFF00);
        } else {
            this.hud.showMessage('감정할 아이템이 없습니다.', 0xFFFF00);
        }
    }

    /**
     * 방 변경 확인
     */
    checkRoomChange() {
        // 플레이어 위치의 타일 좌표 계산
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

    /**
     * 특정 타일 위치의 방 찾기
     * @param {number} tileX - X 타일 좌표
     * @param {number} tileY - Y 타일 좌표
     * @returns {Object} 해당 위치의 방 객체
     */
    findRoomAtPosition(tileX, tileY) {
        return this.currentDungeon.rooms.find(room =>
            tileX >= room.x &&
            tileX < room.x + room.width &&
            tileY >= room.y &&
            tileY < room.y + room.height
        );
    }

    /**
     * 방 변경
     * @param {Object} newRoom - 새 방 객체
     */
    changeRoom(newRoom) {
        // 이전 방
        const previousRoom = this.currentRoom;
        
        // 현재 방 변경
        this.currentRoom = newRoom;
        
        // 도전 방 타이머 정리
        if (previousRoom.type === 'challenge' && this.timers.challengeWave) {
            this.time.removeEvent(this.timers.challengeWave);
        }
        
        // 새 방 탐색
        this.exploreCurrentRoom();
        
        // 음악 변경 (보스방 <-> 일반방)
        if (previousRoom.type === 'boss' && newRoom.type !== 'boss') {
            this.sound.stopByKey('boss_music');
            this.sound.play('dungeon_music', { volume: 0.5 });
        } else if (previousRoom.type !== 'boss' && newRoom.type === 'boss') {
            this.sound.stopByKey('dungeon_music');
            this.sound.play('boss_music', { volume: 0.7 });
        }
    }

    /**
     * 이펙트 재생
     * @param {string} effectType - 이펙트 타입
     * @param {number} x - x 좌표
     * @param {number} y - y 좌표
     * @param {Object} options - 추가 옵션
     * @returns {Object} 이펙트 객체
     */
    playEffect(effectType, x, y, options = {}) {
        // 이펙트 생성
        let effect;
        
        switch (effectType) {
            case 'chest_open':
                effect = this.add.sprite(x, y, 'effects', 'chest_open_01');
                effect.play('chest_open_anim');
                break;
                
            case 'item_pickup':
                effect = this.add.sprite(x, y, 'effects', 'item_pickup_01');
                effect.play('item_pickup_anim');
                break;
                
            case 'item_acquire':
                // 희귀도에 따른 색상
                const rarityColors = {
                    common: 0xFFFFFF,
                    uncommon: 0x00FF00,
                    rare: 0x0000FF,
                    epic: 0xFF00FF,
                    legendary: 0xFFA500,
                    mythic: 0xFF0000
                };
                
                const color = rarityColors[options.rarity] || 0xFFFFFF;
                
                effect = this.add.sprite(x, y, 'effects', 'item_glow_01');
                effect.setTint(color);
                effect.play('item_glow_anim');
                break;
                
            case 'enemy_defeat':
                effect = this.add.sprite(x, y, 'effects', 'enemy_defeat_01');
                effect.play('enemy_defeat_anim');
                break;
                
            case 'boss_spawn':
                effect = this.add.sprite(x, y, 'effects', 'boss_spawn_01');
                effect.play('boss_spawn_anim');
                effect.setScale(2);
                break;
                
            case 'player_hit':
                effect = this.add.sprite(x, y, 'effects', 'player_hit_01');
                effect.play('player_hit_anim');
                break;
                
            case 'player_death':
                effect = this.add.sprite(x, y, 'effects', 'player_death_01');
                effect.play('player_death_anim');
                break;
                
            case 'teleport_out':
                effect = this.add.sprite(x, y, 'effects', 'teleport_out_01');
                effect.play('teleport_out_anim');
                break;
                
            case 'teleport_in':
                effect = this.add.sprite(x, y, 'effects', 'teleport_in_01');
                effect.play('teleport_in_anim');
                break;
                
            case 'spell_cast':
                // 원소에 따른 이펙트
                const element = options.element || 'neutral';
                effect = this.add.sprite(x, y, 'effects', `spell_${element}_01`);
                effect.play(`spell_${element}_anim`);
                break;
                
            case 'shrine_activate':
                const shrineType = options.shrineType || 'health';
                effect = this.add.sprite(x, y, 'effects', `shrine_${shrineType}_01`);
                effect.play(`shrine_${shrineType}_anim`);
                break;
                
            case 'room_enter_boss':
                effect = this.add.sprite(x, y, 'effects', 'boss_warning_01');
                effect.play('boss_warning_anim');
                effect.setScale(2);
                break;
                
            default:
                // 기본 입자 이펙트
                effect = this.add.particles(x, y, 'particle', {
                    lifespan: 1000,
                    speed: { min: 50, max: 100 },
                    scale: { start: 1, end: 0 },
                    quantity: 20,
                    emitting: false
                });
                effect.explode();
                break;
        }
        
        // 일정 시간 후 삭제 (파티클이 아닌 경우)
        if (effect.type !== 'ParticleEmitter') {
            effect.once('animationcomplete', () => {
                effect.destroy();
            });
        }
        
        return effect;
    }

    /**
     * 카메라 업데이트
     */
    updateCamera() {
        // 목표 줌과 현재 줌 차이
        const zoomDiff = this.targetCameraZoom - this.cameras.main.zoom;
        
        // 부드러운 줌 전환
        if (Math.abs(zoomDiff) > 0.01) {
            this.cameras.main.zoom += zoomDiff * 0.05;
        }
        
        // 카메라 흔들림 효과 (플레이어 피격 시)
        if (this.player.lastHitTime && Date.now() - this.player.lastHitTime < 200) {
            const intensity = 0.005;
            this.cameras.main.shake(200, intensity);
        }
    }

    /**
     * 게임 시간 업데이트
     * @param {number} delta - 프레임 간 시간 차이
     */
    updateGameTime(delta) {
        // 경과 시간 업데이트
        this.elapsedTime += delta;
        
        // 던전 런 데이터 업데이트
        this.dataManager.updateRunTime(this.elapsedTime / 1000); // 초 단위
        
        // 시간 UI 업데이트 (1초마다)
        if (Math.floor(this.elapsedTime / 1000) !== Math.floor((this.elapsedTime - delta) / 1000)) {
            this.hud.updateTime(this.elapsedTime);
        }
    }

    // === 유틸리티 메서드 ===

    /**
     * 가장 가까운 적 찾기
     * @returns {Object} 가장 가까운 적 객체
     */
    findNearestEnemy() {
        let nearestEnemy = null;
        let minDistance = Number.MAX_VALUE;
        
        this.enemies.getChildren().forEach(enemy => {
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

    /**
     * 특정 위치에서 가장 가까운 적 찾기
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @returns {Object} 가장 가까운 적 객체
     */
    findNearestEnemyToPosition(x, y) {
        let nearestEnemy = null;
        let minDistance = Number.MAX_VALUE;
        
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            
            const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestEnemy = enemy;
            }
        });
        
        return nearestEnemy;
    }

    /**
     * 특정 적을 제외하고 가장 가까운 적들 찾기
     * @param {Object} exceptEnemy - 제외할 적
     * @param {number} count - 찾을 적 수
     * @returns {Array} 가장 가까운 적 배열
     */
    findNearestEnemiesExcept(exceptEnemy, count) {
        const enemies = this.enemies.getChildren()
            .filter(enemy => enemy.active && enemy !== exceptEnemy)
            .map(enemy => {
                return {
                    enemy: enemy,
                    distance: Phaser.Math.Distance.Between(
                        exceptEnemy.x, exceptEnemy.y,
                        enemy.x, enemy.y
                    )
                };
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count)
            .map(item => item.enemy);
        
        return enemies;
    }

    /**
     * 체력이 가장 낮은 아군 찾기
     * @returns {Object} 체력이 가장 낮은 아군
     */
    findLowestHealthAlly() {
        // 소환수가 없으면 플레이어 반환
        if (this.summons.getChildren().length === 0) return this.player;
        
        // 플레이어 체력 비율
        const playerRatio = this.player.stats.hp / this.player.stats.maxHp;
        let lowestAlly = this.player;
        let lowestRatio = playerRatio;
        
        // 소환수 확인
        this.summons.getChildren().forEach(summon => {
            if (!summon.active) return;
            
            const ratio = summon.stats.hp / summon.stats.maxHp;
            if (ratio < lowestRatio) {
                lowestRatio = ratio;
                lowestAlly = summon;
            }
        });
        
        return lowestAlly;
    }

    /**
     * 장착된 무기 타입 가져오기
     * @returns {string} 무기 타입
     */
    getEquippedWeaponType() {
        // 장착된 무기가 없으면 기본값
        if (!this.player.equipment || !this.player.equipment.weapon) {
            return 'sword'; // 기본값
        }
        
        // 장착 무기 ID
        const weaponId = this.player.equipment.weapon;
        
        // 무기 정보 가져오기
        const weapon = this.player.inventory.getItemById(weaponId);
        
        // 무기 타입 반환
        return weapon?.subType || 'sword';
    }

    /**
     * 무기 사거리 가져오기
     * @returns {number} 무기 사거리 (픽셀)
     */
    getWeaponRange() {
        // 무기 타입 가져오기
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

    /**
     * 현재 던전 이름 가져오기
     * @returns {string} 던전 이름
     */
    getDungeonName() {
        return this.dungeonData.name || this.dungeonId;
    }

    // === 게임 상태 관리 메서드 ===

    /**
     * 게임 일시 정지
     */
    pauseGame() {
        // 게임 일시 정지
        this.isPaused = true;
        this.physics.pause();
        
        // 정지 메뉴 표시
        this.hud.showPauseMenu();
    }

    /**
     * 게임 재개
     */
    resumeGame() {
        // 게임 재개
        this.isPaused = false;
        this.physics.resume();
        
        // 정지 메뉴 숨김
        this.hud.hidePauseMenu();
    }

    /**
     * 게임 일시 정지 토글
     */
    togglePause() {
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    /**
     * 인벤토리 열기
     */
    openInventory() {
        // 게임 일시 정지
        this.pauseGame();
        
        // 인벤토리 UI 표시
        this.hud.showInventory(this.player);
    }

    /**
     * 플레이어 사망 처리
     */
    playerDeath() {
        // 이미 게임 오버 상태면 무시
        if (this.gameOver) return;
        
        // 게임 오버 상태로 변경
        this.gameOver = true;
        
        // 사망 애니메이션
        this.player.play(`${this.player.classId}_death`);
        
        // 사망 이펙트
        this.playEffect('player_death', this.player.x, this.player.y);
        
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

    /**
     * 던전 완료 처리
     */
    completeDungeon() {
        // 이미 게임 오버 상태면 무시
        if (this.gameOver) return;
        
        // 게임 완료 상태로 변경
        this.gameOver = true;
        this.dungeonCompleted = true;
        
        // 던전 완료 효과
        this.playEffect('dungeon_complete', this.player.x, this.player.y);
        
        // 완료 사운드
        this.sound.play('dungeon_complete');
        
        // 카메라 효과
        this.cameras.main.flash(1000, 255, 255, 255);
        this.cameras.main.fade(2000, 0, 0, 0);
        
        // 완료 통계 업데이트
        this.dataManager.updateStatistic('dungeonsCompleted', 1);
        
        // 클리어 화면 표시 (지연)
        this.time.delayedCall(2500, () => {
            this.showGameOverScreen(true);
        });
    }

    /**
     * 게임 오버/클리어 화면 표시
     * @param {boolean} isVictory - 승리 여부
     */
    showGameOverScreen(isVictory) {
        // 게임 종료 통계
        const stats = {
            dungeonName: this.getDungeonName(),
            difficulty: this.difficultyLevel,
            timeElapsed: this.elapsedTime,
            roomsExplored: this.exploredRooms,
            totalRooms: this.totalRooms,
            monstersKilled: this.dataManager.getCurrentRun().monstersKilled,
            itemsCollected: this.dataManager.getCurrentRun().itemsCollected,
            goldEarned: this.playerData.gold - this.dataManager.getCurrentRun().startingGold
        };
        
        // 게임 오버 또는 클리어 UI 표시
        this.hud.showGameOverScreen(isVictory, stats);
        
        // 클리어한 경우 던전 난이도 업데이트
        if (isVictory) {
            this.dataManager.updateDungeonProgress(this.dungeonId, this.difficultyLevel);
        }
        
        // 현재 런 데이터 저장
        this.dataManager.finalizeRun(isVictory);
        
        // 게임 데이터 저장
        this.dataManager.saveGameData();
    }

    /**
     * 허브로 귀환
     */
    returnToHub() {
        // 허브 씬으로 이동
        this.scene.start('Hub');
    }

    // === 이벤트 핸들러 ===

    /**
     * 보스 처치 핸들러
     * @param {Object} boss - 처치된 보스
     */
    onBossDefeated(boss) {
        // 보스 처치 축하 메시지
        this.hud.showBossDefeatedMessage(boss.name || '던전 보스');
        
        // 던전 클리어 타이머 (3초 후 클리어 처리)
        this.time.delayedCall(3000, () => {
            this.completeDungeon();
        });
        
        // 보스 처치 통계 업데이트
        this.dataManager.updateStatistic('bossesDefeated', 1);
        
        // 난이도에 따른 다음 던전 해금
        if (this.difficultyLevel % 3 === 0) {
            this.unlockNextDungeon();
        }
    }

    /**
     * 적 처치 핸들러
     * @param {Object} enemy - 처치된 적
     */
    onEnemyDefeated(enemy) {
        // 처치 이펙트
        this.playEffect('enemy_defeat', enemy.x, enemy.y);
        
        // 경험치 획득
        const expGain = enemy.isBoss 
            ? enemy.exp * 3 
            : enemy.isElite 
                ? enemy.exp * 1.5 
                : enemy.exp;
        
        this.progressionSystem.addExperience(this.player, expGain);
        
        // 골드 획득
        const goldGain = enemy.isBoss 
            ? enemy.goldValue * 3 
            : enemy.isElite 
                ? enemy.goldValue * 1.5 
                : enemy.goldValue;
        
        this.playerData.gold += goldGain;
        this.hud.showGoldNotification(goldGain);
        
        // 아이템 드롭
        this.dropLoot(enemy);
        
        // 몬스터 처치 통계 업데이트
        this.dataManager.updateStatistic('monstersKilled', 1);
        this.dataManager.updateRunStat('monstersKilled', 1);
        
        // 도전 방에서 모든 적이 처치되었는지 확인
        if (this.currentRoom.type === 'challenge') {
            this.checkChallengeCompletion();
        }
        
        // 보스 처치 이벤트
        if (enemy.isBoss) {
            this.events.emit('bossDefeated', enemy);
        }
    }

    /**
     * 아이템 획득 핸들러
     * @param {Object} item - 획득한 아이템
     */
    onItemPickup(item) {
        // 아이템 획득 통계 업데이트
        this.dataManager.updateStatistic('itemsCollected', 1);
        this.dataManager.updateRunStat('itemsCollected', 1);
    }

    /**
     * 플레이어 레벨업 핸들러
     * @param {Object} data - 레벨업 데이터
     */
    onPlayerLevelUp(data) {
        // 레벨업 이펙트
        this.playEffect('level_up', this.player.x, this.player.y);
        
        // 레벨업 사운드
        this.sound.play('level_up');
        
        // 레벨업 메시지
        this.hud.showLevelUpMessage(data.newLevel);
        
        // 체력/마나 회복
        this.player.stats.hp = this.player.stats.maxHp;
        this.player.stats.mp = this.player.stats.maxMp;
        
        // HUD 업데이트
        this.hud.updatePlayerStatus(this.player);
    }

    /**
     * 씬 종료 핸들러
     */
    onSceneShutdown() {
        // 이벤트 리스너 제거
        this.events.off('bossDefeated', this.onBossDefeated, this);
        this.events.off('enemyDefeated', this.onEnemyDefeated, this);
        this.events.off('itemPickup', this.onItemPickup, this);
        this.events.off('playerLevelUp', this.onPlayerLevelUp, this);
        
        // 타이머 정리
        Object.values(this.timers).forEach(timer => {
            if (timer) this.time.removeEvent(timer);
        });
        
        // 음악 정지
        this.sound.stopAll();
    }

    /**
     * 아이템 드롭
     * @param {Object} enemy - 처치된 적
     */
    dropLoot(enemy) {
        // 적 위치
        const x = enemy.x;
        const y = enemy.y;
        
        // 룻 생성
        const loot = this.lootSystem.generateEnemyLoot(
            enemy.enemyId,
            this.difficultyLevel,
            enemy.isElite,
            enemy.isBoss
        );
        
        // 드롭 아이템 생성
        if (loot.items && loot.items.length > 0) {
            loot.items.forEach((itemData, index) => {
                // 위치 조정 (여러 아이템은 약간 흩어지게)
                const offsetX = index * 10 - (loot.items.length - 1) * 5;
                const offsetY = index * 10 - (loot.items.length - 1) * 5;
                
                // 아이템 스프라이트 생성
                const item = new Item(
                    this,
                    x + offsetX,
                    y + offsetY,
                    itemData,
                    this.dataManager
                );
                
                // 물리 설정
                this.physics.world.enable(item);
                item.body.setCollideWorldBounds(true);
                
                // 아이템 그룹에 추가
                this.items.add(item);
                
                // 아이템 드롭 효과
                this.playEffect('item_drop', x + offsetX, y + offsetY, { rarity: itemData.rarity });
            });
        }
        
        // 골드 드롭
        if (loot.gold > 0) {
            // 골드 스프라이트 생성
            const goldItem = new Item(
                this,
                x,
                y - 10,
                { type: 'gold', value: loot.gold },
                this.dataManager
            );
            
            // 물리 설정
            this.physics.world.enable(goldItem);
            goldItem.body.setCollideWorldBounds(true);
            
            // 아이템 그룹에 추가
            this.items.add(goldItem);
            
            // 골드 드롭 효과
            this.playEffect('gold_drop', x, y - 10);
        }
    }

    /**
     * 도전 방 완료 확인
     */
    checkChallengeCompletion() {
        // 방 안의 적 확인
        const enemies = this.enemies.getChildren().filter(enemy => 
            Phaser.Math.Distance.Between(
                enemy.x / this.tileSize, 
                enemy.y / this.tileSize,
                this.currentRoom.centerX,
                this.currentRoom.centerY
            ) < Math.max(this.currentRoom.width, this.currentRoom.height) / 2
        );
        
        // 모든 적이 처치됐는지 확인
        if (enemies.length === 0) {
            // 도전 방 웨이브 확인
            if (this.currentRoom.waves) {
                // 현재 웨이브가 마지막 웨이브인지 확인
                if (this.currentRoom.waves.current >= this.currentRoom.waves.total - 1) {
                    // 모든 웨이브 완료
                    this.currentRoom.waves.completed = true;
                    
                    // 도전 완료 알림
                    this.hud.showChallengeCompletedNotification();
                    
                    // 보상 지급
                    this.giveChallengeReward();
                    
                    // 음악 원복
                    this.sound.stopByKey('battle_music');
                    this.sound.play('dungeon_music', { volume: 0.5 });
                } else {
                    // 다음 웨이브 시작 준비
                    this.startNextChallengeWave();
                }
            }
        }
    }

    /**
     * 다음 도전 웨이브 시작
     */
    startNextChallengeWave() {
        // 다음 웨이브로 이동
        this.currentRoom.waves.current++;
        
        // 웨이브 시작 전 짧은 대기시간
        this.timers.challengeWave = this.time.delayedCall(2000, () => {
            // 웨이브 시작 알림
            this.hud.showWaveNotification(
                this.currentRoom.waves.current + 1,
                this.currentRoom.waves.total
            );
            
            // 웨이브 효과
            this.playEffect('wave_start', this.currentRoom.centerX * this.tileSize, this.currentRoom.centerY * this.tileSize);
            
            // 적 스폰
            this.spawnChallengeWaveEnemies();
            
            // 배틀 음악
            this.sound.play('battle_music', { volume: 0.7 });
        });
    }

    /**
     * 도전 웨이브 적 생성
     */
    spawnChallengeWaveEnemies() {
        // 현재 웨이브
        const currentWave = this.currentRoom.waves.current;
        
        // 웨이브별 적 수 (웨이브가 증가할수록 적 증가)
        const enemyCount = 3 + currentWave;
        
        // 엘리트 확률 (웨이브가 증가할수록 확률 증가)
        const eliteChance = 0.1 + (currentWave * 0.1);
        
        // 방 중앙 좌표
        const centerX = this.currentRoom.centerX;
        const centerY = this.currentRoom.centerY;
        
        // 몬스터 생성
        for (let i = 0; i < enemyCount; i++) {
            // 랜덤 위치 (방 중앙에서 약간 떨어진 위치)
            const angle = Math.random() * Math.PI * 2;
            const distance = 2 + Math.random() * 2; // 2~4 타일 거리
            
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            // 엘리트 몬스터 여부
            const isElite = Math.random() < eliteChance;
            
            // 던전에 맞는 몬스터 ID 선택
            const monsterPool = isElite 
                ? this.dungeonData.monsters.elite 
                : this.dungeonData.monsters.normal;
                
            const monsterId = Phaser.Utils.Array.GetRandom(monsterPool);
            
            // 몬스터 데이터 가져오기
            const monsterData = this.dataManager.getMonsterById(monsterId);
            
            if (!monsterData) continue;
            
            // 몬스터 생성
            const monster = new Enemy(
                this,
                x * this.tileSize,
                y * this.tileSize,
                monsterData,
                this.difficultyLevel + currentWave, // 웨이브에 따라 난이도 증가
                isElite
            );
            
            // 몬스터 등장 이펙트
            this.playEffect('enemy_spawn', monster.x, monster.y);
            
            // 적 그룹에 추가
            this.enemies.add(monster);
        }
    }

    /**
     * 도전 방 보상 지급
     */
    giveChallengeReward() {
        // 보상 생성
        const rewards = this.lootSystem.generateChallengeReward(this.difficultyLevel);
        
        // 골드 보상
        if (rewards.gold > 0) {
            this.playerData.gold += rewards.gold;
            this.hud.showGoldNotification(rewards.gold);
        }
        
        // 경험치 보상
        if (rewards.exp > 0) {
            this.progressionSystem.addExperience(this.player, rewards.exp);
        }
        
        // 아이템 보상
        if (rewards.items && rewards.items.length > 0) {
            rewards.items.forEach((itemData, index) => {
                // 아이템 위치 계산
                const offsetX = index * 20 - (rewards.items.length - 1) * 10;
                
                // 아이템 생성
                const item = new Item(
                    this,
                    this.currentRoom.centerX * this.tileSize + offsetX,
                    this.currentRoom.centerY * this.tileSize,
                    itemData,
                    this.dataManager
                );
                
                // 물리 설정
                this.physics.world.enable(item);
                
                // 아이템 그룹에 추가
                this.items.add(item);
                
                // 아이템 드롭 효과
                this.playEffect('reward_item', item.x, item.y, { rarity: itemData.rarity });
            });
        }
        
        // 보상 이펙트
        this.playEffect('challenge_complete', 
            this.currentRoom.centerX * this.tileSize, 
            this.currentRoom.centerY * this.tileSize
        );
    }

    /**
     * 다음 던전 해금
     */
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
            
            // 다음 던전 해금
            const unlocked = this.dataManager.unlockDungeon(nextDungeonId);
            
            if (unlocked) {
                // 다음 던전 데이터
                const nextDungeon = this.dataManager.getDungeonById(nextDungeonId);
                
                if (nextDungeon) {
                    // 해금 알림
                    this.hud.showDungeonUnlockNotification(nextDungeon.name);
                }
            }
        }
    }

    /**
     * 충돌 핸들러 - 플레이어와 오브젝트
     * @param {Object} player - 플레이어 객체
     * @param {Object} object - 충돌한 오브젝트
     */
    handleObjectCollision(player, object) {
        // 통과 가능한 오브젝트인지 확인
        const passableTiles = [20, 21, 22, 30, 31]; // 문, 입구, 출구 등
        
        if (object.index !== undefined && passableTiles.includes(object.index)) {
            return false; // 충돌 무시
        }
        
        return true; // 충돌 처리
    }

    /**
     * 충돌 핸들러 - 플레이어와 장식
     * @param {Object} player - 플레이어 객체
     * @param {Object} decoration - 충돌한 장식
     */
    handleDecorationCollision(player, decoration) {
        // 충돌 확인 안 함이 true인 장식은 충돌 무시
        return !decoration.body.checkCollision.none;
    }

    /**
     * 충돌 핸들러 - 플레이어와 적
     * @param {Object} player - 플레이어 객체
     * @param {Object} enemy - 충돌한 적
     */
    handlePlayerEnemyCollision(player, enemy) {
        // 적과 충돌 시 약간의 넉백
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
        const knockbackForce = 100;
        
        player.body.velocity.x += Math.cos(angle) * knockbackForce;
        player.body.velocity.y += Math.sin(angle) * knockbackForce;
    }

    /**
     * 충돌 핸들러 - 소환수와 적
     * @param {Object} summon - 소환수 객체
     * @param {Object} enemy - 충돌한 적
     */
    handleSummonEnemyCollision(summon, enemy) {
        // 소환수와 적이 충돌해도 통과 (충돌 처리 안 함)
        return false;
    }
}

export default DungeonScene;