/** An enumeration of websocket states (CONNECTING, OPEN, CLOSING, CLOSED). */
const WEBSOCKET_STATE = {
   CONNECTING: 0,
   OPEN: 1,
   CLOSING: 2,
   CLOSED: 3
};

/** An enumeration of websocket errors (TIMEOUT, CONNECTION_FAILED, UNKNOWN). */
const WEBSOCKET_ERROR = {
    TIMEOUT: 0,
    CONNECTION_FAILED: 1,
    UNKNOWN: 2
};

/** Initiates the client-side Websocket Framework.
 * @class
 * @classdesc A class that helps dealing with websocket communication between a client and a server.
 * @param {Object} config - The configuration of the framework.
 * @param {Object} [config.server] - The information required to reach the server.
 * @param {String} [config.server.ip=localhost] - The server IP.
 * @param {Integer} [config.server.port=49111] - The server port.
 * @param {Integer} [config.pingInterval=5000] - The interval at which the client will ping the server, in milliseconds.
 * @param {Integer} [config.abortDelay=10000] - The delay after which the client will abort the connection attempt with the server if it hasn't succeeded, in milliseconds.
 * @param {Integer} [config.timeoutDelay=10000] - The delay after which the client will timeout if the ping hasn't received a response, in milliseconds.
 * @param {Boolean} [config.logIncomingPackets=true] - Whether or not incoming packets should be logged to the console automatically.
 * @param {Boolean} [config.logOutgoingPackets=true] - Whether or not outgoing packets should be logged to the console automatically.
 * @param {Function} [config.onClose] - A function that will be called when the connection with the server is closed.
 * @param {Function} [config.onOpen] - A function that will be called when the connection with the server is opened.
 * @param {Function} [config.onError] - A function that will be called if the framework raises an error at any point (params: errorId, [reason]).
 * @param {Function} [config.onPacket] - A function that will be called when the client receives a packet from the server (params: type, data).
 * @param {Function} [config.onConnectionSuccessful] - A function that will be called after the handshake, when the server has authorized the connection.
 */
class WebsocketFrameworkClient {
   constructor(config) {
      const DEFAULT_CONFIG = {
         server: {ip: "localhost", port: 49111},
         pingInterval: 5000,
         abortDelay: 10000,
         timeoutDelay: 10000,
         onClose: function() {},
         onOpen: function() {},
         onError: function(error) {},
         onPacket: function() {},
         onConnectionSuccessful: function() {},
         logIncomingPackets: true,
         logOutgoingPackets: true
      };

      this.config = {};
      for(let key in DEFAULT_CONFIG)
         this.config[key] = config.hasOwnProperty(key) ? config[key] : DEFAULT_CONFIG[key];

      this.socket = null;

      this.PING_NEVER = -1;
      this.TIMEOUT_NONE = -1;

      this.wsUri = "wss://" + this.config.server.ip + ":" + this.config.server.port;

      this.connected = false;
      this.clientID = -1;
      this.pingHistory = [];

      this.lastPingTime = Date.now();
      this.pingTimeout = -1;

      // Handle disconnection when the page is left.
      window.addEventListener("beforeunload", () => {
         this.closeConnection("page-exit");
      });
   }

   /** Gets the current state of the socket.
   * @returns {Integer} The socket state.
   */
   getState() {
     return this.socket.readyState;
   }

   /** Connects to the server specified in config.server. */
   connect() {
      // Initialize the socket
     this.socket = new WebSocket(this.wsUri);

     // If we're still trying to connect to the server after abortDelay, abort the connection.
     setTimeout(() => {
        	// Check if websocket is still trying
        	if(this.socket.readyState == WEBSOCKET_STATE.CONNECTING)
        		this.config.onError(WEBSOCKET_ERROR.CONNECTION_FAILED);
     }, this.config.abortDelay);

     // Add listeners
     this.socket.onclose = (e) => {this.config.onClose(e);};
     this.socket.onopen = (e) => {this.config.onOpen(e);};
     this.socket.onerror = (e) => {
         this.config.onError(WEBSOCKET_ERROR.UNKNOWN, e);
         this.connected = false;
     };
     this.socket.onmessage = (e) => {
         let packet = JSON.parse(e.data);

         if(this.config.logIncomingPackets)
            console.log("[RECEIVED] " + packet.type);

         switch(packet.type) {
         	case "handshake":
         	   if(packet.data.successful) {
                     this.clientID = packet.data.clientID;
                     this.connected = true;
                     this.config.onConnectionSuccessful(packet.data);

                     // Start ping interval
                     if(this.config.pingInterval != this.PING_NEVER)
                     	setInterval(() => {this.ping()}, this.config.pingInterval);
                 }
                 else
                     this.config.onError(WEBSOCKET_ERROR.CONNECTION_FAILED, packet.data.reason);
         		break;
             case "pong":
                 // Handle pinging
             	clearTimeout(this.pingTimeout);
             	this.pingTimeout = -1;
             	this.pingHistory.push(Date.now() - this.lastPingTime);
             	break;
         }

         this.config.onPacket(packet);
     };
   }

   /** Closes the connection with the server.
   * @param {String} reason - The reason for the disconnection.
   */
   closeConnection(reason) {
      this.sendPacket("close-connection", {reason: reason});
      this.connected = false;
   }

   /** Sends a packet to the server.
   * @param {String} type - The type of the packet which is used by the server to know what to do with it.
   * @param {Object} data - An object containing the data to send with the packet.
   * @returns {Boolean} Whether or not the packet has been sent.
   */
   sendPacket(type, data) {
      // Check if the packet can be sent
      if(!this.socket || this.socket.readyState != WEBSOCKET_STATE.OPEN || !this.connected)
         return false;

      // Build the packet object
      let packet = {type: type};
      if(data)
         packet.data = data;

      if(this.config.logOutgoingPackets)
         console.log("[SEND] " + type);

      try {
         // Send the packet
         this.socket.send(JSON.stringify(packet));
         return true;
      }
      catch(e) {
         return false;
      }
   }

   /** Sends a ping packet to the server. */
   ping() {
     // Abort if there is already a ping that hasn't received a response.
   	if(this.pingTimeout != -1)
     	   return;

   	// Store sending time
   	this.lastPingTime = Date.now();

   	// Creates a timeout that will be cleared when the client receives a "pong" packet from the server.
   	if(this.config.timeoutDelay != this.TIMEOUT_NONE) {
         this.pingTimeout = setTimeout(() => {
        		if(this.connected)
        			this.config.onError(WEBSOCKET_ERROR.TIMEOUT);
        	}, this.config.timeoutDelay);
   	}

   	this.sendPacket("ping");
   }
}
