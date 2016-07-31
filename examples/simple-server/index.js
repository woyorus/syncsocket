var Server = require('../../src/index');

var server = new Server({
    defaultTimeserver: 'http://localhost:5579/'
});

server.createChannel();
server.createChannel({ channelId: 'super-channel' });
server.listen(6024);

server.on('connection', function (client) {
    console.log('new client! ID=' + client.tag);
});
