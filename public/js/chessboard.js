var startingPosition = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

var loadBoard = function(fen) {
  if (!fen) {
    fen = startingPosition;
  }
  chess.load(fen);
  loadFen(fen);
  displayTurn();
}

var loadFen = function(fen) {
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
        $("#" + cols[col_num++] + row_num + " > div").removeClass().addClass('piece ' + rows[i][j]);
      }
    }
    --row_num;
  }
}

var movePiece = function(from, to) {
  loadFen(chess.fen());
  // $.post('/' + game_id + '/move', { fen: chess.fen() }, function(data) {
  //   alert(data);
  // });
  client.publish('/game/' + game_id + '/moves', { fen: chess.fen() });
  if (chess.in_checkmate()) {
    alert('CHECKMATE!!');
  } else if (chess.in_check()) {
    alert('Check');
  } else if (chess.in_stalemate()) {
    alert('Stalemate!');
  }
  selected = null;
}

var displayTurn = function() {
  if (chess.turn() == your_color) {
    $("#turn").text("Your turn!");
  } else if (chess.turn() == 'w') {
    $("#turn").text("White's turn");
  } else if (chess.turn() == 'b') {
    $("#turn").text("Black's turn");
  }
}

var pieceExistsAt = function(position) {
  return $("#" + position + " > .piece").length !== 0;
}

var getPieceColor = function(position) {
  var color = null;
  var whites = 'PRNBQK';
  var blacks = 'prnbqk';
  var className = $("#" + position + " > div").attr('class').replace('piece ','');
  if (pieceExistsAt(position)) {
    if (whites.indexOf(className) > -1) {
      color = 'w';
    } else if (blacks.indexOf(className) > -1) {
      color = 'b';
    }
    return color;
  }
}

var isYourPiece = function(position) {
  return pieceExistsAt(position) && getPieceColor(position) === chess.turn();
}


var initialize = function() {
  $("td").click(function() {
    var position = $(this).attr('id');
    if (selected && chess.move(selected, position)) {
      movePiece(selected, position);
      displayTurn();
    }
    else if (isYourPiece(position)) {
      if (!$(this).hasClass('selected')) {
        $(this).addClass('selected');
        selected = position;
      } else {
        $(this).removeClass('selected');
        selected = null;
      }
    }
    $("td").not(this).removeClass("selected");
  });
  loadBoard(fen);

  $("#pick_white").click(function() {
    $.post("/" + game_id + "/color", {color: 'w'}, function(data) {
      alert('you chose white!')
    });
    return false;
  });
  $("#pick_black").click(function() {
    $.post("/" + game_id + "/color", {color: 'b'}, function(data) {
      alert('you chose black!')
    });
    return false;
  });

  client = new Faye.Client('http://localhost:3000/game/' + game_id);
  client.subscribe('/game/' + game_id, function(message) {
    alert(message);
  });
  client.subscribe('/game/' + game_id + '/moves', function(message) {
    if (message.fen) {
      loadBoard(message.fen);
    }
  });
}
