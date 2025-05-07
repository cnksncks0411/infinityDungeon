/**
 * GameOver.js
 * 
 * 게임 오버 화면을 구현하는 씬
 * 플레이어 사망 또는 던전 클리어 시 결과와 통계를 표시합니다.
 */
class GameOver extends Phaser.Scene {
    constructor() {
        super({
            key: 'GameOver'
        });

        this.isVictory = false;
        this.stats = null;
        this.dungeonInfo = null;
        this.playerClass = null;
        this.returnScene = 'Character'; // 기본 복귀 씬
        this.bgMusic = null;
    }

    /**
     * 씬 초기화
     * @param {Object} data - 전달 데이터
     */
    init(data) {
        this.isVictory = data.isVictory || false;
        this.stats = data.stats || {};
        this.dungeonInfo = data.dungeonInfo || null;
        this.playerClass = data.playerClass || null;
        this.returnScene = data.returnScene || 'Character';
    }

    /**
     * 필요한 추가 에셋 로드
     */
    preload() {
        // 추가 에셋이 필요한 경우 여기서 로드
    }

    /**
     * 게임 오버 화면 생성
     */
    create() {
        // 배경 설정
        this.createBackground();

        // 배경 음악 재생
        this.playBackgroundMusic();

        // UI 생성
        this.createUI();

        // 결과 정보 표시
        this.displayResultInfo();

        // 버튼 생성
        this.createButtons();

        // 이벤트 리스너 설정
        this.setupEventListeners();

        // 게임 저장
        this.saveGame();

        // 페이드 인 효과
        this.cameras.main.fadeIn(1000);
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
        this.overlay.fillStyle(0x000000, 0.8);
        this.overlay.fillRect(0, 0, width, height);

        // 승리/패배에 따른 효과
        if (this.isVictory) {
            // 승리 효과 (황금빛 파티클)
            this.victoryParticles = this.add.particles('particle-spark');

            this.victoryEmitter = this.victoryParticles.createEmitter({
                x: { min: 0, max: width },
                y: { min: 0, max: height },
                scale: { start: 0.2, end: 0 },
                alpha: { start: 0.5, end: 0 },
                speed: 10,
                angle: { min: 0, max: 360 },
                rotate: { min: 0, max: 360 },
                lifespan: { min: 2000, max: 8000 },
                frequency: 500,
                blendMode: 'ADD',
                tint: 0xFFD700
            });
        } else {
            // 패배 효과 (회색 파티클)
            this.defeatParticles = this.add.particles('particle-dust');

            this.defeatEmitter = this.defeatParticles.createEmitter({
                x: { min: 0, max: width },
                y: { min: height / 2, max: height },
                scale: { start: 0.2, end: 0 },
                alpha: { start: 0.3, end: 0 },
                speed: 15,
                angle: { min: 250, max: 290 },
                rotate: { min: 0, max: 360 },
                lifespan: { min: 2000, max: 5000 },
                frequency: 300,
                blendMode: 'NORMAL',
                tint: 0x888888
            });
        }
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

        // 승리/패배 음악 선택
        const musicKey = this.isVictory ? 'victory-theme' : 'defeat-theme';
        if (!this.sound.get(musicKey)) {
            // 해당 키의 음악이 없으면 대체 음악 사용
            this.bgMusic = this.sound.add('main-theme', {
                volume: this.game.registry.get('musicVolume') || 0.5,
                loop: false
            });
        } else {
            this.bgMusic = this.sound.add(musicKey, {
                volume: this.game.registry.get('musicVolume') || 0.5,
                loop: false
            });
        }

        this.bgMusic.play();

        // 현재 배경음악 등록
        this.game.registry.set('currentBGM', musicKey);
    }

    /**
     * UI 생성
     */
    createUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 제목 텍스트
        const titleText = this.isVictory ? '던전 클리어!' : '게임 오버';
        const titleColor = this.isVictory ? '#FFD700' : '#FF5555';

        this.title = this.add.text(width / 2, 100, titleText, {
            fontSize: '48px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: titleColor,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        });
        this.title.setOrigin(0.5, 0.5);

        // 애니메이션 효과
        this.tweens.add({
            targets: this.title,
            scale: { from: 0.5, to: 1 },
            duration: 500,
            ease: 'Back.easeOut'
        });

        // 결과 패널 컨테이너
        this.resultPanel = this.add.container(width / 2, height / 2);

        // 패널 배경
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x222222, 0.9);
        panelBg.fillRoundedRect(-400, -200, 800, 400, 20);
        panelBg.lineStyle(3, this.isVictory ? 0xFFD700 : 0xFF5555);
        panelBg.strokeRoundedRect(-400, -200, 800, 400, 20);
        this.resultPanel.add(panelBg);
    }

    /**
     * 결과 정보 표시
     */
    displayResultInfo() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 던전 정보 표시
        const dungeonText = `${this.dungeonInfo ? this.dungeonInfo.name : '알 수 없는 던전'}`;
        const dungeonTitle = this.add.text(width / 2, height / 2 - 180, dungeonText, {
            fontSize: '24px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center'
        });
        dungeonTitle.setOrigin(0.5, 0.5);

        // 클래스 정보
        const classText = `클래스: ${this.playerClass ? this.playerClass.name : '알 수 없음'}`;
        const classInfo = this.add.text(width / 2, height / 2 - 140, classText, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#AAAAAA',
            align: 'center'
        });
        classInfo.setOrigin(0.5, 0.5);

        // 통계 정보 (승리/패배 구분)
        if (this.isVictory) {
            this.displayVictoryStats();
        } else {
            this.displayDefeatStats();
        }
    }

    /**
     * 승리 통계 표시
     */
    displayVictoryStats() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 통계 테이블 생성
        const startY = height / 2 - 100;
        const lineHeight = 30;
        const leftX = width / 2 - 300;
        const rightX = width / 2 + 300;

        // 통계 데이터
        const stats = {
            '플레이 시간': this.formatTime(this.stats.elapsedTime || 0),
            '처치한 몬스터': `${this.stats.monstersKilled || 0}마리`,
            '보스 처치': this.stats.bossKilled ? '성공' : '실패',
            '획득한 경험치': `${this.stats.expGained || 0}`,
            '획득한 골드': `${this.stats.goldGained || 0}G`,
            '획득한 아이템': `${this.stats.itemsObtained || 0}개`,
            '발견한 보물상자': `${this.stats.chestsOpened || 0}개`,
            '방문한 방': `${this.stats.roomsVisited || 0}개`
        };

        // 중앙 라인
        const centerLine = this.add.graphics();
        centerLine.lineStyle(2, 0x555555);
        centerLine.lineBetween(width / 2, startY - 10, width / 2, startY + Object.keys(stats).length * lineHeight + 10);

        // 헤더
        const statsHeader = this.add.text(leftX, startY - 40, '던전 클리어 통계', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        });

        const rewardsHeader = this.add.text(width / 2 + 20, startY - 40, '획득한 보상', {
            fontSize: '20px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold'
        });

        // 통계 항목 표시
        let y = startY;
        for (const [key, value] of Object.entries(stats)) {
            const statKey = this.add.text(leftX, y, key, {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFFFF',
                align: 'left'
            });

            const statValue = this.add.text(leftX + 250, y, value, {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAFFAA',
                align: 'right'
            });
            statValue.setOrigin(1, 0);

            y += lineHeight;
        }

        // 보상 섹션
        if (this.stats.rewards && this.stats.rewards.length > 0) {
            // 보상 아이템 표시
            const rewardsX = width / 2 + 20;
            const rewardsStartY = startY;
            const rewardSpacing = 40;

            for (let i = 0; i < Math.min(this.stats.rewards.length, 8); i++) {
                const reward = this.stats.rewards[i];
                const rewardY = rewardsStartY + i * rewardSpacing;

                // 아이템 아이콘
                const itemIcon = this.add.image(rewardsX, rewardY + 10, 'items', reward.icon || 0);
                itemIcon.setScale(0.8);

                // 아이템 이름
                const itemName = this.add.text(rewardsX + 30, rewardY + 10, reward.name, {
                    fontSize: '16px',
                    fontFamily: 'Noto Sans KR, sans-serif',
                    color: this.getRarityColor(reward.rarity || 'common'),
                    align: 'left'
                });
                itemName.setOrigin(0, 0.5);
            }

            // 더 많은 아이템이 있을 경우
            if (this.stats.rewards.length > 8) {
                const moreText = this.add.text(rewardsX, rewardsStartY + 8 * rewardSpacing + 10, `외 ${this.stats.rewards.length - 8}개 아이템`, {
                    fontSize: '14px',
                    fontFamily: 'Noto Sans KR, sans-serif',
                    color: '#AAAAAA',
                    align: 'left'
                });
                moreText.setOrigin(0, 0.5);
            }
        } else {
            // 보상이 없는 경우
            const noRewardText = this.add.text(width / 2 + 100, startY + 50, '획득한 보상이 없습니다.', {
                fontSize: '16px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'center'
            });
            noRewardText.setOrigin(0.5, 0.5);
        }

        // 레벨업 정보
        if (this.stats.levelUp) {
            const levelUpInfo = this.add.text(width / 2, height / 2 + 170, `레벨 업! (${this.stats.levelUp.oldLevel} → ${this.stats.levelUp.newLevel})`, {
                fontSize: '22px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFF00',
                align: 'center',
                fontStyle: 'bold'
            });
            levelUpInfo.setOrigin(0.5, 0.5);

            // 레벨업 효과 애니메이션
            this.tweens.add({
                targets: levelUpInfo,
                scale: { from: 1, to: 1.2 },
                duration: 1000,
                yoyo: true,
                repeat: -1
            });
        }
    }

    /**
     * 패배 통계 표시
     */
    displayDefeatStats() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 통계 데이터
        const startY = height / 2 - 100;
        const lineHeight = 30;
        const centerX = width / 2;

        // 사망 메시지
        const deathMessage = this.add.text(centerX, startY, '당신은 던전에서 죽었습니다...', {
            fontSize: '24px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FF5555',
            fontStyle: 'bold',
            align: 'center'
        });
        deathMessage.setOrigin(0.5, 0.5);

        // 사망 원인
        const deathCause = this.stats.deathCause || '알 수 없는 원인';
        const causeText = this.add.text(centerX, startY + 40, `사망 원인: ${deathCause}`, {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF',
            align: 'center'
        });
        causeText.setOrigin(0.5, 0.5);

        // 생존 통계
        const stats = {
            '생존 시간': this.formatTime(this.stats.elapsedTime || 0),
            '처치한 몬스터': `${this.stats.monstersKilled || 0}마리`,
            '도달한 깊이': `${this.stats.depthReached || 1}층`,
            '발견한 보물상자': `${this.stats.chestsOpened || 0}개`,
            '방문한 방': `${this.stats.roomsVisited || 0}개`
        };

        // 통계 항목 표시
        let y = startY + 80;
        for (const [key, value] of Object.entries(stats)) {
            const statLabel = this.add.text(centerX - 150, y, key, {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#AAAAAA',
                align: 'left'
            });

            const statValue = this.add.text(centerX + 150, y, value, {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFFFF',
                align: 'right'
            });
            statValue.setOrigin(1, 0);

            y += lineHeight;
        }

        // 부활 가능 여부
        if (this.stats.canRevive && this.stats.revivesLeft > 0) {
            const reviveText = this.add.text(centerX, y + 30, `부활 가능! (남은 부활: ${this.stats.revivesLeft}회)`, {
                fontSize: '20px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#00FF00',
                fontStyle: 'bold',
                align: 'center'
            });
            reviveText.setOrigin(0.5, 0.5);

            // 깜박이는 효과
            this.tweens.add({
                targets: reviveText,
                alpha: { from: 1, to: 0.3 },
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        } else {
            const noReviveText = this.add.text(centerX, y + 30, '부활 불가능', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FF5555',
                align: 'center'
            });
            noReviveText.setOrigin(0.5, 0.5);
        }
    }

    /**
     * 버튼 생성
     */
    createButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const buttonY = height - 100;

        // 뒤로 가기 버튼
        const backButton = this.add.image(width / 2 - 150, buttonY, 'button');
        backButton.setScale(1.2, 1);

        const backText = this.add.text(width / 2 - 150, buttonY, '캐릭터 화면으로', {
            fontSize: '18px',
            fontFamily: 'Noto Sans KR, sans-serif',
            color: '#FFFFFF'
        });
        backText.setOrigin(0.5, 0.5);

        backButton.setInteractive({ useHandCursor: true });
        backButton.on('pointerup', () => {
            this.returnToCharacterScreen();
        });

        // 마우스 오버/아웃 효과
        backButton.on('pointerover', () => {
            backButton.setScale(1.25, 1.05);
        });

        backButton.on('pointerout', () => {
            backButton.setScale(1.2, 1);
        });

        // 부활/재시도 버튼 (패배 시) 또는 다음 던전 버튼 (승리 시)
        let actionButton;
        let actionText;

        if (this.isVictory) {
            // 다음 던전 버튼
            actionButton = this.add.image(width / 2 + 150, buttonY, 'button');
            actionButton.setScale(1.2, 1);

            actionText = this.add.text(width / 2 + 150, buttonY, '다음 던전', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFFFF'
            });
            actionText.setOrigin(0.5, 0.5);

            actionButton.setInteractive({ useHandCursor: true });
            actionButton.on('pointerup', () => {
                this.goToNextDungeon();
            });
        } else if (this.stats.canRevive && this.stats.revivesLeft > 0) {
            // 부활 버튼
            actionButton = this.add.image(width / 2 + 150, buttonY, 'button');
            actionButton.setScale(1.2, 1);

            actionText = this.add.text(width / 2 + 150, buttonY, '부활하기', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFFFF'
            });
            actionText.setOrigin(0.5, 0.5);

            actionButton.setInteractive({ useHandCursor: true });
            actionButton.on('pointerup', () => {
                this.reviveAndContinue();
            });
        } else {
            // 재시도 버튼
            actionButton = this.add.image(width / 2 + 150, buttonY, 'button');
            actionButton.setScale(1.2, 1);

            actionText = this.add.text(width / 2 + 150, buttonY, '다시 시도', {
                fontSize: '18px',
                fontFamily: 'Noto Sans KR, sans-serif',
                color: '#FFFFFF'
            });
            actionText.setOrigin(0.5, 0.5);

            actionButton.setInteractive({ useHandCursor: true });
            actionButton.on('pointerup', () => {
                this.retryDungeon();
            });
        }

        // 마우스 오버/아웃 효과
        actionButton.on('pointerover', () => {
            actionButton.setScale(1.25, 1.05);
        });

        actionButton.on('pointerout', () => {
            actionButton.setScale(1.2, 1);
        });
    }

    /**
     * 캐릭터 화면으로 돌아가기
     */
    returnToCharacterScreen() {
        // 효과음
        this.sound.play('button-click', { volume: 0.5 });

        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // 화면 전환
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('Character', { mode: 'continue' });
        });
    }

    /**
     * 다음 던전으로 이동
     */
    goToNextDungeon() {
        // 효과음
        this.sound.play('button-click', { volume: 0.5 });

        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // 화면 전환
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('DungeonSelect', {
                classId: this.playerClass ? this.playerClass.id : null
            });
        });
    }

    /**
     * 부활 후 던전 계속하기
     */
    reviveAndContinue() {
        // 효과음
        this.sound.play('button-click', { volume: 0.5 });

        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // 부활 정보 설정
        this.game.registry.set('playerRevive', true);
        this.game.registry.set('revivesLeft', this.stats.revivesLeft - 1);

        // 던전 씬으로 돌아가기
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('DungeonScene', {
                dungeonId: this.dungeonInfo ? this.dungeonInfo.id : null,
                classId: this.playerClass ? this.playerClass.id : null,
                revive: true
            });
        });
    }

    /**
     * 던전 재시도
     */
    retryDungeon() {
        // 효과음
        this.sound.play('button-click', { volume: 0.5 });

        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // 던전 선택 화면으로 돌아가기
        this.cameras.main.fadeOut(500);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('DungeonSelect', {
                classId: this.playerClass ? this.playerClass.id : null
            });
        });
    }

    /**
     * 게임 저장
     */
    saveGame() {
        // 게임 상태 저장
        this.game.config.dataManager.saveGameData();
    }

    /**
     * 시간 포맷 (초 -> MM:SS)
     * @param {number} seconds - 시간 (초)
     * @returns {string} - 포맷된 시간 문자열
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 희귀도 색상 코드 가져오기
     * @param {string} rarity - 희귀도
     * @returns {string} - 색상 코드
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
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // ESC 키로 캐릭터 화면으로
        this.input.keyboard.on('keydown-ESC', () => {
            this.returnToCharacterScreen();
        });

        // ENTER 키로 다음 단계로
        this.input.keyboard.on('keydown-ENTER', () => {
            if (this.isVictory) {
                this.goToNextDungeon();
            } else if (this.stats.canRevive && this.stats.revivesLeft > 0) {
                this.reviveAndContinue();
            } else {
                this.retryDungeon();
            }
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
        // 파티클 효과 업데이트
        if (this.isVictory && this.victoryEmitter) {
            // 승리 파티클 효과 업데이트
        } else if (!this.isVictory && this.defeatEmitter) {
            // 패배 파티클 효과 업데이트
        }
    }

    /**
     * 정리 작업
     */
    shutdown() {
        // 이벤트 리스너 정리
        this.input.keyboard.off('keydown-ESC');
        this.input.keyboard.off('keydown-ENTER');

        // 배경 음악 정지
        if (this.bgMusic) {
            this.bgMusic.stop();
        }

        // 파티클 정리
        if (this.victoryParticles) {
            this.victoryParticles.destroy();
        }

        if (this.defeatParticles) {
            this.defeatParticles.destroy();
        }
    }
}

export default GameOver;