// ==UserScript==
// @name         nicoplus_timeplus
// @namespace    https://github.com/yumemi-btn/nicoplus_timeplus
// @version      0.3
// @description  ニコニコチャンネルプラスにおいて、タイムスタンプの保存と追加機能を実装するUserJSです
// @author       @infinite_chain
// @match        https://nicochannel.jp/*
// @grant        GM_setClipboard
// @grant        GM_info
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY_PREFIX = 'nicoplus_timeplus_';
  const AUTO_ADD_ENABLED_KEY = `${STORAGE_KEY_PREFIX}auto_add_enabled`;
  const POLL_INTERVAL = 1000;

  class TimestampController {
    constructor(wrapper, video) {
      this.wrapper = wrapper;
      this.video = video;
      this.timestamps = this.loadTimestamps();
      this.aRepeat = null;
      this.bRepeat = null;
      this.repeatInterval = null;
      this.isSettingRepeat = false;
      this.autoAddEnabled = localStorage.getItem(AUTO_ADD_ENABLED_KEY) === 'true';
      this.activeMenu = null;
      this.createUI();
    }

    createUI() {
      const controller = document.createElement('div');
      controller.className = 'nicoplus-timeplus-controller';

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'nicoplus-timeplus-button-container';

      const addButton = this.createButton('現在の時間を追加', () => this.addTimestamp(Math.floor(this.video.currentTime)));
      this.repeatButton = this.createButton('A-Bリピート', () => this.toggleRepeatSetting());
      this.autoAddButton = this.createButton(`“★”コメントを自動追加 (${this.autoAddEnabled ? 'ON' : 'OFF'})`, () => this.toggleAutoAdd());

      const exportButton = this.createDropdownButton('エクスポート', [
        { label: 'タイムスタンプをコピー', action: () => this.exportTimestamps(false) },
        { label: 'タイムスタンプとメモをコピー', action: () => this.exportTimestamps(true) },
        { label: '共有URLをコピー', action: () => this.exportAsShareURL() },
        { label: '共有URLとタイトルをコピー', action: () => this.exportAsShareURLWithTitle() }
      ]);

      const importButton = this.createDropdownButton('インポート', [
        { label: 'インポートして追加', action: () => this.importTimestamps(false) },
        { label: 'インポートして置き換え', action: () => this.importTimestamps(true) }
      ]);

      const manageButton = this.createDropdownButton('管理', [
        { label: '全てのデータをバックアップ', action: () => this.backupData() },
        { label: 'バックアップからリストア', action: () => this.restoreData() },
        { label: 'デバッグ情報をコピー', action: () => this.copyDebugInfo() }
      ]);

      buttonContainer.append(addButton, exportButton, importButton, this.autoAddButton, this.repeatButton, manageButton);

      this.timestampsList = document.createElement('div');
      this.timestampsList.className = 'nicoplus-timeplus-list';

      const titleDescription = document.createElement('div');
      titleDescription.className = 'nicoplus-timeplus-title-description';
      const scriptName = GM_info.script.name;
      const scriptVersion = GM_info.script.version;
      titleDescription.innerHTML = `${scriptName} v${scriptVersion} <span class="nicoplus-timeplus-description">左クリックでジャンプ、右クリックでメニュー表示、マウスホイールで秒数調整。</span>`;

      controller.append(buttonContainer, this.timestampsList, titleDescription);
      this.wrapper.appendChild(controller);

      this.updateTimestamps();
      this.checkShareURL();
      if (this.autoAddEnabled) {
        this.startAutoAdd();
      }

      document.addEventListener('click', (e) => {
        if (!this.wrapper.contains(e.target) || !e.target.closest('.nicoplus-timeplus-dropdown-menu')) {
          this.closeActiveMenu();
        }
      });
    }

    createButton(text, onClick) {
      const button = document.createElement('button');
      button.textContent = text;
      button.onclick = onClick;
      return button;
    }

    createDropdownButton(text, options) {
      const container = document.createElement('div');
      container.className = 'nicoplus-timeplus-dropdown';

      const button = this.createButton(text, (e) => {
        e.stopPropagation();
        this.closeActiveMenu();
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        this.activeMenu = menu;
      });

      const menu = document.createElement('div');
      menu.className = 'nicoplus-timeplus-dropdown-menu';
      menu.style.display = 'none';

      options.forEach(option => {
        const item = document.createElement('div');
        item.textContent = option.label;
        item.onclick = (e) => {
          e.stopPropagation();
          option.action();
          this.closeActiveMenu();
        };
        menu.appendChild(item);
      });

      container.append(button, menu);
      return container;
    }

    closeActiveMenu() {
      if (this.activeMenu) {
        this.activeMenu.style.display = 'none';
        this.activeMenu = null;
      }
    }

    addTimestamp(time, memo = '') {
      if (isNaN(time)) {
        console.error('Invalid time value', time, memo);
        return;
      }

      const existingTimestamp = this.timestamps.find(t => (typeof t === 'object' ? t.time : t) === time);

      if (existingTimestamp) {
        if (typeof existingTimestamp === 'object') {
          if (!existingTimestamp.memo) {
            existingTimestamp.memo = memo;
          }
        } else {
          this.timestamps = this.timestamps.map(t => (t === time ? { time, memo: memo !== '' ? memo : null } : t));
        }
      } else {
        this.timestamps.push({ time, memo: memo !== '' ? memo : null });
        this.timestamps.sort((a, b) => (typeof a === 'object' ? a.time : a) - (typeof b === 'object' ? b.time : b));
      }

      this.saveTimestamps();
      this.updateTimestamps();
    }

    updateTimestamps() {
      this.timestampsList.innerHTML = '';
      this.timestamps.forEach((timestamp) => {
        const time = typeof timestamp === 'object' ? timestamp.time : timestamp;
        const memo = typeof timestamp === 'object' ? timestamp.memo : '';
        const button = document.createElement('button');
        button.textContent = `${this.formatTime(time)}${memo ? ` - ${memo}` : ''}`;
        button.className = 'nicoplus-timeplus-timestamp';

        if (time === this.aRepeat) {
          button.classList.add('a-repeat');
        } else if (time === this.bRepeat) {
          button.classList.add('b-repeat');
        }

        button.onclick = () => {
          if (this.repeatInterval) {
            this.stopRepeat();
            this.video.currentTime = time;
            this.video.play();
          } else if (this.isSettingRepeat) {
            this.setRepeatPoint(time, button);
          } else {
            this.video.currentTime = time;
            this.video.play();
          }
        };

        button.oncontextmenu = (e) => {
          e.preventDefault();
          this.showTimestampMenu(time, memo, button);
        };

        button.onwheel = (e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 1 : -1;
          let newTime = Math.max(0, time + delta);

          if (!this.timestamps.some(t => (typeof t === 'object' ? t.time : t) === newTime)) {
            this.updateTimestamp(time, newTime, memo);
          }
        };

        this.timestampsList.appendChild(button);
      });
    }

    updateTimestamp(oldTime, newTime, memo) {
      this.timestamps = this.timestamps.map(t =>
        (typeof t === 'object' ? t.time : t) === oldTime ? { time: newTime, memo } : t
      );
      this.timestamps.sort((a, b) => (typeof a === 'object' ? a.time : a) - (typeof b === 'object' ? b.time : b));
      this.saveTimestamps();
      this.updateRepeatRange(oldTime, newTime);
      this.updateTimestamps();
    }

    updateRepeatRange(oldTime, newTime) {
      if (this.aRepeat === oldTime) {
        this.aRepeat = newTime;
      } else if (this.bRepeat === oldTime) {
        this.bRepeat = newTime;
      }
      if (this.aRepeat !== null && this.bRepeat !== null) {
        if (this.aRepeat > this.bRepeat) {
          this.stopRepeat();
        } else {
          this.startRepeat();
        }
      }
    }

    showTimestampMenu(time, memo, button) {
      this.closeActiveMenu();
      const menu = document.createElement('div');
      menu.className = 'nicoplus-timeplus-dropdown-menu';
      menu.style.display = 'none';

      const editOption = document.createElement('div');
      editOption.textContent = 'メモ編集';
      editOption.onclick = () => {
        const newMemo = prompt('メモを入力してください:', memo);
        if (newMemo !== null) {
          this.timestamps = this.timestamps.map(t => (typeof t === 'object' ? t.time : t) === time ? { time, memo: newMemo } : t);
          this.saveTimestamps();
          this.updateTimestamps();
        }
        this.closeActiveMenu();
      };

      const deleteOption = document.createElement('div');
      deleteOption.textContent = '削除';
      deleteOption.onclick = () => {
        this.timestamps = this.timestamps.filter(t => (typeof t === 'object' ? t.time : t) !== time);
        this.saveTimestamps();
        this.updateTimestamps();
        this.closeActiveMenu();
      };

      menu.append(editOption, deleteOption);

      const rect = button.getBoundingClientRect();
      const controllerRect = this.wrapper.getBoundingClientRect();

      menu.style.position = 'absolute';
      menu.style.left = `${rect.left - controllerRect.left}px`;
      menu.style.top = `${rect.bottom - controllerRect.top}px`;

      this.wrapper.appendChild(menu);
      this.activeMenu = menu;
      this.activeMenu.style.display = 'block';
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
      return urlParts[urlParts.length - 1].split('?')[0];
    }

    exportTimestamps(includeMemo) {
      try {
        const exported = this.timestamps.map(t =>
          includeMemo ? `${this.formatTime(t.time)} - ${t.memo}` : this.formatTime(t.time)
        ).join(', ');
        GM_setClipboard(exported);
        alert('タイムスタンプをクリップボードにコピーしました。');
      } catch (err) {
        alert(`タイムスタンプのコピーに失敗しました: ${err}`);
      }
    }

    exportAsShareURL() {
      const videoId = this.getVideoId();
      const baseURL = location.origin + location.pathname;
      const encodedTimestamps = encodeURIComponent(JSON.stringify(this.timestamps));
      const shareURL = `${baseURL}?nicoplus_timeplus=${encodedTimestamps}`;
      GM_setClipboard(shareURL);
      alert('共有URLをクリップボードにコピーしました。');
    }

    exportAsShareURLWithTitle() {
      const videoId = this.getVideoId();
      const baseURL = location.origin + location.pathname;
      const encodedTimestamps = encodeURIComponent(JSON.stringify(this.timestamps));
      const shareURL = `${baseURL}?nicoplus_timeplus=${encodedTimestamps}`;
      const pageTitle = document.title;
      const content = `${pageTitle}\n${shareURL}`;
      GM_setClipboard(content);
      alert('共有URLとタイトルをクリップボードにコピーしました。');
    }

    importTimestamps(replace = false) {
      const input = prompt('カンマ、スペース、改行で区切ったタイムスタンプを入力してください:');
      if (input) {
        const newTimestamps = input.split(/[\s,]+/)
          .filter(Boolean)
          .map(t => {
            const [time, memo = ''] = t.split(' - ');
            const parts = time.split(':').reverse();
            const timeInSeconds = parts.reduce((acc, p, i) => acc + parseInt(p) * Math.pow(60, i), 0);
            return isNaN(timeInSeconds) ? null : { time: timeInSeconds, memo };
          })
          .filter(Boolean);

        if (replace) {
          this.timestamps = newTimestamps;
        } else {
          this.timestamps = [...this.timestamps, ...newTimestamps]
            .sort((a, b) => a.time - b.time)
            .filter((t, i, arr) => i === 0 || t.time !== arr[i - 1].time);
        }
        this.saveTimestamps();
        this.updateTimestamps();
      }
    }

    toggleRepeatSetting() {
      if (this.isSettingRepeat) {
        // リピート解除
        clearInterval(this.repeatInterval);
        this.isSettingRepeat = false;
        this.aRepeat = this.bRepeat = null;
        this.updateTimestamps();
        this.repeatButton.textContent = 'A-Bリピート';
      } else {
        // リピート設定開始
        this.isSettingRepeat = true;
        this.repeatButton.textContent = 'A-Bリピート (選択中)';
      }
    }

    setRepeatPoint(time, button) {
      if (this.aRepeat === null) {
        this.aRepeat = time;
        this.updateTimestamps();
      } else if (this.bRepeat === null && time > this.aRepeat) {
        this.bRepeat = time;
        this.updateTimestamps();
        this.startRepeat();
      }
    }

    startRepeat() {
      if (this.aRepeat !== null && this.bRepeat !== null) {
        this.repeatButton.textContent = 'A-Bリピート (解除する)';
        if (this.repeatInterval) {
          clearInterval(this.repeatInterval);
        }
        this.repeatInterval = setInterval(() => {
          if (this.video.currentTime >= this.bRepeat || this.video.currentTime < this.aRepeat) {
            this.video.currentTime = this.aRepeat;
            this.video.play();
          }
        }, 100);
      }
    }

    stopRepeat() {
      this.isSettingRepeat = false;
      this.aRepeat = this.bRepeat = null;
      clearInterval(this.repeatInterval);
      this.repeatInterval = null;
      this.updateTimestamps();
      this.repeatButton.textContent = 'A-Bリピート';
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

    toggleAutoAdd() {
      this.autoAddEnabled = !this.autoAddEnabled;
      localStorage.setItem(AUTO_ADD_ENABLED_KEY, this.autoAddEnabled);
      this.autoAddButton.textContent = `“★”コメントを自動追加 (${this.autoAddEnabled ? 'ON' : 'OFF'})`;
      if (this.autoAddEnabled) {
        this.startAutoAdd();
      } else {
        this.stopAutoAdd();
      }
    }

    startAutoAdd() {
      if (this.autoAddInterval) {
        clearInterval(this.autoAddInterval);
      }
      this.autoAddInterval = setInterval(() => {
        const commentContainer = document.querySelector('#video-page-wrapper + .MuiBox-root > .show');
        if (commentContainer) {
          const comments = commentContainer.querySelectorAll('div');
          comments.forEach(comment => {
            const timeElement = comment.querySelector('.MuiTypography-caption');
            const contentElement = comment.querySelector('.MuiTypography-body2');
            if (timeElement && contentElement) {
              const content = contentElement.textContent;
              if (content.includes('★')) {
                const time = Math.max(0, this.parseTime(timeElement.textContent) - 1);
                this.addTimestamp(time, content);
              }
            }
          });
        }
      }, 1000);
    }

    stopAutoAdd() {
      clearInterval(this.autoAddInterval);
      this.autoAddInterval = null;
    }

    parseTime(timeString) {
      const parts = timeString.split(':').map(Number);
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      return 0;
    }

    checkShareURL() {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedTimestamps = urlParams.get('nicoplus_timeplus');
      if (sharedTimestamps) {
        try {
          const decodedTimestamps = JSON.parse(decodeURIComponent(sharedTimestamps));
          if (confirm('共有URLからタイムスタンプをインポートしますか？')) {
            this.timestamps = [...this.timestamps, ...decodedTimestamps]
              .sort((a, b) => (typeof a === 'object' ? a.time : a) - (typeof b === 'object' ? b.time : b))
              .filter((t, i, arr) => i === 0 || (typeof t === 'object' ? t.time : t) !== (typeof arr[i - 1] === 'object' ? arr[i - 1].time : arr[i - 1]));
            this.saveTimestamps();
            this.updateTimestamps();
          }
        } catch (err) {
          console.error('共有URLの解析に失敗しました:', err);
        }
        // URLからパラメータを削除
        const newUrl = window.location.href.split('?')[0];
        window.history.replaceState({}, document.title, newUrl);
      }
    }


    copyDebugInfo() {
      const debugInfo = {
        version: GM_info.script.version,
        url: window.location.href,
        videoId: this.getVideoId(),
        timestamps: this.timestamps,
        aRepeat: this.aRepeat,
        bRepeat: this.bRepeat,
        repeatInterval: this.repeatInterval,
        isSettingRepeat: this.isSettingRepeat,
        autoAddEnabled: this.autoAddEnabled,
        activeMenu: this.activeMenu,
        userAgent: navigator.userAgent,
        dateTime: new Date().toISOString()
      };
      GM_setClipboard(JSON.stringify(debugInfo, null, 2));
      alert('デバッグ情報をクリップボードにコピーしました。');
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
      if (wrapper.querySelector('.nicoplus-timeplus-controller')) {
        console.log('nicoplus_timeplus UI already exists. Skipping initialization.');
        return;
      }
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
    .nicoplus-timeplus-dropdown {
      position: relative;
      display: inline-block;
    }
    .nicoplus-timeplus-dropdown-menu {
      position: absolute;
      z-index: 10000;
      background-color: #f9f9f9;
      min-width: 200px;
      box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
      padding: 6px 0px;
      font-size: 13px;
    }
    .nicoplus-timeplus-dropdown-menu div {
      padding: 6px 6px;
      cursor: pointer;
    }
    .nicoplus-timeplus-dropdown-menu div:hover {
      background-color: #f1f1f1;
    }
    .nicoplus-timeplus-timestamp.a-repeat,
    .nicoplus-timeplus-timestamp.b-repeat {
      background-color: yellow;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);
})();
