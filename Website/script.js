//Create variables for when the websocket is setup
var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
const MAX_CHART_READINGS = 8;

//Listen for the window loading (or reloading) and call the below method
window.addEventListener("load", onload);

//When the window loads, call the method below to setup the web socket
function onload(event) {
    initWebSocket();
}

//Setup the websocket and what to do with various common communications
function initWebSocket() {
    console.log("Trying to open a WebSocket connection…");
    websocket = new WebSocket(gateway);
    websocket.onopen = onOpen;
    websocket.onclose = onClose;
    websocket.onmessage = onMessage;
}

//If the websocket opens give a confirmation message to the console for debugging
function onOpen(event) {
    console.log("WebSocket opened");
    getStates();
}

//If the websocket closes wait 2 seconds and reopen it
function onClose(event) {
    console.log("WebSocket closed");
    setTimeout(initWebSocket, 2000);
}

//save the values sent from the webserver/esp in a JSON format and update the dashboard page with the values
function onMessage(event) {
    var message;

    try {
        message = JSON.parse(event.data);
    } catch (error) {
        console.error("WebSocket sent invalid JSON:", error);
        return;
    }

    if (!message || !Array.isArray(message.values)) {
        console.warn("Unexpected WebSocket data format:", message);
        return;
    }

    // Extract values from the message and parse them as needed
    const values = message.values;
    const temperature = parseSensorNumber(values[0]?.tempValue);
    const comfortMode = values[1]?.comfortMode;
    const humidity = parseSensorNumber(values[2]?.humidValue);
    const lightLevel = parseSensorNumber(values[3]?.lightValue);
    const lightMode = values[3]?.lightMode;
    const alarmTime = values[4]?.alarmValue;
    const dateValue = values[5]?.dateValue;
    const timeValue = values[5]?.timeValue;
    const label = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    // Update the dashboard elements with the received values
    setDashboardText("lightMode", getLightModeLabel(lightMode));
    setDashboardText("comfortMode", comfortMode ?? "N/A");
    setDashboardText("lightValue", Number.isFinite(lightLevel) ? lightLevel.toFixed(0) : "N/A");
    setDashboardText("tempValue", Number.isFinite(temperature) ? `${temperature.toFixed(1)}°C` : "N/A");
    setDashboardText("humidityValue", Number.isFinite(humidity) ? `${humidity.toFixed(1)}%` : "N/A");
    setDashboardText("dateDisplay", dateValue ?? "--");
    setDashboardText("timeDisplay", timeValue ?? "--:--");
    setDashboardText("alarmDashboard", alarmTime ?? "N/A");

    // Update the humidity bar fill based on the received humidity value
    const humidityFill = document.getElementById("humidityFill");
    if (humidityFill && Number.isFinite(humidity)) {
        const percentage = Math.max(0, Math.min(100, humidity));
        humidityFill.style.width = `${percentage}%`;
        humidityFill.setAttribute("aria-valuenow", String(percentage));
    }

    // Add the new readings to the respective charts
    addChartReading(lightChart, lightLevel, label);
    addChartReading(tempChart, temperature, label);
}

// Helper function to parse sensor values safely
function parseSensorNumber(value) {
    if (value === null || value === undefined || value === "") {
        return NaN;
    }

    const number = typeof value === "string"
        ? Number.parseFloat(value.trim())
        : Number(value);
    return Number.isFinite(number) ? number : NaN;
}

// Update the text content of a dashboard element by its ID
function setDashboardText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = String(value);
    }
}

// Convert light mode value to a human-readable label
function getLightModeLabel(mode) {
    if (mode === "0") return "Dark";
    if (mode === "1") return "Medium";
    if (mode === "2") return "Bright";
    return mode ?? "N/A";
}

// Add a new reading to the specified chart, maintaining a maximum number of readings
function addChartReading(chart, value, label) {
    if (!chart || !Number.isFinite(value)) {
        return;
    }

    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(value);

    while (chart.data.labels.length > MAX_CHART_READINGS) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update("none");
}



// Line Chart for Light Level
const lightCanvas = document.getElementById("lightChart");
const lightChart = new Chart(lightCanvas, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "Light Level (0–4095)",
            data: [],

            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.15)",

            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.25
        }]
    },

    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,

        layout: {
            padding: {
                top: 5,
                right: 8,
                bottom: 0,
                left: 0
            }
        },

        plugins: {
            legend: {
                display: true,
                position: "top"
            }
        },

        scales: {
            x: {
                title: {
                    display: true,
                    text: "Time"
                },

                ticks: {
                    maxTicksLimit: 6,
                    maxRotation: 0
                },

                grid: {
                    display: false
                }
            },

            y: {
                type: 'linear',
                min: 0,
                max: 4095,
                bounds: 'ticks',

                ticks: {
                    min: 0,
                    max: 4095,
                    autoSkip: false,
                    callback: function(value) {
                        return value;
                    }
                }
            }
        }
    }   
});


// Line Chart for Temperature
const tempCanvas = document.getElementById("tempChart");
const tempChart = new Chart(tempCanvas, {
    type: "line",

    data: {
        labels: [],

        datasets: [{
            label: "Temperature (°C)",
            data: [],

            borderColor: "rgba(255, 99, 132, 1)",
            backgroundColor: "rgba(255, 99, 132, 0.15)",

            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.25
        }]
    },

    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,

        layout: {
            padding: {
                top: 5,
                right: 8,
                bottom: 0,
                left: 0
            }
        },

        plugins: {
            legend: {
                display: true,
                position: "top"
            }
        },

        scales: {
            x: {
                title: {
                    display: true,
                    text: "Time"
                },

                ticks: {
                    maxTicksLimit: 6,
                    maxRotation: 0
                },

                grid: {
                    display: false
                }
            },

            y: {
                min: -10,
                max: 50,

                title: {
                    display: false
                },

                ticks: {
                    maxTicksLimit: 7,
                    precision: 0
                }
            }
        }
    }
});


//Sends a message to the webserver/esp to get the states of variables we care about when the webpage loads for the first time
function getStates() {
    //this triggers a notifyClients method in the c++ file which comes back by the onMessage function
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send("getStates");
    }
}