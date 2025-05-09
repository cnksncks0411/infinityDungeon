/**
 * Dungeon Loop 게임의 Electron 프리로드 스크립트
 * 렌더러 프로세스와 메인 프로세스 사이의 안전한 통신 채널을 제공합니다.
 */

// Electron 모듈 불러오기
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// 게임 버전 정보 (package.json에서 가져옴)
let gameVersion = '0.1.0'; // 기본값
try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    gameVersion = packageJson.version;
} catch (error) {
    console.error('package.json을 읽는 중 오류 발생:', error);
}

/**
 * 게임 API
 * 게임 데이터 저장/로드, 클래스 조합, 업데이트 확인 등의 기능 제공
 */
const gameAPI = {
    // 버전 정보
    getVersion: () => gameVersion,

    // 게임 데이터 관리
    saveGameData: (gameData) => {
        return ipcRenderer.invoke('game:saveData', gameData);
    },

    loadGameData: () => {
        return ipcRenderer.invoke('game:loadData');
    },

    exportGameData: (filePath) => {
        return ipcRenderer.invoke('game:exportData', filePath);
    },

    importGameData: (filePath) => {
        return ipcRenderer.invoke('game:importData', filePath);
    },

    // 게임 진행 관련
    calculateCombinationChance: (class1, class2, class1Level, class2Level, hasGoldenKey, alchemistBonus) => {
        return ipcRenderer.invoke('game:calculateCombinationChance',
            class1, class2, class1Level, class2Level, hasGoldenKey, alchemistBonus);
    },

    generateDungeonSeed: () => {
        return ipcRenderer.invoke('game:generateDungeonSeed');
    },

    // 업데이트 확인 및 로그
    checkForUpdates: () => {
        return ipcRenderer.invoke('app:checkForUpdates');
    },

    getChangelog: () => {
        return ipcRenderer.invoke('app:getChangelog');
    },

    // 로그 기록
    logGameEvent: (eventType, data) => {
        return ipcRenderer.invoke('game:logEvent', eventType, data);
    },

    // 게임 데이터 파일 경로
    getGameDataPath: () => {
        return ipcRenderer.invoke('app:getGameDataPath');
    },

    // 스크린샷 저장
    saveScreenshot: (dataUrl, fileName) => {
        return ipcRenderer.invoke('app:saveScreenshot', dataUrl, fileName);
    }
};

/**
 * 파일 시스템 API
 * 게임 에셋 및 데이터 파일 접근을 위한 안전한 메서드 제공
 */
const fsAPI = {
    // 기본 파일 관리
    readJsonFile: (filePath) => {
        return ipcRenderer.invoke('fs:readJsonFile', filePath);
    },

    writeJsonFile: (filePath, data) => {
        return ipcRenderer.invoke('fs:writeJsonFile', filePath, data);
    },

    fileExists: (filePath) => {
        return ipcRenderer.invoke('fs:fileExists', filePath);
    },

    // 게임 데이터 파일 접근
    loadGameDataFile: (fileName) => {
        return ipcRenderer.invoke('fs:loadGameDataFile', fileName);
    },

    // 에셋 관리
    getAssetPath: (assetType, fileName) => {
        return ipcRenderer.invoke('fs:getAssetPath', assetType, fileName);
    },

    // 폴더 관리
    createFolder: (folderPath) => {
        return ipcRenderer.invoke('fs:createFolder', folderPath);
    },

    listDirectory: (directoryPath) => {
        return ipcRenderer.invoke('fs:listDirectory', directoryPath);
    }
};

/**
 * 시스템 API
 * 운영체제 통합 기능 및 사용자 환경 설정 관련 메서드 제공
 */
const systemAPI = {
    // 창 관리
    minimizeWindow: () => {
        ipcRenderer.send('window:minimize');
    },

    maximizeWindow: () => {
        ipcRenderer.send('window:maximize');
    },

    closeWindow: () => {
        ipcRenderer.send('window:close');
    },

    // 디스플레이 정보
    getDisplayInfo: () => {
        return ipcRenderer.invoke('system:getDisplayInfo');
    },

    // 시스템 정보
    getSystemInfo: () => {
        return ipcRenderer.invoke('system:getSystemInfo');
    },

    // 환경 설정
    getAppSettings: () => {
        return ipcRenderer.invoke('app:getSettings');
    },

    saveAppSettings: (settings) => {
        return ipcRenderer.invoke('app:saveSettings', settings);
    },

    // 외부 링크 열기
    openExternalLink: (url) => {
        ipcRenderer.send('system:openExternal', url);
    },

    // 클립보드 기능
    copyToClipboard: (text) => {
        return ipcRenderer.invoke('system:copyToClipboard', text);
    }
};

/**
 * 이벤트 구독 API
 * 메인 프로세스에서 발생하는 이벤트 구독을 위한 메서드 제공
 */
const eventsAPI = {
    // 온라인/오프라인 상태 변경 이벤트
    onConnectionStatusChange: (callback) => {
        ipcRenderer.on('connection:statusChange', (_, status) => callback(status));
        return () => ipcRenderer.removeAllListeners('connection:statusChange');
    },

    // 업데이트 관련 이벤트
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update:available', (_, updateInfo) => callback(updateInfo));
        return () => ipcRenderer.removeAllListeners('update:available');
    },

    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update:downloaded', (_, updateInfo) => callback(updateInfo));
        return () => ipcRenderer.removeAllListeners('update:downloaded');
    },

    onUpdateError: (callback) => {
        ipcRenderer.on('update:error', (_, error) => callback(error));
        return () => ipcRenderer.removeAllListeners('update:error');
    },

    // 게임 저장 관련 이벤트
    onAutoSaveComplete: (callback) => {
        ipcRenderer.on('game:autoSaveComplete', (_, result) => callback(result));
        return () => ipcRenderer.removeAllListeners('game:autoSaveComplete');
    },

    // 시스템 이벤트
    onSystemSuspend: (callback) => {
        ipcRenderer.on('system:suspend', () => callback());
        return () => ipcRenderer.removeAllListeners('system:suspend');
    },

    onSystemResume: (callback) => {
        ipcRenderer.on('system:resume', () => callback());
        return () => ipcRenderer.removeAllListeners('system:resume');
    },

    // 일반 이벤트 구독
    on: (channel, callback) => {
        // 안전하게 허용된 채널만 구독 가능
        const validChannels = [
            'game:event',
            'app:themeChanged',
            'app:languageChanged',
            'dialog:response'
        ];

        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (_, ...args) => callback(...args));
            return () => ipcRenderer.removeAllListeners(channel);
        }

        console.error(`안전하지 않은 채널 구독 시도: ${channel}`);
        return null;
    }
};

/**
 * 대화상자 API
 * 메시지, 확인, 파일 선택 등의 대화상자 기능 제공
 */
const dialogAPI = {
    // 메시지 대화상자
    showMessage: (options) => {
        return ipcRenderer.invoke('dialog:showMessage', options);
    },

    // 확인 대화상자
    showConfirm: (options) => {
        return ipcRenderer.invoke('dialog:showConfirm', options);
    },

    // 입력 대화상자
    showPrompt: (options) => {
        return ipcRenderer.invoke('dialog:showPrompt', options);
    },

    // 파일 선택 대화상자
    showOpenDialog: (options) => {
        return ipcRenderer.invoke('dialog:showOpenDialog', options);
    },

    // 파일 저장 대화상자
    showSaveDialog: (options) => {
        return ipcRenderer.invoke('dialog:showSaveDialog', options);
    }
};

// 렌더러 프로세스에 API 노출
contextBridge.exposeInMainWorld('game', gameAPI);
contextBridge.exposeInMainWorld('fs', fsAPI);
contextBridge.exposeInMainWorld('system', systemAPI);
contextBridge.exposeInMainWorld('events', eventsAPI);
contextBridge.exposeInMainWorld('dialog', dialogAPI);

// 게임 시작 시 메인 프로세스에 알림
window.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.send('app:domReady');

    // 에러 핸들링 추가
    window.addEventListener('error', (event) => {
        ipcRenderer.send('app:error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error ? event.error.stack : ''
        });
    });

    // 진행 상황 로깅 표시
    console.log('Preload script loaded successfully');
});