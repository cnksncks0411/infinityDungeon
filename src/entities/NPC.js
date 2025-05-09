/**
 * Dungeon Loop 게임의 NPC(Non-Player Character) 클래스
 * 상인, 퀘스트 제공자, 기타 상호작용 가능한 캐릭터를 구현
 */
class NPC extends Phaser.Physics.Arcade.Sprite {
    /**
     * @param {Phaser.Scene} scene - NPC가 생성될 씬
     * @param {number} x - 초기 x 위치
     * @param {number} y - 초기 y 위치
     * @param {string} npcId - NPC의 고유 ID
     * @param {object} config - NPC 설정 (타입, 이름, 상호작용 등)
     */
    constructor(scene, x, y, npcId, config = {}) {
        // 기본 스프라이트로 초기화 (실제 texture는 loadNpcData 후 설정)
        super(scene, x, y, 'placeholder');

        this.scene = scene;
        this.npcId = npcId;

        // NPC 기본 정보
        this.npcType = config.type || 'merchant'; // merchant, quest_giver, healer, sage, etc.
        this.npcName = config.name || '이름 없는 NPC';
        this.dungeonLevel = config.dungeonLevel || 1;
        this.interactionRadius = config.interactionRadius || 80;
        this.interactionCooldown = 0;

        // NPC 타입별 특화 데이터 (상인의 재고, 퀘스트 제공자의 퀘스트 등)
        this.specialData = config.specialData || {};

        // 상호작용 표시기
        this.interactionIndicator = null;

        // 상태
        this.isInteractable = true;
        this.isInteracting = false;
        this.isBusy = false;
        this.dialogueState = null;

        // 물리 설정
        scene.physics.world.enable(this);
        scene.add.existing(this);
        this.body.setImmovable(true);
        this.body.setCollideWorldBounds(true);
        this.body.setSize(32, 32); // 기본 충돌 영역

        // 데이터 로드 및 초기화
        this.loadNpcData();
        this.createInteractionIndicator();
        this.setupAnimations();

        // 아이들 애니메이션 시작
        this.playIdleAnimation();
    }

    /**
     * NPC 데이터 로드
     */
    loadNpcData() {
        // 게임 데이터 매니저에서 NPC 정보 로드
        let npcData = null;

        // NPC 데이터 파일이 있다면 사용
        if (this.scene.cache.json.has('npcs')) {
            const npcsData = this.scene.cache.json.get('npcs');
            npcData = npcsData.find(npc => npc.id === this.npcId);
        }

        // 데이터가 없으면 기본값 사용
        if (!npcData) {
            this.setupDefaultNpcData();
            return;
        }

        // 데이터 적용
        this.npcName = npcData.name || this.npcName;
        this.npcType = npcData.type || this.npcType;
        this.dialogueData = npcData.dialogues || [];
        this.sprite = npcData.sprite || { key: 'npc_default', frameWidth: 32, frameHeight: 48 };

        // NPC 타입별 특화 데이터 설정
        this.setupSpecialData(npcData);

        // 스프라이트 설정
        this.setTexture(this.sprite.key);

        // 상호작용 반경 설정 (선택적)
        if (npcData.interactionRadius) {
            this.interactionRadius = npcData.interactionRadius;
        }
    }

    /**
     * 기본 NPC 데이터 설정
     */
    setupDefaultNpcData() {
        // NPC 타입별 기본 설정
        switch (this.npcType) {
            case 'merchant':
                this.sprite = { key: 'npc_merchant', frameWidth: 32, frameHeight: 48 };
                this.dialogueData = [
                    {
                        id: 'greeting',
                        text: '어서오세요! 좋은 물건 많이 있습니다.',
                        options: [
                            { text: '상점 보기', action: 'open_shop' },
                            { text: '나중에 올게요', action: 'close' }
                        ]
                    }
                ];
                // 기본 상점 재고
                this.specialData.inventory = this.generateMerchantInventory();
                this.specialData.buyRate = 0.5; // 판매 가격 비율
                this.specialData.sellRate = 1.2; // 구매 가격 비율
                break;

            case 'healer':
                this.sprite = { key: 'npc_healer', frameWidth: 32, frameHeight: 48 };
                this.dialogueData = [
                    {
                        id: 'greeting',
                        text: '상처를 치료해 드릴까요?',
                        options: [
                            { text: '치료해주세요 (50 골드)', action: 'heal' },
                            { text: '아니요, 괜찮습니다', action: 'close' }
                        ]
                    }
                ];
                this.specialData.healAmount = 0.7; // 최대 체력의 70% 회복
                this.specialData.healCost = 50; // 기본 치료 비용
                break;

            case 'sage':
                this.sprite = { key: 'npc_sage', frameWidth: 32, frameHeight: 48 };
                this.dialogueData = [
                    {
                        id: 'greeting',
                        text: '지식을 구하는 자여, 무엇이 궁금한가?',
                        options: [
                            { text: '이 던전에 대해 알려주세요', action: 'dungeon_info' },
                            { text: '몬스터에 대한 정보가 필요해요', action: 'monster_info' },
                            { text: '아이템에 대해 알려주세요', action: 'item_info' },
                            { text: '나중에 올게요', action: 'close' }
                        ]
                    }
                ];
                break;

            case 'quest_giver':
                this.sprite = { key: 'npc_quest', frameWidth: 32, frameHeight: 48 };
                this.dialogueData = [
                    {
                        id: 'greeting',
                        text: '모험가여, 도움이 필요하오.',
                        options: [
                            { text: '어떤 일이신가요?', action: 'quest_offer' },
                            { text: '지금은 바빠요', action: 'close' }
                        ]
                    }
                ];
                // 기본 퀘스트 정보
                this.specialData.quests = [
                    {
                        id: 'simple_hunt',
                        title: '사냥꾼의 임무',
                        description: '몬스터 3마리를 처치해주세요.',
                        targetType: 'kill',
                        targetCount: 3,
                        reward: {
                            gold: 100,
                            exp: 50,
                            items: []
                        },
                        status: 'available'
                    }
                ];
                break;

            default:
                this.sprite = { key: 'npc_default', frameWidth: 32, frameHeight: 48 };
                this.dialogueData = [
                    {
                        id: 'greeting',
                        text: '안녕하세요, 모험가님.',
                        options: [
                            { text: '안녕하세요', action: 'close' }
                        ]
                    }
                ];
        }

        // 스프라이트 설정
        this.setTexture(this.sprite.key);
    }

    /**
     * NPC 타입별 특화 데이터 설정
     * @param {object} npcData - NPC 데이터
     */
    setupSpecialData(npcData) {
        switch (this.npcType) {
            case 'merchant':
                // 상인 재고 설정
                if (npcData.inventory) {
                    this.specialData.inventory = npcData.inventory;
                } else {
                    this.specialData.inventory = this.generateMerchantInventory();
                }

                // 구매/판매 요율 설정
                this.specialData.buyRate = npcData.buyRate || 0.5;
                this.specialData.sellRate = npcData.sellRate || 1.2;
                break;

            case 'healer':
                // 치유사 설정
                this.specialData.healAmount = npcData.healAmount || 0.7;
                this.specialData.healCost = npcData.healCost || 50;
                break;

            case 'quest_giver':
                // 퀘스트 제공자 설정
                this.specialData.quests = npcData.quests || [];
                break;

            case 'sage':
                // 현자 설정 (던전 정보, 팁 등)
                this.specialData.knowledgeTopics = npcData.topics || [];
                break;

            case 'blacksmith':
                // 대장장이 설정
                this.specialData.upgradeRate = npcData.upgradeRate || 0.7;
                this.specialData.upgradeCosts = npcData.upgradeCosts || {
                    common: 50,
                    uncommon: 100,
                    rare: 200,
                    epic: 500,
                    legendary: 1000
                };
                break;

            case 'enchanter':
                // 마법부여사 설정
                this.specialData.enchantments = npcData.enchantments || [];
                this.specialData.enchantRate = npcData.enchantRate || 0.6;
                break;
        }
    }

    /**
     * 기본 상인 재고 생성
     * @returns {Array} 상인 재고 아이템 목록
     */
    generateMerchantInventory() {
        const inventory = [];

        // 던전 레벨에 따른 재고 품질
        const level = this.dungeonLevel || 1;

        // 기본 소비 아이템 (항상 보유)
        inventory.push(
            { id: 'potion_health_small', count: 5, price: 20 * level },
            { id: 'potion_mana_small', count: 5, price: 20 * level }
        );

        // 던전 레벨이 높을수록 더 좋은 소비 아이템 추가
        if (level >= 3) {
            inventory.push(
                { id: 'potion_health_medium', count: 3, price: 50 * (level - 2) },
                { id: 'potion_mana_medium', count: 3, price: 50 * (level - 2) }
            );
        }

        if (level >= 5) {
            inventory.push(
                { id: 'potion_health_large', count: 2, price: 100 * (level - 4) },
                { id: 'potion_mana_large', count: 2, price: 100 * (level - 4) }
            );
        }

        // 스크롤 (50% 확률로 등장)
        if (Math.random() < 0.5) {
            inventory.push({ id: 'scroll_identify', count: 2, price: 30 * level });
        }

        if (Math.random() < 0.3) {
            inventory.push({ id: 'scroll_teleport', count: 1, price: 80 * level });
        }

        // 던전 레벨에 따른 무기/방어구 (50% 확률로 등장)
        if (Math.random() < 0.5) {
            // 무기 타입 선택 (랜덤)
            const weaponTypes = ['sword', 'axe', 'staff', 'bow', 'dagger'];
            const selectedType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

            // 무기 품질 결정 (던전 레벨에 따라)
            let rarity = 'common';
            if (level >= 7) {
                // 레벨 7+ 던전에서 에픽 5%, 레어 15%, 언커먼 30%, 커먼 50% 확률
                const roll = Math.random();
                if (roll < 0.05) rarity = 'epic';
                else if (roll < 0.2) rarity = 'rare';
                else if (roll < 0.5) rarity = 'uncommon';
            } else if (level >= 4) {
                // 레벨 4+ 던전에서 레어 10%, 언커먼 30%, 커먼 60% 확률
                const roll = Math.random();
                if (roll < 0.1) rarity = 'rare';
                else if (roll < 0.4) rarity = 'uncommon';
            } else if (level >= 2) {
                // 레벨 2+ 던전에서 언커먼 20%, 커먼 80% 확률
                if (Math.random() < 0.2) rarity = 'uncommon';
            }

            // 무기 아이템 ID 생성
            const weaponId = `weapon_${selectedType}_${rarity}`;

            // 가격 설정 (레어리티와 레벨에 따라)
            let price = 50 * level; // 기본 가격
            if (rarity === 'uncommon') price *= 2;
            else if (rarity === 'rare') price *= 5;
            else if (rarity === 'epic') price *= 12;

            // 무기 추가
            inventory.push({ id: weaponId, count: 1, price: price });
        }

        // 방어구 (30% 확률로 등장)
        if (Math.random() < 0.3) {
            // 방어구 타입 선택 (랜덤)
            const armorTypes = ['helmet', 'chest', 'gloves', 'boots'];
            const selectedType = armorTypes[Math.floor(Math.random() * armorTypes.length)];

            // 방어구 품질 결정 (던전 레벨에 따라)
            let rarity = 'common';
            if (level >= 7) {
                const roll = Math.random();
                if (roll < 0.05) rarity = 'epic';
                else if (roll < 0.2) rarity = 'rare';
                else if (roll < 0.5) rarity = 'uncommon';
            } else if (level >= 4) {
                const roll = Math.random();
                if (roll < 0.1) rarity = 'rare';
                else if (roll < 0.4) rarity = 'uncommon';
            } else if (level >= 2) {
                if (Math.random() < 0.2) rarity = 'uncommon';
            }

            // 방어구 아이템 ID 생성
            const armorId = `armor_${selectedType}_${rarity}`;

            // 가격 설정 (레어리티와 레벨에 따라)
            let price = 40 * level; // 기본 가격
            if (rarity === 'uncommon') price *= 2;
            else if (rarity === 'rare') price *= 5;
            else if (rarity === 'epic') price *= 12;

            // 방어구 추가
            inventory.push({ id: armorId, count: 1, price: price });
        }

        return inventory;
    }

    /**
     * 상호작용 표시기 생성
     */
    createInteractionIndicator() {
        // 상호작용 표시기 (기본 비활성)
        this.interactionIndicator = this.scene.add.sprite(this.x, this.y - 50, 'interaction_indicator');
        this.interactionIndicator.setScale(0.7);
        this.interactionIndicator.setVisible(false);

        // 상하 움직임 애니메이션
        this.scene.tweens.add({
            targets: this.interactionIndicator,
            y: this.y - 55,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    /**
     * 애니메이션 설정
     */
    setupAnimations() {
        const key = this.sprite.key;

        // 이미 설정된 애니메이션이면 건너뜀
        if (this.scene.anims.exists(`${key}_idle`)) return;

        // 기본 애니메이션
        this.scene.anims.create({
            key: `${key}_idle`,
            frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
            frameRate: 5,
            repeat: -1
        });

        // 대화 애니메이션
        this.scene.anims.create({
            key: `${key}_talk`,
            frames: this.scene.anims.generateFrameNumbers(key, { start: 4, end: 7 }),
            frameRate: 8,
            repeat: -1
        });

        // 작업 애니메이션 (판매, 치유 등)
        this.scene.anims.create({
            key: `${key}_work`,
            frames: this.scene.anims.generateFrameNumbers(key, { start: 8, end: 11 }),
            frameRate: 8,
            repeat: -1
        });
    }

    /**
     * 게임 루프 업데이트
     */
    update(time, delta) {
        // 쿨다운 업데이트
        if (this.interactionCooldown > 0) {
            this.interactionCooldown -= delta;
        }

        // 플레이어와의 거리 확인 후 상호작용 표시기 업데이트
        this.updateInteractionIndicator();
    }

    /**
     * 상호작용 표시기 업데이트
     */
    updateInteractionIndicator() {
        // 플레이어 확인
        const player = this.scene.player;
        if (!player) return;

        // 상호작용 중이면 표시기 숨기기
        if (this.isInteracting) {
            this.interactionIndicator.setVisible(false);
            return;
        }

        // 플레이어와의 거리 계산
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            player.x, player.y
        );

        // 상호작용 가능 거리 내에 있으면 표시기 보이기
        if (distance <= this.interactionRadius && this.isInteractable) {
            this.interactionIndicator.setVisible(true);

            // 표시기 위치 업데이트
            this.interactionIndicator.x = this.x;
        } else {
            this.interactionIndicator.setVisible(false);
        }
    }

    /**
     * 대화 시작
     */
    startDialogue() {
        if (!this.isInteractable || this.isInteracting || this.interactionCooldown > 0) return false;

        // 대화 중 상태로 설정
        this.isInteracting = true;

        // 대화 애니메이션 재생
        this.playTalkAnimation();

        // 초기 대화 ID (기본: greeting)
        const initialDialogueId = 'greeting';

        // 대화 데이터 찾기
        const dialogue = this.findDialogueById(initialDialogueId);

        if (!dialogue) {
            console.warn(`Dialogue with ID ${initialDialogueId} not found for NPC ${this.npcId}`);
            this.endDialogue();
            return false;
        }

        // 대화 시스템 초기화
        this.dialogueState = {
            currentId: initialDialogueId,
            visitedNodes: []
        };

        // 대화 UI 표시 이벤트 발생
        this.scene.events.emit('npcDialogueStart', {
            npc: this,
            dialogue: dialogue,
            npcName: this.npcName
        });

        return true;
    }

    /**
     * ID로 대화 데이터 찾기
     * @param {string} dialogueId - 대화 ID
     * @returns {object|null} 대화 데이터 또는 null
     */
    findDialogueById(dialogueId) {
        if (!this.dialogueData || this.dialogueData.length === 0) return null;

        return this.dialogueData.find(d => d.id === dialogueId) || null;
    }

    /**
     * 대화 액션 처리
     * @param {string} action - 액션 ID
     * @param {object} data - 액션 관련 데이터
     */
    handleDialogueAction(action, data = {}) {
        // 대화 중이 아니면 무시
        if (!this.isInteracting) return;

        // 액션 방문 기록
        if (this.dialogueState) {
            this.dialogueState.visitedNodes.push(action);
        }

        // 액션 타입별 처리
        switch (action) {
            case 'close':
                // 대화 종료
                this.endDialogue();
                break;

            case 'open_shop':
                // 상점 열기
                this.openShop();
                break;

            case 'heal':
                // 체력 회복
                this.healPlayer();
                break;

            case 'upgrade':
                // 장비 강화
                this.upgradeItem(data.itemId);
                break;

            case 'quest_offer':
                // 퀘스트 제안
                this.offerQuest();
                break;

            case 'quest_complete':
                // 퀘스트 완료
                this.completeQuest(data.questId);
                break;

            case 'dungeon_info':
            case 'monster_info':
            case 'item_info':
                // 정보 제공
                this.provideInformation(action);
                break;

            default:
                // 다음 대화 노드로 이동
                if (action.startsWith('goto_')) {
                    const nextNodeId = action.substring(5);
                    this.showNextDialogue(nextNodeId);
                } else {
                    console.warn(`Unknown dialogue action: ${action}`);
                    this.endDialogue();
                }
        }
    }

    /**
     * 다음 대화 표시
     * @param {string} dialogueId - 대화 ID
     */
    showNextDialogue(dialogueId) {
        // 대화 데이터 찾기
        const dialogue = this.findDialogueById(dialogueId);

        if (!dialogue) {
            console.warn(`Dialogue with ID ${dialogueId} not found for NPC ${this.npcId}`);
            this.endDialogue();
            return;
        }

        // 대화 상태 업데이트
        if (this.dialogueState) {
            this.dialogueState.currentId = dialogueId;
        }

        // 대화 UI 업데이트 이벤트 발생
        this.scene.events.emit('npcDialogueNext', {
            npc: this,
            dialogue: dialogue,
            npcName: this.npcName
        });
    }

    /**
     * 대화 종료
     */
    endDialogue() {
        // 이미 대화 중이 아니면 무시
        if (!this.isInteracting) return;

        // 상태 업데이트
        this.isInteracting = false;
        this.dialogueState = null;

        // 기본 애니메이션으로 복귀
        this.playIdleAnimation();

        // 상호작용 쿨다운 설정 (0.5초)
        this.interactionCooldown = 500;

        // 대화 종료 이벤트 발생
        this.scene.events.emit('npcDialogueEnd', {
            npc: this
        });
    }

    /**
     * 상점 열기
     */
    openShop() {
        if (this.npcType !== 'merchant') {
            console.warn(`NPC ${this.npcId} is not a merchant`);
            this.endDialogue();
            return;
        }

        // 작업 애니메이션 재생
        this.playWorkAnimation();

        // 상점 UI 열기 이벤트 발생
        this.scene.events.emit('openMerchantShop', {
            npc: this,
            inventory: this.specialData.inventory,
            buyRate: this.specialData.buyRate,
            sellRate: this.specialData.sellRate
        });
    }

    /**
     * 플레이어 체력 회복
     */
    healPlayer() {
        if (this.npcType !== 'healer') {
            console.warn(`NPC ${this.npcId} is not a healer`);
            this.endDialogue();
            return;
        }

        // 플레이어 확인
        const player = this.scene.player;
        if (!player) {
            this.endDialogue();
            return;
        }

        // 체력이 이미 최대인지 확인
        if (player.stats.hp >= player.stats.maxHp) {
            // 회복이 필요 없는 경우 메시지 표시
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'already_healed',
                    text: '당신은 이미 건강해 보이는군요. 치유가 필요하지 않습니다.',
                    options: [{ text: '알겠습니다', action: 'close' }]
                },
                npcName: this.npcName
            });
            return;
        }

        // 골드 확인
        const healCost = this.specialData.healCost || 50;

        if (player.gold < healCost) {
            // 골드가 부족한 경우 메시지 표시
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'no_gold',
                    text: `치유 비용은 ${healCost} 골드입니다. 충분한 골드를 가져오세요.`,
                    options: [{ text: '알겠습니다', action: 'close' }]
                },
                npcName: this.npcName
            });
            return;
        }

        // 작업 애니메이션 재생
        this.playWorkAnimation();

        // 골드 차감
        player.gold -= healCost;

        // 체력 회복량 계산
        const healAmount = Math.floor(player.stats.maxHp * this.specialData.healAmount);

        // 체력 회복
        player.heal(healAmount);

        // 회복 완료 메시지
        this.scene.events.emit('npcDialogueNext', {
            npc: this,
            dialogue: {
                id: 'healed',
                text: `${healAmount}의 체력을 회복했습니다. 이제 건강해 보이는군요!`,
                options: [{ text: '감사합니다', action: 'close' }]
            },
            npcName: this.npcName
        });

        // 치유 이펙트 표시
        this.createHealEffect(player);
    }

    /**
     * 치유 이펙트 생성
     * @param {object} target - 치유 대상
     */
    createHealEffect(target) {
        if (!this.scene.add) return;

        // 파티클 효과 (초록색 빛)
        if (this.scene.particleManager) {
            this.scene.particleManager.createEmitter({
                x: target.x,
                y: target.y,
                speed: { min: 20, max: 40 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.5, end: 0 },
                blendMode: 'ADD',
                lifespan: 1000,
                tint: 0x00ff44,
                quantity: 20
            });
        }

        // 치유 효과음
        if (this.scene.sound && this.scene.sound.get) {
            const healSound = this.scene.sound.get('heal');
            if (healSound) healSound.play({ volume: 0.6 });
        }

        // 치유 텍스트 표시
        const healText = this.scene.add.text(
            target.x,
            target.y - 30,
            `+${target.stats.hp}`,
            {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#00ff44',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        healText.setOrigin(0.5);

        // 텍스트 애니메이션
        this.scene.tweens.add({
            targets: healText,
            y: healText.y - 50,
            alpha: 0,
            duration: 1500,
            onComplete: () => {
                healText.destroy();
            }
        });
    }

    /**
     * 아이템 강화
     * @param {string} itemId - 아이템 ID
     */
    upgradeItem(itemId) {
        if (this.npcType !== 'blacksmith') {
            console.warn(`NPC ${this.npcId} is not a blacksmith`);
            this.endDialogue();
            return;
        }

        // 플레이어 확인
        const player = this.scene.player;
        if (!player) {
            this.endDialogue();
            return;
        }

        // 아이템 확인
        const item = player.inventory.find(i => i.id === itemId);
        if (!item) {
            // 아이템이 없는 경우 메시지
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'no_item',
                    text: '그 아이템을 찾을 수 없습니다.',
                    options: [{ text: '알겠습니다', action: 'close' }]
                },
                npcName: this.npcName
            });
            return;
        }

        // 이미 최대 강화 레벨인지 확인
        const maxUpgradeLevel = 5;
        if (item.upgradeLevel >= maxUpgradeLevel) {
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'max_upgrade',
                    text: '이 아이템은 이미 최대로 강화되었습니다.',
                    options: [{ text: '알겠습니다', action: 'close' }]
                },
                npcName: this.npcName
            });
            return;
        }

        // 강화 비용 계산
        const upgradeCost = this.calculateUpgradeCost(item);

        // 골드 확인
        if (player.gold < upgradeCost) {
            // 골드가 부족한 경우
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'no_gold_upgrade',
                    text: `이 아이템을 강화하려면 ${upgradeCost} 골드가 필요합니다. 충분한 골드를 가져오세요.`,
                    options: [{ text: '알겠습니다', action: 'close' }]
                },
                npcName: this.npcName
            });
            return;
        }

        // 작업 애니메이션 재생
        this.playWorkAnimation();

        // 골드 차감
        player.gold -= upgradeCost;

        // 강화 성공 확률 계산
        const upgradeRate = this.specialData.upgradeRate || 0.7;
        const successRate = Math.max(0.1, upgradeRate - (item.upgradeLevel * 0.1));

        // 강화 시도 (성공/실패)
        if (Math.random() < successRate) {
            // 강화 성공
            item.upgradeLevel = (item.upgradeLevel || 0) + 1;

            // 아이템 스탯 향상
            this.applyUpgradeBonus(item);

            // 성공 메시지
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'upgrade_success',
                    text: `강화에 성공했습니다! ${item.name}(이)가 더 강력해졌습니다.`,
                    options: [{ text: '감사합니다', action: 'close' }]
                },
                npcName: this.npcName
            });

            // 성공 이펙트
            this.createUpgradeSuccessEffect();
        } else {
            // 강화 실패
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'upgrade_fail',
                    text: '안타깝게도 강화에 실패했습니다. 다시 시도해보세요.',
                    options: [{ text: '알겠습니다', action: 'close' }]
                },
                npcName: this.npcName
            });

            // 실패 이펙트
            this.createUpgradeFailEffect();
        }

        // 인벤토리 업데이트 이벤트
        this.scene.events.emit('inventoryUpdated', {
            inventory: player.inventory
        });
    }

    /**
     * 강화 비용 계산
     * @param {object} item - 아이템 객체
     * @returns {number} - 강화 비용
     */
    calculateUpgradeCost(item) {
        // 기본 비용 (레어리티별)
        const baseCost = this.specialData.upgradeCosts[item.rarity] || 100;

        // 현재 강화 레벨
        const currentLevel = item.upgradeLevel || 0;

        // 레벨에 따른 비용 증가 (2의 제곱으로 증가)
        return Math.floor(baseCost * Math.pow(2, currentLevel));
    }

    /**
     * 강화 보너스 적용
     * @param {object} item - 아이템 객체
     */
    applyUpgradeBonus(item) {
        // 아이템 타입에 따른 스탯 향상
        switch (item.type) {
            case 'weapon':
                // 무기는 공격력 증가
                item.stats.damage = Math.floor(item.stats.damage * 1.2);
                break;

            case 'armor':
                // 방어구는 방어력 증가
                item.stats.defense = Math.floor(item.stats.defense * 1.2);
                break;

            case 'accessory':
                // 악세서리는 특수 효과 강화
                if (item.effects) {
                    item.effects.forEach(effect => {
                        if (typeof effect.value === 'number') {
                            effect.value = parseFloat((effect.value * 1.15).toFixed(2));
                        }
                    });
                }
                break;
        }
    }

    /**
     * 강화 성공 이펙트
     */
    createUpgradeSuccessEffect() {
        if (!this.scene.add || !this.scene.tweens) return;

        // 빛나는 효과
        const glow = this.scene.add.ellipse(this.x, this.y, 100, 50, 0xffcc00);
        glow.setAlpha(0.7);

        // 애니메이션
        this.scene.tweens.add({
            targets: glow,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                glow.destroy();
            }
        });

        // 성공 효과음
        if (this.scene.sound && this.scene.sound.get) {
            const successSound = this.scene.sound.get('upgrade_success');
            if (successSound) successSound.play({ volume: 0.6 });
        }

        // 파티클 효과
        if (this.scene.particleManager) {
            this.scene.particleManager.createEmitter({
                x: this.x,
                y: this.y,
                speed: { min: 50, max: 100 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.6, end: 0 },
                blendMode: 'ADD',
                lifespan: 1500,
                quantity: 30,
                tint: 0xffcc00
            });
        }
    }

    /**
     * 강화 실패 이펙트
     */
    createUpgradeFailEffect() {
        if (!this.scene.add || !this.scene.tweens) return;

        // 연기 효과
        const smoke = this.scene.add.particles('smoke');
        const emitter = smoke.createEmitter({
            x: this.x,
            y: this.y,
            speed: { min: 20, max: 50 },
            angle: { min: 240, max: 300 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 1000,
            quantity: 20
        });

        // 잠시 후 파티클 제거
        this.scene.time.delayedCall(1500, () => {
            smoke.destroy();
        });

        // 실패 효과음
        if (this.scene.sound && this.scene.sound.get) {
            const failSound = this.scene.sound.get('upgrade_fail');
            if (failSound) failSound.play({ volume: 0.6 });
        }
    }

    /**
     * 퀘스트 제안
     */
    offerQuest() {
        if (this.npcType !== 'quest_giver') {
            console.warn(`NPC ${this.npcId} is not a quest giver`);
            this.endDialogue();
            return;
        }

        // 플레이어 확인
        const player = this.scene.player;
        if (!player) {
            this.endDialogue();
            return;
        }

        // 이용 가능한 퀘스트 찾기
        const availableQuests = this.specialData.quests.filter(q => q.status === 'available');

        if (availableQuests.length === 0) {
            // 이용 가능한 퀘스트가 없는 경우
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'no_quests',
                    text: '지금은 당신을 위한 일이 없습니다. 나중에 다시 오세요.',
                    options: [{ text: '알겠습니다', action: 'close' }]
                },
                npcName: this.npcName
            });
            return;
        }

        // 첫 번째 이용 가능한 퀘스트 선택
        const quest = availableQuests[0];

        // 퀘스트 대화 표시
        const questDialogue = {
            id: `quest_${quest.id}`,
            text: `${quest.description} 보상: ${quest.reward.gold} 골드, ${quest.reward.exp} 경험치`,
            options: [
                { text: '수락합니다', action: `accept_quest_${quest.id}` },
                { text: '지금은 못하겠습니다', action: 'close' }
            ]
        };

        // 대화 표시
        this.scene.events.emit('npcDialogueNext', {
            npc: this,
            dialogue: questDialogue,
            npcName: this.npcName
        });
    }

    /**
     * 퀘스트 수락
     * @param {string} questId - 퀘스트 ID
     */
    acceptQuest(questId) {
        // 플레이어 확인
        const player = this.scene.player;
        if (!player) {
            this.endDialogue();
            return;
        }

        // 퀘스트 찾기
        const quest = this.specialData.quests.find(q => q.id === questId);

        if (!quest) {
            console.warn(`Quest with ID ${questId} not found`);
            this.endDialogue();
            return;
        }

        // 퀘스트 상태 변경
        quest.status = 'active';

        // 플레이어 퀘스트 목록에 추가
        if (!player.activeQuests) player.activeQuests = [];
        player.activeQuests.push({
            id: quest.id,
            giver: this.npcId,
            progress: 0,
            targetCount: quest.targetCount
        });

        // 수락 메시지
        this.scene.events.emit('npcDialogueNext', {
            npc: this,
            dialogue: {
                id: 'quest_accepted',
                text: '임무를 수락해주셔서 감사합니다. 완료되면 저에게 돌아와주세요.',
                options: [{ text: '알겠습니다', action: 'close' }]
            },
            npcName: this.npcName
        });

        // 퀘스트 수락 이벤트
        this.scene.events.emit('questAccepted', {
            questId: quest.id,
            giverId: this.npcId,
            quest: quest
        });
    }

    /**
     * 퀘스트 완료
     * @param {string} questId - 퀘스트 ID
     */
    completeQuest(questId) {
        // 플레이어 확인
        const player = this.scene.player;
        if (!player) {
            this.endDialogue();
            return;
        }

        // 플레이어 퀘스트 찾기
        const playerQuest = player.activeQuests ?
            player.activeQuests.find(q => q.id === questId) : null;

        if (!playerQuest) {
            console.warn(`Player does not have active quest with ID ${questId}`);
            this.endDialogue();
            return;
        }

        // 퀘스트 완료 조건 확인
        if (playerQuest.progress < playerQuest.targetCount) {
            // 미완료 상태
            this.scene.events.emit('npcDialogueNext', {
                npc: this,
                dialogue: {
                    id: 'quest_incomplete',
                    text: `아직 임무를 완료하지 않았습니다. 진행 상황: ${playerQuest.progress}/${playerQuest.targetCount}`,
                    options: [{ text: '알겠습니다', action: 'close' }]
                },
                npcName: this.npcName
            });
            return;
        }

        // NPC의 퀘스트 찾기
        const quest = this.specialData.quests.find(q => q.id === questId);

        if (!quest) {
            console.warn(`Quest with ID ${questId} not found in NPC ${this.npcId}`);
            this.endDialogue();
            return;
        }

        // 작업 애니메이션 재생
        this.playWorkAnimation();

        // 퀘스트 상태 변경
        quest.status = 'completed';

        // 플레이어 퀘스트 목록에서 제거
        player.activeQuests = player.activeQuests.filter(q => q.id !== questId);

        // 보상 지급
        player.gold += quest.reward.gold;

        // 경험치 이벤트 발생
        this.scene.events.emit('experienceGain', {
            amount: quest.reward.exp,
            source: 'quest'
        });

        // 아이템 보상이 있으면 지급
        if (quest.reward.items && quest.reward.items.length > 0) {
            quest.reward.items.forEach(itemId => {
                this.scene.events.emit('addItemToInventory', {
                    itemId: itemId
                });
            });
        }

        // 완료 메시지
        this.scene.events.emit('npcDialogueNext', {
            npc: this,
            dialogue: {
                id: 'quest_completed',
                text: `훌륭하게 임무를 완수했군요! 보상으로 ${quest.reward.gold} 골드와 ${quest.reward.exp} 경험치를 드립니다.`,
                options: [{ text: '감사합니다', action: 'close' }]
            },
            npcName: this.npcName
        });

        // 퀘스트 완료 이벤트
        this.scene.events.emit('questCompleted', {
            questId: quest.id,
            giverId: this.npcId,
            rewards: quest.reward
        });

        // 보상 이펙트
        this.createQuestRewardEffect();
    }

    /**
     * 퀘스트 보상 이펙트
     */
    createQuestRewardEffect() {
        if (!this.scene.add || !this.scene.tweens) return;

        // 효과음
        if (this.scene.sound && this.scene.sound.get) {
            const questSound = this.scene.sound.get('quest_complete');
            if (questSound) questSound.play({ volume: 0.6 });
        }

        // 플레이어 위치에 파티클 효과
        const player = this.scene.player;
        if (player && this.scene.particleManager) {
            this.scene.particleManager.createEmitter({
                x: player.x,
                y: player.y,
                speed: { min: 30, max: 80 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.7, end: 0 },
                blendMode: 'ADD',
                lifespan: 2000,
                quantity: 40,
                tint: [0xffcc00, 0xffffff, 0x00ffcc]
            });
        }

        // "임무 완료!" 텍스트 표시
        const completeText = this.scene.add.text(
            this.x,
            this.y - 70,
            '임무 완료!',
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#ffcc00',
                stroke: '#000000',
                strokeThickness: 4
            }
        );
        completeText.setOrigin(0.5);

        // 텍스트 애니메이션
        this.scene.tweens.add({
            targets: completeText,
            y: completeText.y - 50,
            alpha: 0,
            scale: 1.5,
            duration: 2000,
            onComplete: () => {
                completeText.destroy();
            }
        });
    }

    /**
     * 정보 제공
     * @param {string} infoType - 정보 유형
     */
    provideInformation(infoType) {
        if (this.npcType !== 'sage') {
            console.warn(`NPC ${this.npcId} is not a sage`);
            this.endDialogue();
            return;
        }

        // 대화 애니메이션 계속 재생
        this.playTalkAnimation();

        // 정보 유형에 따른 텍스트
        let infoText = '';
        let infoOptions = [];

        switch (infoType) {
            case 'dungeon_info':
                // 현재 던전 정보 (던전 씬에서 정보 가져오기)
                const dungeonName = this.scene.dungeonName || '미지의 던전';
                const dungeonLevel = this.scene.dungeonLevel || 1;

                infoText = `이곳은 ${dungeonName} 레벨 ${dungeonLevel}입니다. 조심하세요. 이 던전은 위험한 몬스터가 존재하며, 어두운 곳에서는 더 강력한 적이 나타날 수 있습니다.`;
                infoOptions = [
                    { text: '몬스터에 대해 더 알려주세요', action: 'monster_info' },
                    { text: '아이템에 대해 알려주세요', action: 'item_info' },
                    { text: '충분합니다, 감사합니다', action: 'close' }
                ];
                break;

            case 'monster_info':
                // 던전에 출현하는 몬스터 정보
                infoText = '이 던전에는 여러 위험한 몬스터가 서식하고 있습니다. 일반 몬스터보다 엘리트 몬스터는 더 강력하며, 특별한 능력을 가지고 있습니다. 보스는 던전 깊은 곳에 있으며, 상당한 준비 없이는 도전하기 어렵습니다.';
                infoOptions = [
                    { text: '던전에 대해 더 알려주세요', action: 'dungeon_info' },
                    { text: '아이템에 대해 알려주세요', action: 'item_info' },
                    { text: '충분합니다, 감사합니다', action: 'close' }
                ];
                break;

            case 'item_info':
                // 아이템 정보
                infoText = '던전에서는 다양한 아이템을 발견할 수 있습니다. 무기와 방어구는 희귀도에 따라 성능이 크게 달라집니다. 소비 아이템은 위기 상황에서 유용하게 사용할 수 있으니 항상 몇 개씩 가지고 다니는 것이 좋습니다.';
                infoOptions = [
                    { text: '던전에 대해 더 알려주세요', action: 'dungeon_info' },
                    { text: '몬스터에 대해 더 알려주세요', action: 'monster_info' },
                    { text: '충분합니다, 감사합니다', action: 'close' }
                ];
                break;

            default:
                infoText = '무엇을 알고 싶으신가요?';
                infoOptions = [
                    { text: '던전에 대해 알려주세요', action: 'dungeon_info' },
                    { text: '몬스터에 대해 알려주세요', action: 'monster_info' },
                    { text: '아이템에 대해 알려주세요', action: 'item_info' },
                    { text: '괜찮습니다', action: 'close' }
                ];
        }

        // 대화 UI 업데이트
        this.scene.events.emit('npcDialogueNext', {
            npc: this,
            dialogue: {
                id: `info_${infoType}`,
                text: infoText,
                options: infoOptions
            },
            npcName: this.npcName
        });
    }

    /**
     * 아이들 애니메이션 재생
     */
    playIdleAnimation() {
        const key = this.sprite.key;
        this.play(`${key}_idle`);
    }

    /**
     * 대화 애니메이션 재생
     */
    playTalkAnimation() {
        const key = this.sprite.key;
        this.play(`${key}_talk`);
    }

    /**
     * 작업 애니메이션 재생
     */
    playWorkAnimation() {
        const key = this.sprite.key;
        this.play(`${key}_work`);
    }

    /**
     * 플레이어와 상호작용 처리
     * @returns {boolean} 상호작용 성공 여부
     */
    interact() {
        // 상호작용 불가능 상태면 무시
        if (!this.isInteractable || this.interactionCooldown > 0) return false;

        // 이미 상호작용 중이면 액션 처리 (대화 시스템에서 처리됨)
        if (this.isInteracting) return true;

        // 상호작용 시작 (대화 시작)
        return this.startDialogue();
    }

    /**
     * NPC 비활성화 (던전 종료 등 상황에서 호출)
     */
    disable() {
        // 상호작용 불가능 상태로 설정
        this.isInteractable = false;

        // 상호작용 중이면 강제 종료
        if (this.isInteracting) {
            this.endDialogue();
        }

        // 상호작용 표시기 숨기기
        if (this.interactionIndicator) {
            this.interactionIndicator.setVisible(false);
        }
    }

    /**
     * NPC 활성화
     */
    enable() {
        // 상호작용 가능 상태로 설정
        this.isInteractable = true;
    }

    /**
     * 객체 정리 (씬 종료 시 호출)
     */
    destroy() {
        // 대화 중이면 강제 종료
        if (this.isInteracting) {
            this.endDialogue();
        }

        // 상호작용 표시기 제거
        if (this.interactionIndicator) {
            this.interactionIndicator.destroy();
        }

        // 스프라이트 제거
        super.destroy();
    }
}

export default NPC;