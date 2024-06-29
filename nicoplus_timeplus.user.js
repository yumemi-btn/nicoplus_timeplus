// ==UserScript==
// @name         nicoplus_timeplus
// @namespace    https://github.com/yourusername/nicoplus_timeplus
// @version      0.1
// @description  ニコニコチャンネルプラスにおいて、タイムスタンプの保存を可能にするUserJSです
// @author       Your GitHub Username
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

      buttonContainer.append(addButton, exportButton, importButton, importReplaceButton);

      this.timestampsList = document.createElement('div');
      this.timestampsList.className = 'nicoplus-timeplus-list';

      const titleDescription = document.createElement('div');
      titleDescription.className = 'nicoplus-timeplus-title-description';
      const scriptName = GM_info.script.name;
      const scriptVersion = GM_info.script.version;
      titleDescription.innerHTML = `${scriptName} v${scriptVersion} <span class="nicoplus-timeplus-description">左クリックでジャンプ、右クリックで削除、マウスホイールで秒数調整</span>`;

      controller.append(buttonContainer, this.timestampsList, titleDescription);
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
          this.video.currentTime = time;
          this.video.play();
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
    }
    .nicoplus-timeplus-button-container button,
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
  `;
  document.head.appendChild(style);
})();
