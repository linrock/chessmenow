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

app.get('/', function(req, res) {
  res.render('index');
});

app.get('/:game_id', function(req, res) {
  res.render('game');
});

app.post('/:game_id/color', function(req, res) {
  req.params.game_id;
});

app.post('/:game_id/move', function(req, res) {
  req.params.game_id;
});

app.listen(3000);
