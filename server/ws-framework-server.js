/** Initiates the server-side Websocket Framework.
 * @class
 * @classdesc A class that helps dealing with websocket communication between a server and clients.
 * @param {Object} config - The configuration of the framework.
 * @param {Integer} [config.maxClients=infinite] - The maximum amount of clients connected simultaneously to the server.
 * @param {Integer} config.port - The port that will be used by the server to communicate.
 * @param {Integer} [config.timeoutDelay=5000] - The delay after which a client will timeout if the server hasn't received a ping packet, in milliseconds.
 * @param {Function} [config.onConnectionAttempt] - A function that will be called when a client tries to connect (params: user). Can return an object: {successful: true/false, reason: ""}.
 * @param {Function} [config.onConnection] - A function that will be called when the connection with a client has been opened and authorized (params: user).
 * @param {Function} [config.onConnectionClosed] - A function that will be called when the connection with a client has been closed (params: user, data).
 * @param {Function} [config.onServerReady] - A function that will be called when the server has been initialized and is ready to receive connections.
 * @param {Function} [config.onPacket] - A function that will be called when the server receives a packet from a client (params: type, data).
 */
function WebsocketFrameworkServer(config) {
    var that = this;
    this.config = {};

    var defaults = {
        maxClients: this.CLIENTS_INFINITE,
        port: 8082,
        onConnectionAttempt: function() {},
        onConnection: function() {},
        onConnectionClosed: function() {},
        onServerReady: function() {},
        onPacket: function() {},
        timeoutDelay: 5000
    };

    for(var key in defaults)
        this.config[key] = config[key] || defaults[key];

    this.CLIENTS_INFINITE = -1;

    this.socket = null;
    this.users = [];

    var WebSocket = require("ws").Server;
    var currentClientID = 0;

    // Initialize websocket
    this.socket = new WebSocket({port: this.config.port});

    this.config.onServerReady();

    console.log("Server running (port: " + this.config.port + ").");

    // Add connection listener
    this.socket.on("connection", function(client) {
        var user = new User(that, client, currentClientID++);

        console.log("New connection attempt from " + user.ip);

        var connection = {successful: true, reason: ""};

        // Check if the maximum amount of clients has already been reached.
        if(that.config.maxClients != that.CLIENTS_INFINITE && that.users.length >= that.config.maxClients) {
            connection.successful = false;
            connection.reason = "server-full";
        }

        if(connection.successful)
            connection = that.config.onConnectionAttempt(user) || connection;

        if(connection.successful) {
        	user.connected = true;
            that.users.push(user);
            that.config.onConnection(user);

    	    connection.id = user.id;

    	    console.log(user.ip + " is now connected.");

            // Receives packet
        	user.client.on("message", function(packet) {
        	    console.log("[RECEIVED] " + packet);
            	try {
            		packet = JSON.parse(packet);
            	}
            	catch(e) {
            		console.log("Cannot parse message: \"" + packet + "\"");
            		return false;
            	}

            	that.config.onPacket(user, packet);

            	switch(packet.type) {
                    case "close-connection":
                        that.removeUser(user, packet.data);
                        break;
                    case "ping":
                    	user.sendPacket("pong");
                    	user.handlePingTimeout();
                    	break;
                }
            });
        }

        user.sendPacket("handshake", connection);
    });

    /** Removes a user from the server.
     * @param {User} user - The user to remove.
     * @param {Object} [data] - A data object that will be a parameter to onConnectionClosed.
     */
    this.removeUser = function(user, data) {
        this.users.splice(this.users.indexOf(user), 1);
        user.client.close();

        console.log("Removing user " + user.id);

        clearTimeout(user.pingTimeout);
        that.config.onConnectionClosed(user, data || {});
    };

    /** Broadcasts a packet to all connected users.
     * @param {String} type - The type of the packet which is used by the client to know what to do with it.
     * @param {Object} data - An object containing the data to send with the packet.
     * @param [Array] [excludedUsers] - An array of users to which we don't want to send the packet.
     * @param [Array] [targetUsers=all] - An array of users to which we will send the packet.
     */
    this.broadcast = function(type, data, excludedUsers, targetUsers) {
        targetUsers = targetUsers || this.users;
        excludedUsers = excludedUsers || [];

        for(var i = 0; i < targetUsers.length; i++) {
            if(excludedUsers.indexOf(targetUsers[i]) == -1) // if not excluded
                targetUsers[i].sendPacket(type, data);
        }
    };
}

function pad(str, max) {
    str = str.toString();
    return str.length < max ? pad(str + " ", max) : str;
}

/** Stores a user for the server websocket framework. This constructor is only used internally by the framework.
 * @param {WebsocketFrameworkServer} wfs - An instance of the server websocket framework.
 * @param {Websocket-Client} client - The client that corresponds to this user.
 * @param {Integer} id - The ID of this client.
 */
function User(wfs, client, id) {
    var that = this;

    this.client = client;
    this.id = id;
    this.ip = client._socket.remoteAddress;
    this.connected = false;

    /** Sends a packet to this client.
     * @param {String} type - The type of the packet which is used by the client to know what to do with it.
     * @param {Object} data - An object containing the data to send with the packet.
     */
    this.sendPacket = function(type, data) {
        // Build packet object
        var packet = {type: type};
	    if(data)
		    packet.data = data;

		console.log("[SEND] " + type + " to " + this.ip);

    	try {
            // Format and send the packet
            client.send(JSON.stringify(packet));
        }
        catch(e) {

        }
    };

    // Only used internally - called when a ping packet has been received.
    this.handlePingTimeout = function() {
        clearTimeout(this.pingTimeout);

        this.pingTimeout = setTimeout(function() {
            // Remove client
    	    wfs.removeUser(that, {reason: "timeout"});
            console.log(that.ip + " timed out!");
        }, wfs.config.timeoutDelay)
    };
}

module.exports = {WebsocketFrameworkServer: WebsocketFrameworkServer, User: User};
