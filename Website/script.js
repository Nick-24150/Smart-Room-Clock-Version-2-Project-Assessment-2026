// ============================================================
// SMART ROOM CLOCK WEB INTERFACE
// ============================================================
// This version uses demo sensor data so the website can be
// tested before connecting it to the ESP32.
// Later, replace getSensorData() with fetch() calls to your ESP32.
// ============================================================

const STORAGE_KEY = "smartRoomClockSettings";

const defaultSettings = {
  background: "#ffffff",
  text: "#111827",
  brightness: "auto",
  espAddress: "",
  alarms: [
    { id: 1, name: "Alarm 1", time: "06:30", days: ["Mon","Tue","Wed","Thu","Fri"], enabled: false },
    { id: 2, name: "Alarm 2", time: "07:30", days: ["Mon","Tue","Wed","Thu","Fri"], enabled: false },
    { id: 3, name: "Alarm 3", time: "08:00", days: ["Sat","Sun"], enabled: false }
  ]
};

function getSettings() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultSettings);

  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultSettings),
      ...parsed,
      alarms: Array.isArray(parsed.alarms) ? parsed.alarms : structuredClone(defaultSettings.alarms)
    };
  } catch {
    return structuredClone(defaultSettings);
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  applySettings();
}

function applySettings() {
  const s = getSettings();

  // Brightness is intentionally a WEBSITE setting only.
  // The clock background/text colours below are sent to the ESP32 instead.
  if (s.brightness === "dark") {
    document.documentElement.setAttribute("data-brightness", "dark");
  } else if (s.brightness === "medium") {
    document.documentElement.setAttribute("data-brightness", "medium");
  } else {
    document.documentElement.setAttribute("data-brightness", "auto");
  }
}

// Send the clock display settings to the ESP32.
// The ESP32 will be responsible for applying these colours to the TFT.
async function sendDisplaySettingsToESP32(settings) {
  if (!settings.espAddress) {
    return { ok: false, message: "No ESP32 address has been saved." };
  }

  try {
    const response = await fetch(`${settings.espAddress.replace(/\/$/, "")}/api/display-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        background: settings.background,
        text: settings.text
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { ok: true, message: "Clock display settings sent to the ESP32." };
  } catch (error) {
    return {
      ok: false,
      message: "Could not contact the ESP32. Check the address and Wi-Fi connection."
    };
  }
}

// -------------------------
// Clock
// -------------------------
function updateClock() {
  const now = new Date();

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const date = now.toLocaleDateString([], {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const timeElement = document.getElementById("timeDisplay");
  const dateElement = document.getElementById("dateDisplay");

  if (timeElement) timeElement.textContent = time;
  if (dateElement) dateElement.textContent = date;
}

// -------------------------
// Demo sensor system
// -------------------------
let sensorState = {
  light: 650,
  temperature: 21.5,
  humidity: 60
};

function getSensorData() {
  // Simulate slowly changing sensor readings.
  sensorState.light += (Math.random() - 0.5) * 80;
  sensorState.temperature += (Math.random() - 0.5) * 0.3;
  sensorState.humidity += (Math.random() - 0.5) * 1.2;

  sensorState.light = Math.max(0, Math.min(1000, sensorState.light));
  sensorState.temperature = Math.max(5, Math.min(40, sensorState.temperature));
  sensorState.humidity = Math.max(20, Math.min(90, sensorState.humidity));

  return {
    light: Math.round(sensorState.light),
    temperature: Number(sensorState.temperature.toFixed(1)),
    humidity: Math.round(sensorState.humidity)
  };
}

function getLightMode(light) {
  if (light < 300) return "DARK";
  if (light <= 700) return "MEDIUM";
  return "BRIGHT";
}

function getComfort(temp) {
  if (temp < 12) return "COLD";
  if (temp < 18) return "COOL";
  if (temp < 24) return "COMFORTABLE";
  if (temp < 30) return "WARM";
  return "HOT";
}

// -------------------------
// Simple line chart
// -------------------------
const lightHistory = [];
const tempHistory = [];

function drawLineChart(canvas, values, minValue, maxValue, unit) {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  // Grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e5e7eb";

  for (let i = 0; i <= 4; i++) {
    const y = 10 + (height - 25) * i / 4;
    ctx.beginPath();
    ctx.moveTo(35, y);
    ctx.lineTo(width - 8, y);
    ctx.stroke();
  }

  if (values.length < 2) return;

  const chartWidth = width - 45;
  const chartHeight = height - 35;

  ctx.beginPath();

  values.forEach((value, index) => {
    const x = 35 + (chartWidth * index / (values.length - 1));
    const ratio = (value - minValue) / (maxValue - minValue);
    const y = 10 + chartHeight - ratio * chartHeight;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#2563eb";
  ctx.stroke();

  // Current value marker
  const last = values[values.length - 1];
  const ratio = (last - minValue) / (maxValue - minValue);
  const x = width - 10;
  const y = 10 + chartHeight - ratio * chartHeight;

  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();

  // Labels
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px Arial";
  ctx.fillText(maxValue + unit, 4, 12);
  ctx.fillText(minValue + unit, 4, height - 10);
}

function updateDashboardSensors() {
  const data = getSensorData();

  lightHistory.push(data.light);
  tempHistory.push(data.temperature);

  if (lightHistory.length > 30) lightHistory.shift();
  if (tempHistory.length > 30) tempHistory.shift();

  const lightValue = document.getElementById("lightValue");
  const lightMode = document.getElementById("lightMode");
  const tempValue = document.getElementById("tempValue");
  const comfortMode = document.getElementById("comfortMode");
  const humidityValue = document.getElementById("humidityValue");
  const humidityFill = document.getElementById("humidityFill");

  if (lightValue) lightValue.textContent = data.light;
  if (lightMode) lightMode.textContent = getLightMode(data.light);

  if (tempValue) tempValue.textContent = `${data.temperature}°C`;
  if (comfortMode) comfortMode.textContent = getComfort(data.temperature);

  if (humidityValue) humidityValue.textContent = `${data.humidity}%`;
  if (humidityFill) humidityFill.style.width = `${data.humidity}%`;

  drawLineChart(
    document.getElementById("lightChart"),
    lightHistory,
    0,
    1000,
    ""
  );

  drawLineChart(
    document.getElementById("tempChart"),
    tempHistory,
    0,
    40,
    "°"
  );
}

// -------------------------
// Alarms
// -------------------------
function renderDashboardAlarms() {
  const container = document.getElementById("dashboardAlarms");
  if (!container) return;

  const settings = getSettings();
  container.innerHTML = "";

  settings.alarms.forEach(alarm => {
    const item = document.createElement("div");
    item.className = "alarm-item";

    item.innerHTML = `
      <div>
        <strong>${escapeHTML(alarm.name)}</strong>
        <small>${alarm.time} • ${alarm.days.length ? alarm.days.join(", ") : "No days selected"}</small>
      </div>
      <label class="toggle">
        <input type="checkbox" ${alarm.enabled ? "checked" : ""}
          onchange="toggleAlarm(${alarm.id}, this.checked)">
        <span class="slider"></span>
      </label>
    `;

    container.appendChild(item);
  });
}

function toggleAlarm(id, enabled) {
  const settings = getSettings();
  const alarm = settings.alarms.find(a => a.id === id);

  if (alarm) {
    alarm.enabled = enabled;
    saveSettings(settings);
  }
}

function renderSettingsAlarms() {
  const container = document.getElementById("settingsAlarmList");
  if (!container) return;

  const settings = getSettings();
  container.innerHTML = "";

  settings.alarms.forEach(alarm => {
    const item = document.createElement("div");
    item.className = "alarm-item";

    item.innerHTML = `
      <div>
        <strong>${escapeHTML(alarm.name)}</strong>
        <small>${alarm.time} • ${alarm.days.length ? alarm.days.join(", ") : "No days selected"}</small>
      </div>

      <label class="toggle">
        <input type="checkbox" ${alarm.enabled ? "checked" : ""}
          onchange="toggleAlarm(${alarm.id}, this.checked); renderSettingsAlarms()">
        <span class="slider"></span>
      </label>

      <div>
        <button class="secondary-button" onclick="editAlarm(${alarm.id})">Edit</button>
        <button class="danger-button" onclick="deleteAlarm(${alarm.id})">Delete</button>
      </div>
    `;

    container.appendChild(item);
  });
}

function editAlarm(id) {
  const settings = getSettings();
  const alarm = settings.alarms.find(a => a.id === id);
  if (!alarm) return;

  document.getElementById("editingAlarmId").value = alarm.id;
  document.getElementById("alarmName").value = alarm.name;
  document.getElementById("alarmTime").value = alarm.time;

  const select = document.getElementById("alarmDays");
  [...select.options].forEach(option => {
    option.selected = alarm.days.includes(option.value);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteAlarm(id) {
  const settings = getSettings();

  if (settings.alarms.length <= 1) {
    alert("Keep at least one alarm.");
    return;
  }

  settings.alarms = settings.alarms.filter(a => a.id !== id);
  saveSettings(settings);
  renderSettingsAlarms();
  renderDashboardAlarms();
}

function resetAlarmForm() {
  document.getElementById("editingAlarmId").value = "";
  document.getElementById("alarmName").value = "";
  document.getElementById("alarmTime").value = "";

  [...document.getElementById("alarmDays").options]
    .forEach(option => option.selected = false);
}

function handleAlarmForm(event) {
  event.preventDefault();

  const settings = getSettings();
  const id = document.getElementById("editingAlarmId").value;
  const name = document.getElementById("alarmName").value.trim();
  const time = document.getElementById("alarmTime").value;

  const days = [...document.getElementById("alarmDays").selectedOptions]
    .map(option => option.value);

  if (!name || !time) return;

  if (id) {
    const alarm = settings.alarms.find(a => a.id === Number(id));
    if (alarm) {
      alarm.name = name;
      alarm.time = time;
      alarm.days = days;
    }
  } else {
    settings.alarms.push({
      id: Date.now(),
      name,
      time,
      days,
      enabled: false
    });
  }

  saveSettings(settings);
  resetAlarmForm();
  renderSettingsAlarms();
}

async function saveDisplaySettings() {
  const settings = getSettings();

  // These colours belong to the PHYSICAL ESP32 TFT, not the webpage.
  settings.background = document.getElementById("backgroundColor").value;
  settings.text = document.getElementById("textColor").value;

  const selected = document.querySelector('input[name="brightness"]:checked');
  settings.brightness = selected ? selected.value : "auto";

  saveSettings(settings);

  const result = await sendDisplaySettingsToESP32(settings);
  const message = document.getElementById("displayMessage");

  if (message) {
    message.textContent = result.ok
      ? result.message
      : `${result.message} The settings are still saved in the browser and can be sent later.`;
  }
}

function loadDisplaySettings() {
  const settings = getSettings();

  document.getElementById("backgroundColor").value = settings.background;
  document.getElementById("textColor").value = settings.text;

  const radio = document.querySelector(
    `input[name="brightness"][value="${settings.brightness}"]`
  );

  if (radio) radio.checked = true;
}

function saveESPAddress() {
  const settings = getSettings();
  settings.espAddress = document.getElementById("espAddress").value.trim();
  saveSettings(settings);

  document.getElementById("espMessage").textContent =
    "ESP32 address saved. API communication can be connected here later.";
}

// -------------------------
// ESP32 integration example
// -------------------------
// Once your ESP32 web server is ready, you can replace demo data with:
//
// async function getSensorData() {
//   const response = await fetch("http://YOUR-ESP32-IP/api/sensors");
//   return await response.json();
// }
//
// Expected response:
// {
//   "light": 650,
//   "temperature": 21.5,
//   "humidity": 60
// }
//
// You can also send an alarm to the ESP32:
//
// fetch("http://YOUR-ESP32-IP/api/alarm", {
//   method: "POST",
//   headers: {"Content-Type": "application/json"},
//   body: JSON.stringify({time: "06:30", enabled: true})
// });

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// -------------------------
// Page initialisation
// -------------------------
function initDashboard() {
  applySettings();
  updateClock();
  renderDashboardAlarms();
  updateDashboardSensors();

  setInterval(updateClock, 1000);
  setInterval(updateDashboardSensors, 2000);

  window.addEventListener("resize", () => {
    drawLineChart(document.getElementById("lightChart"), lightHistory, 0, 1000, "");
    drawLineChart(document.getElementById("tempChart"), tempHistory, 0, 40, "°");
  });
}

function initSettings() {
  applySettings();
  loadDisplaySettings();
  renderSettingsAlarms();

  const settings = getSettings();
  document.getElementById("espAddress").value = settings.espAddress;

  document.getElementById("alarmForm")
    .addEventListener("submit", handleAlarmForm);
}

applySettings();
