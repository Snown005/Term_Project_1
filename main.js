const express = require('express');
const mysql = require('mysql2');
const hash = require('pbkdf2-password')();
const session = require('express-session');
const path = require('path');
const app = express();
const password =require('./info');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: password,  
  database: 'courseproject'
});

connection.connect((error) => {
  if (error) {
    console.error('Error connecting to MySQL database:', error);
  } else {
    console.log('Connected to MySQL database!');
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static('views')); 
app.use(express.urlencoded({ extended: false }));
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: 'hello, Ben',
  cookie: { 
    secure: false, 
    maxAge: 3600000 
  }
}));

let adminHash, adminSalt;
const ADMIN_PASSWORD = 'pinkLittleDogbarkingonElephantx0x0';
hash({ password: ADMIN_PASSWORD }, function (err, pass, salt, hash) {
  if (err) throw err;
  adminHash = hash;
  adminSalt = salt;
  console.log('Admin hash and salt generated');
});

app.post('/home/register', function (req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('register', { errorMessage: 'Username and password are required', Messag: null });
  }
  hash({ password: password }, function (err, pass, salt, hash) {
    if (err) return res.render('register', { errorMessage: 'Error generating hash', Messag: null });

    const query = 'INSERT INTO users(username, salt, hash, role) VALUES (?, ?, ?, "user")';
    connection.query(query, [username, salt, hash], (err, results) => {
      if (err) {
        console.error('Error executing query:', err); 
        return res.status(500).json({ error: 'Error saving user to the database', details: err.message });
      }
      
     
    });
  });
  req.session.regenerate(function (err) {
    if (err) {
      console.error('Error regenerating session:', err);
      return res.status(500).send('Internal Server Error');
    }
    req.session.user = { username, role: 'user' };
    req.session.username = username;
    req.session.save((err) => { 
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).send('Failed to save session');
      }
    return res.redirect('/home_user'); });
});
});

function authenticate(username, pass, fn) {
  if (username === 'admin') {
    return hash({ password: pass, salt: adminSalt }, function (err, pass, salt, hash) {
      if (err) return fn(err);
      if (hash === adminHash) return fn(null, { username: 'admin', role: 'admin' });
      return fn(null, null);
    });
  }
  const query = 'SELECT * FROM users WHERE username = ?';
  connection.query(query, [username], (err, results) => {
    if (err) return fn(err);
    if (!results.length) return fn(null, null);
    const user = results[0];
    hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
      if (err) return fn(err);
      if (hash === user.hash) return fn(null, user);
      fn(null, null);
    });
  });
}

app.post('/home/login', function (req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { errorMessage: 'Username and password are required', message: null });
  }
  authenticate(username, password, function (err, user) {
    if (err) {
      return res.render('login', { errorMessage: 'Internal server error', message: null });
    }
    if (user) {
      req.session.regenerate(function () {
        req.session.user = user;
        req.session.username = username;
        return res.redirect('/'); 
      });
    } else {
      return res.render('login', { errorMessage: 'Authentication failed, check your username and password', message: null });
    }
  });
});


app.get('/register', function (req, res) {
  res.render('register', { errorMessage: null , Messag: null });
});

app.get('/login', function (req, res) {
  res.render('login', { errorMessage: null, message:null });
});

app.post('/api/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.redirect('/login');  
  });
});

app.get('/logout', function(req,res){
  res.render('logout');
});

app.get('/home', function (req, res) {
  connection.query('SELECT * FROM kafedry', function (err, result) {
    if (err) throw err;
    res.render('kafedry', { kafedry: result, username: req.session.username});
  });
});

app.get('/home_user', function (req, res) {
  connection.query('SELECT * FROM kafedry', function (err, result) {
    if (err) throw err;
    res.render('kafedry_user', { kafedry: result, username: req.session.username });
  });
});

 
app.get('/departments/:id', (req, res) => { 
  if (req.session.user&&req.session.user.role !== 'user') {

 
    const departmentId = req.params.id;

    const departmentSql = 'SELECT kafedry FROM kafedry WHERE id = ?';
    connection.query(departmentSql, [departmentId], (err, departmentResults) => {
        if (err) throw err;

        const departmentName = departmentResults[0]?.kafedry || 'Невідома кафедра';

        const teachersSql = 'SELECT * FROM vykladachi_otit WHERE id_kafedry = ?';
        connection.query(teachersSql, [departmentId], (err, teacherResults) => {
            if (err) throw err;

            res.render('vykladachi_otit', { 
                departmentName: departmentName, 
                teachers: teacherResults 
            });
        });
    }); }
    else if(req.session.user&&req.session.user.role !== 'admin'){
      const departmentId = req.params.id;
  
      const departmentSql = 'SELECT kafedry FROM kafedry WHERE id = ?';
      connection.query(departmentSql, [departmentId], (err, departmentResults) => {
          if (err) throw err;
    
          const departmentName = departmentResults[0]?.kafedry || 'Невідома кафедра';
    
          const teachersSql = 'SELECT * FROM vykladachi_otit WHERE id_kafedry = ?';
          connection.query(teachersSql, [departmentId], (err, teacherResults) => {
              if (err) throw err;
    
              res.render('vykladachi_user', { 
                  departmentName: departmentName, 
                  teachers: teacherResults 
              });
          });
      });
    }
});
  
   
app.get('/departments/:id_', (req, res) => {
  if (req.session.user&&req.session.user.role !== 'user') {
    
      
  const departmentId = req.params.id;
  
  const departmentSql = 'SELECT kafedry FROM kafedry WHERE id = ?';
  connection.query(departmentSql, [departmentId], (err, departmentResults) => {
      if (err) throw err;

      const departmentName = departmentResults[0]?.kafedry || 'Невідома кафедра';

      const teachersSql = 'SELECT * FROM vykladachi_otit WHERE id_kafedry = ?';
      connection.query(teachersSql, [departmentId], (err, teacherResults) => {
          if (err) throw err;

          res.render('vykladachi_user', { 
              departmentName: departmentName, 
              teachers: teacherResults 
          });
      });
  });}
});
function checkAuthentication(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    return res.redirect('/login');
  }
}
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  } else {
    if (req.session.user.role === 'admin') {
      return res.redirect('/home');
    } else if (req.session.user.role === 'user') {
      return res.redirect('/home_user');
    }
  }
});


app.post('/update-amount', (req, res) => {
  const { id, amount } = req.body;

  const query = 'UPDATE vykladachi_otit SET Amount = ? WHERE id = ?';
  
  connection.query(query, [amount, id], (error, results) => {
    if (error) {
      return res.status(500).json({ success: false, message: 'Помилка бази даних' });
    }
    res.json({ success: true, message: 'Дані оновлено успішно' });
  });
});

app.post('/update-amount2', (req, res) => {
  const id = req.body.id;
  const username = req.session.user.username;

  const checkAmount = 'SELECT Amount FROM vykladachi_otit WHERE id = ?';
  connection.query(checkAmount, [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Помилка бази' });

    const amount = results[0]?.Amount;
    if (amount <= 0) {
      return res.json({ success: false, message: 'Немає доступних місць' });
    }

    
    const insertQuery = 'INSERT INTO students (student, idvykladachi) VALUES (?, ?)';
    connection.query(insertQuery, [username, id], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Помилка бази даних при додаванні студента' });

      
      const updateQuery = 'UPDATE vykladachi_otit SET Amount = Amount - 1 WHERE id = ?';
      connection.query(updateQuery, [id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Помилка бази при оновленні кількості місць' });

    
        res.json({ success: true, newAmount: amount - 1, message: 'Значення успішно оновлено' });
      });
    });
  });
});
app.post('/insertStudent', (req, res) => {
  const id = req.body.id;
  const username = req.body.username;
if(!username) return res.status(401).json({success:false, message: 'Введіть імя студента'});
  const checkAmount = 'SELECT Amount FROM vykladachi_otit WHERE id = ?';
  connection.query(checkAmount, [id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Помилка бази' });

    const amount = results[0]?.Amount;
    if (amount <= 0) {
      return res.json({ success: false, message: 'Немає доступних місць' });
    }

    const query = 'INSERT INTO students(student, idvykladachi) VALUES(?, ?)';
    connection.query(query, [username, id], (err, results) => {
      if (err) return res.status(500).json({ success: false, message: 'Помилка бази даних при додаванні студента' });

      const updateQuery = 'UPDATE vykladachi_otit SET Amount = Amount - 1 WHERE id = ?';
      connection.query(updateQuery, [id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Помилка бази при оновленні кількості місць' });

       
        res.json({ success: true, newAmount: amount - 1, message: 'Студента успішно додано та кількість місць оновлено' });
      });
    });
  });
});


app.listen(8080, function () {
  console.log('Server started on port 8080');
});
