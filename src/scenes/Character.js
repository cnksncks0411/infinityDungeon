/**
 * Character.js
 * 
 * 캐릭터 선택 및 관리 화면을 구현하는 씬
 * 클래스 선택, 스탯 확인, 장비 관리, 클래스 조합 등의 기능을 제공합니다.
 */
class Character extends Phaser.Scene {
    constructor() {
        super({
            key: 'Character'
        });

        this.currentClassId = null;
        this.mode = 'new'; // 'new' or 'continue'
        this.currentTab = 'class'; // 'class', 'inventory', 'combine'
        this.classSystem = null;
        this.inventorySystem = null;
        this.progressionSystem = null;
        this.selectedClassIndex = 0;
        this.classCards = [];
        this.tabButtons = {};
        this.dialogueSystem = null;
        this.bgMusic = null;
    }

    /**
     * 씬 초기화
     * @param {Object} data - 전달 데이터
     */
    init(data) {
        this.mode = data.mode || 'new';
    }

    /**
     * 필요한 추가 에셋 로드
     */
    preload() {
        // 추가 에셋이 필요한 경우 여기서 로드
    }

    /**
     * 캐릭터 화면 생성
     */
    create() {
        // 시스템 초기화
        this.initSystems();

        // 배경 설정
        this.createBackground();

        // 배경 음악 재생
        this.playBackgroundMusic();

        // UI 생성
        this.createUI();

        // 클래스 데이터 로드
        this.loadClassData();

        // 이벤트 리스너 설정
        this.setupEventListeners();

        // 이어하기 모드인 경우 저장된 클래스 선택
        if (this.mode === 'continue') {
            const savedClassId = this.game.config.dataManager.getCurrentClass();
            if (savedClassId) {
                this.selectClass(savedClassId);
            }
        }

        // 페이드 인 효과
        this.cameras.main.fadeIn(500);
    }

    /**
     * 시스템 초기화
     */
    initSystems() {
        // 클래스 시스템 초기화
        this.classSystem = new ClassSystem(this);

        // 인벤토리 시스템 초기화
        this.inventorySystem = new InventorySystem(this);

        // 진행 시스템 초기화
        this.progressionSystem = new ProgressionSystem(this);

        // 대화 시스템 초기화
        this.dialogueSystem = new Dialogue(this);
    }

    /**
     * 배경 생성
     */
    createBackground() {
        // 배경 이미지
        this.bg = this.add.image(0, 0, 'main-menu-bg');
        this.bg.setOrigin(0, 0);
        this.bg.setDisplaySize(this.cameras.main.width, this.cameras.main.height);

        // 배경 오버레이 (그라데이션 효과)
        this.overlay = this.add.graphics();
        this.overlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.8, 0.8, 0, 0);
        this.overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
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

        // 캐릭터 화면 음악 재생
        this.bgMusic = this.sound.add('main-theme', {
            volume: this.game.registry.get('musicVolume') || 0.5,
            loop: true
        });

        this.bgMusic.play();

        // 현재 배경음악 등록
        this.game.registry.set('currentBGM', 'main-theme');
    }

    /**
     * UI 생성
     */
    createUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 상단 제목
        this.titleText = this.add.text(width / 2, 40, '캐릭터 관리', {
            fontSize: '32px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.titleText.setOrigin(0.5, 0.5);

        // 상단 탭 버튼 생성
        this.createTabButtons();

        // 클래스 선택 UI 생성 (초기 탭)
        this.createClassSelectUI();

        // 하단 버튼 (시작 또는 뒤로가기)
        this.createBottomButtons();
    }

    /**
     * 탭 버튼 생성
     */
    createTabButtons() {
        const width = this.cameras.main.width;
        const tabY = 100;
        const tabWidth = 180;
        const tabSpacing = 20;

        // 탭 설정
        const tabs = [
            { key: 'class', text: '클래스 선택', x: width / 2 - tabWidth - tabSpacing },
            { key: 'inventory', text: '장비 관리', x: width / 2 },
            { key: 'combine', text: '클래스 조합', x: width / 2 + tabWidth + tabSpacing }
        ];

        // 탭 스타일
        const tabStyle = {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff'
        };

        const activeTabStyle = {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        };

        // 탭 버튼 컨테이너
        this.tabContainer = this.add.container(0, 0);

        // 탭 버튼 생성
        for (const tab of tabs) {
            // 탭 배경
            const tabBg = this.add.graphics();
            tabBg.fillStyle(0x222222, 0.8);
            tabBg.fillRoundedRect(tab.x - tabWidth / 2, tabY - 20, tabWidth, 40, 10);
            tabBg.lineStyle(2, 0x666666);
            tabBg.strokeRoundedRect(tab.x - tabWidth / 2, tabY - 20, tabWidth, 40, 10);

            // 탭 텍스트
            const isActive = tab.key === this.currentTab;
            const tabText = this.add.text(tab.x, tabY, tab.text, isActive ? activeTabStyle : tabStyle);
            tabText.setOrigin(0.5, 0.5);

            // 탭 히트 영역
            const tabHitArea = this.add.zone(tab.x, tabY, tabWidth, 40);
            tabHitArea.setOrigin(0.5, 0.5);
            tabHitArea.setInteractive({ useHandCursor: true });

            // 탭 클릭 이벤트
            tabHitArea.on('pointerup', () => {
                this.switchTab(tab.key);
            });

            // 마우스 오버 효과
            tabHitArea.on('pointerover', () => {
                tabBg.clear();
                tabBg.fillStyle(0x444444, 0.8);
                tabBg.fillRoundedRect(tab.x - tabWidth / 2, tabY - 20, tabWidth, 40, 10);
                tabBg.lineStyle(2, 0x888888);
                tabBg.strokeRoundedRect(tab.x - tabWidth / 2, tabY - 20, tabWidth, 40, 10);
            });

            // 마우스 아웃 효과
            tabHitArea.on('pointerout', () => {
                tabBg.clear();
                tabBg.fillStyle(0x222222, 0.8);
                tabBg.fillRoundedRect(tab.x - tabWidth / 2, tabY - 20, tabWidth, 40, 10);
                tabBg.lineStyle(2, 0x666666);
                tabBg.strokeRoundedRect(tab.x - tabWidth / 2, tabY - 20, tabWidth, 40, 10);
            });

            // 탭 컨테이너에 추가
            this.tabContainer.add([tabBg, tabText, tabHitArea]);

            // 탭 버튼 저장
            this.tabButtons[tab.key] = {
                background: tabBg,
                text: tabText,
                hitArea: tabHitArea
            };
        }

        // 활성 탭 강조
        this.updateTabButtons();
    }

    /**
     * 탭 버튼 업데이트
     */
    updateTabButtons() {
        for (const [key, tab] of Object.entries(this.tabButtons)) {
            const isActive = key === this.currentTab;

            // 텍스트 스타일 변경
            tab.text.setStyle({
                fontSize: '20px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: isActive ? '#FFD700' : '#ffffff',
                fontStyle: isActive ? 'bold' : 'normal'
            });

            // 배경 변경
            tab.background.clear();
            tab.background.fillStyle(isActive ? 0x333333 : 0x222222, 0.8);
            tab.background.fillRoundedRect(
                tab.text.x - 90,
                tab.text.y - 20,
                180,
                40,
                10
            );
            tab.background.lineStyle(2, isActive ? 0xFFD700 : 0x666666);
            tab.background.strokeRoundedRect(
                tab.text.x - 90,
                tab.text.y - 20,
                180,
                40,
                10
            );
        }
    }

    /**
     * 탭 전환 처리
     * @param {string} tabKey - 탭 키
     */
    switchTab(tabKey) {
        if (this.currentTab === tabKey) return;

        // 효과음
        this.sound.play('button-click', { volume: 0.3 });

        // 현재 컨텐츠 제거
        if (this.contentContainer) {
            this.contentContainer.destroy();
            this.contentContainer = null;
        }

        // 탭 변경
        this.currentTab = tabKey;

        // 탭 버튼 업데이트
        this.updateTabButtons();

        // 새 컨텐츠 생성
        switch (tabKey) {
            case 'class':
                this.createClassSelectUI();
                break;
            case 'inventory':
                this.createInventoryUI();
                break;
            case 'combine':
                this.createClassCombineUI();
                break;
        }
    }

    /**
     * 클래스 데이터 로드
     */
    loadClassData() {
        // 해금된 클래스 목록
        const unlockedClasses = this.game.config.dataManager.getUnlockedClasses();

        // 클래스 목록 업데이트
        this.updateClassList(unlockedClasses);
    }

    /**
     * 클래스 선택 UI 생성
     */
    createClassSelectUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 컨텐츠 컨테이너
        this.contentContainer = this.add.container(0, 0);

        // 클래스 선택 영역 배경
        const classBg = this.add.graphics();
        classBg.fillStyle(0x000000, 0.6);
        classBg.fillRoundedRect(width / 2 - 400, 150, 800, height - 250, 20);
        classBg.lineStyle(2, 0x666666);
        classBg.strokeRoundedRect(width / 2 - 400, 150, 800, height - 250, 20);
        this.contentContainer.add(classBg);

        // 클래스 카드 컨테이너 생성
        this.classCardsContainer = this.add.container(width / 2, 350);
        this.contentContainer.add(this.classCardsContainer);

        // 클래스 정보 컨테이너
        this.classInfoContainer = this.add.container(width / 2, height - 200);
        this.contentContainer.add(this.classInfoContainer);

        // 해금된 클래스 로드
        this.loadClassData();

        // 클래스 이전/다음 버튼 생성
        this.createClassNavigationButtons();
    }

    /**
     * 클래스 카드 생성
     * @param {Array} classes - 클래스 목록
     */
    updateClassList(classes) {
        // 기존 클래스 카드 제거
        this.classCardsContainer.removeAll(true);
        this.classCards = [];

        if (!classes || classes.length === 0) {
            // 클래스가 없는 경우 기본 클래스 사용
            classes = this.getDefaultClasses();
        }

        // 클래스 카드 생성
        const cardWidth = 220;
        const cardSpacing = 250;
        const totalWidth = (classes.length - 1) * cardSpacing;

        for (let i = 0; i < classes.length; i++) {
            const classData = classes[i];
            const x = (i - Math.floor(classes.length / 2)) * cardSpacing;

            // 클래스 카드 생성
            const card = this.createClassCard(classData, x, 0);
            this.classCardsContainer.add(card);

            // 클래스 카드 배열 저장
            this.classCards.push({
                container: card,
                data: classData
            });

            // 클래스 카드 히트 영역
            const cardHitArea = this.add.zone(x, 0, cardWidth, 300);
            cardHitArea.setOrigin(0.5, 0.5);
            cardHitArea.setInteractive({ useHandCursor: true });

            // 클릭 이벤트
            cardHitArea.on('pointerup', () => {
                this.selectClassByIndex(i);
            });

            this.classCardsContainer.add(cardHitArea);
        }

        // 초기 선택 클래스 설정
        this.selectClassByIndex(this.selectedClassIndex);
    }

    /**
     * 클래스 카드 생성
     * @param {Object} classData - 클래스 데이터
     * @param {number} x - x 좌표
     * @param {number} y - y 좌표
     * @returns {Phaser.GameObjects.Container} - 클래스 카드 컨테이너
     */
    createClassCard(classData, x, y) {
        // 카드 컨테이너
        const cardContainer = this.add.container(x, y);

        // 카드 배경
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x222222, 0.9);
        cardBg.fillRoundedRect(-100, -150, 200, 300, 15);
        cardBg.lineStyle(2, this.getClassTierColor(classData.tier || 1));
        cardBg.strokeRoundedRect(-100, -150, 200, 300, 15);
        cardContainer.add(cardBg);

        // 클래스 이미지
        const classSprite = this.add.sprite(0, -80, classData.id || 'warrior');
        classSprite.setScale(2);
        cardContainer.add(classSprite);

        // 클래스 이름
        const nameText = this.add.text(0, 30, classData.name || '전사', {
            fontSize: '24px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center'
        });
        nameText.setOrigin(0.5, 0.5);
        cardContainer.add(nameText);

        // 클래스 티어
        const tierText = this.add.text(0, 60, `티어 ${classData.tier || 1}`, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: this.getClassTierColor(classData.tier || 1),
            align: 'center'
        });
        tierText.setOrigin(0.5, 0.5);
        cardContainer.add(tierText);

        // 클래스 레벨
        const level = this.getClassLevel(classData.id);
        const levelText = this.add.text(0, 90, `레벨 ${level}`, {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            align: 'center'
        });
        levelText.setOrigin(0.5, 0.5);
        cardContainer.add(levelText);

        // 클래스 간략 설명
        const descriptionText = this.add.text(0, 120, this.getClassShortDescription(classData), {
            fontSize: '14px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#CCCCCC',
            align: 'center',
            wordWrap: { width: 180 }
        });
        descriptionText.setOrigin(0.5, 0.5);
        cardContainer.add(descriptionText);

        return cardContainer;
    }

    /**
     * 클래스 티어 색상 가져오기
     * @param {number} tier - 클래스 티어
     * @returns {number} 색상 16진수 값
     */
    getClassTierColor(tier) {
        const tierColors = {
            1: 0xFFFFFF,  // 하얀색 (기본)
            2: 0x00FF00,  // 녹색 (조합)
            3: 0x00AAFF,  // 파란색 (상급)
            4: 0xFFAA00   // 주황색 (전설)
        };

        return tierColors[tier] || 0xFFFFFF;
    }

    /**
     * 클래스 레벨 가져오기
     * @param {string} classId - 클래스 ID
     * @returns {number} 클래스 레벨
     */
    getClassLevel(classId) {
        // 데이터 매니저에서 클래스 레벨 가져오기
        return this.game.config.dataManager.getClassLevel(classId) || 1;
    }

    /**
     * 클래스 간략 설명 가져오기
     * @param {Object} classData - 클래스 데이터
     * @returns {string} 클래스 간략 설명
     */
    getClassShortDescription(classData) {
        // 원본 설명이 있으면 반환
        if (classData.shortDescription) {
            return classData.shortDescription;
        }

        // 클래스 티어별 기본 설명
        const tierDescriptions = {
            1: '기본적인 능력을 갖춘 클래스',
            2: '두 기본 클래스가 조합된 클래스',
            3: '강력한 효과를 지닌 상급 클래스',
            4: '특별한 궁극기가 있는 전설 클래스'
        };

        return tierDescriptions[classData.tier || 1];
    }

    /**
     * 클래스 네비게이션 버튼 생성
     */
    createClassNavigationButtons() {
        const width = this.cameras.main.width;

        // 이전 버튼
        this.prevButton = this.add.image(width / 2 - 450, 350, 'ui_icons', 'arrow_left');
        this.prevButton.setScale(1.5);
        this.prevButton.setInteractive({ useHandCursor: true });
        this.prevButton.on('pointerup', () => {
            this.navigateClasses(-1);
        });
        this.contentContainer.add(this.prevButton);

        // 다음 버튼
        this.nextButton = this.add.image(width / 2 + 450, 350, 'ui_icons', 'arrow_right');
        this.nextButton.setScale(1.5);
        this.nextButton.setInteractive({ useHandCursor: true });
        this.nextButton.on('pointerup', () => {
            this.navigateClasses(1);
        });
        this.contentContainer.add(this.nextButton);
    }

    /**
     * 클래스 네비게이션 처리
     * @param {number} direction - 방향 (-1: 이전, 1: 다음)
     */
    navigateClasses(direction) {
        if (this.classCards.length === 0) return;

        // 효과음
        this.sound.play('button-click', { volume: 0.3 });

        // 새 인덱스 계산
        const newIndex = (this.selectedClassIndex + direction + this.classCards.length) % this.classCards.length;

        // 클래스 선택
        this.selectClassByIndex(newIndex);
    }

    /**
     * 인덱스로 클래스 선택
     * @param {number} index - 클래스 인덱스
     */
    selectClassByIndex(index) {
        if (!this.classCards || this.classCards.length === 0 || index < 0 || index >= this.classCards.length) {
            return;
        }

        // 인덱스 저장
        this.selectedClassIndex = index;

        // 모든 카드 비활성화
        for (let i = 0; i < this.classCards.length; i++) {
            const card = this.classCards[i].container;
            const scale = i === index ? 1.2 : 0.9;
            const y = i === index ? -20 : 0;

            // 선택된 카드 강조
            this.tweens.add({
                targets: card,
                scale: scale,
                y: y,
                duration: 200,
                ease: 'Power1'
            });

            // 배경 색상 변경
            const background = card.list[0]; // 첫 번째 항목은 배경 그래픽스
            const borderColor = i === index ? 0xFFD700 : this.getClassTierColor(this.classCards[i].data.tier || 1);

            background.clear();
            background.fillStyle(i === index ? 0x333333 : 0x222222, 0.9);
            background.fillRoundedRect(-100, -150, 200, 300, 15);
            background.lineStyle(2, borderColor);
            background.strokeRoundedRect(-100, -150, 200, 300, 15);
        }

        // 선택된 클래스 데이터
        const selectedClassData = this.classCards[index].data;

        // 클래스 ID 저장
        this.currentClassId = selectedClassData.id;

        // 클래스 상세 정보 표시
        this.updateClassInfo(selectedClassData);
    }

    /**
     * ID로 클래스 선택
     * @param {string} classId - 클래스 ID
     */
    selectClass(classId) {
        // ID에 해당하는 클래스 인덱스 찾기
        const index = this.classCards.findIndex(card => card.data.id === classId);
        if (index >= 0) {
            this.selectClassByIndex(index);
        }
    }

    /**
     * 클래스 정보 업데이트
     * @param {Object} classData - 클래스 데이터
     */
    updateClassInfo(classData) {
        // 기존 정보 제거
        this.classInfoContainer.removeAll(true);

        const width = this.cameras.main.width;

        // 클래스 레벨
        const level = this.getClassLevel(classData.id);

        // 클래스 스탯
        const stats = this.classSystem.calculateClassStats(classData.id, level);

        // 클래스 정보 배경
        const infoBg = this.add.graphics();
        infoBg.fillStyle(0x222222, 0.8);
        infoBg.fillRoundedRect(-350, -100, 700, 200, 15);
        infoBg.lineStyle(2, 0x666666);
        infoBg.strokeRoundedRect(-350, -100, 700, 200, 15);
        this.classInfoContainer.add(infoBg);

        // 스탯 정보 헤더
        const headerText = this.add.text(0, -80, '클래스 스탯', {
            fontSize: '22px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold',
            align: 'center'
        });
        headerText.setOrigin(0.5, 0.5);
        this.classInfoContainer.add(headerText);

        // 스탯 표시
        const statNames = {
            hp: 'HP',
            mp: 'MP',
            attack: '공격력',
            defense: '방어력',
            speed: '속도'
        };

        const statX = -300;
        const statY = -40;
        const statSpacing = 40;
        const columnWidth = 350;

        let col = 0;
        let row = 0;
        let index = 0;

        for (const [key, value] of Object.entries(stats)) {
            if (!statNames[key]) continue;

            col = Math.floor(index / 3);
            row = index % 3;

            const x = statX + col * columnWidth;
            const y = statY + row * statSpacing;

            // 스탯 이름
            const nameText = this.add.text(x, y, statNames[key], {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'left'
            });
            nameText.setOrigin(0, 0.5);
            this.classInfoContainer.add(nameText);

            // 스탯 값
            const valueText = this.add.text(x + 100, y, value.toString(), {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFFFF',
                align: 'right'
            });
            valueText.setOrigin(0, 0.5);
            this.classInfoContainer.add(valueText);

            index++;
        }

        // 클래스 능력 정보
        const abilitiesY = 40;

        // 능력 헤더
        const abilitiesHeader = this.add.text(0, abilitiesY - 30, '클래스 능력', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold',
            align: 'center'
        });
        abilitiesHeader.setOrigin(0.5, 0.5);
        this.classInfoContainer.add(abilitiesHeader);

        // 액티브 스킬
        if (classData.abilities && classData.abilities.length > 0) {
            const abilityText = this.add.text(-300, abilitiesY, `액티브: ${classData.abilities[0].name}`, {
                fontSize: '16px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFFFF',
                align: 'left'
            });
            abilityText.setOrigin(0, 0.5);
            this.classInfoContainer.add(abilityText);
        }

        // 패시브 효과
        if (classData.passiveEffect) {
            const passiveText = this.add.text(50, abilitiesY, `패시브: ${classData.passiveEffect.description || '없음'}`, {
                fontSize: '16px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAFFAA',
                align: 'left'
            });
            passiveText.setOrigin(0, 0.5);
            this.classInfoContainer.add(passiveText);
        }

        // 궁극기 (티어 3 이상)
        if (classData.tier >= 3 && classData.ultimateSkill) {
            const ultimateText = this.add.text(-300, abilitiesY + 30, `궁극기: ${classData.ultimateSkill.name}`, {
                fontSize: '16px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FF8888',
                align: 'left'
            });
            ultimateText.setOrigin(0, 0.5);
            this.classInfoContainer.add(ultimateText);
        }
    }

    /**
     * 인벤토리 UI 생성
     */
    createInventoryUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 컨텐츠 컨테이너
        this.contentContainer = this.add.container(0, 0);

        // 인벤토리 배경
        const inventoryBg = this.add.graphics();
        inventoryBg.fillStyle(0x000000, 0.6);
        inventoryBg.fillRoundedRect(width / 2 - 400, 150, 800, height - 250, 20);
        inventoryBg.lineStyle(2, 0x666666);
        inventoryBg.strokeRoundedRect(width / 2 - 400, 150, 800, height - 250, 20);
        this.contentContainer.add(inventoryBg);

        // 인벤토리 제목
        const titleText = this.add.text(width / 2, 180, '인벤토리', {
            fontSize: '24px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        titleText.setOrigin(0.5, 0.5);
        this.contentContainer.add(titleText);

        // 장비 섹션 생성
        this.createEquipmentSection();

        // 인벤토리 아이템 슬롯 생성
        this.createInventorySlots();

        // 아이템 상세 정보 패널
        this.createItemInfoPanel();
    }

    /**
     * 장비 섹션 생성
     */
    createEquipmentSection() {
        const width = this.cameras.main.width;

        // 장비 배경
        const equipBg = this.add.graphics();
        equipBg.fillStyle(0x222222, 0.7);
        equipBg.fillRoundedRect(width / 2 - 350, 220, 700, 150, 15);
        equipBg.lineStyle(2, 0x555555);
        equipBg.strokeRoundedRect(width / 2 - 350, 220, 700, 150, 15);
        this.contentContainer.add(equipBg);

        // 장비 제목
        const equipTitle = this.add.text(width / 2 - 320, 230, '장착 장비', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        this.contentContainer.add(equipTitle);

        // 장비 슬롯 타입 및 위치 정의
        const equipSlots = [
            { type: 'weapon', name: '무기', x: width / 2 - 250, y: 290 },
            { type: 'armor', name: '방어구', x: width / 2 - 120, y: 290 },
            { type: 'accessory1', name: '악세서리 1', x: width / 2 + 10, y: 290 },
            { type: 'accessory2', name: '악세서리 2', x: width / 2 + 140, y: 290 },
            { type: 'special', name: '특수 아이템', x: width / 2 + 270, y: 290 }
        ];

        // 장비 슬롯 생성
        for (const slot of equipSlots) {
            // 슬롯 배경
            const slotBg = this.add.image(slot.x, slot.y, 'inventory-slot');
            slotBg.setScale(1.2);
            this.contentContainer.add(slotBg);

            // 슬롯 이름
            const slotName = this.add.text(slot.x, slot.y - 40, slot.name, {
                fontSize: '16px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            slotName.setOrigin(0.5, 0.5);
            this.contentContainer.add(slotName);

            // 장착된 아이템이 있으면 표시
            const equippedItem = this.getEquippedItem(slot.type);
            if (equippedItem) {
                // 아이템 아이콘
                const itemIcon = this.add.image(slot.x, slot.y, 'items', equippedItem.icon || 0);
                this.contentContainer.add(itemIcon);

                // 아이템 이름 (마우스 오버 시 툴팁으로 표시)
                slotName.setText(equippedItem.name || slot.name);
                slotName.setColor(this.getRarityColor(equippedItem.rarity));
            }

            // 슬롯 인터랙션
            slotBg.setInteractive({ useHandCursor: true });

            // 마우스 오버 시 아이템 정보 표시
            slotBg.on('pointerover', () => {
                if (equippedItem) {
                    this.showItemInfo(equippedItem);
                }
            });

            // 마우스 아웃 시 아이템 정보 숨김
            slotBg.on('pointerout', () => {
                this.hideItemInfo();
            });

            // 클릭 시 장비 해제
            slotBg.on('pointerup', () => {
                if (equippedItem) {
                    this.inventorySystem.unequipItem(slot.type);
                    this.sound.play('button-click', { volume: 0.3 });
                    this.createInventoryUI(); // UI 새로고침
                }
            });
        }
    }

    /**
     * 인벤토리 슬롯 생성
     */
    createInventorySlots() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 인벤토리 배경
        const inventorySlotsBg = this.add.graphics();
        inventorySlotsBg.fillStyle(0x222222, 0.7);
        inventorySlotsBg.fillRoundedRect(width / 2 - 350, 390, 700, height - 490, 15);
        inventorySlotsBg.lineStyle(2, 0x555555);
        inventorySlotsBg.strokeRoundedRect(width / 2 - 350, 390, 700, height - 490, 15);
        this.contentContainer.add(inventorySlotsBg);

        // 인벤토리 제목
        const inventoryTitle = this.add.text(width / 2 - 320, 400, '인벤토리 아이템', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        this.contentContainer.add(inventoryTitle);

        // 인벤토리 정보 가져오기
        const inventory = this.inventorySystem.getInventory();

        if (!inventory || inventory.length === 0) {
            // 인벤토리가 비어있는 경우
            const emptyText = this.add.text(width / 2, height / 2, '인벤토리가 비어있습니다.\n던전에서 아이템을 획득하세요!', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            emptyText.setOrigin(0.5, 0.5);
            this.contentContainer.add(emptyText);
            return;
        }

        // 인벤토리 슬롯 그리드 생성
        const slotSize = 60;
        const slotSpacing = 10;
        const slotsPerRow = 8;
        const startX = width / 2 - (slotSize * slotsPerRow / 2) - (slotSpacing * (slotsPerRow - 1) / 2);
        const startY = 440;

        // 아이템 표시
        for (let i = 0; i < inventory.length; i++) {
            const item = inventory[i];
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;

            const x = startX + col * (slotSize + slotSpacing);
            const y = startY + row * (slotSize + slotSpacing);

            // 슬롯 배경
            const slotBg = this.add.image(x + slotSize / 2, y + slotSize / 2, 'inventory-slot');
            this.contentContainer.add(slotBg);

            // 아이템 아이콘
            const itemIcon = this.add.image(x + slotSize / 2, y + slotSize / 2, 'items', item.icon || 0);
            this.contentContainer.add(itemIcon);

            // 소비 아이템 개수 표시
            if (item.stackable && item.count > 1) {
                const countText = this.add.text(x + slotSize - 5, y + slotSize - 5, item.count.toString(), {
                    fontSize: '14px',
                    fontFamily: 'Noto Sans KR, sans-serif',
                    color: '#FFFFFF',
                    fontStyle: 'bold'
                });
                countText.setOrigin(1, 1);
                this.contentContainer.add(countText);
            }

            // 희귀도에 따른 테두리 색상
            const borderColor = this.getRarityColor(item.rarity);
            const border = this.add.graphics();
            border.lineStyle(2, parseInt(borderColor.replace('#', '0x')));
            border.strokeRect(x, y, slotSize, slotSize);
            this.contentContainer.add(border);

            // 슬롯 인터랙션
            slotBg.setInteractive({ useHandCursor: true });

            // 마우스 오버 시 아이템 정보 표시
            slotBg.on('pointerover', () => {
                this.showItemInfo(item);
            });

            // 마우스 아웃 시 아이템 정보 숨김
            slotBg.on('pointerout', () => {
                this.hideItemInfo();
            });

            // 클릭 시 아이템 사용 또는 장착
            slotBg.on('pointerup', () => {
                this.useOrEquipItem(item);
            });
        }
    }

    /**
     * 아이템 정보 패널 생성
     */
    createItemInfoPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 아이템 정보 컨테이너 (초기에는 숨겨짐)
        this.itemInfoPanel = this.add.container(width / 2 + 200, height / 2);
        this.itemInfoPanel.setVisible(false);
        this.contentContainer.add(this.itemInfoPanel);
    }

    /**
     * 아이템 정보 표시
     * @param {Object} item - 아이템 정보
     */
    showItemInfo(item) {
        // 기존 정보 제거
        this.itemInfoPanel.removeAll(true);

        // 패널 배경
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x000000, 0.8);
        panelBg.fillRoundedRect(-150, -100, 300, 200, 10);
        panelBg.lineStyle(2, parseInt(this.getRarityColor(item.rarity).replace('#', '0x')));
        panelBg.strokeRoundedRect(-150, -100, 300, 200, 10);
        this.itemInfoPanel.add(panelBg);

        // 아이템 이름
        const nameText = this.add.text(0, -80, item.name || '알 수 없는 아이템', {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: this.getRarityColor(item.rarity),
            fontStyle: 'bold',
            align: 'center'
        });
        nameText.setOrigin(0.5, 0.5);
        this.itemInfoPanel.add(nameText);

        // 아이템 타입
        const typeText = this.add.text(0, -55, this.getItemTypeText(item), {
            fontSize: '14px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#AAAAAA',
            align: 'center'
        });
        typeText.setOrigin(0.5, 0.5);
        this.itemInfoPanel.add(typeText);

        // 아이템 스탯
        let yPos = -30;

        if (item.stats) {
            for (const [key, value] of Object.entries(item.stats)) {
                const statText = this.add.text(0, yPos, `${this.getStatName(key)}: ${value > 0 ? '+' : ''}${value}`, {
                    fontSize: '14px',
                    fontFamily: 'Noto Sans KR, sans-serif',
                    color: '#FFFFFF',
                    align: 'center'
                });
                statText.setOrigin(0.5, 0.5);
                this.itemInfoPanel.add(statText);
                yPos += 20;
            }
        }

        // 아이템 효과
        if (item.effect) {
            const effectText = this.add.text(0, yPos, this.getEffectText(item.effect), {
                fontSize: '14px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAFFAA',
                align: 'center',
                wordWrap: { width: 280 }
            });
            effectText.setOrigin(0.5, 0.5);
            this.itemInfoPanel.add(effectText);
            yPos += effectText.height + 10;
        }

        // 아이템 설명
        if (item.description) {
            const descText = this.add.text(0, yPos, item.description, {
                fontSize: '12px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#CCCCCC',
                fontStyle: 'italic',
                align: 'center',
                wordWrap: { width: 280 }
            });
            descText.setOrigin(0.5, 0.5);
            this.itemInfoPanel.add(descText);
        }

        // 패널 표시
        this.itemInfoPanel.setVisible(true);
    }

    /**
     * 아이템 정보 숨김
     */
    hideItemInfo() {
        this.itemInfoPanel.setVisible(false);
    }

    /**
     * 아이템 사용 또는 장착
     * @param {Object} item - 아이템 정보
     */
    useOrEquipItem(item) {
        if (!item) return;

        // 효과음
        this.sound.play('button-click', { volume: 0.3 });

        // 아이템 타입에 따라 다른 처리
        if (item.type === 'consumable') {
            // 소비 아이템 사용
            this.inventorySystem.useItem(item.id);

            // 알림 표시
            this.showNotification(`${item.name} 아이템을 사용했습니다.`, 'success');
        } else if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
            // 장비 아이템 장착
            this.inventorySystem.equipItem(item.id);

            // UI 새로고침
            this.createInventoryUI();

            // 알림 표시
            this.showNotification(`${item.name} 아이템을 장착했습니다.`, 'success');
        } else {
            // 기타 아이템 (특수 아이템 등)
            this.showNotification(`${item.name} 아이템은 던전에서 사용할 수 있습니다.`, 'info');
        }
    }

    /**
     * 장착된 아이템 가져오기
     * @param {string} slotType - 슬롯 타입
     * @returns {Object} 장착된 아이템 정보
     */
    getEquippedItem(slotType) {
        const equipment = this.inventorySystem.getEquipment();
        if (!equipment) return null;

        return equipment[slotType] || null;
    }

    /**
     * 클래스 조합 UI 생성
     */
    createClassCombineUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 컨텐츠 컨테이너
        this.contentContainer = this.add.container(0, 0);

        // 조합 배경
        const combineBg = this.add.graphics();
        combineBg.fillStyle(0x000000, 0.6);
        combineBg.fillRoundedRect(width / 2 - 400, 150, 800, height - 250, 20);
        combineBg.lineStyle(2, 0x666666);
        combineBg.strokeRoundedRect(width / 2 - 400, 150, 800, height - 250, 20);
        this.contentContainer.add(combineBg);

        // 조합 제목
        const titleText = this.add.text(width / 2, 180, '클래스 조합', {
            fontSize: '24px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        titleText.setOrigin(0.5, 0.5);
        this.contentContainer.add(titleText);

        // 설명 텍스트
        const descText = this.add.text(width / 2, 220, '두 개의 클래스를 선택하여 새로운 클래스를 조합하세요.\n레벨 10 이상의 두 클래스가 필요합니다.', {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#CCCCCC',
            align: 'center'
        });
        descText.setOrigin(0.5, 0.5);
        this.contentContainer.add(descText);

        // 클래스 선택 영역 생성
        this.createClassSelectionArea();

        // 조합 결과 표시 영역
        this.createCombinationResultArea();
    }

    /**
     * 클래스 선택 영역 생성
     */
    createClassSelectionArea() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 클래스 선택 배경
        const selectBg = this.add.graphics();
        selectBg.fillStyle(0x222222, 0.7);
        selectBg.fillRoundedRect(width / 2 - 350, 260, 700, 200, 15);
        selectBg.lineStyle(2, 0x555555);
        selectBg.strokeRoundedRect(width / 2 - 350, 260, 700, 200, 15);
        this.contentContainer.add(selectBg);

        // 선택 영역 제목
        const selectTitle = this.add.text(width / 2 - 320, 270, '조합할 클래스 선택', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        this.contentContainer.add(selectTitle);

        // 골드 정보 표시
        const goldInfo = this.add.text(width / 2 + 200, 270, `보유 골드: ${this.game.config.dataManager.getGold() || 0}G`, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700'
        });
        this.contentContainer.add(goldInfo);

        // 해금된 클래스 목록 가져오기
        const unlockedClasses = this.game.config.dataManager.getUnlockedClasses();

        if (!unlockedClasses || unlockedClasses.length < 2) {
            // 조합 가능한 클래스가 부족한 경우
            const emptyText = this.add.text(width / 2, height / 2 - 50, '조합 가능한 클래스가 부족합니다.\n최소 2개의 클래스가 필요합니다.', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            emptyText.setOrigin(0.5, 0.5);
            this.contentContainer.add(emptyText);
            return;
        }

        // 조합 가능한 클래스만 필터링 (레벨 10 이상)
        const combineClasses = unlockedClasses.filter(cls => {
            const level = this.getClassLevel(cls.id);
            return level >= 10;
        });

        // 클래스 목록 표시 - 스크롤 가능한 영역
        if (combineClasses.length > 0) {
            // 클래스 목록 그리드
            const classSize = 80;
            const classSpacing = 15;
            const classesPerRow = 6;
            const startX = width / 2 - 320;
            const startY = 310;

            // 클래스 선택 상태
            if (!this.selectedClasses) {
                this.selectedClasses = [];
            }

            // 클래스 카드 생성
            for (let i = 0; i < combineClasses.length; i++) {
                const classData = combineClasses[i];
                const row = Math.floor(i / classesPerRow);
                const col = i % classesPerRow;

                const x = startX + col * (classSize + classSpacing);
                const y = startY + row * (classSize + classSpacing);

                // 클래스 카드 배경
                const cardBg = this.add.graphics();
                const isSelected = this.selectedClasses.some(c => c.id === classData.id);
                cardBg.fillStyle(isSelected ? 0x555555 : 0x333333, 0.9);
                cardBg.fillRoundedRect(x, y, classSize, classSize, 10);
                cardBg.lineStyle(2, this.getClassTierColor(classData.tier || 1));
                cardBg.strokeRoundedRect(x, y, classSize, classSize, 10);
                this.contentContainer.add(cardBg);

                // 클래스 아이콘
                const classIcon = this.add.sprite(x + classSize / 2, y + classSize / 2 - 15, classData.id || 'warrior');
                classIcon.setScale(1);
                this.contentContainer.add(classIcon);

                // 클래스 이름
                const nameText = this.add.text(x + classSize / 2, y + classSize - 10, classData.name || '전사', {
                    fontSize: '12px',
                    fontFamily: 'Noto Sans KR, sans-serif',
                    color: '#FFFFFF',
                    align: 'center'
                });
                nameText.setOrigin(0.5, 0.5);
                this.contentContainer.add(nameText);

                // 클래스 레벨
                const level = this.getClassLevel(classData.id);
                const levelText = this.add.text(x + classSize - 5, y + 5, `Lv.${level}`, {
                    fontSize: '12px',
                    fontFamily: 'Noto Sans KR, sans-serif',
                    color: level >= 10 ? '#AAFFAA' : '#FF8888',
                    align: 'right'
                });
                levelText.setOrigin(1, 0);
                this.contentContainer.add(levelText);

                // 인터랙션 영역
                const hitArea = this.add.zone(x, y, classSize, classSize);
                hitArea.setOrigin(0, 0);
                hitArea.setInteractive({ useHandCursor: true });

                // 클릭 이벤트
                hitArea.on('pointerup', () => {
                    // 레벨 10 미만이면 선택 불가
                    if (level < 10) {
                        this.showNotification('클래스 조합에는 레벨 10 이상의 클래스가 필요합니다.', 'warning');
                        return;
                    }

                    // 이미 선택된 클래스라면 선택 해제
                    const selectedIndex = this.selectedClasses.findIndex(c => c.id === classData.id);
                    if (selectedIndex >= 0) {
                        this.selectedClasses.splice(selectedIndex, 1);
                        this.sound.play('button-click', { volume: 0.3 });
                        this.createClassCombineUI(); // UI 새로고침
                        return;
                    }

                    // 최대 2개까지 선택 가능
                    if (this.selectedClasses.length >= 2) {
                        this.selectedClasses.shift(); // 첫 번째 선택 제거
                    }

                    // 클래스 선택 추가
                    this.selectedClasses.push(classData);
                    this.sound.play('button-click', { volume: 0.3 });

                    // UI 새로고침
                    this.createClassCombineUI();
                });

                // 마우스 오버 효과
                hitArea.on('pointerover', () => {
                    cardBg.clear();
                    cardBg.fillStyle(0x444444, 0.9);
                    cardBg.fillRoundedRect(x, y, classSize, classSize, 10);
                    cardBg.lineStyle(2, this.getClassTierColor(classData.tier || 1));
                    cardBg.strokeRoundedRect(x, y, classSize, classSize, 10);
                });

                // 마우스 아웃 효과
                hitArea.on('pointerout', () => {
                    cardBg.clear();
                    cardBg.fillStyle(isSelected ? 0x555555 : 0x333333, 0.9);
                    cardBg.fillRoundedRect(x, y, classSize, classSize, 10);
                    cardBg.lineStyle(2, this.getClassTierColor(classData.tier || 1));
                    cardBg.strokeRoundedRect(x, y, classSize, classSize, 10);
                });

                this.contentContainer.add(hitArea);
            }
        } else {
            // 조합 가능한 클래스가 없는 경우
            const emptyText = this.add.text(width / 2, height / 2 - 50, '조합 가능한 클래스가 없습니다.\n클래스를 레벨 10까지 성장시키세요.', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            emptyText.setOrigin(0.5, 0.5);
            this.contentContainer.add(emptyText);
        }
    }

    /**
     * 조합 결과 영역 생성
     */
    createCombinationResultArea() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 결과 영역 배경
        const resultBg = this.add.graphics();
        resultBg.fillStyle(0x222222, 0.7);
        resultBg.fillRoundedRect(width / 2 - 350, 480, 700, height - 580, 15);
        resultBg.lineStyle(2, 0x555555);
        resultBg.strokeRoundedRect(width / 2 - 350, 480, 700, height - 580, 15);
        this.contentContainer.add(resultBg);

        // 결과 영역 제목
        const resultTitle = this.add.text(width / 2 - 320, 490, '조합 결과', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        this.contentContainer.add(resultTitle);

        // 두 클래스가 선택되었는지 확인
        if (this.selectedClasses && this.selectedClasses.length === 2) {
            const class1 = this.selectedClasses[0];
            const class2 = this.selectedClasses[1];

            // 선택된 클래스 표시
            const class1Text = this.add.text(width / 2 - 200, 530, `${class1.name} + ${class2.name}`, {
                fontSize: '22px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFFFF',
                align: 'center'
            });
            class1Text.setOrigin(0.5, 0.5);
            this.contentContainer.add(class1Text);

            // 화살표 아이콘
            const arrowIcon = this.add.image(width / 2, 530, 'ui_icons', 'arrow_right');
            arrowIcon.setScale(1.5);
            this.contentContainer.add(arrowIcon);

            // 조합 결과 클래스 정보 가져오기
            const resultClassId = this.classSystem.getCombinationResult(class1.id, class2.id);

            if (resultClassId) {
                const resultClass = this.classSystem.getClassById(resultClassId);

                if (resultClass) {
                    // 결과 클래스 표시
                    const resultText = this.add.text(width / 2 + 200, 530, resultClass.name, {
                        fontSize: '24px',
                        fontFamily: 'Noto Sans KR, sans-serif',
                        color: this.getClassTierColor(resultClass.tier || 2),
                        fontStyle: 'bold',
                        align: 'center'
                    });
                    resultText.setOrigin(0.5, 0.5);
                    this.contentContainer.add(resultText);

                    // 결과 클래스 아이콘
                    const resultIcon = this.add.sprite(width / 2 + 200, 580, resultClass.id || 'warrior');
                    resultIcon.setScale(1.5);
                    this.contentContainer.add(resultIcon);

                    // 결과 클래스 티어
                    const tierText = this.add.text(width / 2 + 200, 640, `티어 ${resultClass.tier || 2} 클래스`, {
                        fontSize: '16px',
                        fontFamily: 'Noto Sans KR, sans-serif',
                        color: this.getClassTierColor(resultClass.tier || 2),
                        align: 'center'
                    });
                    tierText.setOrigin(0.5, 0.5);
                    this.contentContainer.add(tierText);

                    // 조합 성공 확률
                    const chance = this.getClassCombinationChance(class1, class2);
                    const chanceText = this.add.text(width / 2, 580, `성공 확률: ${chance}%`, {
                        fontSize: '18px',
                        fontFamily: 'Noto Sans KR, sans-serif',
                        color: chance >= 50 ? '#AAFFAA' : '#FFAAAA',
                        align: 'center'
                    });
                    chanceText.setOrigin(0.5, 0.5);
                    this.contentContainer.add(chanceText);

                    // 조합 비용
                    const cost = this.getClassCombinationCost(resultClass.tier || 2);
                    const costText = this.add.text(width / 2, 610, `필요 골드: ${cost}G`, {
                        fontSize: '18px',
                        fontFamily: 'Noto Sans KR, sans-serif',
                        color: this.game.config.dataManager.getGold() >= cost ? '#AAFFAA' : '#FFAAAA',
                        align: 'center'
                    });
                    costText.setOrigin(0.5, 0.5);
                    this.contentContainer.add(costText);

                    // 조합 버튼
                    const combineButton = this.add.image(width / 2, 655, 'button');
                    combineButton.setScale(1.2, 1);
                    this.contentContainer.add(combineButton);

                    const combineText = this.add.text(width / 2, 655, '클래스 조합하기', {
                        fontSize: '18px',
                        fontFamily: 'Noto Sans KR, sans-serif',
                        color: '#FFFFFF',
                        align: 'center'
                    });
                    combineText.setOrigin(0.5, 0.5);
                    this.contentContainer.add(combineText);

                    // 조합 버튼 인터랙션
                    combineButton.setInteractive({ useHandCursor: true });

                    // 버튼 클릭 이벤트
                    combineButton.on('pointerup', () => {
                        this.attemptClassCombination(class1.id, class2.id);
                    });

                    // 마우스 오버/아웃 효과
                    combineButton.on('pointerover', () => {
                        combineButton.setScale(1.25, 1.05);
                    });

                    combineButton.on('pointerout', () => {
                        combineButton.setScale(1.2, 1);
                    });
                } else {
                    // 결과 클래스 정보를 찾을 수 없는 경우
                    this.showNoResultMessage('결과 클래스 정보를 찾을 수 없습니다.');
                }
            } else {
                // 조합 결과가 없는 경우
                this.showNoResultMessage('이 조합으로는 새로운 클래스를 만들 수 없습니다.');
            }
        } else {
            // 두 클래스가 선택되지 않은 경우
            const selectText = this.add.text(width / 2, height / 2 + 100, '조합할 두 클래스를 선택하세요.', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            selectText.setOrigin(0.5, 0.5);
            this.contentContainer.add(selectText);
        }
    }

    /**
     * 조합 결과 없음 메시지 표시
     * @param {string} message - 표시할 메시지
     */
    showNoResultMessage(message) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const noResultText = this.add.text(width / 2, height / 2 + 100, message, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFAAAA',
            align: 'center'
        });
        noResultText.setOrigin(0.5, 0.5);
        this.contentContainer.add(noResultText);
    }

    /**
     * 클래스 조합 시도
     * @param {string} class1Id - 첫 번째 클래스 ID
     * @param {string} class2Id - 두 번째 클래스 ID
     */
    attemptClassCombination(class1Id, class2Id) {
        // 클래스 조합 시스템 호출
        const result = this.progressionSystem.attemptClassCombination(class1Id, class2Id);

        if (result.success) {
            // 조합 성공
            this.sound.play('level-up', { volume: 0.5 });

            // 조합된 클래스 데이터
            const newClass = this.classSystem.getClassById(result.resultClassId);

            // 성공 효과 애니메이션
            this.showCombinationSuccessEffect(newClass);

            // 조합 성공 축하 대화 표시
            this.showClassUnlockCelebration(newClass);
        } else {
            // 조합 실패
            this.sound.play('error', { volume: 0.5 });

            // 실패 메시지 표시
            this.showNotification(result.message || '클래스 조합에 실패했습니다.', 'error');

            // 실패 효과 애니메이션
            this.showCombinationFailEffect();
        }
    }

    /**
     * 조합 성공 효과 표시
     * @param {Object} newClass - 새로 조합된 클래스 정보
     */
    showCombinationSuccessEffect(newClass) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 성공 효과 컨테이너
        const effectContainer = this.add.container(width / 2, height / 2);

        // 배경 오버레이
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        effectContainer.add(overlay);

        // 빛나는 효과
        const glow = this.add.sprite(0, 0, 'particle-spark');
        glow.setScale(5);
        glow.setAlpha(0.8);
        glow.setTint(parseInt(this.getClassTierColor(newClass.tier || 2).replace('#', '0x')));
        effectContainer.add(glow);

        // 클래스 아이콘
        const classIcon = this.add.sprite(0, 0, newClass.id || 'warrior');
        classIcon.setScale(3);
        effectContainer.add(classIcon);

        // 클래스 이름
        const nameText = this.add.text(0, 120, newClass.name, {
            fontSize: '32px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: this.getClassTierColor(newClass.tier || 2),
            fontStyle: 'bold',
            align: 'center'
        });
        nameText.setOrigin(0.5, 0.5);
        effectContainer.add(nameText);

        // 애니메이션 효과
        this.tweens.add({
            targets: glow,
            alpha: { from: 0, to: 0.8 },
            scale: { from: 1, to: 5 },
            duration: 1000,
            ease: 'Sine.easeOut'
        });

        this.tweens.add({
            targets: classIcon,
            scale: { from: 0, to: 3 },
            duration: 800,
            ease: 'Back.easeOut'
        });

        this.tweens.add({
            targets: nameText,
            alpha: { from: 0, to: 1 },
            duration: 1000,
            ease: 'Sine.easeOut'
        });

        // 효과 제거 타이머
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: effectContainer,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    effectContainer.destroy();

                    // UI 새로고침
                    this.createClassCombineUI();
                }
            });
        });
    }

    /**
     * 조합 실패 효과 표시
     */
    showCombinationFailEffect() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 실패 효과 컨테이너
        const effectContainer = this.add.container(width / 2, height / 2);

        // 배경 오버레이
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        effectContainer.add(overlay);

        // 실패 효과
        const failEffect = this.add.sprite(0, 0, 'explosion');
        failEffect.setScale(3);
        failEffect.setTint(0xFF0000);
        effectContainer.add(failEffect);

        // 실패 텍스트
        const failText = this.add.text(0, 100, '조합 실패!', {
            fontSize: '32px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FF5555',
            fontStyle: 'bold',
            align: 'center'
        });
        failText.setOrigin(0.5, 0.5);
        effectContainer.add(failText);

        // 애니메이션 효과
        this.tweens.add({
            targets: failEffect,
            alpha: { from: 1, to: 0 },
            scale: { from: 1, to: 3 },
            duration: 1000,
            ease: 'Sine.easeOut'
        });

        // 효과 제거 타이머
        this.time.delayedCall(1500, () => {
            this.tweens.add({
                targets: effectContainer,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    effectContainer.destroy();
                }
            });
        });
    }

    /**
     * 클래스 해금 축하 대화 표시
     * @param {Object} classData - 해금된 클래스 데이터
     */
    showClassUnlockCelebration(classData) {
        // 대화 데이터
        const dialogueData = {
            dialogues: [
                {
                    speaker: '새 클래스 해금!',
                    portrait: 'celebrate',
                    text: `축하합니다! *${classData.name}* 클래스를 해금했습니다!`
                },
                {
                    speaker: classData.name,
                    portrait: `class_${classData.id}`,
                    text: classData.description || `${classData.name} 클래스는 티어 ${classData.tier || 2} 클래스입니다.`
                },
                {
                    speaker: classData.name,
                    portrait: `class_${classData.id}`,
                    text: `이 클래스의 주요 능력: ${this.getClassAbilitySummary(classData)}`
                }
            ]
        };

        // 대화 시스템을 통해 표시
        this.dialogueSystem.showDialogue(dialogueData);
    }

    /**
     * 클래스 능력 요약 가져오기
     * @param {Object} classData - 클래스 데이터
     * @returns {string} 능력 요약 텍스트
     */
    getClassAbilitySummary(classData) {
        let summary = '';

        // 액티브 스킬
        if (classData.abilities && classData.abilities.length > 0) {
            summary += `액티브 스킬: ${classData.abilities[0].name}`;
        }

        // 패시브 효과
        if (classData.passiveEffect) {
            summary += `, 패시브: ${classData.passiveEffect.description || ''}`;
        }

        // 궁극기 (티어 3 이상)
        if (classData.tier >= 3 && classData.ultimateSkill) {
            summary += `, 궁극기: ${classData.ultimateSkill.name}`;
        }

        return summary || '특수 능력 정보가 없습니다.';
    }

    /**
     * 클래스 조합 성공 확률 계산
     * @param {Object} class1 - 첫 번째 클래스 데이터
     * @param {Object} class2 - 두 번째 클래스 데이터
     * @returns {number} 성공 확률 (0-100)
     */
    getClassCombinationChance(class1, class2) {
        // 결과 클래스 정보 가져오기
        const resultClassId = this.classSystem.getCombinationResult(class1.id, class2.id);
        if (!resultClassId) return 0;

        const resultClass = this.classSystem.getClassById(resultClassId);
        if (!resultClass) return 0;

        // 티어에 따른 기본 확률
        let baseChance = 0;
        switch (resultClass.tier) {
            case 2: baseChance = 80; break;
            case 3: baseChance = 50; break;
            case 4: baseChance = 25; break;
            default: baseChance = 90;
        }

        // 클래스 레벨 보너스
        const class1Level = this.getClassLevel(class1.id);
        const class2Level = this.getClassLevel(class2.id);

        // 레벨 10 이상 부분에 대한 보너스 (+1% / 레벨)
        const levelBonus = (class1Level > 10 ? class1Level - 10 : 0) +
            (class2Level > 10 ? class2Level - 10 : 0);

        // 황금 열쇠 보너스 (+20%)
        const hasGoldenKey = this.inventorySystem.hasItem('golden_key');
        const keyBonus = hasGoldenKey ? 20 : 0;

        // 연금술사 보너스 (+15%까지)
        const alchemistLevel = this.getClassLevel('alchemist');
        const alchemistBonus = alchemistLevel > 0 ? Math.min(15, alchemistLevel) : 0;

        // 최종 확률 계산 (최대 95%)
        let chance = Math.min(95, baseChance + levelBonus + keyBonus + alchemistBonus);

        return chance;
    }

    /**
     * 클래스 조합 비용 계산
     * @param {number} tier - 결과 클래스 티어
     * @returns {number} 조합 비용 (골드)
     */
    getClassCombinationCost(tier) {
        switch (tier) {
            case 2: return 1000;
            case 3: return 5000;
            case 4: return 20000;
            default: return 500;
        }
    }

    /**
     * 하단 버튼 생성 (시작 또는 뒤로가기)
     */
    createBottomButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 버튼 컨테이너
        this.bottomContainer = this.add.container(0, 0);

        // 뒤로 버튼
        const backButton = this.add.image(width / 2 - 150, height - 50, 'button');
        backButton.setScale(1.2, 1);

        const backText = this.add.text(width / 2 - 150, height - 50, '뒤로 가기', {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        });
        backText.setOrigin(0.5, 0.5);

        backButton.setInteractive({ useHandCursor: true });
        backButton.on('pointerup', () => {
            this.onBackButton();
        });

        this.bottomContainer.add(backButton);
        this.bottomContainer.add(backText);

        // 시작 버튼
        const startButton = this.add.image(width / 2 + 150, height - 50, 'button');
        startButton.setScale(1.2, 1);

        const startText = this.add.text(width / 2 + 150, height - 50, '던전 시작', {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        });
        startText.setOrigin(0.5, 0.5);

        startButton.setInteractive({ useHandCursor: true });
        startButton.on('pointerup', () => {
            this.onStartButton();
        });

        this.bottomContainer.add(startButton);
        this.bottomContainer.add(startText);
    }

    /**
     * 뒤로 버튼 클릭 처리
     */
    onBackButton() {
        // 효과음
        this.sound.play('button-click', { volume: 0.5 });

        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // 메인 메뉴로 돌아가기
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('MainMenu');
        });
    }

    /**
     * 시작 버튼 클릭 처리
     */
    onStartButton() {
        // 현재 선택된 클래스가 없으면 경고 표시
        if (!this.currentClassId) {
            this.showNotification('시작하기 전에 클래스를 선택해주세요.', 'warning');
            return;
        }

        // 효과음
        this.sound.play('button-click', { volume: 0.5 });

        // 현재 클래스 저장
        this.game.config.dataManager.setCurrentClass(this.currentClassId);

        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // 던전 선택 화면으로 이동
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('DungeonSelect', {
                classId: this.currentClassId
            });
        });
    }

    /**
     * 기본 클래스 목록 가져오기
     * @returns {Array} 기본 클래스 목록
     */
    getDefaultClasses() {
        // 기본 클래스 데이터
        return [
            { id: 'warrior', name: '전사', tier: 1, description: '강력한 근접 공격과 높은 방어력을 가진 클래스' },
            { id: 'archer', name: '궁수', tier: 1, description: '원거리 공격에 특화된 클래스' },
            { id: 'mage', name: '마법사', tier: 1, description: '강력한 마법 공격을 사용하는 클래스' },
            { id: 'rogue', name: '도적', tier: 1, description: '빠른 이동과 치명타에 특화된 클래스' },
            { id: 'cleric', name: '성직자', tier: 1, description: '치유와 버프에 특화된 클래스' }
        ];
    }

    /**
     * 희귀도 색상 코드 가져오기
     * @param {string} rarity - 희귀도 (common, uncommon, rare, epic, legendary)
     * @returns {string} 색상 코드
     */
    getRarityColor(rarity) {
        const rarityColors = {
            common: '#FFFFFF',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FF8800',
            mythic: '#FF0000'
        };

        return rarityColors[rarity] || '#FFFFFF';
    }

    /**
     * 아이템 타입 텍스트 가져오기
     * @param {Object} item - 아이템 정보
     * @returns {string} 아이템 타입 텍스트
     */
    getItemTypeText(item) {
        const typeMap = {
            weapon: '무기',
            armor: '방어구',
            accessory: '악세서리',
            consumable: '소비 아이템',
            material: '재료',
            special: '특수 아이템'
        };

        const subTypeMap = {
            sword: '검',
            dagger: '단검',
            bow: '활',
            wand: '완드',
            staff: '지팡이',
            potion: '포션',
            scroll: '스크롤'
        };

        let typeText = typeMap[item.type] || '기타';

        if (item.subType && subTypeMap[item.subType]) {
            typeText = `${subTypeMap[item.subType]} (${typeText})`;
        }

        return typeText;
    }

    /**
     * 스탯 이름 가져오기
     * @param {string} stat - 스탯 키
     * @returns {string} 스탯 이름
     */
    getStatName(stat) {
        const statMap = {
            hp: 'HP',
            mp: 'MP',
            attack: '공격력',
            defense: '방어력',
            speed: '속도',
            critRate: '치명타 확률',
            critDamage: '치명타 피해',
            dodgeRate: '회피율',
            lifeSteal: '생명력 흡수'
        };

        return statMap[stat] || stat;
    }

    /**
     * 효과 텍스트 가져오기
     * @param {Object} effect - 효과 정보
     * @returns {string} 효과 텍스트
     */
    getEffectText(effect) {
        if (!effect || !effect.type) return '';

        const effectMap = {
            heal: `HP를 ${effect.value || 0} 회복합니다.`,
            mana: `MP를 ${effect.value || 0} 회복합니다.`,
            buff: `${this.getStatName(effect.stat || 'attack')}이(가) ${effect.value || 0}% 증가합니다. (${effect.duration || 0}초)`,
            poison: `${effect.duration || 0}초 동안 매 초마다 ${effect.value || 0}의 독 피해를 입힙니다.`
        };

        return effectMap[effect.type] || `${effect.type} 효과`;
    }

    /**
     * 알림 메시지 표시
     * @param {string} message - 메시지 내용
     * @param {string} type - 메시지 타입 (info, success, warning, error)
     */
    showNotification(message, type = 'info') {
        // 색상 설정
        const colors = {
            info: 0x3498db,
            success: 0x2ecc71,
            warning: 0xf39c12,
            error: 0xe74c3c
        };

        // 알림 컨테이너
        const width = this.cameras.main.width;
        const notification = this.add.container(width / 2, 100);
        notification.setDepth(1000);
        notification.setAlpha(0);

        // 배경
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-200, -20, 400, 40, 10);
        bg.lineStyle(2, colors[type] || colors.info);
        bg.strokeRoundedRect(-200, -20, 400, 40, 10);

        // 아이콘 (타입에 따라 다름)
        let iconFrame = 'info';
        switch (type) {
            case 'success': iconFrame = 'success'; break;
            case 'warning': iconFrame = 'warning'; break;
            case 'error': iconFrame = 'error'; break;
        }

        const icon = this.add.image(-170, 0, 'ui_icons', iconFrame);
        icon.setScale(0.8);

        // 메시지 텍스트
        const text = this.add.text(-140, 0, message, {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            align: 'left'
        });
        text.setOrigin(0, 0.5);

        // 컨테이너에 추가
        notification.add([bg, icon, text]);

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
        const soundKey = type === 'error' ? 'error' : 'button-click';
        this.sound.play(soundKey, { volume: 0.5 });
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 키보드 이벤트
        this.input.keyboard.on('keydown-LEFT', () => {
            if (this.currentTab === 'class') {
                this.navigateClasses(-1);
            }
        });

        this.input.keyboard.on('keydown-RIGHT', () => {
            if (this.currentTab === 'class') {
                this.navigateClasses(1);
            }
        });

        this.input.keyboard.on('keydown-ESC', () => {
            this.onBackButton();
        });

        this.input.keyboard.on('keydown-ENTER', () => {
            this.onStartButton();
        });

        // 씬 종료 이벤트
        this.events.once('shutdown', this.shutdown, this);
    }

    /**
     * 업데이트 (매 프레임)
     * @param {number} time - 시간
     * @param {number} delta - 경과 시간
     */
    update(time, delta) {
        // 필요한 업데이트 로직이 있으면 여기에 구현
    }

    /**
     * 정리 작업
     */
    shutdown() {
        // 이벤트 리스너 정리
        this.input.keyboard.off('keydown-LEFT');
        this.input.keyboard.off('keydown-RIGHT');
        this.input.keyboard.off('keydown-ESC');
        this.input.keyboard.off('keydown-ENTER');

        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // 선택된 클래스 정보 저장
        if (this.currentClassId) {
            this.game.config.dataManager.setCurrentClass(this.currentClassId);
            this.game.config.dataManager.saveGameData();
        }
    }
}

export default Character;