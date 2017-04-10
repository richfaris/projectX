/*
* Copyright (c) 2015 - 2016 Intel Corporation.
*
* Permission is hereby granted, free of charge, to any person obtaining
* a copy of this software and associated documentation files (the
* "Software"), to deal in the Software without restriction, including
* without limitation the rights to use, copy, modify, merge, publish,
* distribute, sublicense, and/or sell copies of the Software, and to
* permit persons to whom the Software is furnished to do so, subject to
* the following conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
* LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
* OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
* WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";
var verboseDebug = true;

// The program is using the Node.js built-in `fs` module
// to load the config.json and html file used to configure the alarm time
var fs = require("fs");

// The program is using the Node.js built-in `path` module to find
// the file path to the html file used to configure the alarm time
var path = require("path");

// Load configuration data from `config.json` file. Edit this file
// to change to correct values for your configuration
var config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"))
);


// The program is using the `moment` module for easier time-based calculations,
// to determine when the alarm should be sounded.
var moment = require("moment");

// Initialize the hardware for whichever kit we are using
var board;
if (config.kit) {
  board = require("./" + config.kit + ".js");
} else {
  board = require('./grove.js');
}
board.init(config);

var datastore = require("./datastore");
var mqtt = require("./mqtt");

// State of the system
var night, morning;
night = moment();
morning = moment();
if (verboseDebug) console.log("Initial values for night ",night," morning ",morning); 
// Start the clock
// rjf TODO need to check to see if time is in the dark zone
//

var mraa = require("mraa");
var myLight = new mraa.Gpio(8);
myLight.dir(mraa.DIR_OUT);

var mySW = new mraa.Gpio(4);
mySW.dir(mraa.DIR_IN);
var mySWState = 0, mySWNew = 0, myLightOn = 0;
// I need to add a call to other board to get proper state of second light
var hisLightOn = 0;  
var hisBoardClient = require("socket.io-client");
var hisSocket = hisBoardClient.connect("http://192.168.1.182:3000");


// get my ip address
//
var ipAddress = "";

var exec = require('child_process').exec;
    exec('ip a | grep wlan0 | grep inet | awk \'{print substr($2,1,index($2,"/")-1)}\'', function(error, stdout, stderr) {
    if (verboseDebug)  console.log('stdout: ' + stdout + ' stderr: ' + stderr);
    if (error != null) {
        console.log('In ip discovery: exec error: ' + error);
   }  
   
   ipAddress = stdout.trim();  
   if (verboseDebug) console.log("My ip address is " + ipAddress ); 
   });  

// is this a hack?
var time;

var chatterCount = 100, reads=0;
function startClockLoop() {
  function after(a, b) { return a.isAfter(b, "second"); }
  function same(a, b) { return a.isSame(b, "second"); }

  setInterval(function() {
    time = moment();
    // check if display needs to be updated
    // if (after(time, current)) {
    //   if (undefined != alarm) 
    //     {board.message(time.format("h:mm:ss A"),0);
    //      board.message("Alm "+alarm.format("h.mm.ss A"),1);
    //      board.color("blue");}
    //   else
    //     {board.message(time.format("h:mm:ss A"),0);}
    //   if (same(current, alarm)) { startAlarm(); }
    // }
    // current = time;
//  if (after(time, nightoff)) { Start Night Off time ;}
//  if (after(time, morningon)) {turn off night handling }

    board.message("T "+time.format("h:mm:ss A"),0);
    board.message("IP "+ipAddress,1);
//    board.message("O "+night.format("h.mm A ")+morning.format("h.mm A"),1);  
    mySWNew = mySW.read();
    reads+=1;

    if (verboseDebug && (reads == chatterCount)) {
       console.log("In startClockLoop: reading switch mySWNew ", mySWNew, " mySWState ", mySWState);
       reads = 0; };
    if (mySWNew != mySWState) {
       if (mySWNew == 1) {
         myLightOn = 1;
         myLight.write(1);
         board.color("yellow");
//        hisSocket.emit('myLightOn', { hisLightOn: 'toggle' });
         hisSocket.emit('myLightOn', { myLightOn: 'toggle' }, function(confData) {
         if (confData) console.log("In server, controlling other server Return socket.emit status from myLightOn ",confData);
            else console.log("In client Return socket.emit status for myLightToggle FAIL ",confData);
         });
       
  // mySocket.emit reload web page
} else { 
        myLightOn = 0;
        myLight.write(0);
        board.color("red");
//      hisSocket.emit('myLightOff', { hisLightOff: 'toggle' });
        hisSocket.emit('myLightToggle', { myLightOff: 'toggle' }, function(confData) {
        if (confData) console.log("In client Return socket.emit status from myLightOff ",confData);
           else console.log("In client Return socket.emit status for myLightOff FAIL ",confData);
      });
}
}
    mySWState = mySWNew;
}, 200 );
} 
// TODO rich should I change the granularity to more coarse?
// var mraa = require("mraa");
// Display and then store record in the remote datastore and/or mqtt server
// of how long the alarm was ringing before it was turned off
function logging(duration) {
  console.log("Time to log something:" + duration);

  var payload = { value: duration };
  datastore.log(config, payload);
  mqtt.log(config, payload);
}

var tempF = 999.9;

function startTempSensor() {
var a, resistance, tempC;
var B = 3975;
//GROVE Kit A1 Connector --> Aio(1)
// var mraa = require("mraa");
var myAnalogPin = new mraa.Aio(1);

console.log("Enabling temperature sensor...");

var myTemperatureInterval = setInterval( function () {
      a = myAnalogPin.read();
           
      resistance = (1023 - a) * 10000 / a; //get the resistance of the sensor;
      tempC = 1 / (Math.log(resistance / 10000) / B + 1 / 298.15) - 273.15;//convert to temperature via datasheet ;
      //console.log("Celsius Temperature "+celsius_temperature); 
      tempF = (tempC * (9 / 5)) + 32;

}, 5000);


// When exiting: clear interval and print message

// process.on('SIGINT', function()

// {
//   clearInterval(myProximityInterval);
//   clearInterval(myTemperatureInterval);
//   console.log("Exiting...");
//   process.exit(0);
// });
}

function startDistanceSensor() {
console.log("Enabling distance sensor...");
var ultrasonic = require("jsupm_groveultrasonic");
var sensor = new ultrasonic.GroveUltraSonic(7);
var distance;

var myProximityInterval = setInterval(function()  {
var travelTime = sensor.getDistance();

if (travelTime > 0) {
    distance = (travelTime / 29 / 2).toFixed(3);
//    if (distance < 50) {
    console.log("Currenttime ",time, " travelTime "+travelTime+" distance: " + distance + " [cm]"); 
}
}, 500); }

// Starts the built-in web server that serves up the web page
// used to interact with the edison
//
function doServer() {
  var app = require("express")();
  var server = require('http').Server(app);
  var io = require('socket.io')(server);
  
  var result;

// change this to write into a json file and load into browser every time

function index(res) {
    function stringNserve(err, data) {
      var r1, r2, r3, r4;
      var tempString = tempF.toString();
      var tempShort = tempString.substr(0,4);
      if (err) { return console.log(err); }
          r1 = data.replace(/tempNowXYZZY/, tempShort );
    if (myLightOn) {
        r2 = r1.replace(/myLightXYZZY/, "BulbOn.jpg" ); 
         }
    else {
        r2 = r1.replace(/myLightXYZZY/, "BulbOff.jpg" ); 
         };
    if (hisLightOn) {
        r3 = r2.replace(/hisLightXYZZY/, "BulbOn.jpg" ); 
         }
    else {
        r3 = r2.replace(/hisLightXYZZY/, "BulbOff.jpg" ); 
         };
        r4 = r3.replace(/ipNowXYZZY/, ipAddress );
        result = r4;
        res.send(result);
    }
    fs.readFile(path.join(__dirname, "index.html"), {encoding: "utf-8"}, stringNserve);
};

// read the added data from URL to see alarm time
//
app.get('/', function (req, res) {
    var params = req.query;
    if (verboseDebug) console.log("Entering app.get slash night ", night, " morning ",morning);

// first set time baseline to NOW
// then make morning tomorrow morning
// then fill in the actual hours.  default of 11,1 and 5,1 or what comes from the form
//
   night = moment();
   morning = moment();

    night.hour(+params.nighthour);
    night.minute(+params.nightminute);

    morning.hour(+params.morninghour);
    morning.minute(+params.morningminute);
    morning.add(1, "day");

    if (verboseDebug) console.log("Almost leaving app.get slash night ", night, " morning ",morning);
    index(res);
});

app.get('/*.css', function (req, res) {
  if (verboseDebug)  console.log("Entering app.get CSS"); 
  res.sendFile(path.join(__dirname, 'styles.css' ));
});

app.get('/BulbOn.jpg', function (req, res) {
if (verboseDebug) console.log("Entering app.get BulbOn"); 
  res.sendFile(path.join(__dirname, 'BulbOn.jpg' ));
});

app.get('/BulbOff.jpg', function (req, res) {
if (verboseDebug) console.log("Entering app.get BulbOff");
  res.sendFile(path.join(__dirname, 'BulbOff.jpg' ));
});

function json(req, res) {
if (verboseDebug) console.log("Entering json req res"); 

// if no values are entered default to 11pm, 5am with 1 minute so I can recognize default
//
if ((night.hour() == 0)  || (morning.hour() == 0 )) { return res.json({ nighthour: 23, nightminute: 1, morninghour: 5, morningminute: 1 }); };

    res.json({
      nighthour: night.hour() || 0,
      nightminute: night.minute() || 0, 
      morninghour: morning.hour() || 0,
      morningminute: morning.minute() || 0
    });
// nice try but this should start with setting both moments to NOW, then moving the hours, and adding one day for tomorrow morning
//    morning = morning.add(1, "day");

    if (verboseDebug) console.log("in res.json night.hour ", night.hour() );
    if (verboseDebug) console.log("in res.json night.minute ", night.minute() );
    if (verboseDebug) console.log("in res.json morning.hour ", morning.hour() );
    if (verboseDebug) console.log("in res.json morning.minute ", morning.minute() );
};

app.get('/curfew.json', json);

server.listen(3000);

// this section communicates with the webui(s) that want to talk

io.on('connection', function (mySocket) {

mySocket.on('myLightToggle', function(data, confirmation) {
    console.log("In server mySocket.on got myLightToggle message ", data);
    myLightOn = !myLightOn;
    console.log("In server mySocket.on, myLight now ", myLightOn);
    if (myLightOn == 1) 
      { myLight.write(1); board.color("yellow") }
    else 
      { myLight.write(0); board.color("red") };
    confirmation(true);
    mySocket.emit('reload', 'becauseISaidSo', function(retVal) {
    if (retVal) console.log("In server mySocket.emit reload worked ",retVal);
    else console.log("In server mySocket.emit reload FAILED ",retVal);
});
});

mySocket.on('myLightOn', function(data, confirmation) {
    console.log("in server mySocket.on got myLightOn message ",data);
    myLightOn = 1;  
    console.log("In server mySocket.on, myLight ", myLightOn);
    myLight.write(1);
    board.color("yellow");
    confirmation(true);
    mySocket.emit('reload', true);
});

mySocket.on('myLightOff', function(data, confirmation) {
    console.log("in server mySocket.on got myLightOff message ",data);
    myLightOn = 0;  
    console.log("In server mySocket.on, myLight ", myLightOn);
    myLight.write(0);
    board.color("red");
    confirmation(true);
    mySocket.emit('reload', true);
});
});
};

function main() {
console.log("project Maui Starting...")
  board.stopBuzzing();
  board.setupEvents();

  myLight.write(0);
  board.color("red");

  startClockLoop();
  startDistanceSensor();
  startTempSensor();
  doServer();
}

main();
