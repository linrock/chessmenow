var ChessPiece = Backbone.Model.extend({
  initialize: function(options) {
    this.set(options);
  },
});

var ChessPieceCollection = Backbone.Collection.extend({
  model: ChessPiece,
  getSelected: function() {
    return this.detect(function(piece) {
      return piece.get('selected');
    });
  },
  deselect: function() {
    var selected = Pieces.getSelected();
    if (selected) {
      selected.set({ selected: false });
      $(selected.view.el).parent().removeClass('selected');
    }
  },
  getPiece: function(position) {
    return this.detect(function(piece) {
      return piece.get('position') === position;
    });
  }
});
var Pieces = new ChessPieceCollection();

var ChessPieceView = Backbone.View.extend({
  tagName: 'div',
  initialize: function() {
    _.bindAll(this, 'render');
    this.model.view = this;
  },
  events: {
    'click': 'selectPiece',
  },
  selectPiece: function() {
    var selected = Pieces.getSelected();
    this.model.set({ selected: true });
    $(this.el).parent().addClass('selected');
    if (selected) {
      selected.set({ selected: false });
      $(selected.view.el).parent().removeClass('selected');
    }
  },
  render: function() {
    $(this.el).html('<div class="piece ' + this.model.get('type') + '"></div>');
    return this;
  },
});

var Application = Backbone.Model.extend({
  initialize: function() {
    var client = new Chess();
    var board = {};
    for (var square in client.SQUARES) {
      board[square] = '';
    }
    this.set({ socket: null, player: null, client: client, selected: null, board: board, board_diff: {} });
  },
  loadFen: function(fen) {
    fen = fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    var client = this.get('client');
    var board = {};
    client.load(fen);
    _.each(client.SQUARES, function(square) {
      board[square] = client.get(square);
    });
    this.set({ client: client, board: board, board_diff: board });
  },
  selectTile: function(position) {
    var selected = this.get('selected');
    var client = this.get('client');
    if (client.get(position)) {
      if (!selected) {
        this.set({ selected: position });
        this.view.toggleTileHighlight(position, 'on');
      } else {
        this.set({ selected: position });
        this.view.toggleTileHighlight(position, 'on');
        this.view.toggleTileHighlight(selected, 'off');
      }
    } else if (selected) {
      this.set({ selected: null });
      this.view.toggleTileHighlight(selected, 'off');
      this.move({ from: selected, to: position });
    }
    console.log(position);
  },
  move: function(move) {
    var client = this.get('client');
    var board = this.get('board');
    if (client.move(move)) {
      var board_diff = {};
      _.each(client.SQUARES, function(square) {
        var s1 = board[square];
        var s2 = client.get(square);
        if (s1 && s2) {
          if (s1.type !== s2.type || s1.color !== s2.color) {
            board_diff[square] = s2;
          }
        } else if (s1 || s2) {
          board_diff[square] = s2;
        }
        board[square] = s2;
      });
      this.set({ client: client, board: board, board_diff: board_diff });
      return true;
    } else {
      return false;
    }
  }
});

var ApplicationView = Backbone.View.extend({
  el: $("#tablearea"),
  initialize: function() {
    _.bindAll(this, 'generateBoard', 'updateBoard', 'addPiece');
    this.model.bind('change:board_diff', this.updateBoard);
    this.model.view = this;
    this.generateBoard();
  },
  generateBoard: function() {
    var model = this.model;
    var client = this.model.get('client');
    this.$("#chessboard").html(function() {
      var cols = ['8','7','6','5','4','3','2','1'];
      var rows = ['a','b','c','d','e','f','g','h'];
      var board_html = '';
      var count = 0;
      for (var i in cols) {
        for (var j in rows) {
          var position = rows[j]+cols[i];
          board_html += '<div id="' + position + '" class="tile ' + ((count++ % 2 === 0) ? 'white':'black') + '"><div></div></div>';
        }
        ++count;
      }
      return(board_html);
    });
    this.$(".tile").live('click', function() {
      var position = $(this).attr('id');
      model.selectTile(position);
    });
  },
  updateBoard: function() {
    var board_diff = this.model.get('board_diff');
    var showChanges = function(pieces) {
      _.each(pieces, function(v,k) {
        if (v) {
          var type = v.type;
          if (v.color === 'w') {
            type = type.toUpperCase();
          }
          this.$('#' + k + ' > div').removeClass().addClass('piece ' + type);
        } else {
          this.$('#' + k + ' > div').removeClass();
        }
      });
    };
    showChanges(board_diff);
    console.log('Board updated!');
  },
  toggleTileHighlight: function(position, s) {
    if (!s) {
      this.$('#' + position).toggleClass('selected');
    } else if (s === 'on') {
      this.$('#' + position).addClass('selected');
    } else if (s === 'off') {
      this.$('#' + position).removeClass('selected');
    }
  }
});

var a = new ApplicationView({ model: new Application() });
// a.addPiece('d3', 'K');
a.model.loadFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
// a.model.loadFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");


















var hessboard = function(options, player) {
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

