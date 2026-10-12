#include <Wire.h>
#include <Adafruit_AHTX0.h> // AHT20 sensor library
#include <Adafruit_BMP280.h> // BMP280 sensor library
#include <Wire.h>

// Create sensor objects
Adafruit_AHTX0 aht;
Adafruit_BMP280 bmp; 

//set up serial monitor and sensors
void setup() {
  Serial.begin(115200);
  while (!Serial); //Wait for Serial Monitor to open

  Wire.begin();

  Serial.println("Scanning I2C bus...");

  int devicesFound = 0;

  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);

    if (Wire.endTransmission() == 0) {
      Serial.printf("Device found at 0x%02X\n", address);
      devicesFound++;
    }
  }

  Serial.printf("Total devices found: %d\n", devicesFound);

  //Intialise AHT20 sensor
  if (!aht.begin()) {
    Serial.println("Could not find AHT20 sensor!");
    while (1);
  }
  Serial.println("AHT20 sensor found!");

  //Intialise BMP 280 sensor
  if (!bmp.begin(0x77)) {
    Serial.println("Could not find BMP 280 sensor!");
    while (1);
  }
  Serial.println("BMP280 sensor found!");
}

void loop() {
  // AHT20 Reading
  sensors_event_t humidity, temp;
  aht.getEvent(&humidity, &temp);

  int tempInt = (int)temp.temperature;
  int humidityInt = (int)humidity.relative_humidity;

  // BMP280 Reading
  int  pressure = bmp.readPressure() / 100.0F; // Convert to hPa
  int altitude = bmp.readAltitude(1013.25); // Sea Level pressure in hPa

  //print serial data to serial monitor

  // Print AHT20 data
  Serial.print("AHT20 Temperature 🌡️: ");
  Serial.print(tempInt);
  Serial.print(" °C, Humidity 💧: ");
  Serial.print(humidityInt);
  Serial.println(" %");
  // Print BMP280 data
  Serial.print("BMP280 Pressure 📈📉📊: ");
  Serial.print(pressure);
  Serial.print(" hPa, Altitude 🏞️: ");
  Serial.print(altitude);
  Serial.println(" m");

  // Print separator
  Serial.println("-----------------------------------------------------------------------------");

  delay(5000); // Wait for 5 seconds before next reading
}
