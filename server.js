const express = require('express'),
      redis = require('redis'),
      uuid = require('node-uuid');

var server = express.createServer();
var r_client = redis.createClient();

r_client.on('error', function(err) {
  console.log("Error: " + err);
});

var env, host;
server.configure(function() {
  server.use(express.bodyDecoder());
  server.use(express.cookieDecoder());
  server.set('views', __dirname + '/views');
  server.set('view engine', 'jade');
  server.configure('development', function() {
    host = '127.0.0.1';
    env = 'development';
  });
  server.configure('production', function() {
    host = 'chessmenow.com';
    env = 'production';
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

var getNickname = function() {
    var adjectives = ['Fuzzy', 'Nerd', 'Crazy', 'Psycho', 'Noob', 'Magical', 'Flying', 'Evil', 'Happy', 'Cool', 'Hax']
    var nouns = ['Pickles', 'Rage', 'Person', 'Noob', 'Narwhal', 'Bacon', 'Walrus', 'Santa', 'Cat', 'Jabroni', 'Ninja']
    return adjectives[Math.floor(Math.random()*adjectives.length)] + nouns[Math.floor(Math.random()*nouns.length)]
}

server.get('/', getOrSetId, function(req, res) {
  console.log(req.uid + ' has joined the party! (home)');
  res.render('index', {
    locals: {
      env: env
    }
  });
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

// server.get(/^\/(?:(\w+))(?:\/(\d+))?/, getOrSetId, function(req, res) {
server.get('/:game_id', getOrSetId, function(req, res) {
  // console.dir(req.params)
  // req.params.game_id = req.params[0];
  // var time_control = req.params[1];
  var chosen_colors = [];
  var color = null;
  var channel = 'game:' + req.params.game_id;
  console.log(req.uid + ' has joined the party! (game: ' + req.params.game_id + ')');
  r_client.get(channel, function(err, reply) {
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
      r_client.set(channel, JSON.stringify(data), function(err, reply) {
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
        env:            env,
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

// XXX should use single subscriber per game.
server.get('/:game_id/xhr-polling', function(req, res) {
  var subscriber = redis.createClient();
  var channel = 'game:' + req.params.game_id;
  subscriber.subscribe(channel);
  subscriber.on('message', function(channel, message) {
    res.send(message, { 'Content-Type': 'application/json' });
    subscriber.quit();
  });
});

server.post('/:game_id/ping', function(req, res) {
  var channel = 'game:' + req.params.game_id;
  var user = 'user:' + req.cookies.id;
  var channel_user = channel + ':' + user;
  r_client.exists(channel_user, function(e, reply) {
    console.log('Ping reply:');
    console.dir(reply);
    if (reply === 0) {
      r_client.set(channel_user, 1);
      r_client.publish(channel, JSON.stringify({
        type: 'announcement',
        text: 'Someone has joined the game!'
      }));
    } else {
      r_client.expire(channel_user, 10);
    }
  });
  res.send('1', { 'Content-Type': 'application/json' });
});

server.post('/:game_id/color', function(req, res) {
  var channel = 'game:' + req.params.game_id;
  var color = req.body.color;
  // console.log(req.cookies.id);
  // console.dir(req.body);
  r_client.get(channel, function(e, reply) {
    data = JSON.parse(reply);
    if ((color === 'w' || color === 'b') && !data.players[color].id) {
      data.players[color].id = req.cookies.id;
      if (data.players.w.id && data.players.b.id) {
        data.timestamps.started_at = Date.now();
      }
      r_client.set(channel, JSON.stringify(data));
      r_client.publish(channel, JSON.stringify({
        type: 'color',
        color: color,
        started_at: data.timestamps.started_at
      }));
      res.send('1', { 'Content-Type': 'application/json' });
    } else {
      res.send('0', { 'Content-Type': 'application/json' });
    }
  });
});

server.post('/:game_id/move', function(req, res) {
  var channel = 'game:' + req.params.game_id;
  // console.dir(req.body);
  r_client.get(channel, function(e, reply) {
    var data = JSON.parse(reply);
    if (!data.timestamps.ended_at) {
      var last_move = data.game.moves[data.game.moves.length-1];
      if (!last_move || last_move.length === 2) {
        data.game.moves.push([req.body.move.san]);
      } else {
        last_move.push(req.body.move.san);
        data.game.moves[data.game.moves.length-1] = last_move;
      }
      if (req.body.move.captured) {
        var piece = req.body.move.captured;
        if (req.body.move.color === 'b') {
          piece = piece.toUpperCase();
        }
        data.game.captured.push(piece);
      }
      data.game.fen = req.body.fen;
      data.game.last_move = { from: req.body.move.from, to: req.body.move.to };
      r_client.set(channel, JSON.stringify(data));
      req.body.type = 'move';
      r_client.publish(channel, JSON.stringify(req.body));
      res.send('1', { 'Content-Type': 'application/json' });
    }
  });
});

server.post('/:game_id/chat', function(req, res) {
  var channel = 'game:' + req.params.game_id;
  // console.log(req.cookies.id);
  // console.log('Chat message received!');
  r_client.publish(channel, JSON.stringify({
    type: 'chat',
    text: req.body.text
  }));
  res.send('1', { 'Content-Type': 'application/json' });
});

server.post('/:game_id/announcement', function(req, res) {
  var channel = 'game:' + req.params.game_id;
  // console.log(req.cookies.id);
  // console.log('Announcement received!');
  // console.dir(req.body);
  publisher.publish(channel, JSON.stringify({
    type: 'announcement',
    text: ' has offered a draw!',
    text: ' has resigned!',
    text: ' has joined the game!'
  }));
  res.send('1', { 'Content-Type': 'application/json' });
});

server.post('/:game_id/end', function(req, res) {
  var channel = 'game:' + req.params.game_id;
  r_client.get(channel, function(err, reply) {
    data = JSON.parse(reply);
    if (!data.timestamps.ended_at) {
      data.timestamps.ended_at = Date.now();
      r_client.set(channel, JSON.stringify(data));
    }
  });
});


var reaper = setInterval(function() {
  // console.log('hay man');
}, 10000);


r_client.select(2, function() {
  server.listen(3000);
});
