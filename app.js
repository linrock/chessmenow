var express = require('express'),
    redis = require('redis').createClient(),
    Faye = require('faye'),
    app = express.createServer(),
    bayeux = new Faye.NodeAdapter({ mount: '/game/*' });


redis.on('error', function(err) {
  console.log("Error: " + err);
});

app.configure(function() {
  app.use(express.cookieDecoder());
  app.use(express.session());
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.dynamicHelpers({
    session: function(req, res) {
      return req.session;
    }
  });
});

app.get('/', function(req, res) {
  console.log(req.sessionID + ' has joined the party!')
  res.render('index');
});

app.get('/:game_id', function(req, res) {
  console.log(req.sessionID + ' has joined the party!')
  redis.get(req.params.game_id, function(err, reply) {
    if (!reply) {
      game_state = JSON.stringify({ started: false, created_at: (new Date()).toString() });
      redis.set(req.params.game_id, game_state);
    } else {
      game_state = reply;
    }
    res.render('game', {
      locals: {
        your_color: "w",
        game_state: game_state,
        game_id: req.params.game_id
      }
    });
  });
});

var stateRecorder = {
  incoming: function(message, callback) {
    console.log(message);
    if (message.data) {
      game_id = message.data.game_id;
      if (game_id && message.channel.indexOf(game_id) > -1 && message.channel.indexOf('moves') > -1) {
        redis.get(game_id, function(err, reply) {
          game_state = JSON.parse(reply);
          game_state.fen = message.data.fen;
          game_state.captured = message.data.captured;
          console.log('Saving... ' + JSON.stringify(game_state));
          redis.set(game_id, JSON.stringify(game_state));
          callback(message);
        });
      }
    }
    return callback(message);
  }
};

bayeux.addExtension(stateRecorder);
bayeux.attach(app);
app.listen(3000);
