/* =========================
  現在地を取得してマップ上に表示するデモ
  - importLibrary を使った最新のGoogle Maps API仕様対応
========================= */
(async () => {
  // Cloud Consoleで発行したMap ID
  const MAP_ID = "YOUR_MAP_ID";

  // 各要素の参照を取得
  const mapEl = document.getElementById("map");
  const statusEl = document.getElementById("status");
  const btnEl = document.getElementById("btn");

  try {
    // 必要なライブラリを読み込み（importLibraryは2025年現在の最新の書き方）
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    /* =========================
      地図の初期設定
      - 東京駅を中心に地図を生成
      - 不要なUIは非表示にしてシンプルに
    ========================= */
    const map = new Map(mapEl, {
      zoom: 15,
      center: { lat: 35.681236, lng: 139.767125 },
      mapId: MAP_ID,
      zoomControl: true, // ズームボタン（+ / -）を表示
      cameraControl: false, // 新UI（上下左右のカメラ移動）を非表示
      mapTypeControl: false, // 地図 / 航空写真の切替を非表示
      scaleControl: false, // 縮尺バー（1kmスケールなど）を非表示
      streetViewControl: false, // ストリートビューアイコン（人型）を非表示
      clickableIcons: false // ランドマークや建物クリック時の吹き出しを無効化
    });

    // 現在地マーカーの参照用（初回以降の更新に使う）
    let userMarker = null; // AdvancedMarkerElement

    /* =========================
      「現在地へ移動」ボタンのクリック処理
    ========================= */
    btnEl.addEventListener("click", () => {
      // このブラウザが Geolocation API（位置情報を取得する機能）に対応しているかを確認
      // 対応していない場合は、この時点で処理を終了
      if (!("geolocation" in navigator)) {
        statusEl.textContent = "このブラウザは位置情報に対応していません。";
        return;
      }

      btnEl.disabled = true; // 二重クリック防止
      statusEl.textContent = "現在地を取得しています…";

      /* =========================
        位置情報の取得処理
        - 成功時：マップを現在地に移動＋マーカー設置
        - 失敗時：エラー内容を表示
      ========================= */
      navigator.geolocation.getCurrentPosition(
        // 成功時
        (pos) => {
          const { latitude, longitude } = pos.coords;

          // 地図を現在地へ移動・ズーム
          map.panTo({ lat: latitude, lng: longitude });
          map.setZoom(15);

          // 一度押した後に再度ボタンを押した場合、前回のマーカーを消してから新しいマーカーを追加
          if (userMarker) userMarker.map = null;

          // 現在地ドットを作成して配置
          const dot = document.createElement("div");
          dot.className = "my-location-dot";

          // AdvancedMarkerElement: 地図上に表示するマーカーを作る機能。
          // HTMLで見た目を自由にカスタマイズできる。
          userMarker = new AdvancedMarkerElement({
            map, // 表示する対象の地図オブジェクト
            position: { lat: latitude, lng: longitude }, // マーカーを置く緯度経度（= 現在地）
            content: dot, // カスタムマーカーの中身（HTML要素）
            collisionBehavior: google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY,
            // 重なり時の表示優先度：他のラベル等よりこのマーカーを優先表示
          });

          // 緯度経度を小数点6桁で表示
          statusEl.innerHTML = `<strong class="is-success">取得成功：</strong>緯度 ${latitude.toFixed(6)}、経度 ${longitude.toFixed(6)}`;
          btnEl.disabled = false;
        },

        // 失敗時
        (err) => {
          let message = "";

          // エラーコードごとにメッセージを出し分け
          if (err.code === err.PERMISSION_DENIED) {
            message = "位置情報の利用が拒否されました。ブラウザの設定で許可してください。";
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = "位置情報を取得できませんでした（信号なし/機内モードなど）。";
          } else if (err.code === err.TIMEOUT) {
            message = "タイムアウトしました。電波状況を確認して再試行してください。";
          } else {
            message = "不明なエラーが発生しました。";
          }

          // 取得失敗メッセージを表示
          statusEl.innerHTML = `<strong class="is-error">取得失敗：</strong>${message}`;
          btnEl.disabled = false;
        },

        // 取得オプション：できるだけ高精度で現在地を取得（最大10秒待ち、キャッシュは使わない）
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

  } catch (e) {
    // Maps APIの読み込みエラーなど
    statusEl.textContent = "Googleマップの読み込みに失敗しました。";
  }
})();