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
    var length = 6;
    var game_id = '';
    for (var i=0; i < length; ++i) {
      game_id += chars[Math.floor(Math.random()*chars.length)];
    }
    return game_id;
  };
  var getNewId = function() {
    game_id = generateId();
    r_client.get('game:' + game_id, function(err, reply) {
      if (!reply) {
        res.redirect('/' + game_id);
      } else {
        getNewId();
      }
    });
  }
  getNewId();
});

app.get('/:game_id', function(req, res) {
  var color = null;
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
        timestamps: {
          created_at: Date.now(),
          started_at: null,
          ended_at: null
        },
        players: {
          w: {
            id: null,
            time: null,
          },
          b: {
            id: null,
            time: null
          }
        },
        game: {
          fen: '',
          moves: [],
          captured: []
        }
      };
      r_client.set('game:' + req.params.game_id, JSON.stringify(data), function(err, reply) {
        r_client.send_command('expire', ['game:' + req.params.game_id, 600]); 
      });
    } else {
      data = JSON.parse(reply);
      if (data.players.w.id === id) {
        color = 'w';
      } else if (data.players.b.id === id) {
        color = 'b';
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
        break;
      case 'moves':
        r_client.get(channel, function(err, reply) {
          var data = JSON.parse(reply);
          var last_move = data.game.moves[data.game.moves.length-1];
          if (last_move.length === 2) {
            data.game.moves.push([message.move]);
          } else {
            last_move.push(message.move);
            data.game.moves[data.game.moves.length-1] = last_move;
          }
          data.game.fen = message.fen;
          data.game.captured = message.captured;
          r_client.set(channel, JSON.stringify(data));
          publisher.publish(channel, JSON.stringify(message));
        });
        break;
      case 'colors':
        r_client.get(channel, function(err, reply) {
          data = JSON.parse(reply);
          if (!data.players[message.color].id) {
            data.players[message.color].id = message.player_id;
            if (data.colors.w.id && data.colors.b.id) {
              data.timestamps.started_at = Date.now();
            }
            r_client.set(channel, JSON.stringify(data));
            publisher.publish(channel, JSON.stringify({
              type: 'colors',
              color: message.color,
              started_at: data.timestamps.started_at
            }));
          } else {
            console.log(message.player_id + ' selected an invalid color: ' + message.color);
          }
        });
        break;
    }
  });
  client.on('disconnect', function() {
    subscriber.quit();
    publisher.quit();
  });
});

r_client.select(2, function() {
  app.listen(3000, '127.0.0.1');
});
