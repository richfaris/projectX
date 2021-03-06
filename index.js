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


// The program is using the `superagent` module
// to make the remote calls to the Weather Underground API
var request = require("superagent");


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
night.hour(23);
night.minute(1);
morning = moment();
morning.hour(4);
morning.minute(1);

// define dark times
// replace this with calls to weather.com to get sunset and sunrise...
// every day these need to get rerun or the sensor will never fire
//
var darknight = moment();
darknight.hour(18);
darknight.minute(1);
var darkmorning = moment();
darkmorning.hour(7);
darkmorning.minute(1);


var time = moment();
if (verboseDebug) console.log(time," Initial values for darknight ",darknight," darkmorning ",darkmorning);
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
var conditions = "uninit";
// I need to add a call to other board to get proper state of second light
var hisLightOn = 0;  
var hisBoardClient = require("socket.io-client");


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
var connectString;
if (ipAddress == "192.168.1.61" ) 
    { connectString = "http://192.168.1.182:3000"; } else 
    { connectString = "http://192.168.1.61:3000" ; }
var hisSocket = hisBoardClient.connect(connectString);


// Call the remote Weather Underground API to check the weather conditions
// change the LOCATION variable to set the location for which you want.
//
function getWeather() {
  if (!config.WEATHER_API_KEY) { return; }

  var url = "http://api.wunderground.com/api/";

  url += config.WEATHER_API_KEY;
  url += "/conditions/q/CA/" + config.LOCATION + ".json";

  function display(err, res) {
    if (err) { return console.error("unable to get weather data", res.text); }
    conditions = res.body.current_observation.weather;
    console.log(time, "forecast: ", conditions);
//    board.message(conditions, 1);
  }

  request.get(url).end(display);
}


// this is the main loop of the program that checks the sensors and takes action, updates the screen
// RJF consider going in and checking status more carefully on all calls
// RJF consider adding testability logic so I can run unit tests


var chatterCount = 200, weatherCount = 900000, reads = 0, weatherLookups = 0, isCurfew = false, isDark = false;
var darkString = "", curfewString = "";
var line2;

// this is the main loop of the program that checks the sensors and takes action, updates the screen
// RJF consider going in and checking status more carefully on all calls
// RJF consider adding testability logic so I can run unit tests

// 900,000 is one weather lookup every 15 minutes
// 300 is 60seconds
getWeather();
if (verboseDebug) console.log(time, "Got first weather report: conditions are: ",conditions);

function startClockLoop() {
  setInterval(function() {
    time = moment();

// RFJ need to reduce this to much less frequently
    if (weatherLookups > weatherCount) {
        getWeather();
        weatherLookups = 0;
      }
      else weatherLookups +=1;

    if (vverboseDebug) console.log(time," time.hour ",time.hour(), 
      " time.minute ", time.minute(),
      " darknight.hour ", darknight.hour(),
      " darknight.minute ", darknight.minute(),
      " night.hour ", night.hour(), " night.minute ", night.minute(),
      " morning.hour ", morning.hour(), " morning.minute ", morning.minute());

// this is to see if current time is within the window of "dark time" and thus we will allow the sensor to turn on the light

if ( (((time.minute() >= darknight.minute()) && (time.hour() == darknight.hour()))  ||  (time.hour() >= darknight.hour() ) ) || 
      ((time.minute() <= darkmorning.minute()) && (time.hour() == darkmorning.hour())) || (time.hour() < darkmorning.hour())   )
      isDark = true; else isDark = false;

// this is to see if the current time is inside Curfew hours.  Curfew naturally turns off the light at curfew start
// allows the Ultrasonic to trigger the lights, but if someone explicitly clicks the lights back on, allows it and doesn't 
// set it back to off ever
// RJF option to make lightswitch turn after curfew to a 30 second flashing period too.

if ( (((time.minute() >= night.minute()) && (time.hour() == night.hour()))  ||  (time.hour() >= night.hour() ) ) || 
      ((time.minute() <= morning.minute()) && (time.hour() == morning.hour()))  || (time.hour() < morning.hour())   )
      isCurfew = true; else isCurfew = false;

// update the 2 line display.  right now what we are writing on the screen isn't super useful, I'm mostly using colors
// to denote the state of the system, which is good
// RJF what could I add to the display to make it better?
// RJF maybe a notification of isDark or isCurfew would help, even a Dd Cc kind of shortcut


if (isDark)   { darkString = "D" } else {darkString = "d" };
if (isCurfew) { curfewString = "C" } else {curfewString = "c" };

// add temperature here too

    var c1 = conditions.substr(0,15).replace(/\s+/g, ''); // substring(conditions, 1, 9);
  //  var c2 =   // how to make a degree character?
    line2 = c1+" "+darkString+curfewString;


//    board.message(time.format("h:mm A")+" F"+"\xEF"+tempF.toString().substr(0,4)+"",0);
    board.message(time.format("h:mm A")+" "+tempF.toString().substr(0,4)+"",0);

    board.message(line2,1);
    mySWNew = mySW.read();
    reads+=1;
    if (verboseDebug && (reads == chatterCount)) {
       console.log(time," In startClockLoop: mySWNew ", mySWNew, " mySWState ", mySWState," Curfews ", night, morning, " darktimes ", darknight, darkmorning, " isDark ",isDark, " isCurfew ", isCurfew);
       reads = 0; 
       };

// here is the switch reading code.  I'm going to change it to a 1 is up and 0 is down logic.  to a three way switch logic
//
    if (mySWNew != mySWState) {
         myLightOn = !myLightOn;
         if (!myLightOn) 
            { myLight.write(0); board.color("red"); myLightOn = false;
            hisSocket.emit('myLightOff', { myLightOff: 'XYZZY' }, function(confData) {
            if (confData) console.log(time, "Tell him to turn off his light ",confData);
            else console.log(time, "Telling him to turn off his light: myLightOff FAIL ",confData);      
            }) // end of emit
           }   // end of turning off lights
         else 
            { myLight.write(1); board.color("yellow"); myLightOn = true; 
            hisSocket.emit('myLightOn', { myLightOn: 'XYZZY' }, function(confData) {
            if (confData) console.log(time, "Tell him to turn on his light ",confData);
            else console.log(time, "Telling him to turn on his light: myLightOn FAIL ",confData);
            }); // end of emit
            };   // end of turning on lights
    }; // end of checking for switch change
    mySWState = mySWNew;
}, 200 );
}  // end startClockLoop 

// Display and then store record in the remote datastore and/or mqtt server
// of how long the alarm was ringing before it was turned off
function logging(duration) {
  console.log(time," Time to log something:");

  var payload = { 
                  pTime: time,
                  pDark: isDark,
                  pCurfew: isCurfew,
                  pLightOn: myLightOn,
                  pTemp: tempF
                };
  datastore.log(config, payload);
  mqtt.log(config, payload);
}

// Call the remote Weather Underground API to check the weather conditions
// change the LOCATION variable to set the location for which you want.
//
function getWeather() {
  if (!config.WEATHER_API_KEY) { return; }

  var url = "http://api.wunderground.com/api/";

  url += config.WEATHER_API_KEY;
  url += "/conditions/q/CA/" + config.LOCATION + ".json";

  function display(err, res) {
    if (err) { return console.error("unable to get weather data", res.text); }
    conditions = res.body.current_observation.weather;
    console.log(time, "forecast: ", conditions);
  }

  request.get(url).end(display);
}


var tempF = 999.9;
var isFlashing = 0;

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

      if ((distance < 457.2) && (ipAddress == "192.168.1.182") && (!isFlashing) && (isDark) ) {
            if (verboseDebug) console.log(time," Ultrasonic triggered Time: ",time, 
             " distance: ", distance," isFlashing ",isFlashing," myLightOn ", myLightOn, " isDark ",isDark, " isCurfew ", isCurfew);
      flashFive(); 
      flashHisFive(); 
    }   // sidtance less than threshhold
    }   // traveltime >0 
}   // end setInterval
, 200); 
}  // end startDistanceSensor

function flashHisFive() {
hisSocket.emit('flashMyFive', { flashMyFive: 'DoFlashOrElse' }, function(confData) {
   if (confData) console.log(time," In server, flashMyFive ",confData);
      else console.log(time," In server flashMyFive FAIL ",confData);
   });
} // end flashHisFive

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
}  // end flashLCD

function flashFive() {

// for 30 seconds
//
   isFlashing = 1;
   console.log(time, "In FlashFive isFlashing ON",isFlashing);
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
      isFlashing = 0;
      console.log(time, "In FlashFive isFlashing OFF",isFlashing);
      if (isCurfew) { board.color("blue"); }
          else { board.color("red"); }
      });
   }, 60000);
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
      var r1, r2, r3, r4, r5, r6;
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
        r5 = r4.replace(/isCurfewXYZZY/, isCurfew );
        r6 = r5.replace(/isDarkXYZZY/, isDark );
        result = r6;
        res.send(result);
    }
    fs.readFile(path.join(__dirname, "index.html"), {encoding: "utf-8"}, stringNserve);
};

// read the added data from URL to see alarm time
//
app.get('/', function (req, res) {
    var params = req.query;
    if (verboseDebug) console.log(time," Entering app.get slash night get curfew ", night, " morning ",morning);

// first set time baseline to NOW
// then make morning tomorrow morning
// then fill in the actual hours.  default of 11,1 and 5,1 or what comes from the form
//
   if (verboseDebug) console.log(time," Parameters to app.get: #",params,"# length ",params.length);
 //  if (params.length < 6) {
 //    night.hour(23);
 //   night.minute(9);
//     morning.hour(4);
//     morning.minute(9);
  // }
//   else {
	night = moment();
	morning = moment();
	night.hour(+params.nighthour);
	night.minute(+params.nightminute);
  morning.hour(+params.morninghour);
  morning.minute(+params.morningminute);
//   }
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

if (verboseDebug) console.log(time," Entering json "); 

    if (verboseDebug) console.log(time," before in res.json night.hour ", night.hour() );
    if (verboseDebug) console.log(time," before in res.json night.minute ", night.minute() );
    if (verboseDebug) console.log(time," before in res.json morning.hour ", morning.hour() );
    if (verboseDebug) console.log(time," before in res.json morning.minute ", morning.minute() );


// if no values are entered default to 11pm, 5am with 1 minute so I can recognize default
// rJF need better way to say time is not valid and set it to default
//

if ((night.hour() == 0) || 
//    (isNaN(night.hour()) || 
    (night.minute() == 0) 
//    || 
//    (isNaN(night.minute())
      ) 
      { return res.json({ nighthour: 22, nightminute: 2, morninghour: 4, morningminute: 2 }); };


    res.json({
      nighthour: night.hour() || 22,
      nightminute: night.minute() || 3, 
      morninghour: morning.hour() || 4,
      morningminute: morning.minute() || 3
    });

    if (verboseDebug) console.log(time," after in res.json night.hour ", night.hour() );
    if (verboseDebug) console.log(time," after in res.json night.minute ", night.minute() );
    if (verboseDebug) console.log(time," after in res.json morning.hour ", morning.hour() );
    if (verboseDebug) console.log(time," after in res.json morning.minute ", morning.minute() );
}; // end function json

app.get('/curfew.json', json);

server.listen(3000);

// this section communicates with the webui(s) that want to talk

io.on('connection', function (mySocket) {

mySocket.on('myLightToggle', function(data, confirmation) {
  
    console.log(time," In server mySocket.on got myLightToggle message ", data);
    myLightOn = !myLightOn;
    console.log(time," In server mySocket.on, myLight now ", myLightOn);
    if (myLightOn) 
      { myLight.write(1); board.color("yellow") }
    else 
      { myLight.write(0); board.color("red") };
    confirmation(true);
    mySocket.emit('reload', 'becauseISaidSo', function(retVal) {
    if (retVal) console.log(time," In server mySocket.emit reload worked ",retVal);
    else console.log(time," In server mySocket.emit reload FAILED ",retVal);
}); // end mysocket.emit
}); // end mysocket.on toggle


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

}); // end of io.on
};  // end of doserver

function main() {
console.log(time," project Maui Starting...")

// print process.argv
//   process.argv.forEach(function (val, index, array) {
//     console.log(index + ': ' + val);
// });

  board.stopBuzzing();
  board.setupEvents();

// need to ensure that at startup both lights are in a known state (off)
// 

    myLightOn = 1;  // because it toggles once
    console.log(time," In main init myLight ", myLightOn);
    myLight.write(0);
    board.color("red");

  startClockLoop();
  startTempSensor();
  startDistanceSensor();
  console.log(time," Starting Server...")
  doServer();  
}

main();
