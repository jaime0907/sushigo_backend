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

	var sql2 = db.prepare('INSERT INTO playersensala(username, idgame, sala, numPlayer, isLeader, turno, ronda) VALUES(?,?,?,?,?,?,?)');
	var info = sql2.run(username, idgame, sala, 1, 1, 0, 0);

	let sql3 = db.prepare('select * from playersensala where idgame = ? and turno = 0 and ronda = 0')
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
		var sql4 = db.prepare("select * from playersensala where username = ? and idgame = ? and turno = 0 and ronda = 0");
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

		var sql3 = db.prepare('INSERT INTO playersensala(username, idgame, sala, numplayer, turno, ronda) VALUES(?,?,?,?,?,?)');
		var info = sql3.run(username, idgame, sala, numplayers + 1, 0, 0);

		let sqlplayers = db.prepare('select * from playersensala where idgame = ? and turno = 0 and ronda = 0')
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
		let sql2 = db.prepare('select * from playersensala where idgame = ? and turno = 0 and ronda = 0')
		let rows = sql2.all(idgame);
		var players = [];
		rows.forEach(function(row){
			players.push(row.username);
		})
		var start = "no";
		if(row.ronda == 1){
			start = "yes";
		}
		let sqlIsLeader = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = 0 and ronda = 0');
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

		let sqlplayers = db.prepare('select * from playersensala where idgame = ? and turno = 0 and ronda = 0')
		let rowsplayers = sqlplayers.all(idgame);
		var players = [];
		rowsplayers.forEach(function(row){
			players.push(row.username);
		})
		players = shuffle(players);

		var baraja = JSON.parse(row.baraja);
		var numcartas = 12 - row.numPlayers;
		for(let i = 0; i < players.length; i++){

			let cartas = baraja.slice(i*numcartas, (i+1)*numcartas);
			
			let sqlinfoplayer = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = 0 and ronda = 0');
			let infoplayer = sqlinfoplayer.get(idgame, players[i]);

			let sqlupdatepartida = db.prepare('insert into playersensala (numPlayer, cartas, hasPlayed, cartasTablero, cardPlayed, username, idgame, turno, ronda, sala, isLeader) values (?,?,?,?,?,?,?,?,?,?,?)');
			let info = sqlupdatepartida.run(i+1, JSON.stringify(cartas), 0, JSON.stringify([]), 0, players[i], idgame, 1, 1, sala, infoplayer.isLeader);
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
		let sqlplayers = db.prepare('select * from playersensala where idgame = ? and turno = 1 and ronda = 1');
		let rows = sqlplayers.all(idgame);
		var players = [];
		rows.forEach(function(row){
			players.push({username: row.username, num: row.numPlayer});
		});
	
		let sqlcartas = db.prepare('select * from playersensala where username = ? and idgame = ? and turno = 1 and ronda = 1');
		let rowcartas = sqlcartas.get(username, idgame);
		var cartas = JSON.parse(rowcartas.cartas);
		res.json({numplayers: row.numPlayers, arrayplayers: players, cartas: cartas, numplayer: rowcartas.numPlayer, turno: 1, ronda: row.ronda});
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
	var ronda = req.body.ronda;
	var withWasabi = req.body.withWasabi;
	var withPalillos = req.body.withPalillos;
	
	console.log(username + ": playcard (" + card + ")");
	let db = req.app.get('database');

	let sqlpartida = db.prepare('select * from partidas where idgame = ?');
	var infopartida = sqlpartida.get(idgame);

	let sql = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = ? and ronda = ?');
	var row = sql.get(idgame, username, turno, ronda);
	if(row.hasPlayed == 0){
		if(withPalillos == "yes"){
			let segundacarta = req.body.segundacarta;
			let palillos = req.body.palillos;
			let withWasabiSegunda = req.body.withWasabiSegunda;

			//meto la segunda carta en caso de haber 2 (al coger palillos)
			let cartas2 = JSON.parse(row.cartas);
			let cartastablero2 = JSON.parse(row.cartasTablero);
			const index2 = cartas2.indexOf(parseInt(segundacarta, 10));
			if (index2 > -1) {
				cartas2.splice(index2, 1);
				cartastablero2.push(parseInt(segundacarta, 10));

				var withWasabiSegundaInt = 0;
				if(withWasabiSegunda == "yes" && segundacarta >= 68 && segundacarta <= 88){
					withWasabiSegundaInt = 1;
				}

				let sqlUpdateCartas = db.prepare('update playersensala set cartas = ?, cartasTablero = ?, withPalillos = 1, segundacarta = ?, withWasabiSegunda = ? where idgame = ? and username = ? and turno = ? and ronda = ?');
				let info = sqlUpdateCartas.run(JSON.stringify(cartas2), JSON.stringify(cartastablero2), segundacarta, withWasabiSegundaInt, idgame, username, turno, ronda);

				if(withWasabiSegunda == "yes" && segundacarta >= 68 && segundacarta <= 88){
					let sqlWasabi = db.prepare('insert into nigiriwasabi (idgame, username, ronda, nigiri) values (?,?,?,?)');
					let infoWasabi = sqlWasabi.run(idgame, username, ronda, segundacarta);
				}
			}else{
				res.json({status: "ERROR: La carta a jugar no está en tu mano."});
			}

			//quito los palillos
			let sql2 = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = ? and ronda = ?');
			var row2 = sql2.get(idgame, username, turno, ronda);
			let cartas = JSON.parse(row2.cartas);
			let cartastablero = JSON.parse(row2.cartasTablero);
			const index = cartastablero.indexOf(parseInt(palillos, 10));
			if (index > -1) {
				cartastablero.splice(index, 1);
				cartas.push(parseInt(palillos, 10));
				let sqlUpdateCartas = db.prepare('update playersensala set cartas = ?, cartasTablero = ? where idgame = ? and username = ? and turno = ? and ronda = ?');
				let info = sqlUpdateCartas.run(JSON.stringify(cartas), JSON.stringify(cartastablero), idgame, username, turno, ronda);
			}else{
				res.json({status: "ERROR: Los palillos no están en tu tablero."});
			}
		}

		let sql3 = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = ? and ronda = ?');
		row = sql3.get(idgame, username, turno, ronda);
		let cartas = JSON.parse(row.cartas);
		let cartastablero = JSON.parse(row.cartasTablero);
		const index = cartas.indexOf(parseInt(card, 10));
		if (index > -1) {
			cartas.splice(index, 1);
			cartastablero.push(parseInt(card, 10));
			var withWasabiInt = 0;
			if(withWasabi == "yes"){
				withWasabiInt = 1;
			}
			let sqlUpdateCartas = db.prepare('update playersensala set cartas = ?, hasPlayed = 1, cardPlayed = ?, cartasTablero = ?, withWasabi = ? where idgame = ? and username = ? and turno = ? and ronda = ?');
			let info = sqlUpdateCartas.run(JSON.stringify(cartas), card, JSON.stringify(cartastablero), withWasabiInt, idgame, username, turno, ronda);
			if(withWasabi == "yes" && card >= 68 && card <= 88){
				let sqlWasabi = db.prepare('insert into nigiriwasabi (idgame, username, ronda, nigiri) values (?,?,?,?)');
				let infoWasabi = sqlWasabi.run(idgame, username, ronda, card);
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
	var ronda = req.body.ronda;
	
	console.log(username + ": waitturno");

	let db = req.app.get('database');

	let sqlgame = db.prepare('select * from partidas where idgame = ?');
	var row = sqlgame.get(idgame);

	let sql = db.prepare('select * from playersensala where idgame = ? and hasPlayed = 1 and turno = ? and ronda = ?');
	var rows = sql.all(idgame, turno, ronda);
	var playersFin = [];
	rows.forEach(function(row){
		playersFin.push({numPlayer: row.numPlayer, withPalillos: row.withPalillos});
	})

	let sqlFin = db.prepare('select * from playersensala where idgame = ? and hasPlayed = 0 and turno = ? and ronda = ?');
	var rowsFin = sqlFin.all(idgame, turno, ronda);
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
	var ronda = req.body.ronda;
	
	console.log(username + ": nextturno");

	let db = req.app.get('database');

	let sqlgame = db.prepare('select * from partidas where idgame = ?');
	var row = sqlgame.get(idgame);

	var numPlayers = parseInt(row.numPlayers, 10);
	var maxTurns = 12 - numPlayers;

	var nextTurno = parseInt(turno, 10) + 1;

	var endRonda = false;
	if(nextTurno > maxTurns){
		endRonda = true;
	}

	if(nextTurno > parseInt(row.turno, 10) && !endRonda){
		let sqlnextturno = db.prepare('update partidas set turno = ? where idgame = ?');
		let infonextturno = sqlnextturno.run(nextTurno, idgame);
		row = sqlgame.get(idgame);
	}

	var cartas = []

	if(!endRonda){
		let sqlsala = db.prepare('select * from playersensala where idgame = ? and username = ? and turno = ? and ronda = ?');
		var playersensala = sqlsala.get(idgame, username, turno, ronda);

		console.log("numPlayer: " + playersensala.numPlayer);
		var numPlayer = parseInt(playersensala.numPlayer, 10);
		var prevPlayer = numPlayer - 1;
		if(numPlayer == 1){
			prevPlayer = parseInt(row.numPlayers, 10);
		}
		console.log("prevPlayer: " + prevPlayer);

		let sqlsala2 = db.prepare('select * from playersensala where idgame = ? and numPlayer = ? and turno = ? and ronda = ?');
		var playeranterior = sqlsala2.get(idgame, prevPlayer, turno, ronda);

		cartas = JSON.parse(playeranterior.cartas);

		let sqlUpdateCartas = db.prepare('insert into playersensala (username, idgame, sala, numPlayer, isLeader, cartas, hasPlayed, cardPlayed, turno, ronda, cartasTablero) values (?,?,?,?,?,?,?,?,?,?,?)');
		let info = sqlUpdateCartas.run(username, idgame, sala, numPlayer, playersensala.isLeader, JSON.stringify(cartas), 0, playersensala.cardPlayed, nextTurno, ronda, JSON.stringify(JSON.parse(playersensala.cartasTablero)));
	}

	let sqlsala3 = db.prepare('select * from playersensala where idgame = ? and turno = ? and ronda = ?');
	var rows = sqlsala3.all(idgame, turno, ronda);

	if(rows.length == row.numPlayers){
		infoPlayers = [];
		for(let i = 0; i < rows.length; i++){
			infoPlayers.push({player: rows[i].numPlayer, cardPlayed: rows[i].cardPlayed, tablero: JSON.parse(rows[i].cartasTablero), withWasabi: rows[i].withWasabi, withPalillos: rows[i].withPalillos, segundacarta: rows[i].segundacarta, withWasabiSegunda: rows[i].withWasabiSegunda})
		}

		endRondaText = "no";
		if(endRonda){
			endRondaText = "yes";
		}

		res.json({infoPlayers: infoPlayers, cartas: cartas, turno: row.turno, endRonda: endRondaText, ronda: row.ronda})
		
	}else{
		res.json({error:"rows.length distinto de row.numPlayers"});
	}
});

router.post('/resultsronda', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	var turnoStr = req.body.turno;
	var ronda = parseInt(req.body.ronda,10);
	
	var turno = parseInt(turnoStr, 10);

	console.log(username + ": resultsronda");

	let db = req.app.get('database');

	let sqlgame = db.prepare('select * from partidas where idgame = ?');
	var row = sqlgame.get(idgame);

	let sqlsala = db.prepare('select * from playersensala where idgame = ? and turno = ? and ronda = ?');
	var rows = sqlsala.all(idgame, turno, ronda);

	if(rows.length == row.numPlayers){
		var infoPlayers = [];
		var makis = [];

		for(let i = 0; i < rows.length; i++){
			tablero = JSON.parse(rows[i].cartasTablero);
			var tempura = 0;
			var sashimi = 0;
			var gyoza = 0;
			var maki = 0;
			var nigiri = 0;
			var pudin = 0;
			for(let j = 0; j < tablero.length; j++){
				let carta = tablero[j];
				if(carta > 0 && carta <= 14){
					tempura++;
				}else if(carta <= 28){
					sashimi++;
				}else if(carta <= 42){
					gyoza++;
				}else if(carta <= 48){
					maki++
				}else if(carta <= 60){
					maki = maki + 2;
				}else if(carta <= 68){
					maki = maki + 3;
				}else if(carta <= 88){
					let sqlnigiri = db.prepare('select * from nigiriwasabi where idgame = ? and username = ? and ronda = ? and nigiri = ?');
					let rownigiri = sqlnigiri.get(idgame, rows[i].username, ronda, carta);
					let wasabi = 1;
					if(rownigiri != void(0)){
						wasabi = 3;
					}
					if(carta <= 73){
						nigiri = nigiri + 1*wasabi;
					}else if(carta <= 83){
						nigiri = nigiri + 2*wasabi;
					}else if(carta <= 88){
						nigiri = nigiri + 3*wasabi;
					}
				}else if(carta <= 98){
					pudin++;
				}
			}
			var puntosGyoza = 0;
			switch(gyoza){
				case 0:
					puntosGyoza = 0;
					break;
				case 1:
					puntosGyoza = 1;
					break;
				case 2:
					puntosGyoza = 3;
					break;
				case 3:
					puntosGyoza = 6;
					break;
				case 4:
					puntosGyoza = 10;
					break;
				default:
					puntosGyoza = 15;
					break;
			}
			makis.push({player: rows[i].numPlayer, maki: maki})
			var puntos = Math.floor(tempura / 2)*5 + Math.floor(sashimi / 3)*10 + puntosGyoza + nigiri;
			infoPlayers.push({player: rows[i].numPlayer, puntos: puntos, puntoslist: [], username: rows[i].username, tempura: tempura, sashimi: sashimi, gyoza: gyoza, puntosGyoza: puntosGyoza, maki: maki, nigiri: nigiri, pudin:pudin, pudinpuntos: 0, ganador: "no"})
		}

		//Calculo los makis
		var primeroMakis = {lista: [], maki: 0};
		var segundoMakis = {lista: [], maki: 0};
		for(let i = 0; i < makis.length; i++){
			var makiTemp = makis[i].maki;
			var numPlayerTemp = makis[i].player;

			if(makiTemp == 0){
				continue;
			}

			if(makiTemp > primeroMakis.maki){
				segundoMakis.lista = primeroMakis.lista;
				segundoMakis.maki = primeroMakis.maki;

				primeroMakis.lista = []
				primeroMakis.lista.push(numPlayerTemp);
				primeroMakis.maki = makiTemp;
				console.log("primeroMakis: " + numPlayerTemp);
				console.log("segundoMakis: " + segundoMakis.lista);

			}else if(makiTemp == primeroMakis.maki){
				primeroMakis.lista.push(numPlayerTemp);
				

			}else if(makiTemp > segundoMakis.maki){
				segundoMakis.lista = [];
				segundoMakis.lista.push(numPlayerTemp);
				segundoMakis.maki = makiTemp;
			}else if(makiTemp == segundoMakis.maki){
				segundoMakis.lista.push(numPlayerTemp);
			}
			
		}
		
		//Añado los makis a la puntuacion
		for(let i = 0; i < infoPlayers.length; i++){
			infoPlayers[i].arrayMakiPrimero = primeroMakis.lista;
			infoPlayers[i].arrayMakiSegundo = segundoMakis.lista;
			infoPlayers[i].arrayMakiPrimeroValor = primeroMakis.maki;
			infoPlayers[i].arrayMakiSegundoValor = segundoMakis.maki;
			let infoplayer = infoPlayers[i];
			let indexPrimero = primeroMakis.lista.indexOf(infoplayer.player);
			if(indexPrimero >= 0){
				infoPlayers[i].puntos += Math.floor(6 / primeroMakis.lista.length);
				infoPlayers[i].puntosMaki = Math.floor(6 / primeroMakis.lista.length);
				infoPlayers[i].posMaki = "Primero";
			}

			let indexSegundo = segundoMakis.lista.indexOf(infoplayer.player);
			if(indexSegundo >= 0 && primeroMakis.lista.length == 1){
				infoPlayers[i].puntos += Math.floor(3 / segundoMakis.lista.length);
				infoPlayers[i].puntosMaki = Math.floor(3 / segundoMakis.lista.length);
				infoPlayers[i].posMaki = "Segundo";
			}
		}

		let sqlpuntos = db.prepare('select * from puntos where idgame = ? and ronda = ?');
		let infopuntos = sqlpuntos.all(idgame, ronda);

		if(infopuntos.length == 0){
			for(let i = 0; i < infoPlayers.length; i++){
				let sqlinsertpuntos = db.prepare('insert into puntos (idgame, numPlayer, username, ronda, puntos, pudin, isReady) values (?,?,?,?,?,?,?)');
				let infoinsertpuntos = sqlinsertpuntos.run(idgame, rows[i].numPlayer, rows[i].username, ronda, infoPlayers[i].puntos, infoPlayers[i].pudin, 0);
			}
		}

		for(let i = 0; i < infoPlayers.length; i++){ 
			let sqlpuntosall = db.prepare('select * from puntos where idgame = ? and username = ?');
			let infopuntos = sqlpuntosall.all(idgame, infoPlayers[i].username);

			var pudin = 0;
			var total = 0;
			for(let j = 0; j < infopuntos.length; j++){
				pudin += infopuntos[j].pudin;
				infoPlayers[i].puntoslist.push({ronda: infopuntos[j].ronda, puntos: infopuntos[j].puntos});
				total += infopuntos[j].puntos;
			}
			if(ronda == 3){
				infoPlayers[i].pudin = pudin;
				infoPlayers[i].totalpuntos = total;
			}
		}

		//Pudines
		if(ronda == 3){
			var todosPudinIgual = true;
			var lastPudin = -1;
			var primeroPudin = {lista: [], pudin: 1};
			var ultimoPudin = {lista: [], pudin: 100};
			for(let i = 0; i < infoPlayers.length; i++){
				var pudinTemp = infoPlayers[i].pudin;
				var numPlayerTemp = infoPlayers[i].player;

				if(pudinTemp > primeroPudin.pudin){
					primeroPudin.lista = [];
					primeroPudin.lista.push(numPlayerTemp);
					primeroPudin.pudin = pudinTemp;
				}else if(pudinTemp == primeroPudin.pudin){
					primeroPudin.lista.push(numPlayerTemp);
				}

				if(pudinTemp < ultimoPudin.pudin){
					ultimoPudin.lista = [];
					ultimoPudin.lista.push(numPlayerTemp);
					ultimoPudin.pudin = pudinTemp;
				}else if(pudinTemp == ultimoPudin.pudin){
					ultimoPudin.lista.push(numPlayerTemp);
				}

				if(lastPudin == -1){
					lastPudin = pudinTemp;
				}else{
					if(lastPudin != pudinTemp && todosPudinIgual){
						todosPudinIgual = false;
					}
				}
			}

			if(!todosPudinIgual){
				for(let i = 0; i < primeroPudin.lista.length; i++){
					for(let j = 0; j < infoPlayers.length; j++){
						if(infoPlayers[j].player == primeroPudin.lista[i]){
							infoPlayers[j].totalpuntos += Math.floor(6 / primeroPudin.lista.length);
							infoPlayers[j].pudinpuntos = Math.floor(6 / primeroPudin.lista.length);
						}
					}
				}
	
				if(infoPlayers.length > 2){
					for(let i = 0; i < ultimoPudin.lista.length; i++){
						for(let j = 0; j < infoPlayers.length; j++){
							if(infoPlayers[j].player == ultimoPudin.lista[i]){
								infoPlayers[j].totalpuntos -= Math.floor(6 / ultimoPudin.lista.length);
								infoPlayers[j].pudinpuntos = 0 - Math.floor(6 / ultimoPudin.lista.length);
							}
						}
					}
				}
			}
			
		}
		var hayTie = "no";
		//Ganador
		if(ronda == 3){
			var primero = {lista: [], puntos: 0};
			

			for(let i = 0; i < infoPlayers.length; i++){
				var pudinTemp = infoPlayers[i].pudin;
				var puntosTemp = infoPlayers[i].totalpuntos;
				var numPlayerTemp = infoPlayers[i].player;

				if(puntosTemp > primero.puntos){
					primero.lista = [];
					primero.lista.push({numPlayer: numPlayerTemp, pudin: pudinTemp});
					primero.puntos = puntosTemp;
				}else if(puntosTemp == primero.puntos){
					primero.lista.push({numPlayer: numPlayerTemp, pudin: pudinTemp});
				}

			}

			if(primero.lista.length == 1){
				for(let i = 0; i < infoPlayers.length; i++){
					if(infoPlayers[i].player == primero.lista[0].numPlayer){
						infoPlayers[i].ganador = "yes";
					}
				}
			}else{
				var primeroPudin = {lista: [], pudin: 0};
				for(let i = 0; i < primero.lista.length; i++){
					var pudinTemp = primero.lista[i].pudin;
					var numPlayerTemp = primero.lista[i].numPlayer;

					if(pudinTemp > primeroPudin.pudin){
						primeroPudin.lista = [];
						primeroPudin.lista.push(numPlayerTemp);
						primeroPudin.pudin = pudinTemp;
					}else if(pudinTemp == primeroPudin.pudin){
						primeroPudin.lista.push(numPlayerTemp);
					}
				}
				if(primeroPudin.lista.length == 1){
					for(let i = 0; i < infoPlayers.length; i++){
						if(infoPlayers[i].player == primeroPudin.lista[0]){
							infoPlayers[i].ganador = "yes";
						}
					}
				}else{
					hayTie = "yes";
					for(let i = 0; i < infoPlayers.length; i++){
						for(let j = 0; j < primeroPudin.lista.length; j++){
							if(infoPlayers[i].player == primeroPudin.lista[j]){
								infoPlayers[i].ganador = "tie";
							}
						}
					}
				}
			}
		}
		

		res.json({infoPlayers: infoPlayers, hayTie: hayTie})
		
	}else{
		res.json({error:"rows.length distinto de row.numPlayers"});
	}
});

router.post('/waitnextronda', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	var ronda = parseInt(req.body.ronda,10);
	var isReadyStr = req.body.isReady;

	console.log(username + ": waitnextronda");

	let db = req.app.get('database');

	let sqlgame = db.prepare('select * from partidas where idgame = ?');
	var infogame = sqlgame.get(idgame);

	let sqlpuntosplayer = db.prepare('select * from puntos where idgame = ? and username = ? and ronda = ?');
	let infopuntosplayer = sqlpuntosplayer.get(idgame, username, ronda);

	if(infopuntosplayer.isReady == 0 && isReadyStr == "yes"){
		let sqlupdatepuntosplayer = db.prepare('update puntos set isReady = 1 where idgame = ? and username = ? and ronda = ?');
		let infoupdatepuntosplayer = sqlupdatepuntosplayer.run(idgame, username, ronda);
	}

	let sqlpuntos = db.prepare('select * from puntos where idgame = ? and ronda = ?');
	let infopuntos = sqlpuntos.all(idgame, ronda);

	playersready = [];
	for(let i = 0; i < infopuntos.length; i++){
		if(infopuntos[i].isReady == 1){
			playersready.push(infopuntos[i].numPlayer);
		}
	}

	var allReady = "no";
	if(playersready.length == infopuntos.length){
		allReady = "yes";
	}

	res.json({playersready: playersready, allReady: allReady})
});

router.post('/nextronda', function(req, res, next) {
	var username = req.body.username;
	var idgame = req.body.idgame;
	var sala = req.body.sala;
	var turno = parseInt(req.body.turno, 10);
	var ronda = parseInt(req.body.ronda, 10);

	var nextRonda = ronda + 1;
	var nextTurno = 1;

	console.log(username + ": nextronda");

	let db = req.app.get('database');
	let sql = db.prepare('select * from partidas where idgame = ?');
	let row = sql.get(idgame);
	if(row.ronda == ronda){ //solo hacer cambios si eres el primero en hacer nextronda
		
		let sqlupdatepartida = db.prepare('update partidas set ronda = ?, turno = 1 where idgame = ?');
		let info = sqlupdatepartida.run(nextRonda, idgame);

		let sqlplayers = db.prepare('select * from playersensala where idgame = ? and turno = ? and ronda = ?')
		let rowsplayers = sqlplayers.all(idgame, turno, ronda);

		var baraja = JSON.parse(row.baraja);
		var numcartas = 12 - row.numPlayers;
		for(let i = 0; i < rowsplayers.length; i++){
			let cartas = baraja.slice(i*numcartas + row.numPlayers*numcartas*(nextRonda-1), (i+1)*numcartas + row.numPlayers*numcartas*(nextRonda-1));
		
			let sqlupdatepartida = db.prepare('insert into playersensala (numPlayer, cartas, hasPlayed, cartasTablero, cardPlayed, username, idgame, turno, ronda, sala, isLeader) values (?,?,?,?,?,?,?,?,?,?,?)');
			let info = sqlupdatepartida.run(rowsplayers[i].numPlayer, JSON.stringify(cartas), 0, JSON.stringify([]), 0, rowsplayers[i].username, idgame, 1, nextRonda, sala, rowsplayers[i].isLeader);
		}
	}

	let sqlplayer = db.prepare('select * from playersensala where idgame = ? and turno = ? and ronda = ? and username = ?')
	let infoplayer = sqlplayer.get(idgame, nextTurno, nextRonda, username);

	res.json({cartas: JSON.parse(infoplayer.cartas), turno: nextTurno, ronda: nextRonda})

});

module.exports = router;
