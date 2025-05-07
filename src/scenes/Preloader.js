/**
 * Preloader.js
 * 
 * 게임에 필요한 모든 에셋을 로드하고 진행 상황을 표시하는 씬
 * 로딩 화면을 표시하고 완료 후 메인 메뉴로 전환합니다.
 */
class Preloader extends Phaser.Scene {
    constructor() {
        super({
            key: 'Preloader'
        });

        this.loadingText = null;
        this.progressBar = null;
        this.progressBarBg = null;
        this.progressBarFill = null;
        this.loadingLogo = null;

        this.assetCount = 0;
        this.totalAssets = 0;
        this.isFirstVisit = false;
    }

    /**
     * 씬 초기화
     * @param {Object} data - 전달 데이터
     */
    init(data) {
        this.isFirstVisit = data.isFirstVisit || false;
    }

    /**
     * 로딩 화면 생성 및 에셋 로드
     */
    preload() {
        this.createLoadingScreen();
        this.setupLoadingEvents();
        this.loadGameAssets();
    }

    /**
     * 로딩 화면 생성
     */
    createLoadingScreen() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 배경색 설정
        this.cameras.main.setBackgroundColor('#0a0a0a');

        // 로고 추가
        this.loadingLogo = this.add.image(width / 2, height / 2 - 100, 'logo');
        this.loadingLogo.setScale(0.8);

        // 텍스트 로딩 메시지
        this.loadingText = this.add.text(width / 2, height / 2 + 80, '게임 로딩 중...', {
            fontFamily: 'Noto Sans KR, sans-serif',
            fontSize: '24px',
            color: '#ffffff'
        });
        this.loadingText.setOrigin(0.5);

        // 진행 바 배경
        this.progressBarBg = this.add.image(width / 2, height / 2 + 40, 'loading-bar-bg');
        this.progressBarBg.setScale(1, 0.8);

        // 진행 바 채우기
        this.progressBarFill = this.add.image(width / 2 - 295, height / 2 + 40, 'loading-bar-fill');
        this.progressBarFill.setOrigin(0, 0.5);
        this.progressBarFill.setScale(0, 0.8);

        // 버전 정보
        const version = this.game.config.gameConfig.get('system', 'version', '0.1.0');
        const versionText = this.add.text(width - 10, height - 10, `버전 ${version}`, {
            fontSize: '14px',
            fontFamily: 'Roboto, sans-serif',
            color: '#888888'
        });
        versionText.setOrigin(1, 1);

        // 애니메이션 효과
        this.tweens.add({
            targets: this.loadingLogo,
            y: this.loadingLogo.y - 10,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    /**
     * 로딩 이벤트 설정
     */
    setupLoadingEvents() {
        // 로딩 진행 상황 이벤트
        this.load.on('progress', this.onLoadProgress, this);

        // 파일 로드 완료 이벤트
        this.load.on('fileprogress', this.onFileComplete, this);

        // 모든 로딩 완료 이벤트
        this.load.on('complete', this.onLoadComplete, this);
    }

    /**
     * 게임 에셋 로드
     */
    loadGameAssets() {
        this.loadConfig();
        this.loadImages();
        this.loadSpritesheets();
        this.loadAudio();
        this.loadJSON();
        this.loadParticles();
        this.loadTilemaps();
        this.loadFonts();
    }

    /**
     * 설정 파일 로드
     */
    loadConfig() {
        // 설정 파일은 JSON 형식으로 로드
        this.load.json('gameConfig', 'assets/data/config.json');
    }

    /**
     * 이미지 에셋 로드
     */
    loadImages() {
        // UI 이미지
        this.load.image('main-menu-bg', 'assets/images/ui/main-menu-bg.png');
        this.load.image('button', 'assets/images/ui/button.png');
        this.load.image('button-hover', 'assets/images/ui/button-hover.png');
        this.load.image('panel', 'assets/images/ui/panel.png');
        this.load.image('inventory-slot', 'assets/images/ui/inventory-slot.png');
        this.load.image('skill-slot', 'assets/images/ui/skill-slot.png');
        this.load.image('health-bar', 'assets/images/ui/health-bar.png');
        this.load.image('mana-bar', 'assets/images/ui/mana-bar.png');
        this.load.image('exp-bar', 'assets/images/ui/exp-bar.png');
        this.load.image('minimap-bg', 'assets/images/ui/minimap-bg.png');
        this.load.image('dialog-box', 'assets/images/ui/dialog-box.png');

        // 아이템 이미지
        this.load.image('potion-health', 'assets/images/items/potion-health.png');
        this.load.image('potion-mana', 'assets/images/items/potion-mana.png');
        this.load.image('sword-basic', 'assets/images/items/sword-basic.png');
        this.load.image('bow-basic', 'assets/images/items/bow-basic.png');
        this.load.image('staff-basic', 'assets/images/items/staff-basic.png');
        this.load.image('dagger-basic', 'assets/images/items/dagger-basic.png');
        this.load.image('spear-basic', 'assets/images/items/spear-basic.png');

        // 배경 및 환경 이미지
        this.load.image('dungeon-floor', 'assets/images/environments/dungeon-floor.png');
        this.load.image('dungeon-wall', 'assets/images/environments/dungeon-wall.png');
        this.load.image('door', 'assets/images/environments/door.png');
        this.load.image('chest', 'assets/images/environments/chest.png');
        this.load.image('shrine', 'assets/images/environments/shrine.png');
        this.load.image('trap', 'assets/images/environments/trap.png');

        // 이펙트 이미지
        this.load.image('slash', 'assets/images/effects/slash.png');
        this.load.image('fireball', 'assets/images/effects/fireball.png');
        this.load.image('ice-shard', 'assets/images/effects/ice-shard.png');
        this.load.image('lightning', 'assets/images/effects/lightning.png');
        this.load.image('heal', 'assets/images/effects/heal.png');

        // 파티클 이미지
        this.load.image('particle-fire', 'assets/images/particles/fire.png');
        this.load.image('particle-smoke', 'assets/images/particles/smoke.png');
        this.load.image('particle-spark', 'assets/images/particles/spark.png');
        this.load.image('particle-dust', 'assets/images/particles/dust.png');
    }

    /**
     * 스프라이트시트 로드
     */
    loadSpritesheets() {
        // 캐릭터 스프라이트시트
        this.load.spritesheet('warrior', 'assets/images/characters/warrior.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('archer', 'assets/images/characters/archer.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('mage', 'assets/images/characters/mage.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('rogue', 'assets/images/characters/rogue.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('cleric', 'assets/images/characters/cleric.png', {
            frameWidth: 64, frameHeight: 64
        });

        // 몬스터 스프라이트시트
        this.load.spritesheet('goblin', 'assets/images/enemies/goblin.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('skeleton', 'assets/images/enemies/skeleton.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('slime', 'assets/images/enemies/slime.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('bat', 'assets/images/enemies/bat.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('boss-golem', 'assets/images/enemies/boss-golem.png', {
            frameWidth: 128, frameHeight: 128
        });

        // NPC 스프라이트시트
        this.load.spritesheet('merchant', 'assets/images/npcs/merchant.png', {
            frameWidth: 64, frameHeight: 64
        });
        this.load.spritesheet('blacksmith', 'assets/images/npcs/blacksmith.png', {
            frameWidth: 64, frameHeight: 64
        });

        // 아이템 스프라이트시트
        this.load.spritesheet('items', 'assets/images/items/items.png', {
            frameWidth: 32, frameHeight: 32
        });

        // UI 아이콘 스프라이트시트
        this.load.spritesheet('ui_icons', 'assets/images/ui/ui_icons.png', {
            frameWidth: 32, frameHeight: 32
        });

        // 이펙트 스프라이트시트
        this.load.spritesheet('explosion', 'assets/images/effects/explosion.png', {
            frameWidth: 64, frameHeight: 64
        });

        // 초상화 스프라이트시트
        this.load.spritesheet('portraits', 'assets/images/ui/portraits.png', {
            frameWidth: 80, frameHeight: 80
        });
    }

    /**
     * 오디오 에셋 로드
     */
    loadAudio() {
        // 배경 음악
        this.load.audio('main-theme', 'assets/audio/music/main-theme.mp3');
        this.load.audio('dungeon-theme', 'assets/audio/music/dungeon-theme.mp3');
        this.load.audio('battle-theme', 'assets/audio/music/battle-theme.mp3');
        this.load.audio('boss-theme', 'assets/audio/music/boss-theme.mp3');

        // 효과음 - UI
        this.load.audio('button-click', 'assets/audio/sfx/button-click.mp3');
        this.load.audio('level-up', 'assets/audio/sfx/level-up.mp3');
        this.load.audio('item-pickup', 'assets/audio/sfx/item-pickup.mp3');
        this.load.audio('menu-open', 'assets/audio/sfx/menu-open.mp3');

        // 효과음 - 전투
        this.load.audio('sword-swing', 'assets/audio/sfx/sword-swing.mp3');
        this.load.audio('bow-shoot', 'assets/audio/sfx/bow-shoot.mp3');
        this.load.audio('magic-cast', 'assets/audio/sfx/magic-cast.mp3');
        this.load.audio('hit-impact', 'assets/audio/sfx/hit-impact.mp3');
        this.load.audio('enemy-hit', 'assets/audio/sfx/enemy-hit.mp3');
        this.load.audio('enemy-death', 'assets/audio/sfx/enemy-death.mp3');
        this.load.audio('player-hit', 'assets/audio/sfx/player-hit.mp3');
        this.load.audio('player-death', 'assets/audio/sfx/player-death.mp3');

        // 효과음 - 환경
        this.load.audio('door-open', 'assets/audio/sfx/door-open.mp3');
        this.load.audio('chest-open', 'assets/audio/sfx/chest-open.mp3');
        this.load.audio('potion-use', 'assets/audio/sfx/potion-use.mp3');
        this.load.audio('trap-trigger', 'assets/audio/sfx/trap-trigger.mp3');
        this.load.audio('shrine-activate', 'assets/audio/sfx/shrine-activate.mp3');

        // 효과음 - 대화
        this.load.audio('voice_male', 'assets/audio/sfx/voice_male.mp3');
        this.load.audio('voice_female', 'assets/audio/sfx/voice_female.mp3');
        this.load.audio('voice_monster', 'assets/audio/sfx/voice_monster.mp3');
    }

    /**
     * JSON 데이터 로드
     */
    loadJSON() {
        // 게임 데이터
        this.load.json('classes', 'assets/data/classes.json');
        this.load.json('items', 'assets/data/items.json');
        this.load.json('monsters', 'assets/data/monsters.json');
        this.load.json('dungeons', 'assets/data/dungeons.json');
        this.load.json('progression', 'assets/data/progression.json');
        this.load.json('dialogs', 'assets/data/dialogs.json');
        this.load.json('achievements', 'assets/data/achievements.json');
        this.load.json('tutorials', 'assets/data/tutorials.json');
    }

    /**
     * 파티클 에셋 로드
     */
    loadParticles() {
        // 파티클 JSON 설정
        this.load.json('particles-fire', 'assets/data/particles/fire.json');
        this.load.json('particles-smoke', 'assets/data/particles/smoke.json');
        this.load.json('particles-magic', 'assets/data/particles/magic.json');
        this.load.json('particles-heal', 'assets/data/particles/heal.json');
        this.load.json('particles-levelup', 'assets/data/particles/levelup.json');
    }

    /**
     * 타일맵 로드
     */
    loadTilemaps() {
        // 타일셋 이미지
        this.load.image('tileset-dungeon', 'assets/images/environments/tileset-dungeon.png');
        this.load.image('tileset-forest', 'assets/images/environments/tileset-forest.png');
        this.load.image('tileset-cave', 'assets/images/environments/tileset-cave.png');

        // 타일맵 JSON
        this.load.tilemapTiledJSON('map-dungeon-template', 'assets/data/maps/dungeon-template.json');
        this.load.tilemapTiledJSON('map-forest-template', 'assets/data/maps/forest-template.json');
        this.load.tilemapTiledJSON('map-cave-template', 'assets/data/maps/cave-template.json');
    }

    /**
     * 폰트 로드
     */
    loadFonts() {
        // 사용자 정의 폰트 (비트맵 폰트)
        this.load.bitmapFont('pixel-font', 'assets/fonts/pixel.png', 'assets/fonts/pixel.xml');
    }

    /**
     * 로딩 진행 상황 처리
     * @param {number} value - 진행률 (0-1)
     */
    onLoadProgress(value) {
        // 로딩 바 업데이트
        const width = 590 * value; // 로딩 바 전체 너비
        this.progressBarFill.displayWidth = width;

        // 로딩 텍스트 업데이트
        const percent = Math.floor(value * 100);
        this.loadingText.setText(`게임 로딩 중... ${percent}%`);
    }

    /**
     * 각 파일 로드 완료 시 처리
     * @param {object} file - 로드된 파일 정보
     * @param {number} value - 파일별 진행률 (0-1)
     */
    onFileComplete(file, value) {
        this.assetCount++;

        // 로드 중인 에셋 이름 표시 (옵션)
        const key = file.key;
        const fileType = file.type;

        // 로그에 출력 (디버그 모드)
        if (this.game.registry.get('debugMode')) {
            console.log(`로드 완료: ${key} (${fileType})`);
        }
    }

    /**
     * 모든 로딩 완료 시 처리
     */
    onLoadComplete() {
        // 로딩 이벤트 제거
        this.load.off('progress', this.onLoadProgress, this);
        this.load.off('fileprogress', this.onFileComplete, this);
        this.load.off('complete', this.onLoadComplete, this);

        // 로딩 완료 표시
        this.loadingText.setText('로딩 완료!');

        // 애니메이션 생성
        this.createAnimations();

        // 설정 초기화
        this.initializeSettings();

        // 전환 효과
        this.time.delayedCall(500, () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                // 첫 방문 여부에 따라 다른 씬으로 전환
                if (this.isFirstVisit) {
                    // 첫 실행 시 인트로나 튜토리얼로 전환
                    this.scene.start('MainMenu', { showIntro: true });
                } else {
                    // 일반 실행 시 메인 메뉴로 전환
                    this.scene.start('MainMenu', { showIntro: false });
                }
            });
        });
    }

    /**
     * 게임에 필요한 애니메이션 생성
     */
    createAnimations() {
        // 캐릭터 애니메이션 (예시)
        this.createCharacterAnimations('warrior');
        this.createCharacterAnimations('archer');
        this.createCharacterAnimations('mage');
        this.createCharacterAnimations('rogue');
        this.createCharacterAnimations('cleric');

        // 몬스터 애니메이션 (예시)
        this.createMonsterAnimations('goblin');
        this.createMonsterAnimations('skeleton');
        this.createMonsterAnimations('slime');
        this.createMonsterAnimations('bat');
        this.createBossAnimations('boss-golem');

        // NPC 애니메이션
        this.createNPCAnimations('merchant');
        this.createNPCAnimations('blacksmith');

        // 효과 애니메이션
        this.anims.create({
            key: 'explosion-anim',
            frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 15 }),
            frameRate: 20,
            repeat: 0
        });

        // 아이템 애니메이션
        this.anims.create({
            key: 'chest-open',
            frames: this.anims.generateFrameNumbers('chest', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
        });
    }

    /**
     * 캐릭터 애니메이션 생성
     * @param {string} character - 캐릭터 키
     */
    createCharacterAnimations(character) {
        // 이동 애니메이션
        this.anims.create({
            key: `${character}-idle-down`,
            frames: this.anims.generateFrameNumbers(character, { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: `${character}-idle-up`,
            frames: this.anims.generateFrameNumbers(character, { start: 4, end: 7 }),
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: `${character}-idle-left`,
            frames: this.anims.generateFrameNumbers(character, { start: 8, end: 11 }),
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: `${character}-idle-right`,
            frames: this.anims.generateFrameNumbers(character, { start: 12, end: 15 }),
            frameRate: 8,
            repeat: -1
        });

        // 걷기 애니메이션
        this.anims.create({
            key: `${character}-walk-down`,
            frames: this.anims.generateFrameNumbers(character, { start: 16, end: 19 }),
            frameRate: 12,
            repeat: -1
        });

        this.anims.create({
            key: `${character}-walk-up`,
            frames: this.anims.generateFrameNumbers(character, { start: 20, end: 23 }),
            frameRate: 12,
            repeat: -1
        });

        this.anims.create({
            key: `${character}-walk-left`,
            frames: this.anims.generateFrameNumbers(character, { start: 24, end: 27 }),
            frameRate: 12,
            repeat: -1
        });

        this.anims.create({
            key: `${character}-walk-right`,
            frames: this.anims.generateFrameNumbers(character, { start: 28, end: 31 }),
            frameRate: 12,
            repeat: -1
        });

        // 공격 애니메이션
        this.anims.create({
            key: `${character}-attack-down`,
            frames: this.anims.generateFrameNumbers(character, { start: 32, end: 35 }),
            frameRate: 15,
            repeat: 0
        });

        this.anims.create({
            key: `${character}-attack-up`,
            frames: this.anims.generateFrameNumbers(character, { start: 36, end: 39 }),
            frameRate: 15,
            repeat: 0
        });

        this.anims.create({
            key: `${character}-attack-left`,
            frames: this.anims.generateFrameNumbers(character, { start: 40, end: 43 }),
            frameRate: 15,
            repeat: 0
        });

        this.anims.create({
            key: `${character}-attack-right`,
            frames: this.anims.generateFrameNumbers(character, { start: 44, end: 47 }),
            frameRate: 15,
            repeat: 0
        });

        // 피격 애니메이션
        this.anims.create({
            key: `${character}-hurt`,
            frames: this.anims.generateFrameNumbers(character, { start: 48, end: 51 }),
            frameRate: 10,
            repeat: 0
        });

        // 사망 애니메이션
        this.anims.create({
            key: `${character}-death`,
            frames: this.anims.generateFrameNumbers(character, { start: 52, end: 57 }),
            frameRate: 8,
            repeat: 0
        });
    }

    /**
     * 몬스터 애니메이션 생성
     * @param {string} monster - 몬스터 키
     */
    createMonsterAnimations(monster) {
        // 기본 애니메이션 (아이들)
        this.anims.create({
            key: `${monster}-idle`,
            frames: this.anims.generateFrameNumbers(monster, { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // 이동 애니메이션
        this.anims.create({
            key: `${monster}-move`,
            frames: this.anims.generateFrameNumbers(monster, { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1
        });

        // 공격 애니메이션
        this.anims.create({
            key: `${monster}-attack`,
            frames: this.anims.generateFrameNumbers(monster, { start: 8, end: 11 }),
            frameRate: 12,
            repeat: 0
        });

        // 피격 애니메이션
        this.anims.create({
            key: `${monster}-hurt`,
            frames: this.anims.generateFrameNumbers(monster, { start: 12, end: 13 }),
            frameRate: 8,
            repeat: 0
        });

        // 사망 애니메이션
        this.anims.create({
            key: `${monster}-death`,
            frames: this.anims.generateFrameNumbers(monster, { start: 14, end: 17 }),
            frameRate: 8,
            repeat: 0
        });
    }

    /**
     * 보스 애니메이션 생성
     * @param {string} boss - 보스 키
     */
    createBossAnimations(boss) {
        // 기본 애니메이션 (아이들)
        this.anims.create({
            key: `${boss}-idle`,
            frames: this.anims.generateFrameNumbers(boss, { start: 0, end: 5 }),
            frameRate: 6,
            repeat: -1
        });

        // 이동 애니메이션
        this.anims.create({
            key: `${boss}-move`,
            frames: this.anims.generateFrameNumbers(boss, { start: 6, end: 11 }),
            frameRate: 8,
            repeat: -1
        });

        // 공격 애니메이션
        this.anims.create({
            key: `${boss}-attack1`,
            frames: this.anims.generateFrameNumbers(boss, { start: 12, end: 17 }),
            frameRate: 10,
            repeat: 0
        });

        this.anims.create({
            key: `${boss}-attack2`,
            frames: this.anims.generateFrameNumbers(boss, { start: 18, end: 23 }),
            frameRate: 10,
            repeat: 0
        });

        // 특수 공격 애니메이션
        this.anims.create({
            key: `${boss}-special`,
            frames: this.anims.generateFrameNumbers(boss, { start: 24, end: 31 }),
            frameRate: 12,
            repeat: 0
        });

        // 피격 애니메이션
        this.anims.create({
            key: `${boss}-hurt`,
            frames: this.anims.generateFrameNumbers(boss, { start: 32, end: 35 }),
            frameRate: 8,
            repeat: 0
        });

        // 사망 애니메이션
        this.anims.create({
            key: `${boss}-death`,
            frames: this.anims.generateFrameNumbers(boss, { start: 36, end: 43 }),
            frameRate: 6,
            repeat: 0
        });
    }

    /**
     * NPC 애니메이션 생성
     * @param {string} npc - NPC 키
     */
    createNPCAnimations(npc) {
        // 기본 애니메이션 (아이들)
        this.anims.create({
            key: `${npc}-idle`,
            frames: this.anims.generateFrameNumbers(npc, { start: 0, end: 3 }),
            frameRate: 6,
            repeat: -1
        });

        // 대화 애니메이션
        this.anims.create({
            key: `${npc}-talk`,
            frames: this.anims.generateFrameNumbers(npc, { start: 4, end: 7 }),
            frameRate: 8,
            repeat: -1
        });

        // 작업 애니메이션 (상인/대장장이 전용)
        this.anims.create({
            key: `${npc}-work`,
            frames: this.anims.generateFrameNumbers(npc, { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
    }

    /**
     * 설정 초기화
     */
    initializeSettings() {
        // JSON 설정 파일 로드
        const gameConfig = this.cache.json.get('gameConfig');

        // 설정이 로드되었으면 적용
        if (gameConfig) {
            this.game.config.gameConfig.applyUserSettings(gameConfig);
        }

        // 오디오 시스템 초기화
        const audioSettings = this.game.config.gameConfig.get('audio', 'settings');
        if (audioSettings) {
            this.sound.setMute(audioSettings.mute);
            this.sound.setVolume(audioSettings.volume);
            this.game.registry.set('musicVolume', audioSettings.musicVolume);
            this.game.registry.set('sfxVolume', audioSettings.sfxVolume);
        }

        // 난이도 설정
        const difficulty = this.game.config.gameConfig.get('gameplay', 'difficulty', 2);
        this.game.registry.set('difficulty', difficulty);

        // 튜토리얼 진행 상태
        const tutorialCompleted = this.game.config.gameConfig.get('player', 'tutorialCompleted', false);
        this.game.registry.set('tutorialCompleted', tutorialCompleted);

        // 게임 진행 상태 (얼리 액세스 기간에는 강제로 시작)
        if (this.isFirstVisit) {
            this.game.registry.set('gameStarted', false);
        } else {
            this.game.registry.set('gameStarted', true);
        }

        // 디버그 활성화 여부
        const debugMode = this.game.config.gameConfig.get('system', 'debugMode', false);
        if (debugMode) {
            console.log('디버그 모드가 활성화되었습니다.');
            console.log('로드된 에셋:', this.assetCount);
        }

        // 성능 옵션 설정
        const performanceSettings = this.game.config.gameConfig.get('system', 'performance', {
            particleQuality: 'medium',
            shadows: true,
            postProcessing: true,
            animationFrameRate: 'normal'
        });

        // 성능 설정을 게임 레지스트리에 저장
        this.game.registry.set('performanceSettings', performanceSettings);

        // 파티클 수준 조정
        let particleScale = 1.0;
        switch (performanceSettings.particleQuality) {
            case 'low':
                particleScale = 0.5;
                break;
            case 'medium':
                particleScale = 0.75;
                break;
            case 'high':
                particleScale = 1.0;
                break;
            case 'ultra':
                particleScale = 1.5;
                break;
        }
        this.game.registry.set('particleScale', particleScale);

        // 그래픽 설정 적용
        const graphicsSettings = this.game.config.gameConfig.get('system', 'graphics', {
            resolution: 1,
            fullscreen: false,
            vsync: true
        });

        // 전체 화면 설정
        if (graphicsSettings.fullscreen && !this.scale.isFullscreen) {
            this.scale.startFullscreen();
        }

        // 로드된 클래스 및 계정 데이터
        const unlockedClasses = this.game.config.dataManager.getUnlockedClasses();
        const stats = this.game.config.dataManager.getStatistics();

        // 첫 실행 확인 후 초기 데이터 설정
        if (this.isFirstVisit) {
            // 기본 클래스 설정
            // 데이터 매니저를 통해 처리되므로 여기선 생략
        }
    }

    /**
     * 정리 메서드
     */
    shutdown() {
        // 타이머 정리
        if (this.completeTimer) {
            this.completeTimer.remove();
        }

        // 이벤트 리스너 정리
        this.load.off('progress', this.onLoadProgress, this);
        this.load.off('fileprogress', this.onFileComplete, this);
        this.load.off('complete', this.onLoadComplete, this);
    }
}

export default Preloader;