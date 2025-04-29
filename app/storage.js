const Store = require('electron-store');
const crypto = require('crypto');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// Steam Greenworks 모듈 불러오기 (스팀 버전에서만 사용)
let greenworks = null;
try {
  greenworks = require('greenworks');
} catch (e) {
  console.log('스팀 API를 사용할 수 없습니다. 로컬 저장소만 사용합니다.');
}

class GameStorage {
  constructor() {
    // 저장 파일 암호화를 위한 키 생성
    this.encryptionKey = this.generateEncryptionKey();

    // 로컬 저장소 초기화
    this.localStore = new Store({
      name: 'dungeon-loop-save',
      encryptionKey: this.encryptionKey
    });

    // 저장 디렉토리 생성
    this.saveDir = path.join(app.getPath('userData'), 'saves');
    if (!fs.existsSync(this.saveDir)) {
      fs.mkdirSync(this.saveDir, { recursive: true });
    }

    // 스팀 클라우드 초기화 (가능한 경우)
    this.initSteamCloud();
  }

  // 암호화 키 생성 (사용자 고유 키)
  generateEncryptionKey() {
    // 사용자 디렉토리의 해시값을 키로 사용
    const userDir = app.getPath('userData');
    return crypto.createHash('sha256').update(userDir).digest('hex').substring(0, 32);
  }

  // 스팀 클라우드 초기화
  initSteamCloud() {
    this.steamAvailable = false;

    if (greenworks) {
      try {
        greenworks.init();
        this.steamAvailable = true;
        console.log('스팀 클라우드 초기화 성공');
      } catch (err) {
        console.error('스팀 클라우드 초기화 실패:', err);
      }
    }
  }

  // 게임 상태 저장
  async saveGameState(gameState) {
    try {
      // 마지막 저장 시간 추가
      gameState.lastSaved = Date.now();

      // 체크섬 추가 (파일 무결성 검증용)
      gameState.checksum = this.generateChecksum(gameState);

      // 로컬 저장
      this.localStore.set('gameState', gameState);

      // 백업 파일 생성
      await this.createBackup(gameState);

      // 스팀 클라우드 저장 (가능한 경우)
      if (this.steamAvailable) {
        await this.saveToSteamCloud(gameState);
      }

      return true;
    } catch (error) {
      console.error('게임 저장 실패:', error);
      return false;
    }
  }

  // 게임 상태 로드
  async loadGameState() {
    try {
      let gameState = null;

      // 스팀 클라우드에서 로드 시도
      if (this.steamAvailable) {
        gameState = await this.loadFromSteamCloud();
      }

      // 로컬 저장소에서 로드
      const localState = this.localStore.get('gameState');

      // 스팀과 로컬 데이터 모두 있는 경우 충돌 해결
      if (gameState && localState) {
        gameState = this.resolveConflict(localState, gameState);
      } else {
        gameState = gameState || localState;
      }

      // 데이터가 있지만 손상된 경우 백업에서 복원
      if (gameState && !this.validateChecksum(gameState)) {
        console.warn('게임 데이터가 손상되었습니다. 백업에서 복원 시도...');
        gameState = await this.restoreFromBackup();
      }

      return gameState;
    } catch (error) {
      console.error('게임 로드 실패:', error);

      // 오류 발생 시 백업에서 복원 시도
      return this.restoreFromBackup();
    }
  }

  // 백업 생성
  async createBackup(gameState) {
    const backupPath = path.join(this.saveDir, `backup_${Date.now()}.json`);
    const backupData = JSON.stringify(gameState);

    await promisify(fs.writeFile)(backupPath, backupData);

    // 최대 5개의 백업만 유지
    const backupFiles = fs.readdirSync(this.saveDir)
      .filter(file => file.startsWith('backup_'))
      .sort()
      .reverse();

    while (backupFiles.length > 5) {
      const oldestBackup = backupFiles.pop();
      fs.unlinkSync(path.join(this.saveDir, oldestBackup));
    }
  }

  // 백업에서 복원
  async restoreFromBackup() {
    try {
      const backupFiles = fs.readdirSync(this.saveDir)
        .filter(file => file.startsWith('backup_'))
        .sort()
        .reverse();

      if (backupFiles.length === 0) {
        return null;
      }

      // 가장 최근 백업 파일 사용
      const latestBackup = backupFiles[0];
      const backupData = await promisify(fs.readFile)(
        path.join(this.saveDir, latestBackup),
        'utf8'
      );

      const gameState = JSON.parse(backupData);

      // 복원된 데이터 유효성 검사
      if (this.validateChecksum(gameState)) {
        console.log('백업에서 게임 데이터 복원 성공');
        return gameState;
      } else {
        console.error('백업 데이터도 손상되었습니다.');
        return null;
      }
    } catch (error) {
      console.error('백업 복원 실패:', error);
      return null;
    }
  }

  // 스팀 클라우드에 저장
  async saveToSteamCloud(gameState) {
    if (!this.steamAvailable) return false;

    try {
      const saveData = JSON.stringify(gameState);
      const cloudPath = 'dungeon_loop_save.json';

      // 스팀 클라우드에 파일 쓰기
      greenworks.saveTextToFile(cloudPath, saveData, (success) => {
        if (success) {
          console.log('스팀 클라우드 저장 성공');
        } else {
          console.error('스팀 클라우드 저장 실패');
        }
      });

      return true;
    } catch (error) {
      console.error('스팀 클라우드 저장 오류:', error);
      return false;
    }
  }

  // 스팀 클라우드에서 로드
  async loadFromSteamCloud() {
    if (!this.steamAvailable) return null;

    return new Promise((resolve) => {
      try {
        const cloudPath = 'dungeon_loop_save.json';

        // 파일 존재 여부 확인
        if (!greenworks.isCloudEnabled() || !greenworks.fileExists(cloudPath)) {
          return resolve(null);
        }

        // 스팀 클라우드에서 파일 읽기
        greenworks.readTextFromFile(cloudPath, (content) => {
          try {
            const gameState = JSON.parse(content);
            console.log('스팀 클라우드 로드 성공');
            resolve(gameState);
          } catch (err) {
            console.error('스팀 클라우드 데이터 파싱 오류:', err);
            resolve(null);
          }
        });
      } catch (error) {
        console.error('스팀 클라우드 로드 오류:', error);
        resolve(null);
      }
    });
  }

  // 클라우드와 로컬 저장 충돌 해결
  resolveConflict(localState, cloudState) {
    // 더 최근에 저장된 데이터 사용
    if (localState.lastSaved > cloudState.lastSaved) {
      console.log('로컬 저장 데이터가 더 최신입니다.');
      return localState;
    } else {
      console.log('클라우드 저장 데이터가 더 최신입니다.');
      return cloudState;
    }
  }

  // 체크섬 생성 (간단한 무결성 검증용)
  generateChecksum(gameState) {
    // 체크섬을 제외한 나머지 데이터로 체크섬 계산
    const { checksum, ...dataWithoutChecksum } = gameState;
    const data = JSON.stringify(dataWithoutChecksum);
    return crypto.createHash('md5').update(data).digest('hex');
  }

  // 체크섬 검증
  validateChecksum(gameState) {
    if (!gameState || !gameState.checksum) return false;

    const storedChecksum = gameState.checksum;
    const { checksum, ...dataWithoutChecksum } = gameState;
    const calculatedChecksum = crypto.createHash('md5')
      .update(JSON.stringify(dataWithoutChecksum))
      .digest('hex');

    return storedChecksum === calculatedChecksum;
  }

  // 클라우드 동기화 강제 실행
  async syncWithCloud() {
    if (!this.steamAvailable) return false;

    try {
      // 로컬 상태 가져오기
      const localState = this.localStore.get('gameState');

      // 클라우드 상태 가져오기
      const cloudState = await this.loadFromSteamCloud();

      // 두 데이터가 모두 있는 경우 충돌 해결
      if (localState && cloudState) {
        const resolvedState = this.resolveConflict(localState, cloudState);

        // 해결된 상태 저장
        await this.saveGameState(resolvedState);

        return true;
      } else if (localState) {
        // 로컬 데이터만 있는 경우 클라우드에 업로드
        await this.saveToSteamCloud(localState);
        return true;
      } else if (cloudState) {
        // 클라우드 데이터만 있는 경우 로컬에 저장
        this.localStore.set('gameState', cloudState);
        return true;
      }

      return false;
    } catch (error) {
      console.error('클라우드 동기화 실패:', error);
      return false;
    }
  }
}

module.exports = new GameStorage();