var Application = Backbone.Model.extend({
  initialize: function() {
    _.bindAll(this, 'loadFen');
    this.pingForever();
    this.pollForMessages();
    if (state !== 'ended') {
      this.pollForMoves();
    }
    this.errorHandlerHack();
    this.set({
      client: new Chess(),
      selected: null,
      captured: game_state.captured,
      player: player_state,
      state: state,
      request_count: 0,
      error_count: 0,
      last_mid: last_mid
    });
  },
  pingForever: function() {
    $(function() {
      $.ajax({ url: '/' + game_id + '/ping', type: 'POST' });
      setInterval(function() {
        $.ajax({ url: '/' + game_id + '/ping', type: 'POST' });
      }, 5000);
    });
  },
  pollForMessages: function() {
    var self = this;
    var request_count = parseInt(self.get('request_count'));
    self.set({ request_count: request_count+1 });
    $.ajax({
      url: '/' + game_id + '/xhr-polling',
      success: function(data) {
        var mid = self.get('last_mid');
        self.set({ last_mid: data.mid+1 });
        if (data.mid !== mid) {
          $.ajax({
            url: '/' + game_id + '/messages',
            data: { id_min: mid, id_max: data.mid-1 },
            async: false,
            success: function(data) {
              for (i in data) {
                self.processMessage(data[i]);
              }
            },
          });
        }
        self.processMessage(data);
        if (request_count > 50) {
          self.view.appendToChat({
            type: 'error',
            text: 'An error has occured. Please refresh the page to continue.'
          });
        } else {
          self.pollForMessages();
        }
      },
      error: function(xhr) {
        var error_count = parseInt(self.get('error_count'));
        self.set({ error_count: error_count+1 });
        if (xhr.status === 502 || error_count > 300) {
          self.view.appendToChat({
            type: 'error',
            text: 'An error has occured. Please refresh the page to continue.'
          });
        } else {
          self.pollForMessages();
        }
      }
    });
  },
  pollForMoves: function() {
    var self = this;
    $.ajax({
      url: '/' + game_id + '/moves',
      success: function(data) {
        if (data.move) {
          self.move(data.move, false);
        }
        self.pollForMoves();
      },
      error: function(xhr) {
        var error_count = parseInt(self.get('error_count'));
        self.set({ error_count: error_count+1 });
        if (xhr.status !== 502 && error_count < 300) {
          self.pollForMoves();
        }
      }
    });
  },
  processMessage: function(data) {
    switch (data.type) {
      case 'color':
        if (data.color === 'b') {
          $(".b-player").css('visibility', 'visible');
          $("#choose-b").remove();
        } else if (data.color === 'w') {
          $(".w-player").css('visibility', 'visible');
          $("#choose-w").remove();
        }
        this.view.appendToChat({
          type: 'announcement',
          text: data.text
        });
        if (data.started_at) {
          this.set({ state: 'started' });
        }
        break;
      case 'chat':
      case 'announcement':
      case 'game':
        this.view.appendToChat(data);
        if (data.state === 'ended') {
          this.set({ state: 'ended' });
          $("#rematch").fadeIn('slow').click(function() {
            window.location = '/' + data.new_game_id;
          });
        }
        break;
    }
  },
  errorHandlerHack: function() {
    // XXX for firefox/view source bullshit
    var self = this;
    setInterval(function() {
      self.set({ request_count: 0 })
    }, 5000);
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
      this.move({ from: selected, to: position, promotion: 'q' }, true);
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
  },
  move: function(move, remote) {
    var client = this.get('client');
    var board = this.get('board');
    var move = client.move(move);
    var self = this;
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
        board[square] = s2; });
      this.set({ client: client, board: board, board_diff: board_diff });
      this.view.highlightMove(move);
      this.view.updateMoveList(move);
      if (remote) {
        var data = { fen: client.fen(), move: move };
        $.post('/' + game_id + '/move', data, function(response) {
          if (response == 0) {}
        });
        if (client.game_over()) {
          var turn = client.turn();
          var message = (function() {
            if (client.in_checkmate()) {
              if (turn === 'w') {
                return "Checkmate - Black wins!";
              } else if (turn === 'b') {
                return "Checkmate - White wins!";
              }
            } else if (client.in_threefold_repetition()) {
              return "Draw - 3x Repetition!";
            } else if (client.in_stalemate()) {
              return "Draw - Stalemate!";
            } else if (client.in_draw()) {
              return 'Draw!';
            }
          })();
          $.post('/' + game_id + '/game_over', { message: message }, function(response) {
          });
        }
      }
      return move;
    } else {
      return false;
    }
  }
});

var ApplicationView = Backbone.View.extend({
  el: $("#content"),
  initialize: function() {
    _.bindAll(this, 'generateBoard', 'onStateChange', 'updateBoard', 'updateViewState', 'updateCaptured', 'initializeChat');
    var model = this.model;
    model.view = this;
    model.bind('change:board_diff', this.updateBoard);
    model.bind('change:board_diff', this.updateViewState);
    model.bind('change:captured', this.updateCaptured);
    model.bind('change:state', this.onStateChange);
    this.generateBoard(player_state.color);
    this.onStateChange();
    this.displayNames();
    this.initializeChat();
    this.$("#move-list").scrollTop($('#move-list').attr('scrollHeight'));
  },
  generateBoard: function(color) {
    var client = this.model.get('client');
    this.$("#chessboard").html(function() {
      var cols = ['8','7','6','5','4','3','2','1'];
      var rows = ['a','b','c','d','e','f','g','h'];
      if (color === 'b') {
        cols = cols.reverse();
        rows = rows.reverse();
        $("#bottom-side").append($(".b-player"));
        $("#top-side").append($(".w-player"));
      } else {
        $("#bottom-side").append($(".w-player"));
        $("#top-side").append($(".b-player"));
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
  initializeChat: function() {
    var self = this;
    this.$("form#chat").submit(function(event) {
      event.preventDefault();
      var input = $("#chat-input");
      var text = input.val();
      if (text > '') {
        input.val('');
        $.post('/' + game_id + '/chat', { text: text }, function(response) {
          if (response != 1) {}
        });
      }
    });
  },
  onStateChange: function() {
    var state = this.model.get('state');
    switch (state) {
      case 'new':
        this.displayColorChoosers();
        break;

      case 'started':
        var model = this.model;
        this.updateViewState();
        this.updateCaptured();
        this.$("#resign").show();
        this.$(".w-player").css('visibility', 'visible');
        this.$(".b-player").css('visibility', 'visible');
        this.$("#move-list").css('visibility', 'visible');
        this.$(".tile").live('click', function() {
          var position = $(this).attr('id');
          model.selectTile(position);
        });
        this.$("#resign").live('click', function() {
          $.post('/' + game_id + '/resign', { color: player_state.color }, function(response) {
          });
        });
        this.$("#draw").live('click', function() {
          $.post('/' + game_id + '/draw', { color: player_state.color }, function(response) {
          });
        });
        break;

      case 'ended':
        this.updateCaptured();
        this.$(".w-player").css('visibility', 'visible').removeClass('current-turn');
        this.$(".b-player").css('visibility', 'visible').removeClass('current-turn');
        this.$("#move-list").css('visibility', 'visible').fadeIn('fast');
        this.$(".tile").die('click');
        this.$("#resign").die('click').hide();
        this.$("#draw").die('click').hide();
        break;
    }
  },
  displayColorChoosers: function() {
    var self = this;
    var client = self.model.get('client');
    var player = self.model.get('player');
    _.each(['w','b'], function(c) {
      if (!_.include(chosen_colors, c)) {
        $("#choose-" + c).show().click(function() {
          player.color = c;
          $.post('/' + game_id + '/color', { color: c }, function(response) {
            if (response == 0) {
              var color = (c === 'w') ? 'White': 'Black';
              self.appendToChat({
                type: 'error',
                text: color + ' has already been picked!'
              });
            }
          });
          if (c === 'b') {
            self.generateBoard('b');
            self.updateBoard();
          }
          // $("." + c + "-player").html('You');
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
  },
  updateViewState: function() {
    this.$("#info").text(this.model.get('board_state'));
    var client = this.model.get('client');
    if (this.model.get('state') === 'started') {
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
    var w_captured = '';
    var b_captured = '';
    _.each(this.model.get('captured'), function(piece) {
      if (piece.toUpperCase() === piece) {
        b_captured += '<div class="piece-small ' + piece + '-small" style="float: left"></div>';
      } else {
        w_captured += '<div class="piece-small ' + piece + '-small" style="float: left"></div>';
      }
    });
    $("#captured-black-pieces").html(w_captured);
    $("#captured-white-pieces").html(b_captured);
  },
  updateMoveList: function(move) {
    var move_list = $("#move-list > .move-row");
    if (move.color === 'w') {
      var move_num = move_list.length+1;
      var move_html = '';
      move_html += '<div class="move-row">';
      move_html += '<span class="move-num">' + move_num + '.</span>';
      move_html += '<span class="move">' + move.san + '</span>';
      move_html += '</div>';
      if (move_num === 1) {
        $("#move-list").append($(move_html).fadeIn('fast'));
      } else {
        move_list.last().after($(move_html).fadeIn('fast'));
      }
    } else if (move.color === 'b') {
      move_list.last().append($('<span class="move">' + move.san + '</div>').fadeIn('fast'));
    }
    this.$("#move-list > .move-row > .move").removeClass('last-move');
    this.$("#move-list > .move-row > .move").last().addClass('last-move');
    this.$("#move-list").scrollTop($('#move-list').attr('scrollHeight'));
  },
  highlightMove: function(move) {
    this.$(".moved").removeClass('moved');
    this.$("#" + move.from).addClass('moved');
    this.$("#" + move.to).addClass('moved');
    this.$("#move-list > .move-row > .move").removeClass('last-move');
    this.$("#move-list > .move-row > .move").last().addClass('last-move');
  },
  highlightTile: function(position, s) {
    if (!s) {
      this.$('#' + position).toggleClass('selected');
    } else if (s === 'on') {
      this.$('#' + position).addClass('selected');
    } else if (s === 'off') {
      this.$('#' + position).removeClass('selected');
    }
  },
  appendToChat: function(message) {
    var chat_html = '<div class="chat-row">';
    var chat_window = this.$("#chat-window");
    switch (message.type) {
      case 'chat':
        chat_html += '<span class="chat-name">' + message.user +  ': </span>';
        chat_html += '<span class="chat-text">' + message.text + '</span>';
        break;
      case 'announcement':
        chat_html += '<span class="chat-announcement">' + message.text + '</span>';
        break;
      case 'game':
        chat_html += '<span class="chat-game">' + message.text + '</span>';
        break;
      case 'error':
        chat_html += '<span class="chat-error">' + message.text + '</span>';
        break;
    }
    chat_html += '</div>';
    chat_window.append($(chat_html).fadeIn('fast'));
    chat_window.scrollTop(chat_window.attr('scrollHeight'));
  }
});
