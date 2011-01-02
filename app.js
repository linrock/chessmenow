var express = require('express'),
    app = express.createServer();

app.set('view engine', 'jade');

app.get('/', function(req, res) {
  res.render('Hello World!');
});

app.listen(3000);
