// src/utils/Config.js

/**
 * 게임 설정 및 상수를 관리하는 클래스
 * 게임 전체에서 사용되는 변수와 설정을 중앙화하여 관리
 */
class Config {
    constructor() {
        // 게임 기본 설정
        this.game = {
            width: 800,
            height: 600,
            title: 'Dungeon Loop',
            version: '0.1.0',
            debug: false,
            autoSaveInterval: 5 * 60 * 1000, // 5분 (밀리초)
            maxFPS: 60,
            backgroundColor: '#000000'
        };
        
        // 플레이어 기본 설정
        this.player = {
            moveSpeed: 150,
            dashSpeed: 300,
            dashDuration: 300, // 밀리초
            dashCooldown: 2000, // 밀리초
            interactionRadius: 50,
            defaultStats: {
                hp: 100,
                maxHp: 100,
                mp: 50,
                maxMp: 50,
                attack: 10,
                defense: 5,
                speed: 5
            },
            invincibilityTime: 1000, // 피격 후 무적 시간 (밀리초)
            skillSlots: 4,
            consumableSlots: 4
        };
        
        // 던전 설정
        this.dungeon = {
            tileSize: 32,
            roomMinSize: 5,
            roomMaxSize: 12,
            minRooms: 8,
            maxRooms: 15,
            corridorWidth: 2,
            monsterDensity: 0.6, // 방 크기 대비 몬스터 수 비율
            specialRoomChance: 0.2, // 특수 방 확률 (0.0 ~ 1.0)
            timeScaleBase: 30 * 60 * 1000, // 기본 던전 제한 시간 (30분)
            monsterStrengtheningInterval: 5 * 60 * 1000, // 5분마다 몬스터 강화
            monsterStrengtheningRate: {
                health: 0.1, // 10% 증가
                damage: 0.15, // 15% 증가
                defense: 0.05 // 5% 증가
            },
            timeBonusThresholds: {
                fast: 10 * 60 * 1000, // 10분 이내
                medium: 20 * 60 * 1000, // 20분 이내
                slow: 30 * 60 * 1000 // 30분 이내
            }
        };
        
        // 카메라 설정
        this.camera = {
            followOffset: 50,
            zoomDefault: 1.0,
            zoomMin: 0.7,
            zoomMax: 1.5,
            zoomSpeed: 0.1,
            smoothFactor: 0.1 // 카메라 부드러움 (0.0 ~ 1.0)
        };
        
        // UI 설정
        this.ui = {
            fontSize: {
                small: 12,
                normal: 16,
                large: 20,
                header: 24,
                title: 32
            },
            fontFamily: 'Arial, sans-serif',
            colors: {
                primary: '#4CAF50',
                secondary: '#2196F3',
                accent: '#FF9800',
                danger: '#F44336',
                neutral: '#9E9E9E',
                background: '#212121',
                foreground: '#FAFAFA',
                overlay: 'rgba(0, 0, 0, 0.7)'
            },
            itemRarityColors: {
                common: '#FFFFFF',
                uncommon: '#2ECC71',
                rare: '#3498DB',
                epic: '#9B59B6',
                legendary: '#F39C12',
                mythic: '#E74C3C'
            },
            fadeTime: 200, // UI 페이드 시간 (밀리초)
            tooltipDelay: 500, // 툴팁 표시 지연시간 (밀리초)
            damageFontSize: 16, // 대미지 표시 글자 크기
            damageColors: {
                normal: '#FFFFFF',
                critical: '#FF0000',
                heal: '#00FF00',
                mana: '#0000FF'
            },
            hudOpacity: 0.9,
            minimapSize: 150, // 미니맵 크기
            minimapOpacity: 0.7
        };
        
        // 전투 설정
        this.combat = {
            hitboxTolerance: 10, // 명중 판정 허용 오차
            criticalMultiplier: 2.0, // 치명타 대미지 배수
            dashInvincibility: true, // 대쉬 중 무적 여부
            elementalEffectiveness: {
                // key: 공격 속성, value: [약점, 저항]
                fire: ['ice', 'water'],
                ice: ['lightning', 'fire'],
                lightning: ['water', 'earth'],
                earth: ['fire', 'lightning'],
                water: ['fire', 'ice'],
                light: ['dark', 'light'],
                dark: ['light', 'dark']
            },
            weaknessMultiplier: 1.5, // 약점 속성 공격 시 대미지 배수
            resistanceMultiplier: 0.7, // 저항 속성 공격 시 대미지 배수
            comboTimeWindow: 2000, // 콤보 유지 시간 (밀리초)
            comboMaxMultiplier: 1.5, // 최대 콤보 대미지 배수
            knockbackDistance: 100, // 넉백 거리
            statusEffectDurationBase: {
                burn: 5000, // 화상 (밀리초)
                freeze: 3000, // 빙결
                shock: 4000, // 감전
                poison: 8000, // 독
                stun: 2000, // 기절
                slow: 4000 // 감속
            }
        };
        
        // 아이템 설정
        this.item = {
            dropLifetime: 60000, // 바닥에 떨어진 아이템 지속시간 (1분)
            identifyCost: 100, // 미감정 아이템 감정 비용
            upgradeSuccessBase: { // 강화 기본 성공률
                common: 0.9,
                uncommon: 0.8,
                rare: 0.6,
                epic: 0.4,
                legendary: 0.2,
                mythic: 0.1
            },
            upgradeCostBase: { // 강화 기본 비용
                common: 50,
                uncommon: 100,
                rare: 200,
                epic: 500,
                legendary: 1000,
                mythic: 2000
            },
            inventorySlots: 30, // 기본 인벤토리 슬롯 수
            maxUpgradeLevel: 10, // 최대 강화 레벨
            enhancementBonusPerLevel: 0.1, // 강화 당 기본 능력치 증가율 (10%)
            itemGenerationBias: { // 아이템 생성 바이어스 (아이템 타입 분포)
                weapon: 0.3,
                armor: 0.3,
                accessory: 0.2,
                consumable: 0.2
            },
            soulboundChance: { // 영혼 결속 확률 (판매/거래 불가)
                common: 0.0,
                uncommon: 0.1,
                rare: 0.2,
                epic: 0.5,
                legendary: 0.8,
                mythic: 1.0
            },
            itemScaling: { // 아이템 스케일링 계수 (레벨당)
                weaponDamage: 1.2,
                armorDefense: 1.15,
                statBonus: 1.1
            }
        };
        
        // 클래스 설정
        this.classes = {
            // 티어당 기본 패시브
            defaultPassives: {
                1: { type: 'stat_increase', value: 5, description: '모든 스탯 +5%' },
                2: { type: 'stat_increase', value: 10, description: '모든 스탯 +10%' },
                3: { type: 'stat_increase', value: 15, description: '모든 스탯 +15%' }
            },
            // 레벨당 획득 스킬 포인트
            skillPointsPerLevel: {
                '1-10': 1,
                '11-20': 2,
                '21-30': 3
            },
            maxLevel: 30, // 최대 레벨
            expBase: 100, // 기준 경험치
            expGrowth: 1.5, // 경험치 증가율
            maxSkillLevel: 5, // 최대 스킬 레벨
            // 아이템 종류별 클래스 보너스
            classItemBonuses: {
                warrior: { weapon: 'sword', armor: 'heavy' },
                mage: { weapon: 'staff', armor: 'cloth' },
                archer: { weapon: 'bow', armor: 'light' },
                thief: { weapon: 'dagger', armor: 'light' },
                priest: { weapon: 'mace', armor: 'cloth' }
            },
            // 클래스 조합 기본 성공률
            combinationBaseChance: {
                tier2: 80,
                tier3: 50,
                tier4: 25
            },
            // 클래스 조합 비용
            combinationCosts: {
                2: 1000,
                3: 5000,
                4: 20000
            },
            // 최대 성공률 (모든 보너스 포함)
            maxCombinationChance: 95
        };
        
        // 상인 설정
        this.merchant = {
            buyRatio: 0.5, // 상인 구매 가격 비율 (판매 가격의 50%)
            sellRatioBase: 1.5, // 상인 판매 가격 비율 (기본 가격의 150%)
            shopRefreshCost: 500, // 상점 새로고침 비용
            inventorySizeMin: {
                common: 5,
                rare: 4,
                legendary: 3
            },
            inventorySizeMax: {
                common: 10,
                rare: 7,
                legendary: 5
            },
            // 상인 유형별 아이템 희귀도 분포
            rarityDistribution: {
                common: {
                    common: 0.6,
                    uncommon: 0.3,
                    rare: 0.09,
                    epic: 0.01,
                    legendary: 0.0
                },
                rare: {
                    common: 0.2,
                    uncommon: 0.4,
                    rare: 0.3,
                    epic: 0.09,
                    legendary: 0.01
                },
                legendary: {
                    common: 0.0,
                    uncommon: 0.2,
                    rare: 0.5,
                    epic: 0.25,
                    legendary: 0.05
                }
            }
        };
        
        // 오디오 설정
        this.audio = {
            musicVolume: 0.5,
            sfxVolume: 0.7,
            fadeTime: 1000, // 오디오 페이드 시간 (밀리초)
            maxConcurrentSounds: 8, // 동시에 재생 가능한 최대 효과음 수
            musicByDungeon: {
                forest: 'forest_theme',
                cave: 'cave_theme',
                tower: 'tower_theme',
                castle: 'castle_theme',
                void: 'void_theme'
            },
            bossMusic: 'boss_battle',
            soundGroups: {
                combat: 0.7, // 그룹별 볼륨 배수
                environment: 0.5,
                ui: 0.8,
                footsteps: 0.3,
                ambient: 0.4
            }
        };
        
        // 성취 및 업적 시스템
        this.achievements = {
            categories: [
                'Combat',
                'Exploration',
                'Collection',
                'Mastery'
            ],
            tiers: {
                bronze: {
                    pointsRequired: 0,
                    rewards: {
                        gold: 500,
                        title: '초보 모험가'
                    }
                },
                silver: {
                    pointsRequired: 100,
                    rewards: {
                        gold: 2000,
                        title: '유능한 모험가'
                    }
                },
                gold: {
                    pointsRequired: 300,
                    rewards: {
                        gold: 5000,
                        specialItem: 'achievement_chest_gold',
                        title: '대담한 모험가'
                    }
                },
                platinum: {
                    pointsRequired: 600,
                    rewards: {
                        gold: 10000,
                        specialItem: 'achievement_chest_platinum',
                        title: '전설적인 모험가'
                    }
                },
                diamond: {
                    pointsRequired: 1000,
                    rewards: {
                        gold: 20000,
                        legacyItem: 'crown_of_kings',
                        title: '영원의 챔피언'
                    }
                }
            }
        };
        
        // 키 설정 (기본값)
        this.keys = {
            up: 'W',
            down: 'S',
            left: 'A',
            right: 'D',
            dash: 'SHIFT',
            interact: 'E',
            inventory: 'I',
            map: 'M',
            skill1: 'Q',
            skill2: 'R',
            skill3: 'F',
            skill4: 'C',
            consumable1: '1',
            consumable2: '2',
            consumable3: '3',
            consumable4: '4',
            pause: 'ESC'
        };
        
        // 저장 및 쿠키 설정
        this.storage = {
            savePrefix: 'dungeon_loop_',
            cookieExpiration: 365, // 일
            maxSaveSlots: 3,
            autoSaveSlot: 'auto',
            encryptSaves: false, // 저장 암호화 여부
            useCompression: true // 저장 데이터 압축 여부
        };
        
        // 몬스터 설정
        this.monster = {
            aggroRadius: 200, // 적 인식 범위
            maxAggroRadius: 500, // 최대 적 인식 범위 (난이도에 따라 증가)
            leashRadius: 300, // 원래 위치에서 떨어질 수 있는 최대 거리
            searchTimeMax: 3000, // 플레이어 추적 최대 시간 (밀리초)
            wanderPauseTimeMin: 1000, // 방황 중 멈춤 시간 최소 (밀리초)
            wanderPauseTimeMax: 3000, // 방황 중 멈춤 시간 최대
            wanderDistanceMin: 50, // 방황 거리 최소
            wanderDistanceMax: 150, // 방황 거리 최대
            eliteSpawnChance: 0.05, // 엘리트 몬스터 등장 확률
            bossHealthMultiplier: 10, // 보스 체력 배수
            bossDamageMultiplier: 2, // 보스 공격력 배수
            eliteHealthMultiplier: 3, // 엘리트 체력 배수
            eliteDamageMultiplier: 1.5, // 엘리트 공격력 배수
            minionSpawnCooldown: 20000, // 하수인 소환 쿨다운 (밀리초)
            maxMinionsPerBoss: 5, // 보스당 최대 하수인 수
            bossEnrageTime: 180000, // 보스 격노 시간 (3분)
            // 몬스터 경험치 계수
            expMultiplier: {
                normal: 1.0,
                elite: 3.0,
                boss: 10.0,
                minion: 0.5
            },
            // 몬스터 골드 계수
            goldMultiplier: {
                normal: 1.0,
                elite: 2.5,
                boss: 8.0,
                minion: 0.3
            }
        };
        
        // 특수 방 설정
        this.specialRooms = {
            spawnChances: {
                treasure: 0.4, // 보물 방
                challenge: 0.3, // 도전 방
                merchant: 0.2, // 상인 방
                shrine: 0.1 // 신단 방
            },
            treasureRoomGuardianChance: 0.5, // 보물 방 가디언 등장 확률
            challengeWavesMin: 2, // 도전 방 최소 웨이브 수
            challengeWavesMax: 4, // 도전 방 최대 웨이브 수
            shrineEffectDuration: 300, // 신단 효과 지속시간 (초)
            minionSpawnInterval: 3000, // 도전 방 하수인 소환 간격
            treasureChestTrapChance: 0.2 // 보물 상자 함정 확률
        };
        
        // 레거시 아이템 보너스
        this.legacyItemBonuses = {
            soul_guardian: {
                description: '던전 당 1회 부활',
                effect: 'resurrect_once'
            },
            golden_key: {
                description: '조합 성공률 20% 증가',
                effect: 'combination_chance_boost',
                value: 20
            },
            ancient_compass: {
                description: '전체 던전 지도 공개',
                effect: 'reveal_map'
            },
            philosophers_stone: {
                description: '몬스터로부터 재료 획득 +30%',
                effect: 'material_drop_rate',
                value: 30
            },
            kings_crown: {
                description: '경험치 획득 +20%',
                effect: 'exp_gain_boost',
                value: 20
            },
            dragon_heart: {
                description: '모든 스탯 +15%',
                effect: 'all_stats_boost',
                value: 15
            },
            time_hourglass: {
                description: '던전 난이도 스케일링 감소',
                effect: 'difficulty_scaling_reduction',
                value: 25
            },
            dimensional_pouch: {
                description: '인벤토리 슬롯 +10',
                effect: 'inventory_slots',
                value: 10
            },
            alchemist_pendant: {
                description: '20% 확률로 재료 소비 안 함',
                effect: 'material_conservation_chance',
                value: 20
            },
            secret_tome: {
                description: '적에 대한 숨겨진 정보 공개',
                effect: 'reveal_enemy_info'
            }
        };
        
        // 이펙트 설정
        this.effects = {
            particleCount: {
                low: 5,
                medium: 10,
                high: 20,
                veryHigh: 40
            },
            particleLifetime: {
                short: 300,
                medium: 800,
                long: 1500
            },
            slashEffectSpeed: 300,
            arrowSpeed: 400,
            magicProjectileSpeed: 350,
            healEffectDuration: 1000,
            levelUpEffectDuration: 2000,
            chestOpenEffectDuration: 1000,
            damageNumberLifetime: 1000,
            damageNumberRiseDistance: 30,
            stunStarRotationSpeed: 0.1,
            itemGlowPulseSpeed: 2,
            legendaryBeamHeight: 100,
            shrineActivateEffectDuration: 3000
        };
        
        // 함정 및 환경 설정
        this.traps = {
            spikeDamagePercent: 0.2, // 최대 체력 대비 대미지
            poisonCloudDuration: 5000, // 독 구름 지속시간
            poisonDamagePercent: 0.05, // 최대 체력 대비 독 틱당 대미지
            poisonTickInterval: 1000, // 독 대미지 틱 간격
            fireTrapDamagePercent: 0.1, // 최대 체력 대비 대미지
            fireTrapDuration: 3000, // 화염 함정 지속시간
            iceTrapSlowPercent: 50, // 냉기 함정 슬로우 %
            iceTrapDuration: 4000, // 냉기 함정 지속시간
            arrowTrapDamagePercent: 0.15, // 최대 체력 대비 대미지
            arrowTrapCooldown: 3000, // 화살 함정 재발동 시간
            trapTriggerRadius: 30, // 함정 작동 반경
            trapVisibilityChance: 0.3, // 함정 시야 탐지 기본 확률
            trapDetectionBonus: 0.05, // 지각 스탯당 함정 탐지 보너스
            envHazardDamagePercent: 0.1 // 환경 위험요소 대미지
        };
        
        // 난이도 설정
        this.difficulty = {
            levels: ['쉬움', '보통', '어려움', '전설적', '불멸'],
            modifiers: {
                easy: { // 쉬움
                    playerDamageMultiplier: 1.2,
                    enemyDamageMultiplier: 0.8,
                    enemyHealthMultiplier: 0.8,
                    dropRateMultiplier: 0.9,
                    expMultiplier: 0.9
                },
                normal: { // 보통 (기준)
                    playerDamageMultiplier: 1.0,
                    enemyDamageMultiplier: 1.0,
                    enemyHealthMultiplier: 1.0,
                    dropRateMultiplier: 1.0,
                    expMultiplier: 1.0
                },
                hard: { // 어려움
                    playerDamageMultiplier: 0.9,
                    enemyDamageMultiplier: 1.2,
                    enemyHealthMultiplier: 1.2,
                    dropRateMultiplier: 1.1,
                    expMultiplier: 1.1
                },
                legendary: { // 전설적
                    playerDamageMultiplier: 0.8,
                    enemyDamageMultiplier: 1.5,
                    enemyHealthMultiplier: 1.5,
                    dropRateMultiplier: 1.3,
                    expMultiplier: 1.3
                },
                immortal: { // 불멸
                    playerDamageMultiplier: 0.7,
                    enemyDamageMultiplier: 2.0,
                    enemyHealthMultiplier: 2.0,
                    dropRateMultiplier: 1.5,
                    expMultiplier: 1.5
                }
            }
        };
    }
    
    /**
     * 설정 값 가져오기
     * @param {string} section - 설정 섹션
     * @param {string} key - 설정 키
     * @param {*} defaultValue - 기본값 (설정이 없을 경우)
     * @returns {*} 설정 값
     */
    get(section, key, defaultValue = null) {
        if (this[section] && this[section][key] !== undefined) {
            return this[section][key];
        }
        return defaultValue;
    }
    
    /**
     * 설정 값 설정하기
     * @param {string} section - 설정 섹션
     * @param {string} key - 설정 키
     * @param {*} value - 설정 값
     * @returns {boolean} 성공 여부
     */
    set(section, key, value) {
        if (this[section]) {
            this[section][key] = value;
            return true;
        }
        return false;
    }
    
    /**
     * 설정 섹션 전체 가져오기
     * @param {string} section - 설정 섹션
     * @returns {Object} 섹션 객체
     */
    getSection(section) {
        return this[section] || {};
    }
    
    /**
     * 사용자 설정 적용하기
     * @param {Object} userSettings - 사용자 설정 객체
     */
    applyUserSettings(userSettings) {
        if (!userSettings) return;
        
        // 각 섹션별 설정 적용
        for (const section in userSettings) {
            if (this[section]) {
                for (const key in userSettings[section]) {
                    this[section][key] = userSettings[section][key];
                }
            }
        }
    }
    
    /**
     * 설정 값 초기화
     * @param {string} section - 설정 섹션 (선택적, 없으면 전체 초기화)
     */
    reset(section = null) {
        if (section) {
            // 개별 섹션 초기화
            const defaultConfig = new Config();
            this[section] = defaultConfig[section];
        } else {
            // 전체 초기화
            const defaultConfig = new Config();
            for (const section in defaultConfig) {
                this[section] = defaultConfig[section];
            }
        }
    }
    
    /**
     * 사용자 설정 저장하기
     * @returns {Object} 사용자 설정 객체
     */
    exportUserSettings() {
        const userSettings = {};
        
        // 사용자 설정이 필요한 섹션들
        const userSettingsSections = ['audio', 'keys', 'ui', 'game'];
        
        for (const section of userSettingsSections) {
            if (this[section]) {
                userSettings[section] = { ...this[section] };
            }
        }
        
        return userSettings;
    }
    
    /**
     * 난이도 설정 가져오기
     * @param {string} difficultyLevel - 난이도 레벨
     * @returns {Object} 난이도 설정 객체
     */
    getDifficultySettings(difficultyLevel) {
        const difficultyMap = {
            '쉬움': 'easy',
            '보통': 'normal',
            '어려움': 'hard',
            '전설적': 'legendary',
            '불멸': 'immortal'
        };
        
        const key = difficultyMap[difficultyLevel] || 'normal';
        return this.difficulty.modifiers[key] || this.difficulty.modifiers.normal;
    }
    
    /**
     * 랜덤 아이템 희귀도 결정
     * @param {string} monsterType - 몬스터 유형 (normal, elite, boss)
     * @param {number} luckBonus - 행운 보너스
     * @returns {string} 아이템 희귀도
     */
    rollItemRarity(monsterType, luckBonus = 0) {
        // 몬스터 유형별 희귀도 기본 확률
        const rarityChances = {
            'normal': {
                'common': 0.7,
                'uncommon': 0.25,
                'rare': 0.04,
                'epic': 0.01,
                'legendary': 0.0
            },
            'elite': {
                'common': 0.4,
                'uncommon': 0.4,
                'rare': 0.15,
                'epic': 0.04,
                'legendary': 0.01
            },
            'boss': {
                'common': 0.1,
                'uncommon': 0.3,
                'rare': 0.4,
                'epic': 0.15,
                'legendary': 0.05
            }
        };
        
        // 기본 확률 가져오기
        const chances = rarityChances[monsterType] || rarityChances['normal'];
        
        // 행운 보너스 적용 (희귀 등급 확률 증가)
        const roll = Math.random() * 100 - luckBonus;
        
        let cumulativeChance = 0;
        for (const [rarity, chance] of Object.entries(chances)) {
            cumulativeChance += chance * 100;
            if (roll < cumulativeChance) {
                return rarity;
            }
        }
        
        // 기본값 반환
        return 'common';
    }
    
    /**
     * 클래스 조합 확률 계산
     * @param {number} resultTier - 결과 클래스 티어
     * @param {number} class1Level - 첫 번째 클래스 레벨
     * @param {number} class2Level - 두 번째 클래스 레벨
     * @param {boolean} hasGoldenKey - 황금 열쇠 보유 여부
     * @param {number} alchemistBonus - 연금술사 보너스
     * @returns {Object} 확률 정보 {chance, factors}
     */
    calculateCombinationChance(resultTier, class1Level, class2Level, hasGoldenKey, alchemistBonus) {
        // 기본 확률
        let baseChance = this.classes.combinationBaseChance[`tier${resultTier}`] || 80;
        
        // 성공 요소
        const factors = {
            base: baseChance,
            levelBonus: 0,
            goldenKeyBonus: 0,
            alchemistBonus: 0
        };
        
        // 레벨 10 이상일 경우 추가 보너스 (레벨당 1%)
        if (class1Level > 10) {
            factors.levelBonus += (class1Level - 10);
        }
        
        if (class2Level > 10) {
            factors.levelBonus += (class2Level - 10);
        }
        
        // 황금 열쇠 보너스 (+20%)
        if (hasGoldenKey) {
            factors.goldenKeyBonus = this.legacyItemBonuses.golden_key.value || 20;
        }
        
        // 연금술사 보너스
        if (alchemistBonus > 0) {
            factors.alchemistBonus = alchemistBonus;
        }
        
        // 최종 확률 계산 (최대 95%)
        let finalChance = baseChance + 
                          factors.levelBonus + 
                          factors.goldenKeyBonus + 
                          factors.alchemistBonus;
        
        finalChance = Math.min(this.classes.maxCombinationChance, Math.max(5, finalChance));
        
        return {
            chance: finalChance,
            factors: factors
        };
    }
    
    /**
     * 스탯 보너스 계산
     * @param {number} baseStat - 기본 스탯 값
     * @param {number} level - 레벨
     * @param {number} growthRate - 성장률
     * @returns {number} 계산된 스탯 값
     */
    calculateStat(baseStat, level, growthRate) {
        return Math.floor(baseStat * Math.pow(growthRate, level - 1));
    }
    
    /**
     * 경험치 요구량 계산
     * @param {number} level - 현재 레벨
     * @returns {number} 다음 레벨에 필요한 경험치
     */
    getRequiredExp(level) {
        if (level >= this.classes.maxLevel) {
            return Infinity;
        }
        
        return Math.floor(this.classes.expBase * Math.pow(this.classes.expGrowth, level - 1));
    }
    
    /**
     * 레벨에 따른 스킬 포인트 획득량 계산
     * @param {number} level - 레벨
     * @returns {number} 획득 스킬 포인트
     */
    getSkillPointsForLevel(level) {
        // 레벨 범위별 스킬 포인트
        for (const range in this.classes.skillPointsPerLevel) {
            const [min, max] = range.split('-').map(Number);
            if (level >= min && level <= max) {
                return this.classes.skillPointsPerLevel[range];
            }
        }
        
        return 1; // 기본값
    }
    
    /**
     * 아이템 강화 비용 계산
     * @param {string} rarity - 아이템 희귀도
     * @param {number} currentLevel - 현재 강화 레벨
     * @returns {number} 강화 비용
     */
    calculateUpgradeCost(rarity, currentLevel) {
        const baseCost = this.item.upgradeCostBase[rarity] || 100;
        
        // 레벨에 따른 지수적 증가
        return Math.floor(baseCost * Math.pow(1.5, currentLevel));
    }
    
    /**
     * 아이템 강화 성공 확률 계산
     * @param {string} rarity - 아이템 희귀도
     * @param {number} currentLevel - 현재 강화 레벨
     * @param {number} luckBonus - 행운 보너스
     * @returns {number} 성공 확률 (0.0 ~ 1.0)
     */
    calculateUpgradeSuccess(rarity, currentLevel, luckBonus = 0) {
        const baseSuccess = this.item.upgradeSuccessBase[rarity] || 0.8;
        
        // 레벨에 따른 성공률 감소
        let success = baseSuccess * Math.pow(0.9, currentLevel);
        
        // 행운 보너스 적용
        success += luckBonus / 100;
        
        // 최소/최대 제한
        return Math.min(0.95, Math.max(0.05, success));
    }
    
    /**
     * 특정 던전 유형에 맞는 음악 가져오기
     * @param {string} dungeonType - 던전 유형
     * @returns {string} 음악 키
     */
    getMusicForDungeonType(dungeonType) {
        return this.audio.musicByDungeon[dungeonType] || 'forest_theme';
    }
    
    /**
     * 원소 상성 계산
     * @param {string} attackElement - 공격 원소
     * @param {string} defenseElement - 방어 원소
     * @returns {number} 대미지 배수
     */
    calculateElementalEffectiveness(attackElement, defenseElement) {
        if (!attackElement || !defenseElement) {
            return 1.0;
        }
        
        const effectiveness = this.combat.elementalEffectiveness[attackElement];
        
        if (!effectiveness) {
            return 1.0;
        }
        
        if (effectiveness[0] === defenseElement) {
            // 약점 속성
            return this.combat.weaknessMultiplier;
        } else if (effectiveness[1] === defenseElement) {
            // 저항 속성
            return this.combat.resistanceMultiplier;
        }
        
        return 1.0;
    }
    
    /**
     * 현재 설정된 난이도의 던전 시간 스케일 가져오기
     * @param {string} difficulty - 난이도
     * @returns {number} 시간 스케일 (밀리초)
     */
    getDungeonTimeScale(difficulty) {
        const difficultySettings = this.getDifficultySettings(difficulty);
        const baseTime = this.dungeon.timeScaleBase;
        
        // 난이도에 따른 시간 스케일링
        return Math.floor(baseTime / difficultySettings.enemyDamageMultiplier);
    }
    
    /**
     * 스탯에 따른 함정 탐지 확률 계산
     * @param {number} perceptionStat - 지각 스탯
     * @returns {number} 함정 탐지 확률 (0.0 ~ 1.0)
     */
    calculateTrapDetectionChance(perceptionStat) {
        const baseChance = this.traps.trapVisibilityChance;
        const bonusPerPoint = this.traps.trapDetectionBonus;
        
        // 지각 스탯에 따른 보너스
        const totalChance = baseChance + (perceptionStat * bonusPerPoint);
        
        // 최소/최대 제한
        return Math.min(0.95, Math.max(0.1, totalChance));
    }
    
    /**
     * 몬스터 레벨 스케일링 계산
     * @param {number} dungeonLevel - 던전 레벨
     * @param {number} elapsedTime - 경과 시간 (밀리초)
     * @returns {Object} 몬스터 스케일링 계수
     */
    calculateMonsterScaling(dungeonLevel, elapsedTime) {
        // 기본 레벨 스케일링
        const levelScaling = {
            health: 1 + (dungeonLevel * 0.1),
            damage: 1 + (dungeonLevel * 0.08),
            defense: 1 + (dungeonLevel * 0.05)
        };
        
        // 시간 경과에 따른 추가 스케일링
        const intervalsPassed = Math.floor(elapsedTime / this.dungeon.monsterStrengtheningInterval);
        const timeScaling = {
            health: 1 + (intervalsPassed * this.dungeon.monsterStrengtheningRate.health),
            damage: 1 + (intervalsPassed * this.dungeon.monsterStrengtheningRate.damage),
            defense: 1 + (intervalsPassed * this.dungeon.monsterStrengtheningRate.defense)
        };
        
        // 최종 스케일링 계산
        return {
            health: levelScaling.health * timeScaling.health,
            damage: levelScaling.damage * timeScaling.damage,
            defense: levelScaling.defense * timeScaling.defense
        };
    }
    
    /**
     * 아이템 품질에 따른 색상 가져오기
     * @param {string} rarity - 아이템 희귀도
     * @returns {string} 색상 코드
     */
    getItemRarityColor(rarity) {
        return this.ui.itemRarityColors[rarity] || '#FFFFFF';
    }
    
    /**
     * 던전 클리어 시간에 따른 시간 보너스 계산
     * @param {number} clearTime - 클리어 시간 (밀리초)
     * @returns {Object} 시간 보너스 계수
     */
    calculateTimeBonus(clearTime) {
        const thresholds = this.dungeon.timeBonusThresholds;
        
        if (clearTime <= thresholds.fast) {
            return {
                tier: 'fast',
                goldMultiplier: 1.5,
                expMultiplier: 1.3,
                rarityBoost: 0.2
            };
        } else if (clearTime <= thresholds.medium) {
            return {
                tier: 'medium',
                goldMultiplier: 1.25,
                expMultiplier: 1.15,
                rarityBoost: 0.1
            };
        } else {
            return {
                tier: 'slow',
                goldMultiplier: 1.0,
                expMultiplier: 1.0,
                rarityBoost: 0.0
            };
        }
    }
    
    /**
     * 설정 값을 로컬 스토리지에서 로드
     */
    loadFromStorage() {
        try {
            const storedSettings = localStorage.getItem(`${this.storage.savePrefix}settings`);
            
            if (storedSettings) {
                const userSettings = JSON.parse(storedSettings);
                this.applyUserSettings(userSettings);
                return true;
            }
        } catch (error) {
            console.error('설정 로드 오류:', error);
        }
        
        return false;
    }
    
    /**
     * 설정 값을 로컬 스토리지에 저장
     */
    saveToStorage() {
        try {
            const userSettings = this.exportUserSettings();
            localStorage.setItem(`${this.storage.savePrefix}settings`, JSON.stringify(userSettings));
            return true;
        } catch (error) {
            console.error('설정 저장 오류:', error);
        }
        
        return false;
    }
}

// 싱글톤 인스턴스 생성 및 내보내기
const config = new Config();
export default config;