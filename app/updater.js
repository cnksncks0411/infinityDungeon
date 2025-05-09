/**
 * Dungeon Loop 게임의 자동 업데이트 관리자
 * 애플리케이션 업데이트 검사, 다운로드, 설치를 담당
 */

const { app, autoUpdater, dialog, BrowserWindow, ipcMain } = require('electron');
const log = require('electron-log');
const { is } = require('electron-util');
const semver = require('semver');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// 로깅 설정
log.transports.file.level = 'info';
autoUpdater.logger = log;

// 개발 환경에서는 업데이트 확인 비활성화
const isDev = is.development;

// 업데이트 서버 URL (환경에 따라 다른 URL 사용)
const UPDATE_SERVER_URL = isDev
    ? 'https://dev-updates.dungeonloop.com'
    : 'https://updates.dungeonloop.com';

// 변경 로그 파일 경로
const CHANGELOG_PATH = path.join(app.getPath('userData'), 'changelog.json');

// 마지막 업데이트 확인 기록 파일
const LAST_CHECK_PATH = path.join(app.getPath('userData'), 'last_update_check.txt');

// 업데이트 확인 간격 (24시간)
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // ms

class Updater {
    constructor() {
        this.updateAvailable = false;
        this.updateDownloaded = false;
        this.updateInfo = null;
        this.lastCheckTime = 0;
        this.mainWindow = null;
        this.manualCheck = false;
        this.downloadProgress = 0;
        this.changelog = [];

        // 자동 업데이터 이벤트 설정
        this.setupAutoUpdater();

        // 초기 설정 로드
        this.loadLastCheckTime();
        this.loadChangelog();
    }

    /**
     * 자동 업데이터 이벤트 설정
     */
    setupAutoUpdater() {
        // 업데이트 발견
        autoUpdater.on('update-available', (info) => {
            log.info('업데이트 발견:', info);
            this.updateAvailable = true;
            this.updateInfo = info;

            // 변경 로그 가져오기
            this.fetchChangelog(info.version)
                .then(() => {
                    if (this.mainWindow) {
                        this.mainWindow.webContents.send('update:available', {
                            version: info.version,
                            releaseDate: info.releaseDate,
                            changelog: this.getChangelogForVersion(info.version)
                        });
                    }

                    // 수동 업데이트 확인인 경우 알림 표시
                    if (this.manualCheck) {
                        this.showUpdateDialog(info);
                    }
                })
                .catch(error => {
                    log.error('변경 로그 가져오기 실패:', error);
                });
        });

        // 업데이트 없음
        autoUpdater.on('update-not-available', (info) => {
            log.info('업데이트 없음:', info);

            // 수동 업데이트 확인인 경우 알림 표시
            if (this.manualCheck) {
                this.manualCheck = false;
                dialog.showMessageBox(this.mainWindow, {
                    type: 'info',
                    title: '업데이트 없음',
                    message: '이미 최신 버전을 사용하고 있습니다.',
                    buttons: ['확인']
                });
            }
        });

        // 업데이트 다운로드 진행 상황
        autoUpdater.on('download-progress', (progressObj) => {
            log.info(`다운로드 진행: ${progressObj.percent}%`);
            this.downloadProgress = progressObj.percent;

            if (this.mainWindow) {
                this.mainWindow.webContents.send('update:progress', {
                    percent: progressObj.percent,
                    bytesPerSecond: progressObj.bytesPerSecond,
                    transferred: progressObj.transferred,
                    total: progressObj.total
                });
            }
        });

        // 업데이트 다운로드 완료
        autoUpdater.on('update-downloaded', (info) => {
            log.info('업데이트 다운로드 완료:', info);
            this.updateDownloaded = true;

            if (this.mainWindow) {
                this.mainWindow.webContents.send('update:downloaded', {
                    version: info.version,
                    releaseDate: info.releaseDate,
                    changelog: this.getChangelogForVersion(info.version)
                });
            }

            // 업데이트 설치 확인 대화상자 표시
            this.showUpdateReadyDialog(info);
        });

        // 오류 처리
        autoUpdater.on('error', (error) => {
            log.error('업데이트 오류:', error);

            // 수동 업데이트 확인인 경우 오류 알림 표시
            if (this.manualCheck) {
                this.manualCheck = false;
                dialog.showErrorBox(
                    '업데이트 오류',
                    `업데이트를 확인하는 중 오류가 발생했습니다: ${error.message}`
                );
            }

            if (this.mainWindow) {
                this.mainWindow.webContents.send('update:error', {
                    message: error.message
                });
            }
        });
    }

    /**
     * 메인 윈도우 참조 설정
     * @param {BrowserWindow} window - 메인 브라우저 윈도우 객체
     */
    setMainWindow(window) {
        this.mainWindow = window;

        // 메인 윈도우가 로드된 후 자동 업데이트 확인
        if (this.mainWindow) {
            this.mainWindow.webContents.on('did-finish-load', () => {
                this.checkForUpdatesAuto();
            });
        }
    }

    /**
     * 업데이트 서버 URL 설정
     */
    setFeedURL() {
        if (isDev) {
            // 개발 모드에서는 업데이트 확인 비활성화
            log.info('개발 환경에서는 자동 업데이트가 비활성화됩니다.');
            return;
        }

        // 플랫폼별 업데이트 URL 설정
        const platform = process.platform;
        const arch = process.arch;
        const version = app.getVersion();

        const feedURL = `${UPDATE_SERVER_URL}/${platform}/${arch}/${version}`;

        try {
            autoUpdater.setFeedURL({
                url: feedURL,
                serverType: 'json'  // GitHub, Bintray, 또는 자체 서버
            });
            log.info('업데이트 Feed URL 설정:', feedURL);
        } catch (error) {
            log.error('Feed URL 설정 오류:', error);
        }
    }

    /**
     * 업데이트 자동 확인 (정기적으로 실행)
     */
    async checkForUpdatesAuto() {
        try {
            // 마지막 확인 이후 충분한 시간이 지났는지 확인
            const now = Date.now();

            if (now - this.lastCheckTime < CHECK_INTERVAL) {
                const hoursRemaining = Math.round((CHECK_INTERVAL - (now - this.lastCheckTime)) / (1000 * 60 * 60));
                log.info(`자동 업데이트 확인 생략 (다음 확인까지 약 ${hoursRemaining}시간 남음)`);
                return;
            }

            log.info('자동 업데이트 확인 시작...');
            this.manualCheck = false;

            // 개발 환경에서는 업데이트 확인 건너뛰기
            if (isDev) {
                log.info('개발 환경에서는 업데이트 확인을 건너뜁니다.');
                return;
            }

            // Feed URL 설정 및 업데이트 확인
            this.setFeedURL();
            autoUpdater.checkForUpdates();

            // 마지막 확인 시간 업데이트
            this.lastCheckTime = now;
            await this.saveLastCheckTime();

        } catch (error) {
            log.error('자동 업데이트 확인 오류:', error);
        }
    }

    /**
     * 업데이트 수동 확인 (사용자 요청 시)
     */
    checkForUpdatesManual() {
        try {
            log.info('수동 업데이트 확인 시작...');
            this.manualCheck = true;

            // 개발 환경에서는 가짜 업데이트 대화상자 표시
            if (isDev) {
                log.info('개발 환경에서 가짜 업데이트 대화상자 표시');
                setTimeout(() => {
                    this.showUpdateDialog({
                        version: '1.0.0-dev',
                        releaseDate: new Date().toISOString()
                    });
                }, 1000);
                return;
            }

            // Feed URL 설정 및 업데이트 확인
            this.setFeedURL();
            autoUpdater.checkForUpdates();

            // 마지막 확인 시간 업데이트
            this.lastCheckTime = Date.now();
            this.saveLastCheckTime();

        } catch (error) {
            log.error('수동 업데이트 확인 오류:', error);
            dialog.showErrorBox(
                '업데이트 확인 오류',
                `업데이트를 확인하는 중 오류가 발생했습니다: ${error.message}`
            );
        }
    }

    /**
     * 업데이트 설치 (다운로드 완료 후)
     */
    installUpdate() {
        if (this.updateDownloaded) {
            log.info('업데이트 설치 중...');
            autoUpdater.quitAndInstall(true, true);
        } else {
            log.warn('설치할 업데이트가 없습니다.');
        }
    }

    /**
     * 업데이트 대화상자 표시
     * @param {Object} info - 업데이트 정보
     */
    showUpdateDialog(info) {
        if (!this.mainWindow) return;

        // 변경 로그 형식화
        const changelogText = this.formatChangelog(this.getChangelogForVersion(info.version));

        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: '업데이트 가능',
            message: `새 버전 ${info.version}이(가) 사용 가능합니다.`,
            detail: `현재 버전: ${app.getVersion()}\n새 버전: ${info.version}\n릴리스 날짜: ${new Date(info.releaseDate).toLocaleDateString()}\n\n${changelogText}\n\n지금 업데이트를 다운로드하시겠습니까?`,
            buttons: ['다운로드', '나중에'],
            defaultId: 0
        }).then(({ response }) => {
            if (response === 0) {
                // 게임이 실행 중이면 사용자에게 저장 요청
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('game:saveBeforeUpdate');
                }

                // 업데이트 다운로드 시작
                log.info('사용자가 업데이트 다운로드를 시작했습니다.');
                autoUpdater.downloadUpdate();
            }
        });
    }

    /**
     * 업데이트 준비 완료 대화상자 표시
     * @param {Object} info - 업데이트 정보
     */
    showUpdateReadyDialog(info) {
        if (!this.mainWindow) return;

        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: '업데이트 준비 완료',
            message: `새 버전 ${info.version}이(가) 설치 준비되었습니다.`,
            detail: '애플리케이션을 다시 시작하여 업데이트를 적용하시겠습니까?',
            buttons: ['지금 다시 시작', '나중에'],
            defaultId: 0
        }).then(({ response }) => {
            if (response === 0) {
                // 게임 저장 후 업데이트 설치
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('game:saveBeforeUpdate');

                    // 저장 완료 후 업데이트 설치
                    ipcMain.once('game:saveComplete', () => {
                        setTimeout(() => {
                            this.installUpdate();
                        }, 1000);
                    });
                } else {
                    this.installUpdate();
                }
            }
        });
    }

    /**
     * 마지막 업데이트 확인 시간 로드
     */
    async loadLastCheckTime() {
        try {
            if (fs.existsSync(LAST_CHECK_PATH)) {
                const data = await readFile(LAST_CHECK_PATH, 'utf8');
                this.lastCheckTime = parseInt(data, 10) || 0;
                log.info('마지막 업데이트 확인 시간 로드:', new Date(this.lastCheckTime).toISOString());
            } else {
                this.lastCheckTime = 0;
                log.info('마지막 업데이트 확인 기록이 없습니다.');
            }
        } catch (error) {
            log.error('마지막 업데이트 확인 시간 로드 실패:', error);
            this.lastCheckTime = 0;
        }
    }

    /**
     * 마지막 업데이트 확인 시간 저장
     */
    async saveLastCheckTime() {
        try {
            await writeFile(LAST_CHECK_PATH, this.lastCheckTime.toString(), 'utf8');
            log.info('마지막 업데이트 확인 시간 저장:', new Date(this.lastCheckTime).toISOString());
        } catch (error) {
            log.error('마지막 업데이트 확인 시간 저장 실패:', error);
        }
    }

    /**
     * 변경 로그 로드
     */
    async loadChangelog() {
        try {
            if (fs.existsSync(CHANGELOG_PATH)) {
                const data = await readFile(CHANGELOG_PATH, 'utf8');
                this.changelog = JSON.parse(data);
                log.info(`변경 로그 로드: ${this.changelog.length}개 항목`);
            } else {
                this.changelog = [];
                log.info('변경 로그 파일이 없습니다. 새 파일을 생성합니다.');
                await this.saveChangelog();
            }
        } catch (error) {
            log.error('변경 로그 로드 실패:', error);
            this.changelog = [];
        }
    }

    /**
     * 변경 로그 저장
     */
    async saveChangelog() {
        try {
            await writeFile(CHANGELOG_PATH, JSON.stringify(this.changelog, null, 2), 'utf8');
            log.info(`변경 로그 저장: ${this.changelog.length}개 항목`);
        } catch (error) {
            log.error('변경 로그 저장 실패:', error);
        }
    }

    /**
     * 원격 서버에서 변경 로그 가져오기
     * @param {string} version - 버전 문자열
     */
    async fetchChangelog(version) {
        try {
            // 변경 로그가 이미 있는지 확인
            if (this.getChangelogForVersion(version).length > 0) {
                log.info(`버전 ${version}의 변경 로그가 이미 존재합니다.`);
                return;
            }

            // 개발 환경에서는 가짜 변경 로그 사용
            if (isDev) {
                this.changelog.push({
                    version,
                    releaseDate: new Date().toISOString(),
                    changes: [
                        '개발 모드 가짜 변경 로그 항목 1',
                        '개발 모드 가짜 변경 로그 항목 2',
                        '개발 모드 가짜 변경 로그 항목 3'
                    ]
                });
                await this.saveChangelog();
                return;
            }

            // 원격 서버에서 변경 로그 가져오기
            const changelogUrl = `${UPDATE_SERVER_URL}/changelog/${version}.json`;
            log.info(`변경 로그 URL: ${changelogUrl}`);

            const response = await axios.get(changelogUrl, { timeout: 5000 });

            if (response.status === 200 && response.data) {
                // 새 변경 로그 추가
                this.changelog.push({
                    version: version,
                    releaseDate: response.data.releaseDate || new Date().toISOString(),
                    changes: response.data.changes || []
                });

                // 변경 로그 저장
                await this.saveChangelog();
                log.info(`버전 ${version}의 변경 로그를 가져왔습니다.`);
            }
        } catch (error) {
            log.error(`버전 ${version}의 변경 로그를 가져오는 중 오류 발생:`, error);

            // 가져오기 실패 시 기본 변경 로그 생성
            this.changelog.push({
                version: version,
                releaseDate: new Date().toISOString(),
                changes: ['변경 로그를า가져오지 못했습니다.']
            });

            await this.saveChangelog();
        }
    }

    /**
     * 특정 버전의 변경 로그 가져오기
     * @param {string} version - 버전 문자열
     * @returns {string[]} 변경 사항 목록
     */
    getChangelogForVersion(version) {
        const versionEntry = this.changelog.find(entry => entry.version === version);
        return versionEntry ? versionEntry.changes : [];
    }

    /**
     * 현재 버전보다 새로운 모든 변경 로그 가져오기
     * @returns {Object[]} 변경 로그 항목 목록
     */
    getNewChangelogs() {
        const currentVersion = app.getVersion();

        return this.changelog
            .filter(entry => semver.gt(entry.version, currentVersion))
            .sort((a, b) => semver.compare(b.version, a.version)); // 최신 버전 순으로 정렬
    }

    /**
     * 변경 로그 문자열 형식화
     * @param {string[]} changes - 변경 사항 목록
     * @returns {string} 형식화된 변경 로그
     */
    formatChangelog(changes) {
        if (!changes || changes.length === 0) {
            return '변경 사항 정보가 없습니다.';
        }

        return changes.map(change => `• ${change}`).join('\n');
    }

    /**
     * 전체 변경 로그 가져오기
     * @returns {Object[]} 모든 변경 로그 항목
     */
    getAllChangelogs() {
        return [...this.changelog].sort((a, b) => semver.compare(b.version, a.version));
    }

    /**
     * IPC 핸들러 설정
     */
    setupIPCHandlers() {
        // 수동 업데이트 확인
        ipcMain.handle('app:checkForUpdates', () => {
            this.checkForUpdatesManual();
            return { checking: true };
        });

        // 변경 로그 가져오기
        ipcMain.handle('app:getChangelog', () => {
            return this.getAllChangelogs();
        });

        // 업데이트 다운로드 시작
        ipcMain.handle('app:downloadUpdate', () => {
            if (this.updateAvailable && !this.updateDownloaded) {
                autoUpdater.downloadUpdate();
                return { downloading: true };
            }
            return { downloading: false, error: '다운로드할 업데이트가 없습니다.' };
        });

        // 업데이트 설치
        ipcMain.handle('app:installUpdate', () => {
            if (this.updateDownloaded) {
                // 저장 완료 후 1초 후에 설치
                setTimeout(() => {
                    this.installUpdate();
                }, 1000);
                return { installing: true };
            }
            return { installing: false, error: '설치할 업데이트가 없습니다.' };
        });

        // 다운로드 진행 상황 가져오기
        ipcMain.handle('app:getUpdateProgress', () => {
            return {
                available: this.updateAvailable,
                downloaded: this.updateDownloaded,
                progress: this.downloadProgress,
                info: this.updateInfo
            };
        });
    }
}

module.exports = Updater;