//---------------------------------------------
//Sensor Data Integration/Displayal
//---------------------------------------------

//Create variables for when the websocket is setup
var gateway = `ws://${window.location.hostname}/ws`;
var websocket;
const MAX_CHART_READINGS = 8;
const BRIGHTNESS_STORAGE_KEY = "smartRoomClockSettings";
const BRIGHTNESS_MODES = ["dark", "medium", "bright"];

initialiseBrightnessTheme();

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
    const alarmEnabled = values[4]?.alarmEnabled;
    const dateValue = values[5]?.dateValue;
    const timeValue = values[5]?.timeValue;
    const label = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    // Update the dashboard elements with the received values
    setWebsiteText("lightMode", getLightModeLabel(lightMode));
    setWebsiteText("comfortMode", comfortMode ?? "N/A");
    setWebsiteText("lightValue", Number.isFinite(lightLevel) ? lightLevel.toFixed(0) : "N/A");
    setWebsiteText("tempValue", Number.isFinite(temperature) ? `${temperature.toFixed(1)}°C` : "N/A");
    setWebsiteText("humidityValue", Number.isFinite(humidity) ? `${humidity.toFixed(1)}%` : "N/A");
    setWebsiteText("dateDisplay", dateValue ?? "--");
    setWebsiteText("timeDisplay", timeValue ?? "--:--");
    // Show the alarm state reported in the ESP32 values array on the dashboard.
    updateAlarmDashboard(alarmTime, alarmEnabled);

    // Update the humidity bar fill based on the received humidity value
    const humidityFill = document.getElementById("humidityFill");
    if (humidityFill && Number.isFinite(humidity)) {
        const percentage = Math.max(0, Math.min(100, humidity));
        //fill the bar according to the percentage
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
function setWebsiteText(id, value) {
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
        //Get rid of old readings after the max number of nodes reach
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





//---------------------------------------------
//Website Interaction
//---------------------------------------------



//Initialise the website brightness theme.
function initialiseBrightnessTheme() {

    // Set the default theme to bright.
    let brightness = "bright";

    try {
        // Retrieve the previously saved settings from the browser.
        // BRIGHTNESS_STORAGE_KEY is the key used to store these settings.
        const savedSettings = localStorage.getItem(BRIGHTNESS_STORAGE_KEY);

        if (savedSettings) {

            // Convert the saved JSON string into a JavaScript object.
            const settings = JSON.parse(savedSettings);

            // Check that the saved brightness theme is supported.
            if (BRIGHTNESS_MODES.includes(settings.brightness)) {

                // Use the saved theme if it is valid.
                brightness = settings.brightness;
            }
        }
    // Report an error if the saved settings cannot be retrieved or parsed, while allowing the website to continue running.
    } catch (error) {
        console.warn("Could not load the saved website theme:", error);
    }

    // Apply the selected or default brightness theme to the website.
    applyBrightnessTheme(brightness);

    // Find the radio button corresponding to the selected theme.
    const selectedRadio = document.querySelector(
        `input[name="brightness"][value="${brightness}"]`
    );

    // Mark that radio button as selected, if it exists.
    if (selectedRadio) {
        selectedRadio.checked = true;
    }

    // Find all radio buttons used to select the brightness theme.
    document.querySelectorAll('input[name="brightness"]').forEach(radio => {

        // Listen for changes when the user selects a different theme.
        radio.addEventListener("change", () => {

            // Only save the theme if this radio button is selected.
            if (radio.checked) {

                // Apply the new theme and save the preference.
                saveBrightnessTheme(radio.value);
            }
        });
    });
}


//Apply the chosen brightness theme to the website.
function applyBrightnessTheme(brightness) {

    // Validate the requested theme. If not supported, revert to default "bright".
    const validBrightness = BRIGHTNESS_MODES.includes(brightness)
        ? brightness
        : "bright";

    // Set the brightness theme as a data attribute on the root HTML element.
    // CSS can use this attribute to change the website's colours and styling.
    document.documentElement.dataset.brightness = validBrightness;
}


//Save the selected brightness theme.
function saveBrightnessTheme(brightness) {

    // Reject unsupported brightness themes.
    if (!BRIGHTNESS_MODES.includes(brightness)) {

        // Display a warning in the browser's developer console.
        console.warn("Ignoring unsupported website theme:", brightness);

        // Stop the function so an invalid theme is not saved.
        return;
    }

    // Update the website immediately so the user sees the change.
    applyBrightnessTheme(brightness);

    try {
        // Retrieve any existing saved settings.
        const savedSettings = localStorage.getItem(BRIGHTNESS_STORAGE_KEY);

        // Parse existing settings, or create an empty object if none exist.
        const settings = savedSettings ? JSON.parse(savedSettings) : {};

        // Update only the brightness property.
        // Other settings stored in this object remain unchanged.
        settings.brightness = brightness;

        // Convert the updated object to JSON and save it in the browser.
        localStorage.setItem(
            BRIGHTNESS_STORAGE_KEY,
            JSON.stringify(settings)
        );

    } catch (error) {
        // Report an error if the settings cannot be saved.
        console.error("Could not save the selected website theme:", error);
    }
}


//Save the display settings when the user activates the save action.
function saveDisplaySettings() {

    // Find the currently selected brightness radio button.
    const selectedRadio = document.querySelector(
        'input[name="brightness"]:checked'
    );

    // Save the selected theme.
    // If no radio button is selected, use "bright" as the default.
    saveBrightnessTheme(selectedRadio ? selectedRadio.value : "bright");

    // Display a confirmation message on the website.
    setWebsiteText("theme-DisplayMessage","Website brightness theme saved. Future load will select saved theme.");
}

 //---------------------------------------------
 // Alarm Form Submission / Functionalities
 //---------------------------------------------

// Wait for the website to finish loading
document.addEventListener("DOMContentLoaded", () => {

    // Get references to the alarm form and its input fields
    const alarmForm = document.getElementById("alarmForm");
    const inputtedAlarmTime = document.getElementById("form_alarmTime");

    // Stop if the required form elements do not exist
    if (!alarmForm || !inputtedAlarmTime) {
        console.warn("Alarm form or alarm time input was not found.");
        return;
    }

    // Listen for the user submitting the alarm form
    alarmForm.addEventListener("submit", function (event) {

        // Prevent the browser from refreshing the page
        event.preventDefault();

        // Collect the alarm time entered by the user
        const timeInput = inputtedAlarmTime.value;

        // Collect the selected On/Off radio button
        const enabledInput = document.querySelector(
            'input[name="form_alarmEnabled"]:checked'
        );

        // Check that the required fields have been completed
        if (!timeInput || !enabledInput) {
            setWebsiteText("alarm-DisplayMessage", "Please select an alarm time and On/Off setting.");
            return;
        }

        // Convert the selected setting into a Boolean value
        const alarmEnabled = enabledInput.value === "On";

        // Create an object containing the alarm settings
        const alarmData = {
            type: "setAlarm",
            time: timeInput,
            enabled: alarmEnabled
        };

        // Check that the existing WebSocket is connected
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            setWebsiteText("alarm-DisplayMessage", "Unable to save the alarm. Please check the connection to the clock.");
            return;
        }

        try {
            // Send the alarm settings to the ESP32 as JSON
            websocket.send(JSON.stringify(alarmData));

            // Update the website dashboard with the new alarm
            updateAlarmDashboard(timeInput, alarmEnabled);

            // Clear the form after submitting successfully
            alarmForm.reset();

            // Log the submitted settings for debugging
            console.log("Alarm settings sent to the ESP32:", alarmData);

        } catch (error) {
            // Report an error if sending the message fails
            console.error("Failed to send alarm settings:", error);
            setWebsiteText("alarm-DisplayMessage", "The alarm could not be sent. Please try again.");
        }
    });
});



// Update the existing alarm information on the dashboard
function updateAlarmDashboard(time, enabled) {

    // Display the configured alarm time
    setWebsiteText("alarmDashboard", time || "--:--");

    // ESP32 may report the enabled state as a boolean or as text in its JSON array.
    const enabledText = enabled === true || enabled === 1 ||
        enabled === "1" || enabled === "true" || enabled === "On"
        ? "On"
        : enabled === false || enabled === 0 || enabled === "0" ||
            enabled === "false" || enabled === "Off"
            ? "Off"
            : "N/A";
    setWebsiteText("alarmEnabled", enabledText);
}


// Function called by the Clear button
function resetAlarmForm() {

    // Get the alarm form
    const alarmForm = document.getElementById("alarmForm");

    // Reset the form to its default values
    if (alarmForm) {alarmForm.reset();}
}

