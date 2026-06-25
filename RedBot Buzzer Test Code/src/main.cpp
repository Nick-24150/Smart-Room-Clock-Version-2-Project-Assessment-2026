#include <Arduino.h>

// RedBot buzzer test sketch
const uint8_t BUZZER_PIN = A5;
const uint8_t STATUS_LED = LED_BUILTIN;

// NOTE FREQUENCIES (Hz)
#define D4 294
#define Fsharp4 370
#define A4 440
#define Csharp5 554
#define D5 587
#define E5 659
#define Fsharp5 740
#define G5 784
#define A5 880


// Samsung Homecoming melody
const int melody[] = {
  Fsharp5, E5, Fsharp5, A5, D5, Fsharp5, E5, Fsharp5, A5, D5, 
  G5, Fsharp5, E5, D5, Csharp5, D5, E5, Csharp5, D5, E5, Fsharp5, G5, A5, 
  Fsharp5, E5, Fsharp5, A5, D5, Fsharp5, E5, Fsharp5, A5, D5, 
  G5, Fsharp5, E5, D5, Csharp5, D5, E5, Csharp5, D5, A4, Fsharp4, A4, D4
};

// Note durations (ms)
const int durations[] = {
  411, 411, 205, 205, 411, 411, 411, 205, 205, 411,
  205,205,205,205,205,205,205,205,205,205,205,205,822,
  411, 411, 205, 205, 411, 411, 411, 205, 205, 411,
  205,205,205,205,205,205,205,205,205,205,205,205,822,
};

const size_t notesCount = sizeof(melody) / sizeof(melody[0]);

void playMelody() {
  for (size_t i = 0; i < notesCount; ++i) {
    int note = melody[i];
    int dur = durations[i];

    if (note == 0) {
      noTone(BUZZER_PIN);
      delay(dur);
    } else {
      tone(BUZZER_PIN, note);
      digitalWrite(STATUS_LED, HIGH);
      delay(dur);
      noTone(BUZZER_PIN);
      digitalWrite(STATUS_LED, LOW);
      delay(50);
    }
  }
}

void setup() {
  Serial.begin(112500);
  while (!Serial) { ; }

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);

  // startup beep
  tone(BUZZER_PIN, 1000);
  delay(150);
  noTone(BUZZER_PIN);
}

void loop() {
  Serial.println("Playing Samsung Homecoming...");
  playMelody();
  delay(2000);
}