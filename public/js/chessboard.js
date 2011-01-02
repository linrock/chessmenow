var initializeBoard = function() {
  $("#a2 > div").addClass('piece w white-pawn');
  $("#b2 > div").addClass('piece w white-pawn');
  $("#c2 > div").addClass('piece w white-pawn');
  $("#d2 > div").addClass('piece w white-pawn');
  $("#e2 > div").addClass('piece w white-pawn');
  $("#f2 > div").addClass('piece w white-pawn');
  $("#g2 > div").addClass('piece w white-pawn');
  $("#h2 > div").addClass('piece w white-pawn');
  $("#a1 > div").addClass('piece w white-rook');
  $("#h1 > div").addClass('piece w white-rook');
  $("#b1 > div").addClass('piece w white-knight');
  $("#g1 > div").addClass('piece w white-knight');
  $("#c1 > div").addClass('piece w white-bishop');
  $("#f1 > div").addClass('piece w white-bishop');
  $("#d1 > div").addClass('piece w white-queen');
  $("#e1 > div").addClass('piece w white-king');
  $("#a7 > div").addClass('piece b black-pawn');
  $("#b7 > div").addClass('piece b black-pawn');
  $("#c7 > div").addClass('piece b black-pawn');
  $("#d7 > div").addClass('piece b black-pawn');
  $("#e7 > div").addClass('piece b black-pawn');
  $("#f7 > div").addClass('piece b black-pawn');
  $("#g7 > div").addClass('piece b black-pawn');
  $("#h7 > div").addClass('piece b black-pawn');
  $("#a8 > div").addClass('piece b black-rook');
  $("#h8 > div").addClass('piece b black-rook');
  $("#b8 > div").addClass('piece b black-knight');
  $("#g8 > div").addClass('piece b black-knight');
  $("#c8 > div").addClass('piece b black-bishop');
  $("#f8 > div").addClass('piece b black-bishop');
  $("#d8 > div").addClass('piece b black-queen');
  $("#e8 > div").addClass('piece b black-king');
  chess.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  $("#turn").text(chess.turn());
}

var movePiece = function(from, to) {
  var newClass = $('#' + from + ' > div').attr('class');
  $('#' + from + ' > div').removeClass(newClass);
  $('#' + to + ' > div').removeClass();
  $('#' + to + ' > div').addClass(newClass);
}

var hasPiece = function(position) {
  return $("#" + position + " > .piece").length !== 0;
}

var isYourPiece = function(position) {
  return hasPiece(position) && $("#" + position + " > .piece").hasClass(chess.turn());
}
