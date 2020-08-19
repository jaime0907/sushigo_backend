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

    var idgame = idGenerator();

    var salavalida = false;
    var sala = 0;
    while(!salavalida){
        sala = salaGenerator();
        let sql = db.prepare("select * from partidas where sala = ?");
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

    var sql = db.prepare('INSERT INTO partidas VALUES(?,?,?,?,?,?,?)');
    var info = sql.run(idgame, sala, 1, currentTimeUNIX, JSON.stringify(baraja), 0, 0);
    console.log(info.changes);

    var sql2 = db.prepare('INSERT INTO playersensala(username, sala, numPlayer) VALUES(?,?,?)');
    var info = sql2.run(username, sala, 1);
    console.log(info.changes);

    res.json({idgame: idgame, sala: sala, numplayers: 1});
});

router.post('/unirsala', function(req, res, next) {
  
    console.log(req.body);
    var username = req.body.username;
    var sala = req.body.sala;

    let db = req.app.get('database');
    var salanotfound = false;

    let sql = db.prepare("select * from partidas where sala = ?");
    let row = sql.get(sala);
    if(row == void(0)){ //if row == undefined
        salanotfound = true;
        res.json({idgame: "???", sala: 0, error: "La sala " + sala + " no está activa."});
    }else{
        var sql4 = db.prepare("select * from playersensala where username = ? and sala = ?");
        var row2 = sql4.get(username, sala);
        if(row2 != void(0)){
            res.json({idgame: "????", sala: 0, numplayers: 0, error: "Ya hay alguien en la sala " + sala + " llamado " + username + "."})
            return;
        }

        let numplayers = row.numPlayers;
        var sql2 = db.prepare("update partidas set numPlayers = ? where id = ?")
        var info = sql2.run(numplayers + 1, row.id);
        console.log(info.changes);

        var sql3 = db.prepare('INSERT INTO playersensala(username, sala, numplayer) VALUES(?,?,?)');
        var info = sql3.run(username, sala, numplayers + 1);
        console.log(info.changes);

        res.json({idgame: row.id, sala: sala, numplayers: numplayers + 1});
    }
});

router.post('/waitstart', function(req, res, next) {
  
    console.log(req.body);
    var username = req.body.username;
    var sala = req.body.sala;

    let db = req.app.get('database');
    var salanotfound = false;

    let sql = db.prepare('select * from partidas where sala = ?');
    let row = sql.get(sala);
    if(row == void(0)){ //if row == undefined
        salanotfound = true;
        res.json({idgame: "???", sala: 0, start: "no"});
    }else{
        let numplayers = row.numPlayers;
        let sql2 = db.prepare('select * from playersensala where sala = ?')
        let rows = sql2.all(sala);
        var players = [];
        rows.forEach(function(row){
            players.push(row.username);
        })
        var start = "no";
        if(row.ronda == 1){
            start = "yes";
        }
        res.json({idgame: row.id, sala: sala, start: start, numplayers: numplayers, arrayplayers: JSON.stringify(players)});
    }
});

module.exports = router;
