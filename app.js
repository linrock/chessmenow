var express = require('express'),
    redis = require('redis').createClient(),
    Faye = require('faye'),
    app = express.createServer(),
    bayeux = new Faye.NodeAdapter({ mount: '/game/*', timeout: 120 });


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

var getKeys = function(obj){
   var keys = [];
   for(var key in obj){
      if (obj.hasOwnProperty(key)) {
        keys.push(key);
      }
   }
   return keys;
}

app.get('/', function(req, res) {
  console.dir(getKeys(req))
  console.dir(req.sessionID)
  res.render('index');
});

app.get('/:game_id', function(req, res) {
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

app.post('/:game_id/color', function(req, res) {
  req.params.game_id;
  res.send('1');
});

var moveMonitor = {
  incoming: function(message, callback) {
    if (message.channel !== '/meta/subscribe' && message.channel !== '/meta/connect') {
      console.log(message);
      return callback(message);
    }
    if (message.game_id) {
      console.log('This is the game ID: ' + message.game_id);
      console.log(message);
    }
    callback(message);
  }
};

bayeux.addExtension(moveMonitor);
bayeux.attach(app);
app.listen(3000);
