var express = require('express'),
    redis = require('redis').createClient(),
    uuid = require('node-uuid'),
    Faye = require('faye'),
    bayeux = new Faye.NodeAdapter({ mount: '/game/*' }),
    app = express.createServer();


redis.on('error', function(err) {
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
    redis.get(game_id, function(err, reply) {
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
  redis.get(req.params.game_id, function(err, reply) {
    if (!reply) {
      data = {
        game: {
          started: false,
          players: [],
          created_at: (new Date()).toString()
        },
        colors: { w: '', b: '' }
      };
      redis.set(req.params.game_id, JSON.stringify(data), function(err, reply) {
        redis.send_command('expire', [req.params.game_id, 600]); 
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

var stateRecorder = {
  incoming: function(message, callback) {
    console.dir(message);
    // console.log('#Subscribers: ' + bayeux.countSubscribers())
    // console.dir(bayeux)
    // console.dir(bayeux._server._connections)
    // console.dir(bayeux._server._channels)
    // console.dir(bayeux._server._channels._children.game._children.asdf.countSubscribers('message'))
    if (message.data) {
      game_id = message.data.game_id;
      if (game_id && message.channel.indexOf(game_id) > -1) {
        if (message.channel.indexOf('/moves') > -1) {
          redis.get(game_id, function(err, reply) {
            data = JSON.parse(reply);
            data.game.fen = message.data.fen;
            data.game.captured = message.data.captured;
            redis.set(game_id, JSON.stringify(data));
            return callback(message);
          });
        } else if (message.channel.indexOf('/colors') > -1) {
          console.log('Dude, color changed! ' + JSON.stringify(message.data));
          redis.get(game_id, function(err, reply) {
            data = JSON.parse(reply);
            console.dir(message.data);
            if (!data.colors[message.data.color]) {
              data.colors[message.data.color] = message.data.player_id;
              data.game.players.push(message.data.color);
            }
            if (data.colors.w && data.colors.b) {
              data.game.started = true;
            }
            redis.set(game_id, JSON.stringify(data));
            message.data.player_id = '';
            message.data.started = data.game.started;
            return callback(message);
          });
        }
      } else {
        console.dir(message.data);
      }
    }
    return callback(message);
  }
};

bayeux.addExtension(stateRecorder);
bayeux.attach(app);
app.listen(3000);
