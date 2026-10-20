
const map = L.map("map").setView([34.6853, 135.8050], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const shelterIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const shelterLayerGroup = L.layerGroup().addTo(map);
let currentMarker = null;
let routeLayer = null;

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function getLocation() {
  const result = document.getElementById("result");

  if (!navigator.geolocation) {
    result.textContent = "このブラウザは位置情報に対応していません。";
    return;
  }

  result.textContent = "現在地を取得中...";

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      result.textContent =
        `現在地：緯度 ${lat.toFixed(4)}、経度 ${lng.toFixed(4)}`;

      map.setView([lat, lng], 15);

      if (currentMarker) map.removeLayer(currentMarker);

      currentMarker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup("<b>あなたの現在地</b>")
        .openPopup();

      loadAndDisplayShelterCSV();
    },
    () => {
      result.textContent =
        "現在地を取得できませんでした。位置情報の許可を確認してください。";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function loadAndDisplayShelterCSV() {
  fetch("29000_1.csv")
    .then(response => {
      if (!response.ok) throw new Error("CSVを読み込めませんでした。");
      return response.text();
    })
    .then(csvText => {
      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error("CSVデータが空です。");

      const headers = parseCSVLine(lines[0]);

      const nameIdx = headers.indexOf("名称") !== -1
        ? headers.indexOf("名称") : headers.indexOf("施設名称");
      const latIdx = headers.indexOf("緯度") !== -1
        ? headers.indexOf("緯度") : headers.indexOf("lat");
      const lngIdx = headers.indexOf("経度") !== -1
        ? headers.indexOf("経度") : headers.indexOf("lng");
      const addressIdx = headers.indexOf("所在地_連結表記") !== -1
        ? headers.indexOf("所在地_連結表記") : headers.indexOf("住所");

      if (latIdx === -1 || lngIdx === -1) {
        throw new Error("CSVの緯度・経度の列を確認してください。");
      }

      const tableBody = document.querySelector("#shelter-table tbody");
      tableBody.innerHTML = "";
      shelterLayerGroup.clearLayers();

      let count = 0;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;

        const row = parseCSVLine(lines[i]);
        const lat = parseFloat(row[latIdx]);
        const lng = parseFloat(row[lngIdx]);

        const name = nameIdx !== -1 ? row[nameIdx] || "避難所" : "避難所";
        const address = addressIdx !== -1 ? row[addressIdx] || "" : "";

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const marker = L.marker([lat, lng], { icon: shelterIcon })
          .addTo(shelterLayerGroup);

        const popup = document.createElement("div");
        const title = document.createElement("b");
        title.textContent = name;

        const addressText = document.createElement("p");
        addressText.textContent = address;

        const routeButton = document.createElement("button");
        routeButton.textContent = "ここへのルートを表示";
        routeButton.onclick = () => showRoute(lat, lng, name);

        popup.append(title, addressText, routeButton);
        marker.bindPopup(popup);

        [name, address, lat, lng].forEach(value => {
          const td = document.createElement("td");
          td.textContent = value;
          if (!td.parentElement) {
            // 行は下で作成します
          }
        });

        const tr = document.createElement("tr");
        [name, address, lat, lng].forEach(value => {
          const td = document.createElement("td");
          td.textContent = value;
          tr.appendChild(td);
        });

        tableBody.appendChild(tr);
        count++;
      }

      document.getElementById("csv-section").hidden = false;

      if (count === 0) {
        document.getElementById("result").textContent =
          "有効な避難所データがありません。CSVの列名を確認してください。";
      }
    })
    .catch(error => {
      console.error("CSVエラー:", error);
      alert("CSVの読み込みに失敗しました。ファイル名と列名を確認してください。");
    });
}

async function showRoute(lat, lng, name) {
  if (!currentMarker) {
    alert("先に現在地を取得してください。");
    return;
  }

  const start = currentMarker.getLatLng();
  const result = document.getElementById("result");
  result.textContent = "ルートを検索しています...";

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start.lng},${start.lat};${lng},${lat}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("通信エラー");

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes.length) {
      throw new Error("ルートが見つかりません");
    }

    const route = data.routes[0];
    if (routeLayer) map.removeLayer(routeLayer);

    routeLayer = L.geoJSON(route.geometry, {
      style: { color: "blue", weight: 6, opacity: 0.8 }
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });

    result.textContent =
      `${name}までのルート：${(route.distance / 1000).toFixed(2)} km、約${Math.ceil(route.duration / 60)}分（自動車用）`;
  } catch (error) {
    console.error("ルート検索エラー:", error);
    result.textContent =
      "ルートを取得できませんでした。時間をおいて再試行してください。";
  }
}

const questions = [
  "自宅や学校の近くにある避難場所を知っていますか？",
  "避難場所までの行き方を確認していますか？",
  "自宅周辺のハザードマップを確認していますか？",
  "災害時に家族と連絡を取る方法を決めていますか？",
  "飲料水や食料などの備蓄を用意していますか？",
  "懐中電灯や予備の電池を用意していますか？",
  "非常時に持ち出す物をまとめていますか？",
  "地震や大雨などの災害情報を確認する方法を知っていますか？",
  "災害時にどこへ避難するか考えていますか？",
  "避難する際の危険な場所や道を確認していますか？"
];

const choices = [
  { text: "十分にできている", score: 10 },
  { text: "ある程度できている", score: 7 },
  { text: "あまりできていない", score: 3 },
  { text: "まだできていない・わからない", score: 0 }
];

let questionIndex = 0;
let totalScore = 0;

function showQuestion() {
  document.getElementById("quiz-progress").textContent =
    `第${questionIndex + 1}問 / 全${questions.length}問`;

  const questionArea = document.getElementById("quiz-question");
  const choicesArea = document.getElementById("quiz-choices");

  questionArea.textContent = "";
  choicesArea.textContent = "";

  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = questions[questionIndex];
  fieldset.appendChild(legend);

  choices.forEach(choice => {
    const label = document.createElement("label");
    label.className = "choice";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "quiz-answer";
    radio.value = choice.score;

    label.append(radio, document.createTextNode(" " + choice.text));
    fieldset.appendChild(label);
  });

  questionArea.appendChild(fieldset);
  document.getElementById("quiz-message").textContent = "";
  document.getElementById("quiz-next").style.display = "inline-block";
  document.getElementById("quiz-next").textContent =
    questionIndex === questions.length - 1 ? "結果を見る" : "決定して次へ";
}

function nextQuestion() {
  const selected = document.querySelector('input[name="quiz-answer"]:checked');

  if (!selected) {
    document.getElementById("quiz-message").textContent =
      "選択肢を1つ選んでください。";
    return;
  }

  totalScore += Number(selected.value);
  questionIndex++;

  if (questionIndex < questions.length) {
    showQuestion();
  } else {
    showQuizResult();
  }
}

function showQuizResult() {
  document.getElementById("quiz-progress").textContent =
    "全10問の回答が完了しました。";
  document.getElementById("quiz-question").textContent = "";
  document.getElementById("quiz-choices").textContent = "";
  document.getElementById("quiz-message").textContent = "";
  document.getElementById("quiz-next").style.display = "none";
  document.getElementById("quiz-finish").hidden = false;

  document.getElementById("quiz-result").textContent =
    `あなたの防災準備スコア：${totalScore} / 100点`;

  let comment = "";

  if (totalScore >= 80) {
    comment = "多くの項目で準備ができています。定期的に備蓄や避難経路を見直しましょう。";
  } else if (totalScore >= 50) {
    comment = "準備できている項目もあります。点数が低かった項目を少しずつ確認しましょう。";
  } else {
    comment = "これから準備できることがありそうです。まずは近くの避難場所や災害情報の確認から始めましょう。";
  }

  document.getElementById("quiz-comment").textContent =
    comment + " この点数は独自の目安であり、公式な判定ではありません。";
}

function restartQuiz() {
  questionIndex = 0;
  totalScore = 0;
  document.getElementById("quiz-finish").hidden = true;
  showQuestion();
}

showQuestion();
