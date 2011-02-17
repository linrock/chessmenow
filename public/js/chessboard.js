var Chessboard = function(options, player) {
  var self = this;
  self.selected = null;

  self.player = (function() {
    var p = {};
    for (var i in player) {
      p[i] = player[i];
    }
    return p;
  })();

  self.state = (function() {
    var state = { captured: [] };
    for (var i in options) {
      state[i] = options[i];
    }
    return state;
  })();
 
  self.socket = (function() {
    var s = new io.Socket('127.0.0.1', { port: 3000 });
    s.connect();
    s.on('connect', function() {
      s.send({ type: 'auth', auth: document.cookie, game_id: game_id });
    });
    s.on('message', function(message) {
      switch (message.type) {
        case 'moves':
          if (message.fen) {
            self.state.captured = message.captured;
            self.loadFen(message.fen);
          }
          self.showLastMoved(message.move);
          break

        case 'colors':
          if (message.color === 'b') {
            $(".black-player").html('Black');
            $("#choose-black").remove();
          } else if (message.color === 'w') {
            $(".white-player").html('White');
            $("#choose-white").remove();
          }
          if (message.started) {
            self.state.started = true;
            self.checkGameState();
          }
          break
      }
    });
    s.on('disconnect', function() {
      s.connect();
    });
    setInterval(function() {
      s.send('ping');
    }, 5000);
    // c.publish('/game/' + game_id, { game_id: game_id, id: self.player.id });
    return s;
  })();
  
  self.generateBoard();
  self.loadFen(self.state.fen);
  self.showLastMoved(self.state.last_move);

  if ($.inArray('w', self.state.players) === -1) {
    $("#choose-white").show().click(function() {
      self.player.color = 'w';
      self.state.players.push('w');
      self.generateBoard();
      self.loadFen(self.state.fen);
      self.socket.send({
        type: 'colors',
        game_id: game_id,
        player_id: self.player.id,
        color: 'w'
      });
      $(".white-player").insertAfter("#bottom-name").html('White');
      $(".black-player").insertAfter("#top-name");
      $(this).hide();
    });
  } else {
    $(".white-player").html('White');
  }
  if ($.inArray('b', self.state.players) === -1) {
    $("#choose-black").show().click(function() {
      self.player.color = 'b';
      self.state.players.push('b');
      self.generateBoard();
      self.loadFen(self.state.fen);
      self.socket.send({
        type: 'colors',
        game_id: game_id,
        player_id: self.player.id,
        color: 'b'
      });
      $(".black-player").insertAfter("#bottom-name").html('Black');
      $(".white-player").insertAfter("#top-name");
      $(this).hide();
    });
  } else {
    $(".black-player").html('Black');
  }
  $(".tile").live('click', function() {
    var position = $(this).attr('id');
    if (self.isYourPiece(position)) {
      if ($(this).hasClass('selected')) {
        $(this).removeClass('selected');
        self.selected = null;
      } else {
        $(this).addClass('selected');
        self.selected = position;
      }
    } else {
      self.moveTo(position);
    }
    $(".tile").not(this).removeClass("selected");
  });
};

Chessboard.prototype = new Chess();
Chessboard.prototype.constructor = Chessboard;

Chessboard.prototype.loadFen = function(fen) {
  if (!fen) {
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
  $(".moved").removeClass('moved');
  this.load(fen);
  this.state.fen = fen;
  var rows = fen.split(' ')[0].split('/');
  var cols = ['a','b','c','d','e','f','g','h'];
  var row_num = 8;
  var col_num;
  for (var i in rows) {
    col_num = 0;
    row = rows[i].split('');
    for (var j in row) {
      if (row[j] >= 1) {
        num_cols = parseInt(row[j]);
        for (var k=0 ; k < num_cols; ++k) {
          $("#" + cols[col_num++] + row_num + " > div").removeClass();
        }
      } else {
        $("#" + cols[col_num++] + row_num + " > div")
          .removeClass()
          .addClass('piece ' + row[j]);
      }
    }
    --row_num;
  }
  this.checkGameState();
};

Chessboard.prototype.moveTo = function(to) {
  var existing = this.get(to);
  if (this.selected && this.move({from: this.selected, to: to})) {
    if (existing) {
      this.state.captured.push(existing);
    }
    this.socket.send({
      type: 'moves',
      fen: this.fen(),
      move: [this.selected, to],
      captured: this.state.captured,
      game_id: game_id
    });
    this.loadFen(this.fen());
    this.checkGameState();
  }
  this.selected = null;
};

Chessboard.prototype.showLastMoved = function(move) {
  if (move && move.length === 2) {
    $("#" + move[0]).addClass('moved');
    $("#" + move[1]).addClass('moved');
  }
};

Chessboard.prototype.checkGameState = function() {
  if (this.state.started) {
    this.showCaptured();
    var turn = this.turn();
    var info = '';
    if (this.in_checkmate()) {
     if (turn !== this.player.color) {
        info = "Checkmate - You win!";
      } else if (turn == 'w') {
        info = "Checkmate - Black wins!";
      } else if (turn == 'b') {
        info = "Checkmate - White wins!";
      }
    } else if (this.in_stalemate()) {
      info = "Stalemate!";
    } else if (this.in_draw() || this.in_threefold_repetition()) {
      info = "Draw!";
    } else {
      if (this.in_check()) {
        info = "Check!";
      }
      if (turn == 'w') {
        document.title = "White's Turn | Chess Me Now";
        $('.black-player').removeClass('current-turn');
        $('.white-player').addClass('current-turn');
      } else if (turn == 'b') {
        document.title = "Black's Turn | Chess Me Now";
        $('.white-player').removeClass('current-turn');
        $('.black-player').addClass('current-turn');
      }
      if (turn == this.player.color) {
        document.title = 'Your Turn | Chess Me Now';
      }
    }
    $("#info").text(info);
  }
};

Chessboard.prototype.isYourPiece = function(position) {
  var piece = this.get(position);
  return piece && piece.color === this.turn();
};

Chessboard.prototype.generateBoard = function() {
  var self = this;
  var cols = ['8','7','6','5','4','3','2','1'];
  var rows = ['a','b','c','d','e','f','g','h'];
  if (self.player.color === 'b') {
    cols = cols.reverse();
    rows = rows.reverse();
    $(".white-player").insertAfter($("#top-name"));
    $(".black-player").insertAfter($("#bottom-name"));
  } else {
    $(".black-player").insertAfter($("#top-name"));
    $(".white-player").insertAfter($("#bottom-name"));
  }
  var board = '';
  var count = 0;
  for (var i in cols) {
    for (var j in rows) {
      board += '<div id="' + rows[j]+cols[i] + '" class="tile ' + ((count++ % 2 === 0) ? 'white':'black') + '"><div></div></div>';
    }
    ++count;
  }
  $("#chessboard").html(board);
};

Chessboard.prototype.showCaptured = function() {
  var w_captured = '';
  var b_captured = '';
  for (var i in this.state.captured) {
    var piece = this.state.captured[i];
    if (piece.color === 'w') {
      w_captured += '<div class="piece-small ' + piece.type.toUpperCase() + '-small" style="float: left"></div>';
    } else {
      b_captured += '<div class="piece-small ' + piece.type + '-small" style="float: left"></div>';
    }
  }
  if (this.player && this.player.color == 'b') {
    $("#top-captured").html(b_captured);
    $("#bottom-captured").html(w_captured);
  } else {
    $("#top-captured").html(w_captured);
    $("#bottom-captured").html(b_captured);
  }
};

