// TODO change clients to users


function WebsocketFrameworkServer(config) {
    console.log("Initializing server...");
    
    var that = this;
    this.config = {};
    
    // Constants
    this.CLIENTS_INFINITE = -1;

    var defaults = {
        maxClients: this.CLIENTS_INFINITE,
        port: 8082,
        onConnectionAttempt: function() {},
        onConnection: function() {},
        onConnectionClosed: function() {},
        onPacket: function() {},
        timeoutDelay: 5000
    };

    for(var key in defaults)
        this.config[key] = config[key] || defaults[key];
    
    this.socket = null;
    this.clients = [];
    
    // var WebSocket = require(__dirname + "/../node_modules/ws").Server;
    var WebSocket = require("ws").Server;
    
    // Initialize websocket
    this.socket = new WebSocket({port: this.config.port});
    
    console.log("Server running (Port: " + this.config.port + ").");

    // Add connection listener
    this.socket.on("connection", function(client) {
        var user = new User(that, client);
        
        console.log("New connection attempt from " + user.ip);
        
        var connection = {successful: true, reason: ""};
        
        if(that.config.maxClients != that.CLIENTS_INFINITE && that.clients.length >= that.config.maxClients) {
            connection.successful = false;
            connection.reason = "server-full";
        }
       
        if(connection.successful)
            connection = that.config.onConnectionAttempt(user) || connection;
        
        if(connection.successful) {        
        	user.connected = true;
            that.clients.push(user);
            that.config.onConnection(user);
            
    	    connection.id = user.id;
    	    
    	    console.log(user.ip + " is now connected");
        	
        	user.client.on("message", function(packet) {
        	    console.log("[RECEIVED] " + packet);
            	try {            		
            		packet = JSON.parse(packet);
            	}
            	catch(e) {
            		console.log("ERROR__CANNOT___PARSE__MESSAGE - \"" + packet + "\" PLEASE__RESTATE");
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
    
    this.removeUser = function(user, data) {
        this.clients.splice(this.clients.indexOf(user), 1);
        console.log("Removing user " + user.id)
        user.client.close();
        clearTimeout(user.pingTimeout);
        that.config.onConnectionClosed(user, data || {});
    };
    
    this.broadcast = function(type, data, excludedClients, targetClients) {
        targetClients = targetClients || this.clients;
        excludedClients = excludedClients || [];

        for(var i = 0; i < targetClients.length; i++) {
            if(excludedClients.indexOf(targetClients[i]) == -1) // if not excluded
                targetClients[i].sendPacket(type, data);
        }
    };
}

function pad(str, max) {
    str = str.toString();
    return str.length < max ? pad(str + " ", max) : str;
}

var currentID = 0;
function User(wfs, client) {
    var that = this;
    
    this.client = client;
    this.id = currentID++;
    this.ip = client._socket.remoteAddress;
    this.connected = false;
    
    this.sendPacket = function(type, data) {
        var packet = {type: type};
	    if(data)
		    packet.data = data;
		    
		console.log("[SEND] " + type + " to " + this.ip);

    	try {
            client.send(JSON.stringify(packet));
        } 
        catch(e) {
        	
        }
    };
    
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