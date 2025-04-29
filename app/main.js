const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const GameUpdater = require('./updater');
const gameStorage = require('./storage');

// 메인 윈도우 레퍼런스 유지
let mainWindow;

function createWindow() {
  // 브라우저 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    // 게임에 적합한 설정
    backgroundColor: '#000000',
    show: false, // 로딩이 완료될 때까지 표시하지 않음
    icon: path.join(__dirname, '../assets/images/ui/app_icon.png')
  });

  // 메인 HTML 파일 로드
  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  // 로딩 완료 시 윈도우 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 개발 중에는 개발자 도구 열기
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 윈도우가 닫힐 때 자동 저장
  mainWindow.on('close', async (e) => {
    e.preventDefault(); // 기본 동작 방지

    try {
      // 게임 데이터 저장 요청
      mainWindow.webContents.send('request-save-game');

      // 약간의 지연 후 앱 종료 (저장 완료 대기)
      setTimeout(() => {
        mainWindow = null;
        app.quit();
      }, 1000);
    } catch (error) {
      console.error('게임 종료 중 오류:', error);
      mainWindow = null;
      app.quit();
    }
  });
}

// Electron이 초기화를 완료하고 준비되면 윈도우 생성
app.whenReady().then(() => {
  createWindow();

  // macOS에서 앱 아이콘 클릭 시 윈도우 재생성
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // 업데이터 초기화 및 업데이트 확인
  const updater = new GameUpdater(mainWindow);
  updater.checkForUpdates();
});

// 모든 윈도우가 닫히면 앱 종료 (Windows & Linux)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// 게임 저장 및 로드 이벤트 처리
ipcMain.handle('save-game', async (event, gameState) => {
  return gameStorage.saveGameState(gameState);
});

ipcMain.handle('load-game', async () => {
  return gameStorage.loadGameState();
});

// 스팀 클라우드 동기화 요청 처리
ipcMain.handle('sync-cloud-saves', async () => {
  return gameStorage.syncWithCloud();
});

// 클래스 조합 확률 계산기 호출
ipcMain.handle('calculate-combination-chance', async (event, { class1Level, class2Level, hasGoldenKey, alchemistBonus }) => {
  // 로직은 별도의 클래스에 구현되어 있다고 가정
  const baseChance = getBaseChanceForCombination(class1, class2);
  const levelBonus = Math.min(40, (class1Level + class2Level - 20)); // 최대 +40%
  const keyBonus = hasGoldenKey ? 20 : 0;

  return Math.min(100, baseChance + levelBonus + keyBonus + alchemistBonus);
});

// 기본 조합 확률 계산 함수
function getBaseChanceForCombination(class1, class2) {
  // 티어에 따라 기본 확률 결정
  if (isTier3Combination(class1, class2)) return 50;
  if (isTier4Combination(class1, class2)) return 25;
  return 80; // 기본은 티어 2 조합
}

// 티어 3 조합인지 확인
function isTier3Combination(class1, class2) {
  // 티어 2 클래스들의 조합인지 확인
  return (class1.tier === 2 && class2.tier === 2);
}

// 티어 4 조합인지 확인
function isTier4Combination(class1, class2) {
  // 티어 3 클래스들의 조합인지 확인
  return (class1.tier === 3 || class2.tier === 3);
}