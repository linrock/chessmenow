var express = require('express'),
    app = express.createServer();

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
  res.render('game', {
    locals: {
      fen: "",
      your_color: "w",
      game_id: req.params.game_id
    }
  });
});

app.post('/:game_id/color', function(req, res) {
  req.params.game_id;
});

app.post('/:game_id/move', function(req, res) {
  req.params.game_id;
});

app.listen(3000);
