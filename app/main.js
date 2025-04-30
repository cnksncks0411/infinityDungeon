const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const GameUpdater = require('./updater');
const gameStorage = require('./storage');

// 메인 윈도우 레퍼런스 유지
let mainWindow;

/**
 * 메인 애플리케이션 윈도우를 생성하는 함수
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#000000',
    show: false,
    icon: path.join(__dirname, '../assets/images/ui/app_icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', handleWindowClose);
}

/**
 * 윈도우가 닫힐 때 호출되는 핸들러 함수
 * @param {Event} e - 이벤트 객체
 */
async function handleWindowClose(e) {
  e.preventDefault();

  try {
    mainWindow.webContents.send('request-save-game');

    setTimeout(() => {
      mainWindow = null;
      app.quit();
    }, 1000);
  } catch (error) {
    console.error('게임 종료 중 오류:', error);
    mainWindow = null;
    app.quit();
  }
}

/**
 * 앱 초기화 함수
 */
function initializeApp() {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  const updater = new GameUpdater(mainWindow);
  updater.checkForUpdates();
}

/**
 * IPC 이벤트 핸들러 설정 함수
 */
function setupIpcHandlers() {
  ipcMain.handle('save-game', async (event, gameState) => {
    return gameStorage.saveGameState(gameState);
  });

  ipcMain.handle('load-game', async () => {
    return gameStorage.loadGameState();
  });

  ipcMain.handle('sync-cloud-saves', async () => {
    return gameStorage.syncWithCloud();
  });

  ipcMain.handle('calculate-combination-chance', async (event, { 
    class1Level, 
    class2Level, 
    hasGoldenKey, 
    alchemistBonus,
    class1,
    class2 
  }) => {
    return calculateCombinationChance(
      class1, 
      class2, 
      class1Level, 
      class2Level, 
      hasGoldenKey, 
      alchemistBonus
    );
  });
}

/**
 * 클래스 조합 확률을 계산하는 함수
 * @param {Object} class1 - 첫 번째 클래스 정보
 * @param {Object} class2 - 두 번째 클래스 정보
 * @param {number} class1Level - 첫 번째 클래스 레벨
 * @param {number} class2Level - 두 번째 클래스 레벨
 * @param {boolean} hasGoldenKey - 황금 열쇠 보유 여부
 * @param {number} alchemistBonus - 연금술사 보너스
 * @returns {number} - 최종 조합 확률(%)
 */
function calculateCombinationChance(class1, class2, class1Level, class2Level, hasGoldenKey, alchemistBonus) {
  const baseChance = getBaseChanceForCombination(class1, class2);
  const levelBonus = Math.min(40, (class1Level + class2Level - 20)); // 최대 +40%
  const keyBonus = hasGoldenKey ? 20 : 0;

  return Math.min(100, baseChance + levelBonus + keyBonus + alchemistBonus);
}

/**
 * 클래스 조합의 기본 확률을 반환하는 함수
 * @param {Object} class1 - 첫 번째 클래스 정보
 * @param {Object} class2 - 두 번째 클래스 정보
 * @returns {number} - 기본 조합 확률(%)
 */
function getBaseChanceForCombination(class1, class2) {
  if (isTier3Combination(class1, class2)) return 50;
  if (isTier4Combination(class1, class2)) return 25;
  return 80; // 기본은 티어 2 조합
}

/**
 * 티어 3 조합인지 확인하는 함수
 * @param {Object} class1 - 첫 번째 클래스 정보
 * @param {Object} class2 - 두 번째 클래스 정보
 * @returns {boolean} - 티어 3 조합 여부
 */
function isTier3Combination(class1, class2) {
  return (class1.tier === 2 && class2.tier === 2);
}

/**
 * 티어 4 조합인지 확인하는 함수
 * @param {Object} class1 - 첫 번째 클래스 정보
 * @param {Object} class2 - 두 번째 클래스 정보
 * @returns {boolean} - 티어 4 조합 여부
 */
function isTier4Combination(class1, class2) {
  return (class1.tier === 3 || class2.tier === 3);
}

// 앱 초기화
app.whenReady().then(() => {
  initializeApp();
  setupIpcHandlers();
});

// 모든 윈도우가 닫히면 앱 종료 (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});