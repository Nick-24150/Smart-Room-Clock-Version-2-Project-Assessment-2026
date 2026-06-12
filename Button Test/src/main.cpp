
#include <Arduino.h>
// ----- BUTTON TEST CODE -----

// Define your button pins
#define BUTTOND0 0 
#define BUTTOND1 1
#define BUTTOND2 2

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("=== Button Test Started ===");
  Serial.println("Press any button to see a message");

  // Set button pins as inputs with pull-ups
  pinMode(BUTTOND0, INPUT_PULLUP); //note that BUTTOND0 is set to INPUT_PULLUP
  pinMode(BUTTOND1, INPUT); //note that BUTTOND1 is set to INPUT without pull-up
  pinMode(BUTTOND2, INPUT_PULLDOWN); //note that BUTTOND2 is set to INPUT_PULLDOWN
}

void loop() {
  if (digitalRead(BUTTOND0) == LOW) {
    Serial.println("Button 0 pressed!");
    delay(300);  
  }
  if (digitalRead(BUTTOND1) == HIGH) {
    Serial.println("Button 1 pressed!");
    delay(300);
  }
  if (digitalRead(BUTTOND2) == HIGH) {
    Serial.println("Button 2 pressed!");
    delay(300);
  } else {
    Serial.println("No button pressed");
    delay(300);
  }
}
