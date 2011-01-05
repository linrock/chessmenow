var Chessboard = function(options) {
  this.initial_position = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  this.selected = null;

  this.state = (function() {
    state = [];
    for (i in options) {
      state[i] = options[i];
    }
    return state;
  })();

  this.generate_board();
  this.load_fen(this.state.fen);

  $("#pick_white").click(function() {
    this.color = 'w';
    this.generate_board();
    this.load_fen(this.state.fen);
    client.publish('/game/' + game_id + '/colors', { game_id: game_id, color: 'w' });
  });
  $("#pick_black").click(function() {
    this.color = 'b';
    this.generate_board();
    this.load_fen(this.state.fen);
    client.publish('/game/' + game_id + '/colors', { game_id: game_id, color: 'b' });
  });

  this.client = new Faye.Client('http://localhost:3000/game/' + game_id);
  this.client.subscribe('/game/' + game_id, function(message) {
    alert(message);
  });
  this.client.subscribe('/game/' + game_id + '/moves', function(message) {
    if (message.fen) {
      loadBoard(message.fen);
    }
  });
};

Chessboard.prototype = new Chess();
Chessboard.prototype.constructor = Chessboard;

Chessboard.prototype.load_fen = function(fen) {
  if (!fen) {
    fen = this.initial_position;
  }
  this.load(fen);
  rows = fen.split(' ')[0].split('/');
  var cols = 'abcdefgh';
  var row_num = 8;
  var col_num;
  for (i in rows) {
    col_num = 0;
    for (j in rows[i]) {
      if (rows[i][j] >= 1) {
        num_cols = parseInt(rows[i][j]);
        for (var k=0 ; k < num_cols; ++k) {
          $("#" + cols[col_num] + row_num + " > div").removeClass();
          ++col_num;
        }
      } else {
        $("#" + cols[col_num++] + row_num + " > div")
          .removeClass()
          .addClass('piece ' + rows[i][j]);
      }
    }
    --row_num;
  }
  this.check_game_state();
};

Chessboard.prototype.move_to = function(to) {
  var existing = this.get(to);
  if (this.selected && this.move(this.selected, to)) {
    this.client.publish('/game/' + game_id + '/moves', {
      fen: this.fen(),
      captured: game_state.captured,
      game_id: game_id
    });
    this.load_fen(this.fen());
    this.check_game_state();
    selected = null;
  }
};

Chessboard.prototype.check_game_state = function() {
  if (this.in_checkmate() && this.turn() == 'w') {
    $("#turn").text("CHECKMATE - Black wins!");
  } else if (this.in_checkmate() && this.turn() == 'b') {
    $("#turn").text("CHECKMATE - White wins!");
  } else if (this.in_check()) {
    $("#turn").text("Check!");
  } else if (this.in_stalemate()) {
    $("#turn").text("Stalemate!");
  } else if (this.turn() == this.your_color) {
    $("#turn").text("Your turn!");
  } else if (this.turn() == 'w') {
    $("#turn").text("White's turn");
  } else if (this.turn() == 'b') {
    $("#turn").text("Black's turn");
  }
}

Chessboard.prototype.piece_exists_at = function(position) {
  return this.get(position) !== null;
};

Chessboard.prototype.get_piece_color = function(position) {
  var whites = 'PRNBQK';
  var blacks = 'prnbqk';
  var className = this.get(position);
  if (this.piece_exists_at(position)) {
    if (whites.indexOf(className) > -1) {
      return 'w';
    } else if (blacks.indexOf(className) > -1) {
      return 'b';
    }
  }
}

Chessboard.prototype.is_your_piece = function(position) {
  return this.piece_exists_at(position) && this.get_piece_color(position) === this.turn();
}

Chessboard.prototype.generate_board = function() {
  var cols;
  var rows;
  var self = this;
  if (self.color == 'b') {
    cols = '12345678';
    rows = 'hgfedcba';
  } else {
    cols = '87654321';
    rows = 'abcdefgh';
  }
  var board = '';
  for (var i in cols) {
    board += '<tr>';
    for (var j in rows) {
      var tileco = ((parseInt(cols[i])+rows[j].charCodeAt(0)) % 2 == 1) ? 'white-tile' : 'black-tile';
      board += '<td width="45px" height="45px" id="' + rows[j] + cols[i] + '" class="' + tileco + '"><div></div></td>';
    }
    board += '</tr>';
  }
  $("#chessboard").html(board);
  $("td").click(function() {
    var position = $(this).attr('id');
    if (self.is_your_piece(position)) {
      if ($(this).hasClass('selected')) {
        $(this).removeClass('selected');
        self.selected = null;
      } else {
        $(this).addClass('selected');
        self.selected = position;
      }
    } else {
      self.move_to(position);
    }
    $("td").not(this).removeClass("selected");
  });
};
