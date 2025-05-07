/**
 * Combat.js
 * 
 * 던전 루프의 전투 시스템을 관리하는 씬입니다.
 * 플레이어-적 간 전투, 스킬 사용, 대미지 계산, 상태효과를 처리합니다.
 */
class Combat extends Phaser.Scene {
    constructor() {
        super({
            key: 'Combat'
        });

        // 전투 관련 속성
        this.player = null;           // 플레이어 객체
        this.enemies = [];            // 현재 적 목록
        this.currentTurn = 'player';  // 현재 턴 (player/enemy)
        this.targetEnemy = null;      // 현재 대상 적
        this.combatState = 'idle';    // 전투 상태 (idle/action/result)
        this.enemyAttackQueue = [];   // 적 공격 큐
        this.actionInProgress = false; // 액션 진행 중 플래그
        
        // 시스템 컴포넌트
        this.classSystem = null;      // 클래스 시스템 
        this.effectsManager = null;   // 효과 관리자
        this.hud = null;              // HUD
        this.dialogueSystem = null;   // 대화 시스템
        
        // 전투 결과
        this.combatResults = {
            exp: 0,
            gold: 0,
            items: [],
            victory: false,
            playerDamageDealt: 0,
            enemiesDefeated: 0,
            criticalHits: 0,
            turnCount: 0,
            skillsUsed: 0
        };
        
        // 전투 배경
        this.background = null;
        
        // 결과 보상 
        this.rewards = {
            experience: 0,
            gold: 0,
            items: []
        };
        
        // 전투 데이터
        this.battleData = {
            dungeonId: null,
            roomType: 'normal',
            enemyData: [],
            isBossBattle: false,
            difficulty: 1
        };
        
        // UI 컨테이너
        this.actionContainer = null;
        this.battleMessageContainer = null;
        
        // 음향
        this.bgMusic = null;
    }

    /**
     * 씬 초기화
     * @param {Object} data - 전달 데이터 (적 정보, 던전 정보 등)
     */
    init(data) {
        // 전투 데이터 초기화
        this.battleData = {
            dungeonId: data.dungeonId || null,
            roomType: data.roomType || 'normal',
            enemyData: data.enemies || [],
            isBossBattle: data.isBossBattle || false,
            difficulty: data.difficulty || 1,
            returnScene: data.returnScene || 'DungeonScene'
        };
        
        // 전투 결과 초기화
        this.resetCombatResults();
        
        // 전투 상태 초기화
        this.currentTurn = 'player';
        this.combatState = 'idle';
        this.actionInProgress = false;
        this.enemyAttackQueue = [];
        
        console.log('Combat scene initialized with battle data:', this.battleData);
    }

    /**
     * 필요한 에셋 로드
     */
    preload() {
        // 전투 관련 추가 에셋이 필요한 경우 여기서 로드
    }

    /**
     * 전투 씬 생성
     */
    create() {
        // 시스템 초기화
        this.initSystems();
        
        // 배경 설정
        this.createBackground();
        
        // 음악 설정
        this.setupMusic();
        
        // 플레이어 생성
        this.createPlayer();
        
        // 적 생성
        this.createEnemies();
        
        // UI 및 HUD 생성
        this.createUI();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 전투 시작 효과 및 메시지
        this.startBattleSequence();
        
        // 카메라 페이드 인
        this.cameras.main.fadeIn(500);
    }

    /**
     * 시스템 초기화
     */
    initSystems() {
        // 클래스 시스템 초기화
        this.classSystem = new ClassSystem(this);
        
        // 효과 매니저 초기화
        this.effectsManager = new EffectsManager(this);
        
        // HUD 초기화
        this.hud = new HUD(this);
        
        // 대화 시스템 초기화
        this.dialogueSystem = new Dialogue(this);
    }

    /**
     * 배경 생성
     */
    createBackground() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 던전 타입에 따른 배경 선택
        let bgKey = 'battle-bg-forest';
        if (this.battleData.dungeonId) {
            const dungeonType = this.getDungeonType(this.battleData.dungeonId);
            switch (dungeonType) {
                case 'forest':
                    bgKey = 'battle-bg-forest';
                    break;
                case 'tower':
                    bgKey = 'battle-bg-tower';
                    break;
                case 'cave':
                    bgKey = 'battle-bg-cave';
                    break;
                case 'castle':
                    bgKey = 'battle-bg-castle';
                    break;
            }
        }
        
        // 배경 이미지
        this.background = this.add.image(0, 0, bgKey);
        this.background.setOrigin(0, 0);
        this.background.setDisplaySize(width, height);
        
        // 바닥
        const floorY = height * 0.75;
        this.floor = this.add.graphics();
        this.floor.fillStyle(0x000000, 0.4);
        this.floor.fillRect(0, floorY, width, height - floorY);
        
        // 보스전 효과 (보스전인 경우)
        if (this.battleData.isBossBattle) {
            // 붉은 오버레이 효과
            const overlay = this.add.graphics();
            overlay.fillStyle(0xFF0000, 0.1);
            overlay.fillRect(0, 0, width, height);
            
            // 안개 효과
            this.fogParticles = this.add.particles('fog');
            this.fogEmitter = this.fogParticles.createEmitter({
                x: { min: 0, max: width },
                y: { min: height * 0.6, max: height * 0.8 },
                scale: { start: 0.5, end: 0.2 },
                alpha: { start: 0.3, end: 0 },
                speed: 20,
                angle: { min: -5, max: 5 },
                lifespan: 4000,
                frequency: 500
            });
        }
    }

    /**
     * 음악 설정
     */
    setupMusic() {
        // 기존 음악 정지
        if (this.sound.get('current-bg-music')) {
            this.sound.get('current-bg-music').stop();
        }
        
        // 전투 음악 선택
        let musicKey = 'battle-normal';
        
        if (this.battleData.isBossBattle) {
            musicKey = 'battle-boss';
        } else if (this.battleData.roomType === 'challenge') {
            musicKey = 'battle-challenge';
        }
        
        // 음악 재생
        this.bgMusic = this.sound.add(musicKey, {
            volume: 0.5,
            loop: true
        });
        this.bgMusic.play();
        this.bgMusic.setVolume(this.game.config.get('audio', 'musicVolume', 0.5));
        
        // 음악 참조 저장 (다른 씬으로 전환 시 정지하기 위함)
        this.sound.add('current-bg-music', {
            volume: 0,
            loop: false,
            mute: true
        });
    }

    /**
     * 플레이어 생성
     */
    createPlayer() {
        // 플레이어 위치 (왼쪽)
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const x = width * 0.25;
        const y = height * 0.65;
        
        // 플레이어 데이터 가져오기
        const playerData = this.game.config.dataManager.getPlayerData();
        const classData = this.game.config.dataManager.getCurrentClassData();
        
        // 플레이어 객체 생성
        this.player = {
            sprite: this.add.sprite(x, y, 'character', 0),
            data: playerData,
            classData: classData,
            animation: null,
            statsBar: null,
            nameText: null,
            x: x,
            y: y,
            health: playerData.stats.hp,
            maxHealth: playerData.stats.hp,
            mana: playerData.stats.mp,
            maxMana: playerData.stats.mp,
            stats: { ...playerData.stats },
            statusEffects: [],
            skills: [...classData.abilities],
            ultimateSkill: classData.ultimateSkill,
            equipment: playerData.equipment
        };
        
        // 플레이어 스프라이트 설정
        this.player.sprite.setScale(2);
        this.player.sprite.setOrigin(0.5, 1);
        
        // 플레이어 애니메이션 생성
        this.createPlayerAnimations();
        
        // 플레이어 정보 UI
        this.createPlayerInfoUI();
        
        // 기본 대기 애니메이션 재생
        this.player.sprite.play('player-idle');
    }

    /**
     * 플레이어 애니메이션 생성
     */
    createPlayerAnimations() {
        // 이미 애니메이션이 있으면 생성 스킵
        if (this.anims.exists('player-idle')) return;
        
        // 기본 클래스별 스프라이트 인덱스
        const classToFrame = {
            'warrior': 0,
            'archer': 1,
            'mage': 2,
            'thief': 3,
            'spearman': 4,
            'monk': 5,
            'cleric': 6,
            'hunter': 7
        };
        
        // 현재 클래스에 따른 프레임 인덱스
        const classId = this.player.classData.id;
        const baseFrame = classToFrame[classId] || 0;
        
        // 대기 애니메이션
        this.anims.create({
            key: 'player-idle',
            frames: this.anims.generateFrameNumbers('character', { 
                start: baseFrame * 8, 
                end: baseFrame * 8 + 3 
            }),
            frameRate: 5,
            repeat: -1
        });
        
        // 공격 애니메이션
        this.anims.create({
            key: 'player-attack',
            frames: this.anims.generateFrameNumbers('character', { 
                start: baseFrame * 8 + 4, 
                end: baseFrame * 8 + 5 
            }),
            frameRate: 8,
            repeat: 0
        });
        
        // 피격 애니메이션
        this.anims.create({
            key: 'player-hit',
            frames: this.anims.generateFrameNumbers('character', { 
                start: baseFrame * 8 + 6, 
                end: baseFrame * 8 + 6 
            }),
            frameRate: 4,
            repeat: 0
        });
        
        // 승리 애니메이션
        this.anims.create({
            key: 'player-victory',
            frames: this.anims.generateFrameNumbers('character', { 
                start: baseFrame * 8 + 7, 
                end: baseFrame * 8 + 7 
            }),
            frameRate: 4,
            repeat: 0
        });
    }

    /**
     * 플레이어 정보 UI 생성
     */
    createPlayerInfoUI() {
        const x = this.player.x;
        const y = this.player.y - this.player.sprite.height - 20;
        
        // 이름 텍스트
        this.player.nameText = this.add.text(x, y - 30, `Lv.${this.player.data.level} ${this.player.classData.name}`, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);
        
        // 체력 바
        const healthBar = this.add.graphics();
        healthBar.fillStyle(0x00AA00, 1);
        healthBar.fillRect(-50, 0, 100 * (this.player.health / this.player.maxHealth), 12);
        healthBar.lineStyle(1, 0xFFFFFF, 1);
        healthBar.strokeRect(-50, 0, 100, 12);
        
        // 마나 바
        const manaBar = this.add.graphics();
        manaBar.fillStyle(0x0066CC, 1);
        manaBar.fillRect(-50, 15, 100 * (this.player.mana / this.player.maxMana), 8);
        manaBar.lineStyle(1, 0xFFFFFF, 1);
        manaBar.strokeRect(-50, 15, 100, 8);
        
        // HP/MP 텍스트
        const hpText = this.add.text(0, 6, `${this.player.health}/${this.player.maxHealth}`, {
            fontSize: '10px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5, 0.5);
        
        const mpText = this.add.text(0, 19, `${this.player.mana}/${this.player.maxMana}`, {
            fontSize: '8px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5, 0.5);
        
        // 상태바 컨테이너
        this.player.statsBar = this.add.container(x, y);
        this.player.statsBar.add([healthBar, manaBar, hpText, mpText]);
        
        // 상태 효과 아이콘 위치 설정
        this.player.statusIconsX = x;
        this.player.statusIconsY = y + 30;
        this.player.statusIcons = [];
    }

    /**
     * 적 생성
     */
    createEnemies() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 적 배열 초기화
        this.enemies = [];
        
        // 적 데이터가 없으면 기본 적 생성 (디버깅용)
        if (!this.battleData.enemyData || this.battleData.enemyData.length === 0) {
            this.battleData.enemyData = [
                { id: 'goblin', level: 1 }
            ];
        }
        
        // 적 위치 계산
        const enemyCount = this.battleData.enemyData.length;
        const spacing = Math.min(150, width * 0.15);
        const startX = width * 0.75 - ((enemyCount - 1) * spacing / 2);
        const y = height * 0.65;
        
        // 적 객체 생성
        for (let i = 0; i < enemyCount; i++) {
            const enemyData = this.battleData.enemyData[i];
            const x = startX + (i * spacing);
            
            // 적 몬스터 데이터 로드
            const monsterData = this.getMonsterData(enemyData.id);
            if (!monsterData) continue;
            
            // 난이도에 따른 적 스탯 조정
            const level = enemyData.level || 1;
            const stats = this.calculateMonsterStats(monsterData, level, this.battleData.difficulty);
            
            // 보스 특별 처리
            const isBoss = monsterData.type === 'boss' || !!enemyData.isBoss;
            const scale = isBoss ? 2.5 : monsterData.type === 'elite' ? 1.8 : 1.5;
            
            // 적 객체 생성
            const enemy = {
                id: enemyData.id,
                name: monsterData.name,
                sprite: this.add.sprite(x, y, 'monsters', monsterData.sprite.key),
                data: monsterData,
                level: level,
                x: x,
                y: y,
                health: stats.hp,
                maxHealth: stats.hp,
                stats: stats,
                statusEffects: [],
                isBoss: isBoss,
                isElite: monsterData.type === 'elite',
                isDead: false,
                attackType: monsterData.attackType,
                element: monsterData.element,
                abilities: monsterData.abilities || [],
                animation: null,
                statsBar: null,
                nameText: null,
                statusIcons: []
            };
            
            // 스프라이트 설정
            enemy.sprite.setScale(scale);
            enemy.sprite.setOrigin(0.5, 1);
            
            // 적 애니메이션 생성
            this.createEnemyAnimations(enemy);
            
            // 적 정보 UI
            this.createEnemyInfoUI(enemy);
            
            // 기본 대기 애니메이션 재생
            enemy.sprite.play(`${enemy.id}-idle`);
            
            // 배열에 추가
            this.enemies.push(enemy);
        }
        
        // 처음 대상 적 설정
        if (this.enemies.length > 0) {
            this.targetEnemy = this.enemies[0];
            this.highlightTargetEnemy();
        }
    }

    /**
     * 적 애니메이션 생성
     * @param {Object} enemy - 적 객체
     */
    createEnemyAnimations(enemy) {
        const monsterId = enemy.id;
        const frameInfo = enemy.data.sprite;
        
        // 기본 프레임
        const baseFrame = frameInfo.key;
        
        // 애니메이션 키가 이미 존재하면 생성 스킵
        if (this.anims.exists(`${monsterId}-idle`)) return;
        
        // 프레임 정보가 없으면 기본값 설정
        const frameWidth = frameInfo.frameWidth || 64;
        const frameHeight = frameInfo.frameHeight || 64;
        
        // 아틀라스 설정
        this.anims.create({
            key: `${monsterId}-idle`,
            frames: this.anims.generateFrameNumbers('monsters', { 
                start: baseFrame, 
                end: baseFrame + 2 
            }),
            frameRate: 5,
            repeat: -1
        });
        
        this.anims.create({
            key: `${monsterId}-attack`,
            frames: this.anims.generateFrameNumbers('monsters', { 
                start: baseFrame + 3, 
                end: baseFrame + 5 
            }),
            frameRate: 8,
            repeat: 0
        });
        
        this.anims.create({
            key: `${monsterId}-hit`,
            frames: this.anims.generateFrameNumbers('monsters', { 
                start: baseFrame + 6, 
                end: baseFrame + 6 
            }),
            frameRate: 4,
            repeat: 0
        });
        
        this.anims.create({
            key: `${monsterId}-death`,
            frames: this.anims.generateFrameNumbers('monsters', { 
                start: baseFrame + 7, 
                end: baseFrame + 9 
            }),
            frameRate: 6,
            repeat: 0
        });
    }

    /**
     * 적 정보 UI 생성
     * @param {Object} enemy - 적 객체
     */
    createEnemyInfoUI(enemy) {
        const x = enemy.x;
        const y = enemy.y - enemy.sprite.height - 20;
        
        // 이름 텍스트
        let namePrefix = '';
        if (enemy.isBoss) {
            namePrefix = '👑 ';
        } else if (enemy.isElite) {
            namePrefix = '🔶 ';
        }
        
        enemy.nameText = this.add.text(x, y - 30, `${namePrefix}Lv.${enemy.level} ${enemy.name}`, {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: enemy.isBoss ? '#FF0000' : (enemy.isElite ? '#FFD700' : '#FFFFFF'),
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);
        
        // 체력 바
        const healthBar = this.add.graphics();
        const barWidth = enemy.isBoss ? 150 : 80;
        
        healthBar.fillStyle(0xAA0000, 1);
        healthBar.fillRect(-barWidth/2, 0, barWidth * (enemy.health / enemy.maxHealth), 10);
        healthBar.lineStyle(1, 0xFFFFFF, 1);
        healthBar.strokeRect(-barWidth/2, 0, barWidth, 10);
        
        // HP 텍스트
        const hpText = this.add.text(0, 5, `${enemy.health}/${enemy.maxHealth}`, {
            fontSize: '9px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5, 0.5);
        
        // 상태바 컨테이너
        enemy.statsBar = this.add.container(x, y);
        enemy.statsBar.add([healthBar, hpText]);
        
        // 적 상태효과 아이콘 위치
        enemy.statusIconsX = x;
        enemy.statusIconsY = y + 15;
        enemy.statusIcons = [];
        
        // 대상 테두리
        enemy.targetBorder = this.add.graphics();
    }

    /**
     * UI 생성
     */
    createUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 액션 버튼 컨테이너
        this.actionContainer = this.add.container(width / 2, height - 120);
        
        // 전투 메시지 컨테이너
        this.battleMessageContainer = this.add.container(width / 2, height / 2 - 50);
        this.battleMessageContainer.setDepth(1000); // 항상 위에 표시
        
        // 기본 메시지 박스 (처음에는 숨김)
        const messageBg = this.add.graphics();
        messageBg.fillStyle(0x000000, 0.7);
        messageBg.fillRoundedRect(-200, -30, 400, 60, 10);
        messageBg.lineStyle(2, 0xFFFFFF, 0.8);
        messageBg.strokeRoundedRect(-200, -30, 400, 60, 10);
        
        const messageText = this.add.text(0, 0, '', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5, 0.5);
        
        this.battleMessageContainer.add([messageBg, messageText]);
        this.battleMessageContainer.messageText = messageText;
        this.battleMessageContainer.visible = false;
        
        // 전투 콘트롤 UI 생성
        this.createBattleControlsUI();
        
        // 일시정지 버튼
        const pauseButton = this.add.image(width - 30, 30, 'ui_icons', 'pause')
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => {
                this.pauseGame();
            })
            .setScale(0.8);
    }

    /**
     * 전투 콘트롤 UI 생성
     */
    createBattleControlsUI() {
        // 액션 버튼 배경
        const actionBg = this.add.graphics();
        actionBg.fillStyle(0x000000, 0.7);
        actionBg.fillRoundedRect(-300, -80, 600, 160, 15);
        actionBg.lineStyle(2, 0x333333, 0.8);
        actionBg.strokeRoundedRect(-300, -80, 600, 160, 15);
        this.actionContainer.add(actionBg);
        
        // 기본 공격 버튼
        const attackButton = this.createActionButton(-200, -40, '기본 공격', 0xCC0000, () => {
            this.executePlayerAttack();
        });
        
        // 스킬 버튼 생성
        let skillX = -60;
        this.skillButtons = [];
        
        for (let i = 0; i < Math.min(this.player.skills.length, 3); i++) {
            const skill = this.player.skills[i];
            const skillButton = this.createActionButton(skillX, -40, skill.name, 0x0066CC, () => {
                this.executePlayerSkill(skill);
            });
            skillButton.skill = skill;
            
            // 스킬 비용 텍스트
            const costText = this.add.text(skillX, -20, `MP: ${skill.manaCost}`, {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#AAAAFF'
            }).setOrigin(0.5, 0.5);
            
            // 스킬 쿨다운 오버레이 (초기에는 숨김)
            const cooldownOverlay = this.add.graphics();
            cooldownOverlay.fillStyle(0x000000, 0.7);
            cooldownOverlay.fillRoundedRect(skillX - 60, -40 - 25, 120, 50, 5);
            cooldownOverlay.visible = false;
            
            const cooldownText = this.add.text(skillX, -40, '', {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5, 0.5);
            cooldownText.visible = false;
            
            this.actionContainer.add([costText, cooldownOverlay, cooldownText]);
            skillButton.costText = costText;
            skillButton.cooldownOverlay = cooldownOverlay;
            skillButton.cooldownText = cooldownText;
            
            this.skillButtons.push(skillButton);
            skillX += 140;
        }
        
        // 궁극기 버튼 (있는 경우)
        if (this.player.ultimateSkill) {
            const ultSkill = this.player.ultimateSkill;
            const ultButton = this.createActionButton(0, 20, ultSkill.name, 0xFF6600, () => {
                this.executePlayerUltimateSkill();
            });
            
            // 궁극기 비용 텍스트
            const ultCostText = this.add.text(0, 40, `MP: ${ultSkill.manaCost}`, {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFAA66'
            }).setOrigin(0.5, 0.5);
            
            // 궁극기 쿨다운 오버레이 (초기에는 숨김)
            const ultCooldownOverlay = this.add.graphics();
            ultCooldownOverlay.fillStyle(0x000000, 0.7);
            ultCooldownOverlay.fillRoundedRect(-65, 20 - 25, 130, 50, 5);
            ultCooldownOverlay.visible = false;
            
            const ultCooldownText = this.add.text(0, 20, '', {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                color: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5, 0.5);
            ultCooldownText.visible = false;
            
            this.actionContainer.add([ultCostText, ultCooldownOverlay, ultCooldownText]);
            ultButton.costText = ultCostText;
            ultButton.cooldownOverlay = ultCooldownOverlay;
            ultButton.cooldownText = ultCooldownText;
            
            this.ultimateButton = ultButton;
        }
        
        // 아이템 버튼
        const itemButton = this.createActionButton(-140, 20, '아이템', 0x33AA33, () => {
            this.showItemMenu();
        });
        
        // 방어 버튼
        const defendButton = this.createActionButton(140, 20, '방어', 0x555555, () => {
            this.executePlayerDefend();
        });
        
        // 도망 버튼 (일반 전투에만 표시)
        if (!this.battleData.isBossBattle) {
            const fleeButton = this.createActionButton(250, -40, '도망', 0x7777AA, () => {
                this.attemptFlee();
            });
        }
}

/**
 * 액션 버튼 생성
 * @param {number} x - x 위치 
 * @param {number} y - y 위치
 * @param {string} text - 버튼 텍스트
 * @param {number} color - 버튼 색상
 * @param {Function} callback - 클릭 콜백
 * @returns {Object} 버튼 객체
 */
createActionButton(x, y, text, color, callback) {
    // 버튼 배경
    const buttonBg = this.add.graphics();
    buttonBg.fillStyle(color, 0.8);
    buttonBg.fillRoundedRect(x - 60, y - 25, 120, 50, 5);
    buttonBg.lineStyle(2, 0xFFFFFF, 0.5);
    buttonBg.strokeRoundedRect(x - 60, y - 25, 120, 50, 5);
    
    // 버튼 텍스트
    const buttonText = this.add.text(x, y, text, {
        fontSize: '16px',
        fontFamily: 'Noto Sans KR, sans-serif',
        color: '#FFFFFF',
        fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    
    // 컨테이너에 추가
    this.actionContainer.add([buttonBg, buttonText]);
    
    // 히트 영역
    const hitArea = this.add.zone(x - 60, y - 25, 120, 50);
    hitArea.setOrigin(0, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.actionContainer.add(hitArea);
    
    // 이벤트 리스너
    hitArea.on('pointerover', () => {
        buttonBg.clear();
        buttonBg.fillStyle(color, 1);
        buttonBg.fillRoundedRect(x - 60, y - 25, 120, 50, 5);
        buttonBg.lineStyle(2, 0xFFFFFF, 0.8);
        buttonBg.strokeRoundedRect(x - 60, y - 25, 120, 50, 5);
        buttonText.setScale(1.1);
    });
    
    hitArea.on('pointerout', () => {
        buttonBg.clear();
        buttonBg.fillStyle(color, 0.8);
        buttonBg.fillRoundedRect(x - 60, y - 25, 120, 50, 5);
        buttonBg.lineStyle(2, 0xFFFFFF, 0.5);
        buttonBg.strokeRoundedRect(x - 60, y - 25, 120, 50, 5);
        buttonText.setScale(1);
    });
    
    hitArea.on('pointerup', callback);
    
    return { 
        bg: buttonBg, 
        text: buttonText, 
        hitArea: hitArea, 
        x: x, 
        y: y,
        setActive: (active) => {
            hitArea.disableInteractive();
            buttonBg.clear();
            if (active) {
                hitArea.setInteractive({ useHandCursor: true });
                buttonBg.fillStyle(color, 0.8);
            } else {
                buttonBg.fillStyle(0x555555, 0.5);
            }
            buttonBg.fillRoundedRect(x - 60, y - 25, 120, 50, 5);
            buttonBg.lineStyle(2, active ? 0xFFFFFF : 0x777777, active ? 0.5 : 0.3);
            buttonBg.strokeRoundedRect(x - 60, y - 25, 120, 50, 5);
            buttonText.setColor(active ? '#FFFFFF' : '#999999');
        }
    };
}

/**
 * 전투 시작 시퀀스
 */
startBattleSequence() {
    // 전투 시작 이펙트
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    // 페이드 인 효과
    const fadeRect = this.add.graphics();
    fadeRect.fillStyle(0x000000, 1);
    fadeRect.fillRect(0, 0, width, height);
    fadeRect.setDepth(1001);
    
    this.tweens.add({
        targets: fadeRect,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
            fadeRect.destroy();
            
            // 전투 시작 메시지
            let messageText = '전투 시작!';
            if (this.battleData.isBossBattle) {
                messageText = '보스 전투!';
            } else if (this.battleData.roomType === 'challenge') {
                messageText = '도전 전투!';
            }
            
            // 메시지 표시
            this.showBattleMessage(messageText, 1500, () => {
                // 플레이어 턴 시작
                this.startPlayerTurn();
            });
            
            // 전투 시작 효과음
            this.sound.play(this.battleData.isBossBattle ? 'boss-appear' : 'battle-start');
        }
    });
}

/**
 * 전투 메시지 표시
 * @param {string} message - 표시할 메시지
 * @param {number} duration - 표시 지속 시간
 * @param {Function} callback - 완료 콜백
 */
showBattleMessage(message, duration = 2000, callback = null) {
    // 메시지 컨테이너 표시
    this.battleMessageContainer.visible = true;
    this.battleMessageContainer.messageText.setText(message);
    this.battleMessageContainer.alpha = 0;
    
    // 페이드 인 효과
    this.tweens.add({
        targets: this.battleMessageContainer,
        alpha: 1,
        duration: 300,
        onComplete: () => {
            // 지정 시간 후 페이드 아웃
            this.time.delayedCall(duration, () => {
                this.tweens.add({
                    targets: this.battleMessageContainer,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        this.battleMessageContainer.visible = false;
                        
                        // 콜백 실행
                        if (callback) callback();
                    }
                });
            });
        }
    });
}

/**
 * 플레이어 턴 시작
 */
startPlayerTurn() {
    // 현재 턴 설정
    this.currentTurn = 'player';
    this.combatState = 'action';
    
    // 상태효과 업데이트
    this.updateStatusEffects(this.player);
    
    // UI 활성화
    this.enablePlayerActions(true);
    
    // 턴 시작 메시지
    this.showBattleMessage('당신의 턴입니다!', 1000);
    
    // 자동 스킬 쿨다운 감소
    this.decreaseCooldowns();
}

/**
 * 플레이어 액션 활성화 설정
 * @param {boolean} enabled - 활성화 여부
 */
enablePlayerActions(enabled) {
    this.actionContainer.setVisible(enabled);
    
    // 액션 진행 중 플래그 업데이트
    this.actionInProgress = !enabled;
    
    // 스킬 버튼 상태 업데이트
    if (enabled) {
        this.updateSkillButtons();
    }
}

/**
 * 스킬 버튼 상태 업데이트
 */
updateSkillButtons() {
    // MP 및 쿨다운 확인하여 스킬 버튼 상태 업데이트
    for (const skillButton of this.skillButtons) {
        const skill = skillButton.skill;
        const canUse = this.player.mana >= skill.manaCost && (!skill.currentCooldown || skill.currentCooldown <= 0);
        
        skillButton.setActive(canUse);
        
        // 쿨다운 표시 업데이트
        if (skill.currentCooldown && skill.currentCooldown > 0) {
            skillButton.cooldownOverlay.visible = true;
            skillButton.cooldownText.visible = true;
            skillButton.cooldownText.setText(`${skill.currentCooldown}`);
        } else {
            skillButton.cooldownOverlay.visible = false;
            skillButton.cooldownText.visible = false;
        }
    }
    
    // 궁극기 버튼 상태 업데이트
    if (this.ultimateButton && this.player.ultimateSkill) {
        const ultSkill = this.player.ultimateSkill;
        const canUseUlt = this.player.mana >= ultSkill.manaCost && (!ultSkill.currentCooldown || ultSkill.currentCooldown <= 0);
        
        this.ultimateButton.setActive(canUseUlt);
        
        // 궁극기 쿨다운 표시 업데이트
        if (ultSkill.currentCooldown && ultSkill.currentCooldown > 0) {
            this.ultimateButton.cooldownOverlay.visible = true;
            this.ultimateButton.cooldownText.visible = true;
            this.ultimateButton.cooldownText.setText(`${ultSkill.currentCooldown}`);
        } else {
            this.ultimateButton.cooldownOverlay.visible = false;
            this.ultimateButton.cooldownText.visible = false;
        }
    }
}

/**
 * 기본 공격 실행
 */
executePlayerAttack() {
    // 액션 진행 중이면 리턴
    if (this.actionInProgress || !this.targetEnemy || this.targetEnemy.isDead) return;
    
    // 액션 진행 표시
    this.enablePlayerActions(false);
    
    // 전투 결과 업데이트
    this.combatResults.turnCount++;
    
    // 공격 애니메이션 재생
    this.player.sprite.play('player-attack');
    
    // 효과음
    this.sound.play('attack');
    
    // 무기 타입 확인
    const weaponType = this.getEquippedWeaponType();
    
    // 공격 이펙트
    this.time.delayedCall(400, () => {
        // 효과 적용
        this.effectsManager.playAttackEffect(this.player, this.targetEnemy, weaponType);
        
        // 데미지 계산
        const damageResult = this.calculateDamage(this.player, this.targetEnemy);
        
        // 데미지 적용
        this.applyDamage(this.targetEnemy, damageResult);
        
        // 다음 행동 진행
        this.time.delayedCall(800, () => {
            // 모든 적이 죽었는지 확인
            if (this.checkAllEnemiesDead()) {
                this.endBattle(true);
            } else {
                // 적 턴 시작
                this.startEnemyTurn();
            }
        });
    });
}

/**
 * 스킬 사용
 * @param {Object} skill - 사용할 스킬 정보
 */
executePlayerSkill(skill) {
    // 액션 진행 중이면 리턴
    if (this.actionInProgress) return;
    
    // MP 확인
    if (this.player.mana < skill.manaCost) {
        this.showBattleMessage('마나가 부족합니다!', 1000);
        return;
    }
    
    // 쿨다운 확인
    if (skill.currentCooldown && skill.currentCooldown > 0) {
        this.showBattleMessage(`${skill.name}은(는) 쿨다운 중입니다. (${skill.currentCooldown}턴)`, 1000);
        return;
    }
    
    // 대상이 있어야 하는 스킬인 경우 확인
    if (skill.targetType === 'enemy' && (!this.targetEnemy || this.targetEnemy.isDead)) {
        this.showBattleMessage('대상을 선택해야 합니다!', 1000);
        return;
    }
    
    // 액션 진행 표시
    this.enablePlayerActions(false);
    
    // 전투 결과 업데이트
    this.combatResults.turnCount++;
    this.combatResults.skillsUsed++;
    
    // MP 소모
    this.player.mana -= skill.manaCost;
    this.updatePlayerStats();
    
    // 스킬 쿨다운 설정
    skill.currentCooldown = skill.cooldown;
    
    // 스킬 애니메이션 재생
    this.player.sprite.play('player-attack');
    
    // 스킬 효과음
    this.sound.play('skill-cast');
    
    // 스킬 처리 (유형별)
    this.time.delayedCall(400, () => {
        // 스킬 유형에 따른 처리
        this.processSkillEffect(skill);
        
        // 효과 적용 후 지연
        this.time.delayedCall(800, () => {
            // 모든 적이 죽었는지 확인
            if (this.checkAllEnemiesDead()) {
                this.endBattle(true);
            } else {
                // 적 턴 시작
                this.startEnemyTurn();
            }
        });
    });
}

/**
 * 스킬 효과 처리
 * @param {Object} skill - 처리할 스킬 정보
 */
processSkillEffect(skill) {
    // 대상 유형에 따라 처리
    switch (skill.targetType) {
        case 'enemy':
            // 단일 적 대상 스킬
            this.processSingleTargetSkill(skill, this.targetEnemy);
            break;
            
        case 'aoe':
            // 광역 스킬
            this.processAoeSkill(skill);
            break;
            
        case 'self':
            // 자기 자신 대상 스킬
            this.processSelfSkill(skill);
            break;
            
        default:
            // 기본 대미지 계산
            const damage = skill.damageMultiplier ? 
                (this.player.stats.attack * skill.damageMultiplier) : 
                this.player.stats.attack;
            
            // 기본 방식으로 데미지 적용
            const damageResult = {
                damage: Math.round(damage),
                isCritical: Math.random() < 0.2,
                element: skill.element || 'neutral'
            };
            
            this.applyDamage(this.targetEnemy, damageResult);
            break;
    }
}

/**
 * 단일 대상 스킬 처리
 * @param {Object} skill - 스킬 정보
 * @param {Object} target - 대상 적
 */
processSingleTargetSkill(skill, target) {
    // 효과 및 이펙트 처리
    switch (skill.id) {
        case 'precise_shot': // 정밀 사격
            // 이펙트
            this.effectsManager.playBowAttackEffect(this.player, target);
            
            // 치명타 확률 증가
            const critChance = 0.5; // 50% 치명타 확률
            const damageResult = this.calculateDamage(this.player, target, skill.damageMultiplier || 1, critChance);
            this.applyDamage(target, damageResult);
            break;
            
        case 'backstab': // 암습
            // 이펙트
            this.effectsManager.playDaggerAttackEffect(this.player, target);
            
            // 후방 공격 판정 (시뮬레이션)
            const isBackAttack = Math.random() < 0.7; // 70% 확률로 후방 공격 성공
            
            // 후방 공격 시 3배 대미지
            const multiplier = isBackAttack ? 3 : 1;
            const backDamageResult = this.calculateDamage(this.player, target, multiplier);
            
            if (isBackAttack) {
                this.showBattleMessage('암습 성공! 3배 대미지!', 800);
            }
            
            this.applyDamage(target, backDamageResult);
            break;
            
        case 'arcane_bolt': // 비전 화살
            // 이펙트
            this.effectsManager.playStaffAttackEffect(this.player, target);
            
            // 마법 대미지 계산 (지능 기반)
            const magicMultiplier = skill.damageMultiplier || 1.5;
            const magicDamage = Math.round(this.player.stats.attack * magicMultiplier);
            
            const magicDamageResult = {
                damage: magicDamage,
                isCritical: Math.random() < 0.15,
                element: 'arcane'
            };
            
            this.applyDamage(target, magicDamageResult);
            break;
            
        default:
            // 기본 대미지 계산
            const defaultDamageResult = this.calculateDamage(this.player, target, skill.damageMultiplier || 1);
            this.applyDamage(target, defaultDamageResult);
            break;
    }
}

/**
 * 광역 스킬 처리
 * @param {Object} skill - 스킬 정보
 */
processAoeSkill(skill) {
    switch (skill.id) {
        case 'whirlwind': // 회오리 베기
            // 회오리 베기 이펙트
            this.effectsManager.playSwordAttackEffect(this.player, this.player, true);
            
            // 360도 공격 이펙트
            const whirlwindCircle = this.add.graphics();
            whirlwindCircle.lineStyle(3, 0xFFFFFF, 0.8);
            whirlwindCircle.strokeCircle(this.player.x, this.player.y, 150);
            
            // 페이드 아웃 효과
            this.tweens.add({
                targets: whirlwindCircle,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    whirlwindCircle.destroy();
                }
            });
            
            // 모든 적에게 대미지
            for (const enemy of this.enemies) {
                if (enemy.isDead) continue;
                
                // 공격 대미지 (낮은 계수)
                const aoeMultiplier = skill.damageMultiplier || 0.7;
                const aoeDamageResult = this.calculateDamage(this.player, enemy, aoeMultiplier);
                
                // 각 적에게 약간의 딜레이를 두고 대미지 적용
                this.time.delayedCall(Phaser.Math.Between(100, 300), () => {
                    this.applyDamage(enemy, aoeDamageResult);
                });
            }
            break;
            
        case 'holy_light': // 성스러운 빛
            // 성스러운 빛 이펙트
            const holyLight = this.add.graphics();
            holyLight.fillStyle(0xFFFFFF, 0.7);
            holyLight.fillCircle(this.player.x, this.player.y, 200);
            
            // 점점 큰 원 애니메이션
            this.tweens.add({
                targets: holyLight,
                scaleX: 1.5,
                scaleY: 1.5,
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    holyLight.destroy();
                }
            });
            
            // 모든 적에게 대미지 (신성 속성)
            for (const enemy of this.enemies) {
                if (enemy.isDead) continue;
                
                // 공격 대미지 (보통 계수)
                const holyMultiplier = skill.damageMultiplier || 1;
                const holyDamageResult = {
                    damage: Math.round(this.player.stats.attack * holyMultiplier),
                    isCritical: Math.random() < 0.15,
                    element: 'holy'
                };
                
                // 각 적에게 약간의 딜레이를 두고 대미지 적용
                this.time.delayedCall(Phaser.Math.Between(100, 300), () => {
                    this.applyDamage(enemy, holyDamageResult);
                });
            }
            
            // 자신 회복 효과 (피해량의 일부)
            const healAmount = Math.round(this.player.stats.attack * 0.3);
            this.healPlayer(healAmount);
            break;
            
        case 'explosive_flask': // 폭발 플라스크
            // 플라스크 던지기 이펙트
            const targetX = (this.enemies.reduce((sum, e) => sum + e.x, 0) / this.enemies.length);
            const targetY = (this.enemies.reduce((sum, e) => sum + e.y, 0) / this.enemies.length);
            
            // 병 그리기
            const flask = this.add.image(this.player.x, this.player.y, 'items', 'potion_red');
            flask.setScale(0.8);
            
            // 병 던지기 애니메이션
            this.tweens.add({
                targets: flask,
                x: targetX,
                y: targetY - 50,
                duration: 500,
                onComplete: () => {
                    flask.destroy();
                    
                    // 폭발 이펙트
                    this.effectsManager.playFireTrapEffect(targetX, targetY);
                    
                    // 모든 적에게 대미지 (화염 속성)
                    for (const enemy of this.enemies) {
                        if (enemy.isDead) continue;
                        
                        // 거리에 따른 대미지 계산 (가까울수록 강함)
                        const distance = Phaser.Math.Distance.Between(targetX, targetY, enemy.x, enemy.y);
                        const distanceMultiplier = Math.max(0.5, 1 - (distance / 250));
                        
                        // 공격 대미지
                        const explosionMultiplier = (skill.damageMultiplier || 1.2) * distanceMultiplier;
                        const explosionDamageResult = {
                            damage: Math.round(this.player.stats.attack * explosionMultiplier),
                            isCritical: Math.random() < 0.1,
                            element: 'fire'
                        };
                        
                        // 각 적에게 약간의 딜레이를 두고 대미지 적용
                        this.time.delayedCall(Phaser.Math.Between(50, 200), () => {
                            this.applyDamage(enemy, explosionDamageResult);
                        });
                    }
                }
            });
            break;
            
        default:
            // 기본 광역 대미지
            for (const enemy of this.enemies) {
                if (enemy.isDead) continue;
                
                const defaultAoeDamageResult = this.calculateDamage(this.player, enemy, skill.damageMultiplier || 0.8);
                this.applyDamage(enemy, defaultAoeDamageResult);
            }
            break;
    }
}

/**
 * 자기자신 대상 스킬 처리
 * @param {Object} skill - 스킬 정보
 */
processSelfSkill(skill) {
    switch (skill.id) {
        case 'flying_kick': // 날아차기
            // 가까운 적을 선택 (현재 대상 적 또는 첫 번째 살아있는 적)
            const targetEnemy = this.targetEnemy && !this.targetEnemy.isDead 
                ? this.targetEnemy 
                : this.enemies.find(e => !e.isDead);
            
            if (!targetEnemy) return;
            
            // 갭 클로저 이펙트 (빠르게 이동하여 공격)
            const startX = this.player.x;
            const startY = this.player.y;
            
            // 플레이어를 적 앞으로 빠르게 이동
            this.tweens.add({
                targets: this.player.sprite,
                x: targetEnemy.x - 80,
                y: targetEnemy.y,
                duration: 300,
                onComplete: () => {
                    // 강력한 발차기 공격
                    this.effectsManager.playKnockbackEffect(targetEnemy, 0.5);
                    
                    // 대미지 계산 (높은 계수)
                    const kickMultiplier = skill.damageMultiplier || 1.5;
                    const kickDamageResult = this.calculateDamage(this.player, targetEnemy, kickMultiplier);
                    
                    // 대미지 적용
                    this.applyDamage(targetEnemy, kickDamageResult);
                    
                    // 원래 위치로 돌아오기
                    this.time.delayedCall(400, () => {
                        this.tweens.add({
                            targets: this.player.sprite,
                            x: startX,
                            y: startY,
                            duration: 300
                        });
                    });
                }
            });
            break;
            
        case 'rage': // 분노
            // 분노 이펙트
            this.effectsManager.playFireEffect(this.player);
            
            // 버프 메시지
            this.showBattleMessage('분노 상태! 공격력 증가, 방어력 감소', 1000);
            
            // 상태효과 추가
            this.addStatusEffect(this.player, {
                type: 'buff',
                name: '분노',
                duration: 3,
                effects: {
                    attack: 1.5,   // 공격력 50% 증가
                    defense: 0.7   // 방어력 30% 감소
                }
            });
            break;
            
        default:
            // 기본 버프 이펙트
            this.effectsManager.playStatusEffectApply(this.player, 'buff');
            
            // 기본 버프 효과
            this.showBattleMessage(`${skill.name} 효과 적용!`, 1000);
            break;
    }
}

/**
 * 궁극기 사용
 */
executePlayerUltimateSkill() {
    // 액션 진행 중이면 리턴
    if (this.actionInProgress) return;
    
    // 궁극기 정보
    const ultSkill = this.player.ultimateSkill;
    if (!ultSkill) return;
    
    // MP 확인
    if (this.player.mana < ultSkill.manaCost) {
        this.showBattleMessage('마나가 부족합니다!', 1000);
        return;
    }
    
    // 쿨다운 확인
    if (ultSkill.currentCooldown && ultSkill.currentCooldown > 0) {
        this.showBattleMessage(`${ultSkill.name}은(는) 쿨다운 중입니다. (${ultSkill.currentCooldown}턴)`, 1000);
        return;
    }
    
    // 액션 진행 표시
    this.enablePlayerActions(false);
    
    // 전투 결과 업데이트
    this.combatResults.turnCount++;
    this.combatResults.skillsUsed++;
    
    // MP 소모
    this.player.mana -= ultSkill.manaCost;
    this.updatePlayerStats();
    
    // 궁극기 쿨다운 설정
    ultSkill.currentCooldown = ultSkill.cooldown;
    
    // 화면 효과 (깜빡임)
    this.cameras.main.flash(500, 100, 100, 200);
    
    // 궁극기 애니메이션
    this.player.sprite.play('player-attack');
    
    // 궁극기 사용 메시지
    this.showBattleMessage(`${ultSkill.name} 발동!`, 1200);
    
    // 궁극기 효과음
    this.sound.play('ultimate-cast', { volume: 0.8 });
        
    // 궁극기 처리 (클래스별)
    this.time.delayedCall(600, () => {
        // 클래스별 궁극기 효과
        switch (this.player.classData.id) {
            case 'warrior': // 전사 - 무자비한 일격
                // 모든 적에게 강력한 대미지
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    
                    // 강력한 타격 이펙트
                    this.effectsManager.playAttackEffect(this.player, enemy, 'sword', 2);
                    
                    // 1.8배 대미지
                    const damageResult = this.calculateDamage(this.player, enemy, 1.8);
                    this.applyDamage(enemy, damageResult);
                }
                break;
                
            case 'archer': // 궁수 - 화살 폭풍
                // 모든 적에게 여러 발의 화살 발사
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    
                    // 여러 화살 이펙트
                    const arrowCount = Phaser.Math.Between(4, 6);
                    
                    for (let i = 0; i < arrowCount; i++) {
                        this.time.delayedCall(i * 150, () => {
                            this.effectsManager.playBowAttackEffect(this.player, enemy);
                            
                            // 0.6배 대미지 (여러번)
                            const damageResult = this.calculateDamage(this.player, enemy, 0.6);
                            this.applyDamage(enemy, damageResult);
                        });
                    }
                }
                break;
                
            case 'mage': // 마법사 - 운석 폭풍
                // 각 적에게 운석 떨어뜨리기
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    
                    // 운석 이펙트
                    const meteorX = enemy.x + Phaser.Math.Between(-30, 30);
                    const meteorY = enemy.y - 300;
                    
                    // 운석 그리기
                    const meteor = this.add.graphics();
                    meteor.fillStyle(0xFF4400, 1);
                    meteor.fillCircle(meteorX, meteorY, 20);
                    
                    // 빛 효과
                    const glow = this.add.graphics();
                    glow.fillStyle(0xFFAA00, 0.5);
                    glow.fillCircle(meteorX, meteorY, 30);
                    
                    // 화염 흔적
                    const trail = this.add.particles('fire');
                    const emitter = trail.createEmitter({
                        speed: 20,
                        scale: { start: 0.4, end: 0.1 },
                        alpha: { start: 0.6, end: 0 },
                        lifespan: 500,
                        follow: meteor
                    });
                    
                    // 운석 떨어지는 애니메이션
                    this.tweens.add({
                        targets: [meteor, glow],
                        y: enemy.y,
                        duration: 600,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                            // 폭발 이펙트
                            this.effectsManager.playFireTrapEffect(meteorX, enemy.y);
                            
                            // 대미지 계산 (2배)
                            const damageResult = {
                                damage: Math.round(this.player.stats.attack * 2),
                                isCritical: Math.random() < 0.2,
                                element: 'fire'
                            };
                            
                            this.applyDamage(enemy, damageResult);
                            
                            // 잔해 제거
                            meteor.destroy();
                            glow.destroy();
                            this.time.delayedCall(500, () => {
                                trail.destroy();
                            });
                        }
                    });
                }
                break;
                
            case 'cleric': // 성직자 - 심판의 날
                // 성스러운 빛 내리기
                const holyLightBig = this.add.graphics();
                holyLightBig.fillStyle(0xFFFFDD, 0.7);
                holyLightBig.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
                
                // 페이드 인/아웃 효과
                holyLightBig.alpha = 0;
                this.tweens.add({
                    targets: holyLightBig,
                    alpha: 0.7,
                    duration: 1000,
                    yoyo: true,
                    onComplete: () => {
                        holyLightBig.destroy();
                    }
                });
                
                // 모든 적에게 성스러운 대미지 (언데드에게 추가 대미지)
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    
                    // 언데드 또는 악마 유형에게 추가 대미지
                    let multiplier = 2;
                    if (enemy.data.type === 'undead' || enemy.data.type === 'demon') {
                        multiplier = 3;
                    }
                    
                    // 성스러운 빛 효과
                    this.effectsManager.playHealEffect(enemy);
                    
                    // 대미지 계산
                    const holyCritRate = 0.3; // 30% 치명타 확률
                    const holyDamageResult = {
                        damage: Math.round(this.player.stats.attack * multiplier),
                        isCritical: Math.random() < holyCritRate,
                        element: 'holy'
                    };
                    
                    this.time.delayedCall(800, () => {
                        this.applyDamage(enemy, holyDamageResult);
                    });
                }
                
                // 자신 및 아군 완전 회복 (이 게임에선 자신만)
                this.time.delayedCall(800, () => {
                    const healAmount = this.player.maxHealth - this.player.health;
                    this.healPlayer(healAmount);
                });
                break;
                
            default:
                // 기본 광역 대미지
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    
                    const defaultUltDamageResult = this.calculateDamage(this.player, enemy, 1.5);
                    this.applyDamage(enemy, defaultUltDamageResult);
                }
                break;
        }
        
        // 다음 행동 진행
        this.time.delayedCall(1500, () => {
            // 모든 적이 죽었는지 확인
            if (this.checkAllEnemiesDead()) {
                this.endBattle(true);
            } else {
                // 적 턴 시작
                this.startEnemyTurn();
            }
        });
    });
}

/**
 * 플레이어 방어 실행
 */
executePlayerDefend() {
    // 액션 진행 중이면 리턴
    if (this.actionInProgress) return;
    
    // 액션 진행 표시
    this.enablePlayerActions(false);
    
    // 전투 결과 업데이트
    this.combatResults.turnCount++;
    
    // 방어 효과음
    this.sound.play('defend', { volume: 0.5 });
    
    // 방어 이펙트
    const shield = this.add.graphics();
    shield.fillStyle(0x3399FF, 0.3);
    shield.fillCircle(this.player.x, this.player.y, 70);
    shield.lineStyle(3, 0x3399FF, 0.7);
    shield.strokeCircle(this.player.x, this.player.y, 70);
    
    // 방어 상태 추가
    this.addStatusEffect(this.player, {
        type: 'defend',
        name: '방어 태세',
        duration: 1,
        effects: {
            defense: 2  // 방어력 2배
        }
    });
    
    // 방어 메시지 표시
    this.showBattleMessage('방어 태세! 1턴간 방어력 2배 증가', 1200);
    
    // 방어 이펙트 애니메이션
    this.tweens.add({
        targets: shield,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
            shield.destroy();
            
            // 적 턴 시작
            this.startEnemyTurn();
        }
    });
}

/**
 * 도망가기 시도
 */
attemptFlee() {
    // 액션 진행 중이면 리턴
    if (this.actionInProgress) return;
    
    // 보스전에서는 도망칠 수 없음
    if (this.battleData.isBossBattle) {
        this.showBattleMessage('보스전에서는 도망칠 수 없습니다!', 1200);
        return;
    }
    
    // 액션 진행 표시
    this.enablePlayerActions(false);
    
    // 도망 성공 확률 계산
    // 플레이어 속도가 높을수록, 남은 적이 적을수록 확률 증가
    const baseChance = 0.4; // 기본 40% 확률
    const speedBonus = (this.player.stats.speed / 100) * 0.3; // 속도 보너스
    const enemyPenalty = (this.getAliveEnemyCount() / 5) * 0.2; // 적 패널티
    
    const fleeChance = Math.min(0.8, Math.max(0.2, baseChance + speedBonus - enemyPenalty));
    
    // 도망 시도
    const fleeSuccess = Math.random() < fleeChance;
    
    if (fleeSuccess) {
        // 도망 성공
        this.showBattleMessage('도망치는데 성공했습니다!', 1000);
        
        // 도망 효과음
        this.sound.play('run-away');
        
        // 페이드 아웃
        this.cameras.main.fadeOut(1000);
        
        // 던전으로 돌아가기
        this.time.delayedCall(1000, () => {
            // 음악 정지
            if (this.bgMusic) {
                this.bgMusic.stop();
            }
            
            // 던전 씬으로 돌아가기
            this.scene.start(this.battleData.returnScene, { 
                fleeSuccess: true 
            });
        });
    } else {
        // 도망 실패
        this.showBattleMessage('도망치는데 실패했습니다!', 1000);
        
        // 실패 효과음
        this.sound.play('error', { volume: 0.5 });
        
        // 적 턴 시작 (페널티로 바로 적 턴)
        this.time.delayedCall(1200, () => {
            this.startEnemyTurn();
        });
    }
}

/**
 * 아이템 메뉴 표시
 */
showItemMenu() {
    // 액션 진행 중이면 리턴
    if (this.actionInProgress) return;
    
    // 아이템 목록 가져오기
    const inventory = this.game.config.dataManager.getInventory();
    
    // 소비 아이템만 필터링
    const consumables = inventory.filter(item => item.type === 'consumable');
    
    // 아이템이 없으면 메시지 표시
    if (consumables.length === 0) {
        this.showBattleMessage('사용할 아이템이 없습니다!', 1000);
        return;
    }
    
    // 액션 컨테이너 숨기기
    this.actionContainer.setVisible(false);
    
    // 아이템 메뉴 컨테이너 생성
    const itemMenuContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height - 150);
    
    // 배경
    const menuBg = this.add.graphics();
    menuBg.fillStyle(0x000000, 0.8);
    menuBg.fillRoundedRect(-300, -100, 600, 200, 10);
    menuBg.lineStyle(2, 0x666666);
    menuBg.strokeRoundedRect(-300, -100, 600, 200, 10);
    itemMenuContainer.add(menuBg);
    
    // 아이템 제목
    const menuTitle = this.add.text(0, -85, '사용할 아이템 선택', {
        fontSize: '20px',
        fontFamily: 'Noto Sans KR, sans-serif',
        color: '#FFFFFF',
        fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);
    itemMenuContainer.add(menuTitle);
    
    // 아이템 버튼 생성 (최대 4개)
    const itemsToShow = consumables.slice(0, 4);
    
    // 아이템 버튼 배치
    let buttonX = -220;
    const buttonY = -20;
    const buttonSpacing = 150;
    
    for (const item of itemsToShow) {
        // 아이템 버튼 배경
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x333333, 0.9);
        buttonBg.fillRoundedRect(buttonX - 60, buttonY - 40, 120, 80, 8);
        buttonBg.lineStyle(2, this.getRarityColor(item.rarity));
        buttonBg.strokeRoundedRect(buttonX - 60, buttonY - 40, 120, 80, 8);
        
        // 아이템 아이콘
        const icon = this.add.image(buttonX, buttonY - 20, 'items', item.icon || 0);
        
        // 아이템 이름
        const itemName = this.add.text(buttonX, buttonY + 10, item.name, {
            fontSize: '12px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5, 0.5);
        
        // 아이템 개수
        const itemCount = this.add.text(buttonX + 40, buttonY - 25, `x${item.count || 1}`, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA'
        }).setOrigin(0.5, 0.5);
        
        // 버튼 히트 영역
        const hitArea = this.add.zone(buttonX - 60, buttonY - 40, 120, 80);
        hitArea.setOrigin(0, 0);
        hitArea.setInteractive({ useHandCursor: true });
        
        // 클릭 이벤트
        hitArea.on('pointerup', () => {
            // 아이템 사용
            this.useItem(item);
            
            // 메뉴 닫기
            itemMenuContainer.destroy();
        });
        
        // 호버 효과
        hitArea.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x555555, 0.9);
            buttonBg.fillRoundedRect(buttonX - 60, buttonY - 40, 120, 80, 8);
            buttonBg.lineStyle(2, this.getRarityColor(item.rarity));
            buttonBg.strokeRoundedRect(buttonX - 60, buttonY - 40, 120, 80, 8);
        });
        
        hitArea.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x333333, 0.9);
            buttonBg.fillRoundedRect(buttonX - 60, buttonY - 40, 120, 80, 8);
            buttonBg.lineStyle(2, this.getRarityColor(item.rarity));
            buttonBg.strokeRoundedRect(buttonX - 60, buttonY - 40, 120, 80, 8);
        });
        
        // 컨테이너에 추가
        itemMenuContainer.add([buttonBg, icon, itemName, itemCount, hitArea]);
        
        // 다음 위치
        buttonX += buttonSpacing;
    }
    
    // 닫기 버튼
    const closeButton = this.add.text(0, 60, '돌아가기', {
        fontSize: '16px',
        fontFamily: 'Noto Sans KR, sans-serif',
        color: '#AAAAAA'
    }).setOrigin(0.5, 0.5);
    closeButton.setInteractive({ useHandCursor: true });
    
    closeButton.on('pointerup', () => {
        // 효과음
        this.sound.play('button-click', { volume: 0.3 });
        
        // 아이템 메뉴 닫고 액션 메뉴 표시
        itemMenuContainer.destroy();
        this.actionContainer.setVisible(true);
    });
    
    // 호버 효과
    closeButton.on('pointerover', () => {
        closeButton.setColor('#FFFFFF');
    });
    
    closeButton.on('pointerout', () => {
        closeButton.setColor('#AAAAAA');
    });
    
    itemMenuContainer.add(closeButton);
}

/**
 * 아이템 사용
 * @param {Object} item - 사용할 아이템
 */
useItem(item) {
    // 아이템 사용 효과
    switch (item.effect.type) {
        case 'heal':
            // 회복량 계산
            const healAmount = item.effect.value || 50;
            
            // 체력 회복
            this.healPlayer(healAmount);
            
            // 효과 메시지
            this.showBattleMessage(`${item.name} 사용! ${healAmount}의 체력을 회복합니다.`, 1000);
            
            // 효과음
            this.sound.play('potion-use');
            
            // 이펙트
            this.effectsManager.playHealEffect(this.player);
            break;
            
        case 'mana':
            // 마나 회복량 계산
            const manaAmount = item.effect.value || 30;
            
            // 마나 회복
            this.restoreMana(manaAmount);
            
            // 효과 메시지
            this.showBattleMessage(`${item.name} 사용! ${manaAmount}의 마나를 회복합니다.`, 1000);
            
            // 효과음
            this.sound.play('potion-use');
            
            // 이펙트
            this.effectsManager.playPotionEffect(this.player, 'mana');
            break;
            
        case 'buff':
            // 버프 효과
            const buffStat = item.effect.stat || 'attack';
            const buffValue = item.effect.value || 1.5;
            const buffDuration = item.effect.duration || 3;
            
            // 상태효과 추가
            this.addStatusEffect(this.player, {
                type: 'buff',
                name: item.name,
                duration: buffDuration,
                effects: {
                    [buffStat]: buffValue
                }
            });
            
            // 효과 메시지
            this.showBattleMessage(`${item.name} 사용! ${this.getStatName(buffStat)}이(가) ${Math.round((buffValue - 1) * 100)}% 증가합니다.`, 1000);
            
            // 효과음
            this.sound.play('buff-apply');
            
            // 이펙트
            this.effectsManager.playStatusEffectApply(this.player, 'buff');
            break;
            
        case 'damage':
            // 적에게 대미지 아이템 (화염 폭탄 등)
            const damageAmount = item.effect.value || 100;
            
            // 효과 메시지
            this.showBattleMessage(`${item.name} 사용! 모든 적에게 피해를 입힙니다.`, 1000);
            
            // 효과음
            this.sound.play('explosion');
            
            // 타겟 위치 (적들의 중앙)
            const targetX = (this.enemies.reduce((sum, e) => sum + e.x, 0) / this.enemies.length);
            const targetY = (this.enemies.reduce((sum, e) => sum + e.y, 0) / this.enemies.length);
            
            // 이펙트
            this.effectsManager.playFireTrapEffect(targetX, targetY);
            
            // 모든 적에게 대미지
            for (const enemy of this.enemies) {
                if (enemy.isDead) continue;
                
                // 대미지 적용
                const itemDamage = {
                    damage: damageAmount,
                    isCritical: false,
                    element: item.effect.element || 'fire'
                };
                
                // 약간의 딜레이 후 대미지 적용
                this.time.delayedCall(300, () => {
                    this.applyDamage(enemy, itemDamage);
                });
            }
            break;
            
        default:
            // 기본 효과 메시지
            this.showBattleMessage(`${item.name} 사용!`, 1000);
            break;
    }
    
    // 인벤토리에서 아이템 사용
    this.game.config.dataManager.useItem(item.id);
    
    // 액션 진행 표시
    this.enablePlayerActions(false);
    
    // 다음 행동 진행
    this.time.delayedCall(1500, () => {
        // 모든 적이 죽었는지 확인
        if (this.checkAllEnemiesDead()) {
            this.endBattle(true);
        } else {
            // 적 턴 시작
            this.startEnemyTurn();
        }
    });
}

/**
 * 적 턴 시작
 */
startEnemyTurn() {
    // 현재 턴 설정
    this.currentTurn = 'enemy';
    this.combatState = 'enemy_action';
    
    // 적 액션 큐 초기화
    this.enemyAttackQueue = [];
    
    // 살아있는 모든 적의 액션 계획
    for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        
        // 상태효과 업데이트
        this.updateStatusEffects(enemy);
        
        // 적 액션을 큐에 추가
        this.enemyAttackQueue.push(enemy);
    }
    
    // 턴 시작 메시지
    if (this.enemyAttackQueue.length > 0) {
        this.showBattleMessage('적의 턴입니다!', 1000, () => {
            // 적 액션 실행
            this.processEnemyActions();
        });
    } else {
        // 적이 없으면 플레이어 턴으로
        this.startPlayerTurn();
    }
}

/**
 * 적 액션 처리
 */
processEnemyActions() {
    // 큐에서 다음 적 가져오기
    if (this.enemyAttackQueue.length === 0) {
        // 모든 적 액션 완료
        this.time.delayedCall(800, () => {
            this.startPlayerTurn();
        });
        return;
    }
    
    // 다음 적 가져오기
    const enemy = this.enemyAttackQueue.shift();
    
    // 적 액션 결정 (일반 공격 또는 스킬)
    this.executeEnemyAction(enemy);
}

/**
 * 적 액션 실행
 * @param {Object} enemy - 액션을 수행할 적
 */
executeEnemyAction(enemy) {
    // 스킬 사용 여부 결정 (20% 확률로 스킬 사용, 보스는 40%)
    const useSkill = enemy.abilities && enemy.abilities.length > 0 && 
                    Math.random() < (enemy.isBoss ? 0.4 : 0.2);
    
    if (useSkill) {
        // 랜덤 스킬 선택
        const skillIndex = Phaser.Math.Between(0, enemy.abilities.length - 1);
        const skill = enemy.abilities[skillIndex];
        
        // 스킬 사용 메시지
        this.showBattleMessage(`${enemy.name}이(가) ${skill.name}을(를) 사용합니다!`, 800);
        
        // 스킬 사용
        this.executeEnemySkill(enemy, skill);
    } else {
        // 일반 공격
        this.executeEnemyAttack(enemy);
    }
}

/**
 * 적 일반 공격 실행
 * @param {Object} enemy - 공격하는 적
 */
executeEnemyAttack(enemy) {
    // 공격 애니메이션
    enemy.sprite.play(`${enemy.id}-attack`);
    
    // 공격 효과음
    this.sound.play('enemy-attack');
    
    // 약간의 지연 후 공격 효과
    this.time.delayedCall(500, () => {
        // 적 공격 유형에 따라 이펙트
        this.effectsManager.playEnemyAttackEffect(enemy, this.player, enemy.attackType);
        
        // 대미지 계산
        const damageResult = this.calculateDamage(enemy, this.player);
        
        // 대미지 적용
        this.applyDamageToPlayer(damageResult);
        
        // 다음 적 액션 진행
        this.time.delayedCall(800, () => {
            this.processEnemyActions();
        });
    });
}

/**
 * 적 스킬 실행
 * @param {Object} enemy - 스킬을 사용하는 적
 * @param {Object} skill - 사용할 스킬
 */
executeEnemySkill(enemy, skill) {
    // 적 공격 애니메이션
    enemy.sprite.play(`${enemy.id}-attack`);
    
    // 스킬 효과음
    this.sound.play('enemy-skill');
    
    // 약간의 지연 후 스킬 효과
    this.time.delayedCall(500, () => {
        // 스킬 타입에 따른 효과
        switch (skill.type) {
            case 'aoe':
                // 광역 공격 이펙트
                this.effectsManager.playEnemyMagicAttackEffect(enemy, this.player, skill.element || 'neutral');
                
                // 대미지 계산 (스킬 계수 적용)
                const aoeMultiplier = skill.damageMultiplier || 0.8;
                const aoeDamageResult = {
                    damage: Math.round(enemy.stats.attack * aoeMultiplier),
                    isCritical: Math.random() < 0.1,
                    element: skill.element || enemy.element
                };
                
                // 대미지 적용
                this.applyDamageToPlayer(aoeDamageResult);
                break;
                
            case 'debuff':
                // 디버프 이펙트
                this.effectsManager.playStatusEffectApply(this.player, 'debuff');
                
                // 디버프 정보
                const debuffStat = skill.effectType || 'defense';
                const debuffValue = skill.value || 0.7;
                const debuffDuration = skill.duration || 2;
                
                // 상태효과 추가
                this.addStatusEffect(this.player, {
                    type: 'debuff',
                    name: skill.name,
                    duration: debuffDuration,
                    effects: {
                        [debuffStat]: debuffValue
                    }
                });
                
                // 디버프 메시지
                this.showBattleMessage(`${this.getStatName(debuffStat)}이(가) 감소했습니다!`, 800);
                break;
                
                case 'buff':
                    // 버프 이펙트
                    this.effectsManager.playStatusEffectApply(enemy, 'buff');
                    
                    // 버프 정보
                    const buffStat = skill.effectType || 'attack';
                    const buffValue = skill.value || 1.5;
                    const buffDuration = skill.duration || 2;
                    
                    // 상태효과 추가
                    this.addStatusEffect(enemy, {
                        type: 'buff',
                        name: skill.name,
                        duration: buffDuration,
                        effects: {
                            [buffStat]: buffValue
                        }
                    });
                    
                    // 버프 메시지
                    this.showBattleMessage(`${enemy.name}의 ${this.getStatName(buffStat)}이(가) 증가했습니다!`, 800);
                    break;
                    
                case 'summon':
                    // 소환 이펙트
                    const summonX = enemy.x + Phaser.Math.Between(-100, 100);
                    const summonY = enemy.y;
                    
                    // 소환 이펙트
                    this.effectsManager.playEnemySpawnEffect({ x: summonX, y: summonY });
                    
                    // 소환 메시지
                    this.showBattleMessage(`${enemy.name}이(가) 하수인을 소환합니다!`, 800);
                    
                    // 실제 적을 소환하는 기능 (이 예시에서는 생략)
                    break;
                    
                case 'heal':
                    // 회복 이펙트
                    this.effectsManager.playHealEffect(enemy);
                    
                    // 회복량 계산
                    const healAmount = skill.healAmount || Math.round(enemy.maxHealth * 0.2);
                    
                    // 체력 회복
                    enemy.health = Math.min(enemy.maxHealth, enemy.health + healAmount);
                    
                    // 적 정보 UI 업데이트
                    this.updateEnemyStats(enemy);
                    
                    // 회복 메시지
                    this.showBattleMessage(`${enemy.name}이(가) ${healAmount}의 체력을 회복했습니다!`, 800);
                    break;
                    
                default:
                    // 기본 스킬 (강화된 공격)
                    const multiplier = skill.damageMultiplier || 1.2;
                    
                    // 공격 이펙트
                    this.effectsManager.playEnemyAttackEffect(enemy, this.player, enemy.attackType, 1.5);
                    
                    // 대미지 계산
                    const damageResult = {
                        damage: Math.round(enemy.stats.attack * multiplier),
                        isCritical: Math.random() < 0.15,
                        element: skill.element || enemy.element
                    };
                    
                    // 대미지 적용
                    this.applyDamageToPlayer(damageResult);
                    break;
            }
            
            // 다음 적 액션 진행
            this.time.delayedCall(1000, () => {
                this.processEnemyActions();
            });
        });
    }

    /**
     * 대미지 계산
     * @param {Object} attacker - 공격자
     * @param {Object} defender - 방어자
     * @param {number} multiplier - 대미지 계수 (기본값: 1)
     * @param {number} critChance - 치명타 확률 (기본값: 0.1)
     * @returns {Object} 대미지 결과
     */
    calculateDamage(attacker, defender, multiplier = 1, critChance = 0.1) {
        // 공격력 계산
        let damage = attacker.stats.attack * multiplier;
        
        // 방어력 적용
        const defense = defender.stats.defense;
        damage = Math.max(1, damage * (100 / (100 + defense)));
        
        // 치명타 확인
        const isCritical = Math.random() < critChance;
        if (isCritical) {
            damage *= 1.5;
        }
        
        // 속성 상성 확인 (if applies)
        const element = attacker.element || 'neutral';
        const defenderElement = defender.element || 'neutral';
        
        // 속성 상성 계산
        const elementMultiplier = this.calculateElementalEffectiveness(element, defenderElement);
        damage *= elementMultiplier;
        
        // 최종 대미지 반올림
        damage = Math.round(damage);
        
        // 결과 반환
        return {
            damage: damage,
            isCritical: isCritical,
            element: element,
            elementMultiplier: elementMultiplier
        };
    }

    /**
     * 속성 상성 계산
     * @param {string} attackElement - 공격 속성
     * @param {string} defenseElement - 방어 속성
     * @returns {number} 대미지 배수
     */
    calculateElementalEffectiveness(attackElement, defenseElement) {
        // 속성 상성 테이블 (간단한 예시)
        const elementTable = {
            'fire': { 'ice': 1.5, 'water': 0.5, 'fire': 0.75 },
            'ice': { 'earth': 1.5, 'fire': 0.5, 'ice': 0.75 },
            'earth': { 'lightning': 1.5, 'ice': 0.5, 'earth': 0.75 },
            'lightning': { 'water': 1.5, 'earth': 0.5, 'lightning': 0.75 },
            'water': { 'fire': 1.5, 'lightning': 0.5, 'water': 0.75 },
            'holy': { 'dark': 1.5, 'holy': 0.75 },
            'dark': { 'holy': 1.5, 'dark': 0.75 },
            'neutral': {}
        };
        
        // 상성 배수 계산
        if (elementTable[attackElement] && elementTable[attackElement][defenseElement]) {
            return elementTable[attackElement][defenseElement];
        }
        
        // 기본값 (속성이 없거나 상성이 정의되지 않은 경우)
        return 1;
    }

    /**
     * 적에게 대미지 적용
     * @param {Object} enemy - 대미지를 입을 적
     * @param {Object} damageResult - 대미지 결과
     */
    applyDamage(enemy, damageResult) {
        // 적이 이미 죽었으면 리턴
        if (enemy.isDead) return;
        
        // 대미지 적용
        enemy.health = Math.max(0, enemy.health - damageResult.damage);
        
        // 피격 애니메이션
        enemy.sprite.play(`${enemy.id}-hit`);
        
        // 피격 이펙트
        this.effectsManager.playHitEffect(enemy, damageResult.element, damageResult.isCritical);
        
        // 대미지 텍스트 표시
        this.showDamageText(enemy.x, enemy.y - 50, damageResult.damage, damageResult.isCritical, damageResult.element);
        
        // 전투 결과 업데이트
        this.combatResults.playerDamageDealt += damageResult.damage;
        if (damageResult.isCritical) {
            this.combatResults.criticalHits++;
        }
        
        // 적 정보 UI 업데이트
        this.updateEnemyStats(enemy);
        
        // 적 사망 확인
        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    /**
     * 플레이어에게 대미지 적용
     * @param {Object} damageResult - 대미지 결과
     */
    applyDamageToPlayer(damageResult) {
        // 대미지 적용
        this.player.health = Math.max(0, this.player.health - damageResult.damage);
        
        // 피격 애니메이션
        this.player.sprite.play('player-hit');
        
        // 피격 이펙트
        this.effectsManager.playHitEffect(this.player, damageResult.element, damageResult.isCritical);
        
        // 대미지 텍스트 표시
        this.showDamageText(this.player.x, this.player.y - 50, damageResult.damage, damageResult.isCritical, damageResult.element);
        
        // 플레이어 정보 UI 업데이트
        this.updatePlayerStats();
        
        // 플레이어 사망 확인
        if (this.player.health <= 0) {
            this.playerDeath();
        }
    }

    /**
     * 적 사망 처리
     * @param {Object} enemy - 죽은 적
     */
    killEnemy(enemy) {
        // 적 사망 표시
        enemy.isDead = true;
        
        // 전투 결과 업데이트
        this.combatResults.enemiesDefeated++;
        
        // 사망 메시지
        if (enemy.isBoss) {
            this.showBattleMessage(`보스 ${enemy.name}을(를) 처치했습니다!`, 1500);
        }
        
        // 사망 애니메이션
        enemy.sprite.play(`${enemy.id}-death`);
        
        // 사망 이펙트
        this.effectsManager.playDeathEffect(enemy);
        
        // 이름 및 상태바 제거
        enemy.nameText.destroy();
        enemy.statsBar.destroy();
        
        // 상태효과 아이콘 제거
        for (const icon of enemy.statusIcons) {
            icon.destroy();
        }
        enemy.statusIcons = [];
        
        // 타겟이 이 적이었을 경우 다음 타겟 설정
        if (this.targetEnemy === enemy) {
            this.selectNextTarget();
        }
        
        // 보상 계산 (아이템 드롭 등) - 보스전 승리가 아닐 때만
        if (!(enemy.isBoss && this.checkAllEnemiesDead())) {
            this.calculateRewards(enemy);
        }
    }

    /**
     * 다음 타겟 선택
     */
    selectNextTarget() {
        // 살아있는 다음 적 찾기
        const aliveEnemies = this.enemies.filter(e => !e.isDead);
        
        if (aliveEnemies.length > 0) {
            this.targetEnemy = aliveEnemies[0];
            this.highlightTargetEnemy();
        } else {
            this.targetEnemy = null;
        }
    }

    /**
     * 타겟 적 하이라이트
     */
    highlightTargetEnemy() {
        // 모든 적 테두리 초기화
        for (const enemy of this.enemies) {
            enemy.targetBorder.clear();
        }
        
        // 현재 타겟만 테두리 설정
        if (this.targetEnemy) {
            this.targetEnemy.targetBorder.clear();
            this.targetEnemy.targetBorder.lineStyle(3, 0xFFFF00, 0.8);
            this.targetEnemy.targetBorder.strokeCircle(
                this.targetEnemy.x,
                this.targetEnemy.y,
                80
            );
        }
    }

    /**
     * 플레이어 체력 회복
     * @param {number} amount - 회복량
     */
    healPlayer(amount) {
        // 회복 전 체력
        const beforeHealth = this.player.health;
        
        // 체력 회복
        this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
        
        // 실제 회복량
        const actualHeal = this.player.health - beforeHealth;
        
        // 회복 이펙트
        if (actualHeal > 0) {
            this.effectsManager.playHealEffect(this.player);
            
            // 회복 텍스트 표시
            this.showHealText(this.player.x, this.player.y - 50, actualHeal);
            
            // 플레이어 UI 업데이트
            this.updatePlayerStats();
        }
    }

    /**
     * 플레이어 마나 회복
     * @param {number} amount - 회복량
     */
    restoreMana(amount) {
        // 회복 전 마나
        const beforeMana = this.player.mana;
        
        // 마나 회복
        this.player.mana = Math.min(this.player.maxMana, this.player.mana + amount);
        
        // 실제 회복량
        const actualRestore = this.player.mana - beforeMana;
        
        // 회복 이펙트
        if (actualRestore > 0) {
            this.effectsManager.playPotionEffect(this.player, 'mana');
            
            // 마나 회복 텍스트 표시
            this.showManaText(this.player.x, this.player.y - 50, actualRestore);
            
            // 플레이어 UI 업데이트
            this.updatePlayerStats();
        }
    }

    /**
     * 플레이어 정보 업데이트
     */
    updatePlayerStats() {
        // 체력바 업데이트
        const healthBar = this.player.statsBar.getAt(0);
        const hpText = this.player.statsBar.getAt(2);
        
        healthBar.clear();
        healthBar.fillStyle(0x00AA00, 1);
        healthBar.fillRect(-50, 0, 100 * (this.player.health / this.player.maxHealth), 12);
        healthBar.lineStyle(1, 0xFFFFFF, 1);
        healthBar.strokeRect(-50, 0, 100, 12);
        
        hpText.setText(`${Math.floor(this.player.health)}/${this.player.maxHealth}`);
        
        // 마나바 업데이트
        const manaBar = this.player.statsBar.getAt(1);
        const mpText = this.player.statsBar.getAt(3);
        
        manaBar.clear();
        manaBar.fillStyle(0x0066CC, 1);
        manaBar.fillRect(-50, 15, 100 * (this.player.mana / this.player.maxMana), 8);
        manaBar.lineStyle(1, 0xFFFFFF, 1);
        manaBar.strokeRect(-50, 15, 100, 8);
        
        mpText.setText(`${Math.floor(this.player.mana)}/${this.player.maxMana}`);
    }

    /**
     * 적 정보 업데이트
     * @param {Object} enemy - 업데이트할 적
     */
    updateEnemyStats(enemy) {
        // 체력바 업데이트
        const healthBar = enemy.statsBar.getAt(0);
        const hpText = enemy.statsBar.getAt(1);
        const barWidth = enemy.isBoss ? 150 : 80;
        
        healthBar.clear();
        healthBar.fillStyle(0xAA0000, 1);
        healthBar.fillRect(-barWidth/2, 0, barWidth * (enemy.health / enemy.maxHealth), 10);
        healthBar.lineStyle(1, 0xFFFFFF, 1);
        healthBar.strokeRect(-barWidth/2, 0, barWidth, 10);
        
        hpText.setText(`${Math.floor(enemy.health)}/${enemy.maxHealth}`);
    }

    /**
     * 대미지 텍스트 표시
     * @param {number} x - x 위치
     * @param {number} y - y 위치
     * @param {number} damage - 대미지 양
     * @param {boolean} isCritical - 치명타 여부
     * @param {string} element - 속성
     */
    showDamageText(x, y, damage, isCritical, element) {
        // 대미지 텍스트 색상 (속성별)
        const colors = {
            'fire': '#FF4400',
            'ice': '#00CCFF',
            'earth': '#88AA00',
            'lightning': '#FFCC00',
            'water': '#0088FF',
            'holy': '#FFFF80',
            'dark': '#AA00AA',
            'neutral': '#FFFFFF'
        };
        
        // 텍스트 색상 및 크기
        const color = colors[element] || '#FFFFFF';
        const size = isCritical ? '24px' : '20px';
        
        // 텍스트 표시
        const text = this.add.text(x, y, damage.toString(), {
            fontSize: size,
            fontFamily: 'Arial, sans-serif',
            color: color,
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: isCritical ? 'bold' : 'normal'
        }).setOrigin(0.5, 0.5);
        
        // 치명타 효과
        if (isCritical) {
            text.setText(`${damage} 치명타!`);
        }
        
        // 텍스트 애니메이션
        this.tweens.add({
            targets: text,
            y: y - 50,
            alpha: 0,
            scale: isCritical ? 1.5 : 1.2,
            duration: 1000,
            onComplete: () => {
                text.destroy();
            }
        });
    }

    /**
     * 회복 텍스트 표시
     * @param {number} x - x 위치
     * @param {number} y - y 위치
     * @param {number} amount - 회복량
     */
    showHealText(x, y, amount) {
        // 텍스트 표시
        const text = this.add.text(x, y, `+${amount} HP`, {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#00FF00',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);
        
        // 텍스트 애니메이션
        this.tweens.add({
            targets: text,
            y: y - 50,
            alpha: 0,
            scale: 1.2,
            duration: 1000,
            onComplete: () => {
                text.destroy();
            }
        });
    }

    /**
     * 마나 회복 텍스트 표시
     * @param {number} x - x 위치
     * @param {number} y - y 위치
     * @param {number} amount - 회복량
     */
    showManaText(x, y, amount) {
        // 텍스트 표시
        const text = this.add.text(x, y, `+${amount} MP`, {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#00AAFF',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);
        
        // 텍스트 애니메이션
        this.tweens.add({
            targets: text,
            y: y - 50,
            alpha: 0,
            scale: 1.2,
            duration: 1000,
            onComplete: () => {
                text.destroy();
            }
        });
    }

    /**
     * 상태효과 추가
     * @param {Object} target - 대상 (플레이어 또는 적)
     * @param {Object} effectData - 상태효과 데이터
     */
    addStatusEffect(target, effectData) {
        // 기존 같은 타입 효과 확인
        const existingIndex = target.statusEffects.findIndex(
            effect => effect.type === effectData.type && effect.name === effectData.name
        );
        
        if (existingIndex >= 0) {
            // 기존 효과 갱신
            target.statusEffects[existingIndex].duration = effectData.duration;
            
            // 갱신 이펙트
            this.effectsManager.playStatusEffectRefresh(target, effectData.type);
        } else {
            // 새 효과 추가
            target.statusEffects.push({ ...effectData });
            
            // 적용 이펙트
            this.effectsManager.playStatusEffectApply(target, effectData.type);
            
            // 상태효과 아이콘 추가
            this.addStatusEffectIcon(target, effectData);
        }
    }

    /**
     * 상태효과 아이콘 추가
     * @param {Object} target - 대상 (플레이어 또는 적)
     * @param {Object} effectData - 상태효과 데이터
     */
    addStatusEffectIcon(target, effectData) {
        // 아이콘 위치 계산
        const iconX = target.statusIconsX + (target.statusIcons.length * 25);
        const iconY = target.statusIconsY;
        
        // 효과 타입에 따른 아이콘
        const iconKey = {
            'buff': 'buff',
            'debuff': 'debuff',
            'poison': 'poison',
            'burn': 'burn',
            'freeze': 'freeze',
            'stun': 'stun',
            'defend': 'shield'
        }[effectData.type] || 'buff';
        
        // 아이콘 생성
        const icon = this.add.image(iconX, iconY, 'status_icons', iconKey);
        icon.setScale(0.8);
        
        // 지속시간 텍스트
        const durationText = this.add.text(iconX, iconY + 15, effectData.duration.toString(), {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        
        // 아이콘 그룹 추가
        target.statusIcons.push({ icon: icon, text: durationText, type: effectData.type });
    }

    /**
     * 상태효과 업데이트
     * @param {Object} target - 대상 (플레이어 또는 적)
     */
    updateStatusEffects(target) {
        // 각 상태효과 처리
        for (let i = target.statusEffects.length - 1; i >= 0; i--) {
            const effect = target.statusEffects[i];
            
            // 지속시간 감소
            effect.duration--;
            
            // 상태효과 지속
            if (effect.duration > 0) {
                // 상태효과 아이콘 지속시간 업데이트
                if (target.statusIcons[i]) {
                    target.statusIcons[i].text.setText(effect.duration.toString());
                }
                
                // 효과 적용 (DoT, HoT 등)
                this.applyStatusEffect(target, effect);
            }
            // 상태효과 종료
            else {
                // 제거 이펙트
                this.effectsManager.playStatusEffectRemove(target, effect.type);
                
                // 아이콘 제거
                if (target.statusIcons[i]) {
                    target.statusIcons[i].icon.destroy();
                    target.statusIcons[i].text.destroy();
                    target.statusIcons.splice(i, 1);
                }
                
                // 효과 제거
                target.statusEffects.splice(i, 1);
            }
        }
        
        // 상태효과 아이콘 재정렬
        this.realignStatusIcons(target);
    }

    /**
     * 상태효과 적용
     * @param {Object} target - 대상 (플레이어 또는 적)
     * @param {Object} effect - 상태효과 데이터
     */
    applyStatusEffect(target, effect) {
        switch (effect.type) {
            case 'poison':
                // 독 대미지
                const poisonDamage = effect.damage || Math.round(target.maxHealth * 0.05);
                
                // 대미지 적용
                if (target === this.player) {
                    this.player.health = Math.max(1, this.player.health - poisonDamage);
                    this.updatePlayerStats();
                    
                    // 독 대미지 텍스트
                    this.showDamageText(target.x, target.y - 30, poisonDamage, false, 'poison');
                } else {
                    target.health = Math.max(0, target.health - poisonDamage);
                    this.updateEnemyStats(target);
                    
                    // 독 대미지 텍스트
                    this.showDamageText(target.x, target.y - 30, poisonDamage, false, 'poison');
                    
                    // 적 사망 확인
                    if (target.health <= 0 && !target.isDead) {
                        this.killEnemy(target);
                    }
                }
                
                // 독 이펙트
                this.effectsManager.playStatusEffectApply(target, 'poison');
                break;
                
            case 'burn':
                // 화상 대미지
                const burnDamage = effect.damage || Math.round(target.maxHealth * 0.08);
                
                // 대미지 적용
                if (target === this.player) {
                    this.player.health = Math.max(1, this.player.health - burnDamage);
                    this.updatePlayerStats();
                    
                    // 화상 대미지 텍스트
                    this.showDamageText(target.x, target.y - 30, burnDamage, false, 'fire');
                } else {
                    target.health = Math.max(0, target.health - burnDamage);
                    this.updateEnemyStats(target);
                    
                    // 화상 대미지 텍스트
                    this.showDamageText(target.x, target.y - 30, burnDamage, false, 'fire');
                    
                    // 적 사망 확인
                    if (target.health <= 0 && !target.isDead) {
                        this.killEnemy(target);
                    }
                }
                
                // 화상 이펙트
                this.effectsManager.playFireEffect(target);
                break;
                
            case 'heal':
                // 회복 효과
                const healAmount = effect.heal || Math.round(target.maxHealth * 0.05);
                
                // 회복 적용
                if (target === this.player) {
                    this.healPlayer(healAmount);
                } else {
                    target.health = Math.min(target.maxHealth, target.health + healAmount);
                    this.updateEnemyStats(target);
                    
                    // 회복 텍스트
                    this.showHealText(target.x, target.y - 30, healAmount);
                }
                
                // 회복 이펙트
                this.effectsManager.playHealEffect(target);
                break;
                
            // 기타 효과들은 자동 적용 (버프, 디버프 등은 계산 시 자동으로 적용됨)
        }
    }

    /**
     * 상태효과 아이콘 재정렬
     * @param {Object} target - 대상 (플레이어 또는 적)
     */
    realignStatusIcons(target) {
        // 각 아이콘 위치 조정
        for (let i = 0; i < target.statusIcons.length; i++) {
            const icon = target.statusIcons[i].icon;
            const text = target.statusIcons[i].text;
            
            // 새 위치 계산
            const iconX = target.statusIconsX + (i * 25);
            const iconY = target.statusIconsY;
            
            // 위치 설정
            icon.setPosition(iconX, iconY);
            text.setPosition(iconX, iconY + 15);
        }
    }

    /**
     * 스킬 쿨다운 감소
     */
    decreaseCooldowns() {
        // 플레이어 스킬 쿨다운 감소
        for (const skill of this.player.skills) {
            if (skill.currentCooldown && skill.currentCooldown > 0) {
                skill.currentCooldown--;
            }
        }
        
        // 궁극기 쿨다운 감소
        if (this.player.ultimateSkill && this.player.ultimateSkill.currentCooldown > 0) {
            this.player.ultimateSkill.currentCooldown--;
        }
        
        // 스킬 버튼 상태 업데이트 (플레이어 턴에만)
        if (this.currentTurn === 'player') {
            this.updateSkillButtons();
        }
    }
    
    /**
     * 전투 종료 처리
     * @param {boolean} victory - 승리 여부
     */
    endBattle(victory) {
        // 전투 결과 저장
        this.combatResults.victory = victory;
        
        // 액션 UI 비활성화
        this.enablePlayerActions(false);
        
        if (victory) {
            // 승리 처리
            this.handleVictory();
        } else {
            // 패배 처리
            this.handleDefeat();
        }
    }

    /**
     * 승리 처리
     */
    handleVictory() {
        // 승리 메시지
        let victoryMessage = '전투 승리!';
        if (this.battleData.isBossBattle) {
            victoryMessage = '보스 처치 성공!';
        }
        
        // 승리 메시지 표시
        this.showBattleMessage(victoryMessage, 1500);
        
        // 승리 효과음
        this.sound.play('victory');
        
        // 플레이어 승리 애니메이션
        this.player.sprite.play('player-victory');
        
        // 승리 보상 계산
        this.calculateFinalRewards();
        
        // 페이드 아웃
        this.time.delayedCall(2000, () => {
            this.cameras.main.fadeOut(1000);
            
            // 결과 화면으로 전환
            this.time.delayedCall(1000, () => {
                // 음악 정지
                if (this.bgMusic) {
                    this.bgMusic.stop();
                }
                
                // 게임오버 씬으로 전환
                this.scene.start('GameOver', {
                    victory: true,
                    dungeonId: this.battleData.dungeonId,
                    isBossBattle: this.battleData.isBossBattle,
                    rewards: this.rewards,
                    stats: this.combatResults
                });
            });
        });
    }

    /**
     * 패배 처리
     */
    handleDefeat() {
        // 패배 메시지
        this.showBattleMessage('전투 패배...', 1500);
        
        // 패배 효과음
        this.sound.play('defeat');
        
        // 페이드 아웃
        this.time.delayedCall(2000, () => {
            this.cameras.main.fadeOut(1000);
            
            // 결과 화면으로 전환
            this.time.delayedCall(1000, () => {
                // 음악 정지
                if (this.bgMusic) {
                    this.bgMusic.stop();
                }
                
                // 게임오버 씬으로 전환
                this.scene.start('GameOver', {
                    victory: false,
                    dungeonId: this.battleData.dungeonId,
                    isBossBattle: this.battleData.isBossBattle,
                    stats: this.combatResults
                });
            });
        });
    }

    /**
     * 플레이어 사망 처리
     */
    playerDeath() {
        // 이미 처리 중이면 리턴
        if (this.combatState === 'ending') return;
        
        // 전투 종료 상태 설정
        this.combatState = 'ending';
        
        // 사망 효과음
        this.sound.play('player-death');
        
        // 사망 이펙트
        this.effectsManager.playPlayerDeathEffect(this.player);
        
        // 사망 애니메이션 (히트 애니메이션 계속)
        this.player.sprite.play('player-hit');
        
        // 전투 패배 처리
        this.time.delayedCall(1500, () => {
            this.endBattle(false);
        });
    }

    /**
     * 모든 적이 죽었는지 확인
     * @returns {boolean} 모든 적 사망 여부
     */
    checkAllEnemiesDead() {
        return this.enemies.every(enemy => enemy.isDead);
    }

    /**
     * 살아있는 적 수 가져오기
     * @returns {number} 살아있는 적 수
     */
    getAliveEnemyCount() {
        return this.enemies.filter(enemy => !enemy.isDead).length;
    }

    /**
     * 보상 계산 (적 처치 시)
     * @param {Object} enemy - 처치한 적
     */
    calculateRewards(enemy) {
        // 경험치 기본값
        const baseExp = enemy.data.loot?.experience?.min || 10;
        const maxExp = enemy.data.loot?.experience?.max || baseExp * 1.5;
        
        // 골드 기본값
        const baseGold = enemy.data.loot?.gold?.min || 5;
        const maxGold = enemy.data.loot?.gold?.max || baseGold * 1.5;
        
        // 적 레벨 및 유형에 따른 보상 계산
        let expMultiplier = 1.0;
        let goldMultiplier = 1.0;
        
        // 보스 및 엘리트는 추가 보상
        if (enemy.isBoss) {
            expMultiplier = 5.0;
            goldMultiplier = 5.0;
        } else if (enemy.isElite) {
            expMultiplier = 2.0;
            goldMultiplier = 2.0;
        }
        
        // 적 레벨에 따른 추가 보상
        expMultiplier += (enemy.level - 1) * 0.2;
        goldMultiplier += (enemy.level - 1) * 0.1;
        
        // 최종 보상 계산
        const exp = Math.round(Phaser.Math.Between(baseExp, maxExp) * expMultiplier);
        const gold = Math.round(Phaser.Math.Between(baseGold, maxGold) * goldMultiplier);
        
        // 보상 누적
        this.rewards.experience += exp;
        this.rewards.gold += gold;
        
        // 아이템 드롭 확률 계산
        if (enemy.data.loot?.dropChance && Math.random() < enemy.data.loot.dropChance) {
            // 드롭할 아이템 선택
            this.rollItemDrop(enemy);
        }
    }

    /**
     * 아이템 드롭 계산
     * @param {Object} enemy - 처치한 적
     */
    rollItemDrop(enemy) {
        // 드롭 가능한 아이템이 없으면 리턴
        if (!enemy.data.loot?.possibleItems || enemy.data.loot.possibleItems.length === 0) return;
        
        // 랜덤 아이템 선택
        const possibleItems = enemy.data.loot.possibleItems;
        const itemId = possibleItems[Phaser.Math.Between(0, possibleItems.length - 1)];
        
        // 아이템 정보 가져오기
        const itemData = this.getItemData(itemId);
        if (!itemData) return;
        
        // 아이템 추가
        this.rewards.items.push(itemData);
    }

    /**
     * 최종 보상 계산 (전투 종료 시)
     */
    calculateFinalRewards() {
        // 이미 누적된 보상이 있음
        
        // 보스 처치 시 추가 보상
        if (this.battleData.isBossBattle) {
            // 보스 보상 추가
            this.rewards.experience += 100;
            this.rewards.gold += 200;
            
            // 보스 특수 아이템 (특정 보스 아이템 등)
            const bossEnemy = this.enemies.find(e => e.isBoss);
            if (bossEnemy) {
                // 보스 고유 아이템이 있으면 추가
                const bossItemId = bossEnemy.data.loot?.bossItem;
                if (bossItemId) {
                    const bossItemData = this.getItemData(bossItemId);
                    if (bossItemData) {
                        this.rewards.items.push(bossItemData);
                    }
                }
            }
        }
        
        // 전투 결과 통계에 따른 추가 보상
        
        // 치명타 5회 이상 보너스
        if (this.combatResults.criticalHits >= 5) {
            this.rewards.experience += 50;
        }
        
        // 대미지 1000 이상 보너스
        if (this.combatResults.playerDamageDealt >= 1000) {
            this.rewards.gold += 50;
        }
        
        // 보상 반올림
        this.rewards.experience = Math.round(this.rewards.experience);
        this.rewards.gold = Math.round(this.rewards.gold);
    }

    /**
     * 전투 결과 초기화
     */
    resetCombatResults() {
        this.combatResults = {
            exp: 0,
            gold: 0,
            items: [],
            victory: false,
            playerDamageDealt: 0,
            enemiesDefeated: 0,
            criticalHits: 0,
            turnCount: 0,
            skillsUsed: 0
        };
        
        this.rewards = {
            experience: 0,
            gold: 0,
            items: []
        };
    }

    /**
     * 게임 일시 정지
     */
    pauseGame() {
        // 이미 일시 정지 상태이면 리턴
        if (this.scene.isPaused()) return;
        
        // 일시 정지 소리
        this.sound.play('menu-open', { volume: 0.5 });
        
        // 일시 정지 메뉴 표시
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 일시 정지 UI 컨테이너
        this.pauseContainer = this.add.container(width / 2, height / 2);
        this.pauseContainer.setDepth(1000);
        
        // 반투명 배경
        const pauseBg = this.add.graphics();
        pauseBg.fillStyle(0x000000, 0.7);
        pauseBg.fillRect(-width / 2, -height / 2, width, height);
        this.pauseContainer.add(pauseBg);
        
        // 일시 정지 패널
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x222222, 0.9);
        panelBg.fillRoundedRect(-200, -150, 400, 300, 20);
        panelBg.lineStyle(3, 0x444444, 0.8);
        panelBg.strokeRoundedRect(-200, -150, 400, 300, 20);
        this.pauseContainer.add(panelBg);
        
        // 제목
        const title = this.add.text(0, -120, '게임 일시 정지', {
            fontSize: '28px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        this.pauseContainer.add(title);
        
        // 메뉴 버튼 생성
        const resumeButton = this.createPauseMenuButton(0, -50, '게임 계속하기', () => {
            this.resumeGame();
        });
        
        const optionsButton = this.createPauseMenuButton(0, 0, '옵션', () => {
            // 옵션 메뉴를 여기서 구현 (간단한 예시에서는 생략)
            this.showNotification('옵션 메뉴는 현재 구현되지 않았습니다.');
        });
        
        const quitButton = this.createPauseMenuButton(0, 50, '던전으로 돌아가기', () => {
            this.confirmQuitBattle();
        });
        
        // 음악/효과음 조절 슬라이더 (간단한 예시에서는 생략)
        
        // 씬 일시 정지
        this.scene.pause();
    }

    /**
     * 일시 정지 메뉴 버튼 생성
     * @param {number} x - x 위치
     * @param {number} y - y 위치
     * @param {string} text - 버튼 텍스트
     * @param {Function} callback - 클릭 콜백
     * @returns {Object} 버튼 객체
     */
    createPauseMenuButton(x, y, text, callback) {
        const button = this.add.graphics();
        button.fillStyle(0x333333, 1);
        button.fillRoundedRect(x - 150, y - 20, 300, 40, 10);
        button.lineStyle(2, 0x666666, 1);
        button.strokeRoundedRect(x - 150, y - 20, 300, 40, 10);
        
        const buttonText = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5, 0.5);
        
        // 히트 영역
        const hitArea = this.add.zone(x - 150, y - 20, 300, 40);
        hitArea.setOrigin(0, 0);
        hitArea.setInteractive({ useHandCursor: true });
        
        // 클릭 이벤트
        hitArea.on('pointerup', callback);
        
        // 호버 효과
        hitArea.on('pointerover', () => {
            button.clear();
            button.fillStyle(0x444444, 1);
            button.fillRoundedRect(x - 150, y - 20, 300, 40, 10);
            button.lineStyle(2, 0x888888, 1);
            button.strokeRoundedRect(x - 150, y - 20, 300, 40, 10);
            buttonText.setColor('#FFFFFF');
        });
        
        hitArea.on('pointerout', () => {
            button.clear();
            button.fillStyle(0x333333, 1);
            button.fillRoundedRect(x - 150, y - 20, 300, 40, 10);
            button.lineStyle(2, 0x666666, 1);
            button.strokeRoundedRect(x - 150, y - 20, 300, 40, 10);
            buttonText.setColor('#FFFFFF');
        });
        
        this.pauseContainer.add([button, buttonText, hitArea]);
        
        return { button, text: buttonText, hitArea };
    }

    /**
     * 게임 재개
     */
    resumeGame() {
        // 재개 효과음
        this.sound.play('menu-close', { volume: 0.5 });
        
        // 일시 정지 UI 제거
        if (this.pauseContainer) {
            this.pauseContainer.destroy();
            this.pauseContainer = null;
        }
        
        // 씬 재개
        this.scene.resume();
    }

    /**
     * 전투 포기 확인
     */
    confirmQuitBattle() {
        // 확인 창 생성
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // 확인 UI 컨테이너
        const confirmContainer = this.add.container(width / 2, height / 2);
        confirmContainer.setDepth(1001);
        
        // 배경
        const confirmBg = this.add.graphics();
        confirmBg.fillStyle(0x000000, 0.8);
        confirmBg.fillRoundedRect(-200, -100, 400, 200, 15);
        confirmBg.lineStyle(2, 0x666666, 1);
        confirmBg.strokeRoundedRect(-200, -100, 400, 200, 15);
        confirmContainer.add(confirmBg);
        
        // 확인 메시지
        const confirmText = this.add.text(0, -50, '정말 전투를 포기하시겠습니까?\n모든 진행 상황이 손실됩니다.', {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5, 0.5);
        confirmContainer.add(confirmText);
        
        // 확인 버튼
        const confirmButton = this.add.graphics();
        confirmButton.fillStyle(0x880000, 1);
        confirmButton.fillRoundedRect(-150, 20, 140, 40, 10);
        confirmButton.lineStyle(2, 0xAA0000, 1);
        confirmButton.strokeRoundedRect(-150, 20, 140, 40, 10);
        
        const confirmButtonText = this.add.text(-80, 40, '포기하기', {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5, 0.5);
        
        // 취소 버튼
        const cancelButton = this.add.graphics();
        cancelButton.fillStyle(0x333333, 1);
        cancelButton.fillRoundedRect(10, 20, 140, 40, 10);
        cancelButton.lineStyle(2, 0x666666, 1);
        cancelButton.strokeRoundedRect(10, 20, 140, 40, 10);
        
        const cancelButtonText = this.add.text(80, 40, '취소', {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        }).setOrigin(0.5, 0.5);
        
        // 버튼 히트 영역
        const confirmHitArea = this.add.zone(-150, 20, 140, 40);
        confirmHitArea.setOrigin(0, 0);
        confirmHitArea.setInteractive({ useHandCursor: true });
        
        const cancelHitArea = this.add.zone(10, 20, 140, 40);
        cancelHitArea.setOrigin(0, 0);
        cancelHitArea.setInteractive({ useHandCursor: true });
        
        // 클릭 이벤트
        confirmHitArea.on('pointerup', () => {
            // 효과음
            this.sound.play('menu-close', { volume: 0.5 });
            
            // 컨테이너 제거
            confirmContainer.destroy();
            
            // 던전으로 돌아가기
            this.quitBattle();
        });
        
        cancelHitArea.on('pointerup', () => {
            // 효과음
            this.sound.play('button-click', { volume: 0.3 });
            
            // 컨테이너 제거
            confirmContainer.destroy();
        });
        
        // 호버 효과
        confirmHitArea.on('pointerover', () => {
            confirmButton.clear();
            confirmButton.fillStyle(0xAA0000, 1);
            confirmButton.fillRoundedRect(-150, 20, 140, 40, 10);
            confirmButton.lineStyle(2, 0xCC0000, 1);
            confirmButton.strokeRoundedRect(-150, 20, 140, 40, 10);
        });
        
        confirmHitArea.on('pointerout', () => {
            confirmButton.clear();
            confirmButton.fillStyle(0x880000, 1);
            confirmButton.fillRoundedRect(-150, 20, 140, 40, 10);
            confirmButton.lineStyle(2, 0xAA0000, 1);
            confirmButton.strokeRoundedRect(-150, 20, 140, 40, 10);
        });
        
        cancelHitArea.on('pointerover', () => {
            cancelButton.clear();
            cancelButton.fillStyle(0x444444, 1);
            cancelButton.fillRoundedRect(10, 20, 140, 40, 10);
            cancelButton.lineStyle(2, 0x888888, 1);
            cancelButton.strokeRoundedRect(10, 20, 140, 40, 10);
        });
        
        cancelHitArea.on('pointerout', () => {
            cancelButton.clear();
            cancelButton.fillStyle(0x333333, 1);
            cancelButton.fillRoundedRect(10, 20, 140, 40, 10);
            cancelButton.lineStyle(2, 0x666666, 1);
            cancelButton.strokeRoundedRect(10, 20, 140, 40, 10);
        });
        
        // 컨테이너에 추가
        confirmContainer.add([
            confirmButton, confirmButtonText, confirmHitArea,
            cancelButton, cancelButtonText, cancelHitArea
        ]);
        
        // 일시 정지 UI 위에 표시
        if (this.pauseContainer) {
            this.pauseContainer.add(confirmContainer);
        }
    }

    /**
     * 전투 포기하고 던전으로 돌아가기
     */
    quitBattle() {
        // 전투 패배 기록
        this.combatResults.victory = false;
        
        // 페이드 아웃
        this.cameras.main.fadeOut(1000);
        
        // 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }
        
        // 던전 씬으로 돌아가기
        this.time.delayedCall(1000, () => {
            this.scene.start(this.battleData.returnScene, { quitBattle: true });
        });
    }

    /**
     * 알림 표시
     * @param {string} message - 알림 메시지
     */
    showNotification(message) {
        // 알림 UI 생성
        const width = this.cameras.main.width;
        
        // 알림 컨테이너
        const notificationContainer = this.add.container(width / 2, 100);
        notificationContainer.setDepth(1002);
        
        // 배경
        const notificationBg = this.add.graphics();
        notificationBg.fillStyle(0x000000, 0.7);
        notificationBg.fillRoundedRect(-150, -20, 300, 40, 10);
        notificationBg.lineStyle(2, 0x444444, 0.8);
        notificationBg.strokeRoundedRect(-150, -20, 300, 40, 10);
        notificationContainer.add(notificationBg);
        
        // 메시지
        const notificationText = this.add.text(0, 0, message, {
            fontSize: '16px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF',
            align: 'center'
        }).setOrigin(0.5, 0.5);
        notificationContainer.add(notificationText);
        
        // 애니메이션
        notificationContainer.alpha = 0;
        this.tweens.add({
            targets: notificationContainer,
            alpha: 1,
            y: 120,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                // 3초 후 페이드 아웃
                this.time.delayedCall(3000, () => {
                    this.tweens.add({
                        targets: notificationContainer,
                        alpha: 0,
                        y: 140,
                        duration: 300,
                        ease: 'Power2',
                        onComplete: () => {
                            notificationContainer.destroy();
                        }
                    });
                });
            }
        });
    }

    /**
     * 장착된 무기 타입 가져오기
     * @returns {string} 무기 타입
     */
    getEquippedWeaponType() {
        // 플레이어 장착 무기 확인
        const weaponId = this.player.equipment.weapon;
        if (!weaponId) return 'sword'; // 기본값
        
        // 무기 정보 가져오기
        const weapon = this.getItemData(weaponId);
        if (!weapon) return 'sword';
        
        return weapon.subType || 'sword';
    }

    /**
     * 아이템 데이터 가져오기
     * @param {string} itemId - 아이템 ID
     * @returns {Object} 아이템 데이터
     */
    getItemData(itemId) {
        // 아이템 데이터 캐시
        if (!this.itemDataCache) {
            // JSON 파일에서 아이템 데이터 가져오기
            const itemsData = this.cache.json.get('items');
            
            // 아이템 ID로 빠르게 검색하기 위한 맵 생성
            this.itemDataCache = {};
            for (const item of itemsData) {
                this.itemDataCache[item.id] = item;
            }
        }
        
        return this.itemDataCache[itemId];
    }

    /**
     * 몬스터 데이터 가져오기
     * @param {string} monsterId - 몬스터 ID
     * @returns {Object} 몬스터 데이터
     */
    getMonsterData(monsterId) {
        // 몬스터 데이터 캐시
        if (!this.monsterDataCache) {
            // JSON 파일에서 몬스터 데이터 가져오기
            const monstersData = this.cache.json.get('monsters');
            
            // 몬스터 ID로 빠르게 검색하기 위한 맵 생성
            this.monsterDataCache = {};
            for (const monster of monstersData) {
                this.monsterDataCache[monster.id] = monster;
            }
        }
        
        return this.monsterDataCache[monsterId];
    }

    /**
     * 던전 타입 가져오기
     * @param {string} dungeonId - 던전 ID
     * @returns {string} 던전 타입
     */
    getDungeonType(dungeonId) {
        // 던전 데이터 캐시
        if (!this.dungeonDataCache) {
            // JSON 파일에서 던전 데이터 가져오기
            const dungeonData = this.cache.json.get('dungeons');
            
            // 던전 ID로 빠르게 검색하기 위한 맵 생성
            this.dungeonDataCache = {};
            for (const dungeon of dungeonData.dungeons) {
                this.dungeonDataCache[dungeon.id] = dungeon;
            }
        }
        
        // 던전 타입 반환
        if (this.dungeonDataCache[dungeonId]) {
            return this.dungeonDataCache[dungeonId].type;
        }
        
        return 'forest'; // 기본값
    }

    /**
     * 몬스터 스탯 계산
     * @param {Object} monsterData - 몬스터 기본 데이터
     * @param {number} level - 몬스터 레벨
     * @param {number} difficulty - 던전 난이도
     * @returns {Object} 계산된 몬스터 스탯
     */
    calculateMonsterStats(monsterData, level, difficulty) {
        const baseStats = monsterData.baseStats;
        const growthRate = monsterData.growthRate;
        
        // 레벨에 따른 스탯 성장
        const levelMultiplier = 1 + (level - 1) * 0.2;
        
        // 난이도에 따른 추가 보정
        const difficultyMultiplier = 1 + (difficulty - 1) * 0.25;
        
        // 최종 스탯 계산
        return {
            hp: Math.floor(baseStats.hp * levelMultiplier * difficultyMultiplier),
            attack: Math.floor(baseStats.attack * levelMultiplier * difficultyMultiplier),
            defense: Math.floor(baseStats.defense * levelMultiplier * difficultyMultiplier),
            speed: Math.floor(baseStats.speed * levelMultiplier)
        };
    }

    /**
     * 스탯 이름 가져오기
     * @param {string} stat - 스탯 ID
     * @returns {string} 스탯 한글 이름
     */
    getStatName(stat) {
        const statNames = {
            'hp': 'HP',
            'attack': '공격력',
            'defense': '방어력',
            'speed': '속도',
            'critRate': '치명타 확률',
            'critDamage': '치명타 피해',
            'magicPower': '마법력',
            'luck': '행운'
        };
        
        return statNames[stat] || stat;
    }

    /**
     * 희귀도 색상 가져오기
     * @param {string} rarity - 희귀도
     * @returns {number} 희귀도 색상 코드
     */
    getRarityColor(rarity) {
        const rarityColors = {
            'common': 0xFFFFFF,     // 하얀색
            'uncommon': 0x00FF00,   // 녹색
            'rare': 0x0088FF,       // 파란색
            'epic': 0xAA00FF,       // 보라색
            'legendary': 0xFF8800,  // 주황색
            'mythic': 0xFF0000      // 빨간색
        };
        
        return rarityColors[rarity] || 0xFFFFFF;
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 키보드 이벤트
        this.input.keyboard.on('keydown-ESC', () => {
            this.pauseGame();
        });
        
        // 적 클릭 이벤트 (대상 선택)
        for (const enemy of this.enemies) {
            enemy.sprite.setInteractive({ useHandCursor: true });
            
            enemy.sprite.on('pointerup', () => {
                // 플레이어 턴에만 대상 선택 가능
                if (this.currentTurn === 'player' && !enemy.isDead && !this.actionInProgress) {
                    this.targetEnemy = enemy;
                    this.highlightTargetEnemy();
                }
            });
        }
        
        // 씬 종료 이벤트
        this.events.once('shutdown', this.shutdown, this);
    }

    /**
     * 업데이트 (매 프레임)
     * @param {number} time - 시간
     * @param {number} delta - 경과 시간
     */
    update(time, delta) {
        // 상태 효과 시각 효과 업데이트 (필요 시)
        
        // 플레이어 입력 처리 (필요 시)
        
        // 기타 필요한 업데이트 로직
    }

    /**
     * 정리 작업
     */
    shutdown() {
        // 이벤트 리스너 정리
        this.input.keyboard.off('keydown-ESC');
        
        // 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }
        
        // 타이머 정리
        this.time.removeAllEvents();
    }
}

export default Combat;