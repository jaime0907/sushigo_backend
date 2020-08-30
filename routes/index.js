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
  
	console.log(req.body);
	var username = req.body.username;

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
		console.log("idgamevalido: " + idgamevalido);
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
		console.log("Salavalida: " + salavalida);
	}
	
	var currentTimeUNIX = Math.round(new Date().getTime()/1000);

	var baraja = []
	for(let i = 0; i < 108; i++){
		baraja.push(i+1);
	}
	shuffle(baraja);

	var sql = db.prepare('INSERT INTO partidas VALUES(?,?,?,?,?,?,?,?)');
	var info = sql.run(idgame, sala, 1, currentTimeUNIX, JSON.stringify(baraja), 0, 0, 1);
	console.log(info.changes);

	var sql2 = db.prepare('INSERT INTO playersensala(username, idgame, sala, numPlayer, isLeader, turno) VALUES(?,?,?,?,?,?)');
	var info = sql2.run(username, idgame, sala, 1, 1, 1);
	console.log(info.changes);

	let sql3 = db.prepare('select * from playersensala where idgame = ?')
	let rows = sql3.all(idgame);
	var players = [];
	rows.forEach(function(row){
		players.push(row.username);
	})

	res.json({idgame: idgame, sala: sala, numplayers: 1, arrayplayers: JSON.stringify(players)});
});

router.post('/unirsala', function(req, res, next) {
  
	console.log(req.body);
	var username = req.body.username;
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
		var sql4 = db.prepare("select * from playersensala where username = ? and idgame = ?");
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
		console.log(info.changes);

		var sql3 = db.prepare('INSERT INTO playersensala(username, idgame, sala, numplayer, turno) VALUES(?,?,?,?,?)');
		var info = sql3.run(username, idgame, sala, numplayers + 1, 1);
		console.log(info.changes);

		let sqlplayers = db.prepare('select * from playersensala where idgame = ?')
		let rows = sqlplayers.all(idgame);
		var players = [];
		rows.forEach(function(row){
			players.push(row.username);
		})

		res.json({idgame: idgame, sala: sala, numplayers: numplayers + 1, arrayplayers: JSON.stringify(players)});
	}
});

router.post('/waitstart', function(req, res, next) {
  
	console.log(req.body);
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;

	let db = req.app.get('database');
	var salanotfound = false;

	let sql = db.prepare('select * from partidas where idgame = ?');
	let row = sql.get(idgame);
	if(row == void(0)){ //if row == undefined
		salanotfound = true;
		res.json({idgame: "???", sala: 0, start: "no"});
	}else{
		let numplayers = row.numPlayers;
		let sql2 = db.prepare('select * from playersensala where idgame = ?')
		let rows = sql2.all(idgame);
		var players = [];
		rows.forEach(function(row){
			players.push(row.username);
		})
		var start = "no";
		if(row.ronda == 1){
			start = "yes";
		}
		let sqlIsLeader = db.prepare('select * from playersensala where idgame = ? and username = ?');
		let rowIsLeader = sqlIsLeader.get(idgame, username);
		res.json({idgame: row.idgame, sala: sala, start: start, numplayers: numplayers, arrayplayers: JSON.stringify(players), isLeader: rowIsLeader.isLeader});
	}
});

router.post('/startgame', function(req, res, next) {
	console.log(req.body);
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;

	let db = req.app.get('database');
	let sql = db.prepare('select * from partidas where idgame = ?');
	let row = sql.get(idgame);
	if(row == void(0)){ //if row == undefined
		res.json({idgame: "???", sala: 0, start: "no"});
	}else{
		let sqlupdatepartida = db.prepare('update partidas set ronda = 1, turno = 1 where idgame = ?');
		let info = sqlupdatepartida.run(idgame);
		console.log(info.changes);

		let sqlplayers = db.prepare('select * from playersensala where idgame = ?')
		let rowsplayers = sqlplayers.all(idgame);
		var players = [];
		rowsplayers.forEach(function(row){
			players.push(row.username);
		})
		console.log("antes: " + players);
		players = shuffle(players);
		console.log("despues: " + players);
		for(let i = 0; i < players.length; i++){
			let sqlupdatepartida = db.prepare('update playersensala set numPlayer = ? where username = ? and idgame = ?');
			let info = sqlupdatepartida.run(i+1, players[i], idgame);
			console.log(info.changes);
		}
		res.json({todook: 'joseluis'});
	}
});

router.post('/initgame', function(req, res, next) {
	console.log(req.body);
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	let db = req.app.get('database');
	let sql = db.prepare('select * from partidas where idgame = ?');
	var row = sql.get(idgame);
	if(row.ronda == 1 && row.turno == 1){
		let sqlplayers = db.prepare('select * from playersensala where idgame = ?');
		let rows = sqlplayers.all(idgame);
		var players = [];
		rows.forEach(function(row){
			players.push({username: row.username, num: row.numPlayer});
		});
	
		var baraja = JSON.parse(row.baraja);
		var numcartas = 12 - row.numPlayers;
		for(let i = 0; i < row.numPlayers; i++){
			let sqlupdatecartas = db.prepare('update playersensala set cartas = ?, hasPlayed = 0, cartasTablero = ?, cardPlayed = 0 where numPlayer = ? and idgame = ?');
			let info = sqlupdatecartas.run(JSON.stringify(baraja.slice(i*numcartas, (i+1)*numcartas)),JSON.stringify([]),  i+1, idgame);
			console.log(info.changes);
		}
	
		let sqlcartas = db.prepare('select * from playersensala where username = ? and idgame = ?');
		let rowcartas = sqlcartas.get(username, idgame);
		var cartas = JSON.parse(rowcartas.cartas);
		res.json({numplayers: row.numPlayers, arrayplayers: players, cartas: cartas, numplayer: rowcartas.numPlayer});
	}else{
		res.json({error: "no me hagas un initgame con la partida empezada, animal"});
	}
});

router.post('/playcard', function(req, res, next) {
	console.log(req.body);
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	var card = req.body.card;
	let db = req.app.get('database');
	let sql = db.prepare('select * from playersensala where idgame = ? and username = ?');
	var row = sql.get(idgame, username);
	if(row.hasPlayed == 0){
		var cartas = JSON.parse(row.cartas);
		var cartastablero = JSON.parse(row.cartasTablero);
		console.log("Card: " + card);
		console.log("cartas: " + cartas);
		const index = cartas.indexOf(parseInt(card, 10));
		console.log("index: " + index);
		if (index > -1) {
			cartas.splice(index, 1);
			cartastablero.push(parseInt(card, 10));
			let sqlUpdateCartas = db.prepare('update playersensala set cartas = ?, hasPlayed = 1, cardPlayed = ?, cartasTablero = ? where idgame = ? and username = ?');
			let info = sqlUpdateCartas.run(JSON.stringify(cartas), card, JSON.stringify(cartastablero), idgame, username);
			console.log(info.changes);
			res.json({status: "ok"});
		}else{
			res.json({status: "ERROR: La carta a jugar no está en tu mano."});
		}
	}else{
		res.json({status: "ok", msg: "ya jugaste boludo"});
	}
});

router.post('/waitturno', function(req, res, next) {
	console.log(req.body);
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;

	let db = req.app.get('database');

	let sqlgame = db.prepare('select * from partidas where idgame = ?');
	var row = sqlgame.get(idgame);
	var turno = row.turno;

	let sql = db.prepare('select * from playersensala where idgame = ? and hasPlayed = 1');
	var rows = sql.all(idgame);
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
	console.log(req.body);
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;

	let db = req.app.get('database');

	let sqlgame = db.prepare('select * from partidas where idgame = ?');
	var row = sqlgame.get(idgame);
	var turno = row.turno;
	turno++;

	let sql = db.prepare('select * from playersensala where idgame = ? order by numPlayer');
	var rows = sql.all(idgame);
	if(rows.length == row.numPlayers && rows[0].hasPlayed == 1){
		cartas = [];
		infoPlayers = [];
		for(let i = 0; i < rows.length; i++){
			let nextPlayer = i + 1;
			if (nextPlayer == rows.length){
				nextPlayer = 0;
			}
			cartas[nextPlayer] = JSON.parse(rows[i].cartas);
			let sqlupdatecartas = db.prepare('update playersensala set cartas = ?, hasPlayed = 0, turno = ? where idgame = ? and numPlayer = ?');
			let info = sqlupdatecartas.run(JSON.stringify(cartas[nextPlayer]), turno, idgame, nextPlayer + 1);

			infoPlayers.push({player: i+1, cardPlayed: rows[i].cardPlayed, tablero: JSON.parse(rows[i].cartasTablero)})
		}

		let sqlcartasplayer = db.prepare('select * from playersensala where idgame = ? and username = ?');
		var rowcartas = sqlcartasplayer.get(idgame, username);

		let sqlupdateturno = db.prepare('update partidas set turno = ? where idgame = ?');
		let info = sqlupdateturno.run(turno, idgame);

		var cartasPlayer = JSON.parse(rowcartas.cartas);
		res.json({infoPlayers: infoPlayers, cartas: cartasPlayer})
	}else{
		res.json({error:"rows.length distinto de row.numPlayers"});
	}
});

module.exports = router;
