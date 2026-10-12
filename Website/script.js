//Create variables for when the websocket is setup
var gateway = `ws://${window.location.hostname}/ws`;
var websocket;

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
}

//If the websocket closes wait 2 seconds and reopen it
function onClose(event) {
    console.log("WebSocket closed");
    setTimeout(initWebSocket, 2000);
}

//when the web server/esp sends a message it will be a JSON array
    //should be like
    // 0: {pinNum: '2', state: '0'}
    // 1: {pinNum: '13', state: '0'}
    // 2: {r: '0', g: '255', b: '0'}
//save those values, send to the console for debugging, then update the webpage to match what the webserver has
//as we are sending it rgb values it may be more efficient to just take the button after suitable fault checking 
function onMessage(event) {
    var myObj = JSON.parse(event.data);
    console.log(myObj);

    var temperature = myObj.values[0].value;
    var humidity = myObj.values[1].value;
    var lightLevel = myObj.values[2].value;
    var alarmTime = myObj.values[3].value;
    var DateTime = myObj.values[4].value;

    //fault checking values read correctly
    console.log(temperature);
    console.log(humidity);
    console.log(lightLevel);
    console.log(alarmTime);
    console.log(DateTime);

    //sensor values are displayed on the webpage
    document.getElementById("tempValue").innerHTML = temperature;
    document.getElementById("humidityValue").innerHTML = humidity;
    document.getElementById("lightValue").innerHTML = lightLevel;
    document.getElementById("alarmTimeValue").innerHTML = alarmTime;
    document.getElementById("dateTimeValue").innerHTML = DateTime;

    console.log(event.data);
}

//Gets the value in the RED slider and displays it on the screen, in the console for debugging, and calls sendRGB
function updatetestColor1(element) {
    var input1 = document.getElementById("testColor1").value;
    document.getElementById("redVal").innerHTML = input1;
    console.log(input1);
    sendRGB();
}

//Gets the value in the GREEN slider and displays it on the screen, in the console for debugging, and calls sendRGB
function updatetestColor2(element) {
    var input2 = document.getElementById("testColor2").value;
    document.getElementById("greenVal").innerHTML = input2;
    console.log(input2);
    sendRGB();
}

//Gets the value in the BLUE slider and displays it on the screen, in the console for debugging, and calls sendRGB
function updatetestColor3(element) {
    var input3 = document.getElementById("testColor3").value;
    document.getElementById("blueVal").innerHTML = input3;
    console.log(input3);
    sendRGB();
}

//Gets the three RGB values from the webpage and sends them in a rgb(0,0,0) format back to the webserver/esp
function sendRGB() {
    var input1 = document.getElementById("testColor1").value;
    var input2 = document.getElementById("testColor2").value;
    var input3 = document.getElementById("testColor3").value;

    var rgb = "rgb(" + input1 + "," + input2 + "," + input3 + ")";
    websocket.send(rgb);
}

//Sends a message to the webserver/esp to get the states of variables we care about when the webpage loads for the first time
function getStates() {
    //this triggers a notifyClients method in the c++ file which comes back by the onMessage function
    websocket.send("getStates");
}
