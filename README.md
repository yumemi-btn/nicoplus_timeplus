# nicoplus_timeplus

nicoplus_timeplusは、ニコニコチャンネルプラスでタイムスタンプの保存を可能にするUserScriptです。

![image](https://github.com/yumemi-btn/nicoplus_timeplus/assets/64613246/94a4af9f-2a33-4a81-af33-9597ffeb84a5)


## インストール手順

1. **Tampermonkeyのインストール**
   - まず、お使いのブラウザにTampermonkeyをインストールする必要があります。
   - [Chrome用Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox用Tampermonkey](https://addons.mozilla.org/ja/firefox/addon/tampermonkey/)

2. **UserScriptのインストール**
   - Tampermonkeyをインストールしたら、以下のリンクをクリックしてください：  
     [nicoplus_timeplus.user.js](https://github.com/yumemi-btn/nicoplus_timeplus/raw/main/nicoplus_timeplus.user.js)
   - インストール確認画面が表示されるので、「インストール」をクリックしてください。

3. **使用開始**
   - インストールが完了したら、ニコニコチャンネルプラスの動画ページを開いてください。
   - 動画プレーヤーの下に新しいコントロールパネルが表示されます。

> [!TIP]
> Chromeで正常に動作しない場合、`chrome://extensions/` を開き、右上「デベロッパーモード」の有効化をお試しください。(原因不明)

## 使い方

- **タイムスタンプの追加**: 「現在の時間を追加」ボタンをクリックすると、現在の再生時間がタイムスタンプとして保存されます、
- **タイムスタンプの利用**: 保存されたタイムスタンプをクリックすると、その時間に動画がジャンプします。
- **メモの追加**: 右クリックメニューからタイムスタンプに「メモ」が追加できます。
- **共有URLのコピー**: エクスポートメニューから共有URLをコピーすると、現在のタイムスタンプとメモを他の人に共有できます。
- **★コメントの自動登録**: 「★」マーク付きのコメントが流れたら、自動的にタイムスタンプとして追加します。
- **A-Bリピート**: 指定した2つのタイムスタンプ間をループ再生できます。
- **データのバックアップ/リストア**: 全ての保存データをバックアップおよびリストアできます。

詳細な使用方法については、実際に使用しながら探索してみてください。

> [!WARNING]
> タイムスタンプは手元のブラウザに保存され、異なる端末には共有されません。  
> 不意に消失する可能性もありますので、定期的なバックアップ取得をお願いします！

## 注意事項

- このスクリプトは、ニコニコチャンネルプラスのウェブサイト（`https://nicochannel.jp/*`）でのみ動作します。
- ブラウザやTampermonkeyのバージョンによっては、動作が異なる場合があります。

## 問題が発生した場合

問題や提案がある場合は、[GitHubのIssueページ](https://github.com/yumemi-btn/nicoplus_timeplus/issues) または [制作者のX](https://x.com/infinite_chain) に報告してください。
