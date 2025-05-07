/**
 * Boot.js
 * 
 * 게임 부팅 및 초기 에셋 로드를 담당하는 씬
 * Phaser 게임의 첫 번째 씬으로, 기본 설정과 로딩 에셋을 로드합니다.
 */
class Boot extends Phaser.Scene {
    constructor() {
        super({
            key: 'Boot'
        });
    }

    /**
     * 사전 에셋 로드
     * 로딩 화면에 필요한 최소한의 에셋만 로드합니다.
     */
    preload() {
        // 로딩 화면에 필요한 에셋
        this.load.image('logo', 'assets/images/ui/logo.png');
        this.load.image('loading-bar-bg', 'assets/images/ui/loading-bar-bg.png');
        this.load.image('loading-bar-fill', 'assets/images/ui/loading-bar-fill.png');

        // 폰트 로드 (웹폰트 사용 시)
        this.load.script('webfont', 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js');

        // 시스템 사운드 로드
        this.load.audio('click', 'assets/audio/sfx/click.mp3');
        this.load.audio('error', 'assets/audio/sfx/error.mp3');
    }

    /**
     * 부트 씬 생성
     * 게임 기본 설정, 캔버스 설정, 전역 변수 초기화
     */
    create() {
        console.log('Boot scene started');

        // 게임 전역 설정
        this.setupGame();

        // 캔버스 설정
        this.setupCanvas();

        // 웹폰트 로드
        this.loadWebFonts();

        // 데이터 관리자 초기화
        this.initDataManager();

        // 입력 설정
        this.setupInput();

        // 오디오 설정
        this.setupAudio();

        // 게임 이벤트 리스너 설정
        this.setupEventListeners();

        // 다음 씬으로 전환 (로딩 씬)
        this.startNextScene();
    }

    /**
     * 게임 기본 설정
     */
    setupGame() {
        // FPS 설정
        this.game.loop.targetFps = 60;

        // 물리 엔진 설정
        this.physics.world.setBounds(0, 0, this.game.config.width, this.game.config.height);
        this.physics.world.gravity.y = 0; // 중력 없음 (탑다운 게임)

        // 전역 변수 설정
        if (!this.game.registry.has('gameStarted')) {
            this.game.registry.set('gameStarted', false);
        }

        // 설정 객체 생성 및 등록 (Config.js 사용)
        this.game.config.gameConfig = new Config();

        // 디버그 모드 설정
        const debugMode = this.game.config.gameConfig.get('system', 'debugMode', false);
        this.game.registry.set('debugMode', debugMode);

        // 모바일 감지
        const isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS;
        this.game.registry.set('isMobile', isMobile);

        // 게임 시간 초기화
        this.game.registry.set('gameTime', 0);

        // 랜덤 시드 설정 (반복 가능한 난수 생성을 위해)
        const seed = Date.now().toString();
        this.game.registry.set('randomSeed', seed);

        // 전체화면 토글 키 설정
        this.input.keyboard.on('keydown-F', () => {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        });
    }

    /**
     * 캔버스 설정
     */
    setupCanvas() {
        // 캔버스 설정
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;

        // 반응형 설정
        this.scale.on('resize', this.onResize, this);

        // 기본 화면 조정
        this.onResize(this.scale.width, this.scale.height);

        // 디버그 여부에 따라 FPS 미터 표시
        if (this.game.registry.get('debugMode')) {
            this.game.config.gameInfo = this.add.text(5, 5, '', {
                fontSize: '12px',
                fill: '#ffffff',
                backgroundColor: '#000000'
            });
            this.game.config.gameInfo.setScrollFactor(0).setDepth(9999);
            this.game.config.gameInfo.visible = true;

            // FPS 업데이트
            this.time.addEvent({
                delay: 500,
                callback: this.updateDebugInfo,
                callbackScope: this,
                loop: true
            });
        }
    }

    /**
     * 웹폰트 로드
     */
    loadWebFonts() {
        // WebFont가 로드되었는지 확인
        if (typeof WebFont !== 'undefined') {
            WebFont.load({
                google: {
                    families: ['Noto Sans KR:400,700', 'Roboto:400,700']
                },
                active: () => {
                    console.log('웹폰트 로드 완료');
                }
            });
        } else {
            // 웹폰트 스크립트가 아직 로드되지 않았으면 대기
            this.time.delayedCall(100, this.loadWebFonts, [], this);
        }
    }

    /**
     * 데이터 관리자 초기화
     */
    initDataManager() {
        // DataManager.js에서 생성한 클래스 인스턴스화
        this.game.config.dataManager = new DataManager(this.game);

        // 게임 데이터 로드
        this.game.config.dataManager.loadGameData();

        // 로컬 스토리지 지원 확인
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            this.game.registry.set('localStorageSupported', true);
        } catch (e) {
            console.warn('로컬 스토리지가 지원되지 않습니다. 게임 저장에 제한이 있을 수 있습니다.');
            this.game.registry.set('localStorageSupported', false);
        }
    }

    /**
     * 입력 설정
     */
    setupInput() {
        // 키보드 입력 설정
        this.game.config.keyConfig = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),

            arrowUp: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
            arrowDown: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            arrowLeft: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
            arrowRight: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),

            attack: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            interact: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            inventory: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I),
            map: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M),

            skill1: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
            skill2: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            skill3: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            skill4: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),

            item1: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            item2: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            item3: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
            item4: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
            item5: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),

            pause: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
            debug: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1)
        };

        // 모바일 입력 처리
        if (this.game.registry.get('isMobile')) {
            // 모바일 장치일 경우 가상 컨트롤러를 위한 설정
            this.game.registry.set('useVirtualController', true);
        } else {
            // 데스크톱 장치일 경우 키보드/마우스 입력 설정
            this.game.registry.set('useVirtualController', false);
        }

        // 마우스 설정
        this.input.mouse.disableContextMenu();
    }

    /**
     * 오디오 설정
     */
    setupAudio() {
        // 오디오 컨텍스트 설정
        const audioConfig = this.game.config.gameConfig.get('audio', 'settings', {
            mute: false,
            volume: 0.8,
            musicVolume: 0.5,
            sfxVolume: 1.0
        });

        // 전역 오디오 설정 적용
        this.sound.setMute(audioConfig.mute);
        this.sound.setVolume(audioConfig.volume);

        // 오디오 그룹 생성
        this.game.registry.set('musicVolume', audioConfig.musicVolume);
        this.game.registry.set('sfxVolume', audioConfig.sfxVolume);

        // 페이지 숨김 시 오디오 처리
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 페이지가 숨겨질 때 모든 사운드 일시 정지
                this.sound.pauseAll();
            } else {
                // 페이지가 다시 표시될 때 사운드 복구 (배경음만)
                const currentBGM = this.game.registry.get('currentBGM');
                if (currentBGM) {
                    const bgm = this.sound.get(currentBGM);
                    if (bgm) {
                        bgm.resume();
                    }
                }
            }
        });
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 윈도우 크기 변경 이벤트
        window.addEventListener('resize', () => {
            this.scale.resize(window.innerWidth, window.innerHeight);
        });

        // 게임 포커스 이벤트
        this.game.events.on('blur', () => {
            // 게임이 포커스를 잃었을 때 일시 정지 처리
            if (this.game.registry.get('gameStarted') &&
                this.scene.isActive('DungeonScene')) {
                this.scene.get('DungeonScene').pauseGame();
            }
        });

        // 시스템 이벤트 등록
        this.events.on('shutdown', this.shutdown, this);

        // 게임 저장 이벤트
        this.game.events.on('saveGame', () => {
            this.game.config.dataManager.saveGameData();
        });

        // 디버그 토글 이벤트
        this.input.keyboard.on('keydown-F1', () => {
            if (this.game.registry.get('debugMode')) {
                this.toggleDebugInfo();
            }
        });
    }

    /**
     * 화면 크기 변경 처리
     * @param {number} width - 새 너비
     * @param {number} height - 새 높이
     */
    onResize(width, height) {
        // 캔버스 크기에 맞게 UI 스케일 조정
        const scale = Math.min(width / 1280, height / 720);
        this.game.registry.set('uiScale', scale);

        // UI 조정 이벤트 발생
        this.game.events.emit('resize', width, height, scale);

        // 디버그 정보 위치 업데이트
        if (this.game.config.gameInfo) {
            this.game.config.gameInfo.setPosition(5, 5);
        }
    }

    /**
     * 디버그 정보 업데이트
     */
    updateDebugInfo() {
        if (!this.game.config.gameInfo || !this.game.config.gameInfo.visible) {
            return;
        }

        const fps = Math.round(this.game.loop.actualFps);
        const memory = Math.round(performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0);
        const sceneName = this.scene.key;
        const objectCount = this.children.length;

        this.game.config.gameInfo.setText([
            `FPS: ${fps}`,
            `메모리: ${memory} MB`,
            `씬: ${sceneName}`,
            `오브젝트: ${objectCount}`,
            `시간: ${new Date().toLocaleTimeString()}`
        ].join('\n'));
    }

    /**
     * 디버그 정보 토글
     */
    toggleDebugInfo() {
        if (this.game.config.gameInfo) {
            this.game.config.gameInfo.visible = !this.game.config.gameInfo.visible;
        }
    }

    /**
     * 다음 씬 시작
     */
    startNextScene() {
        // 첫 방문인지 확인
        const isFirstVisit = !this.game.registry.get('gameStarted');

        // 로딩 씬으로 전환
        this.scene.start('Preloader', { isFirstVisit: isFirstVisit });
    }

    /**
     * 씬 종료 시 정리 작업
     */
    shutdown() {
        // 이벤트 리스너 제거
        this.events.off('shutdown', this.shutdown, this);
        this.scale.off('resize', this.onResize, this);

        // 타이머 정리
        if (this.loadFontsTimer) {
            this.loadFontsTimer.remove();
        }

        if (this.debugTimer) {
            this.debugTimer.remove();
        }
    }
}

export default Boot;