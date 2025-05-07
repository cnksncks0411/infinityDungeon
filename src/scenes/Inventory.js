/**
 * Inventory.js
 * 
 * 인벤토리 관리 화면을 구현하는 씬
 * 아이템 관리, 장비 착용, 아이템 정렬 및 필터링 기능을 제공합니다.
 */
class Inventory extends Phaser.Scene {
    constructor() {
        super({
            key: 'Inventory'
        });
        
        this.inventorySystem = null;
        this.dialogueSystem = null;
        this.currentTab = 'all'; // 'all', 'weapon', 'armor', 'accessory', 'consumable', 'material', 'special'
        this.sortOrder = 'rarity'; // 'rarity', 'level', 'name', 'type'
        this.selectedItem = null;
        this.selectedSlot = null;
        this.equipmentSlots = {};
        this.inventorySlots = [];
        this.detailPanel = null;
        this.returnScene = 'Character';
        this.bgMusic = null;
    }

    /**
     * 씬 초기화
     * @param {Object} data - 전달 데이터
     */
    init(data) {
        this.returnScene = data.returnScene || 'Character';
    }

    /**
     * 필요한 추가 에셋 로드
     */
    preload() {
        // 인벤토리 관련 추가 에셋이 필요한 경우 여기서 로드
    }

    /**
     * 인벤토리 화면 생성
     */
    create() {
        // 시스템 초기화
        this.initSystems();
        
        // 배경 설정
        this.createBackground();
        
        // UI 생성
        this.createUI();
        
        // 인벤토리 데이터 로드 및 표시
        this.loadInventoryData();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 페이드 인 효과
        this.cameras.main.fadeIn(300);
    }

    /**
     * 시스템 초기화
     */
    initSystems() {
        // 인벤토리 시스템 초기화
        this.inventorySystem = new InventorySystem(this);
        
        // 대화 시스템 초기화
        this.dialogueSystem = new Dialogue(this);
    }

    /**
     * 배경 생성
     */
    createBackground() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 배경 이미지
        this.bg = this.add.image(0, 0, 'main-menu-bg');
        this.bg.setOrigin(0, 0);
        this.bg.setDisplaySize(width, height);
        
        // 배경 오버레이 (그라데이션 효과)
        this.overlay = this.add.graphics();
        this.overlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.8, 0.8, 0, 0);
        this.overlay.fillRect(0, 0, width, height);
    }

    /**
     * UI 생성
     */
    createUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 상단 제목
        this.titleText = this.add.text(width / 2, 40, '인벤토리 관리', {
            fontSize: '32px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.titleText.setOrigin(0.5, 0.5);
        
        // 장비 섹션 생성
        this.createEquipmentSection();
        
        // 탭 버튼 생성
        this.createTabButtons();
        
        // 정렬 버튼 생성
        this.createSortButtons();
        
        // 인벤토리 슬롯 영역 생성
        this.createInventorySlotArea();
        
        // 아이템 상세 정보 패널 생성
        this.createDetailPanel();
        
        // 하단 버튼 생성
        this.createBottomButtons();
    }

    /**
     * 장비 섹션 생성
     */
    createEquipmentSection() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 장비 섹션 배경
        const equipmentBg = this.add.graphics();
        equipmentBg.fillStyle(0x222222, 0.8);
        equipmentBg.fillRoundedRect(width / 2 - 400, 80, 800, 150, 15);
        equipmentBg.lineStyle(2, 0x444444);
        equipmentBg.strokeRoundedRect(width / 2 - 400, 80, 800, 150, 15);
        
        // 장비 섹션 제목
        const equipTitle = this.add.text(width / 2 - 380, 90, '장착 장비', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        });
        
        // 캐릭터 정보
        const playerClass = this.game.config.dataManager.getCurrentClassData();
        const playerLevel = this.game.config.dataManager.getCurrentClassLevel();
        
        const classInfo = this.add.text(width / 2 + 200, 90, `클래스: ${playerClass ? playerClass.name : '알 수 없음'} (레벨 ${playerLevel})`, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        });
        
        // 장비 슬롯 정의
        const slotConfigs = [
            { key: 'weapon', name: '무기', x: width / 2 - 300, y: 150 },
            { key: 'armor', name: '방어구', x: width / 2 - 180, y: 150 },
            { key: 'accessory1', name: '악세서리 1', x: width / 2 - 60, y: 150 },
            { key: 'accessory2', name: '악세서리 2', x: width / 2 + 60, y: 150 },
            { key: 'special', name: '특수 아이템', x: width / 2 + 180, y: 150 },
            { key: 'legacy', name: '유산 아이템', x: width / 2 + 300, y: 150 }
        ];
        
        // 장비 슬롯 생성
        this.equipmentSlots = {};
        
        for (const config of slotConfigs) {
            // 슬롯 배경
            const slotBg = this.add.image(config.x, config.y, 'inventory-slot');
            slotBg.setScale(1.2);
            
            // 슬롯 텍스트
            const slotText = this.add.text(config.x, config.y - 40, config.name, {
                fontSize: '16px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            slotText.setOrigin(0.5, 0.5);
            
            // 슬롯 저장
            this.equipmentSlots[config.key] = {
                background: slotBg,
                text: slotText,
                item: null,
                icon: null
            };
            
            // 슬롯 인터랙션
            slotBg.setInteractive({ useHandCursor: true });
            
            // 슬롯 클릭 - 아이템 해제
            slotBg.on('pointerup', () => {
                this.onEquipmentSlotClick(config.key);
            });
            
            // 슬롯 호버 - 아이템 정보 표시
            slotBg.on('pointerover', () => {
                this.onEquipmentSlotOver(config.key);
            });
            
            // 슬롯 아웃 - 아이템 정보 숨김
            slotBg.on('pointerout', () => {
                this.onEquipmentSlotOut(config.key);
            });
        }
    }

    /**
     * 탭 버튼 생성
     */
    createTabButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const tabY = 260;
        
        // 탭 설정
        const tabs = [
            { key: 'all', text: '전체', x: width / 2 - 330 },
            { key: 'weapon', text: '무기', x: width / 2 - 220 },
            { key: 'armor', text: '방어구', x: width / 2 - 110 },
            { key: 'accessory', text: '악세서리', x: width / 2 },
            { key: 'consumable', text: '소비 아이템', x: width / 2 + 110 },
            { key: 'material', text: '재료', x: width / 2 + 220 },
            { key: 'special', text: '특수 아이템', x: width / 2 + 330 }
        ];
        
        // 탭 컨테이너
        this.tabButtons = {};
        
        // 탭 버튼 생성
        for (const tab of tabs) {
            // 탭 배경
            const tabBg = this.add.graphics();
            const isActive = tab.key === this.currentTab;
            
            tabBg.fillStyle(isActive ? 0x444444 : 0x222222, 0.8);
            tabBg.fillRoundedRect(tab.x - 50, tabY - 15, 100, 30, 5);
            tabBg.lineStyle(2, isActive ? 0xFFD700 : 0x444444);
            tabBg.strokeRoundedRect(tab.x - 50, tabY - 15, 100, 30, 5);
            
            // 탭 텍스트
            const tabText = this.add.text(tab.x, tabY, tab.text, {
                fontSize: '16px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: isActive ? '#FFD700' : '#FFFFFF',
                align: 'center'
            });
            tabText.setOrigin(0.5, 0.5);
            
            // 탭 저장
            this.tabButtons[tab.key] = {
                background: tabBg,
                text: tabText
            };
            
            // 탭 인터랙션
            const tabHitArea = this.add.zone(tab.x - 50, tabY - 15, 100, 30);
            tabHitArea.setOrigin(0, 0);
            tabHitArea.setInteractive({ useHandCursor: true });
            
            // 탭 클릭
            tabHitArea.on('pointerup', () => {
                this.onTabClick(tab.key);
            });
            
            // 마우스 오버 효과
            tabHitArea.on('pointerover', () => {
                if (tab.key !== this.currentTab) {
                    tabBg.clear();
                    tabBg.fillStyle(0x333333, 0.8);
                    tabBg.fillRoundedRect(tab.x - 50, tabY - 15, 100, 30, 5);
                    tabBg.lineStyle(2, 0x666666);
                    tabBg.strokeRoundedRect(tab.x - 50, tabY - 15, 100, 30, 5);
                }
            });
            
            // 마우스 아웃 효과
            tabHitArea.on('pointerout', () => {
                if (tab.key !== this.currentTab) {
                    tabBg.clear();
                    tabBg.fillStyle(0x222222, 0.8);
                    tabBg.fillRoundedRect(tab.x - 50, tabY - 15, 100, 30, 5);
                    tabBg.lineStyle(2, 0x444444);
                    tabBg.strokeRoundedRect(tab.x - 50, tabY - 15, 100, 30, 5);
                }
            });
        }
    }

    /**
     * 정렬 버튼 생성
     */
    createSortButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 정렬 라벨
        const sortLabel = this.add.text(width / 2 - 380, 300, '정렬: ', {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#AAAAAA',
            align: 'left'
        });
        
        // 정렬 옵션 배열
        const sortOptions = [
            { key: 'rarity', text: '희귀도' },
            { key: 'level', text: '레벨' },
            { key: 'name', text: '이름' },
            { key: 'type', text: '유형' }
        ];
        
        // 정렬 버튼 생성
        this.sortButtons = {};
        let buttonX = width / 2 - 330;
        
        for (const option of sortOptions) {
            // 버튼 배경
            const buttonBg = this.add.graphics();
            const isActive = option.key === this.sortOrder;
            
            buttonBg.fillStyle(isActive ? 0x444444 : 0x222222, 0.8);
            buttonBg.fillRoundedRect(buttonX - 40, 300 - 10, 80, 25, 5);
            buttonBg.lineStyle(1, isActive ? 0xFFD700 : 0x444444);
            buttonBg.strokeRoundedRect(buttonX - 40, 300 - 10, 80, 25, 5);
            
            // 버튼 텍스트
            const buttonText = this.add.text(buttonX, 300, option.text, {
                fontSize: '14px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: isActive ? '#FFD700' : '#FFFFFF',
                align: 'center'
            });
            buttonText.setOrigin(0.5, 0.5);
            
            // 버튼 저장
            this.sortButtons[option.key] = {
                background: buttonBg,
                text: buttonText
            };
            
            // 버튼 인터랙션
            const buttonHitArea = this.add.zone(buttonX - 40, 300 - 10, 80, 25);
            buttonHitArea.setOrigin(0, 0);
            buttonHitArea.setInteractive({ useHandCursor: true });
            
            // 버튼 클릭
            buttonHitArea.on('pointerup', () => {
                this.onSortButtonClick(option.key);
            });
            
            // 마우스 오버 효과
            buttonHitArea.on('pointerover', () => {
                if (option.key !== this.sortOrder) {
                    buttonBg.clear();
                    buttonBg.fillStyle(0x333333, 0.8);
                    buttonBg.fillRoundedRect(buttonX - 40, 300 - 10, 80, 25, 5);
                    buttonBg.lineStyle(1, 0x666666);
                    buttonBg.strokeRoundedRect(buttonX - 40, 300 - 10, 80, 25, 5);
                }
            });
            
            // 마우스 아웃 효과
            buttonHitArea.on('pointerout', () => {
                if (option.key !== this.sortOrder) {
                    buttonBg.clear();
                    buttonBg.fillStyle(0x222222, 0.8);
                    buttonBg.fillRoundedRect(buttonX - 40, 300 - 10, 80, 25, 5);
                    buttonBg.lineStyle(1, 0x444444);
                    buttonBg.strokeRoundedRect(buttonX - 40, 300 - 10, 80, 25, 5);
                }
            });
            
            // 다음 버튼 위치
            buttonX += 90;
        }
        
        // 인벤토리 정보 표시
        const inventoryCount = this.add.text(width / 2 + 280, 300, '보유: 0/0', {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#AAAAAA',
            align: 'right'
        });
        this.inventoryCountText = inventoryCount;
    }

    /**
     * 인벤토리 슬롯 영역 생성
     */
    createInventorySlotArea() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 인벤토리 영역 배경
        const inventoryBg = this.add.graphics();
        inventoryBg.fillStyle(0x222222, 0.7);
        inventoryBg.fillRoundedRect(width / 2 - 400, 330, 800, height - 430, 15);
        inventoryBg.lineStyle(2, 0x444444);
        inventoryBg.strokeRoundedRect(width / 2 - 400, 330, 800, height - 430, 15);
        
        // 슬롯 컨테이너
        this.slotContainer = this.add.container(0, 0);
    }

    /**
     * 아이템 상세 정보 패널 생성
     */
    createDetailPanel() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 패널 컨테이너
        this.detailPanel = this.add.container(width - 220, height / 2);
        this.detailPanel.setVisible(false);
        
        // 패널 배경
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x222222, 0.9);
        panelBg.fillRoundedRect(-150, -200, 300, 400, 15);
        panelBg.lineStyle(2, 0x666666);
        panelBg.strokeRoundedRect(-150, -200, 300, 400, 15);
        this.detailPanel.add(panelBg);
        
        // 아이템 제목 (기본 텍스트)
        const titleText = this.add.text(0, -170, '아이템 정보', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        });
        titleText.setOrigin(0.5, 0.5);
        this.detailPanel.add(titleText);
        
        // 아이템 아이콘 자리
        const iconBg = this.add.graphics();
        iconBg.fillStyle(0x333333, 0.8);
        iconBg.fillRoundedRect(-30, -120, 60, 60, 8);
        iconBg.lineStyle(1, 0x666666);
        iconBg.strokeRoundedRect(-30, -120, 60, 60, 8);
        this.detailPanel.add(iconBg);
        
        // 상세 정보 표시 (비어있음)
        const detailText = this.add.text(0, 0, '아이템을 선택하여 \n상세 정보를 확인하세요.', {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#AAAAAA',
            align: 'center'
        });
        detailText.setOrigin(0.5, 0.5);
        this.detailPanel.add(detailText);
        
        // 버튼 영역 (기본적으로 비어있음)
        const buttonContainer = this.add.container(0, 150);
        this.detailPanel.add(buttonContainer);
        
        // 패널 요소 참조 저장
        this.detailPanel.titleText = titleText;
        this.detailPanel.detailText = detailText;
        this.detailPanel.iconBg = iconBg;
        this.detailPanel.buttonContainer = buttonContainer;
        this.detailPanel.icon = null; // 아이콘 참조 (나중에 설정)
    }

    /**
     * 하단 버튼 생성
     */
    createBottomButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 뒤로 버튼
        const backButton = this.add.image(width / 2, height - 50, 'button');
        backButton.setScale(1.2, 1);
        
        const backText = this.add.text(width / 2, height - 50, '돌아가기', {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        });
        backText.setOrigin(0.5, 0.5);
        
        backButton.setInteractive({ useHandCursor: true });
        backButton.on('pointerup', () => {
            this.onBackButtonClick();
        });
        
        // 마우스 오버/아웃 효과
        backButton.on('pointerover', () => {
            backButton.setScale(1.25, 1.05);
        });
        
        backButton.on('pointerout', () => {
            backButton.setScale(1.2, 1);
        });
    }

    /**
     * 인벤토리 데이터 로드 및 표시
     */
    loadInventoryData() {
        // 인벤토리 시스템에서 데이터 가져오기
        const inventory = this.inventorySystem.getInventory();
        const equipment = this.inventorySystem.getEquipment();
        
        // 장착 장비 표시
        this.updateEquipmentSlots(equipment);
        
        // 인벤토리 아이템 표시
        this.updateInventorySlots(inventory);
        
        // 인벤토리 수 업데이트
        const inventorySize = this.game.config.dataManager.getInventorySize() || 30;
        this.inventoryCountText.setText(`보유: ${inventory.length}/${inventorySize}`);
    }

    /**
     * 장착 장비 슬롯 업데이트
     * @param {Object} equipment - 장착 장비 데이터
     */
    updateEquipmentSlots(equipment) {
        if (!equipment) return;
        
        // 각 슬롯에 장착된 아이템 표시
        for (const [slotKey, item] of Object.entries(equipment)) {
            const slot = this.equipmentSlots[slotKey];
            if (!slot) continue;
            
            // 기존 아이콘 제거
            if (slot.icon) {
                slot.icon.destroy();
                slot.icon = null;
            }
            
            // 아이템이 있으면 아이콘 추가
            if (item) {
                // 아이템 아이콘
                const icon = this.add.image(slot.background.x, slot.background.y, 'items', item.icon || 0);
                slot.icon = icon;
                
                // 희귀도 색상 테두리
                const rarityBorder = this.add.graphics();
                rarityBorder.lineStyle(2, this.getRarityColor(item.rarity));
                rarityBorder.strokeRect(
                    slot.background.x - slot.background.width / 2 * slot.background.scaleX + 4,
                    slot.background.y - slot.background.height / 2 * slot.background.scaleY + 4,
                    slot.background.width * slot.background.scaleX - 8,
                    slot.background.height * slot.background.scaleY - 8
                );
                
                // 아이템 이름으로 슬롯 텍스트 업데이트
                slot.text.setText(item.name);
                slot.text.setColor(this.getRarityColorString(item.rarity));
                
                // 아이템 레퍼런스 저장
                slot.item = item;
            } else {
                // 기본 텍스트로 되돌리기
                const slotNames = {
                    'weapon': '무기',
                    'armor': '방어구',
                    'accessory1': '악세서리 1',
                    'accessory2': '악세서리 2',
                    'special': '특수 아이템',
                    'legacy': '유산 아이템'
                };
                
                slot.text.setText(slotNames[slotKey] || '장비');
                slot.text.setColor('#AAAAAA');
                
                // 아이템 레퍼런스 제거
                slot.item = null;
            }
        }
    }

    /**
     * 인벤토리 슬롯 업데이트
     * @param {Array} inventory - 인벤토리 아이템 배열
     */
    updateInventorySlots(inventory) {
        // 기존 슬롯 제거
        this.slotContainer.removeAll(true);
        this.inventorySlots = [];
        
        if (!inventory || inventory.length === 0) {
            // 인벤토리가 비어있는 경우
            const width = this.cameras.main.width;
            const height = this.cameras.main.height;
            
            const emptyText = this.add.text(width / 2, height / 2, '인벤토리가 비어있습니다.\n던전에서 아이템을 획득하세요!', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            emptyText.setOrigin(0.5, 0.5);
            this.slotContainer.add(emptyText);
            return;
        }
        
        // 아이템 필터링 (현재 탭에 따라)
        let filteredItems = inventory;
        if (this.currentTab !== 'all') {
            filteredItems = inventory.filter(item => item.type === this.currentTab);
        }
        
        // 아이템 정렬
        filteredItems = this.sortItems(filteredItems, this.sortOrder);
        
        // 인벤토리 슬롯 그리드 레이아웃 계산
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const slotSize = 60;
        const slotSpacing = 10;
        const slotsPerRow = 8;
        const startX = width / 2 - (slotSize * slotsPerRow / 2) - (slotSpacing * (slotsPerRow - 1) / 2) + slotSize / 2;
        const startY = 360 + slotSize / 2;
        
        // 슬롯 생성
        for (let i = 0; i < filteredItems.length; i++) {
            const item = filteredItems[i];
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            
            const x = startX + col * (slotSize + slotSpacing);
            const y = startY + row * (slotSize + slotSpacing);
            
            // 슬롯 배경
            const slotBg = this.add.image(x, y, 'inventory-slot');
            this.slotContainer.add(slotBg);
            
            // 아이템 아이콘
            const icon = this.add.image(x, y, 'items', item.icon || 0);
            this.slotContainer.add(icon);
            
            // 희귀도 테두리
            const rarityBorder = this.add.graphics();
            rarityBorder.lineStyle(2, this.getRarityColor(item.rarity));
            rarityBorder.strokeRect(
                x - slotSize / 2 + 4,
                y - slotSize / 2 + 4,
                slotSize - 8,
                slotSize - 8
            );
            this.slotContainer.add(rarityBorder);
            
            // 소비 아이템 개수 표시
            if (item.stackable && item.count > 1) {
                const countText = this.add.text(
                    x + slotSize / 2 - 5,
                    y + slotSize / 2 - 5,
                    item.count.toString(),
                    {
                        fontSize: '14px',
                        fontFamily: 'Noto Sans KR, sans-serif',
                        color: '#FFFFFF',
                        fontStyle: 'bold'
                    }
                );
                countText.setOrigin(1, 1);
                this.slotContainer.add(countText);
            }
            
            // 슬롯 인터랙션
            slotBg.setInteractive({ useHandCursor: true });
            
            // 슬롯 클릭 - 아이템 선택
            slotBg.on('pointerup', () => {
                this.onInventorySlotClick(item, slotBg);
            });
            
            // 슬롯 호버 - 아이템 정보 표시
            slotBg.on('pointerover', () => {
                this.onInventorySlotOver(item);
            });
            
            // 슬롯 아웃 - 아이템 정보 숨김
            slotBg.on('pointerout', () => {
                this.onInventorySlotOut();
            });
            
            // 인벤토리 슬롯 정보 저장
            this.inventorySlots.push({
                background: slotBg,
                icon: icon,
                border: rarityBorder,
                item: item
            });
        }
    }
    
    /**
     * 아이템 정렬
     * @param {Array} items - 아이템 배열
     * @param {string} order - 정렬 방식
     * @returns {Array} 정렬된 아이템 배열
     */
    sortItems(items, order) {
        if (!items || items.length === 0) return [];
        
        // 정렬 함수 정의
        const sortFunctions = {
            // 희귀도 (높은 순)
            rarity: (a, b) => {
                const rarityOrder = {
                    'common': 1,
                    'uncommon': 2,
                    'rare': 3,
                    'epic': 4,
                    'legendary': 5,
                    'mythic': 6
                };
                return rarityOrder[b.rarity] - rarityOrder[a.rarity];
            },
            
            // 레벨 (높은 순)
            level: (a, b) => {
                const levelA = a.requiredLevel || 0;
                const levelB = b.requiredLevel || 0;
                return levelB - levelA;
            },
            
            // 이름 (가나다 순)
            name: (a, b) => {
                return a.name.localeCompare(b.name);
            },
            
            // 유형 (유형별 그룹)
            type: (a, b) => {
                const typeOrder = {
                    'weapon': 1,
                    'armor': 2,
                    'accessory': 3,
                    'consumable': 4,
                    'material': 5,
                    'special': 6,
                    'legacy': 7
                };
                // 유형이 같으면 이름으로 정렬
                if (typeOrder[a.type] === typeOrder[b.type]) {
                    return a.name.localeCompare(b.name);
                }
                return typeOrder[a.type] - typeOrder[b.type];
            }
        };
        
        // 정렬 함수가 없으면 기본 정렬 (희귀도)
        if (!sortFunctions[order]) {
            order = 'rarity';
        }
        
        // 정렬 수행
        return [...items].sort(sortFunctions[order]);
    }
    
    /**
     * 장비 슬롯 클릭 처리
     * @param {string} slotKey - 슬롯 키
     */
    onEquipmentSlotClick(slotKey) {
        const slot = this.equipmentSlots[slotKey];
        if (!slot || !slot.item) return;
        
        // 장비 해제
        this.inventorySystem.unequipItem(slotKey);
        
        // 효과음
        this.sound.play('button-click', { volume: 0.3 });
        
        // 알림 표시
        this.showNotification(`${slot.item.name} 아이템을 해제했습니다.`, 'info');
        
        // 인벤토리 새로고침
        this.loadInventoryData();
        
        // 상세 패널 업데이트
        if (this.selectedItem === slot.item) {
            this.updateDetailPanel(slot.item);
        }
    }
    
    /**
     * 장비 슬롯 호버 처리
     * @param {string} slotKey - 슬롯 키
     */
    onEquipmentSlotOver(slotKey) {
        const slot = this.equipmentSlots[slotKey];
        if (!slot || !slot.item) return;
        
        // 아이템 상세 정보 표시
        this.updateDetailPanel(slot.item);
        this.detailPanel.setVisible(true);
    }
    
    /**
     * 장비 슬롯 호버 아웃 처리
     * @param {string} slotKey - 슬롯 키
     */
    onEquipmentSlotOut(slotKey) {
        // 선택된 아이템이 없으면 상세 패널 숨김
        if (!this.selectedItem) {
            this.detailPanel.setVisible(false);
        } else {
            // 선택된 아이템 정보로 복원
            this.updateDetailPanel(this.selectedItem);
        }
    }
    
    /**
     * 인벤토리 슬롯 클릭 처리
     * @param {Object} item - 아이템 데이터
     * @param {Phaser.GameObjects.Image} slotBg - 슬롯 배경 오브젝트
     */
    onInventorySlotClick(item, slotBg) {
        // 효과음
        this.sound.play('button-click', { volume: 0.3 });
        
        // 이전 선택 해제
        if (this.selectedSlot) {
            this.selectedSlot.setTint(0xFFFFFF);
        }
        
        // 새 아이템 선택
        this.selectedItem = item;
        this.selectedSlot = slotBg;
        
        // 선택 효과
        slotBg.setTint(0xAAAAFF);
        
        // 상세 패널 업데이트 및 표시
        this.updateDetailPanel(item);
        this.detailPanel.setVisible(true);
    }
    
    /**
     * 인벤토리 슬롯 호버 처리
     * @param {Object} item - 아이템 데이터
     */
    onInventorySlotOver(item) {
        // 아이템 상세 정보 표시
        this.updateDetailPanel(item);
        this.detailPanel.setVisible(true);
    }
    
    /**
     * 인벤토리 슬롯 호버 아웃 처리
     */
    onInventorySlotOut() {
        // 선택된 아이템이 없으면 상세 패널 숨김
        if (!this.selectedItem) {
            this.detailPanel.setVisible(false);
        } else {
            // 선택된 아이템 정보로 복원
            this.updateDetailPanel(this.selectedItem);
        }
    }
    
    /**
     * 탭 클릭 처리
     * @param {string} tabKey - 탭 키
     */
    onTabClick(tabKey) {
        if (this.currentTab === tabKey) return;
        
        // 효과음
        this.sound.play('button-click', { volume: 0.3 });
        
        // 이전 탭 스타일 초기화
        const prevTab = this.tabButtons[this.currentTab];
        if (prevTab) {
            prevTab.background.clear();
            prevTab.background.fillStyle(0x222222, 0.8);
            prevTab.background.fillRoundedRect(
                prevTab.text.x - 50,
                prevTab.text.y - 15,
                100,
                30,
                5
            );
            prevTab.background.lineStyle(2, 0x444444);
            prevTab.background.strokeRoundedRect(
                prevTab.text.x - 50,
                prevTab.text.y - 15,
                100,
                30,
                5
            );
            prevTab.text.setColor('#FFFFFF');
        }
        
        // 새 탭 스타일 적용
        this.currentTab = tabKey;
        const newTab = this.tabButtons[this.currentTab];
        if (newTab) {
            newTab.background.clear();
            newTab.background.fillStyle(0x444444, 0.8);
            newTab.background.fillRoundedRect(
                newTab.text.x - 50,
                newTab.text.y - 15,
                100,
                30,
                5
            );
            newTab.background.lineStyle(2, 0xFFD700);
            newTab.background.strokeRoundedRect(
                newTab.text.x - 50,
                newTab.text.y - 15,
                100,
                30,
                5
            );
            newTab.text.setColor('#FFD700');
        }
        
        // 선택 초기화
        this.selectedItem = null;
        if (this.selectedSlot) {
            this.selectedSlot.setTint(0xFFFFFF);
            this.selectedSlot = null;
        }
        
        // 상세 패널 숨김
        this.detailPanel.setVisible(false);
        
        // 인벤토리 새로고침
        this.loadInventoryData();
    }
    
    /**
     * 정렬 버튼 클릭 처리
     * @param {string} sortKey - 정렬 키
     */
    onSortButtonClick(sortKey) {
        if (this.sortOrder === sortKey) return;
        
        // 효과음
        this.sound.play('button-click', { volume: 0.3 });
        
        // 이전 정렬 버튼 스타일 초기화
        const prevButton = this.sortButtons[this.sortOrder];
        if (prevButton) {
            prevButton.background.clear();
            prevButton.background.fillStyle(0x222222, 0.8);
            prevButton.background.fillRoundedRect(
                prevButton.text.x - 40,
                prevButton.text.y - 10,
                80,
                25,
                5
            );
            prevButton.background.lineStyle(1, 0x444444);
            prevButton.background.strokeRoundedRect(
                prevButton.text.x - 40,
                prevButton.text.y - 10,
                80,
                25,
                5
            );
            prevButton.text.setColor('#FFFFFF');
        }
        
        // 새 정렬 버튼 스타일 적용
        this.sortOrder = sortKey;
        const newButton = this.sortButtons[this.sortOrder];
        if (newButton) {
            newButton.background.clear();
            newButton.background.fillStyle(0x444444, 0.8);
            newButton.background.fillRoundedRect(
                newButton.text.x - 40,
                newButton.text.y - 10,
                80,
                25,
                5
            );
            newButton.background.lineStyle(1, 0xFFD700);
            newButton.background.strokeRoundedRect(
                newButton.text.x - 40,
                newButton.text.y - 10,
                80,
                25,
                5
            );
            newButton.text.setColor('#FFD700');
        }
        
        // 인벤토리 새로고침
        this.loadInventoryData();
    }
    
    /**
     * 뒤로 버튼 클릭 처리
     */
    onBackButtonClick() {
        // 효과음
        this.sound.play('button-click', { volume: 0.5 });
        
        // 페이드 아웃
        this.cameras.main.fadeOut(300);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // 돌아갈 씬으로 전환
            this.scene.start(this.returnScene);
        });
    }
    
    /**
     * 아이템 상세 정보 패널 업데이트
     * @param {Object} item - 아이템 데이터
     */
    updateDetailPanel(item) {
        if (!item) return;
        
        const panel = this.detailPanel;
        
        // 기존 아이콘 제거
        if (panel.icon) {
            panel.icon.destroy();
            panel.icon = null;
        }
        
        // 버튼 컨테이너 비우기
        panel.buttonContainer.removeAll(true);
        
        // 아이템 제목 (이름) 업데이트
        panel.titleText.setText(item.name);
        panel.titleText.setColor(this.getRarityColorString(item.rarity));
        
        // 아이템 아이콘 추가
        const icon = this.add.image(0, -120, 'items', item.icon || 0);
        icon.setScale(1.5);
        panel.add(icon);
        panel.icon = icon;
        
        // 아이템 상세 정보 텍스트 구성
        let detailStr = '';
        
        // 아이템 타입
        detailStr += `${this.getItemTypeText(item)}\n`;
        
        // 희귀도
        detailStr += `희귀도: ${this.getRarityName(item.rarity)}\n\n`;
        
        // 스탯 정보 (장비 아이템)
        if (item.stats) {
            detailStr += '【 스탯 】\n';
            for (const [stat, value] of Object.entries(item.stats)) {
                const sign = value >= 0 ? '+' : '';
                detailStr += `${sign}${value} ${this.getStatName(stat)}\n`;
            }
            detailStr += '\n';
        }
        
        // 효과 정보
        if (item.effect) {
            detailStr += '【 효과 】\n';
            detailStr += `${this.getEffectText(item.effect)}\n\n`;
        }
        
        // 여러 효과
        if (item.effects && item.effects.length > 0) {
            detailStr += '【 효과 】\n';
            for (const effect of item.effects) {
                detailStr += `${this.getEffectText(effect)}\n`;
            }
            detailStr += '\n';
        }
        
        // 설명
        if (item.description) {
            detailStr += '【 설명 】\n';
            detailStr += `${item.description}\n\n`;
        }
        
        // 요구 레벨
        if (item.requiredLevel) {
            detailStr += `필요 레벨: ${item.requiredLevel}\n`;
        }
        
        // 클래스 제한
        if (item.classRestriction && item.classRestriction.length > 0) {
            detailStr += `사용 가능 클래스: ${item.classRestriction.join(', ')}\n`;
        }
        
        // 상세 정보 텍스트 업데이트
        panel.detailText.setText(detailStr);
        panel.detailText.setOrigin(0.5, 0);
        panel.detailText.setPosition(0, -50);
        
        // 아이템 타입에 따른 버튼 추가
        const buttonY = 0;
        
        if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
            // 장비 아이템용 버튼 (장착)
            this.createActionButton('장착하기', buttonY, () => {
                this.equipItem(item);
            }, panel.buttonContainer);
        } else if (item.type === 'consumable') {
            // 소비 아이템용 버튼 (사용)
            this.createActionButton('사용하기', buttonY, () => {
                this.useItem(item);
            }, panel.buttonContainer);
        } else if (item.type === 'material') {
            // 재료 아이템용 정보
            const infoText = this.add.text(0, buttonY, '재료 아이템', {
                fontSize: '14px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            infoText.setOrigin(0.5, 0.5);
            panel.buttonContainer.add(infoText);
        }
        
        // 일반 버튼 (버리기)
        this.createActionButton('버리기', buttonY + 40, () => {
            this.dropItem(item);
        }, panel.buttonContainer, '#FF5555');
    }
    
    /**
     * 액션 버튼 생성
     * @param {string} text - 버튼 텍스트
     * @param {number} y - y 위치
     * @param {Function} callback - 클릭 콜백
     * @param {Phaser.GameObjects.Container} container - 부모 컨테이너
     * @param {string} color - 버튼 텍스트 색상
     */
    createActionButton(text, y, callback, container, color = '#FFFFFF') {
        // 버튼 배경
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x333333, 0.9);
        buttonBg.fillRoundedRect(-80, y - 15, 160, 30, 8);
        buttonBg.lineStyle(2, 0x666666);
        buttonBg.strokeRoundedRect(-80, y - 15, 160, 30, 8);
        
        // 버튼 텍스트
        const buttonText = this.add.text(0, y, text, {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: color,
            align: 'center'
        });
        buttonText.setOrigin(0.5, 0.5);
        
        // 버튼 컨테이너에 추가
        container.add([buttonBg, buttonText]);
        
        // 히트 영역
        const hitArea = this.add.zone(-80, y - 15, 160, 30);
        hitArea.setOrigin(0, 0);
        hitArea.setInteractive({ useHandCursor: true });
        container.add(hitArea);
        
        // 버튼 클릭
        hitArea.on('pointerup', callback);
        
        // 호버 효과
        hitArea.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x444444, 0.9);
            buttonBg.fillRoundedRect(-80, y - 15, 160, 30, 8);
            buttonBg.lineStyle(2, 0x888888);
            buttonBg.strokeRoundedRect(-80, y - 15, 160, 30, 8);
        });
        
        hitArea.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x333333, 0.9);
            buttonBg.fillRoundedRect(-80, y - 15, 160, 30, 8);
            buttonBg.lineStyle(2, 0x666666);
            buttonBg.strokeRoundedRect(-80, y - 15, 160, 30, 8);
        });
        
        return { background: buttonBg, text: buttonText, hitArea: hitArea };
    }
    
    /**
     * 아이템 장착
     * @param {Object} item - 장착할 아이템
     */
    equipItem(item) {
        // 장착 시도
        const result = this.inventorySystem.equipItem(item.id);
        
        // 효과음
        this.sound.play(result.success ? 'item-pickup' : 'error', { volume: 0.5 });
        
        // 알림 표시
        this.showNotification(
            result.success ? `${item.name} 아이템을 장착했습니다.` : result.message,
            result.success ? 'success' : 'error'
        );
        
        // 인벤토리 새로고침
        this.loadInventoryData();
        
        // 선택 초기화
        this.selectedItem = null;
        if (this.selectedSlot) {
            this.selectedSlot.setTint(0xFFFFFF);
            this.selectedSlot = null;
        }
        
        // 상세 패널 숨김
        this.detailPanel.setVisible(false);
    }
    
    /**
     * 아이템 사용
     * @param {Object} item - 사용할 아이템
     */
    useItem(item) {
        // 아이템 사용 시도
        const result = this.inventorySystem.useItem(item.id);
        
        // 효과음
        this.sound.play(result.success ? 'potion-use' : 'error', { volume: 0.5 });
        
        // 알림 표시
        this.showNotification(
            result.success ? `${item.name} 아이템을 사용했습니다.` : result.message,
            result.success ? 'success' : 'error'
        );
        
        // 인벤토리 새로고침
        this.loadInventoryData();
        
        // 선택 초기화 (아이템이 사라진 경우)
        if (result.success && (!item.stackable || item.count <= 1)) {
            this.selectedItem = null;
            if (this.selectedSlot) {
                this.selectedSlot.setTint(0xFFFFFF);
                this.selectedSlot = null;
            }
            
            // 상세 패널 숨김
            this.detailPanel.setVisible(false);
        } else {
            // 상세 패널 업데이트
            this.updateDetailPanel(item);
        }
    }
    
    /**
     * 아이템 버리기
     * @param {Object} item - 버릴 아이템
     */
    dropItem(item) {
        // 확인 대화상자
        const confirmData = {
            dialogues: [
                {
                    speaker: '확인',
                    portrait: 'question',
                    text: `${item.name} 아이템을 버리시겠습니까?`,
                    choices: [
                        { text: '확인', nextIndex: 1 },
                        { text: '취소', nextIndex: 2 }
                    ]
                },
                {
                    speaker: '확인',
                    portrait: 'question',
                    text: '아이템이 영구적으로 삭제됩니다.'
                },
                {
                    speaker: '취소',
                    portrait: 'question',
                    text: '작업을 취소했습니다.'
                }
            ],
            onComplete: () => {
                // 확인 선택 시 아이템 제거
                if (this.dialogueSystem.lastChoice === 0) {
                    // 아이템 제거
                    this.inventorySystem.removeItem(item.id);
                    
                    // 효과음
                    this.sound.play('button-click', { volume: 0.3 });
                    
                    // 알림 표시
                    this.showNotification(`${item.name} 아이템을 버렸습니다.`, 'info');
                    
                    // 인벤토리 새로고침
                    this.loadInventoryData();
                    
                    // 선택 초기화
                    this.selectedItem = null;
                    if (this.selectedSlot) {
                        this.selectedSlot.setTint(0xFFFFFF);
                        this.selectedSlot = null;
                    }
                    
                    // 상세 패널 숨김
                    this.detailPanel.setVisible(false);
                }
            }
        };
        
        // 대화 시스템으로 확인 창 표시
        this.dialogueSystem.showDialogue(confirmData);
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
            special: '특수 아이템',
            legacy: '유산 아이템'
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
     * 희귀도 색상 코드 가져오기
     * @param {string} rarity - 희귀도
     * @returns {number} 색상 16진수 값
     */
    getRarityColor(rarity) {
        const rarityColors = {
            common: 0xFFFFFF,     // 하얀색
            uncommon: 0x00FF00,   // 녹색
            rare: 0x0088FF,       // 파란색
            epic: 0xAA00FF,       // 보라색
            legendary: 0xFF8800,  // 주황색
            mythic: 0xFF0000      // 빨간색
        };
        
        return rarityColors[rarity] || 0xFFFFFF;
    }
    
    /**
     * 희귀도 색상 문자열 가져오기
     * @param {string} rarity - 희귀도
     * @returns {string} 색상 문자열
     */
    getRarityColorString(rarity) {
        const rarityColors = {
            common: '#FFFFFF',     // 하얀색
            uncommon: '#00FF00',   // 녹색
            rare: '#0088FF',       // 파란색
            epic: '#AA00FF',       // 보라색
            legendary: '#FF8800',  // 주황색
            mythic: '#FF0000'      // 빨간색
        };
        
        return rarityColors[rarity] || '#FFFFFF';
    }
    
    /**
     * 희귀도 이름 가져오기
     * @param {string} rarity - 희귀도 키
     * @returns {string} 희귀도 이름
     */
    getRarityName(rarity) {
        const rarityNames = {
            common: '일반',
            uncommon: '고급',
            rare: '희귀',
            epic: '에픽',
            legendary: '전설',
            mythic: '신화'
        };
        
        return rarityNames[rarity] || '알 수 없음';
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 키보드 이벤트
        this.input.keyboard.on('keydown-ESC', () => {
            this.onBackButtonClick();
        });
        
        // 아이템 정렬 단축키
        this.input.keyboard.on('keydown-ONE', () => {
            this.onSortButtonClick('rarity');
        });
        
        this.input.keyboard.on('keydown-TWO', () => {
            this.onSortButtonClick('level');
        });
        
        this.input.keyboard.on('keydown-THREE', () => {
            this.onSortButtonClick('name');
        });
        
        this.input.keyboard.on('keydown-FOUR', () => {
            this.onSortButtonClick('type');
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
        this.input.keyboard.off('keydown-ESC');
        this.input.keyboard.off('keydown-ONE');
        this.input.keyboard.off('keydown-TWO');
        this.input.keyboard.off('keydown-THREE');
        this.input.keyboard.off('keydown-FOUR');
        
        // 게임 데이터 저장
        this.game.config.dataManager.saveGameData();
    }
}

export default Inventory;