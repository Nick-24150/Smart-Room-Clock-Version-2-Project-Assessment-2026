#include <Arduino.h>
const int LDR_PIN = A4;  // Analog pin connected to the LDR
const int BUZZER_PIN = A5; // Digital pin connected to the buzzer

void setup() {
  pinMode(LDR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(115200);
  while (!Serial);
  Serial.println("LDR Light Sensor Test 🌞");
}

void loop() {
  int lightLevel = analogRead(LDR_PIN);  // Read analog value (0–4095 on ESP32)
  Serial.print("Light level: ");
  Serial.println(lightLevel);

  // Optional: Interpret brightness levels
  if (lightLevel < 400) {
    Serial.println("Environment: 🌑 Dark");
  } else if (lightLevel >= 400 && lightLevel <= 2200) {
    Serial.println("Environment: 🌥️ Moderate Light");
  } else {
    digitalWrite(BUZZER_PIN, HIGH); // turns buzzer ON
    delay(300); //wait for 300 milliseconds
    digitalWrite(BUZZER_PIN, LOW);  // turns buzzer OFF
    Serial.println("Environment: 🌞 Bright");
  }

  
  delay(20000);  // Delay between reads

}
