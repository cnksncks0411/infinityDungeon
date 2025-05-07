/**
 * MainMenu.js
 * 
 * 게임의 메인 메뉴 화면을 구현하는 씬
 * 게임 시작, 옵션, 크레딧 등의 메뉴를 제공합니다.
 */
class MainMenu extends Phaser.Scene {
    constructor() {
        super({
            key: 'MainMenu'
        });
        
        this.menuItems = [];
        this.selectedItemIndex = 0;
        this.bgMusic = null;
        this.showIntro = false;
    }

    /**
     * 씬 초기화
     * @param {Object} data - 전달 데이터
     */
    init(data) {
        this.showIntro = data.showIntro || false;
    }

    /**
     * 메인 메뉴에 필요한 추가 에셋 로드
     */
    preload() {
        // 메인 메뉴에 필요한 특별 에셋이 있다면 여기서 로드
    }

    /**
     * 메인 메뉴 화면 생성
     */
    create() {
        // 게임 시작 상태 설정
        this.game.registry.set('gameStarted', true);
        
        // 배경 설정
        this.createBackground();
        
        // 배경 음악 재생
        this.playBackgroundMusic();
        
        // 메뉴 UI 생성
        this.createMenuUI();
        
        // 인트로 표시 (첫 실행 시)
        if (this.showIntro) {
            this.time.delayedCall(500, this.showIntroSequence, [], this);
        }
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 업데이트 알림 확인 (옵션)
        this.checkForUpdates();
        
        // 페이드 인 효과
        this.cameras.main.fadeIn(1000);
        
        // 버전 정보 표시
        const version = this.game.config.gameConfig.get('system', 'version', '0.1.0');
        this.add.text(this.cameras.main.width - 10, this.cameras.main.height - 10, `v${version}`, {
            fontSize: '14px',
            fontFamily: 'Roboto, sans-serif',
            color: '#888888'
        }).setOrigin(1, 1);
    }

    /**
     * 메뉴 배경 생성
     */
    createBackground() {
        // 배경 이미지
        this.bg = this.add.image(0, 0, 'main-menu-bg');
        this.bg.setOrigin(0, 0);
        this.bg.setDisplaySize(this.cameras.main.width, this.cameras.main.height);
        
        // 배경 오버레이 (그라데이션 효과)
        this.overlay = this.add.graphics();
        this.overlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0, 0);
        this.overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        // 배경 파티클 (선택사항)
        this.createBackgroundParticles();
    }

    /**
     * 배경 파티클 효과 생성
     */
    createBackgroundParticles() {
        // 성능 설정에 따라 파티클 활성화 여부 결정
        const performanceSettings = this.game.registry.get('performanceSettings');
        if (performanceSettings && performanceSettings.particleQuality === 'low') {
            return; // 저사양 모드에서는 파티클 비활성화
        }
        
        // 먼지 파티클
        this.dustParticles = this.add.particles('particle-dust');
        
        this.dustEmitter = this.dustParticles.createEmitter({
            x: { min: 0, max: this.cameras.main.width },
            y: { min: 0, max: this.cameras.main.height },
            scale: { start: 0.2, end: 0 },
            alpha: { start: 0.3, end: 0 },
            speed: 20,
            angle: { min: 0, max: 360 },
            rotate: { min: 0, max: 360 },
            lifespan: { min: 2000, max: 8000 },
            frequency: 200,
            blendMode: 'ADD'
        });
    }

    /**
     * 배경 음악 재생
     */
    playBackgroundMusic() {
        // 이미 재생 중인 음악이 있다면 정지
        const currentBGM = this.game.registry.get('currentBGM');
        if (currentBGM) {
            this.sound.stopByKey(currentBGM);
        }
        
        // 메인 메뉴 음악 재생
        this.bgMusic = this.sound.add('main-theme', {
            volume: this.game.registry.get('musicVolume') || 0.5,
            loop: true
        });
        
        this.bgMusic.play();
        
        // 현재 배경음악 등록
        this.game.registry.set('currentBGM', 'main-theme');
    }

    /**
     * 메뉴 UI 생성
     */
    createMenuUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 게임 로고
        this.logo = this.add.image(width / 2, height * 0.25, 'logo');
        this.logo.setScale(1.2);
        
        // 로고 애니메이션
        this.tweens.add({
            targets: this.logo,
            y: this.logo.y - 10,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // 메뉴 항목 생성
        this.createMenuItems();
        
        // 메뉴 선택 강조 효과
        this.highlightSelectedItem();
    }

    /**
     * 메뉴 항목 생성
     */
    createMenuItems() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const menuY = height * 0.5;
        const menuSpacing = 60;
        
        // 메뉴 항목 텍스트 스타일
        const menuStyle = {
            fontSize: '28px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            align: 'center',
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
                blur: 2,
                fill: true
            }
        };
        
        // 메뉴 항목 정의
        const menuItemsConfig = [
            { key: 'start', text: '게임 시작', action: this.startGame },
            { key: 'continue', text: '이어하기', action: this.continueGame },
            { key: 'options', text: '옵션', action: this.showOptions },
            { key: 'credits', text: '크레딧', action: this.showCredits },
            { key: 'quit', text: '종료', action: this.quitGame }
        ];
        
        // 지역 저장 데이터가 없으면 '이어하기' 메뉴 비활성화
        const savedGame = this.game.config.dataManager.hasSavedGame();
        
        // 메뉴 항목 생성
        for (let i = 0; i < menuItemsConfig.length; i++) {
            const item = menuItemsConfig[i];
            
            // '이어하기' 메뉴가 비활성화되었는지 확인
            const isDisabled = (item.key === 'continue' && !savedGame);
            
            // 텍스트 스타일 복사
            const itemStyle = Object.assign({}, menuStyle);
            if (isDisabled) {
                itemStyle.color = '#666666';
            }
            
            // 메뉴 항목 텍스트 생성
            const menuItem = this.add.text(width / 2, menuY + (i * menuSpacing), item.text, itemStyle);
            menuItem.setOrigin(0.5);
            menuItem.setData('key', item.key);
            menuItem.setData('action', item.action);
            menuItem.setData('disabled', isDisabled);
            
            // 상호작용 설정
            if (!isDisabled) {
                menuItem.setInteractive({ useHandCursor: true });
                
                // 마우스 오버 효과
                menuItem.on('pointerover', () => {
                    this.selectedItemIndex = i;
                    this.highlightSelectedItem();
                    this.sound.play('button-click', { volume: 0.3 });
                });
                
                // 클릭 효과
                menuItem.on('pointerdown', () => {
                    const action = menuItem.getData('action');
                    if (action) {
                        action.call(this);
                    }
                });
            }
            
            // 메뉴 항목 배열에 추가
            this.menuItems.push(menuItem);
        }
        
        // 키보드 제어 설정
        this.input.keyboard.on('keydown-UP', this.selectPreviousMenuItem, this);
        this.input.keyboard.on('keydown-DOWN', this.selectNextMenuItem, this);
        this.input.keyboard.on('keydown-ENTER', this.confirmSelection, this);
        this.input.keyboard.on('keydown-SPACE', this.confirmSelection, this);
    }

    /**
     * 선택된 메뉴 항목 강조 표시
     */
    highlightSelectedItem() {
        for (let i = 0; i < this.menuItems.length; i++) {
            const item = this.menuItems[i];
            
            if (i === this.selectedItemIndex) {
                // 선택된 항목 강조
                item.setScale(1.2);
                item.setColor('#FFD700'); // 금색
                
                // 화살표 표시기 (없으면 생성)
                if (!this.selector) {
                    this.selector = this.add.image(item.x - 150, item.y, 'ui_icons', 'arrow');
                    this.selector.setScale(0.8);
                    this.selector.setOrigin(0.5);
                    
                    // 화살표 애니메이션
                    this.tweens.add({
                        targets: this.selector,
                        x: this.selector.x - 10,
                        duration: 800,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } else {
                    // 화살표 위치 업데이트
                    this.selector.y = item.y;
                }
            } else {
                // 비선택 항목 스타일
                item.setScale(1);
                
                if (item.getData('disabled')) {
                    item.setColor('#666666'); // 비활성화 색상
                } else {
                    item.setColor('#FFFFFF'); // 기본 색상
                }
            }
        }
    }

    /**
     * 이전 메뉴 항목 선택
     */
    selectPreviousMenuItem() {
        this.selectedItemIndex--;
        if (this.selectedItemIndex < 0) {
            this.selectedItemIndex = this.menuItems.length - 1;
        }
        
        // 비활성화된 항목은 건너뛰기
        while (this.menuItems[this.selectedItemIndex].getData('disabled')) {
            this.selectedItemIndex--;
            if (this.selectedItemIndex < 0) {
                this.selectedItemIndex = this.menuItems.length - 1;
            }
        }
        
        this.highlightSelectedItem();
        this.sound.play('button-click', { volume: 0.3 });
    }

    /**
     * 다음 메뉴 항목 선택
     */
    selectNextMenuItem() {
        this.selectedItemIndex++;
        if (this.selectedItemIndex >= this.menuItems.length) {
            this.selectedItemIndex = 0;
        }
        
        // 비활성화된 항목은 건너뛰기
        while (this.menuItems[this.selectedItemIndex].getData('disabled')) {
            this.selectedItemIndex++;
            if (this.selectedItemIndex >= this.menuItems.length) {
                this.selectedItemIndex = 0;
            }
        }
        
        this.highlightSelectedItem();
        this.sound.play('button-click', { volume: 0.3 });
    }

    /**
     * 현재 선택된 메뉴 항목 실행
     */
    confirmSelection() {
        const selectedItem = this.menuItems[this.selectedItemIndex];
        if (selectedItem && !selectedItem.getData('disabled')) {
            const action = selectedItem.getData('action');
            if (action) {
                this.sound.play('button-click', { volume: 0.5 });
                action.call(this);
            }
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 화면 크기 변경 이벤트
        this.scale.on('resize', this.resizeGameScreen, this);
        
        // 씬 종료 이벤트
        this.events.on('shutdown', this.shutdown, this);
    }

    /**
     * 화면 크기 변경 처리
     */
    resizeGameScreen() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 배경 리사이징
        if (this.bg) {
            this.bg.setDisplaySize(width, height);
        }
        
        // 오버레이 리사이징
        if (this.overlay) {
            this.overlay.clear();
            this.overlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0, 0);
            this.overlay.fillRect(0, 0, width, height);
        }
        
        // 로고 위치 업데이트
        if (this.logo) {
            this.logo.x = width / 2;
            this.logo.y = height * 0.25;
        }
        
        // 메뉴 항목 위치 업데이트
        const menuY = height * 0.5;
        const menuSpacing = 60;
        
        for (let i = 0; i < this.menuItems.length; i++) {
            const item = this.menuItems[i];
            item.x = width / 2;
            item.y = menuY + (i * menuSpacing);
        }
        
        // 선택자 위치 업데이트
        this.highlightSelectedItem();
    }

    /**
     * 업데이트 확인 (옵션)
     */
    checkForUpdates() {
        // 업데이트 확인 로직
        // 실제 구현에서는 서버에 요청을 보내 최신 버전 확인 필요
        const currentVersion = this.game.config.gameConfig.get('system', 'version', '0.1.0');
        
        // 디버그 모드에서만 출력
        if (this.game.registry.get('debugMode')) {
            console.log('현재 게임 버전:', currentVersion);
        }
    }

    /**
     * 인트로 시퀀스 표시 (첫 실행 시)
     */
    showIntroSequence() {
        // 인트로 대화 데이터
        const introDialogueData = {
            dialogues: [
                {
                    speaker: '??? (마을 장로)',
                    portrait: 'elder',
                    text: '모험가여, 무한의 던전에 오신 것을 환영하오.'
                },
                {
                    speaker: '마을 장로',
                    portrait: 'elder',
                    text: '이 던전은 끊임없이 변화하는 미스터리한 공간이라오. 수많은 보물과 위험이 공존하지.'
                },
                {
                    speaker: '마을 장로',
                    portrait: 'elder',
                    text: '자네는 *클래스 조합* 시스템을 통해 더 강력한 존재로 성장할 수 있을 것이오.'
                },
                {
                    speaker: '마을 장로',
                    portrait: 'elder',
                    text: '던전을 탐험하며 자원을 모으고, 클래스를 조합하여 더 강력한 클래스로 진화하는 것이 핵심이라오.',
                    choices: [
                        { text: '클래스 조합이 뭔가요?', nextIndex: 4 },
                        { text: '바로 시작하겠습니다.', nextIndex: 6 }
                    ]
                },
                {
                    speaker: '마을 장로',
                    portrait: 'elder',
                    text: '*클래스 조합*은 두 개의 클래스를 결합하여 더 강력한 능력을 가진 새로운 클래스를 만드는 고대의 비술이라오.'
                },
                {
                    speaker: '마을 장로',
                    portrait: 'elder',
                    text: '예를 들어, *전사*와 *마법사*를 조합하면 *마검사*가 되고, *도적*과 *궁수*를 조합하면 *어쌔신*이 되지. 다양한 조합을 통해 50개 이상의 클래스를 발견할 수 있을 것이오.'
                },
                {
                    speaker: '마을 장로',
                    portrait: 'elder',
                    text: '그럼, 자네의 모험을 응원하겠네. 행운을 빌겠소, 모험가여!'
                }
            ],
            onComplete: () => {
                // 인트로 완료 후 처리 (튜토리얼 완료 표시 등)
                this.game.registry.set('introCompleted', true);
                this.game.config.gameConfig.set('player', 'introCompleted', true);
                this.game.config.dataManager.saveGameData();
            }
        };
        
        // 대화 시스템 초기화 및 인트로 표시
        if (!this.dialogueSystem) {
            this.dialogueSystem = new Dialogue(this);
        }
        
        this.dialogueSystem.showDialogue(introDialogueData);
    }

    /**
     * 게임 시작 처리
     */
    startGame() {
        // 캐릭터 선택 씬으로 전환
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // 배경 음악 중지
            if (this.bgMusic) {
                this.bgMusic.stop();
            }
            
            // 씬 전환
            this.scene.start('Character', { mode: 'new' });
        });
    }

    /**
     * 이어하기 처리
     */
    continueGame() {
        // 저장된 게임 데이터 로드
        const loadSuccess = this.game.config.dataManager.loadGameData();
        
        if (loadSuccess) {
            // 페이드 아웃 효과
            this.cameras.main.fadeOut(500);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                // 배경 음악 중지
                if (this.bgMusic) {
                    this.bgMusic.stop();
                }
                
                // 마지막 플레이 상태에 따라 씬 결정
                // (던전이었으면 해당 던전으로, 아니면 캐릭터 선택 화면으로)
                const lastScene = this.game.registry.get('lastScene') || 'Character';
                this.scene.start(lastScene, { mode: 'continue' });
            });
        } else {
            // 로드 실패 시 알림
            this.showNotification('저장된 게임을 불러오는 데 실패했습니다.', 'error');
        }
    }

    /**
     * 옵션 메뉴 표시
     */
    showOptions() {
        // 옵션 메뉴 UI 생성 및 표시
        this.createOptionsUI();
    }

    /**
     * 옵션 UI 생성
     */
    createOptionsUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 기존 메뉴 항목 숨기기
        this.toggleMenuItems(false);
        
        // 옵션 패널 컨테이너
        this.optionsPanel = this.add.container(width / 2, height / 2);
        
        // 패널 배경
        const panelBg = this.add.image(0, 0, 'panel');
        panelBg.setScale(1.5);
        this.optionsPanel.add(panelBg);
        
        // 옵션 제목
        const title = this.add.text(0, -180, '옵션', {
            fontSize: '32px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            align: 'center'
        });
        title.setOrigin(0.5);
        this.optionsPanel.add(title);
        
        // 옵션 슬라이더 및 버튼 생성
        this.createOptionControls();
        
        // 닫기 버튼
        const closeButton = this.add.image(180, -180, 'ui_icons', 'close');
        closeButton.setScale(1.2);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.on('pointerup', this.closeOptions, this);
        this.optionsPanel.add(closeButton);
        
        // 패널 애니메이션 (스케일 효과)
        this.optionsPanel.setScale(0.1);
        this.tweens.add({
            targets: this.optionsPanel,
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }

    /**
     * 옵션 컨트롤 생성
     */
    createOptionControls() {
        // 현재 설정 가져오기
        const audioSettings = this.game.config.gameConfig.get('audio', 'settings', {
            musicVolume: 0.5,
            sfxVolume: 1.0
        });
        
        const difficultyLevel = this.game.registry.get('difficulty') || 2;
        
        // 옵션 항목 위치 계산
        const startY = -120;
        const spacing = 70;
        
        // 음악 볼륨 슬라이더
        this.createVolumeSlider('음악 볼륨', 0, startY, audioSettings.musicVolume, (value) => {
            // 음악 볼륨 변경 처리
            this.game.registry.set('musicVolume', value);
            this.game.config.gameConfig.set('audio', 'settings.musicVolume', value);
            
            // 현재 재생 중인 음악 볼륨 조정
            if (this.bgMusic) {
                this.bgMusic.setVolume(value);
            }
        });
        
        // 효과음 볼륨 슬라이더
        this.createVolumeSlider('효과음 볼륨', 0, startY + spacing, audioSettings.sfxVolume, (value) => {
            // 효과음 볼륨 변경 처리
            this.game.registry.set('sfxVolume', value);
            this.game.config.gameConfig.set('audio', 'settings.sfxVolume', value);
            
            // 볼륨 변경 효과음 재생 (피드백용)
            this.sound.play('button-click', { volume: value });
        });
        
        // 난이도 선택 버튼
        this.createDifficultySelector('게임 난이도', 0, startY + spacing * 2, difficultyLevel, (value) => {
            // 난이도 변경 처리
            this.game.registry.set('difficulty', value);
            this.game.config.gameConfig.set('gameplay', 'difficulty', value);
        });
        
        // 전체 화면 토글 버튼
        const isFullscreen = this.scale.isFullscreen;
        this.createToggleButton('전체 화면', 0, startY + spacing * 3, isFullscreen, (value) => {
            // 전체 화면 토글
            if (value) {
                this.scale.startFullscreen();
            } else {
                this.scale.stopFullscreen();
            }
            
            this.game.config.gameConfig.set('system', 'graphics.fullscreen', value);
        });
        
        // 저장 버튼
        const saveButton = this.add.image(0, startY + spacing * 4.5, 'button').setScale(1.2, 1);
        const saveText = this.add.text(0, startY + spacing * 4.5, '설정 저장', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        saveButton.setInteractive({ useHandCursor: true });
        saveButton.on('pointerup', () => {
            // 설정 저장
            this.game.config.dataManager.saveGameData();
            this.closeOptions();
            this.showNotification('설정이 저장되었습니다.', 'success');
        });
        
        this.optionsPanel.add(saveButton);
        this.optionsPanel.add(saveText);
    }

    /**
     * 볼륨 슬라이더 생성
     * @param {string} label - 슬라이더 레이블
     * @param {number} x - x 좌표
     * @param {number} y - y 좌표
     * @param {number} initialValue - 초기값 (0-1)
     * @param {Function} callback - 값 변경 콜백
     */
    createVolumeSlider(label, x, y, initialValue, callback) {
        // 레이블 텍스트
        const labelText = this.add.text(x - 150, y, label, {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff'
        });
        labelText.setOrigin(0, 0.5);
        this.optionsPanel.add(labelText);
        
        // 슬라이더 배경
        const sliderBg = this.add.rectangle(x + 50, y, 200, 10, 0x666666);
        this.optionsPanel.add(sliderBg);
        
        // 슬라이더 값 표시
        const valueText = this.add.text(x + 170, y, `${Math.floor(initialValue * 100)}%`, {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff'
        });
        valueText.setOrigin(0, 0.5);
        this.optionsPanel.add(valueText);
        
        // 슬라이더 핸들
        const handle = this.add.circle(x + 50 + initialValue * 200, y, 15, 0xFFD700);
        handle.setInteractive({ useHandCursor: true });
        this.optionsPanel.add(handle);
        
        // 드래그 처리
        this.input.setDraggable(handle);
        
        handle.on('drag', (pointer, dragX) => {
            // 슬라이더 범위 내로 제한
            const minX = x + 50 - 100;
            const maxX = x + 50 + 100;
            dragX = Phaser.Math.Clamp(dragX, minX, maxX);
            
            // 핸들 위치 업데이트
            handle.x = dragX;
            
            // 값 계산 (0-1)
            const value = (dragX - minX) / 200;
            
            // 값 텍스트 업데이트
            valueText.setText(`${Math.floor(value * 100)}%`);
            
            // 콜백 호출
            if (callback) {
                callback(value);
            }
        });
        
        // 슬라이더 배경 클릭 처리
        sliderBg.setInteractive({ useHandCursor: true });
        sliderBg.on('pointerdown', (pointer) => {
            // 클릭 위치로 핸들 이동
            const minX = x + 50 - 100;
            const maxX = x + 50 + 100;
            const clickX = Phaser.Math.Clamp(pointer.x - this.optionsPanel.x, minX, maxX);
            
            // 핸들 위치 업데이트
            handle.x = clickX;
            
            // 값 계산 (0-1)
            const value = (clickX - minX) / 200;
            
            // 값 텍스트 업데이트
            valueText.setText(`${Math.floor(value * 100)}%`);
            
            // 콜백 호출
            if (callback) {
                callback(value);
            }
        });
    }

    /**
     * 난이도 선택기 생성
     * @param {string} label - 레이블
     * @param {number} x - x 좌표
     * @param {number} y - y 좌표
     * @param {number} initialValue - 초기값 (1-5)
     * @param {Function} callback - 값 변경 콜백
     */
    createDifficultySelector(label, x, y, initialValue, callback) {
        // 레이블 텍스트
        const labelText = this.add.text(x - 150, y, label, {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff'
        });
        labelText.setOrigin(0, 0.5);
        this.optionsPanel.add(labelText);
        
        // 난이도 레벨 표시
        const difficultyNames = ['매우 쉬움', '쉬움', '보통', '어려움', '매우 어려움'];
        const valueText = this.add.text(x + 50, y, difficultyNames[initialValue - 1], {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff'
        });
        valueText.setOrigin(0.5, 0.5);
        this.optionsPanel.add(valueText);
        
        // 왼쪽/오른쪽 버튼
        const leftButton = this.add.image(x - 50, y, 'ui_icons', 'arrow_left');
        leftButton.setScale(0.8);
        leftButton.setInteractive({ useHandCursor: true });
        this.optionsPanel.add(leftButton);
        
        const rightButton = this.add.image(x + 150, y, 'ui_icons', 'arrow_right');
        rightButton.setScale(0.8);
        rightButton.setInteractive({ useHandCursor: true });
        this.optionsPanel.add(rightButton);
        
        // 현재 난이도 값
        let difficultyValue = initialValue;
        
        // 왼쪽 버튼 클릭 (난이도 감소)
        leftButton.on('pointerup', () => {
            difficultyValue--;
            if (difficultyValue < 1) difficultyValue = 1;
            
            // 텍스트 업데이트
            valueText.setText(difficultyNames[difficultyValue - 1]);
            
            // 콜백 호출
            if (callback) {
                callback(difficultyValue);
            }
            
            // 효과음
            this.sound.play('button-click', { volume: 0.3 });
        });
        
        // 오른쪽 버튼 클릭 (난이도 증가)
        rightButton.on('pointerup', () => {
            difficultyValue++;
            if (difficultyValue > 5) difficultyValue = 5;
            
            // 텍스트 업데이트
            valueText.setText(difficultyNames[difficultyValue - 1]);
            
            // 콜백 호출
            if (callback) {
                callback(difficultyValue);
            }
            
            // 효과음
            this.sound.play('button-click', { volume: 0.3 });
        });
    }

    /**
     * 토글 버튼 생성
     * @param {string} label - 레이블
     * @param {number} x - x 좌표
     * @param {number} y - y 좌표
     * @param {boolean} initialValue - 초기값
     * @param {Function} callback - 값 변경 콜백
     */
    createToggleButton(label, x, y, initialValue, callback) {
        // 레이블 텍스트
        const labelText = this.add.text(x - 150, y, label, {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff'
        });
        labelText.setOrigin(0, 0.5);
        this.optionsPanel.add(labelText);
        
        // 토글 배경
        const toggleBg = this.add.rectangle(x + 50, y, 60, 30, 0x666666, 1);
        toggleBg.setStrokeStyle(2, 0xFFFFFF);
        this.optionsPanel.add(toggleBg);
        
        // 토글 핸들
        const handle = this.add.circle(
            initialValue ? x + 50 + 15 : x + 50 - 15, 
            y, 
            12, 
            initialValue ? 0x00FF00 : 0xFF0000
        );
        this.optionsPanel.add(handle);
        
        // 상태 텍스트
        const stateText = this.add.text(
            x + 100, 
            y, 
            initialValue ? '켜짐' : '꺼짐', 
            {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: initialValue ? '#00FF00' : '#FF0000'
            }
        );
        stateText.setOrigin(0, 0.5);
        this.optionsPanel.add(stateText);
        
        // 현재 상태
        let isOn = initialValue;
        
        // 토글 상호작용
        toggleBg.setInteractive({ useHandCursor: true });
        toggleBg.on('pointerup', () => {
            // 상태 전환
            isOn = !isOn;
            
            // 핸들 위치 및 색상 변경
            this.tweens.add({
                targets: handle,
                x: isOn ? x + 50 + 15 : x + 50 - 15,
                duration: 100,
                ease: 'Power1'
            });
            
            handle.fillColor = isOn ? 0x00FF00 : 0xFF0000;
            
            // 상태 텍스트 업데이트
            stateText.setText(isOn ? '켜짐' : '꺼짐');
            stateText.setColor(isOn ? '#00FF00' : '#FF0000');
            
            // 콜백 호출
            if (callback) {
                callback(isOn);
            }
            
            // 효과음
            this.sound.play('button-click', { volume: 0.3 });
        });
    }

    /**
     * 옵션 메뉴 닫기
     */
    closeOptions() {
        // 옵션 패널 애니메이션
        this.tweens.add({
            targets: this.optionsPanel,
            scale: 0.1,
            duration: 300,
            ease: 'Back.easeIn',
            onComplete: () => {
                // 패널 제거
                this.optionsPanel.destroy();
                this.optionsPanel = null;
                
                // 메뉴 항목 다시 표시
                this.toggleMenuItems(true);
            }
        });
        
        // 효과음
        this.sound.play('menu-open', { volume: 0.3 });
    }

    /**
     * 메뉴 항목 표시/숨김 처리
     * @param {boolean} visible - 표시 여부
     */
    toggleMenuItems(visible) {
        // 메뉴 항목 표시/숨김
        for (const item of this.menuItems) {
            item.setVisible(visible);
        }
        
        // 셀렉터 표시/숨김
        if (this.selector) {
            this.selector.setVisible(visible);
        }
    }

    /**
     * 크레딧 표시
     */
    showCredits() {
        // 배경 오버레이
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 기존 메뉴 항목 숨기기
        this.toggleMenuItems(false);
        
        // 크레딧 컨테이너
        this.creditsPanel = this.add.container(width / 2, height / 2);
        
        // 패널 배경
        const panelBg = this.add.image(0, 0, 'panel');
        panelBg.setScale(1.7);
        this.creditsPanel.add(panelBg);
        
        // 크레딧 제목
        const title = this.add.text(0, -200, '크레딧', {
            fontSize: '36px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            align: 'center'
        });
        title.setOrigin(0.5);
        this.creditsPanel.add(title);
        
        // 크레딧 내용
        const credits = [
            { title: '개발', names: ['개발자 이름'] },
            { title: '아트', names: ['아티스트 이름'] },
            { title: '음악 및 사운드', names: ['작곡가 이름'] },
            { title: '특별 감사', names: ['감사한 분들의 이름'] }
        ];
        
        let yPos = -130;
        const spacing = 30;
        
        // 크레딧 항목 추가
        for (const item of credits) {
            // 항목 제목
            const itemTitle = this.add.text(0, yPos, item.title, {
                fontSize: '24px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFD700',
                align: 'center'
            });
            itemTitle.setOrigin(0.5);
            this.creditsPanel.add(itemTitle);
            yPos += spacing;
            
            // 항목 내용
            for (const name of item.names) {
                const itemText = this.add.text(0, yPos, name, {
                    fontSize: '20px',
                    fontFamily: 'Noto Sans KR, sans-serif',
                    color: '#ffffff',
                    align: 'center'
                });
                itemText.setOrigin(0.5);
                this.creditsPanel.add(itemText);
                yPos += spacing;
            }
            
            yPos += spacing; // 항목 간 여백
        }
        
        // 버전 정보
        const version = this.game.config.gameConfig.get('system', 'version', '0.1.0');
        const versionText = this.add.text(0, 180, `무한던전 버전 ${version}`, {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#AAAAAA',
            align: 'center'
        });
        versionText.setOrigin(0.5);
        this.creditsPanel.add(versionText);
        
        // 닫기 버튼
        const closeButton = this.add.image(200, -200, 'ui_icons', 'close');
        closeButton.setScale(1.2);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.on('pointerup', this.closeCredits, this);
        this.creditsPanel.add(closeButton);
        
        // 패널 애니메이션 (스케일 효과)
        this.creditsPanel.setScale(0.1);
        this.tweens.add({
            targets: this.creditsPanel,
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
        
        // 효과음
        this.sound.play('menu-open', { volume: 0.3 });
    }

    /**
     * 크레딧 닫기
     */
    closeCredits() {
        // 크레딧 패널 애니메이션
        this.tweens.add({
            targets: this.creditsPanel,
            scale: 0.1,
            duration: 300,
            ease: 'Back.easeIn',
            onComplete: () => {
                // 패널 제거
                this.creditsPanel.destroy();
                this.creditsPanel = null;
                
                // 메뉴 항목 다시 표시
                this.toggleMenuItems(true);
            }
        });
        
        // 효과음
        this.sound.play('menu-open', { volume: 0.3 });
    }

    /**
     * 게임 종료 처리
     */
    quitGame() {
        // 게임 상태 저장
        this.game.config.dataManager.saveGameData();
        
        // 효과음
        this.sound.play('button-click', { volume: 0.5 });
        
        // 페이드 아웃
        this.cameras.main.fadeOut(1000);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // 게임 종료 처리
            if (window.electron) {
                // Electron 환경에서는 창 닫기
                window.electron.closeWindow();
            } else {
                // 브라우저 환경에서는 메시지 표시 후 리로드
                alert('게임을 종료합니다. 브라우저 환경에서는 페이지가 새로고침됩니다.');
                window.location.reload();
            }
        });
    }

    /**
     * 알림 메시지 표시
     * @param {string} message - 메시지 내용
     * @param {string} type - 알림 유형 ('info', 'success', 'warning', 'error')
     */
    showNotification(message, type = 'info') {
        // 색상 설정
        const colors = {
            info: 0x3498db,
            success: 0x2ecc71,
            warning: 0xf39c12,
            error: 0xe74c3c
        };
        
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 알림 컨테이너
        const notification = this.add.container(width / 2, 100);
        notification.setDepth(1000);
        notification.setAlpha(0);
        
        // 배경
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-200, -20, 400, 40, 10);
        bg.lineStyle(2, colors[type] || colors.info);
        bg.strokeRoundedRect(-200, -20, 400, 40, 10);
        
        // 메시지 텍스트
        const text = this.add.text(0, 0, message, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            align: 'center'
        });
        text.setOrigin(0.5);
        
        // 컨테이너에 추가
        notification.add([bg, text]);
        
        // 애니메이션 (페이드 인 -> 대기 -> 페이드 아웃)
        this.tweens.add({
            targets: notification,
            alpha: 1,
            y: 120,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.tweens.add({
                        targets: notification,
                        alpha: 0,
                        y: 140,
                        duration: 300,
                        ease: 'Power2',
                        onComplete: () => {
                            notification.destroy();
                        }
                    });
                });
            }
        });
        
        // 효과음
        if (type === 'error') {
            this.sound.play('error', { volume: 0.5 });
        } else {
            this.sound.play('button-click', { volume: 0.3 });
        }
    }

    /**
     * update 메서드 (게임 루프에서 매 프레임 호출)
     * @param {number} time - 현재 시간
     * @param {number} delta - 이전 프레임과의 시간 차이
     */
    update(time, delta) {
        // 배경 파티클 업데이트 (선택 사항)
        if (this.dustEmitter) {
            // 파티클 움직임 조정 등 (필요한 경우)
        }
    }

    /**
     * 정리 메서드
     */
    shutdown() {
        // 이벤트 리스너 정리
        this.scale.off('resize', this.resizeGameScreen, this);
        this.input.keyboard.off('keydown-UP', this.selectPreviousMenuItem, this);
        this.input.keyboard.off('keydown-DOWN', this.selectNextMenuItem, this);
        this.input.keyboard.off('keydown-ENTER', this.confirmSelection, this);
        this.input.keyboard.off('keydown-SPACE', this.confirmSelection, this);
        
        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }
        
        // 파티클 정리
        if (this.dustParticles) {
            this.dustParticles.destroy();
        }
        
        // 타이머 정리
        this.tweens.killAll();
        
        // 씬 변수 정리
        this.menuItems = [];
    }
}

export default MainMenu;