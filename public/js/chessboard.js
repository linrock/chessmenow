var initializeBoard = function() {
  $("#a2 > div").addClass('piece white-pawn');
  $("#b2 > div").addClass('piece white-pawn');
  $("#c2 > div").addClass('piece white-pawn');
  $("#d2 > div").addClass('piece white-pawn');
  $("#e2 > div").addClass('piece white-pawn');
  $("#f2 > div").addClass('piece white-pawn');
  $("#g2 > div").addClass('piece white-pawn');
  $("#h2 > div").addClass('piece white-pawn');
  $("#a1 > div").addClass('piece white-rook');
  $("#h1 > div").addClass('piece white-rook');
  $("#b1 > div").addClass('piece white-knight');
  $("#g1 > div").addClass('piece white-knight');
  $("#c1 > div").addClass('piece white-bishop');
  $("#f1 > div").addClass('piece white-bishop');
  $("#d1 > div").addClass('piece white-queen');
  $("#e1 > div").addClass('piece white-king');
  $("#a7 > div").addClass('piece black-pawn');
  $("#b7 > div").addClass('piece black-pawn');
  $("#c7 > div").addClass('piece black-pawn');
  $("#d7 > div").addClass('piece black-pawn');
  $("#e7 > div").addClass('piece black-pawn');
  $("#f7 > div").addClass('piece black-pawn');
  $("#g7 > div").addClass('piece black-pawn');
  $("#h7 > div").addClass('piece black-pawn');
  $("#a8 > div").addClass('piece black-rook');
  $("#h8 > div").addClass('piece black-rook');
  $("#b8 > div").addClass('piece black-knight');
  $("#g8 > div").addClass('piece black-knight');
  $("#c8 > div").addClass('piece black-bishop');
  $("#f8 > div").addClass('piece black-bishop');
  $("#d8 > div").addClass('piece black-queen');
  $("#e8 > div").addClass('piece black-king');
  chess.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
}

var movePiece = function(from, to) {
  var newClass = $('#' + from + ' > .piece').attr('class');
  $('#' + from + ' > div').removeClass(newClass);
  $('#' + to + ' > div').addClass(newClass);
}

var hasPiece = function(position) {
  return $("#" + position + " > .piece").length !== 0
}
