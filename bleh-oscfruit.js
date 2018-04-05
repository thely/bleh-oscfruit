
var noble = require('noble');
var osc = require('osc');

let receiving = false;
let buffer = '';
let devices = [];             // List of known devices.
let selectedIndex = null;     // Currently selected/connected device index.
let selectedDevice = null;    // Currently selected device.
let selectedAddress = null;   // MAC address or unique ID of the currently selected device.
                              // Used when reconnecting to find the device again.
let uartRx = null;            // Connected device UART RX char.
let uartTx = null;            // Connected device UART TX char.
let connectStatus = null;

const bleName = 'HousesBLE';
const oscSendAddress = '127.0.0.1';
const oscSendPort = 57110;
const oscRecvAddress = '0.0.0.0';
const oscRecvPort = 57121;

console.log("Starting thing?");

// When noble's done initializing, it starts scanning for devices
noble.on('stateChange', state => {
	console.log("Our state changed?");
	if (state === "poweredOn") {
		noble.startScanning([], false, error => {
			if (error !== null) console.log(error);
		});
	}
  else if (state === "poweredOff") {
    console.log("Goodnight!");
  }
});

// Open the UDP port for OSC stuff
const udpPort = new osc.UDPPort({
  localAddress: oscRecvAddress,
  localPort: oscRecvPort
});

udpPort.open();

function serializeDevice(device, index) {
  // Prepare a Noble device for serialization to send to a renderer process.
  // Copies out all the attributes the renderer might need.  Seems to be
  // necessary as Noble's objects don't serialize well and lose attributes when
  // pass around with the ipc class.
  return {
    id: device.id,
    name: device.advertisement.localName,
    address: device.address,
    index: index
  };
}

function serializeServices(index) {
  // Prepare all the services & characteristics for a device to be serialized
  // and sent to the rendering process.  This will be an array of service objects
  // where each one looks like:
  //  { uuid: <service uuid, either short or long>,
  //    name: <friendly service name, if known>,
  //    type: <service type, if known>
  //    characteristics: [<list of characteristics (see below)>] }
  //
  // For each service its characteristics attribute will be a list of
  // characteristic objects that look like:
  //  { uuid: <char uuid>,
  //    name: <char name, if known>
  //    type: <char type, if known>
  //    properties: [<list of properties for the char>],
  //    value: <last known characteristic value, or undefined if not known>
  //  }
  let device = devices[index];
  let services = device.services.map(function(s) {
    return {
      uuid: s.uuid,
      name: s.name,
      type: s.type,
      characteristics: s.characteristics.map(function(c) {
        return {
          uuid: c.uuid,
          name: c.name,
          type: c.type,
          properties: c.properties
        };
      })
    };
  });
  return services;
}

function findUARTCharacteristics(services) {
  // Find the UART RX and TX characteristics and save them in global state.
  // Process all the characteristics.
  services.forEach(function(s, serviceId) {
    s.characteristics.forEach(function(ch, charId) {
      // Search for the UART TX and RX characteristics and save them.
      if (ch.uuid === '6e400002b5a3f393e0a9e50e24dcca9e') {
        uartTx = ch;
      }
      else if (ch.uuid === '6e400003b5a3f393e0a9e50e24dcca9e') {
        uartRx = ch;
        // Setup the RX characteristic to receive data updates and update
        // the UI.  Make sure no other receivers have been set to prevent them
        // stacking up on reconnect.
        uartRx.removeAllListeners('data');
        uartRx.on('data', function(data) {
          // TODO: Alter this block for your own purposes!
          var line = String(data);
        	console.log(String(data));

          if (line !== null) {
            udpPort.send({
              address: '/rpy',
              args: line
            }, oscSendAddress, oscSendPort);
          }

        });
        uartRx.notify(true);
      }
    });
  });
}

function connected(error) {
  // Callback for device connection.  Will kick off service discovery and
  // grab the UART service TX & RX characteristics.
  // Handle if there was an error connecting, just update the state and log
  // the full error.
  if (error) {
    console.log('Error connecting: ' + error);
    // setConnectStatus('Error!');
    return;
  }
  // When disconnected try to reconnect (unless the user explicitly clicked disconnect).
  // First make sure there are no other disconnect listeners (to prevent building up duplicates).
  selectedDevice.removeAllListeners('disconnect');
  selectedDevice.on('disconnect', function() {
    reconnect(selectedAddress);
  });
  // Connected, now kick off service discovery.
  // setConnectStatus('Discovering Services...', 66);
  selectedDevice.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
    // Handle if there was an error.
    if (error) {
      console.log('Error discovering: ' + error);
      // setConnectStatus('Error!');
      return;
    }
    // Setup the UART characteristics.
    findUARTCharacteristics(services);
    // Service discovery complete, connection is ready to use!
    // Note that setting progress to 100 will cause the page to change to
    // the information page.
    // setConnectStatus('Connected', 100);
  });
}

function disconnect() {
  // Null out selected device and index so there is no reconnect attempt made
  // if this was an explicit user choice to disconnect.
  let device = selectedDevice;
  selectedDevice = null;
  selectedIndex = null;
  selectedAddress = null;
  // Now disconnect the device.
  if (device != null) {
    device.disconnect();
  }
}

function reconnect(address) {
  // Don't reconnect if no address is provided.  This handles the case
  // when the user clicks disconnect and really means they don't want to
  // be connected anymore.
  if (address === null) {
    return;
  }
  // Othewise kick off the reconnection to the device.
  console.log('Reconnecting to address: ' + address);
  // setConnectStatus('Reconnecting...');
  // Turn on scanning and look for the device again.
  disconnect();
  selectedAddress = address;  // Must happen after disconnect since
                              // disconnect sets selectedAddress null.
  devices = [];
  noble.startScanning();
}

noble.on('discover', function(device) {
	let index = devices.push(device) - 1;
	if (device.connectable && device.advertisement.localName === bleName) {
		console.log("Found device, reconnecting...");
		selectedIndex = index;
		selectedDevice = devices[index];
		noble.stopScanning();
		selectedDevice.connect(connected);
	}
});

function exitHandler() {
  // console.log(udpPort);
  // udpPort.close();
  process.exit();
}

process.on('exit', exitHandler);
process.on('SIGINT', exitHandler);
