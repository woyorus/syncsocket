var Server = require('../../src/index');

var server = new Server({ embeddedTimeserver: true });

server.createChannel({ channelId: 'super-channel' });
server.listen(3000);

server.on('connection', function (client) {
    console.log('new client! ID=' + client.tag);
});
