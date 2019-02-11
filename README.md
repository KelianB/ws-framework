# ws-framework
Client and server frameworks that simplify dealing with JS websockets.
Download the documentation for both the client and server side for more specific information.

## Hello World Example

### Client side

``` javascript
let wfc = new WebsocketFrameworkClient({
    server: {ip: "localhost", port: 4242},
    onPacket: function(packet) {
        switch(packet.type) {
            case "hello-world":
                console.log("Hello World! " + packet.data.random);
                break;
        }
    },
});
wfc.connect();
```

### Server side

``` javascript
let WfsModule = require("ws-framework-server.js"),
    WebsocketFrameworkServer = WfsModule.WebsocketFrameworkServer,
    User = WfsModule.User;

let wfs = new WebsocketFrameworkServer({
    port: 4242,
    onConnection: function(user) {
        console.log("A new user is connected to the server.");
    },
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
