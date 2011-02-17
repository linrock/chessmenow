var express = require('express'),
    redis = require('redis'),
    uuid = require('node-uuid'),
    io = require('socket.io'),
    app = express.createServer();


r_client = redis.createClient();
r_client.on('error', function(err) {
  console.log("Error: " + err);
});

app.configure(function() {
  app.use(express.cookieDecoder());
  // app.use(express.session());
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.dynamicHelpers({
    session: function(req, res) {
      return req.session;
    }
  });
});

app.configure('development', function() {

});
app.configure('production', function() {
  
});

app.get('/', function(req, res) {
  var id;
  if (!req.cookies.id) {
    id = uuid();
    res.cookie('id', id, { expires: new Date(Date.now() + 22118400000) });
  } else {
    id = req.cookies.id;
  }
  console.log(id + ' has joined the party!');
  res.render('index');
});

app.get('/new', function(req, res) {
  var generateId = function() {
    var chars = 'abcdefghijklmnopqrstuvwxyz';
    var length = 8;
    var game_id = '';
    for (var i=0; i < 8; ++i) {
      game_id += chars[Math.floor(Math.random()*chars.length)];
    }
    return game_id;
  };
  var getNewId = function() {
    game_id = generateId();
    r_client.get('game:' + game_id, function(err, reply) {
      if (!reply) {
        res.redirect('/' + game_id)
      } else {
        getNewId()
      }
    });
  }
  getNewId();
});

app.get('/:game_id', function(req, res) {
  var color = '';
  var id;
  if (!req.cookies.id) {
    id = uuid();
    res.cookie('id', id, { expires: new Date(Date.now() + 22118400000) });
  } else {
    id = req.cookies.id;
  }
  console.log(id + ' has joined the party!');
  r_client.get('game:' + req.params.game_id, function(err, reply) {
    if (!reply) {
      data = {
        game: {
          started: false,
          players: [],
          created_at: Date.now(),
          started_at: null,
          ended_at: null
        },
        colors: { w: '', b: '' }
      };
      r_client.set('game:' + req.params.game_id, JSON.stringify(data), function(err, reply) {
        r_client.send_command('expire', ['game:' + req.params.game_id, 600]); 
      });
    } else {
      data = JSON.parse(reply);
      if (data.colors) {
        if (data.colors.w === id) {
          color = 'w';
        } else if (data.colors.b === id) {
          color = 'b';
        }
      }
    }
    res.render('game', {
      locals: {
        game_state: JSON.stringify(data.game),
        player_state: JSON.stringify({ id: id, color: color }),
        game_id: req.params.game_id
      }
    });
  });
});

var socket = io.listen(app);
socket.on('connection', function(client) {
  var subscriber = redis.createClient();
  var publisher = redis.createClient();
  client.on('message', function(message) {
    var channel = 'game:' + message.game_id;
    switch (message.type) {
      case 'auth':
        subscriber.subscribe(channel);
        subscriber.on('message', function(channel, message) {
          message = JSON.parse(message);
          client.send(message);
        });
        break
      case 'moves':
        r_client.get(channel, function(err, reply) {
          data = JSON.parse(reply);
          data.game.fen = message.fen;
          data.game.last_move = message.move;
          data.game.captured = message.captured;
          r_client.set(channel, JSON.stringify(data));
          publisher.publish(channel, JSON.stringify(message));
        });
        break
      case 'colors':
        r_client.get(channel, function(err, reply) {
          data = JSON.parse(reply);
          if (!data.colors[message.color]) {
            data.colors[message.color] = message.player_id;
            data.game.players.push(message.color);
          }
          if (data.colors && (data.colors.w && data.colors.b)) {
            data.game.started = true;
          }
          r_client.set(channel, JSON.stringify(data));
          publisher.publish(channel, JSON.stringify({
            type: 'colors',
            color: message.color,
            started: data.game.started
          }));
        });
        break
    }
  });
  client.on('disconnect', function() {
    subscriber.quit();
  });
});

r_client.select(2, function() {
  app.listen(3000, '127.0.0.1');
});
