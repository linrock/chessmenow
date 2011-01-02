var initializeBoard = function() {
  var initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  chess.load(initialFen);
  loadFen(initialFen);
  $("#turn").text(chess.turn());
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
        col_num += parseInt(rows[i][j]);
      } else {
        $("#" + cols[col_num] + row_num + " > div").addClass('piece ' + rows[i][j]);
        ++col_num;
      }
    }
    --row_num;
  }
}

var movePiece = function(from, to) {
  var newClass = $('#' + from + ' > div').attr('class');
  $('#' + from + ' > div').removeClass(newClass);
  $('#' + to + ' > div').removeClass();
  $('#' + to + ' > div').addClass(newClass);
  $.post('/' + game_id + '/move', { fen: chess.fen() }, function(data) {
    // alert(data);
  });
}

var hasPiece = function(position) {
  return $("#" + position + " > .piece").length !== 0;
}

var getPieceColor = function(position) {
  var color = null;
  var whites = 'PRNBQK';
  var blacks = 'prnbqk';
  var className = $("#" + position + " > div").attr('class').replace('piece ','');
  if (hasPiece(position)) {
    if (whites.indexOf(className) > -1) {
      color = 'w';
    } else if (blacks.indexOf(className) > -1) {
      color = 'b';
    }
    return color;
  }
}

var isYourPiece = function(position) {
  return hasPiece(position) && getPieceColor(position) === chess.turn();
}
