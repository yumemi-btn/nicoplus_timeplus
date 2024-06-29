// ==UserScript==
// @name         nicoplus_timeplus
// @namespace    https://github.com/yumemi-btn/nicoplus_timeplus
// @version      0.2
// @description  ニコニコチャンネルプラスにおいて、タイムスタンプの保存を可能にするUserJSです
// @author       @infinite_chain
// @match        https://nicochannel.jp/*
// @grant        GM_setClipboard
// @grant        GM_info
// ==/UserScript==

(function() {
  'use strict';

  const STORAGE_KEY_PREFIX = 'nicoplus_timeplus_';
  const POLL_INTERVAL = 1000;

  class TimestampController {
    constructor(wrapper, video) {
      this.wrapper = wrapper;
      this.video = video;
      this.timestamps = this.loadTimestamps();
      this.createUI();
      this.aRepeat = null;
      this.bRepeat = null;
      this.repeatInterval = null;
      this.isSettingRepeat = false;
    }

    createUI() {
      const controller = document.createElement('div');
      controller.className = 'nicoplus-timeplus-controller';

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'nicoplus-timeplus-button-container';

      const addButton = this.createButton('現在の時間を追加', () => this.addTimestamp(Math.floor(this.video.currentTime)));
      const exportButton = this.createButton('エクスポート', () => this.exportTimestamps());
      const importButton = this.createButton('インポート', () => this.importTimestamps());
      const importReplaceButton = this.createButton('削除してインポート', () => this.importTimestamps(true));
      this.repeatButton = this.createButton('A-Bリピート', () => this.toggleRepeatSetting());

      buttonContainer.append(addButton, exportButton, importButton, importReplaceButton, this.repeatButton);

      this.timestampsList = document.createElement('div');
      this.timestampsList.className = 'nicoplus-timeplus-list';

      const titleDescription = document.createElement('div');
      titleDescription.className = 'nicoplus-timeplus-title-description';
      const scriptName = GM_info.script.name;
      const scriptVersion = GM_info.script.version;
      titleDescription.innerHTML = `${scriptName} v${scriptVersion} <span class="nicoplus-timeplus-description">左クリックでジャンプ、右クリックで削除、マウスホイールで秒数調整</span>`;

      const backupRestoreContainer = document.createElement('div');
      backupRestoreContainer.className = 'nicoplus-timeplus-backup-restore-container';
      const backupButton = this.createButton('全てのデータをバックアップ', () => this.backupData());
      const restoreButton = this.createButton('バックアップからリストア', () => this.restoreData());
      backupRestoreContainer.append(backupButton, restoreButton);

      controller.append(buttonContainer, this.timestampsList, titleDescription, backupRestoreContainer);
      this.wrapper.appendChild(controller);

      this.updateTimestamps();
    }

    createButton(text, onClick) {
      const button = document.createElement('button');
      button.textContent = text;
      button.onclick = onClick;
      return button;
    }

    addTimestamp(time) {
      if (!this.timestamps.includes(time)) {
        this.timestamps.push(time);
        this.timestamps.sort((a, b) => a - b);
        this.saveTimestamps();
        this.updateTimestamps();
      }
    }

    updateTimestamps() {
      this.timestampsList.innerHTML = '';
      this.timestamps.forEach(time => {
        const button = document.createElement('button');
        button.textContent = this.formatTime(time);
        button.className = 'nicoplus-timeplus-timestamp';

        button.oncontextmenu = (e) => {
          e.preventDefault();
          this.timestamps = this.timestamps.filter(t => t !== time);
          this.saveTimestamps();
          this.updateTimestamps();
        };

        button.onwheel = (e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 1 : -1;
          let newTime = Math.max(0, time + delta);

          if (!this.timestamps.includes(newTime)) {
            this.timestamps = this.timestamps.map(t => t === time ? newTime : t);
            this.timestamps.sort((a, b) => a - b);
            this.saveTimestamps();
            this.updateTimestamps();
          }
        };

        button.onclick = () => {
          if (this.isSettingRepeat) {
            this.setRepeatPoint(time, button);
          } else {
            this.video.currentTime = time;
            this.video.play();
          }
        };

        this.timestampsList.appendChild(button);
      });
    }

    formatTime(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    loadTimestamps() {
      const videoId = this.getVideoId();
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${videoId}`);
      return stored ? JSON.parse(stored) : [];
    }

    saveTimestamps() {
      const videoId = this.getVideoId();
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${videoId}`, JSON.stringify(this.timestamps));
    }

    getVideoId() {
      const urlParts = location.href.split('/');
      return urlParts[urlParts.length - 1];
    }

    exportTimestamps() {
      try {
        GM_setClipboard(this.timestamps.map(this.formatTime).join(', '));
        alert('タイムスタンプをクリップボードにコピーしました。');
      } catch (err) {
        alert(`タイムスタンプのコピーに失敗しました: ${err}`);
      }
    }

    importTimestamps(replace = false) {
      const input = prompt('カンマ、スペース、改行で区切ったタイムスタンプを入力してください:');
      if (input) {
        const newTimestamps = input.split(/[\s,]+/)
          .filter(Boolean)
          .map(t => {
            const parts = t.split(':').reverse();
            return parts.reduce((acc, p, i) => acc + parseInt(p) * Math.pow(60, i), 0);
          });
        if (replace) {
          this.timestamps = newTimestamps;
        } else {
          this.timestamps = [...new Set([...this.timestamps, ...newTimestamps])].sort((a, b) => a - b);
        }
        this.saveTimestamps();
        this.updateTimestamps();
      }
    }

    toggleRepeatSetting() {
      if (this.isSettingRepeat) {
        // リピート解除
        this.isSettingRepeat = false;
        this.aRepeat = this.bRepeat = null;
        clearInterval(this.repeatInterval);
        this.updateTimestamps();
        this.repeatButton.textContent = 'A-Bリピート';
      } else {
        // リピート設定開始
        this.isSettingRepeat = true;
        this.repeatButton.textContent = 'A-Bリピート (タイムスタンプを選択してください)';
      }
    }

    setRepeatPoint(time, button) {
      if (this.aRepeat === null) {
        this.aRepeat = time;
        button.style.backgroundColor = 'yellow';
      } else if (this.bRepeat === null && time > this.aRepeat) {
        this.bRepeat = time;
        button.style.backgroundColor = 'yellow';
        this.startRepeat();
      }
    }

    startRepeat() {
      if (this.aRepeat !== null && this.bRepeat !== null) {
        this.repeatButton.textContent = 'A-Bリピート (解除する)';
        this.repeatInterval = setInterval(() => {
          if (this.video.currentTime >= this.bRepeat || this.video.currentTime < this.aRepeat) {
            this.video.currentTime = this.aRepeat;
            this.video.play();
          }
        }, 100);
      }
    }

    backupData() {
      const data = {};
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          data[key] = localStorage.getItem(key);
        }
      });
      const dataString = JSON.stringify(data);
      GM_setClipboard(dataString);
      alert('データをクリップボードにバックアップしました。');
    }

    restoreData() {
      const input = prompt('バックアップデータを貼り付けてください:');
      if (input) {
        try {
          const data = JSON.parse(input);
          Object.keys(data).forEach(key => {
            if (key.startsWith(STORAGE_KEY_PREFIX)) {
              localStorage.setItem(key, data[key]);
            }
          });
          alert('データをリストアしました。ページを再読み込みしてください。');
        } catch (err) {
          alert(`リストアに失敗しました: ${err}`);
        }
      }
    }
  }

  function waitForElement(selector, callback) {
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        callback(element);
      }
    }, POLL_INTERVAL);
  }

  function initialize() {
    waitForElement('#video-player-wrapper', wrapper => {
      waitForElement('.nfcp-video', video => {
        new TimestampController(wrapper, video);
      });
    });
  }

  // URL変更を監視
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (/https:\/\/nicochannel\.jp\/.*\/video\/.*/.test(lastUrl)) {
        initialize();
      }
    }
  }).observe(document, { childList: true, subtree: true });

  // 初期ページがビデオページの場合に初期化を実行
  if (/https:\/\/nicochannel\.jp\/.*\/video\/.*/.test(location.href)) {
    initialize();
  }

  // スタイルの追加
  const style = document.createElement('style');
  style.textContent = `
    .nicoplus-timeplus-controller {
      margin-top: 15px;
      padding: 15px;
      background: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-family: Arial, sans-serif;
    }
    .nicoplus-timeplus-button-container {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .nicoplus-timeplus-button-container button,
    .nicoplus-timeplus-backup-restore-container button,
    .nicoplus-timeplus-timestamp {
      padding: 5px 10px;
      background: #f0f0f0;
      color: #333;
      border: 1px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .nicoplus-timeplus-button-container button:hover,
    .nicoplus-timeplus-backup-restore-container button:hover,
    .nicoplus-timeplus-timestamp:hover {
      background: #e0e0e0;
    }
    .nicoplus-timeplus-list {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 10px;
    }
    .nicoplus-timeplus-timestamp {
      font-size: 12px;
    }
    .nicoplus-timeplus-title-description {
      font-size: 12px;
      color: #666;
    }
    .nicoplus-timeplus-description {
      margin-left: 10px;
      font-size: 11px;
    }
    .nicoplus-timeplus-backup-restore-container {
      margin-top: 10px;
      display: flex;
      gap: 10px;
    }
  `;
  document.head.appendChild(style);
})();
