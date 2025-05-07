/**
 * Dialogue.js
 * 
 * Dungeon Loop 게임의 대화 시스템을 관리하는 클래스
 * NPC 대화, 아이템 설명, 스킬 설명, 튜토리얼 등의 텍스트 표시를 담당
 */
class Dialogue {
    /**
     * @param {Phaser.Scene} scene - 현재 씬의 참조
     */
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.dialogueBox = null;
        this.textObject = null;
        this.nameObject = null;
        this.portraitObject = null;
        this.continueButton = null;
        this.choiceButtons = [];
        this.currentDialogue = null;
        this.dialogueIndex = 0;
        this.dialogueQueue = [];
        this.callbacks = {};
        this.textSpeed = 30; // 텍스트 표시 속도 (ms)
        this.isTyping = false;
        this.isChoice = false;

        // 텍스트 효과 관련 변수
        this.highlightColor = '#FFD700'; // 강조 색상 (금색)
        this.normalColor = '#FFFFFF';    // 기본 색상 (흰색)

        // 대화 상자 스타일 설정
        this.boxStyle = {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            wordWrap: { width: 400 },
            lineSpacing: 6
        };

        // 이름 텍스트 스타일 설정
        this.nameStyle = {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#FFD700',
            fontStyle: 'bold'
        };

        // 선택지 버튼 스타일 설정
        this.choiceStyle = {
            fontSize: '16px',
            fontFamily: 'Arial',
            fill: '#FFFFFF',
        };

        this.choiceHoverStyle = {
            fill: '#FFD700',
        };

        // 이벤트 리스너 설정
        this.setupEventListeners();
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 씬 종료 시 정리
        this.scene.events.once('shutdown', this.shutdown, this);

        // 스킵 키 설정 (스페이스바)
        this.skipKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.skipKey.on('down', this.handleSkipKey, this);
    }

    /**
     * 대화창 생성
     */
    createDialogueBox() {
        // 대화창 배경
        const { width, height } = this.scene.cameras.main;

        // 기존 대화창이 있다면 제거
        if (this.dialogueBox) {
            this.dialogueBox.destroy();
        }

        // 대화창 컨테이너 생성
        this.dialogueBox = this.scene.add.container(width / 2, height - 150);

        // 배경 패널 생성
        const background = this.scene.add.graphics();
        background.fillStyle(0x000000, 0.8);
        background.fillRoundedRect(-width / 2 + 20, -80, width - 40, 160, 10);
        background.lineStyle(2, 0xFFD700, 1);
        background.strokeRoundedRect(-width / 2 + 20, -80, width - 40, 160, 10);

        // 텍스트 오브젝트 생성
        this.textObject = this.scene.add.text(-width / 2 + 150, -60, '', this.boxStyle);

        // 이름 패널 및 텍스트 생성
        const namePanel = this.scene.add.graphics();
        namePanel.fillStyle(0x000000, 0.9);
        namePanel.fillRoundedRect(-width / 2 + 30, -110, 200, 40, 8);
        namePanel.lineStyle(2, 0xFFD700, 1);
        namePanel.strokeRoundedRect(-width / 2 + 30, -110, 200, 40, 8);

        this.nameObject = this.scene.add.text(-width / 2 + 130, -95, '', this.nameStyle);
        this.nameObject.setOrigin(0.5, 0.5);

        // 초상화 영역 생성 (120x120 크기)
        const portraitBg = this.scene.add.graphics();
        portraitBg.fillStyle(0x222222, 1);
        portraitBg.fillRoundedRect(-width / 2 + 40, -50, 90, 110, 8);
        portraitBg.lineStyle(2, 0xFFD700, 1);
        portraitBg.strokeRoundedRect(-width / 2 + 40, -50, 90, 110, 8);

        // 초상화 이미지 (처음에는 비어있음)
        this.portraitObject = this.scene.add.image(-width / 2 + 85, 5, 'portraits', 'default');
        this.portraitObject.setScale(0.9);
        this.portraitObject.setOrigin(0.5, 0.5);

        // 계속 버튼 (대화 진행용)
        this.continueButton = this.scene.add.image(width / 2 - 60, 60, 'ui_icons', 'arrow');
        this.continueButton.setScale(0.7);
        this.continueButton.setOrigin(0.5, 0.5);
        this.continueButton.setAlpha(0);
        this.continueButton.setInteractive({ useHandCursor: true });
        this.continueButton.on('pointerdown', this.nextDialogue, this);
        this.continueButton.on('pointerover', () => {
            this.continueButton.setScale(0.8);
        });
        this.continueButton.on('pointerout', () => {
            this.continueButton.setScale(0.7);
        });

        // 대화창에 요소 추가
        this.dialogueBox.add([
            background,
            namePanel,
            this.nameObject,
            this.textObject,
            portraitBg,
            this.portraitObject,
            this.continueButton
        ]);

        // 대화창 초기 설정
        this.dialogueBox.setDepth(1000); // 항상 최상위에 표시
        this.dialogueBox.setVisible(false);
    }

    /**
     * 대화창 표시
     * @param {Object} dialogueData - 대화 데이터
     * @param {Function} callback - 대화 종료 후 콜백
     */
    showDialogue(dialogueData, callback = null) {
        if (!this.dialogueBox) {
            this.createDialogueBox();
        }

        // 이전 대화 종료하기
        this.hideChoices();

        this.currentDialogue = dialogueData;
        this.dialogueIndex = 0;
        this.active = true;
        this.dialogueBox.setVisible(true);

        if (callback) {
            this.callbacks.onComplete = callback;
        }

        // 첫 대화 시작
        this.displayCurrentDialogue();
    }

    /**
     * 대화 대기열에 추가
     * @param {Object} dialogueData - 대화 데이터
     */
    queueDialogue(dialogueData) {
        this.dialogueQueue.push(dialogueData);

        // 현재 대화가 진행 중이 아니면 바로 시작
        if (!this.active) {
            this.processNextQueuedDialogue();
        }
    }

    /**
     * 대기열에서 다음 대화 처리
     */
    processNextQueuedDialogue() {
        if (this.dialogueQueue.length > 0) {
            const nextDialogue = this.dialogueQueue.shift();
            this.showDialogue(nextDialogue);
        }
    }

    /**
     * 현재 대화 표시
     */
    displayCurrentDialogue() {
        if (!this.currentDialogue || !this.currentDialogue.dialogues ||
            this.dialogueIndex >= this.currentDialogue.dialogues.length) {
            this.endDialogue();
            return;
        }

        const dialogueLine = this.currentDialogue.dialogues[this.dialogueIndex];

        // 이름 설정
        this.nameObject.setText(dialogueLine.speaker || '');

        // 초상화 설정
        const portraitKey = dialogueLine.portrait || 'default';
        this.portraitObject.setTexture('portraits', portraitKey);

        // 선택지가 있는 경우
        if (dialogueLine.choices) {
            this.displayText(dialogueLine.text || '', () => {
                this.showChoices(dialogueLine.choices);
            });
            this.isChoice = true;
        } else {
            // 일반 대화
            this.displayText(dialogueLine.text || '');
            this.isChoice = false;
        }
    }

    /**
     * 텍스트 타이핑 효과로 표시
     * @param {string} text - 표시할 텍스트
     * @param {Function} callback - 표시 완료 후 콜백
     */
    displayText(text, callback = null) {
        this.isTyping = true;
        this.continueButton.setAlpha(0);

        // 서식 있는 텍스트 처리 (마크다운 스타일)
        const processedText = this.processTextMarkup(text);

        // 텍스트 타이핑 효과
        let currentText = '';
        let charIndex = 0;

        // 이전 타이머 정리
        if (this.textTimer) {
            this.textTimer.remove();
        }

        this.textObject.setText('');

        // 문자별 타이핑 효과
        this.textTimer = this.scene.time.addEvent({
            delay: this.textSpeed,
            callback: () => {
                if (charIndex < processedText.length) {
                    currentText += processedText[charIndex];
                    this.textObject.setText(currentText);
                    charIndex++;
                } else {
                    // 타이핑 완료
                    this.isTyping = false;
                    this.textTimer.remove();

                    // 계속 버튼 표시
                    if (!this.isChoice) {
                        this.continueButton.setAlpha(1);
                    }

                    // 콜백 실행
                    if (callback) callback();
                }
            },
            callbackScope: this,
            repeat: processedText.length
        });
    }

    /**
     * 텍스트 마크업 처리 (강조, 색상 등)
     * @param {string} text - 원본 텍스트
     * @returns {string} - HTML 태그가 포함된 처리된 텍스트
     */
    processTextMarkup(text) {
        // *강조* 텍스트를 HTML로 변환
        text = text.replace(/\*(.*?)\*/g, `<span style="color:${this.highlightColor}">$1</span>`);

        // 클래스 이름 강조
        const classNames = [
            '전사', '궁수', '도적', '마법사', '창병', '무도가', '성직자', '사냥꾼', '기사', '연금술사',
            '마검사', '레인저', '어쌔신', '배틀메이지', '십자군', '드루이드', '닌자', '팔라딘', '거너',
            '광전사', '음유시인', '소환사', '암흑마법사', '수호자', '스펠블레이드', '정찰병', '와든',
            '그림자춤꾼', '정령술사', '약초학자', '죽음의 기사', '비전 레인저', '그림자 댄서',
            '전투성인', '대마법사', '악마 사냥꾼', '시간술사', '용 조련사', '검무도가', '영혼방랑자',
            '성 심문관', '혈마법사', '숲의 수호자', '공허 추적자', '룬 대장장이', '드래곤 나이트',
            '천공의 현자', '영원의 챔피언', '종말의 인도자', '신성 심판관'
        ];

        // 정규식 패턴 생성
        const classPattern = new RegExp(`\\b(${classNames.join('|')})\\b`, 'g');

        // 클래스 이름에 색상 적용
        text = text.replace(classPattern, `<span style="color:${this.highlightColor}">$1</span>`);

        return text;
    }

    /**
     * 선택지 표시
     * @param {Array} choices - 선택지 배열
     */
    showChoices(choices) {
        const { width, height } = this.scene.cameras.main;
        this.hideChoices(); // 기존 선택지 제거

        const startY = 30;
        const buttonHeight = 40;

        choices.forEach((choice, index) => {
            // 선택지 배경 생성
            const y = startY + (index * buttonHeight);

            const choiceButton = this.scene.add.container(0, y);

            const choiceBg = this.scene.add.graphics();
            choiceBg.fillStyle(0x333333, 0.8);
            choiceBg.fillRoundedRect(-200, -15, 400, 30, 8);
            choiceBg.lineStyle(1, 0xFFD700, 0.5);
            choiceBg.strokeRoundedRect(-200, -15, 400, 30, 8);

            // 선택지 텍스트
            const choiceText = this.scene.add.text(0, 0, choice.text, this.choiceStyle);
            choiceText.setOrigin(0.5, 0.5);

            // 인터랙티브 영역
            const hitArea = this.scene.add.zone(-200, -15, 400, 30);
            hitArea.setOrigin(0, 0);
            hitArea.setInteractive({ useHandCursor: true });

            // 이벤트 리스너
            hitArea.on('pointerover', () => {
                choiceBg.clear();
                choiceBg.fillStyle(0x555555, 0.9);
                choiceBg.fillRoundedRect(-200, -15, 400, 30, 8);
                choiceBg.lineStyle(2, 0xFFD700, 1);
                choiceBg.strokeRoundedRect(-200, -15, 400, 30, 8);
                choiceText.setStyle(this.choiceHoverStyle);
            });

            hitArea.on('pointerout', () => {
                choiceBg.clear();
                choiceBg.fillStyle(0x333333, 0.8);
                choiceBg.fillRoundedRect(-200, -15, 400, 30, 8);
                choiceBg.lineStyle(1, 0xFFD700, 0.5);
                choiceBg.strokeRoundedRect(-200, -15, 400, 30, 8);
                choiceText.setStyle(this.choiceStyle);
            });

            hitArea.on('pointerdown', () => {
                this.onChoiceSelected(choice, index);
            });

            // 컨테이너에 추가
            choiceButton.add([choiceBg, choiceText, hitArea]);
            this.dialogueBox.add(choiceButton);

            // 선택지 배열에 저장
            this.choiceButtons.push(choiceButton);
        });
    }

    /**
     * 선택지 선택 처리
     * @param {Object} choice - 선택된 선택지 데이터
     * @param {number} index - 선택지 인덱스
     */
    onChoiceSelected(choice, index) {
        // 선택지 숨기기
        this.hideChoices();

        // 다음 대화 인덱스 설정
        if (choice.nextIndex !== undefined) {
            this.dialogueIndex = choice.nextIndex;
        } else {
            this.dialogueIndex++;
        }

        // 선택 콜백 실행
        if (this.currentDialogue.onChoice) {
            this.currentDialogue.onChoice(choice, index);
        }

        // 다음 대화 표시
        this.displayCurrentDialogue();
    }

    /**
     * 선택지 숨기기
     */
    hideChoices() {
        this.choiceButtons.forEach(button => {
            button.destroy();
        });
        this.choiceButtons = [];
    }

    /**
     * 다음 대화로 진행
     */
    nextDialogue() {
        // 타이핑 중이면 텍스트 즉시 완성
        if (this.isTyping) {
            this.completeTyping();
            return;
        }

        // 선택지가 표시 중이면 무시
        if (this.isChoice) {
            return;
        }

        // 다음 대화로 진행
        this.dialogueIndex++;
        this.displayCurrentDialogue();
    }

    /**
     * 타이핑 효과 즉시 완료
     */
    completeTyping() {
        if (this.textTimer) {
            this.textTimer.remove();
        }

        const dialogueLine = this.currentDialogue.dialogues[this.dialogueIndex];

        if (dialogueLine) {
            const processedText = this.processTextMarkup(dialogueLine.text || '');
            this.textObject.setText(processedText);
            this.isTyping = false;

            // 선택지가 있는 경우
            if (dialogueLine.choices) {
                this.showChoices(dialogueLine.choices);
                this.isChoice = true;
            } else {
                // 계속 버튼 표시
                this.continueButton.setAlpha(1);
            }
        }
    }

    /**
     * 스킵 키 처리
     */
    handleSkipKey() {
        if (this.active) {
            if (this.isTyping) {
                this.completeTyping();
            } else if (!this.isChoice) {
                this.nextDialogue();
            }
        }
    }

    /**
     * 대화 종료 처리
     */
    endDialogue() {
        this.active = false;
        this.hideChoices();

        // 페이드 아웃 애니메이션
        this.scene.tweens.add({
            targets: this.dialogueBox,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.dialogueBox.setVisible(false);
                this.dialogueBox.setAlpha(1);

                // 완료 콜백 실행
                if (this.callbacks.onComplete) {
                    this.callbacks.onComplete();
                    this.callbacks.onComplete = null;
                }

                // 대기열에 대화가 있으면 처리
                this.processNextQueuedDialogue();
            }
        });
    }

    /**
     * 아이템 설명 표시
     * @param {Object} item - 아이템 데이터
     * @param {number} x - x 좌표
     * @param {number} y - y 좌표
     */
    showItemTooltip(item, x, y) {
        // 기존 툴팁 제거
        this.hideItemTooltip();

        const padding = 10;
        const rarityColors = {
            common: '#FFFFFF',
            uncommon: '#00FF00',
            rare: '#0088FF',
            epic: '#AA00FF',
            legendary: '#FF8800',
            mythic: '#FF0000'
        };

        // 툴팁 컨테이너 생성
        this.itemTooltip = this.scene.add.container(x, y);
        this.itemTooltip.setDepth(1100);

        // 아이템 이름에 희귀도 색상 적용
        const nameColor = rarityColors[item.rarity] || '#FFFFFF';

        // 아이템 설명 생성
        let tooltipText = '';
        tooltipText += `<span style="color:${nameColor};font-size:18px;font-weight:bold;">${item.name}</span>\n`;
        tooltipText += `<span style="color:#AAAAAA;font-size:14px;">${this.getItemTypeText(item.type, item.subType)}</span>\n\n`;

        // 무기/방어구 스탯 추가
        if (item.stats) {
            for (const [stat, value] of Object.entries(item.stats)) {
                const sign = value >= 0 ? '+' : '';
                tooltipText += `<span style="color:#66CCFF;">${sign}${value} ${this.getStatName(stat)}</span>\n`;
            }
            tooltipText += '\n';
        }

        // 효과 추가
        if (item.effect) {
            tooltipText += `<span style="color:#FFCC00;">${this.getEffectText(item.effect)}</span>\n\n`;
        }

        // 여러 효과 추가
        if (item.effects && item.effects.length > 0) {
            for (const effect of item.effects) {
                tooltipText += `<span style="color:#FFCC00;">${this.getEffectText(effect)}</span>\n`;
            }
            tooltipText += '\n';
        }

        // 아이템 설명 추가
        if (item.description) {
            tooltipText += `<span style="color:#CCCCCC;font-style:italic;">${item.description}</span>\n`;
        }

        // 레벨 요구치 추가
        if (item.requiredLevel) {
            tooltipText += `\n<span style="color:#FF6666;">요구 레벨: ${item.requiredLevel}</span>`;
        }

        // 클래스 제한 추가
        if (item.classRestriction && item.classRestriction.length > 0) {
            tooltipText += `\n<span style="color:#FF6666;">사용 가능 클래스: ${item.classRestriction.join(', ')}</span>`;
        }

        // 툴팁 텍스트 생성
        const textObject = this.scene.add.text(0, 0, tooltipText, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#FFFFFF',
            align: 'left',
            wordWrap: { width: 300 },
            lineSpacing: 6
        });

        textObject.setOrigin(0);

        // 배경 생성
        const bounds = textObject.getBounds();
        const tooltipWidth = bounds.width + padding * 2;
        const tooltipHeight = bounds.height + padding * 2;

        const background = this.scene.add.graphics();
        background.fillStyle(0x000000, 0.9);
        background.fillRoundedRect(-padding, -padding, tooltipWidth, tooltipHeight, 8);
        background.lineStyle(2, nameColor, 0.8);
        background.strokeRoundedRect(-padding, -padding, tooltipWidth, tooltipHeight, 8);

        // 툴팁 조정 (화면 밖으로 나가지 않도록)
        const { width, height } = this.scene.cameras.main;

        if (x + tooltipWidth > width) {
            this.itemTooltip.x = width - tooltipWidth - 10;
        }

        if (y + tooltipHeight > height) {
            this.itemTooltip.y = height - tooltipHeight - 10;
        }

        // 컨테이너에 추가
        this.itemTooltip.add([background, textObject]);
    }

    /**
     * 아이템 툴팁 숨기기
     */
    hideItemTooltip() {
        if (this.itemTooltip) {
            this.itemTooltip.destroy();
            this.itemTooltip = null;
        }
    }

    /**
     * 알림 메시지 표시
     * @param {string} message - 표시할 메시지
     * @param {string} type - 알림 유형 ('info', 'warning', 'error', 'success')
     */
    showNotification(message, type = 'info') {
        const colors = {
            info: '#3498db',
            warning: '#f39c12',
            error: '#e74c3c',
            success: '#2ecc71'
        };

        const { width, height } = this.scene.cameras.main;
        const y = 100;

        // 알림 컨테이너 생성
        const notification = this.scene.add.container(width / 2, y);
        notification.setDepth(1200);
        notification.setAlpha(0);

        // 배경 생성
        const padding = 15;
        const textObject = this.scene.add.text(0, 0, message, {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#FFFFFF',
            align: 'center'
        });
        textObject.setOrigin(0.5);

        const bounds = textObject.getBounds();
        const bgWidth = bounds.width + padding * 2 + 30;
        const bgHeight = bounds.height + padding * 2;

        const background = this.scene.add.graphics();
        background.fillStyle(0x000000, 0.8);
        background.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 10);
        background.lineStyle(3, colors[type] || colors.info, 1);
        background.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 10);

        // 아이콘 추가
        let iconFrame;
        switch (type) {
            case 'warning': iconFrame = 'warning'; break;
            case 'error': iconFrame = 'error'; break;
            case 'success': iconFrame = 'success'; break;
            default: iconFrame = 'info'; break;
        }

        const icon = this.scene.add.image(-bgWidth / 2 + padding + 10, 0, 'ui_icons', iconFrame);
        icon.setOrigin(0, 0.5);
        icon.setScale(0.8);

        // 컨테이너에 추가
        notification.add([background, textObject, icon]);

        // 애니메이션 (페이드 인 -> 대기 -> 페이드 아웃)
        this.scene.tweens.add({
            targets: notification,
            alpha: 1,
            y: y + 20,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.scene.time.delayedCall(2000, () => {
                    this.scene.tweens.add({
                        targets: notification,
                        alpha: 0,
                        y: y + 40,
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
     * 세부 정보창 표시 (보스, 함정, 신단 등)
     * @param {Object} data - 표시할 데이터
     * @param {string} type - 데이터 유형
     */
    showDetailInfo(data, type) {
        const { width, height } = this.scene.cameras.main;

        // 기존 정보창 제거
        if (this.detailInfo) {
            this.detailInfo.destroy();
        }

        // 정보창 컨테이너 생성
        this.detailInfo = this.scene.add.container(width / 2, height / 2);
        this.detailInfo.setDepth(1100);

        // 배경 생성 (반투명 검은색 오버레이)
        const overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        overlay.setOrigin(0.5);

        // 정보 패널 생성
        const panelWidth = 500;
        const panelHeight = 400;

        const panel = this.scene.add.graphics();
        panel.fillStyle(0x333333, 0.95);
        panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 15);
        panel.lineStyle(2, 0xFFD700, 1);
        panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 15);

        // 헤더 생성
        let headerText = '';
        let headerColor = '#FFFFFF';

        switch (type) {
            case 'boss':
                headerText = `${data.name} (보스)`;
                headerColor = '#FF5555';
                break;
            case 'trap':
                headerText = `${data.name} (함정)`;
                headerColor = '#FF9955';
                break;
            case 'shrine':
                headerText = `${data.name} (신단)`;
                headerColor = '#55AAFF';
                break;
            case 'merchant':
                headerText = `${data.name} (상인)`;
                headerColor = '#FFDD44';
                break;
            default:
                headerText = data.name || '상세 정보';
        }

        const header = this.scene.add.text(0, -panelHeight / 2 + 30, headerText, {
            fontFamily: 'Arial',
            fontSize: '24px',
            fontStyle: 'bold',
            color: headerColor,
            align: 'center'
        });
        header.setOrigin(0.5);

        // 설명 텍스트 생성
        let infoText = '';

        // 정보 타입별 출력 포맷 설정
        if (type === 'boss') {
            infoText += `<span style="color:#FF8888;font-weight:bold;">난이도:</span> ${this.getDifficultyText(data.difficulty || 1)}\n\n`;
            infoText += `<span style="color:#FF8888;font-weight:bold;">공격 유형:</span> ${this.getAttackTypeText(data.attackType)}\n`;
            infoText += `<span style="color:#FF8888;font-weight:bold;">속성:</span> ${this.getElementText(data.element)}\n\n`;

            if (data.abilities && data.abilities.length > 0) {
                infoText += `<span style="color:#FFAA00;font-weight:bold;">주요 능력:</span>\n`;
                data.abilities.forEach(ability => {
                    infoText += `• <span style="color:#FFDD88;">${ability.name}</span>: ${ability.description}\n`;
                });
                infoText += '\n';
            }

            if (data.phases && data.phases.length > 0) {
                infoText += `<span style="color:#FFAA00;font-weight:bold;">페이즈:</span>\n`;
                data.phases.forEach((phase, index) => {
                    infoText += `• <span style="color:#FFDD88;">페이즈 ${index + 1}</span>: ${phase.message}\n`;
                });
                infoText += '\n';
            }
        } else if (type === 'trap') {
            infoText += `<span style="color:#FF8888;font-weight:bold;">위험도:</span> ${this.getDifficultyText(data.dangerLevel || 1)}\n\n`;

            if (data.damageMultiplier) {
                infoText += `<span style="color:#FF8888;font-weight:bold;">피해:</span> ${Math.floor(data.damageMultiplier * 100)}% 대미지\n`;
            }

            if (data.statusEffect) {
                infoText += `<span style="color:#FF8888;font-weight:bold;">상태 효과:</span> ${this.getStatusEffectText(data.statusEffect)}\n`;
                if (data.statusDuration) {
                    infoText += `<span style="color:#FF8888;font-weight:bold;">지속 시간:</span> ${data.statusDuration}초\n`;
                }
            }

            infoText += `\n<span style="color:#AAAAAA;font-style:italic;">탐지 확률: ${Math.floor(data.detectChance * 100)}%</span>\n`;

            if (data.areaOfEffect) {
                infoText += `<span style="color:#AAAAAA;font-style:italic;">영향 범위: ${data.areaOfEffect}미터</span>\n`;
            }
        } else if (type === 'shrine') {
            infoText += `<span style="color:#88AAFF;font-weight:bold;">효과:</span>\n`;

            if (data.effects) {
                Object.entries(data.effects).forEach(([effect, value]) => {
                    infoText += `• ${this.getShrineEffectText(effect, value)}\n`;
                });
            }
        } else if (type === 'merchant') {
            infoText += `<span style="color:#DDAA00;font-weight:bold;">거래 품목:</span> ${this.getMerchantTypeText(data)}\n\n`;

            infoText += `<span style="color:#DDAA00;font-weight:bold;">가격 배율:</span> ${data.priceMultiplier * 100}%\n`;
            infoText += `<span style="color:#DDAA00;font-weight:bold;">구매 가격:</span> 판매가의 ${data.buyRate * 100}%\n\n`;

            infoText += `<span style="color:#AAAAAA;font-style:italic;">"${data.greeting || '어서오세요, 모험가님!'}"</span>\n`;
        } else {
            // 기본 상세 정보 표시
            infoText = data.description || '상세 정보가 없습니다.';
        }

        const contentText = this.scene.add.text(0, 20, infoText, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#FFFFFF',
            align: 'left',
            wordWrap: { width: panelWidth - 60 },
            lineSpacing: 8
        });
        contentText.setOrigin(0.5, 0);

        // 닫기 버튼
        const closeButton = this.scene.add.graphics();
        closeButton.fillStyle(0x880000, 1);
        closeButton.fillRoundedRect(panelWidth / 2 - 60, -panelHeight / 2 + 10, 40, 40, 8);
        closeButton.lineStyle(2, 0xFFFFFF, 1);
        closeButton.strokeRoundedRect(panelWidth / 2 - 60, -panelHeight / 2 + 10, 40, 40, 8);

        const closeX = this.scene.add.text(panelWidth / 2 - 40, -panelHeight / 2 + 30, 'X', {
            fontFamily: 'Arial',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#FFFFFF'
        });
        closeX.setOrigin(0.5);

        // 닫기 버튼 인터랙션
        const closeZone = this.scene.add.zone(panelWidth / 2 - 40, -panelHeight / 2 + 30, 40, 40);
        closeZone.setInteractive({ useHandCursor: true });
        closeZone.on('pointerover', () => {
            closeButton.clear();
            closeButton.fillStyle(0xAA0000, 1);
            closeButton.fillRoundedRect(panelWidth / 2 - 60, -panelHeight / 2 + 10, 40, 40, 8);
            closeButton.lineStyle(2, 0xFFFFFF, 1);
            closeButton.strokeRoundedRect(panelWidth / 2 - 60, -panelHeight / 2 + 10, 40, 40, 8);
        });
        closeZone.on('pointerout', () => {
            closeButton.clear();
            closeButton.fillStyle(0x880000, 1);
            closeButton.fillRoundedRect(panelWidth / 2 - 60, -panelHeight / 2 + 10, 40, 40, 8);
            closeButton.lineStyle(2, 0xFFFFFF, 1);
            closeButton.strokeRoundedRect(panelWidth / 2 - 60, -panelHeight / 2 + 10, 40, 40, 8);
        });
        closeZone.on('pointerdown', () => {
            this.hideDetailInfo();
        });

        // 이미지 추가 (있는 경우)
        if (data.sprite) {
            const sprite = this.scene.add.sprite(-panelWidth / 2 + 70, -panelHeight / 2 + 80, data.sprite.key);
            sprite.setScale(2);
            this.detailInfo.add(sprite);
        }

        // 컨테이너에 추가
        this.detailInfo.add([overlay, panel, header, contentText, closeButton, closeX, closeZone]);

        // 클릭 이벤트 (오버레이 클릭 시 닫기)
        overlay.setInteractive();
        overlay.on('pointerdown', (pointer) => {
            // 패널 영역 클릭은 무시 (클릭 이벤트 전파 방지)
            const bounds = new Phaser.Geom.Rectangle(
                this.detailInfo.x - panelWidth / 2,
                this.detailInfo.y - panelHeight / 2,
                panelWidth,
                panelHeight
            );

            if (!bounds.contains(pointer.x, pointer.y)) {
                this.hideDetailInfo();
            }
        });

        // 애니메이션 (스케일 커지는 효과)
        this.detailInfo.setScale(0.8);
        this.scene.tweens.add({
            targets: this.detailInfo,
            scale: 1,
            duration: 200,
            ease: 'Back.Out'
        });
    }

    /**
     * 세부 정보창 숨기기
     */
    hideDetailInfo() {
        if (this.detailInfo) {
            this.scene.tweens.add({
                targets: this.detailInfo,
                scale: 0.8,
                alpha: 0,
                duration: 200,
                ease: 'Back.In',
                onComplete: () => {
                    this.detailInfo.destroy();
                    this.detailInfo = null;
                }
            });
        }
    }

    /**
     * 튜토리얼 대화 표시
     * @param {string} key - 튜토리얼 키
     */
    showTutorial(key) {
        const tutorials = {
            movement: {
                dialogues: [
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '*WASD* 또는 *화살표 키*를 사용하여 움직일 수 있습니다. 달리기는 *Shift* 키를 함께 누르세요.'
                    }
                ]
            },
            combat: {
                dialogues: [
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '*마우스 왼쪽 버튼*으로 기본 공격을 할 수 있습니다. 각 *클래스*는 고유한 무기와 공격 패턴을 가집니다.'
                    },
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '*Q*, *W*, *E*, *R* 키로 특수 스킬을 사용할 수 있습니다. 스킬은 마나를 소모하며 쿨다운이 있습니다.'
                    }
                ]
            },
            inventory: {
                dialogues: [
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '*I* 키를 눌러 인벤토리를 열 수 있습니다. 아이템을 클릭하여 장착하거나 사용할 수 있습니다.'
                    },
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '아이템 위에 마우스를 올리면 세부 정보가 표시됩니다. *1-5* 키를 눌러 단축키에 등록된 소비 아이템을 빠르게 사용할 수 있습니다.'
                    }
                ]
            },
            class_system: {
                dialogues: [
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '*클래스 조합* 시스템을 통해 더 강력한 클래스로 진화할 수 있습니다. 두 클래스를 모두 레벨 10 이상으로 올린 후 클래스 조합을 시도하세요.'
                    },
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '티어가 높은 클래스일수록 조합 성공 확률이 낮아집니다. *황금 열쇠*나 *연금술사* 클래스를 활용하여 성공 확률을 높일 수 있습니다.'
                    }
                ]
            },
            dungeon: {
                dialogues: [
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '던전은 여러 방으로 구성되어 있으며, 방마다 다양한 적과 보물이 있습니다. 미니맵을 확인하여 위치를 파악하세요.'
                    },
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '*보물 방*에는 귀중한 아이템이 담긴 상자가 있고, *도전 방*에서는 여러 웨이브의 몬스터를 처치하면 보상을 얻을 수 있습니다.'
                    },
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '*상인 방*에서는 아이템을 사고 팔 수 있으며, *신단 방*에서는 던전 클리어에 도움이 되는 버프를 얻을 수 있습니다.'
                    }
                ]
            },
            boss: {
                dialogues: [
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '보스는 던전의 마지막에 등장하는 강력한 적입니다. 각 보스는 고유한 패턴과 페이즈를 가지고 있습니다.'
                    },
                    {
                        speaker: '튜토리얼',
                        portrait: 'tutorial',
                        text: '보스의 체력이 특정 수준 이하로 떨어지면 새로운 패턴이나 강화된 능력을 사용하니 주의하세요.'
                    }
                ]
            }
        };

        const tutorialData = tutorials[key];
        if (tutorialData) {
            this.showDialogue(tutorialData);
        }
    }

    /**
     * 클래스 해금 축하 대화 표시
     * @param {Object} classData - 해금된 클래스 데이터
     */
    showClassUnlockCelebration(classData) {
        const dialogue = {
            dialogues: [
                {
                    speaker: '새 클래스 해금!',
                    portrait: 'celebration',
                    text: `축하합니다! *${classData.name}* 클래스를 해금했습니다!`
                },
                {
                    speaker: classData.name,
                    portrait: `class_${classData.id}`,
                    text: classData.description || `${classData.name} 클래스는 ${this.getClassTierText(classData.tier)}에 속합니다.`
                }
            ]
        };

        // 티어 2 이상 클래스는 특별 능력이나 궁극기 설명 추가
        if (classData.tier >= 2 && classData.passiveEffect) {
            dialogue.dialogues.push({
                speaker: '패시브 효과',
                portrait: `class_${classData.id}`,
                text: `*${classData.name}*의 패시브 효과: ${classData.passiveEffect.description}`
            });
        }

        if (classData.tier >= 3 && classData.ultimateSkill) {
            dialogue.dialogues.push({
                speaker: '궁극기',
                portrait: `class_${classData.id}`,
                text: `*${classData.name}*의 궁극기: *${classData.ultimateSkill.name}* - ${classData.ultimateSkill.description}`
            });
        }

        this.showDialogue(dialogue);
    }

    /**
     * 던전 클리어 대화 표시
     * @param {Object} dungeonData - 클리어한 던전 데이터
     * @param {Object} stats - 던전 클리어 통계
     */
    showDungeonClearDialogue(dungeonData, stats) {
        const elapsedTime = this.formatTime(stats.elapsedTime);
        const killCount = stats.monstersKilled || 0;
        const goldGained = stats.goldGained || 0;

        const dialogue = {
            dialogues: [
                {
                    speaker: '던전 클리어!',
                    portrait: 'celebration',
                    text: `축하합니다! *${dungeonData.name}* 던전을 클리어했습니다!`
                },
                {
                    speaker: '던전 결과',
                    portrait: 'stats',
                    text: `소요 시간: *${elapsedTime}*\n처치한 몬스터: *${killCount}*마리\n획득한 골드: *${goldGained}*G`
                }
            ]
        };

        // 첫 클리어 보너스나 해금된 던전이 있으면 추가
        if (stats.firstClear) {
            dialogue.dialogues.push({
                speaker: '첫 클리어 보너스',
                portrait: 'treasure',
                text: '첫 클리어 보너스로 추가 보상을 획득했습니다!'
            });
        }

        if (stats.unlockedDungeons && stats.unlockedDungeons.length > 0) {
            const dungeonNames = stats.unlockedDungeons.map(d => d.name).join(', ');
            dialogue.dialogues.push({
                speaker: '던전 해금',
                portrait: 'dungeon',
                text: `새로운 던전이 해금되었습니다: *${dungeonNames}*`
            });
        }

        this.showDialogue(dialogue);
    }

    /**
     * 룬/작문 스크립트 교체
     * @param {string} script - 룬/작문 스크립트
     * @param {Object} oldPattern - 변경할 패턴
     * @param {Object} newPattern - 새 패턴
     * @returns {string} - 교체된 스크립트
     */
    replaceRunePattern(script, oldPattern, newPattern) {
        // 단순 문자열 교체가 아닌 복잡한 패턴 교체 로직
        // 룬 스크립트 작성 및 패턴 교체 시 사용

        // 스크립트의 각 부분을 분석하여 패턴 매칭 및 교체
        // 여기서는 간단한 예시만 구현
        return script.replace(oldPattern, newPattern);
    }

    /**
     * 초상화 변경 애니메이션
     * @param {string} newPortraitKey - 새 초상화 키
     */
    animatePortraitChange(newPortraitKey) {
        if (!this.portraitObject) return;

        // 페이드 아웃 애니메이션
        this.scene.tweens.add({
            targets: this.portraitObject,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                // 초상화 변경
                this.portraitObject.setTexture('portraits', newPortraitKey);

                // 페이드 인 애니메이션
                this.scene.tweens.add({
                    targets: this.portraitObject,
                    alpha: 1,
                    duration: 200
                });
            }
        });
    }

    /**
     * 대화 음성 효과 재생
     * @param {string} speakerType - 화자 타입
     */
    playVoiceSound(speakerType) {
        // 화자 타입에 따라 적절한 대화 음성 효과 재생
        let soundKey = 'voice_default';

        switch (speakerType) {
            case 'male':
                soundKey = 'voice_male';
                break;
            case 'female':
                soundKey = 'voice_female';
                break;
            case 'monster':
                soundKey = 'voice_monster';
                break;
            case 'robot':
                soundKey = 'voice_robot';
                break;
            case 'ghost':
                soundKey = 'voice_ghost';
                break;
        }

        // 소리 재생
        if (this.scene.sound.get(soundKey)) {
            this.scene.sound.play(soundKey, {
                volume: 0.5,
                rate: Phaser.Math.FloatBetween(0.9, 1.1) // 약간의 변화를 줌
            });
        }
    }

    /**
     * NPC 대화 생성
     * @param {string} npcId - NPC ID
     * @returns {Object} - 대화 데이터
     */
    generateNPCDialogue(npcId) {
        // 각 NPC별 대화 데이터 맵
        const npcDialogues = {
            merchant: {
                dialogues: [
                    {
                        speaker: '상인',
                        portrait: 'merchant',
                        text: '어서 오세요, 모험가님! 특별한 품목들이 준비되어 있습니다.',
                        choices: [
                            { text: '물건 구경하기', nextIndex: 1 },
                            { text: '아이템 팔기', nextIndex: 2 },
                            { text: '떠나기', nextIndex: 3 }
                        ]
                    },
                    {
                        speaker: '상인',
                        portrait: 'merchant',
                        text: '좋은 눈을 가지셨군요! 최고의 품질을 보장합니다.'
                    },
                    {
                        speaker: '상인',
                        portrait: 'merchant',
                        text: '파실 물건이 있으신가요? 공정한 가격에 매입하겠습니다.'
                    },
                    {
                        speaker: '상인',
                        portrait: 'merchant',
                        text: '다음에 또 찾아주세요!'
                    }
                ]
            },
            blacksmith: {
                dialogues: [
                    {
                        speaker: '대장장이',
                        portrait: 'blacksmith',
                        text: '무슨 일로 찾아오셨소? 새 무기가 필요하신가, 아니면 강화라도?',
                        choices: [
                            { text: '무기 제작', nextIndex: 1 },
                            { text: '장비 강화', nextIndex: 2 },
                            { text: '떠나기', nextIndex: 3 }
                        ]
                    },
                    {
                        speaker: '대장장이',
                        portrait: 'blacksmith',
                        text: '어떤 무기를 원하시오? 제작에는 재료와 골드가 필요하오.'
                    },
                    {
                        speaker: '대장장이',
                        portrait: 'blacksmith',
                        text: '강화하실 장비를 선택하시오. 실패 확률이 있다는 점 명심하시오.'
                    },
                    {
                        speaker: '대장장이',
                        portrait: 'blacksmith',
                        text: '필요할 때 다시 찾아오시오!'
                    }
                ]
            },
            elder: {
                dialogues: [
                    {
                        speaker: '마을 장로',
                        portrait: 'elder',
                        text: '오, 모험가여. 그대가 *무한의 던전*의 비밀을 밝혀낼 사람인가.',
                        choices: [
                            { text: '던전에 대해 물어보기', nextIndex: 1 },
                            { text: '클래스 조합에 대해 물어보기', nextIndex: 2 },
                            { text: '떠나기', nextIndex: 3 }
                        ]
                    },
                    {
                        speaker: '마을 장로',
                        portrait: 'elder',
                        text: '무한의 던전은 끊임없이 변화하는 미스터리한 공간이라오. 던전마다 고유한 특성과 위험이 있으니 준비를 철저히 하시게.'
                    },
                    {
                        speaker: '마을 장로',
                        portrait: 'elder',
                        text: '클래스 조합은 모험가의 힘을 증폭시키는 고대의 비술이라오. 두 가지 힘을 하나로 합쳐 더 강한 힘을 얻을 수 있지. *전사*와 *마법사*는 *마검사*가 되고, *도적*과 *무도가*는 *그림자춤꾼*이 되는 식이지.'
                    },
                    {
                        speaker: '마을 장로',
                        portrait: 'elder',
                        text: '그대의 여정에 지혜와 행운이 함께하길 바라오.'
                    }
                ]
            }
        };

        return npcDialogues[npcId] || {
            dialogues: [
                {
                    speaker: 'NPC',
                    portrait: 'default',
                    text: '안녕하세요, 모험가님.'
                }
            ]
        };
    }

    /**
     * 시간 포맷 (초 -> MM:SS)
     * @param {number} seconds - 시간(초)
     * @returns {string} - 포맷된 시간 문자열
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 아이템 타입 텍스트 반환
     * @param {string} type - 아이템 타입
     * @param {string} subType - 아이템 하위 타입
     * @returns {string} - 타입 텍스트
     */
    getItemTypeText(type, subType) {
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
            // 무기
            sword: '검',
            dagger: '단검',
            bow: '활',
            staff: '지팡이',
            wand: '완드',
            spear: '창',
            axe: '도끼',
            mace: '둔기',
            hammer: '망치',

            // 방어구
            helmet: '투구',
            chest: '갑옷',
            gloves: '장갑',
            boots: '신발',
            shield: '방패',

            // 악세서리
            ring: '반지',
            amulet: '목걸이',
            bracelet: '팔찌',
            belt: '벨트',

            // 소비 아이템
            potion: '포션',
            scroll: '스크롤',
            food: '음식',
            elixir: '엘릭서',

            // 재료
            crystal: '크리스탈',
            essence: '정수',
            ore: '광석',
            herb: '약초',
            leather: '가죽',

            // 기타
            rune: '룬',
            book: '책',
            key: '열쇠',
            gem: '보석'
        };

        let result = typeMap[type] || '아이템';

        if (subType && subTypeMap[subType]) {
            result = `${subTypeMap[subType]} (${result})`;
        }

        return result;
    }

    /**
     * 스탯 이름 반환
     * @param {string} stat - 스탯 키
     * @returns {string} - 스탯 이름
     */
    getStatName(stat) {
        const statMap = {
            hp: '체력',
            maxHp: '최대 체력',
            mp: '마나',
            maxMp: '최대 마나',
            attack: '공격력',
            defense: '방어력',
            speed: '이동 속도',
            critRate: '치명타 확률',
            critDamage: '치명타 피해',
            magicPower: '마법력',
            magicResist: '마법 저항',
            lifeSteal: '생명력 흡수',
            hpRegen: '체력 재생',
            mpRegen: '마나 재생',
            dodgeRate: '회피율',
            cooldownReduction: '쿨다운 감소',
            goldFind: '골드 획득량',
            expBonus: '경험치 획득량',
            itemFind: '아이템 획득 확률',
            damageReduction: '피해 감소',
            elementalDamage: '원소 피해',
            stunChance: '기절 확률',
            moveSpeed: '이동 속도',
            attackSpeed: '공격 속도'
        };

        return statMap[stat] || stat;
    }

    /**
     * 효과 텍스트 반환
     * @param {Object} effect - 효과 객체
     * @returns {string} - 효과 설명
     */
    getEffectText(effect) {
        if (!effect || !effect.type) return '';

        const effectMap = {
            heal: `${effect.value || 0}의 체력을 회복합니다.`,
            mana_restore: `${effect.value || 0}의 마나를 회복합니다.`,
            stat_boost: `${this.getStatName(effect.stat)} +${effect.value || 0}% (${effect.duration || 0}초)`,
            damage_boost: `공격력 +${effect.value || 0}% (${effect.duration || 0}초)`,
            defense_boost: `방어력 +${effect.value || 0}% (${effect.duration || 0}초)`,
            speed_boost: `이동 속도 +${effect.value || 0}% (${effect.duration || 0}초)`,
            burn: `${effect.damage_per_stack || 0}의 화상 피해 (${effect.duration || 0}초)`,
            poison: `${effect.value || 0}의 독 피해 (${effect.duration || 0}초)`,
            stun: `대상을 ${effect.duration || 0}초 동안 기절시킵니다.`,
            slow: `대상의 이동 속도를 ${effect.value || 0}% 감소시킵니다. (${effect.duration || 0}초)`,
            reveal_map: '현재 던전의 지도를 공개합니다.',
            teleport: '가장 가까운 안전한 위치로 텔레포트합니다.',
            identify: '모든 미확인 아이템을 감정합니다.',
            revive: '던전에서 사망 시 부활합니다. (1회)',
            gold_boost: `골드 획득량이 ${effect.value || 0}% 증가합니다. (${effect.duration || 0}초)`,
            exp_boost: `경험치 획득량이 ${effect.value || 0}% 증가합니다. (${effect.duration || 0}초)`,
            rarity_boost: `아이템 희귀도 확률이 ${effect.value || 0}% 증가합니다. (${effect.duration || 0}초)`,
            cooldown_reset: '모든 스킬의 쿨다운을 초기화합니다.',
            invulnerability: `${effect.duration || 0}초 동안 무적 상태가 됩니다.`,
            summon: `${effect.value || ''}을(를) 소환합니다.`,
            trap_detect: `함정 발견 확률이 ${effect.value || 0}% 증가합니다.`,
            elemental_resist: `모든 원소 저항이 ${effect.value || 0}% 증가합니다.`,
            life_steal: `공격 시 생명력 흡수 +${effect.value || 0}%`,
            thorns: `받은 피해의 ${effect.value || 0}%를 반사합니다.`,
            fear: `대상이 ${effect.duration || 0}초 동안 도망치게 합니다.`,
            charm: `대상이 ${effect.duration || 0}초 동안 아군이 됩니다.`
        };

        return effectMap[effect.type] || `${effect.type} 효과`;
    }

    /**
     * 공격 타입 텍스트 반환
     * @param {string} type - 공격 타입
     * @returns {string} - 공격 타입 설명
     */
    getAttackTypeText(type) {
        const typeMap = {
            melee: '근접 공격',
            ranged: '원거리 공격',
            magic: '마법 공격',
            hybrid: '혼합 공격'
        };

        return typeMap[type] || '기본 공격';
    }

    /**
     * 원소 속성 텍스트 반환
     * @param {string} element - 원소 속성
     * @returns {string} - 원소 속성 설명
     */
    getElementText(element) {
        const elementMap = {
            neutral: '무속성',
            fire: '화염',
            ice: '얼음',
            lightning: '번개',
            earth: '대지',
            wind: '바람',
            light: '빛',
            dark: '어둠',
            poison: '독',
            holy: '신성',
            chaos: '혼돈'
        };

        return elementMap[element] || '무속성';
    }

    /**
     * 난이도 텍스트 반환
     * @param {number} difficulty - 난이도 (1-5)
     * @returns {string} - 난이도 설명
     */
    getDifficultyText(difficulty) {
        const difficultyMap = {
            1: '쉬움',
            2: '보통',
            3: '어려움',
            4: '매우 어려움',
            5: '악몽'
        };

        return difficultyMap[difficulty] || '보통';
    }

    /**
     * 상태 효과 텍스트 반환
     * @param {string} effect - 상태 효과
     * @returns {string} - 상태 효과 설명
     */
    getStatusEffectText(effect) {
        const effectMap = {
            burn: '화상',
            poison: '중독',
            stun: '기절',
            slow: '감속',
            freeze: '빙결',
            silence: '침묵',
            blind: '실명',
            charm: '매혹',
            fear: '공포',
            bleeding: '출혈',
            curse: '저주',
            paralyze: '마비'
        };

        return effectMap[effect] || effect;
    }

    /**
     * 신단 효과 텍스트 반환
     * @param {string} effect - 신단 효과
     * @param {*} value - 효과 값
     * @returns {string} - 효과 설명
     */
    getShrineEffectText(effect, value) {
        const effectMap = {
            heal: `모든 체력을 ${value}% 회복합니다.`,
            mana: `모든 마나를 ${value}% 회복합니다.`,
            damage: `공격력이 ${value}% 증가합니다.`,
            defense: `방어력이 ${value}% 증가합니다.`,
            speed: `이동 속도가 ${value}% 증가합니다.`,
            critRate: `치명타 확률이 ${value}% 증가합니다.`,
            goldFind: `골드 획득량이 ${value}% 증가합니다.`,
            expBonus: `경험치 획득량이 ${value}% 증가합니다.`,
            itemFind: `아이템 획득 확률이 ${value}% 증가합니다.`,
            hpRegen: `체력 재생이 ${value}% 증가합니다.`,
            mpRegen: `마나 재생이 ${value}% 증가합니다.`,
            cooldown: `스킬 쿨다운이 ${value}% 감소합니다.`,
            revealMap: `미니맵에 ${value ? '모든 방' : '가까운 방'}이 표시됩니다.`,
            doubleGold: `${value}% 확률로 골드 획득량이 두 배가 됩니다.`,
            elementalResist: `모든 원소 저항이 ${value}% 증가합니다.`,
            extraLife: `던전에서 사망 시 ${value}회 부활합니다.`
        };

        return effectMap[effect] || `${effect} +${value}`;
    }

    /**
     * 상인 유형 텍스트 반환
     * @param {Object} merchantData - 상인 데이터
     * @returns {string} - 상인 유형 설명
     */
    getMerchantTypeText(merchantData) {
        if (!merchantData || !merchantData.itemTypes) return '일반 상품';

        const typeMap = {
            weapon: '무기',
            armor: '방어구',
            accessory: '악세서리',
            consumable: '소비 아이템',
            material: '재료',
            special: '특수 아이템',
            potion: '포션',
            scroll: '스크롤'
        };

        return merchantData.itemTypes.map(type => typeMap[type] || type).join(', ');
    }

    /**
     * 클래스 티어 텍스트 반환
     * @param {number} tier - 클래스 티어
     * @returns {string} - 티어 설명
     */
    getClassTierText(tier) {
        const tierMap = {
            1: '기본 클래스',
            2: '조합 클래스',
            3: '상급 클래스',
            4: '전설 클래스'
        };

        return tierMap[tier] || '미확인 클래스';
    }

    /**
     * 정리 메서드
     */
    shutdown() {
        // 이벤트 리스너 제거
        if (this.skipKey) {
            this.skipKey.off('down', this.handleSkipKey, this);
        }

        // 타이머 제거
        if (this.textTimer) {
            this.textTimer.remove();
        }

        // 대화창 제거
        if (this.dialogueBox) {
            this.dialogueBox.destroy();
            this.dialogueBox = null;
        }

        // 툴팁 제거
        this.hideItemTooltip();

        // 정보창 제거
        this.hideDetailInfo();
    }
}

export default Dialogue;