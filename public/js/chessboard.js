var Chessboard = function(options, player) {
  var self = this;
  self.selected = null;

  self.player = (function() {
    p = new Object();
    for (i in player) {
      p[i] = player[i];
    }
    return p;
  })();

  self.state = (function() {
    state = new Object();
    for (i in options) {
      state[i] = options[i];
    }
    return state;
  })();
  
  self.client = (function() {
    var c = new Faye.Client('http://localhost:3000/game/' + game_id);
    c.subscribe('/game/' + game_id, function(message) {
      alert(JSON.stringify(message));
    });
    c.subscribe('/game/' + game_id + '/moves', function(message) {
      if (message.fen) {
        self.loadFen(message.fen);
      }
    });
    c.publish('/game/' + game_id, { game_id: game_id, id: self.player.id });
    return c;
  })();
  
  self.generateBoard();
  self.loadFen(self.state.fen);

  $("#choose-white").click(function() {
    self.player.color = 'w';
    self.generateBoard();
    self.loadFen(self.state.fen);
    self.client.publish('/game/' + game_id + '/colors', {
      game_id: game_id,
      color: 'w'
    });
    $(this).hide();
    $("#top-name").hide();
    $("#top-name").removeClass();
    $("#top-name").addClass('black-player');
    $("#bottom-name").show();
    $("#bottom-name").removeClass();
    $("#bottom-name").addClass('white-player');
    $("#choose-black").show();
  });
  $("#choose-black").click(function() {
    self.player.color = 'b';
    self.generateBoard();
    self.loadFen(self.state.fen);
    self.client.publish('/game/' + game_id + '/colors', {
      game_id: game_id,
      color: 'b'
    });
    $(this).hide();
    $("#top-name").hide();
    $("#top-name").removeClass();
    $("#top-name").addClass('white-player');
    $("#bottom-name").show();
    $("#bottom-name").removeClass();
    $("#bottom-name").addClass('black-player');
    $("#choose-white").show();
  });
};

Chessboard.prototype = new Chess();
Chessboard.prototype.constructor = Chessboard;

Chessboard.prototype.loadFen = function(fen) {
  if (!fen) {
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
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
      if (!this.state.captured) {
        this.state.captured = [];
      }
      this.state.captured.push(existing);
    }
    this.client.publish('/game/' + game_id + '/moves', {
      fen: this.fen(),
      captured: this.state.captured,
      game_id: game_id
    });
    this.loadFen(this.fen());
    this.checkGameState();
    selected = null;
  }
};

Chessboard.prototype.checkGameState = function() {
  this.showCaptured();
  var turn = this.turn();
  // if (this.state.started) {
  if (true) {
    if (this.in_checkmate()) {
     if (turn == this.player.color) {
        $("#turn").text("CHECKMATE - You win!");
      } else if (turn == 'w') {
        $("#turn").text("CHECKMATE - Black wins!");
      } else if (turn == 'b') {
        $("#turn").text("CHECKMATE - White wins!");
      }
    } else if (this.in_stalemate()) {
      $("#turn").text("Stalemate!");
    } else {
      if (turn == 'w') {
        $('.turn-indicator').hide()
        $('.white-player + .turn-indicator').show()
      } else {
        $('.turn-indicator').hide()
        $('.black-player + .turn-indicator').show()
      }
      if (this.in_check()) {
        $("#turn").text("Check!");
      } else if (turn == this.player.color) {
        $("#turn").text("Your turn!");
      } else if (turn == 'w') {
        $("#turn").text("White's turn");
      } else if (turn == 'b') {
        $("#turn").text("Black's turn");
      }
    }
  }
}

Chessboard.prototype.pieceExistsAt = function(position) {
  return this.get(position) !== null;
};

Chessboard.prototype.getPieceColor = function(position) {
  var piece = this.get(position);
  if (piece) {
    return piece.toLowerCase() === piece ? 'b' : 'w';
  }
}

Chessboard.prototype.isYourPiece = function(position) {
  return this.pieceExistsAt(position) && this.getPieceColor(position) === this.turn();
}

Chessboard.prototype.generateBoard = function() {
  var self = this;
  var cols = '87654321';
  var rows = 'abcdefgh';
  if (self.player.color == 'b') {
    cols = cols.split('').reverse().join('');
    rows = rows.split('').reverse().join('');
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

  /*
  if (self.player.color == 'b') {
    $("#white-side").insertBefore("#middlearea");
    $("#black-side").insertAfter("#middlearea");
  } else {
    $("#black-side").insertBefore("#middlearea");
    $("#white-side").insertAfter("#middlearea");
  }
  */
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
}
