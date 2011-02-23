const express = require('express'),
      redis = require('redis'),
      uuid = require('node-uuid'),
      io = require('socket.io');

var server = express.createServer();
var r_client = redis.createClient();

r_client.on('error', function(err) {
  console.log("Error: " + err);
});

var host;
server.configure(function() {
  server.use(express.cookieDecoder());
  server.set('views', __dirname + '/views');
  server.set('view engine', 'jade');
  server.configure('development', function() {
    host = '127.0.0.1';
  });
  server.configure('production', function() {
    host = 'chessmenow.com';
  });
});

var getOrSetId = function(req, res, next) {
  if (!req.cookies.id) {
    req.uid = uuid();
    res.cookie('id', req.uid, { expires: new Date(Date.now() + 22118400000) });
  } else {
    req.uid = req.cookies.id;
  }
  next();
};

server.get('/', getOrSetId, function(req, res) {
  console.log(req.uid + ' has joined the party! (home)');
  res.render('index');
});

server.get('/new', function(req, res) {
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

// server.get('/:game_id', getOrSetId, function(req, res) {
server.get(/^\/(?:(\w+))(?:\/(\d+))?/, getOrSetId, function(req, res) {
  console.dir(req.params)
  req.params.game_id = req.params[0];
  var time_control = req.params[1];
  var chosen_colors = [];
  var color = null;
  console.log(req.uid + ' has joined the party! (game: ' + req.params.game_id + ')');
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
            time_remaining: null,
            last_move_at: null
          },
          b: {
            id: null,
            time_remaining: null,
            last_move_at: null
          }
        },
        game: {
          fen: '',
          moves: [],
          last_move: {},
          captured: []
        }
      };
      r_client.set('game:' + req.params.game_id, JSON.stringify(data), function(err, reply) {
        r_client.send_command('expire', ['game:' + req.params.game_id, 600]); 
      });
    } else {
      data = JSON.parse(reply);
      if (data.players.w.id === req.uid) {
        color = 'w';
      } else if (data.players.b.id === req.uid) {
        color = 'b';
      }
      if (data.players.w.id) { chosen_colors.push('w'); }
      if (data.players.b.id) { chosen_colors.push('b'); }
    }
    var state = (function() {
      if (!data.timestamps.started_at) {
        return 'new';
      } else if (data.timestamps.ended_at) {
        return 'ended';
      } else if (data.timestamps.started_at) {
        return 'started';
      }
    })();
    res.render('game', {
      locals: {
        host:           host,
        state:          state,
        game_id:        req.params.game_id,
        moves:          data.game.moves,
        chosen_colors:  chosen_colors,
        game_state:     data.game,
        player_state:   { id: req.uid, color: color },
      }
    });
  });
});

var socket = io.listen(server);
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
      case 'move':
        r_client.get(channel, function(err, reply) {
          var data = JSON.parse(reply);
          if (!data.timestamps.ended_at) {
            var last_move = data.game.moves[data.game.moves.length-1];
            if (!last_move || last_move.length === 2) {
              data.game.moves.push([message.data.move.san]);
            } else {
              last_move.push(message.data.move.san);
              data.game.moves[data.game.moves.length-1] = last_move;
            }
            if (message.data.move.captured) {
              var piece = message.data.move.captured;
              if (message.data.move.color === 'b') {
                piece = piece.toUpperCase();
              }
              data.game.captured.push(piece);
            }
            data.game.fen = message.data.fen;
            data.game.last_move = { from: message.data.move.from, to: message.data.move.to };
            r_client.set(channel, JSON.stringify(data));
            publisher.publish(channel, JSON.stringify(message));
          }
        });
        break;
      case 'colors':
        r_client.get(channel, function(err, reply) {
          data = JSON.parse(reply);
          if (!data.players[message.color].id) {
            data.players[message.color].id = message.player_id;
            if (data.players.w.id && data.players.b.id) {
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
      case 'end':
        r_client.get(channel, function(err, reply) {
          data = JSON.parse(reply);
          if (!data.timestamps.ended_at) {
            data.timestamps.ended_at = Date.now();
            r_client.set(channel, JSON.stringify(data));
          }
        });
        break;
      case 'opponent':
        break;
      case 'chat':
        break;
    }
  });
  client.on('disconnect', function() {
    subscriber.quit();
    publisher.quit();
  });
});

r_client.select(2, function() {
  server.listen(3000);
});
