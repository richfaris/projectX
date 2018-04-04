# Home Automation Application for Intel Edison
# 
# Rich Faris rich@liquidhw.com
# This application utilizes a pair of Intel Edison systems, one
# inside and one outside of the house.
#
# the outside system has an ultrasonic sensor pointed at the front door, and 
# when it sees motion it turns on the lights if the time is "after dark"
# 
# both systems are reading the actual light switch as an input.  The light switch
# is actually only switching 5v once it is rewired.  Then the system reads the value out
# of the switch and it turns on the 120V using a relay
#
# 
# now that the intel development environment is unsupported (XDK) it would be easier
# to just use git to bring the code into the Edison directly for development there
#
# some of this documentation is outdated as it refers to the XDK systems.


## Introduction

This smart alarm clock application is part of a series of how-to Intel® Internet of Things (IoT) code sample exercises using the Intel® IoT Developer Kit, Intel® Edison board, Intel® IoT Gateway, cloud platforms, APIs, and other technologies.

From this exercise, developers will learn how to:<br>

- Connect the Intel® Edison board or Intel® IoT Gateway, computing platforms designed for prototyping and producing IoT and wearable computing products.<br>
- Interface with the Intel® Edison board or Intel® Arduino/Genuino 101 board IO and sensor repository using MRAA and UPM from the Intel® IoT Developer Kit, a complete hardware and software solution to help developers explore the IoT and implement innovative projects.<br>
- Run this code sample in Intel® XDK IoT Edition, an IDE for creating applications that interact with sensors and actuators, enabling a quick start for developing software for the Intel® Edison board or Intel® IoT Gateway.<br>
- Set up a web application server to let users enter the access code to disable the alarm system and store this alarm data using Azure Redis Cache\* from Microsoft\* Azure\*, Redis Store\* from IBM\* Bluemix\*, or ElastiCache\* using Redis\* from Amazon\* Web Services\* (AWS\*), different cloud services for connecting IoT solutions including data analysis, machine learning, and a variety of productivity tools to simplify the process of connecting your sensors to the cloud and getting your IoT project up and running quickly.
- Set up a MQTT-based server using IoT Hub from Microsoft\* Azure\*, IoT from IBM\* Bluemix\*, or IoT from Amazon Web Services\* (AWS), different cloud machine to machine messaging services based on the industry standard MQTT protocol.
- Invoke the services of the Weather Underground\* API for accessing weather data.

## What it is

Using an Intel® Edison or Intel® IoT Gateway, this project lets you create a smart alarm clock that:<br>
- can be accessed with your mobile phone via the built-in web interface to set the alarm time.<br>
- displays live weather data on the LCD.<br>
- keeps track of how long it takes you to wake up each morning, using cloud-based data storage.

## How it works

This smart alarm clock has a number of useful features. Set the alarm using a web page served directly from the Intel® Edison board or Intel® IoT Gateway using your mobile phone. When the alarm goes off, the buzzer sounds and the LCD indicates it’s time to get up. The rotary dial can be used to adjust the brightness of the display.

In addition, the smart alarm clock can access daily weather data via the Weather Underground* API and use it to change the color of the LCD.
Optionally, all data can also be stored using the Intel® IoT Examples Datastore running in your own Microsoft\* Azure\*, IBM\* Bluemix\*, or AWS account.

## Hardware requirements

This sample can be used with either the Grove\* Starter Kit Plus from Seeed Studio, or else the DFRobot\* Edison Starter Kit.

Grove\* Starter Kit Plus, containing:

1. Intel® Edison with an Arduino\* breakout board or Intel® IoT Gateway with Intel® Arduino/Genuino 101
2. [Grove\* Rotary Analog Sensor](http://iotdk.intel.com/docs/master/upm/node/classes/groverotary.html)
3. [Grove\* Buzzer](http://iotdk.intel.com/docs/master/upm/node/classes/buzzer.html).
4. [Grove\* Button](http://iotdk.intel.com/docs/master/upm/node/classes/grovebutton.html)
5. [Grove\* RGB LCD](http://iotdk.intel.com/docs/master/upm/node/classes/jhd1313m1.html)

DFRobot\* Starter Kit for Intel® Edison, containing:

1. Intel® Edison with an Arduino\* breakout board or Intel® IoT Gateway with Intel® Arduino/Genuino 101
2. [Buzzer](http://www.dfrobot.com/index.php?route=product/product&product_id=84).
3. [Button](http://iotdk.intel.com/docs/master/upm/node/classes/grovebutton.html)
4. [Rotary Dial]()
5. [LCD Keypad Shield](http://iotdk.intel.com/docs/master/upm/node/classes/sainsmartks.html)


## Adding the program to Intel® XDK IoT Edition

In Intel® XDK IoT Edition, select **Import Your Node.js Project**:

![](./../../images/js/xdk-menu.png)

On the **New Project** screen, click on the folder icon:

![](./../../images/js/xdk-new-project.png)

Then, navigate to the directory where the example project exists, and select it:

![](./../../images/js/xdk-select.png)

Choose a name for the project, then click on the **Create** button. Then click on the **Continue** button to finish creating your project:

![](./../../images/js/xdk-new-project-name.png)

You need to connect to your Intel® Edison board from your computer to send code to it.

![](./../../images/js/xdk-select-device.png)

Click the **IoT Device** menu at the bottom left. If your Intel® Edison board is automatically recognized, select it.

![](./../../images/js/xdk-manual-connect.png)

Otherwise, select **Add Manual Connection**.
In the **Address** field, type `192.168.2.15`. In the **Port** field, type `58888`.
Click **Connect** to save your connection.

### Installing the program manually on the Intel® Edison board

Alternatively, you can set up the code manually on the Intel® Edison board.

Clone the **How-To Intel IoT Code Samples** repository to your Intel® Edison board after you establish an SSH connection to it, as follows:

    $ git clone https://github.com/intel-iot-devkit/how-to-code-samples.git

Then, navigate to the directory with this example.

To install Git\* on the Intel® Edison board (if you don’t have it yet), establish an SSH connection to the board and run the following command:

    $ opkg install git

### Connecting the Grove\* sensors

![](./../../images/js/alarm-clock.jpg)

You need to have a Grove\* Shield connected to an Arduino\*-compatible breakout board to plug all the Grove\* devices into the Grove\* Shield. Make sure you have the tiny VCC switch on the Grove\* Shield set to **5V**.

1. Plug one end of a Grove\* cable into the Grove\* Rotary Analog Sensor, and connect the other end to the A0 port on the Grove\* Shield.

2. Plug one end of a Grove\* cable into the Grove Button, and connect the other end to the D4 port on the Grove\* Shield.

3. Plug one end of a Grove\* cable into the Grove Buzzer, and connect the other end to the D5 port on the Grove\* Shield.

4. Plug one end of a Grove\* cable into the Grove RGB LCD, and connect the other end to any of the I2C ports on the Grove\* Shield.



### Weather Underground\* API key

To optionally fetch the real-time weather information, you need to get an API key from the Weather Underground\* website:

<a href="http://www.wunderground.com/weather/api/">http://www.wunderground.com/weather/api</a>

You cannot retrieve weather conditions without obtaining a Weather Underground* API key first. You can still run the example, but without the weather data.

Pass your Weather Underground\* API key to the sample program by modifying the `WEATHER_API_KEY` key in the `config.json` file as follows:

```
{
  WEATHER_API_KEY: "YOURAPIKEY"
}
```

### Data store server setup

Optionally, you can store the data generated by this sample program in a back-end database deployed using Microsoft\* Azure\*, IBM\* Bluemix\*, or AWS, along with Node.js\*, and a Redis\* data store.

For information on how to set up your own cloud data server, go to:

[https://github.com/intel-iot-devkit/intel-iot-examples-datastore](https://github.com/intel-iot-devkit/intel-iot-examples-datastore)

### MQTT server setup

You can also optionally store the data generated by this sample program using MQTT, a machine-to-machine messaging server. You can use MQTT to connect to Microsoft\* Azure\*, IBM\* Bluemix\*, or AWS.

For information on how to connect to your own cloud MQTT messaging server, go to:

[https://github.com/intel-iot-devkit/intel-iot-examples-mqtt](https://github.com/intel-iot-devkit/intel-iot-examples-mqtt)

## Configuring the example

To configure the example for the Grove\* kit, just leave the `kit` key in the `config.json` set to `grove`. To configure the example for the DFRobot\* kit, change the `kit` key in the `config.json` to `dfrobot` as follows:

```
{
  "kit": "dfrobot"
}
```

To configure the example for the Arduino\*/Genuino\* 101, add a `platform` key with the value `firmata` to the `config.json`, as follows:

```
{
  "kit": "grove",
  "platform": "firmata"
}
```

To configure the example for the optional real-time weather data, obtain a key from the Weather Underground\* website as documented above, and then change the `WEATHER_API_KEY` and `LOCATION` keys in the `config.json` file as follows:

```
{
  "kit": "grove",
  "WEATHER_API_KEY": "YOURAPIKEY",
  "LOCATION": "San_Francisco"
}
```

To configure the example for the optional Microsoft\* Azure\*, IBM\* Bluemix\*, or AWS data store, change the `SERVER` and `AUTH_TOKEN` keys in the `config.json` file as follows:

```
{
  "kit": "grove",
  "SERVER": "http://intel-examples.azurewebsites.net/logger/alarm-clock",
  "AUTH_TOKEN": "s3cr3t"
}
```

To configure the example for both the weather data, as well as either the Microsoft\* Azure\*, IBM\* Bluemix\*, or AWS data store, change the `WEATHER_API_KEY`, `LOCATION`, `SERVER`, and `AUTH_TOKEN` keys in the `config.json` file as follows:

```
{
  "kit": "grove",
  "WEATHER_API_KEY": "YOURAPIKEY",
  "LOCATION": "San_Francisco"
  "SERVER": "http://intel-examples.azurewebsites.net/logger/alarm-clock",
  "AUTH_TOKEN": "s3cr3t"
}
```

For information on how to configure the example for the optional Microsoft\* Azure\*, IBM\* Bluemix\*, or AWS MQTT messaging server, go to:

[https://github.com/intel-iot-devkit/intel-iot-examples-mqtt/](https://github.com/intel-iot-devkit/intel-iot-examples-mqtt/)



### Determining the Intel® Edison IP address

You can determine what IP address the Intel® Edison board is connected to by running the following command:

    ip addr show | grep wlan

You will see the output similar to the following:

    3: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast qlen 1000
        inet 192.168.1.13/24 brd 192.168.1.255 scope global wlan0

The IP address is shown next to `inet`. In the example above, the IP address is `192.168.1.13`.

IMPORTANT NOTICE: This software is sample software. It is not designed or intended for use in any medical, life-saving or life-sustaining systems, transportation systems, nuclear systems, or for any other mission-critical application in which the failure of the system could lead to critical injury or death. The software may not be fully tested and may contain bugs or errors; it may not be intended or suitable for commercial release. No regulatory approvals for the software have been obtained, and therefore software may not be certified for use in certain countries or environments.
