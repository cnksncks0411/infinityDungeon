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
        panel.fillStyle(0x333333, 0