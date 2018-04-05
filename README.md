## bleh-oscfruit

This is a mash between two libraries - Roman Random's ble-osc, and chunks of Adafruit's Bluefruit desktop client (minus the Electron windowing code). It connects to your Bluefruit, and forwards its data as OSC commands. The recipient could be Max, Pd, Wekinator, etc.

### Installation

Download this library, and use `npm install` to install the noble and osc libraries.

If `node-gyp` or `xpc-connection` fail to install for you, make sure npm has its python version set to a stable/latest 2.x.x.

### Setup

Bleh will look for a named Bluetooth device; by default, this will be "Adafruit Bluefruit BLE." If you'd like something different, add `ble.println("AT+GAPDEVNAME=yourDeviceName");` after the factory reset line in your .ino, and change `houseble` in the JS file to use your device's name.

The UART commands received from the Bluefruit are assumed to be sent via `ble.print("AT+BLEUARTTX=whatever")` in your `.ino` file, which is part of the Arduino Bluefruit library.

Bleh just forwards your BLE serial output straight to the UDP port, under the OSC name /rpy (for "roll/pitch/yaw"). The "TODO" marks where data gets processed and sent, which you should change if you'd like more readable data in Max/etc.

### Use

Use `node bleh-oscfruit.js` to start the server.

To get OSC data into Max, create a `udpreceive 57110` object.