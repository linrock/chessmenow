var Application = Backbone.Model.extend({
  initialize: function() {
    _.bindAll(this, 'initializeSocket', 'loadFen');
    var moves = new MoveList();
    this.set({
      client: new Chess(),
      moves: moves,
      selected: null,
      captured: game_state.captured,
      player: player_state,
      socket: this.initializeSocket(),
    });
    this.bind('change:board_diff', this.updateState);
  },
  initializeSocket: function() {
    var self = this;
    var s = new io.Socket(host, { port: 3000 });
    s.connect();
    s.on('connect', function() {
      s.send({ type: 'auth', auth: document.cookie, game_id: game_id });
    });
    s.on('message', function(message) {
      switch (message.type) {
        case 'move':
          if (message.data.move) {
            self.move(message.data.move);
          }
          break;
        case 'colors':
          if (message.color === 'b') {
            $(".b-player").html('Black');
            $("#choose-b").remove();
          } else if (message.color === 'w') {
            $(".w-player").html('White');
            $("#choose-w").remove();
          }
          if (message.started) {
            self.state.started = true;
            self.checkGameState();
          }
          break;
      }
    });
    s.on('disconnect', function() {
      s.connect();
    });
    setInterval(function() {
      s.send('ping');
    }, 5000);
    return s;
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
    if (selected) {
      this.set({ selected: null });
      this.view.highlightTile(selected, 'off');
      this.move({ from: selected, to: position, promotion: 'q' });
    } else {
      var piece = client.get(position);
      if (piece && piece.color === client.turn()) {
        this.view.highlightTile(position, 'on');
        this.set({ selected: position });
        if (selected) {
          this.view.highlightTile(selected, 'off');
        }
      }
    }
    console.log('Selected: ' + this.get('selected'));
  },
  move: function(move) {
    var client = this.get('client');
    var board = this.get('board');
    var move = client.move(move);
    if (move) {
      if (move.captured) {
        var captured = this.get('captured');
        var piece = move.captured;
        if (move.color === 'b') {
          piece = piece.toUpperCase();
        }
        captured.push(piece);
        this.set({ captured: [] }); // XXX - Fucking event doesn't fire unless this is here.
        this.set({ captured: captured });
        console.log('Captured...');
      }
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
      this.view.highlightMove(move);
      this.get('socket').send({
        type: 'move',
        game_id: game_id,
        data: {
          fen: client.fen(),
          move: move,
        }
      });
      this.get('moves').addMove(move); // XXX - should be an event... but it's not firing.
      return move;
    } else {
      return false;
    }
  },
  updateState: function() {
    var client = this.get('client');
    var turn = client.turn();
    var state = '';
    if (client.in_checkmate()) {
      if (turn === 'w') {
        state = "Checkmate - Black wins!";
      } else if (turn === 'b') {
        state = "Checkmate - White wins!";
      }
    } else if (client.in_stalemate()) {
      state = "Stalemate!";
    } else if (client.in_draw() || client.in_threefold_repetition()) {
      state = "Draw!";
    } else if (client.in_check()) {
      state = "Check!";
    }
    this.set({ state: state });
  }
});

var ApplicationView = Backbone.View.extend({
  el: $("#content"),
  initialize: function() {
    _.bindAll(this, 'generateBoard', 'updateBoard', 'updateState', 'updateCaptured');
    var model = this.model;
    model.view = this;
    model.bind('change:board_diff', this.updateBoard);
    model.bind('change:board_diff', this.updateState);
    model.bind('change:captured', this.updateCaptured);
    this.generateBoard();
    this.displayColorChoosers();
    this.displayNames();
    this.displayMoves();
    this.updateCaptured();
    this.$(".tile").live('click', function() {
      var position = $(this).attr('id');
      model.selectTile(position);
    });
  },
  generateBoard: function() {
    var model = this.model;
    var client = this.model.get('client');
    this.$("#chessboard").html(function() {
      var cols = ['8','7','6','5','4','3','2','1'];
      var rows = ['a','b','c','d','e','f','g','h'];
      if (player_state.color === 'b') {
        cols = cols.reverse();
        rows = rows.reverse();
        $(".b-player").insertAfter("#bottom-name");
        $(".w-player").insertAfter("#top-name");
      } else {
        $(".w-player").insertAfter("#bottom-name");
        $(".b-player").insertAfter("#top-name");
      }
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
  },
  displayColorChoosers: function() {
    var self = this;
    var client = self.model.get('client');
    var player = self.model.get('player');
    _.each(['w','b'], function(c) {
      if (!_.include(chosen_colors, c)) {
        $("#choose-" + c).show().click(function() {
          player.color = c;
          self.model.get('socket').send({
            type: 'colors',
            game_id: game_id,
            player_id: player.id,
            color: c
          });
          if (c === 'b') {
            self.generateBoard('b');
            self.updateBoard();
          }
          $("." + c + "-player").html('You');
          self.model.set({ player: player });
          $(this).hide();
        });
      }
    });
  },
  displayNames: function() {
    if (_.include(chosen_colors, 'w')) {
      $(".w-player").text('White');
    }
    if (_.include(chosen_colors, 'b')) {
      $(".b-player").text('Black');
    }
  },
  displayMoves: function() {
    // XXX - use move models/views in the future?
    $("#move-list").html(function() {
      for (move in game_state.moves) {
        
      }
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
  updateState: function() {
    console.log('Updating state... ');
    this.$("#info").text(this.model.get('state'));
    var client = this.model.get('client');
    var turn = this.model.get('client').turn();
    if (client.game_over()) {
      this.$(".w-player").removeClass('current-turn');
      this.$(".b-player").removeClass('current-turn');
    } else {
      if (client.turn() === 'w') {
        this.$(".w-player").addClass('current-turn');
        this.$(".b-player").removeClass('current-turn');
      } else {
        this.$(".b-player").addClass('current-turn');
        this.$(".w-player").removeClass('current-turn');
      }
    }
  },
  updateCaptured: function() {
    console.log('Updating captured...');
    // XXX - Clean this shit up.
    var w_captured = '';
    var b_captured = '';
    _.each(this.model.get('captured'), function(piece) {
      if (piece.toUpperCase() === piece) {
        b_captured += '<div class="piece-small ' + piece + '-small" style="float: left"></div>';
      } else {
        w_captured += '<div class="piece-small ' + piece + '-small" style="float: left"></div>';
      }
    });
    if (this.model.get('player').color === 'w') {
      $("#top-captured").html(b_captured);
      $("#bottom-captured").html(w_captured);
    } else {
      $("#top-captured").html(w_captured);
      $("#bottom-captured").html(b_captured);
    }
  },
  updateMoveList: function(move) {
    var move_html = '';
    var move_list = $("#move-list > ul");
    var new_move;
    if (move.color === 'w') {
      var move_num = move_list.length+1;
      move_html += '<ul>';
      move_html += '<li class="move-num">' + move_num + '</li>';
      move_html += '<li class="move">' + move.san + '</li>';
      move_html += '</ul>';
      move_list.last().append(move_html);
    } else {
      move_list.last().append('<li class="move">' + move.san + '</li>');
    }
    $("#move-list").append('<ul><li class="move-num">1.</li><li class="move">e4</li><li class="move">e5</li></ul>');
  },
  renderMoveList: function() {
    MoveList;
    this.$("#move-list").html();
  },
  highlightMove: function(move) {
    this.$(".moved").removeClass('moved');
    this.$("#" + move.from).addClass('moved');
    this.$("#" + move.to).addClass('moved');
  },
  highlightTile: function(position, s) {
    if (!s) {
      this.$('#' + position).toggleClass('selected');
    } else if (s === 'on') {
      this.$('#' + position).addClass('selected');
    } else if (s === 'off') {
      this.$('#' + position).removeClass('selected');
    }
  }
});

var Move = Backbone.Model.extend({
  events: {
    'click': this.goToMove
  },
  goToMove: function() {
    alert('oh hi, you clicked me!');
  },
});

var MoveList = Backbone.Collection.extend({
  model: Move,
  nextMoveNum: function() {
    if (!this.length) {
      return 1;
    }
    return this.last().get('order') + 1;
  },
  addMove: function(move) {
    console.log('Adding a move!!!');
    var attrs = {};
    var m;
    if (move.color === 'w') {
      m = new Move({
        move_num: this.nextMoveNum(),
        white: move.san,
        black: null
      });
      this.add(m);
    } else if (move.color === 'b') {
      m = this.last();
      m.set({
        black: move.san
      });
    }
    m.view.render();
  }
});

var MoveView = Backbone.Model.extend({
  tagName: 'ul',
  template: _.template('<ul><li class="move-num"><%= move_num %></li><li class="move"><%= black %></li><li class="move"><%= white %></li></ul>'),
  initialize: function() {
    _.bindAll(this, 'render');
    this.model.view = this;
  },
  render: function() {
    console.log('Rendering move...');
    $(this.el).html(this.template(this.model.toJSON()));
  }
});
