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
  
  self.client = (function() {
    var c = new Faye.Client('http://localhost:3000/game/' + game_id);
    c.subscribe('/game/' + game_id, function(message) {
      // alert(JSON.stringify(message));
    });
    c.subscribe('/game/' + game_id + '/moves', function(message) {
      // console.dir(message);
      if (message.fen) {
        self.state.captured = message.captured;
        self.loadFen(message.fen);
      }
      self.showLastMoved(message.move);
    });
    c.subscribe('/game/' + game_id + '/colors', function(message) {
      if (message) {
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
      }
    });
    c.publish('/game/' + game_id, { game_id: game_id, id: self.player.id });
    return c;
  })();
  
  self.generateBoard();
  self.loadFen(self.state.fen);
  self.showLastMoved(self.state.last_move);

  if ($.inArray('w', self.state.players) === -1) {
    $("#choose-white").show();
    $("#choose-white").click(function() {
      self.player.color = 'w';
      self.state.players.push('w');
      $(this).hide();
      $(".white-player").insertAfter("#bottom-name");
      $(".black-player").insertAfter("#top-name");
      $(".white-player").html('White');
      self.generateBoard();
      self.loadFen(self.state.fen);
      self.client.publish('/game/' + game_id + '/colors', {
        game_id: game_id,
        player_id: self.player.id,
        color: 'w'
      });
    });
  } else {
    $(".white-player").html('White');
  }
  if ($.inArray('b', self.state.players) === -1) {
    $("#choose-black").show();
    $("#choose-black").click(function() {
      self.player.color = 'b';
      self.state.players.push('b');
      $(this).hide();
      $(".black-player").insertAfter("#bottom-name");
      $(".white-player").insertAfter("#top-name");
      $(".black-player").html('Black');
      self.generateBoard();
      self.loadFen(self.state.fen);
      self.client.publish('/game/' + game_id + '/colors', {
        game_id: game_id,
        player_id: self.player.id,
        color: 'b'
      });
    });
  } else {
    $(".black-player").html('Black');
  }
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
  rows = fen.split(' ')[0].split('/');
  var cols = 'abcdefgh';
  var row_num = 8;
  var col_num;
  for (var i in rows) {
    col_num = 0;
    for (var j in rows[i]) {
      if (rows[i][j] >= 1) {
        num_cols = parseInt(rows[i][j]);
        for (var k=0 ; k < num_cols; ++k) {
          $("#" + cols[col_num++] + row_num + " > div").removeClass();
        }
      } else {
        $("#" + cols[col_num++] + row_num + " > div")
          .removeClass()
          .addClass('piece ' + rows[i][j]);
      }
    }
    --row_num;
  }
  this.checkGameState();
};

Chessboard.prototype.moveTo = function(to) {
  var existing = this.get(to);
  if (this.selected && this.move(this.selected, to)) {
    if (existing) {
      this.state.captured.push(existing);
    }
    this.client.publish('/game/' + game_id + '/moves', {
      fen: this.fen(),
      move: [this.selected, to],
      captured: this.state.captured,
      game_id: game_id
    });
    this.loadFen(this.fen());
    this.checkGameState();
    selected = null;
  }
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
    if (this.in_checkmate()) {
     if (turn !== this.player.color) {
        $("#info").text("Checkmate - You win!");
      } else if (turn == 'w') {
        $("#info").text("Checkmate - White wins!");
      } else if (turn == 'b') {
        $("#info").text("Checkmate - Black wins!");
      }
    } else if (this.in_stalemate()) {
      $("#info").text("Stalemate!");
    } else {
      if (this.in_check()) {
        $("#info").text("Check!");
      } else {
        $("#info").text('');
      }
      if (turn == this.player.color) {
        // $("#turn").text("Your turn!");
      }
      if (turn == 'w') {
        $('.black-player').removeClass('current-turn');
        $('.white-player').addClass('current-turn');
      } else if (turn == 'b') {
        $('.white-player').removeClass('current-turn');
        $('.black-player').addClass('current-turn');
      }
    }
  }
};

Chessboard.prototype.pieceExistsAt = function(position) {
  return this.get(position) !== null;
};

Chessboard.prototype.getPieceColor = function(position) {
  var piece = this.get(position);
  if (piece) {
    return piece.toLowerCase() === piece ? 'b' : 'w';
  }
};

Chessboard.prototype.isYourPiece = function(position) {
  return this.pieceExistsAt(position) && this.getPieceColor(position) === this.turn();
};

Chessboard.prototype.generateBoard = function() {
  var self = this;
  var cols = ['8','7','6','5','4','3','2','1'];
  var rows = ['a','b','c','d','e','f','g','h'];
  if (self.player.color == 'b') {
    cols = cols.reverse();
    rows = rows.reverse();
    $(".white-player").insertAfter($("top-name"));
    $(".black-player").insertAfter($("bottom-name"));
  } else {
    $(".black-player").insertAfter($("top-name"));
    $(".white-player").insertAfter($("bottom-name"));
  }
  var board = '';
  var count = 0;
  for (var i in cols) {
    for (var j in rows) {
      board += '<div id="' + rows[j]+cols[i] + '" class="tile ' + ((count++ % 2 == 0) ? 'white':'black') + '"><div></div></div>';
    }
    ++count;
  }
  $("#chessboard").html(board);
  $(".tile").click(function() {
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

Chessboard.prototype.showCaptured = function() {
  var w_captured = '';
  var b_captured = '';
  for (var i in this.state.captured) {
    var piece = this.state.captured[i];
    if (piece.toLowerCase() === piece) {
      b_captured += '<div class="piece-small ' + this.state.captured[i] + '-small" style="float: left"></div>';
    } else {
      w_captured += '<div class="piece-small ' + this.state.captured[i] + '-small" style="float: left"></div>';
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
