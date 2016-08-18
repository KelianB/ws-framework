# ws-framework
Client and server frameworks that simplify dealing with JS websockets.

## Client Example
```javascript
var wfc = new WebsocketFrameworkClient({
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
