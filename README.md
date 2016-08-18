# ws-framework
Client and server frameworks that simplify dealing with JS websockets.

## Hello World Example

### Client side

``` javascript
var wfc = new WebsocketFr meworkClient({
    server: {ip: "localhost", port: 4242},
    pingInterval: 8000,
    onClose: function() {},
    onError: function(error) {},
    onOpen: function() {
        console.log("Connection established"):
    },
    onPacket: function(packet) {
        console.log("[RECEIVED] " + JSON.stringify(packet));

        switch(packet.type) {
            case "hello-world":
                console.log("Hello World! " + packet.data.random)
                break;
        }
    },
    onConnectionSuccessful: function() {},
    abortDelay: 10000,
    timeoutDelay: 5000
});
wfc.connect();
```

### Server server side

``` javascript
var WfsModule = require("ws-framework-server.js");
var wfs = new WfsModule.WebsocketFrameworkServer({
    timeoutDelay: 10000,
    onConnection: function(user) {
        console.log("A new user is connected to the server.");
    },
    onConnectionClosed: function(user) {}
    onPacket: function(user, packet) {
        switch(packet.type) {
            case "hello-world":
                user.initStuff();
                user.sendPacket("hello-world", {random: user.random});
            break;
         }
     }
});

User.prototype.initStuff = function() {
    this.random = Math.random();
};

```
