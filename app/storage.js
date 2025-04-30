const Store = require('electron-store');
const crypto = require('crypto');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// 상수 정의
const BACKUP_COUNT = 5;
const SAVE_FILENAME = 'dungeon_loop_save.json';
const BACKUP_PREFIX = 'backup_';

// Steam Greenworks 모듈 불러오기 (스팀 버전에서만 사용)
let greenworks = null;
try {
  greenworks = require('greenworks');
} catch (e) {
  console.log('스팀 API를 사용할 수 없습니다. 로컬 저장소만 사용합니다.');
}

/**
 * 게임 저장 데이터 관리 클래스
 */
class GameStorage {
  constructor() {
    this.encryptionKey = this._generateEncryptionKey();
    this.steamAvailable = false;
    
    // 로컬 저장소 초기화
    this.localStore = new Store({
      name: 'dungeon-loop-save',
      encryptionKey: this.encryptionKey
    });

    // 저장 디렉토리 생성
    this.saveDir = path.join(app.getPath('userData'), 'saves');
    this._ensureSaveDirectory();
    
    // 스팀 클라우드 초기화
    this._initSteamCloud();
  }

  /**
   * 저장 디렉토리가 존재하는지 확인하고 없으면 생성
   * @private
   */
  _ensureSaveDirectory() {
    if (!fs.existsSync(this.saveDir)) {
      fs.mkdirSync(this.saveDir, { recursive: true });
    }
  }

  /**
   * 암호화 키 생성 (사용자 고유 키)
   * @private
   * @returns {string} 암호화 키
   */
  _generateEncryptionKey() {
    const userDir = app.getPath('userData');
    return crypto.createHash('sha256')
      .update(userDir)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * 스팀 클라우드 초기화
   * @private
   */
  _initSteamCloud() {
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

  /**
   * 체크섬 생성 (무결성 검증용)
   * @private
   * @param {Object} gameState 게임 상태 객체
   * @returns {string} 체크섬 값
   */
  _generateChecksum(gameState) {
    const { checksum, ...dataWithoutChecksum } = gameState;
    const data = JSON.stringify(dataWithoutChecksum);
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 체크섬 검증
   * @private
   * @param {Object} gameState 게임 상태 객체
   * @returns {boolean} 체크섬 유효성 여부
   */
  _validateChecksum(gameState) {
    if (!gameState || !gameState.checksum) return false;

    const storedChecksum = gameState.checksum;
    const { checksum, ...dataWithoutChecksum } = gameState;
    const calculatedChecksum = crypto.createHash('md5')
      .update(JSON.stringify(dataWithoutChecksum))
      .digest('hex');

    return storedChecksum === calculatedChecksum;
  }

  /**
   * 클라우드와 로컬 저장 충돌 해결
   * @private
   * @param {Object} localState 로컬 저장 데이터
   * @param {Object} cloudState 클라우드 저장 데이터
   * @returns {Object} 해결된 게임 상태 객체
   */
  _resolveConflict(localState, cloudState) {
    if (localState.lastSaved > cloudState.lastSaved) {
      console.log('로컬 저장 데이터가 더 최신입니다.');
      return localState;
    } else {
      console.log('클라우드 저장 데이터가 더 최신입니다.');
      return cloudState;
    }
  }

  /**
   * 게임 상태 저장
   * @public
   * @param {Object} gameState 저장할 게임 상태 객체
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  async saveGameState(gameState) {
    try {
      // 메타데이터 추가
      gameState.lastSaved = Date.now();
      gameState.checksum = this._generateChecksum(gameState);

      // 로컬 저장
      this.localStore.set('gameState', gameState);

      // 백업 파일 생성
      await this._createBackup(gameState);

      // 스팀 클라우드 저장 (가능한 경우)
      if (this.steamAvailable) {
        await this._saveToSteamCloud(gameState);
      }

      return true;
    } catch (error) {
      console.error('게임 저장 실패:', error);
      return false;
    }
  }

  /**
   * 게임 상태 로드
   * @public
   * @returns {Promise<Object|null>} 로드된 게임 상태 객체
   */
  async loadGameState() {
    try {
      let gameState = null;

      // 스팀 클라우드에서 로드 시도
      if (this.steamAvailable) {
        gameState = await this._loadFromSteamCloud();
      }

      // 로컬 저장소에서 로드
      const localState = this.localStore.get('gameState');

      // 충돌 해결
      if (gameState && localState) {
        gameState = this._resolveConflict(localState, gameState);
      } else {
        gameState = gameState || localState;
      }

      // 데이터 손상 검사 및 복구
      if (gameState && !this._validateChecksum(gameState)) {
        console.warn('게임 데이터가 손상되었습니다. 백업에서 복원 시도...');
        gameState = await this._restoreFromBackup();
      }

      return gameState;
    } catch (error) {
      console.error('게임 로드 실패:', error);
      return this._restoreFromBackup();
    }
  }

  /**
   * 백업 생성
   * @private
   * @param {Object} gameState 백업할 게임 상태 객체
   * @returns {Promise<void>}
   */
  async _createBackup(gameState) {
    const backupPath = path.join(this.saveDir, `${BACKUP_PREFIX}${Date.now()}.json`);
    const backupData = JSON.stringify(gameState);

    await promisify(fs.writeFile)(backupPath, backupData);
    await this._cleanupOldBackups();
  }

  /**
   * 오래된 백업 파일 정리
   * @private
   * @returns {Promise<void>}
   */
  async _cleanupOldBackups() {
    const backupFiles = fs.readdirSync(this.saveDir)
      .filter(file => file.startsWith(BACKUP_PREFIX))
      .sort()
      .reverse();

    while (backupFiles.length > BACKUP_COUNT) {
      const oldestBackup = backupFiles.pop();
      fs.unlinkSync(path.join(this.saveDir, oldestBackup));
    }
  }

  /**
   * 백업에서 복원
   * @private
   * @returns {Promise<Object|null>} 복원된 게임 상태 객체
   */
  async _restoreFromBackup() {
    try {
      const backupFiles = fs.readdirSync(this.saveDir)
        .filter(file => file.startsWith(BACKUP_PREFIX))
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
      if (this._validateChecksum(gameState)) {
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

  /**
   * 스팀 클라우드에 저장
   * @private
   * @param {Object} gameState 저장할 게임 상태 객체
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  async _saveToSteamCloud(gameState) {
    if (!this.steamAvailable) return false;

    return new Promise((resolve) => {
      try {
        const saveData = JSON.stringify(gameState);

        // 스팀 클라우드에 파일 쓰기
        greenworks.saveTextToFile(SAVE_FILENAME, saveData, (success) => {
          if (success) {
            console.log('스팀 클라우드 저장 성공');
            resolve(true);
          } else {
            console.error('스팀 클라우드 저장 실패');
            resolve(false);
          }
        });
      } catch (error) {
        console.error('스팀 클라우드 저장 오류:', error);
        resolve(false);
      }
    });
  }

  /**
   * 스팀 클라우드에서 로드
   * @private
   * @returns {Promise<Object|null>} 로드된 게임 상태 객체
   */
  async _loadFromSteamCloud() {
    if (!this.steamAvailable) return null;

    return new Promise((resolve) => {
      try {
        // 파일 존재 여부 확인
        if (!greenworks.isCloudEnabled() || !greenworks.fileExists(SAVE_FILENAME)) {
          return resolve(null);
        }

        // 스팀 클라우드에서 파일 읽기
        greenworks.readTextFromFile(SAVE_FILENAME, (content) => {
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

  /**
   * 클라우드 동기화 강제 실행
   * @public
   * @returns {Promise<boolean>} 동기화 성공 여부
   */
  async syncWithCloud() {
    if (!this.steamAvailable) return false;

    try {
      // 로컬 상태 가져오기
      const localState = this.localStore.get('gameState');

      // 클라우드 상태 가져오기
      const cloudState = await this._loadFromSteamCloud();

      // 동기화 로직
      if (localState && cloudState) {
        // 두 데이터가 모두 있는 경우 충돌 해결
        const resolvedState = this._resolveConflict(localState, cloudState);
        await this.saveGameState(resolvedState);
        return true;
      } else if (localState) {
        // 로컬 데이터만 있는 경우 클라우드에 업로드
        await this._saveToSteamCloud(localState);
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