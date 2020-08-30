var express = require('express');
var router = express.Router();

function idGenerator(){
	var length = 8;
	var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	var result = '';
	for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
	return result;
}

function salaGenerator(){
	return Math.floor(Math.random()*8999)+1000;
}

function shuffle(a) {
	var j, x, i;
	for (i = a.length - 1; i > 0; i--) {
		j = Math.floor(Math.random() * (i + 1));
		x = a[i];
		a[i] = a[j];
		a[j] = x;
	}
	return a;
}

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index', { title: 'Express' });
});


router.post('/crearsala', function(req, res, next) {
  
	var username = req.body.username;
	console.log(username + ": crearsala");

	let db = req.app.get('database');

	var idgamevalido = false;
	var idgame = "";
	while(!idgamevalido){
		idgame = idGenerator();
		let sql = db.prepare("select * from partidas where idgame = ?");
		let row = sql.get(idgame);
		if(row == void(0)){ //if row == undefined
			idgamevalido = true;
		}
	}

	var salavalida = false;
	var sala = 0;
	while(!salavalida){
		sala = salaGenerator();
		let sql = db.prepare("select * from partidas where sala = ? and isActive = 1");
		let row = sql.get(sala);
		if(row == void(0)){ //if row == undefined
			salavalida = true;
		}
	}
	
	var currentTimeUNIX = Math.round(new Date().getTime()/1000);

	var baraja = []
	for(let i = 0; i < 108; i++){
		baraja.push(i+1);
	}
	shuffle(baraja);

	var sql = db.prepare('INSERT INTO partidas VALUES(?,?,?,?,?,?,?,?)');
	var info = sql.run(idgame, sala, 1, currentTimeUNIX, JSON.stringify(baraja), 0, 0, 1);

	var sql2 = db.prepare('INSERT INTO playersensala(username, idgame, sala, numPlayer, isLeader, turno) VALUES(?,?,?,?,?,?)');
	var info = sql2.run(username, idgame, sala, 1, 1, 1);

	let sql3 = db.prepare('select * from playersensala where idgame = ? and turno = 1')
	let rows = sql3.all(idgame);
	var players = [];
	rows.forEach(function(row){
		players.push(row.username);
	})

	res.json({idgame: idgame, sala: sala, numplayers: 1, arrayplayers: JSON.stringify(players)});
});

router.post('/unirsala', function(req, res, next) {
	var username = req.body.username;
	console.log(username + ": unirsala");
	var sala = req.body.sala;

	let db = req.app.get('database');
	var salanotfound = false;

	let sql = db.prepare("select * from partidas where sala = ? and isActive = 1");
	let row = sql.get(sala);
	if(row == void(0)){ //if row == undefined
		salanotfound = true;
		res.json({idgame: "???", sala: 0, error: "La sala " + sala + " no está activa."});
	}else{
		var idgame = row.idgame;
		var sql4 = db.prepare("select * from playersensala where username = ? and idgame = ? and turno = 1");
		var row2 = sql4.get(username, idgame);
		if(row2 != void(0)){
			res.json({idgame: "????", sala: 0, numplayers: 0, error: "Ya hay alguien en la sala " + sala + " llamado " + username + "."})
			return;
		}

		let numplayers = row.numPlayers;
		if(numplayers >= 5){
			res.json({idgame: "????", sala: 0, numplayers: 0, error: "La sala está llena."});
			return;
		}
		if(row.ronda != 0){
			res.json({idgame: "????", sala: 0, numplayers: 0, error: "La partida ya está en curso."});
			return;
		}
		var sql2 = db.prepare("update partidas set numPlayers = ? where idgame = ?")
		var info = sql2.run(numplayers + 1, idgame);

		var sql3 = db.prepare('INSERT INTO playersensala(username, idgame, sala, numplayer, turno) VALUES(?,?,?,?,?)');
		var info = sql3.run(username, idgame, sala, numplayers + 1, 1);

		let sqlplayers = db.prepare('select * from playersensala where idgame = ? and turno = 1')
		let rows = sqlplayers.all(idgame);
		var players = [];
		rows.forEach(function(row){
			players.push(row.username);
		})

		res.json({idgame: idgame, sala: sala, numplayers: numplayers + 1, arrayplayers: JSON.stringify(players)});
	}
});

router.post('/waitstart', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	console.log(username + ": waitstart");

	let db = req.app.get('database');
	var salanotfound = false;

	let sql = db.prepare('select * from partidas where idgame = ?');
	let row = sql.get(idgame);
	if(row == void(0)){ //if row == undefined
		salanotfound = true;
		res.json({idgame: "???", sala: 0, start: "no"});
	}else{
		let numplayers = row.numPlayers;
		let sql2 = db.prepare('select * from playersensala where idgame = ? and turno = 1')
		let rows = sql2.all(idgame);
		var players = [];
		rows.forEach(function(row){
			players.push(row.username);
		})
		var start = "no";
		if(row.ronda == 1){
			start = "yes";
		}
		let sqlIsLeader = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = 1');
		let rowIsLeader = sqlIsLeader.get(idgame, username);
		res.json({idgame: row.idgame, sala: sala, start: start, numplayers: numplayers, arrayplayers: JSON.stringify(players), isLeader: rowIsLeader.isLeader});
	}
});

router.post('/startgame', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	console.log(username + ": startgame");

	let db = req.app.get('database');
	let sql = db.prepare('select * from partidas where idgame = ?');
	let row = sql.get(idgame);
	if(row == void(0)){ //if row == undefined
		res.json({idgame: "???", sala: 0, start: "no"});
	}else{
		let sqlupdatepartida = db.prepare('update partidas set ronda = 1, turno = 1 where idgame = ?');
		let info = sqlupdatepartida.run(idgame);

		let sqlplayers = db.prepare('select * from playersensala where idgame = ? and turno = 1')
		let rowsplayers = sqlplayers.all(idgame);
		var players = [];
		rowsplayers.forEach(function(row){
			players.push(row.username);
		})
		players = shuffle(players);

		var baraja = JSON.parse(row.baraja);
		var numcartas = 12 - row.numPlayers;
		for(let i = 0; i < players.length; i++){
			let sqlupdatepartida = db.prepare('update playersensala set numPlayer = ?, cartas = ?, hasPlayed = 0, cartasTablero = ?, cardPlayed = 0 where username = ? and idgame = ? and turno = 1');
			let info = sqlupdatepartida.run(i+1, JSON.stringify(baraja.slice(i*numcartas, (i+1)*numcartas)),JSON.stringify([]), players[i], idgame);
		}
		res.json({todook: 'joseluis'});
	}
});

router.post('/initgame', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	console.log(username + ": initgame");
	let db = req.app.get('database');
	let sql = db.prepare('select * from partidas where idgame = ?');
	var row = sql.get(idgame);
	if(row.ronda == 1 && row.turno == 1){
		let sqlplayers = db.prepare('select * from playersensala where idgame = ? and turno = 1');
		let rows = sqlplayers.all(idgame);
		var players = [];
		rows.forEach(function(row){
			players.push({username: row.username, num: row.numPlayer});
		});
	
		let sqlcartas = db.prepare('select * from playersensala where username = ? and idgame = ? and turno = 1');
		let rowcartas = sqlcartas.get(username, idgame);
		var cartas = JSON.parse(rowcartas.cartas);
		res.json({numplayers: row.numPlayers, arrayplayers: players, cartas: cartas, numplayer: rowcartas.numPlayer, turno: 1});
	}else{
		res.json({error: "no me hagas un initgame con la partida empezada, animal"});
	}
});

router.post('/playcard', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	var card = req.body.card;
	var turno = req.body.turno;
	var withWasabi = req.body.withWasabi;
	
	console.log(username + ": playcard (" + card + ")");
	let db = req.app.get('database');

	let sqlpartida = db.prepare('select * from partidas where idgame = ?');
	var infopartida = sqlpartida.get(idgame);

	let sql = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = ?');
	var row = sql.get(idgame, username, turno);
	if(row.hasPlayed == 0){
		var cartas = JSON.parse(row.cartas);
		var cartastablero = JSON.parse(row.cartasTablero);
		const index = cartas.indexOf(parseInt(card, 10));
		if (index > -1) {
			cartas.splice(index, 1);
			cartastablero.push(parseInt(card, 10));
			let sqlUpdateCartas = db.prepare('update playersensala set cartas = ?, hasPlayed = 1, cardPlayed = ?, cartasTablero = ? where idgame = ? and username = ? and turno = ?');
			let info = sqlUpdateCartas.run(JSON.stringify(cartas), card, JSON.stringify(cartastablero), idgame, username, turno);
			if(withWasabi == "yes" && card >= 68 && card <= 88){
				let sqlWasabi = db.prepare('insert into nigiriwasabi (idgame, username, ronda, nigiri) values (?,?,?,?)');
				let infoWasabi = sqlWasabi.run(idgame, username, infopartida.ronda, card);
			}
			res.json({status: "ok"});
		}else{
			res.json({status: "ERROR: La carta a jugar no está en tu mano."});
		}
	}else{
		res.json({status: "ok", msg: "ya jugaste boludo"});
	}
});

router.post('/waitturno', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	var turno = req.body.turno;
	
	console.log(username + ": waitturno");

	let db = req.app.get('database');

	let sqlgame = db.prepare('select * from partidas where idgame = ?');
	var row = sqlgame.get(idgame);
	var turno = row.turno;

	let sql = db.prepare('select * from playersensala where idgame = ? and hasPlayed = 1 and turno = ?');
	var rows = sql.all(idgame, turno);
	var playersFin = [];
	rows.forEach(function(row){
		playersFin.push(row.numPlayer);
	})

	let sqlFin = db.prepare('select * from playersensala where idgame = ? and hasPlayed = 0 and turno = ?');
	var rowsFin = sqlFin.all(idgame, turno);
	if(rowsFin.length == 0){
		res.json({playersFin: playersFin, endTurn: "yes"})
	}else{
		res.json({playersFin: playersFin, endTurn: "no"})
	}
});

router.post('/nextturno', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	var turno = req.body.turno;
	
	console.log(username + ": nextturno");

	let db = req.app.get('database');

	let sqlgame = db.prepare('select * from partidas where idgame = ?');
	var row = sqlgame.get(idgame);

	var nextTurno = parseInt(turno, 10) + 1;

	if(nextTurno > parseInt(row.turno, 10)){
		let sqlnextturno = db.prepare('update partidas set turno = ? where idgame = ?');
		let infonextturno = sqlnextturno.run(nextTurno, idgame);
	}

	let sqlsala = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = ?');
	var playersensala = sqlsala.get(idgame, username, turno);

	console.log("numPlayer: " + playersensala.numPlayer);
	var numPlayer = parseInt(playersensala.numPlayer, 10);
	var prevPlayer = numPlayer - 1;
	if(numPlayer == 1){
		prevPlayer = parseInt(row.numPlayers, 10);
	}
	console.log("prevPlayer: " + prevPlayer);

	let sqlsala2 = db.prepare('select * from playersensala where idgame = ? and numPlayer = ? and turno = ?');
	var playeranterior = sqlsala2.get(idgame, prevPlayer, turno);

	var cartas = JSON.parse(playeranterior.cartas);

	let sqlUpdateCartas = db.prepare('insert into playersensala (username, idgame, sala, numPlayer, isLeader, cartas, hasPlayed, cardPlayed, turno, cartasTablero) values (?,?,?,?,?,?,?,?,?,?)');
	let info = sqlUpdateCartas.run(username, idgame, sala, numPlayer, playersensala.isLeader, JSON.stringify(cartas), 0, playersensala.cardPlayed, nextTurno, JSON.stringify(JSON.parse(playersensala.cartasTablero)));


	let sqlsala3 = db.prepare('select * from playersensala where idgame = ? and turno = ?');
	var rows = sqlsala3.all(idgame, turno);

	if(rows.length == row.numPlayers){
		infoPlayers = [];
		for(let i = 0; i < rows.length; i++){
			let sqlwasabi = db.prepare('select * from nigiriwasabi where idgame = ? and username = ? and ronda = ? and nigiri = ?');
			let rowwasabi = sqlwasabi.get(idgame, rows[i].username, row.ronda, rows[i].cardPlayed);
			var withWasabi = "no";
			if(rowwasabi != void(0)){
				withWasabi = "yes";
			}
			infoPlayers.push({player: rows[i].numPlayer, cardPlayed: rows[i].cardPlayed, tablero: JSON.parse(rows[i].cartasTablero), withWasabi: withWasabi})
		}
		res.json({infoPlayers: infoPlayers, cartas: cartas, turno: nextTurno})
		
	}else{
		res.json({error:"rows.length distinto de row.numPlayers"});
	}
});

module.exports = router;
