// src/systems/DungeonGenerator.js
class DungeonGenerator {
  constructor(scene) {
    this.scene = scene;
    this.dungeonConfig = {
      roomSizeMin: 5,
      roomSizeMax: 15,
      maxRooms: 15,
      minRooms: 8,
      specialRoomChance: 0.3 // 30% 확률로 특수 방 생성
    };
  }

  // 새로운 던전 생성
  generateDungeon(dungeonId, difficulty = 1) {
    // 기본 던전 정보
    const dungeon = {
      id: dungeonId,
      difficulty: difficulty,
      floor: Math.ceil(difficulty / 3), // 3단계마다 새로운 층
      rooms: [],
      doors: [],
      type: this.getDungeonType(dungeonId),
      width: 0,
      height: 0,
      startRoom: null,
      endRoom: null
    };

    // 던전 타입에 따른 설정 조정
    this.adjustConfigForDungeonType(dungeon.type, difficulty);

    // 방 생성
    this.generateRooms(dungeon);

    // 방 연결 (문/복도)
    this.connectRooms(dungeon);

    // 몬스터 및 아이템 배치
    this.populateDungeon(dungeon);

    // 시작 및 종료 지점 지정
    this.assignStartAndEnd(dungeon);

    return dungeon;
  }

  // 던전 타입 가져오기
  getDungeonType(dungeonId) {
    // 던전 ID로부터 타입 결정
    const dungeonTypes = {
      'sword_forest': 'forest',
      'staff_tower': 'tower',
      'temple_ruins': 'ruins',
      'crystal_caves': 'cave',
      'dark_castle': 'castle',
      'forbidden_library': 'library',
      'abandoned_mine': 'mine',
      'ancient_city': 'city'
    };

    return dungeonTypes[dungeonId] || 'generic';
  }

  // 던전 타입에 따라 설정 조정
  adjustConfigForDungeonType(type, difficulty) {
    // 기본 설정 복원
    this.dungeonConfig = {
      roomSizeMin: 5,
      roomSizeMax: 15,
      maxRooms: 15,
      minRooms: 8,
      specialRoomChance: 0.3
    };

    // 던전 타입별 조정
    switch (type) {
      case 'forest':
        // 숲은 좀 더 유기적인 넓은 방들
        this.dungeonConfig.roomSizeMin = 8;
        this.dungeonConfig.roomSizeMax = 20;
        this.dungeonConfig.specialRoomChance = 0.4;
        break;
      case 'tower':
        // 타워는 작은 방들이 많음
        this.dungeonConfig.roomSizeMin = 4;
        this.dungeonConfig.roomSizeMax = 10;
        this.dungeonConfig.maxRooms = 20;
        this.dungeonConfig.specialRoomChance = 0.25;
        break;
      case 'cave':
        // 동굴은 불규칙한 크기의 방
        this.dungeonConfig.roomSizeMin = 4;
        this.dungeonConfig.roomSizeMax = 25;
        this.dungeonConfig.specialRoomChance = 0.2;
        break;
      case 'ruins':
        // 유적은 중간 크기의 방들
        this.dungeonConfig.roomSizeMin = 6;
        this.dungeonConfig.roomSizeMax = 12;
        this.dungeonConfig.specialRoomChance = 0.35;
        break;
      case 'castle':
        // 성은 정형화된 크기
        this.dungeonConfig.roomSizeMin = 7;
        this.dungeonConfig.roomSizeMax = 14;
        this.dungeonConfig.maxRooms = 18;
        this.dungeonConfig.specialRoomChance = 0.3;
        break;
    }

    // 난이도에 따른 조정
    this.dungeonConfig.maxRooms += Math.floor(difficulty / 2); // 난이도가 증가할수록 더 많은 방
    this.dungeonConfig.specialRoomChance += difficulty * 0.01; // 난이도가 증가할수록 특수 방 증가
  }

  // 방 생성
  generateRooms(dungeon) {
    // 생성할 방 개수 결정
    const numRooms = Phaser.Math.Between(
      this.dungeonConfig.minRooms,
      this.dungeonConfig.maxRooms
    );

    for (let i = 0; i < numRooms; i++) {
      // 최대 20번 시도하여 겹치지 않는 방 생성
      let room = null;
      let validRoom = false;
      let attempts = 0;

      while (!validRoom && attempts < 20) {
        // 방 크기 및 위치 결정
        const width = Phaser.Math.Between(
          this.dungeonConfig.roomSizeMin,
          this.dungeonConfig.roomSizeMax
        );
        const height = Phaser.Math.Between(
          this.dungeonConfig.roomSizeMin,
          this.dungeonConfig.roomSizeMax
        );

        // 던전 중앙에서부터 방을 배치하기 위한 위치 계산
        const x = Phaser.Math.Between(-50, 50);
        const y = Phaser.Math.Between(-50, 50);

        room = {
          id: i,
          x: x,
          y: y,
          width: width,
          height: height,
          centerX: x + Math.floor(width / 2),
          centerY: y + Math.floor(height / 2),
          neighbors: [],
          doors: [],
          type: this.determineRoomType(i, numRooms),
          entities: []
        };

        // 다른 방과 겹치는지 확인
        validRoom = true;
        for (const otherRoom of dungeon.rooms) {
          if (this.roomsIntersect(room, otherRoom, 2)) { // 2 타일 간격 유지
            validRoom = false;
            break;
          }
        }

        attempts++;
      }

      // 유효한 방을 찾았으면 추가
      if (validRoom) {
        dungeon.rooms.push(room);

        // 던전 크기 업데이트
        dungeon.width = Math.max(dungeon.width, room.x + room.width);
        dungeon.height = Math.max(dungeon.height, room.y + room.height);
      }
    }

    // 던전 영역이 음수 좌표를 갖지 않도록 오프셋 조정
    const minX = Math.min(0, ...dungeon.rooms.map(r => r.x));
    const minY = Math.min(0, ...dungeon.rooms.map(r => r.y));

    if (minX < 0 || minY < 0) {
      const offsetX = minX < 0 ? Math.abs(minX) : 0;
      const offsetY = minY < 0 ? Math.abs(minY) : 0;

      // 모든 방의 좌표 조정
      for (const room of dungeon.rooms) {
        room.x += offsetX;
        room.y += offsetY;
        room.centerX += offsetX;
        room.centerY += offsetY;
      }

      // 던전 크기 업데이트
      dungeon.width += offsetX;
      dungeon.height += offsetY;
    }
  }

  // 방 타입 결정
  determineRoomType(roomIndex, totalRooms) {
    // 첫 번째 방은 항상 입구
    if (roomIndex === 0) return 'entrance';

    // 마지막 방은 항상 보스룸
    if (roomIndex === totalRooms - 1) return 'boss';

    // 특수 방 결정
    if (Math.random() < this.dungeonConfig.specialRoomChance) {
      const specialRooms = ['treasure', 'challenge', 'merchant', 'shrine'];
      return specialRooms[Math.floor(Math.random() * specialRooms.length)];
    }

    // 나머지는 일반 방
    return 'normal';
  }

  // 두 방이 겹치는지 확인
  roomsIntersect(room1, room2, padding = 0) {
    return !(
      room1.x - padding > room2.x + room2.width + padding ||
      room1.x + room1.width + padding < room2.x - padding ||
      room1.y - padding > room2.y + room2.height + padding ||
      room1.y + room1.height + padding < room2.y - padding
    );
  }

  // 방 연결 (문 및 복도)
  connectRooms(dungeon) {
    // 최소 스패닝 트리 알고리즘 사용
    // 1. 각 방 간의 거리 계산
    const distances = [];

    for (let i = 0; i < dungeon.rooms.length; i++) {
      for (let j = i + 1; j < dungeon.rooms.length; j++) {
        const room1 = dungeon.rooms[i];
        const room2 = dungeon.rooms[j];

        const distance = this.calculateDistance(room1, room2);

        distances.push({
          from: i,
          to: j,
          distance: distance
        });
      }
    }

    // 2. 거리에 따라 정렬
    distances.sort((a, b) => a.distance - b.distance);

    // 3. 최소 스패닝 트리 구성
    const connectedRooms = new Set([0]); // 첫 번째 방부터 시작

    // 모든 방이 연결될 때까지
    while (connectedRooms.size < dungeon.rooms.length) {
      for (const connection of distances) {
        // 한 쪽만 연결된 경우에만 새로운 연결 추가
        if (
          (connectedRooms.has(connection.from) && !connectedRooms.has(connection.to)) ||
          (connectedRooms.has(connection.to) && !connectedRooms.has(connection.from))
        ) {
          // 두 방 연결
          this.connectTwoRooms(dungeon, connection.from, connection.to);

          // 연결된 방 기록
          connectedRooms.add(connection.from);
          connectedRooms.add(connection.to);
          break;
        }
      }
    }

    // 4. 순환 경로 몇 개 추가 (20% 확률로 추가 연결)
    for (const connection of distances) {
      if (
        !dungeon.rooms[connection.from].neighbors.includes(connection.to) &&
        Math.random() < 0.2
      ) {
        this.connectTwoRooms(dungeon, connection.from, connection.to);
      }
    }
  }

  // 두 방 사이의 거리 계산
  calculateDistance(room1, room2) {
    return Math.sqrt(
      Math.pow(room1.centerX - room2.centerX, 2) +
      Math.pow(room1.centerY - room2.centerY, 2)
    );
  }

  // 두 방 연결
  connectTwoRooms(dungeon, room1Index, room2Index) {
    const room1 = dungeon.rooms[room1Index];
    const room2 = dungeon.rooms[room2Index];

    // 이미 연결되어 있는지 확인
    if (room1.neighbors.includes(room2Index)) return;

    // 방 사이에 문 생성
    const door = {
      from: room1Index,
      to: room2Index,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0
    };

    // 방향 결정 (가로 또는 세로)
    const horizontal = Math.abs(room1.centerX - room2.centerX) >= Math.abs(room1.centerY - room2.centerY);

    if (horizontal) {
      // 가로 연결
      door.fromX = room1.centerX < room2.centerX ? room1.x + room1.width : room1.x;
      door.fromY = room1.centerY;
      door.toX = room1.centerX < room2.centerX ? room2.x : room2.x + room2.width;
      door.toY = room2.centerY;
    } else {
      // 세로 연결
      door.fromX = room1.centerX;
      door.fromY = room1.centerY < room2.centerY ? room1.y + room1.height : room1.y;
      door.toX = room2.centerX;
      door.toY = room1.centerY < room2.centerY ? room2.y : room2.y + room2.height;
    }

    // 방 연결 정보 업데이트
    room1.neighbors.push(room2Index);
    room2.neighbors.push(room1Index);

    // 방 문 정보 업데이트
    room1.doors.push({ x: door.fromX, y: door.fromY, toRoom: room2Index });
    room2.doors.push({ x: door.toX, y: door.toY, toRoom: room1Index });

    // 던전 문 목록에 추가
    dungeon.doors.push(door);
  }

  // 던전에 몬스터 및 아이템 배치
  populateDungeon(dungeon) {
    for (const room of dungeon.rooms) {
      switch (room.type) {
        case 'normal':
          this.populateNormalRoom(dungeon, room);
          break;
        case 'treasure':
          this.populateTreasureRoom(dungeon, room);
          break;
        case 'challenge':
          this.populateChallengeRoom(dungeon, room);
          break;
        case 'merchant':
          this.populateMerchantRoom(dungeon, room);
          break;
        case 'shrine':
          this.populateShrineRoom(dungeon, room);
          break;
        case 'boss':
          this.populateBossRoom(dungeon, room);
          break;
        case 'entrance':
          // 입구에는 아무것도 없음
          break;
      }

      // 함정 및 환경적 위험 추가
      this.addTrapsAndHazards(dungeon, room);
    }
  }

  // 일반 방 구성
  populateNormalRoom(dungeon, room) {
    const difficulty = dungeon.difficulty;

    // 몬스터 수 결정 (난이도와 방 크기에 비례)
    const area = room.width * room.height;
    const maxMonsters = Math.min(10, Math.floor(area / 25));
    const numMonsters = Phaser.Math.Between(
      Math.floor(maxMonsters / 2),
      maxMonsters
    );

    // 몬스터 생성
    for (let i = 0; i < numMonsters; i++) {
      const monster = this.createMonster(dungeon, room, difficulty);
      room.entities.push(monster);
    }

    // 일반 아이템 추가 (30% 확률)
    if (Math.random() < 0.3) {
      const item = this.createItem(dungeon, difficulty);
      room.entities.push({
        type: 'item',
        ...item,
        x: Phaser.Math.Between(room.x + 2, room.x + room.width - 2),
        y: Phaser.Math.Between(room.y + 2, room.y + room.height - 2)
      });
    }
  }

  // 보물방 구성
  populateTreasureRoom(dungeon, room) {
    const difficulty = dungeon.difficulty;

    // 보물 상자 생성
    const numChests = Phaser.Math.Between(1, 3);

    for (let i = 0; i < numChests; i++) {
      const rarity = this.determineItemRarity(difficulty, true); // 보물방은 더 좋은 아이템

      room.entities.push({
        type: 'chest',
        rarity: rarity,
        x: Phaser.Math.Between(room.x + 2, room.x + room.width - 2),
        y: Phaser.Math.Between(room.y + 2, room.y + room.height - 2),
        opened: false
      });
    }

    // 가끔 가디언 몬스터 배치
    if (Math.random() < 0.5) {
      const guardian = this.createMonster(dungeon, room, difficulty + 1, true);
      guardian.isElite = true; // 보물방 가디언은 항상 엘리트
      room.entities.push(guardian);
    }
  }

  // 도전방 구성
  populateChallengeRoom(dungeon, room) {
    const difficulty = dungeon.difficulty;

    // 도전방은 웨이브로 몬스터 등장
    room.waves = {
      total: Phaser.Math.Between(2, 4),
      current: 0,
      completed: false
    };

    // 각 웨이브에 적 배치
    room.waveEntities = [];

    for (let wave = 0; wave < room.waves.total; wave++) {
      const numMonsters = Phaser.Math.Between(3, 6);
      const waveMonsters = [];

      for (let i = 0; i < numMonsters; i++) {
        // 마지막 웨이브는 더 강한 적
        const eliteChance = wave === room.waves.total - 1 ? 0.5 : 0.2;
        const monster = this.createMonster(dungeon, room, difficulty + wave, Math.random() < eliteChance);
        waveMonsters.push(monster);
      }

      room.waveEntities.push(waveMonsters);
    }

    // 도전 완료 시 보상
    room.reward = {
      gold: 50 * difficulty,
      items: [this.createItem(dungeon, difficulty + 1)]
    };
  }

  // 상인방 구성
  populateMerchantRoom(dungeon, room) {
    const difficulty = dungeon.difficulty;

    // 상인 NPC 배치
    room.entities.push({
      type: 'merchant',
      x: room.centerX,
      y: room.centerY,
      inventory: this.generateMerchantInventory(difficulty)
    });
  }

  // 신단방 구성
  populateShrineRoom(dungeon, room) {
    // 신단 타입 결정
    const shrineTypes = ['health', 'strength', 'defense', 'speed', 'mana'];
    const shrineType = shrineTypes[Math.floor(Math.random() * shrineTypes.length)];

    // 신단 배치
    room.entities.push({
      type: 'shrine',
      shrineType: shrineType,
      x: room.centerX,
      y: room.centerY,
      used: false,
      buffStrength: dungeon.difficulty * 2 + 10, // 버프 강도 (10 ~ 30%)
      duration: 300 // 버프 지속시간 (초)
    });
  }

  // 보스방 구성
  populateBossRoom(dungeon, room) {
    const difficulty = dungeon.difficulty;

    // 보스 몬스터 생성
    const boss = this.createBossMonster(dungeon, room, difficulty);
    room.entities.push(boss);

    // 보스 미니언 (하수인) 생성
    const numMinions = Phaser.Math.Between(2, 4);
    for (let i = 0; i < numMinions; i++) {
      const minion = this.createMonster(dungeon, room, difficulty - 1);
      minion.isBossMinion = true;
      room.entities.push(minion);
    }

    // 보스 보상
    room.reward = {
      gold: 100 * difficulty,
      experience: 50 * difficulty,
      items: [
        this.createItem(dungeon, difficulty + 2), // 고급 아이템
        this.createItem(dungeon, difficulty) // 일반 아이템
      ]
    };

    // 매우 낮은 확률로 레거시 아이템 드롭
    if (Math.random() < 0.01) { // 1% 확률
      const legacyItems = [
        'soul_guardian_stone', 'golden_key', 'ancient_compass', 'philosopher_stone',
        'kings_crown', 'dragon_heart', 'time_hourglass', 'dimensional_pocket',
        'alchemist_pendant', 'book_of_secrets'
      ];

      room.reward.legacyItem = legacyItems[Math.floor(Math.random() * legacyItems.length)];
    }
  }

  // 함정 및 환경적 위험 추가
  addTrapsAndHazards(dungeon, room) {
    // 상인방, 입구에는 함정 없음
    if (room.type === 'merchant' || room.type === 'entrance') return;

    // 방 크기에 비례한 함정 수
    const area = room.width * room.height;
    const maxTraps = Math.min(5, Math.floor(area / 50));

    // 함정을 추가할 확률 (던전 타입에 따라 다름)
    let trapChance = 0.3;
    if (dungeon.type === 'ruins' || dungeon.type === 'mine') trapChance = 0.5;

    if (Math.random() < trapChance) {
      const numTraps = Phaser.Math.Between(1, maxTraps);

      for (let i = 0; i < numTraps; i++) {
        const trapTypes = ['spike', 'poison', 'arrow', 'fire', 'frost'];
        const trapType = trapTypes[Math.floor(Math.random() * trapTypes.length)];

        // 함정 위치 결정 (문과 방 중앙을 피함)
        let x, y;
        let validPosition = false;
        let attempts = 0;

        while (!validPosition && attempts < 10) {
          x = Phaser.Math.Between(room.x + 2, room.x + room.width - 2);
          y = Phaser.Math.Between(room.y + 2, room.y + room.height - 2);

          // 방 중앙에서 떨어진 위치인지 확인
          const distFromCenter = Math.sqrt(
            Math.pow(x - room.centerX, 2) + Math.pow(y - room.centerY, 2)
          );

          // 문에서 떨어진 위치인지 확인
          let farFromDoors = true;
          for (const door of room.doors) {
            const distFromDoor = Math.sqrt(
              Math.pow(x - door.x, 2) + Math.pow(y - door.y, 2)
            );
            if (distFromDoor < 3) {
              farFromDoors = false;
              break;
            }
          }

          validPosition = distFromCenter > 3 && farFromDoors;
          attempts++;
        }

        if (validPosition) {
          room.entities.push({
            type: 'trap',
            trapType: trapType,
            x: x,
            y: y,
            damage: 5 + (dungeon.difficulty * 2),
            triggered: false,
            visible: Math.random() > 0.5 // 50% 확률로 숨겨진 함정
          });
        }
      }
    }

    // 환경적 위험 (던전 타입에 따라)
    switch (dungeon.type) {
      case 'cave':
        // 낙석 위험
        if (Math.random() < 0.3) {
          room.hazards = [{
            type: 'falling_rocks',
            interval: Phaser.Math.Between(5, 10), // 초당 발생 빈도
            damage: 8 + dungeon.difficulty
          }];
        }
        break;
      case 'forest':
        // 독성 식물
        if (Math.random() < 0.3) {
          room.hazards = [{
            type: 'poisonous_plants',
            damage: 3 + dungeon.difficulty,
            slowEffect: 0.3 // 30% 감속
          }];
        }
        break;
      case 'tower':
        // 마법 장치
        if (Math.random() < 0.3) {
          room.hazards = [{
            type: 'magic_device',
            effectType: ['fire', 'ice', 'lightning'][Math.floor(Math.random() * 3)],
            interval: Phaser.Math.Between(6, 12),
            damage: 10 + dungeon.difficulty
          }];
        }
        break;
    }
  }

  // 상인 인벤토리 생성
  generateMerchantInventory(difficulty) {
    const inventory = [];

    // 아이템 수 결정
    const numItems = Phaser.Math.Between(4, 8);

    for (let i = 0; i < numItems; i++) {
      const item = this.createItem(dungeon, difficulty);

      // 아이템 가격 계산
      const rarityPriceMultiplier = {
        common: 1,
        uncommon: 2,
        rare: 5,
        epic: 15,
        legendary: 50,
        mythic: 200
      };

      const basePrice = 10 + (difficulty * 5);
      item.price = Math.floor(basePrice * rarityPriceMultiplier[item.rarity] * (0.8 + Math.random() * 0.4));

      inventory.push(item);
    }

    // 항상 포션도 판매
    const potionTypes = ['health', 'mana', 'strength', 'defense', 'speed'];
    const numPotions = Phaser.Math.Between(2, 4);

    for (let i = 0; i < numPotions; i++) {
      const potionType = potionTypes[Math.floor(Math.random() * potionTypes.length)];
      const potionQuality = Math.random() < 0.3 ? 'greater' : 'normal';

      inventory.push({
        id: `${potionQuality}_${potionType}_potion`,
        type: 'consumable',
        subType: 'potion',
        potionType: potionType,
        quality: potionQuality,
        rarity: potionQuality === 'greater' ? 'uncommon' : 'common',
        price: potionQuality === 'greater' ? 30 + (difficulty * 2) : 15 + difficulty
      });
    }

    return inventory;
  }

  // 아이템 희귀도 결정
  determineItemRarity(difficulty, isTreasure = false) {
    // 기본 희귀도 확률 (백분율)
    let rarityChances = {
      common: 55,
      uncommon: 30,
      rare: 10,
      epic: 4,
      legendary: 1,
      mythic: 0
    };

    // 보물방은 더 좋은 아이템
    if (isTreasure) {
      rarityChances = {
        common: 20,
        uncommon: 40,
        rare: 25,
        epic: 10,
        legendary: 4,
        mythic: 1
      };
    }

    // 난이도에 따른 조정
    rarityChances.common = Math.max(10, rarityChances.common - (difficulty * 2));
    rarityChances.uncommon = rarityChances.uncommon + difficulty;
    rarityChances.rare = rarityChances.rare + difficulty;
    rarityChances.epic = rarityChances.epic + Math.floor(difficulty / 2);
    rarityChances.legendary = rarityChances.legendary + Math.floor(difficulty / 5);
    rarityChances.mythic = Math.min(5, rarityChances.mythic + Math.floor(difficulty / 10));

    // 난이도 10 이상부터 신화 등급 가능
    if (difficulty < 10) rarityChances.mythic = 0;

    // 확률에 따라 희귀도 결정
    const roll = Math.random() * 100;
    let cumulativeChance = 0;

    for (const [rarity, chance] of Object.entries(rarityChances)) {
      cumulativeChance += chance;
      if (roll < cumulativeChance) return rarity;
    }

    return 'common'; // 기본값
  }

  // 아이템 생성
  createItem(dungeon, difficulty) {
    const rarity = this.determineItemRarity(difficulty);
    const itemTypes = ['weapon', 'armor', 'accessory', 'consumable'];
    const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];

    // 아이템 기본 정보
    const item = {
      type: itemType,
      rarity: rarity
    };

    // 아이템 타입에 따른 추가 속성
    switch (itemType) {
      case 'weapon':
        this.createWeapon(item, dungeon, difficulty);
        break;
      case 'armor':
        this.createArmor(item, dungeon, difficulty);
        break;
      case 'accessory':
        this.createAccessory(item, dungeon, difficulty);
        break;
      case 'consumable':
        this.createConsumable(item, dungeon, difficulty);
        break;
    }

    return item;
  }

  // 무기 아이템 생성
  createWeapon(item, dungeon, difficulty) {
    const weaponTypes = ['sword', 'axe', 'mace', 'spear', 'bow', 'staff', 'dagger', 'wand', 'hammer', 'fist'];
    const weaponType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

    // 던전 타입에 따라 특정 무기 등장 확률 조정
    // 예: 숲에서는 활이나 창이 더 많이 나오게

    item.subType = weaponType;

    // 무기 ID 생성
    const rarityPrefix = {
      common: 'basic',
      uncommon: 'fine',
      rare: 'superior',
      epic: 'exceptional',
      legendary: 'mythical',
      mythic: 'divine'
    };

    item.id = `${rarityPrefix[item.rarity]}_${weaponType}`;

    // 무기 이름 생성
    const weaponNames = {
      sword: ['검', '장검', '대검', '칼날'],
      axe: ['도끼', '전투도끼', '양날도끼'],
      mace: ['철퇴', '둔기', '전투망치'],
      spear: ['창', '장창', '투창'],
      bow: ['활', '장궁', '복합궁'],
      staff: ['지팡이', '마법봉', '주술봉'],
      dagger: ['단검', '비수', '보검'],
      wand: ['완드', '마술지팡이', '주문봉'],
      hammer: ['망치', '워해머', '파괴망치'],
      fist: ['건틀릿', '너클', '격투장갑']
    };

    const nameAdjectives = [
      '강력한', '예리한', '날카로운', '견고한', '신비한', '마법의', '고대의',
      '붉은', '푸른', '녹색', '황금', '은빛', '어둠의', '빛나는', '불꽃의',
      '얼어붙은', '천둥의', '영혼의', '악마의', '천상의', '저주받은', '축복받은'
    ];

    if (item.rarity === 'common') {
      item.name = `기본 ${weaponNames[weaponType][0]}`;
    } else {
      const adjective = nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
      const weaponName = weaponNames[weaponType][Math.floor(Math.random() * weaponNames[weaponType].length)];
      item.name = `${adjective} ${weaponName}`;
    }

    // 무기 스탯
    const baseAttack = 5 + (difficulty * 2);
    const rarityMultiplier = {
      common: 1,
      uncommon: 1.3,
      rare: 1.8,
      epic: 2.5,
      legendary: 3.5,
      mythic: 5
    };

    item.attack = Math.floor(baseAttack * rarityMultiplier[item.rarity] * (0.9 + Math.random() * 0.2));

    // 속성 추가
    const attributeCount = {
      common: 0,
      uncommon: Phaser.Math.Between(1, 2),
      rare: Phaser.Math.Between(2, 3),
      epic: Phaser.Math.Between(3, 4),
      legendary: Phaser.Math.Between(4, 5),
      mythic: Phaser.Math.Between(5, 6)
    };

    if (attributeCount[item.rarity] > 0) {
      item.attributes = this.generateAttributes(attributeCount[item.rarity], 'weapon', difficulty);
    }

    // 레어 이상은 특수 효과 추가
    if (['rare', 'epic', 'legendary', 'mythic'].includes(item.rarity)) {
      item.specialEffect = this.generateSpecialEffect('weapon', weaponType, item.rarity);
    }

    // 무기 레벨 요구치
    if (item.rarity !== 'common') {
      item.requiredLevel = Math.max(1, Math.floor(difficulty / 2));
    }
  }

  // 방어구 아이템 생성
  createArmor(item, dungeon, difficulty) {
    const armorTypes = ['helmet', 'chest', 'gloves', 'boots', 'shield'];
    const armorType = armorTypes[Math.floor(Math.random() * armorTypes.length)];

    item.subType = armorType;

    // 방어구 ID 생성
    const rarityPrefix = {
      common: 'basic',
      uncommon: 'reinforced',
      rare: 'superior',
      epic: 'exceptional',
      legendary: 'mythical',
      mythic: 'divine'
    };

    item.id = `${rarityPrefix[item.rarity]}_${armorType}`;

    // 방어구 이름 생성
    const armorNames = {
      helmet: ['투구', '헬멧', '머리보호구'],
      chest: ['갑옷', '흉갑', '로브'],
      gloves: ['장갑', '건틀릿', '암가드'],
      boots: ['부츠', '그리브', '신발'],
      shield: ['방패', '버클러', '타지']
    };

    const nameAdjectives = [
      '견고한', '단단한', '강화된', '무거운', '가벼운', '영혼의', '마법의',
      '고대의', '전설의', '용맹한', '보호의', '불굴의', '수호자의', '기사의',
      '전사의', '불꽃의', '얼음의', '천둥의', '땅의', '물의', '바람의'
    ];

    if (item.rarity === 'common') {
      item.name = `기본 ${armorNames[armorType][0]}`;
    } else {
      const adjective = nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
      const armorName = armorNames[armorType][Math.floor(Math.random() * armorNames[armorType].length)];
      item.name = `${adjective} ${armorName}`;
    }

    // 방어구 스탯
    const baseDefense = 3 + difficulty;
    const rarityMultiplier = {
      common: 1,
      uncommon: 1.3,
      rare: 1.8,
      epic: 2.5,
      legendary: 3.5,
      mythic: 5
    };

    item.defense = Math.floor(baseDefense * rarityMultiplier[item.rarity] * (0.9 + Math.random() * 0.2));

    // 속성 추가
    const attributeCount = {
      common: 0,
      uncommon: Phaser.Math.Between(1, 2),
      rare: Phaser.Math.Between(2, 3),
      epic: Phaser.Math.Between(3, 4),
      legendary: Phaser.Math.Between(4, 5),
      mythic: Phaser.Math.Between(5, 6)
    };

    if (attributeCount[item.rarity] > 0) {
      item.attributes = this.generateAttributes(attributeCount[item.rarity], 'armor', difficulty);
    }

    // 레어 이상은 특수 효과 추가
    if (['rare', 'epic', 'legendary', 'mythic'].includes(item.rarity)) {
      item.specialEffect = this.generateSpecialEffect('armor', armorType, item.rarity);
    }

    // 방어구 레벨 요구치
    if (item.rarity !== 'common') {
      item.requiredLevel = Math.max(1, Math.floor(difficulty / 2));
    }
  }

  // 악세서리 아이템 생성
  createAccessory(item, dungeon, difficulty) {
    const accessoryTypes = ['ring', 'amulet', 'bracelet', 'belt', 'cloak'];
    const accessoryType = accessoryTypes[Math.floor(Math.random() * accessoryTypes.length)];

    item.subType = accessoryType;

    // 악세서리 ID 생성
    const rarityPrefix = {
      common: 'simple',
      uncommon: 'ornate',
      rare: 'superior',
      epic: 'exceptional',
      legendary: 'mythical',
      mythic: 'divine'
    };

    item.id = `${rarityPrefix[item.rarity]}_${accessoryType}`;

    // 악세서리 이름 생성
    const accessoryNames = {
      ring: ['반지', '링', '가락지'],
      amulet: ['목걸이', '아뮬렛', '펜던트'],
      bracelet: ['팔찌', '브레이슬릿', '손목띠'],
      belt: ['벨트', '허리띠', '장식띠'],
      cloak: ['망토', '클록', '로브']
    };

    const nameAdjectives = [
      '신비한', '마법의', '강력한', '수호자의', '현자의', '왕의', '여왕의',
      '드래곤의', '악마의', '천사의', '고대의', '신성한', '저주받은', '축복받은',
      '영혼의', '정령의', '대지의', '하늘의', '불꽃의', '얼음의', '그림자의'
    ];

    if (item.rarity === 'common') {
      item.name = `평범한 ${accessoryNames[accessoryType][0]}`;
    } else {
      const adjective = nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
      const accessoryName = accessoryNames[accessoryType][Math.floor(Math.random() * accessoryNames[accessoryType].length)];
      item.name = `${adjective} ${accessoryName}`;
    }

    // 악세서리는 속성만 부여 (방어력/공격력 없음)
    const attributeCount = {
      common: 1,
      uncommon: Phaser.Math.Between(2, 3),
      rare: Phaser.Math.Between(3, 4),
      epic: Phaser.Math.Between(4, 5),
      legendary: Phaser.Math.Between(5, 6),
      mythic: Phaser.Math.Between(6, 7)
    };

    item.attributes = this.generateAttributes(attributeCount[item.rarity], 'accessory', difficulty);

    // 레어 이상은 특수 효과 추가
    if (['rare', 'epic', 'legendary', 'mythic'].includes(item.rarity)) {
      item.specialEffect = this.generateSpecialEffect('accessory', accessoryType, item.rarity);
    }

    // 악세서리 레벨 요구치
    if (item.rarity !== 'common') {
      item.requiredLevel = Math.max(1, Math.floor(difficulty / 2));
    }
  }

  // 소비 아이템 생성
  createConsumable(item, dungeon, difficulty) {
    const consumableTypes = ['potion', 'scroll', 'food', 'bomb'];
    const consumableType = consumableTypes[Math.floor(Math.random() * consumableTypes.length)];

    item.subType = consumableType;

    // 소비 아이템 타입별 처리
    switch (consumableType) {
      case 'potion':
        this.createPotion(item, difficulty);
        break;
      case 'scroll':
        this.createScroll(item, difficulty);
        break;
      case 'food':
        this.createFood(item, difficulty);
        break;
      case 'bomb':
        this.createBomb(item, difficulty);
        break;
    }

    // 소비 아이템은 개수 설정
    item.count = Phaser.Math.Between(1, 3);
  }

  // 포션 아이템 생성
  createPotion(item, difficulty) {
    const potionTypes = ['health', 'mana', 'strength', 'defense', 'speed', 'agility'];
    const potionType = potionTypes[Math.floor(Math.random() * potionTypes.length)];

    item.potionType = potionType;

    // 포션 품질 결정
    const qualities = ['minor', 'normal', 'greater', 'superior'];
    let qualityIndex = 0;

    if (difficulty >= 5) qualityIndex = 1;
    if (difficulty >= 10) qualityIndex = 2;
    if (difficulty >= 15) qualityIndex = 3;

    // 더 좋은 포션이 나올 확률
    if (Math.random() < 0.3 && qualityIndex < 3) qualityIndex++;

    const quality = qualities[qualityIndex];
    item.quality = quality;

    // 아이템 ID 및 이름 생성
    item.id = `${quality}_${potionType}_potion`;

    const potionNames = {
      health: '체력 포션',
      mana: '마나 포션',
      strength: '힘의 포션',
      defense: '방어의 포션',
      speed: '속도의 포션',
      agility: '민첩의 포션'
    };

    const qualityNames = {
      minor: '약한',
      normal: '보통의',
      greater: '강력한',
      superior: '최상급'
    };

    item.name = `${qualityNames[quality]} ${potionNames[potionType]}`;

    // 포션 효과 강도 계산
    const baseValue = 10 + (difficulty * 2);
    const qualityMultiplier = {
      minor: 0.5,
      normal: 1,
      greater: 1.5,
      superior: 2.5
    };

    item.effectValue = Math.floor(baseValue * qualityMultiplier[quality]);

    // 희귀도 조정
    item.rarity = {
      minor: 'common',
      normal: 'common',
      greater: 'uncommon',
      superior: 'rare'
    }[quality];
  }

  // 스크롤 아이템 생성
  createScroll(item, difficulty) {
    const scrollTypes = ['teleport', 'identify', 'enchant', 'fireball', 'frost', 'lightning', 'healing', 'protection'];
    const scrollType = scrollTypes[Math.floor(Math.random() * scrollTypes.length)];

    item.scrollType = scrollType;

    // 아이템 ID 및 이름 생성
    item.id = `${scrollType}_scroll`;

    const scrollNames = {
      teleport: '순간이동',
      identify: '감정',
      enchant: '마법부여',
      fireball: '화염구',
      frost: '냉기',
      lightning: '번개',
      healing: '치유',
      protection: '보호'
    };

    item.name = `${scrollNames[scrollType]} 스크롤`;

    // 스크롤 효과 강도 계산
    const baseValue = 15 + (difficulty * 3);
    item.effectValue = Math.floor(baseValue * (0.9 + Math.random() * 0.2));

    // 희귀도 결정
    if (['teleport', 'identify'].includes(scrollType)) {
      item.rarity = 'uncommon';
    } else if (['enchant', 'protection'].includes(scrollType)) {
      item.rarity = 'rare';
    } else {
      item.rarity = 'common';
    }
  }

  // 음식 아이템 생성
  createFood(item, difficulty) {
    const foodTypes = ['bread', 'meat', 'fruit', 'fish', 'stew'];
    const foodType = foodTypes[Math.floor(Math.random() * foodTypes.length)];

    item.foodType = foodType;

    // 아이템 ID 및 이름 생성
    item.id = `${foodType}_food`;

    const foodNames = {
      bread: '빵',
      meat: '육류',
      fruit: '과일',
      fish: '생선',
      stew: '스튜'
    };

    const qualityAdjectives = [
      '신선한', '맛있는', '영양가 있는', '특제', '고급'
    ];

    const adjective = Math.random() < 0.5 ? qualityAdjectives[Math.floor(Math.random() * qualityAdjectives.length)] + ' ' : '';
    item.name = `${adjective}${foodNames[foodType]}`;

    // 음식 효과 - HP 회복과 임시 버프
    item.healValue = 5 + (difficulty * 1.5);

    // 고급 음식은 버프 효과 추가
    if (Math.random() < 0.3) {
      const buffTypes = ['strength', 'defense', 'speed', 'health_regen'];
      const buffType = buffTypes[Math.floor(Math.random() * buffTypes.length)];

      item.buffType = buffType;
      item.buffValue = 5 + Math.floor(difficulty / 2);
      item.buffDuration = 60; // 60초 지속

      // 버프가 있으면 희귀도 상승
      item.rarity = 'uncommon';
    } else {
      item.rarity = 'common';
    }
  }

  // 폭탄 아이템 생성
  createBomb(item, difficulty) {
    const bombTypes = ['fire', 'ice', 'poison', 'shock', 'light'];
    const bombType = bombTypes[Math.floor(Math.random() * bombTypes.length)];

    item.bombType = bombType;

    // 아이템 ID 및 이름 생성
    item.id = `${bombType}_bomb`;

    const bombNames = {
      fire: '화염',
      ice: '냉기',
      poison: '독',
      shock: '충격',
      light: '섬광'
    };

    item.name = `${bombNames[bombType]} 폭탄`;

    // 폭탄 효과
    item.damage = 15 + (difficulty * 3);
    item.radius = 3; // 3타일 반경

    // 추가 효과
    switch (bombType) {
      case 'fire':
        item.burnDuration = 3; // 3초간 화상
        break;
      case 'ice':
        item.freezeDuration = 2; // 2초간 빙결
        break;
      case 'poison':
        item.poisonDuration = 5; // 5초간 중독
        break;
      case 'shock':
        item.stunDuration = 1; // 1초간 기절
        break;
      case 'light':
        item.blindDuration = 3; // 3초간 실명
        break;
    }

    // 폭탄은 기본적으로 희귀
    item.rarity = 'uncommon';
    if (difficulty >= 10) item.rarity = 'rare';
  }

  // 아이템 속성 생성
  generateAttributes(count, itemType, difficulty) {
    const attributes = [];
    const possibleAttributes = this.getPossibleAttributes(itemType);

    // 속성 랜덤 선택
    const selectedAttributes = this.getRandomUniqueElements(possibleAttributes, count);

    selectedAttributes.forEach(attrType => {
      // 속성 수치 계산
      const baseValue = this.getBaseAttributeValue(attrType, difficulty);
      const value = Math.floor(baseValue * (0.8 + Math.random() * 0.4));

      attributes.push({
        type: attrType,
        value: value
      });
    });

    return attributes;
  }

  // 아이템 타입별 가능한 속성 목록
  getPossibleAttributes(itemType) {
    // 공통 속성
    const commonAttributes = ['hp_bonus', 'mp_bonus', 'hp_regen', 'mp_regen'];

    // 아이템 타입별 추가 속성
    const typeSpecificAttributes = {
      weapon: ['attack_bonus', 'critical_chance', 'critical_damage', 'attack_speed', 'elemental_damage'],
      armor: ['defense_bonus', 'damage_reduction', 'elemental_resistance', 'status_resistance', 'max_hp_percent'],
      accessory: ['gold_find', 'item_find', 'experience_bonus', 'skill_cooldown', 'dodge_chance', 'movement_speed']
    };

    return [...commonAttributes, ...typeSpecificAttributes[itemType]];
  }

  // 속성 기본값 계산
  getBaseAttributeValue(attributeType, difficulty) {
    const baseValues = {
      hp_bonus: 10 + (difficulty * 2),
      mp_bonus: 8 + (difficulty * 1.5),
      hp_regen: 1 + (difficulty * 0.3),
      mp_regen: 1 + (difficulty * 0.2),
      attack_bonus: 3 + difficulty,
      critical_chance: 3 + Math.floor(difficulty * 0.5),
      critical_damage: 10 + (difficulty * 2),
      attack_speed: 5 + Math.floor(difficulty * 0.7),
      elemental_damage: 5 + difficulty,
      defense_bonus: 2 + (difficulty * 0.8),
      damage_reduction: 2 + Math.floor(difficulty * 0.3),
      elemental_resistance: 5 + (difficulty * 0.7),
      status_resistance: 5 + (difficulty * 0.7),
      max_hp_percent: 3 + Math.floor(difficulty * 0.5),
      gold_find: 5 + (difficulty * 1),
      item_find: 5 + (difficulty * 0.8),
      experience_bonus: 5 + (difficulty * 0.8),
      skill_cooldown: 3 + Math.floor(difficulty * 0.4),
      dodge_chance: 2 + Math.floor(difficulty * 0.3),
      movement_speed: 3 + Math.floor(difficulty * 0.4)
    };

    return baseValues[attributeType] || 5;
  }

  // 특수 효과 생성
  generateSpecialEffect(itemType, subType, rarity) {
    const effects = [];

    // 아이템 타입별 가능한 특수 효과
    const possibleEffects = {
      weapon: {
        sword: ['bleeding', 'stun', 'knockback'],
        axe: ['critical_cleave', 'armor_break', 'execute_damage'],
        mace: ['stun', 'knockback', 'defense_break'],
        spear: ['pierce', 'bleed', 'reach_attack'],
        bow: ['multishot', 'pierce', 'mark_target'],
        staff: ['elemental_burst', 'mana_leech', 'spell_amplify'],
        dagger: ['backstab_bonus', 'poison', 'quick_strike'],
        wand: ['spell_critical', 'element_convert', 'mana_restore'],
        hammer: ['stun', 'armor_break', 'earthquake'],
        fist: ['combo_attack', 'counter', 'dodge_bonus']
      },
      armor: {
        helmet: ['magic_resist', 'perception', 'concentration'],
        chest: ['damage_reflect', 'thorns', 'last_stand'],
        gloves: ['attack_speed', 'critical_bonus', 'spell_haste'],
        boots: ['movement_speed', 'dodge_chance', 'falling_damage_immune'],
        shield: ['block_chance', 'counter_attack', 'projectile_reflect']
      },
      accessory: {
        ring: ['skill_enhance', 'element_affinity', 'resource_restore'],
        amulet: ['life_leech', 'damage_convert', 'status_immune'],
        bracelet: ['cooldown_reduction', 'attack_speed', 'spell_haste'],
        belt: ['potion_enhance', 'gold_find', 'inventory_space'],
        cloak: ['stealth', 'evasion', 'trap_detection']
      }
    };

    // 아이템 등급에 따른 효과 개수
    const effectCount = {
      rare: 1,
      epic: 1,
      legendary: 2,
      mythic: 2
    };

    // 사용 가능한 효과 목록 가져오기
    const availableEffects = possibleEffects[itemType][subType] || [];

    // 효과 선택
    const count = effectCount[rarity] || 1;
    const selectedEffects = this.getRandomUniqueElements(availableEffects, count);

    // 효과 세부 정보 생성
    selectedEffects.forEach(effectType => {
      const effectStrength = this.getSpecialEffectStrength(effectType, rarity);

      effects.push({
        type: effectType,
        value: effectStrength
      });
    });

    return effects;
  }

  // 특수 효과 강도 계산
  getSpecialEffectStrength(effectType, rarity) {
    const baseValues = {
      bleeding: 5,
      stun: 1,
      knockback: 3,
      critical_cleave: 30,
      armor_break: 20,
      execute_damage: 15,
      pierce: 20,
      multishot: 2,
      elemental_burst: 25,
      mana_leech: 10,
      spell_amplify: 15,
      backstab_bonus: 50,
      poison: 10,
      quick_strike: 15,
      spell_critical: 20,
      element_convert: 100,
      mana_restore: 5,
      combo_attack: 10,
      counter: 20,
      dodge_bonus: 10,
      magic_resist: 15,
      perception: 20,
      concentration: 15,
      damage_reflect: 15,
      thorns: 5,
      last_stand: 30,
      attack_speed: 10,
      critical_bonus: 20,
      spell_haste: 10,
      movement_speed: 15,
      dodge_chance: 8,
      falling_damage_immune: 100,
      block_chance: 15,
      counter_attack: 20,
      projectile_reflect: 30,
      skill_enhance: 15,
      element_affinity: 25,
      resource_restore: 5,
      life_leech: 10,
      damage_convert: 20,
      status_immune: 1,
      cooldown_reduction: 10,
      potion_enhance: 20,
      gold_find: 15,
      inventory_space: 5,
      stealth: 1,
      evasion: 15,
      trap_detection: 100
    };

    // 레어리티 계수
    const rarityMultiplier = {
      rare: 1,
      epic: 1.5,
      legendary: 2.2,
      mythic: 3
    };

    // 기본값 * 레어리티 계수
    return Math.floor(baseValues[effectType] * rarityMultiplier[rarity]);
  }

  // 몬스터 생성
  createMonster(dungeon, room, difficulty, isElite = false) {
    // 던전 타입에 따른 몬스터 선택
    const monsterTypes = this.getMonsterTypesForDungeon(dungeon.type);
    const monsterType = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];

    // 엘리트 몬스터 확률 (기본 5%)
    if (!isElite) {
      isElite = Math.random() < 0.05;
    }

    // 몬스터 기본 스탯
    const baseHP = isElite ? 30 + (difficulty * 5) : 15 + (difficulty * 3);
    const baseAttack = isElite ? 8 + (difficulty * 1.5) : 5 + difficulty;
    const baseDefense = isElite ? 5 + difficulty : 3 + (difficulty * 0.5);

    // 몬스터 위치
    const x = Phaser.Math.Between(room.x + 2, room.x + room.width - 2);
    const y = Phaser.Math.Between(room.y + 2, room.y + room.height - 2);

    // 몬스터 객체 생성
    const monster = {
      type: 'monster',
      monsterType: monsterType,
      isElite: isElite,
      level: difficulty,
      x: x,
      y: y,
      hp: baseHP,
      maxHp: baseHP,
      attack: baseAttack,
      defense: baseDefense,
      speed: isElite ? 100 + (difficulty * 5) : 80 + (difficulty * 3),
      element: this.getMonsterElement(monsterType, dungeon.type),
      attackType: this.getMonsterAttackType(monsterType),
      specialAbilities: isElite ? this.getEliteMonsterAbilities(monsterType, difficulty) : [],
      loot: {
        gold: isElite ? 10 + (difficulty * 3) : 5 + difficulty,
        experience: isElite ? 15 + (difficulty * 3) : 10 + difficulty,
        dropChance: isElite ? 0.7 : 0.3 // 아이템 드롭 확률
      }
    };

    return monster;
  }

  // 던전 타입에 따른 몬스터 목록
  getMonsterTypesForDungeon(dungeonType) {
    const monstersByDungeon = {
      forest: ['goblin', 'wolf', 'spider', 'treant', 'fairy', 'centaur'],
      cave: ['bat', 'slime', 'spider', 'troll', 'golem', 'drake'],
      ruins: ['skeleton', 'ghost', 'zombie', 'mummy', 'wraith', 'gargoyle'],
      tower: ['imp', 'construct', 'elemental', 'cultist', 'harpy', 'minotaur'],
      castle: ['guard', 'knight', 'archer', 'mage', 'assassin', 'demon'],
      library: ['living_book', 'ink_elemental', 'paper_golem', 'knowledge_eater', 'archivist'],
      mine: ['kobold', 'miner_zombie', 'crystal_elemental', 'rockworm', 'earth_guardian'],
      city: ['thief', 'cultist', 'guard', 'merchant_ghost', 'sewer_beast']
    };

    return monstersByDungeon[dungeonType] || ['goblin', 'slime', 'skeleton', 'bat', 'rat'];
  }

  // 몬스터 속성 결정
  getMonsterElement(monsterType, dungeonType) {
    // 특정 타입의 몬스터는 고정 속성
    const fixedElements = {
      'fire_elemental': 'fire',
      'ice_drake': 'ice',
      'lightning_construct': 'lightning',
      'ghost': 'light',
      'wraith': 'dark',
      'water_nymph': 'water',
      'earth_golem': 'earth'
    };

    if (fixedElements[monsterType]) return fixedElements[monsterType];

    // 던전 타입에 따른 속성 확률 조정
    const elementProbabilities = {
      forest: { neutral: 0.6, earth: 0.2, water: 0.1, light: 0.1 },
      cave: { neutral: 0.5, earth: 0.3, dark: 0.2 },
      ruins: { neutral: 0.4, dark: 0.4, fire: 0.1, ice: 0.1 },
      tower: { neutral: 0.3, fire: 0.2, lightning: 0.2, dark: 0.1, light: 0.2 },
      castle: { neutral: 0.5, fire: 0.2, ice: 0.1, light: 0.2 }
    };

    const probabilities = elementProbabilities[dungeonType] || { neutral: 0.7, fire: 0.1, ice: 0.1, lightning: 0.1 };

    // 확률에 따른 속성 결정
    const roll = Math.random();
    let cumulativeProbability = 0;

    for (const [element, probability] of Object.entries(probabilities)) {
      cumulativeProbability += probability;
      if (roll < cumulativeProbability) return element;
    }

    return 'neutral'; // 기본값
  }

  // 몬스터 공격 타입 결정
  getMonsterAttackType(monsterType) {
    // 특정 몬스터 타입의 고정 공격 타입
    const attackTypes = {
      goblin: 'melee',
      wolf: 'melee',
      spider: 'melee',
      bat: 'melee',
      slime: 'melee',
      treant: 'melee',
      troll: 'melee',
      golem: 'melee',
      skeleton: 'melee',
      zombie: 'melee',
      guard: 'melee',
      knight: 'melee',
      minotaur: 'melee',

      fairy: 'ranged',
      imp: 'ranged',
      harpy: 'ranged',
      archer: 'ranged',
      centaur: 'ranged',

      ghost: 'magic',
      wraith: 'magic',
      mage: 'magic',
      cultist: 'magic',
      elemental: 'magic',
      construct: 'magic',
      drake: 'magic'
    };

    return attackTypes[monsterType] || ['melee', 'ranged', 'magic'][Math.floor(Math.random() * 3)];
  }

  // 엘리트 몬스터 특수 능력
  getEliteMonsterAbilities(monsterType, difficulty) {
    const abilities = [];

    // 공격 타입에 따른 가능한 특수 능력
    const possibleAbilities = {
      melee: ['knockback', 'stun', 'bleed', 'multi_attack', 'charge'],
      ranged: ['poison', 'snare', 'multi_shot', 'piercing_shot', 'mark_target'],
      magic: ['fireball', 'frost_nova', 'lightning_chain', 'teleport', 'summon_minion', 'life_drain']
    };

    // 몬스터 공격 타입
    const attackType = this.getMonsterAttackType(monsterType);

    // 1~2개의 특수 능력 선택
    const abilityCount = difficulty >= 10 ? 2 : 1;
    const availableAbilities = possibleAbilities[attackType] || possibleAbilities.melee;

    for (let i = 0; i < abilityCount; i++) {
      const index = Math.floor(Math.random() * availableAbilities.length);
      const ability = availableAbilities[index];

      // 같은 능력 중복 방지
      if (!abilities.some(a => a.type === ability)) {
        abilities.push({
          type: ability,
          cooldown: Phaser.Math.Between(5, 10), // 5~10초 쿨다운
          damage: Math.floor(5 + (difficulty * 1.5)),
          chance: 0.3 // 30% 발동 확률
        });
      }

      // 배열에서 선택한 능력 제거
      availableAbilities.splice(index, 1);

      // 더 이상 선택할 능력이 없으면 종료
      if (availableAbilities.length === 0) break;
    }

    return abilities;
  }

  // 보스 몬스터 생성
  createBossMonster(dungeon, room, difficulty) {
    // 던전 타입에 따른 보스 결정
    const bosses = {
      forest: {
        name: '고대 나무정령',
        type: 'ancient_treant',
        element: 'earth',
        attackType: 'magic',
        abilities: ['root_trap', 'nature_fury', 'healing_sap', 'thorn_armor']
      },
      cave: {
        name: '동굴의 지배자',
        type: 'cave_troll',
        element: 'earth',
        attackType: 'melee',
        abilities: ['boulder_throw', 'ground_slam', 'regeneration', 'enrage']
      },
      ruins: {
        name: '망령 군주',
        type: 'lich_lord',
        element: 'dark',
        attackType: 'magic',
        abilities: ['death_bolt', 'summon_undead', 'life_drain', 'curse']
      },
      tower: {
        name: '대마법사',
        type: 'archmage',
        element: 'lightning',
        attackType: 'magic',
        abilities: ['arcane_barrage', 'mirror_image', 'teleport', 'time_warp']
      },
      castle: {
        name: '암흑 기사',
        type: 'dark_knight',
        element: 'dark',
        attackType: 'melee',
        abilities: ['soul_strike', 'shadow_step', 'fear_aura', 'life_leech']
      },
      library: {
        name: '지식의 수호자',
        type: 'knowledge_guardian',
        element: 'light',
        attackType: 'magic',
        abilities: ['word_of_power', 'book_storm', 'forbidden_knowledge', 'reality_warp']
      },
      mine: {
        name: '크리스탈 골렘',
        type: 'crystal_golem',
        element: 'earth',
        attackType: 'melee',
        abilities: ['crystal_spray', 'reflective_shield', 'crystal_growth', 'earth_tremor']
      },
      city: {
        name: '암살자 길드마스터',
        type: 'assassin_master',
        element: 'neutral',
        attackType: 'melee',
        abilities: ['shadow_strike', 'vanish', 'poison_daggers', 'smoke_bomb']
      }
    };

    // 던전 타입에 맞는 보스 또는 기본 보스
    const bossTemplate = bosses[dungeon.type] || {
      name: '혼돈의 수호자',
      type: 'chaos_guardian',
      element: 'neutral',
      attackType: 'melee',
      abilities: ['chaos_strike', 'reality_warp', 'summon_minion', 'enrage']
    };

    // 보스 스탯 계산
    const bossHp = 100 + (difficulty * 20);
    const bossAttack = 15 + (difficulty * 2);
    const bossDefense = 10 + (difficulty * 1.5);

    // 보스 몬스터 객체 생성
    const boss = {
      type: 'boss',
      name: bossTemplate.name,
      monsterType: bossTemplate.type,
      element: bossTemplate.element,
      attackType: bossTemplate.attackType,
      level: difficulty + 3,
      x: room.centerX,
      y: room.centerY,
      hp: bossHp,
      maxHp: bossHp,
      attack: bossAttack,
      defense: bossDefense,
      speed: 120 + (difficulty * 5),
      abilities: this.createBossAbilities(bossTemplate.abilities, difficulty),
      phases: [
        { threshold: 0.7, message: '보스가 분노합니다!', statBoost: 1.2 },
        { threshold: 0.3, message: '보스가 궁극의 힘을 해방합니다!', statBoost: 1.5 }
      ],
      currentPhase: 0,
      loot: {
        gold: 100 + (difficulty * 10),
        experience: 100 + (difficulty * 15),
        dropChance: 1.0 // 보스는 항상 아이템 드롭
      }
    };

    return boss;
  }

  // 보스 능력 생성
  createBossAbilities(abilityTypes, difficulty) {
    return abilityTypes.map(type => {
      // 능력 기본 정보
      const baseInfo = {
        cooldown: Phaser.Math.Between(8, 15),
        damage: 10 + (difficulty * 3),
        duration: 5,
        chance: 0.8
      };

      // 능력별 커스텀 설정
      switch (type) {
        case 'summon_undead':
        case 'summon_minion':
          return {
            type: type,
            cooldown: 20,
            count: 1 + Math.floor(difficulty / 5),
            minionLevel: Math.max(1, difficulty - 2)
          };
        case 'teleport':
        case 'shadow_step':
        case 'vanish':
          return {
            type: type,
            cooldown: 12,
            chance: 0.6
          };
        case 'enrage':
          return {
            type: type,
            cooldown: 30,
            threshold: 0.3, // 30% HP 이하에서 발동
            damageBoost: 1.5,
            speedBoost: 1.3,
            duration: 10
          };
        case 'healing_sap':
        case 'regeneration':
          return {
            type: type,
            cooldown: 25,
            healAmount: 5 + (difficulty * 2),
            duration: 5
          };
        default:
          return {
            type: type,
            ...baseInfo
          };
      }
    });
  }

  // 시작점과 종료점 지정
  assignStartAndEnd(dungeon) {
    // 입구 방 찾기
    const entranceRoom = dungeon.rooms.find(room => room.type === 'entrance');
    if (entranceRoom) {
      dungeon.startRoom = entranceRoom.id;
    } else {
      // 입구 방이 없으면 첫 번째 방을 시작점으로
      dungeon.startRoom = 0;
      dungeon.rooms[0].type = 'entrance';
    }

    // 보스 방 찾기
    const bossRoom = dungeon.rooms.find(room => room.type === 'boss');
    if (bossRoom) {
      dungeon.endRoom = bossRoom.id;
    } else {
      // 보스 방이 없으면 마지막 방을 종료점으로
      dungeon.endRoom = dungeon.rooms.length - 1;
      dungeon.rooms[dungeon.rooms.length - 1].type = 'boss';

      // 보스 배치
      this.populateBossRoom(dungeon, dungeon.rooms[dungeon.endRoom]);
    }
  }

  // 배열에서 중복 없이 랜덤하게 요소 선택
  getRandomUniqueElements(array, count) {
    // 배열 복사
    const arrayCopy = [...array];
    const result = [];

    // 요소 수 제한
    count = Math.min(count, arrayCopy.length);

    for (let i = 0; i < count; i++) {
      // 남은 요소 중 랜덤 선택
      const index = Math.floor(Math.random() * arrayCopy.length);
      result.push(arrayCopy[index]);

      // 선택한 요소 제거
      arrayCopy.splice(index, 1);
    }

    return result;
  }
}

export default DungeonGenerator;// src/systems/DungeonGenerator.js
class DungeonGenerator {
  constructor(scene) {
    this.scene = scene;
    this.dungeonConfig = {
      roomSizeMin: 5,
      roomSizeMax: 15,
      maxRooms: 15,
      minRooms: 8,
      specialRoomChance: 0.3 // 30% 확률로 특수 방 생성
    };
  }

  // 새로운 던전 생성
  generateDungeon(dungeonId, difficulty = 1) {
    // 기본 던전 정보
    const dungeon = {
      id: dungeonId,
      difficulty: difficulty,
      floor: Math.ceil(difficulty / 3), // 3단계마다 새로운 층
      rooms: [],
      doors: [],
      type: this.getDungeonType(dungeonId),
      width: 0,
      height: 0,
      startRoom: null,
      endRoom: null
    };

    // 던전 타입에 따른 설정 조정
    this.adjustConfigForDungeonType(dungeon.type, difficulty);

    // 방 생성
    this.generateRooms(dungeon);

    // 방 연결 (문/복도)
    this.connectRooms(dungeon);

    // 몬스터 및 아이템 배치
    this.populateDungeon(dungeon);

    // 시작 및 종료 지점 지정
    this.assignStartAndEnd(dungeon);

    return dungeon;
  }

  // 던전 타입 가져오기
  getDungeonType(dungeonId) {
    // 던전 ID로부터 타입 결정
    const dungeonTypes = {
      'sword_forest': 'forest',
      'staff_tower': 'tower',
      'temple_ruins': 'ruins',
      'crystal_caves': 'cave',
      'dark_castle': 'castle',
      'forbidden_library': 'library',
      'abandoned_mine': 'mine',
      'ancient_city': 'city'
    };

    return dungeonTypes[dungeonId] || 'generic';
  }

  // 던전 타입에 따라 설정 조정
  adjustConfigForDungeonType(type, difficulty) {
    // 기본 설정 복원
    this.dungeonConfig = {
      roomSizeMin: 5,
      roomSizeMax: 15,
      maxRooms: 15,
      minRooms: 8,
      specialRoomChance: 0.3
    };

    // 던전 타입별 조정
    switch (type) {
      case 'forest':
        // 숲은 좀 더 유기적인 넓은 방들
        this.dungeonConfig.roomSizeMin = 8;
        this.dungeonConfig.roomSizeMax = 20;
        this.dungeonConfig.specialRoomChance = 0.4;
        break;
      case 'tower':
        // 타워는 작은 방들이 많음
        this.dungeonConfig.roomSizeMin = 4;
        this.dungeonConfig.roomSizeMax = 10;
        this.dungeonConfig.maxRooms = 20;
        this.dungeonConfig.specialRoomChance = 0.25;
        break;
      case 'cave':
        // 동굴은 불규칙한 크기의 방
        this.dungeonConfig.roomSizeMin = 4;
        this.dungeonConfig.roomSizeMax = 25;
        this.dungeonConfig.specialRoomChance = 0.2;
        break;
      case 'ruins':
        // 유적은 중간 크기의 방들
        this.dungeonConfig.roomSizeMin = 6;
        this.dungeonConfig.roomSizeMax = 12;
        this.dungeonConfig.specialRoomChance = 0.35;
        break;
      case 'castle':
        // 성은 정형화된 크기
        this.dungeonConfig.roomSizeMin = 7;
        this.dungeonConfig.roomSizeMax = 14;
        this.dungeonConfig.maxRooms = 18;
        this.dungeonConfig.specialRoomChance = 0.3;
        break;
    }

    // 난이도에 따른 조정
    this.dungeonConfig.maxRooms += Math.floor(difficulty / 2); // 난이도가 증가할수록 더 많은 방
    this.dungeonConfig.specialRoomChance += difficulty * 0.01; // 난이도가 증가할수록 특수 방 증가
  }

  // 방 생성
  generateRooms(dungeon) {
    // 생성할 방 개수 결정
    const numRooms = Phaser.Math.Between(
      this.dungeonConfig.minRooms,
      this.dungeonConfig.maxRooms
    );

    for (let i = 0; i < numRooms; i++) {
      // 최대 20번 시도하여 겹치지 않는 방 생성
      let room = null;
      let validRoom = false;
      let attempts = 0;

      while (!validRoom && attempts < 20) {
        // 방 크기 및 위치 결정
        const width = Phaser.Math.Between(
          this.dungeonConfig.roomSizeMin,
          this.dungeonConfig.roomSizeMax
        );
        const height = Phaser.Math.Between(
          this.dungeonConfig.roomSizeMin,
          this.dungeonConfig.roomSizeMax
        );

        // 던전 중앙에서부터 방을 배치하기 위한 위치 계산
        const x = Phaser.Math.Between(-50, 50);
        const y = Phaser.Math.Between(-50, 50);

        room = {
          id: i,
          x: x,
          y: y,
          width: width,
          height: height,
          centerX: x + Math.floor(width / 2),
          centerY: y + Math.floor(height / 2),
          neighbors: [],
          doors: [],
          type: this.determineRoomType(i, numRooms),
          entities: []
        };

        // 다른 방과 겹치는지 확인
        validRoom = true;
        for (const otherRoom of dungeon.rooms) {
          if (this.roomsIntersect(room, otherRoom, 2)) { // 2 타일 간격 유지
            validRoom = false;
            break;
          }
        }

        attempts++;
      }

      // 유효한 방을 찾았으면 추가
      if (validRoom) {
        dungeon.rooms.push(room);

        // 던전 크기 업데이트
        dungeon.width = Math.max(dungeon.width, room.x + room.width);
        dungeon.height = Math.max(dungeon.height, room.y + room.height);
      }
    }

    // 던전 영역이 음수 좌표를 갖지 않도록 오프셋 조정
    const minX = Math.min(0, ...dungeon.rooms.map(r => r.x));
    const minY = Math.min(0, ...dungeon.rooms.map(r => r.y));

    if (minX < 0 || minY < 0) {
      const offsetX = minX < 0 ? Math.abs(minX) : 0;
      const offsetY = minY < 0 ? Math.abs(minY) : 0;

      // 모든 방의 좌표 조정
      for (const room of dungeon.rooms) {
        room.x += offsetX;
        room.y += offsetY;
        room.centerX += offsetX;
        room.centerY += offsetY;
      }

      // 던전 크기 업데이트
      dungeon.width += offsetX;
      dungeon.height += offsetY;
    }
  }

  // 방 타입 결정
  determineRoomType(roomIndex, totalRooms) {
    // 첫 번째 방은 항상 입구
    if (roomIndex === 0) return 'entrance';

    // 마지막 방은 항상 보스룸
    if (roomIndex === totalRooms - 1) return 'boss';

    // 특수 방 결정
    if (Math.random() < this.dungeonConfig.specialRoomChance) {
      const specialRooms = ['treasure', 'challenge', 'merchant', 'shrine'];
      return specialRooms[Math.floor(Math.random() * specialRooms.length)];
    }

    // 나머지는 일반 방
    return 'normal';
  }

  // 두 방이 겹치는지 확인
  roomsIntersect(room1, room2, padding = 0) {
    return !(
      room1.x - padding > room2.x + room2.width + padding ||
      room1.x + room1.width + padding < room2.x - padding ||
      room1.y - padding > room2.y + room2.height + padding ||
      room1.y + room1.height + padding < room2.y - padding
    );
  }

  // 방 연결 (문 및 복도)
  connectRooms(dungeon) {
    // 최소 스패닝 트리 알고리즘 사용
    // 1. 각 방 간의 거리 계산
    const distances = [];

    for (let i = 0; i < dungeon.rooms.length; i++) {
      for (let j = i + 1; j < dungeon.rooms.length; j++) {
        const room1 = dungeon.rooms[i];
        const room2 = dungeon.rooms[j];

        const distance = this.calculateDistance(room1, room2);

        distances.push({
          from: i,
          to: j,
          distance: distance
        });
      }
    }

    // 2. 거리에 따라 정렬
    distances.sort((a, b) => a.distance - b.distance);

    // 3. 최소 스패닝 트리 구성
    const connectedRooms = new Set([0]); // 첫 번째 방부터 시작

    // 모든 방이 연결될 때까지
    while (connectedRooms.size < dungeon.rooms.length) {
      for (const connection of distances) {
        // 한 쪽만 연결된 경우에만 새로운 연결 추가
        if (
          (connectedRooms.has(connection.from) && !connectedRooms.has(connection.to)) ||
          (connectedRooms.has(connection.to) && !connectedRooms.has(connection.from))
        ) {
          // 두 방 연결
          this.connectTwoRooms(dungeon, connection.from, connection.to);

          // 연결된 방 기록
          connectedRooms.add(connection.from);
          connectedRooms.add(connection.to);
          break;
        }
      }
    }

    // 4. 순환 경로 몇 개 추가 (20% 확률로 추가 연결)
    for (const connection of distances) {
      if (
        !dungeon.rooms[connection.from].neighbors.includes(connection.to) &&
        Math.random() < 0.2
      ) {
        this.connectTwoRooms(dungeon, connection.from, connection.to);
      }
    }
  }

  // 두 방 사이의 거리 계산
  calculateDistance(room1, room2) {
    return Math.sqrt(
      Math.pow(room1.centerX - room2.centerX, 2) +
      Math.pow(room1.centerY - room2.centerY, 2)
    );
  }

  // 두 방 연결
  connectTwoRooms(dungeon, room1Index, room2Index) {
    const room1 = dungeon.rooms[room1Index];
    const room2 = dungeon.rooms[room2Index];

    // 이미 연결되어 있는지 확인
    if (room1.neighbors.includes(room2Index)) return;

    // 방 사이에 문 생성
    const door = {
      from: room1Index,
      to: room2Index,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0
    };

    // 방향 결정 (가로 또는 세로)
    const horizontal = Math.abs(room1.centerX - room2.centerX) >= Math.abs(room1.centerY - room2.centerY);

    if (horizontal) {
      // 가로 연결
      door.fromX = room1.centerX < room2.centerX ? room1.x + room1.width : room1.x;
      door.fromY = room1.centerY;
      door.toX = room1.centerX < room2.centerX ? room2.x : room2.x + room2.width;
      door.toY = room2.centerY;
    } else {
      // 세로 연결
      door.fromX = room1.centerX;
      door.fromY = room1.centerY < room2.centerY ? room1.y + room1.height : room1.y;
      door.toX = room2.centerX;
      door.toY = room1.centerY < room2.centerY ? room2.y : room2.y + room2.height;
    }

    // 방 연결 정보 업데이트
    room1.neighbors.push(room2Index);
    room2.neighbors.push(room1Index);

    // 방 문 정보 업데이트
    room1.doors.push({ x: door.fromX, y: door.fromY, toRoom: room2Index });
    room2.doors.push({ x: door.toX, y: door.toY, toRoom: room1Index });

    // 던전 문 목록에 추가
    dungeon.doors.push(door);
  }

  // 던전에 몬스터 및 아이템 배치
  populateDungeon(dungeon) {
    for (const room of dungeon.rooms) {
      switch (room.type) {
        case 'normal':
          this.populateNormalRoom(dungeon, room);
          break;
        case 'treasure':
          this.populateTreasureRoom(dungeon, room);
          break;
        case 'challenge':
          this.populateChallengeRoom(dungeon, room);
          break;
        case 'merchant':
          this.populateMerchantRoom(dungeon, room);
          break;
        case 'shrine':
          this.populateShrineRoom(dungeon, room);
          break;
        case 'boss':
          this.populateBossRoom(dungeon, room);
          break;
        case 'entrance':
          // 입구에는 아무것도 없음
          break;
      }

      // 함정 및 환경적 위험 추가
      this.addTrapsAndHazards(dungeon, room);
    }
  }

  // 일반 방 구성
  populateNormalRoom(dungeon, room) {
    const difficulty = dungeon.difficulty;

    // 몬스터 수 결정 (난이도와 방 크기에 비례)
    const area = room.width * room.height;
    const maxMonsters = Math.min(10, Math.floor(area / 25));
    const numMonsters = Phaser.Math.Between(
      Math.floor(maxMonsters / 2),
      maxMonsters
    );

    // 몬스터 생성
    for (let i = 0; i < numMonsters; i++) {
      const monster = this.createMonster(dungeon, room, difficulty);
      room.entities.push(monster);
    }

    // 일반 아이템 추가 (30% 확률)
    if (Math.random() < 0.3) {
      const item = this.createItem(dungeon, difficulty);
      room.entities.push({
        type: 'item',
        ...item,
        x: Phaser.Math.Between(room.x + 2, room.x + room.width - 2),
        y: Phaser.Math.Between(room.y + 2, room.y + room.height - 2)
      });
    }
  }

  // 보물방 구성
  populateTreasureRoom(dungeon, room) {
    const difficulty = dungeon.difficulty;

    // 보물 상자 생성
    const numChests = Phaser.Math.Between(1, 3);

    for (let i = 0; i < numChests; i++) {
      const rarity = this.determineItemRarity(difficulty, true); // 보물방은 더 좋은 아이템

      room.entities.push({
        type: 'chest',
        rarity: rarity,
        x: Phaser.Math.Between(room.x + 2, room.x + room.width - 2),
        y: Phaser.Math.Between(room.y + 2, room.y + room.height - 2),
        opened: false
      });
    }

    // 가끔 가디언 몬스터 배치
    if (Math.random() < 0.5) {
      const guardian = this.createMonster(dungeon, room, difficulty + 1, true);
      guardian.isElite = true; // 보물방 가디언은 항상 엘리트
      room.entities.push(guardian);
    }
  }
}