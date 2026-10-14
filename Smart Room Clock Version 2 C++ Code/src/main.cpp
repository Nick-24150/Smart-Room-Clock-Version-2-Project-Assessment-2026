//-----LIBARARIES-----
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include "secrets.h"  //double quotes rather than angle brackets makes the compiler look in the sketch folder rather than the library folder
//#include <LibPrintf.h>
#include <Arduino.h>
#include <Arduino_JSON.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h> 
//#include <Adafruit_BMP280.h>  //(OPTIONAL) if using the BMP280 sensor, uncomment this line
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>
#include <Adafruit_NeoPixel.h>
#include <RTClib.h> 

//-----WiFi setup-----
//the Wifi status
int status = WL_IDLE_STATUS;

//-----TEMPERATURE SENSOR OBJECTS-----
Adafruit_AHTX0 ahtSensor; //sensor object for AHT20 Temperature and Humidity sensor
//Adafruit_BMP280 bmp; //(OPTIONAL) sensor object for BMP280 Pressure and Altitude sensor

//-----TFT SCREEN SET UP-----
Adafruit_ST7789 tftClockScreenDisplay = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST); //TFT screen to display outputs

//-----NEOPIXEL AND LED SET UP-----
const byte RLEDPIN = LED_BUILTIN;
#define PIN_NEOPIXEL 33
Adafruit_NeoPixel pixels(1, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);

//-----BUTTON PINS-----
#define BUTTOND0 0 //Time and Date Phase + Alarm Stop
#define BUTTOND1 1 //Lighting/Temperature/Humidity Phase
#define BUTTOND2 2 //Alarm Phase

//-----LIGHT SENSOR PIN-----
const byte LDRPIN = A4;
extern const byte LDRPIN;

//-----BUZZER PIN SETUP-----
const uint8_t BUZZER_PIN = A5;
const uint8_t STATUS_LED = LED_BUILTIN;

//-----VARIABLES-----
// screen phases
int currentScreenPhase = 0; // 0 = time/date, 1 = lighting/temp/humidity, 2 = alarm
int lastScreenPhase = -1; // Variable to store the last phase. -1 means no phase selected yet

// last sensors/compenents readings
int lastMinute = -1; // Variable to store the last minute value
int lastTemp = -100; // Variable to store the last temperature reading
int lastHumidity = -1; // Variable to store the last humidity reading
int lastLight = -1; // Variable to store the last light level reading

// buttons/alarm variables
const long DEBOUNCE_DELAY = 50; // Delay for button debouncing
bool alarmActive; // Variable to track if the alarm is active
DateTime alarmTime; // Variable to store the alarm time
unsigned long lastBuzzerToggle = 0; // Variable to store the last time the buzzer state was toggled
bool buzzerState = false; // Variable to track the current state of the buzzer
int currentNote = 0; // Variable to track the current note being played in the melody
unsigned long previousNoteTime = 0; // Variable to store the time when the last note was played

//-----DAYS OF THE WEEK-----
const char DAYS_OF_THE_WEEK[7][12] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};


// D Major Scale Frequencies
#define D4 294
#define E4 330
#define Fsharp4 370
#define G4 392
#define A4 440
#define B4 494
#define Csharp5 554
#define D5 587
#define E5 659
#define Fsharp5 740
#define G5 784
#define A5 880
#define B5 988
#define Csharp6 1109
#define D6 1175

// Alarm Melody (D Major Scale) - "D Major Alarm"

//Melody tune
const int melody[] = {
  294,  // D4
  330,  // E4
  370,  // F#4
  440,  // A4
  494,  // B4
  440,  // A4
  370,  // F#4
  330,  // E4

  294,  // D4
  370,  // F#4
  440,  // A4
  587,  // D5
  494,  // B4
  440,  // A4
  370,  // F#4
  294   // D4
};

//Melody durations/rhythms (in milliseconds)
const int durations[] = {
  300,  // D4
  300,  // E4
  300,  // F#4
  450,  // A4
  450,  // B4
  300,  // A4
  300,  // F#4
  450,  // E4

  300,  // D4
  300,  // F#4
  300,  // A4
  600,  // D5
  450,  // B4
  300,  // A4
  300,  // F#4
  600   // D4
};

const size_t notesCount = sizeof(melody) / sizeof(melody[0]);
const size_t melodyLength = notesCount;

// room lighting/constant lighting thresholds
int currentLightMode = -1;  // Store the current light mode. -1 means no mode selected yet. 0 = dark, 1 = medium, 2 = bright
int lastLightMode = -1; // Remember the last light mode. -1 means no mode selected yet
bool needsRefresh = true; // Flag to indicate if the screen needs to be refreshed
const int DARK_THRESHOLD = 400; //below this value is considered dark
const int BRIGHT_THRESHOLD = 2200; //above this value is considered bright

// temperature thresholds 
const int COLD_THRESHOLD = 10; //below this temperature is considered cold
const int COOL_THRESHOLD = 20; //below this temperature is considered cool
const int COMFORTABLE_THRESHOLD = 25; //below this temperature is considered comfortable
const int WARM_THRESHOLD = 30; //below this temperature is considered warm


//Your network name and password are hidden in the secrets.h file
const char SSID[] = SECRET_SSID;
const char PASSWORD[] = SECRET_PASS;

//-----WebServer Setup-----
AsyncWebServer server(80); // Create AsyncWebServer object on port 80
AsyncWebSocket ws("/ws"); // Create a WebSocket object

//-----RTC Setup-----
RTC_DS3231 realTimeClock; //DS3231 Real Time Clock module used to track the time

//-----LittleFS Setup-----
void initLittleFS() {
  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS failed to setup. Please check the filesystem.");
  } else {
    Serial.println("LittleFS should be going now. Reading files...");
  }
}


//-----LittleFS reading a file-----
String readingFile(fs::FS& fs, const char* path) {
  Serial.print("Reading file: ");
  Serial.println(path);
  File file = fs.open(path);
  if (!file || file.isDirectory()) {
    Serial.println("readingFile failed to open file");
    return String();
  }
  String fileContent;
  while (file.available()) {
    fileContent = file.readStringUntil('\n');
    break;
  }
  return fileContent;
}

//-----LittleFS writing a file-----
void writingFile(fs::FS& fs, const char* path, const char* message) {
  Serial.print("Writing file: ");
  Serial.println(path);
  File file = fs.open(path, FILE_WRITE);
  if (!file) {
    Serial.println("writingFile failed to write to file");
    return;
  }
  if (file.print(message)) {
    Serial.println("- writingFile success");
  } else {
    Serial.println("- writingFile failed");
  }
}

/**
set up a JSON array and hold the states of all values we care about
pins and their current states variables and their current values
*/

//-----GETTING OUTPUT STATES-----
String getOutputStates() {
  JSONVar myArray;

  DateTime now = realTimeClock.now();
  sensors_event_t humidityEvent, tempEvent;
  ahtSensor.getEvent(&humidityEvent, &tempEvent);
  int lightLevelValue = analogRead(LDRPIN);

  String alarmValue = String(alarmTime.hour()) + ":" + (alarmTime.minute() < 10 ? "0" : "") + String(alarmTime.minute());
  String dateValue = String(DAYS_OF_THE_WEEK[now.dayOfTheWeek()]) + " " + String(now.day()) + "-" + String(now.month()) + "-" + String(now.year());
  String timeValue = String(now.hour()) + ":" + (now.minute() < 10 ? "0" : "") + String(now.minute());

  //Temperature
  myArray["values"][0]["name"] = "Temperature";
  myArray["values"][0]["tempValue"] = String(tempEvent.temperature, 1) + " °C";

  // Comfort Mode
  myArray["values"][1]["name"] = "Comfort Mode";
  myArray["values"][1]["comfortMode"] = (tempEvent.temperature < COLD_THRESHOLD) ? "Cold" : (tempEvent.temperature < COOL_THRESHOLD) ? "Cool" : (tempEvent.temperature < COMFORTABLE_THRESHOLD) ? "Comfortable" : (tempEvent.temperature < WARM_THRESHOLD) ? "Warm" : "Hot";

  //Humidity
  myArray["values"][2]["name"] = "Humidity";
  myArray["values"][2]["humidValue"] = String(humidityEvent.relative_humidity, 1) + " %";

  //Light Level 
  myArray["values"][3]["name"] = "Light Level";
  myArray["values"][3]["lightValue"] = String(lightLevelValue) + " (ADC Value)";

  //Light Mode
  myArray["values"][3]["name"] = "Light Mode";
  myArray["values"][3]["lightMode"] = (lightLevelValue < DARK_THRESHOLD) ? "Dark" : (lightLevelValue < BRIGHT_THRESHOLD) ? "Medium" : "Bright";

  //Alarm Time
  myArray["values"][4]["name"] = "Alarm Time";
  myArray["values"][4]["alarmValue"] = alarmValue;
  myArray["values"][4]["unit"] = "HH:MM";

  //Date 
  myArray["values"][5]["name"] = "Date";
  myArray["values"][5]["dateValue"] = dateValue;
  myArray["values"][5]["unit"] = "DOTW-DD-MM-YYYY";

  //Time
  myArray["values"][5]["name"] = "Time";
  myArray["values"][5]["timeValue"] = timeValue;
  myArray["values"][5]["unit"] = "HH:MM";

  //Convert the JSON array to a string
  String jsonString = JSON.stringify(myArray);
  return jsonString;
}


///-----WebSocket Notifications-----
void notifyClients(String state) {
  ws.textAll(state);
}

// Handles messages from clidents in the if statements below 
void handleWebSocketMessage(void* arg, uint8_t* data, size_t len) {
  AwsFrameInfo* info = (AwsFrameInfo*)arg;
  if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
    data[len] = 0;
    if (strcmp((char*)data, "getStates") == 0) {
      notifyClients(getOutputStates());
    } 
  }
}


//-----WebSocket event handler-----
void onEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
      Serial.print("WebSocket client ");
      Serial.print(client->id());
      Serial.print(" connected from ");
      Serial.println(client->remoteIP().toString().c_str());
      break;
    case WS_EVT_DISCONNECT:
      Serial.printf("WebSocket client #%u disconnected\n", client->id());
      Serial.print("WebSocket client ");
      Serial.print(client->id());
      Serial.println(" disconnected\n");
      break;
    case WS_EVT_DATA:
      handleWebSocketMessage(arg, data, len);
      break;
    case WS_EVT_PONG:
    case WS_EVT_ERROR:
      break;
  }
}

//-----WebSocket setup-----
void initWebSocket() {
  ws.onEvent(onEvent);
  server.addHandler(&ws);
  Serial.println("WebSocket initialised");
}




//-----FUNCTION PROTOTYPES-----
void neopixelTemperatureColour();
void screenPhases();
void handleButtons();
void buzzerOutput();
void flashLED(int delayTimes, int numTimes);
void playAlarmMelody();
void buzzerOutput();
void roomLighting();
void checkSerialForAlarm();
void extremeTemperatureAlert(int delayTimes, int numTimes);


//-----ESP/CLOCK SETUP----- 
void setup() {
  //Initialize Serial Monitor
  Serial.begin(115200);
  while (!Serial); //Wait for Serial Monitor to open
  Serial.println("Smart Room Clock Initialising...");
  delay(1000); //Wait a second

  //Buzzer initial startup beep
  pinMode(BUZZER_PIN, OUTPUT);
  tone(BUZZER_PIN, 1000);
  delay(100);
  tone(BUZZER_PIN, 1000);
  noTone(BUZZER_PIN);


  // WiFi setup 
  WiFi.mode(WIFI_STA);
  WiFi.begin(SSID, PASSWORD);
  Serial.print("Trying to connect WiFi ");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println(".");
  if (WL_CONNECTED == true) {
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Issues showing the IP address");
  }
  Serial.println("WiFi should be going now");

  //LittleFS setup
  initLittleFS();

  //webSocket setup
  initWebSocket();

  //Web Server setup
  // Web Server Root URL
  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(LittleFS, "/dashboard.html", "text/html", false);
  });
  
  server.on("/settings", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(LittleFS, "/settings.html", "text/html", false);
  });
  server.serveStatic("/", LittleFS, "/");

  server.begin();
  Serial.println("Webserver should be running now");


  //Initialise AHT20 sensor
  if (!ahtSensor.begin()) {
    //Check if AHT20 sensor is connected
    Serial.println("Could not find AHT20 sensor!");
    while (1);
  }
  Serial.println("AHT20 sensor found!");
  
  //Initialise TFT screen
  pinMode(TFT_BACKLITE, OUTPUT); //set the TFT_BACKLITE pin as an output
  pinMode(TFT_I2C_POWER, OUTPUT); //set the TFT_I2C_POWER pin as an output
  digitalWrite(TFT_BACKLITE, HIGH); //turn on blacklight by setting it to HIGH
  digitalWrite(TFT_I2C_POWER, HIGH); //turn on the screen by setting it to HIGH
  delay(10); //pause to let this happen

  //Sets the screen up
  tftClockScreenDisplay.init(135, 240); //initialize a 135x240 screen
  tftClockScreenDisplay.setRotation(3); //rotate the screen 90 degrees
  tftClockScreenDisplay.setTextSize(2); //set text size to 2

  //Initialise NeoPixel and LED
  pinMode(RLEDPIN, OUTPUT); 
  pixels.begin(); //Draw power to NeoPixel but don't turn it on yet
  pixels.show();

  //Initialise Buttons, LDR, and Buzzer
  pinMode(LDRPIN, INPUT);
  pinMode(BUTTOND0, INPUT_PULLUP);
  pinMode(BUTTOND1, INPUT_PULLDOWN);
  pinMode(BUTTOND2, INPUT);


  //Initialise RTC
  if (!realTimeClock.begin()) {
    Serial.println("Could not find RTC!");
    while (1);
  }
  Serial.println("RTC found!");

  if (realTimeClock.lostPower()) {
    Serial.println("RTC lost power, let's set the time!");
    //When time needs to be set on a new device, or after a power loss, the following line saves the date & time when this sketch was compiled to the RTC.
    realTimeClock.adjust(DateTime(F(__DATE__), F(__TIME__)));
    //Line below manually sets the RTC with date & time.
    //realTimeClock.adjust(DateTime(year, month, date, hour, minute));
  }

  // When time needs to be re-set on a previously configured device, the following line sets the RTC to the date & time this sketch was compiled
  realTimeClock.adjust(DateTime(F(__DATE__), F(__TIME__)));

  //Ask user to set alarm time via Serial Monitor
  Serial.println("-------------------------------------------------");
  Serial.println("Smart Room Clock ready ✅");
  Serial.println("IP Address: " + WiFi.localIP().toString());
  Serial.println("To set an alarm, type time in HH:MM (24-hour).");
  Serial.println("Feel free to change the alarm at anytime using the Serial Monitor.");
  Serial.println("Example: 07:30 or 21:45");

  Serial.println("-------------------------------------------------");

}

//-----MAIN LOOP-----
void loop() {
  //frees up memory by refreshing the list of clients connected
  ws.cleanupClients();
  delay(1000); //slows things down for button clicks but stops flickering screen
  notifyClients(getOutputStates()); // Send the current states to the webpage
  neopixelTemperatureColour(); // Set NeoPixel colour based on temperature
  screenPhases(); // Update screen based on current mode
  handleButtons(); // Check for button presses and handle accordingly
  roomLighting(); // Update room lighting based on LDR reading
  playAlarmMelody(); // Play alarm melody if alarm is active
  buzzerOutput(); // Control buzzer output based on alarm
  checkSerialForAlarm(); // Check for alarms in the serial input

  DateTime now = realTimeClock.now(); // Get current time

  // Trigger refresh when time changes (once per minute)
  if (now.minute() != lastMinute) { //if current minute is different to last minute
    needsRefresh = true; //refresh the screen
    lastMinute = now.minute(); //update last minute to current minute
  }

  // Trigger refresh when temp/humidity/light change significantly
  sensors_event_t humidity, temp;
  ahtSensor.getEvent(&humidity, &temp);
  int lightLevel = analogRead(LDRPIN);

  //if temperature changes by 0.5C, humidity by 1%, or light level by 10 units
  if (abs(temp.temperature - lastTemp) >= 0.5 || abs(humidity.relative_humidity - lastHumidity) >= 1 || abs(lightLevel - lastLight) > 10) {
    needsRefresh = true; //refresh the screen
    lastTemp = temp.temperature; //update lastTemp to current temperature
    lastHumidity = humidity.relative_humidity; //update lastHumidity to current humidity
    lastLight = lightLevel; //update lastLight to current light level
  }

  // Only redraw screen when something changed
  if (currentScreenPhase != lastScreenPhase || needsRefresh) { //if the current screen phase is different to the last phase or needsRefresh is true
    tftClockScreenDisplay.fillScreen(currentLightMode == 0 ? ST77XX_BLACK : ST77XX_WHITE); // Clear screen based on current light mode
    screenPhases();
    lastScreenPhase = currentScreenPhase; //update lastScreenPhase to currentScreenPhase
    needsRefresh = false; //reset needsRefresh flag
  }

  delay(200); // Delay to prevent excessive CPU usage
}



//-----NEOPIXEL'S TEMPERATURE COLOUR-----
void neopixelTemperatureColour() {
  // AHT20 Reading
  sensors_event_t humidity, temp;
  ahtSensor.getEvent(&humidity, &temp);
  int tempInt = (int)temp.temperature;
  int humidityInt = (int)humidity.relative_humidity;

  // Set NeoPixel colour based on temperature
  if (tempInt < COLD_THRESHOLD) { //if temperature is below cold threshold, set to blue
    pixels.setPixelColor(0, pixels.Color(0, 0, 255)); 
    extremeTemperatureAlert(500,5); //flash LED and beep buzzer 5 times with 500ms delay
    Serial.println(" ⚠️  Extreme COLD Temperature Detected!"); //print to serial monitor
  } else if (tempInt >= COLD_THRESHOLD && tempInt < COOL_THRESHOLD) { //if temperature is below cool threshold, set to light blue
    pixels.setPixelColor(0, pixels.Color(173, 216, 230)); 
  } else if (tempInt >= COOL_THRESHOLD && tempInt < COMFORTABLE_THRESHOLD) { //if temperature is below comfortable threshold, set to green
    pixels.setPixelColor(0, pixels.Color(0, 255, 0)); 
  } else if (tempInt >= COMFORTABLE_THRESHOLD && tempInt < WARM_THRESHOLD) { //if temperature is below warm threshold, set to yellow
    pixels.setPixelColor(0, pixels.Color(255, 255, 0)); 
  } else { //if temperature is above warm threshold, set to red
    pixels.setPixelColor(0, pixels.Color(255, 0, 0)); 
    extremeTemperatureAlert(500,5); //flash LED and beep buzzer 5 times with 500ms delay
    Serial.println(" ⚠️  Extreme HOT Temperature Detected!"); //print to serial monitor
  }
  pixels.show(); // Update NeoPixel with new colour
}



//-----SCREEN PHASES-----
void screenPhases() {
  if (currentScreenPhase == 0) { //---PHASE 1: TIME and DATE---
    DateTime now = realTimeClock.now(); //get the current time and date

    // TIME — large font centered
    tftClockScreenDisplay.setTextSize(5);
    tftClockScreenDisplay.setCursor(43, 40);
    tftClockScreenDisplay.printf("%02d:%02d", now.hour(), now.minute()); //display time in HH:MM format

    // DATE (format: TUE 21-10-2025)
    tftClockScreenDisplay.setTextSize(2);
    String dayName = DAYS_OF_THE_WEEK[now.dayOfTheWeek()];
    tftClockScreenDisplay.setCursor(35, 95);
    tftClockScreenDisplay.printf("%s %02d-%02d-%04d", dayName.c_str(), now.day(), now.month(), now.year()); //display date in Day, DD-MM-YYYY format

  } else if (currentScreenPhase == 1) { //---PHASE 2: LIGHTING and TEMPERATURE and HUMIDITY---

    // Get sensor readings for temperature, humidity, and light level 
    int lightLevel = analogRead(LDRPIN);
    sensors_event_t humidity, temp;
    ahtSensor.getEvent(&humidity, &temp);
    int tempInt = (int)temp.temperature;
    int humidityInt = (int)humidity.relative_humidity;

    // Determine light mode
    String lightMode;
    if (lightLevel < DARK_THRESHOLD) { //if light level is below dark threshold
      lightMode = "DARK";
    } else if (lightLevel <= BRIGHT_THRESHOLD) { //if light level is between dark and bright threshold
      lightMode = "MEDIUM";
    } else { //if light level is above bright threshold
      lightMode = "BRIGHT";
    }

    // Determine comfort mode
    String comfort;
    if (tempInt < COLD_THRESHOLD) { //if temperature is below cold threshold
      comfort = "COLD";
    } else if (tempInt < COOL_THRESHOLD) { // if temperature is below cool threshold
      comfort = "COOL";
    } else if (tempInt < COMFORTABLE_THRESHOLD) { // if temperature is below comfortable threshold
      comfort = "GOOD";
    } else if (tempInt < WARM_THRESHOLD) { // if temperature is below warm threshold
      comfort = "WARM";
    } else { //if temperature is above warm threshold
      comfort = "HOT"; 
    }

    // Divide screen into 3 sections
    int sectionWidth = tftClockScreenDisplay.width() / 3;

    // Draw 2 vertical divider lines
    tftClockScreenDisplay.drawLine(sectionWidth, 0, sectionWidth, tftClockScreenDisplay.height(), currentLightMode == 0 ? ST77XX_WHITE : ST77XX_BLACK);
    tftClockScreenDisplay.drawLine(sectionWidth * 2, 0, sectionWidth * 2, tftClockScreenDisplay.height(), currentLightMode == 0 ? ST77XX_WHITE : ST77XX_BLACK);

    // Single horizontal line under all headers
    tftClockScreenDisplay.drawLine(0, 42, tftClockScreenDisplay.width(), 42, currentLightMode == 0 ? ST77XX_WHITE : ST77XX_BLACK);

    // LIGHT
    tftClockScreenDisplay.setTextSize(2);
    tftClockScreenDisplay.setCursor(sectionWidth * 0 + 10, 20);
    tftClockScreenDisplay.println("LIGHT");
    tftClockScreenDisplay.setTextSize(2);
    tftClockScreenDisplay.setCursor(sectionWidth * 0 + 5, 70);
    tftClockScreenDisplay.println(lightMode); //display light mode, DARK, MEDIUM, BRIGHT

    // TEMP + COMFORT
    tftClockScreenDisplay.setTextSize(2);
    tftClockScreenDisplay.setCursor(sectionWidth * 1 + 18, 20);
    tftClockScreenDisplay.println("TEMP");
    tftClockScreenDisplay.setTextSize(2);
    tftClockScreenDisplay.setCursor(sectionWidth * 1 + 18, 70);
    tftClockScreenDisplay.printf("%d C", (int)temp.temperature); //display temperature
    tftClockScreenDisplay.setCursor(sectionWidth * 1 + 18, 100);
    tftClockScreenDisplay.println(comfort); //display comfort level, COLD, COOL, GOOD, WARM, HOT

    // HUMIDITY
    tftClockScreenDisplay.setTextSize(2);
    tftClockScreenDisplay.setCursor(sectionWidth * 2 + 10, 20);
    tftClockScreenDisplay.println("HUMID");
    tftClockScreenDisplay.setTextSize(2);
    tftClockScreenDisplay.setCursor(sectionWidth * 2 + 13, 70);
    tftClockScreenDisplay.printf("%d %%", (int)humidity.relative_humidity); //display humidity in percentage

  } else if (currentScreenPhase == 2) {
    //---PHASE 3: ALARM---
    tftClockScreenDisplay.setTextSize(4);
    tftClockScreenDisplay.setCursor(57, 40);
    tftClockScreenDisplay.println("ALARM");

    tftClockScreenDisplay.setTextSize(3);
    tftClockScreenDisplay.setCursor(72, 90);
    tftClockScreenDisplay.printf("%02d:%02d", alarmTime.hour(), alarmTime.minute()); //display alarm time in HH:MM format
  }
}  


//-----HANDLE BUTTONS-----
void handleButtons() {
  if (digitalRead(BUTTOND0) == LOW) { //when button D0 is pressed
    if (alarmActive) {
      alarmActive = false; // Stop buzzer
    }
    currentScreenPhase = 0; //change to time/date phase
    needsRefresh = true;
    delay(DEBOUNCE_DELAY); // Debounce delay
  }
  if (digitalRead(BUTTOND1) == HIGH) {
    currentScreenPhase = 1; //change to lighting/temperature/humidity phase
    needsRefresh = true;
    delay(DEBOUNCE_DELAY); // Debounce delay
  }
  if (digitalRead(BUTTOND2) == HIGH) {
    currentScreenPhase = 2; //change to alarm phase
    needsRefresh = true;
    delay(DEBOUNCE_DELAY); // Debounce delay
  }
}

//-----ALARM MELODY PLAYBACK-----
void playAlarmMelody() {
  // Play the alarm melody if the alarm is active
  for (size_t i = 0; i < notesCount; i++) {
    if (!alarmActive) return;

    tone(BUZZER_PIN, melody[i], durations[i]);
    delay(durations[i] + 40);
  }
  // Stop the buzzer after playing the melody
  noTone(BUZZER_PIN);
}

//-----BUZZER OUTPUT-----
void buzzerOutput() {
  DateTime now = realTimeClock.now();
  // Check if the current time matches the alarm time and the alarm is not already active
  if (now.hour() == alarmTime.hour() &&
      now.minute() == alarmTime.minute() &&
      now.second() <= 2 &&
      !alarmActive) {

    alarmActive = true;
  }
  // If the alarm is active, play the alarm melody and check for button press to stop it
  while (alarmActive) {

    playAlarmMelody();

    if (digitalRead(BUTTOND0) == LOW) {
      alarmActive = false;
      noTone(BUZZER_PIN);
      break;
    }
  }
}

//-----FLASH LED AND BUZZER ALERT FOR EXTREME TEMPERATURES-----
void extremeTemperatureAlert(int delayTime, int numTimes) {

  for (int i = 0; i < numTimes; i++) {

    // LED ON + buzzer ON
    digitalWrite(RLEDPIN, HIGH);
    tone(BUZZER_PIN, 1000);

    delay(delayTime);

    // LED OFF + buzzer OFF
    digitalWrite(RLEDPIN, LOW);
    noTone(BUZZER_PIN);

    delay(delayTime);
  }
}

//-----ROOM LIGHTING CONTROL-----
void roomLighting() {
  int lightLevel = analogRead(LDRPIN);

  // check whether the light level has changed significantly
  static int lastLightLevel = 0; //store last light level from the last time the function roomLighting was called to compare
  if (abs(lightLevel - lastLightLevel) < 50) return;  // if the change is less than 50, ignore it
  lastLightLevel = lightLevel; //update lastLightLevel for next comparison

  int newMode;

  // Determine lighting mode
  if (lightLevel < DARK_THRESHOLD) { //if light level is below dark threshold
    newMode = 0; // Dark mode
  } else if (lightLevel >= DARK_THRESHOLD && lightLevel <= BRIGHT_THRESHOLD) { //if light level is between dark and bright thresholds
    newMode = 1; // Medium mode
  } else { //if light level is above bright threshold
    newMode = 2; // Bright mode
  }

  // Only update the display when the mode actually changes
  if (newMode != currentLightMode) { //if the new mode is different from the current mode
    currentLightMode = newMode; //update currentLightMode to newMode
    needsRefresh = true; //set needsRefresh to true to update the screen

     // Update display based on current light mode

    switch (currentLightMode) { //change display based on current mode
      case 0: // Dark Mode
        analogWrite(TFT_BACKLITE, 50);  // dim backlight
        tftClockScreenDisplay.fillScreen(ST77XX_BLACK); //black background
        tftClockScreenDisplay.setTextColor(ST77XX_WHITE); //white text
        pixels.setBrightness(10); //dim NeoPixel
        break;

      case 1: // Medium Mode
        analogWrite(TFT_BACKLITE, 152); // medium backlight
        tftClockScreenDisplay.fillScreen(ST77XX_WHITE); //white background
        tftClockScreenDisplay.setTextColor(ST77XX_BLACK); //black text
        pixels.setBrightness(100); //medium brightness for NeoPixel
        break;

      case 2: // Bright Mode
        analogWrite(TFT_BACKLITE, 255); // full brightness
        tftClockScreenDisplay.fillScreen(ST77XX_WHITE); //white background
        tftClockScreenDisplay.setTextColor(ST77XX_BLACK); //black text
        pixels.setBrightness(255); //full brightness for NeoPixel
        break;
    }
  }
}

//-----CHECK SERIAL FOR ALARM INPUT-----
void checkSerialForAlarm() {
  if (Serial.available() > 0) {
    // Read input until user presses Enter
    String AlarmInput = Serial.readStringUntil('\n');
    AlarmInput.trim(); // Remove any leading/trailing whitespace

    // Validate input contains a colon
    int colonIndex = AlarmInput.indexOf(':');
    if (colonIndex > 0) {
      int hours = AlarmInput.substring(0, colonIndex).toInt();   // extract hours
      int minutes = AlarmInput.substring(colonIndex + 1).toInt(); // extract minutes

      // Check valid time range
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        // Save the alarm
        DateTime now = realTimeClock.now(); //get current date
        alarmTime = DateTime(now.year(), now.month(), now.day(), hours, minutes, 0); //set alarm time with current date

        Serial.print("✅  Alarm set to "); 
        Serial.printf("%02d:%02d\n", hours, minutes); //set alarm confirmation message

        needsRefresh = true; //refresh the screen to show new alarm time

        //if currently in alarm screen phase, refresh to display the new alarm
        if (currentScreenPhase == 2) {
          tftClockScreenDisplay.fillScreen(currentLightMode == 0 ? ST77XX_BLACK : ST77XX_WHITE);
          screenPhases(); // redraw alarm screen
        }
      } else {
        Serial.println("⚠️  Invalid time! Please enter in HH:MM (24-hour)."); //when the time is out of range
      }
    } else {
      Serial.println("⚠️  Wrong format! Please use HH:MM (e.g., 07:30)."); //when the format is incorrect
    }
  }
}
