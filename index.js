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
var verboseDebug = true, vverboseDebug = false;

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

// Set the curfew times

function after(a, b) { return a.isAfter(b, "second"); }
function same(a, b) { return a.isSame(b, "second"); }

var night, morning;
night = moment();
morning = moment();

// define dark times
// replace this with calls to weather.com to get sunset and sunrise...
// every day these need to get rerun or the sensor will never fire
//
var darknight = moment();
darknight.hour(18);
darknight.minute(0);

var darkmorning = moment();
darkmorning.hour(5);
darkmorning.minute(0);
darkmorning.add(1, "day");
var timelast = moment();
var isNotResetYet = true;

var time = moment();
if (verboseDebug) console.log(time," Initial values for darknight ",darknight," darkmorning ",darkmorning); 
if (verboseDebug) console.log(time," Value for timelast ",timelast); 
if (verboseDebug) console.log(time," Initial values for night ",night," morning ",morning); 
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
    if (vverboseDebug)  console.log(time,'stdout: ' + stdout + ' stderr: ' + stderr);
    if (error != null) {
        console.log('In ip discovery: exec error: ' + error);
   }  
   
   ipAddress = stdout.trim();  
   if (verboseDebug) console.log(time," My ip address is " + ipAddress ); 
   });  

// is this a hack?


var chatterCount = 100, reads = 0, isCurfew = false, isDark = false;

function startClockLoop() {

  setInterval(function() {
    time = moment();

    if (after(darknight, time)) {
       if (!isDark) { isDark = true; };
    }

    if (after(darkmorning, time)) {
       if (isDark) { isDark = false; };
    }

    if (after(night, time)) {
    if ((isCurfew == true) && (myLightOn == 1)) {  // should be changed to just the first time after Curfew
        console.log(time," Curfew is here, turning off lights: isCurfew ", isCurfew);
        myLightOn = 0;
        myLight.write(0);
        board.color("blue");
    }
  }  // end after night...
    if (after(morning, time)) {
        if (isCurfew) {
      isCurfew = false;
      console.log(time," Curfew is over, turn board to white: isCurfew ", isCurfew);
      board.color("white");
  }
    }



    // under what circumstances to I reset the timelast?
    //
    // report all of this to the UI for debugging and information purposes once we get nightfall and sunrise
    //
    if (after(timelast, time)) {
        if (isNotResetYet) {
      isNotResetYet = false;
      darknight = moment();
      darknight.hour(18);
      darknight.minute(0);
      darkmorning = moment();
      darkmorning.hour(5);
      darkmorning.minute(0);
      darkmorning.add(1, "day");
      
  }
}
    board.message("T "+time.format("h:mm:ss A"),0);
    board.message("IP "+ipAddress,1);
    mySWNew = mySW.read();
    reads+=1;
    if (verboseDebug && (reads == chatterCount)) {
       console.log(time," In startClockLoop: reading switch mySWNew ", mySWNew, " mySWState ", mySWState);
       reads = 0; };
    if (mySWNew != mySWState) {
       if (mySWNew == 1) {
         myLightOn = 1;
         myLight.write(1);
         board.color("yellow");
         hisSocket.emit('myLightOn', { myLightOn: 'Onxyzzy' }, function(confData) {
         if (confData) console.log(time," In server, controlling other server Return socket.emit status from myLightOn ",confData);
            else console.log(time," In client Return socket.emit status for myLightOn FAIL ",confData);
         });      
  // mySocket.emit reload web page
} else { 
        myLightOn = 0;
        myLight.write(0);
        board.color("red");
        hisSocket.emit('myLightOff', { myLightOff: 'Offxyzzy' }, function(confData) {
        if (confData) console.log(time," In server Return socket.emit status from myLightOff ",confData);
           else console.log(time," In client Return socket.emit status for myLightOff FAIL ",confData);
      });
}
}
    mySWState = mySWNew;
}, 200 );
}  // end startClockLoop

// Display and then store record in the remote datastore and/or mqtt server
// of how long the alarm was ringing before it was turned off
function logging(duration) {
  console.log(time," Time to log something:" + duration);

  var payload = { value: duration };
  datastore.log(config, payload);
  mqtt.log(config, payload);
}

var tempF = 999.9;
var flashing = 0;

function startTempSensor() {
var a, resistance, tempC;
var B = 3975;
//GROVE Kit A1 Connector --> Aio(1)
// var mraa = require("mraa");
var myAnalogPin = new mraa.Aio(1);

console.log(time," Enabling temperature sensor...");

var myTemperatureInterval = setInterval( function () {
      a = myAnalogPin.read();
           
      resistance = (1023 - a) * 10000 / a; //get the resistance of the sensor;
      tempC = 1 / (Math.log(resistance / 10000) / B + 1 / 298.15) - 273.15;//convert to temperature via datasheet ;
      tempF = (tempC * (9 / 5)) + 32;

}, 5000);
}  // end startTempSensor

var previousTime = moment();

function startDistanceSensor() {
console.log(time," Enabling distance sensor...");
var ultrasonic = require("jsupm_groveultrasonic");
var sensor = new ultrasonic.GroveUltraSonic(7);
var distance;
var confData;

var myProximityInterval = setInterval(function()  {
var travelTime = sensor.getDistance();

if (travelTime > 0) {
    distance = (travelTime / 29 / 2).toFixed(3);

      
      if ((distance < 243.84) && (ipAddress == "192.168.1.182") && (!flashing) && (!myLightOn) && (isDark)) {
             if (verboseDebug) 
        console.log(time," Ultrasonic triggered Time: ",time, " previousTime: ", previousTime, " diff: ", time.diff(previousTime), " distance: ", distance," flashing ",flashing," myLightOn ", myLightOn, " isDark ",isDark);
                flashFive(); 
                flashHisFive(); 
        }     
      previousTime = time; 
 }  // end traveltime > 0
}   // end setInterval
, 200); 
}  // end startDistanceSensor

function flashHisFive() {
hisSocket.emit('flashMyFive', { flashMyFive: 'DoFlashOrElse' }, function(confData) {
   if (confData) console.log(time," In server, flashMyFive ",confData);
      else console.log(time," In server flashMyFive FAIL ",confData);
   });
}

function flashLCD() {
 var i; 
   for (let i=0; i < 6; i++ ) {
    setTimeout(function timer1() {
        board.color("yellow");
        console.log(time," Im yellow i= ",i);        
    }, i*5000);
    setTimeout(function timer2() {
        board.color("red");
        console.log(time," Im red i= ",i);        
  }, (i*5000)+2500);
}  // end i loop 
}

function flashFive() {

// for total of how long?
//
   flashing = 1;
   console.log(time, "In FlashFive flashing ON",flashing);
   flashLCD();
   myLightOn = 1;
   myLight.write(1);
   hisSocket.emit('myLightOn', { myLightOn: 'zyZZyOn' }, function(confData) {
   if (confData) console.log(time," In server, controlling other server Return socket.emit status from myLightOn ",confData);
      else console.log(time," In server flashFive Return socket.emit status for myLightOn FAIL ",confData);
   });
   setTimeout(function timer3() {
      myLightOn = 0;
      myLight.write(0);
      board.color("red");
      console.log(time," Final red");
      hisSocket.emit('myLightOff', { myLightOff: 'zyZZyOff' }, function(confData) {
        if (confData) console.log(time," In server flashFive Return socket.emit status from myLightOff ",confData);
           else console.log(time," In server flashFive Return socket.emit status for myLightOff FAIL ",confData);
      flashing = 0;
      console.log(time, "In FlashFive flashing OFF",flashing);
      if (isCurfew) { board.color("blue"); }
          else { board.color("red"); }
      });
   }, 30000);
}  // end flashfive




// When exiting: clear interval and print message
process.on('SIGINT', function()
{
  clearInterval(myProximityInterval);
  console.log(time," Exiting...");
  process.exit(0);
});



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
    if (verboseDebug) console.log(time," Entering app.get slash night ", night, " morning ",morning);

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

    if (verboseDebug) console.log(time," Almost leaving app.get slash night ", night, " morning ",morning);
    if (after(darkmorning, morning)) timelast = darkmorning; else timelast = morning;
    if (verboseDebug) console.log(time," Almost leaving app.get slash darknight ", darknight, " darkmorning  ",darkmorning, " timelast ", timelast);

    index(res);
});

app.get('/*.css', function (req, res) {
  if (verboseDebug)  console.log(time," Entering app.get CSS"); 
  res.sendFile(path.join(__dirname, 'styles.css' ));
});

app.get('/BulbOn.jpg', function (req, res) {
if (verboseDebug) console.log(time," Entering app.get BulbOn"); 
  res.sendFile(path.join(__dirname, 'BulbOn.jpg' ));
});

app.get('/BulbOff.jpg', function (req, res) {
if (verboseDebug) console.log("Entering app.get BulbOff");
  res.sendFile(path.join(__dirname, 'BulbOff.jpg' ));
});

function json(req, res) {
if (verboseDebug) console.log(time," Entering json req res"); 

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

    if (vverboseDebug) console.log(time," in res.json night.hour ", night.hour() );
    if (vverboseDebug) console.log(time," in res.json night.minute ", night.minute() );
    if (vverboseDebug) console.log(time," in res.json morning.hour ", morning.hour() );
    if (vverboseDebug) console.log(time," in res.json morning.minute ", morning.minute() );
};

app.get('/curfew.json', json);

server.listen(3000);

// this section communicates with the webui(s) that want to talk

io.on('connection', function (mySocket) {

mySocket.on('myLightToggle', function(data, confirmation) {
    console.log(time," In server mySocket.on got myLightToggle message ", data);
    myLightOn = !myLightOn;
    console.log(time," In server mySocket.on, myLight now ", myLightOn);
    if (myLightOn == 1) 
      { myLight.write(1); board.color("yellow") }
    else 
      { myLight.write(0); board.color("red") };
    confirmation(true);
    mySocket.emit('reload', 'becauseISaidSo', function(retVal) {
    if (retVal) console.log(time," In server mySocket.emit reload worked ",retVal);
    else console.log(time," In server mySocket.emit reload FAILED ",retVal);
});
});

mySocket.on('myLightOn', function(data, confirmation) {
    console.log(time," in server mySocket.on got myLightOn message ",data);
    myLightOn = 1;  
    console.log(time," In server mySocket.on, myLight ", myLightOn);
    myLight.write(1);
    board.color("yellow");
    confirmation(true);
    mySocket.emit('reload', true);
});

mySocket.on('myLightOff', function(data, confirmation) {
    console.log(time," In server mySocket.on got myLightOff message ",data);
    myLightOn = 0;  
    console.log(time," In server mySocket.on, myLight ", myLightOn);
    myLight.write(0);
    board.color("red");
    confirmation(true);
    mySocket.emit('reload', true);
});

mySocket.on('flashMyFive', function(data, confirmation) {
    console.log(time," in server mySocket.on got flashMyFive message ",data);
    if (isDark) flashFive(); else console.log(time," flashFive requested from partner, but it's not dark ");
});

});
};

function main() {
console.log(time," project Maui Starting...")
  board.stopBuzzing();
  board.setupEvents();

  myLight.write(0);
  board.color("red");

  startClockLoop();
  startTempSensor();
  startDistanceSensor();
  console.log(time," Starting Server...")
  doServer();  
}

main();
