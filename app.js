var express = require('express'),
    app = express.createServer();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
});

app.get('/', function(req, res) {
  res.render('index');
});

app.listen(3000);
