
const express = require('express'); //Web server framework
const cors = require('cors');       //CORS for Flutter access
const mysql = require('mysql2');    //MySQL connection
require('dotenv').config();         //for use .env settings

//.env ayarlarıyla MySQL bağlantısı. Bağlantı kesilirse uygulama kapanır
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'qr_security'
});

connection.connect(err => {
  if (err) {
    console.error('MySQL bağlantı hatası:', err);
    process.exit(1);
  }
  console.log('✅ MySQL’e bağlanıldı.');
});


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'OK' }));

//API Endpoint (register)
app.post('/register', (req, res) => {
  const { name, tc, password } = req.body;
  if (!name || !tc || !password) {
    return res.status(400).json({ error: 'Please fill all fields.' });
  }
  const sql = 'INSERT INTO users (name, tc, password) VALUES (?, ?, ?)';
  connection.query(sql, [name, tc, password], (err, results) => {
    if (err) {
      console.error('/register error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'This TC number is already registered.' });
      }
      return res.status(500).json({ error: 'Database error', detail: err.message }); //bağlantı sırasında hata olursa ekrana yaz
    }
    res.json({ id: results.insertId });
  });
});

//API Endpoint (login)
app.post('/login', (req, res) => {
  const { tc, password } = req.body;
  if (!tc || !password) {
    return res.status(400).json({ error: 'Please enter TC and Password.' });
  }
  const sql = 'SELECT id, name, tc, role FROM users WHERE tc = ? AND password = ?';
  connection.query(sql, [tc, password], (err, results) => {
    if (err) {
      console.error('/login error:', err);
      return res.status(500).json({ error: 'Server error', detail: err.message });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const user = results[0];
    if (user.role === 'admin') {
      return res.json({
        id: user.id,
        name: user.name,
        tc: user.tc,
        role: user.role,
        message: "Welcome – Application’s Admin"
      });
    }
    res.json({
      id: user.id,
      name: user.name,
      tc: user.tc,
      role: user.role
    });
  });
});

//visit formu flutterdan alıp mysqle gönder
app.post('/visit_form', (req, res) => {
  const { role, reason, entryTime } = req.body;
  if (!role || !reason || !entryTime) {
    return res.status(400).json({ error: 'Please provide role, reason and entryTime.' });
  }
  const sql = `
    INSERT INTO visit_forms (role, reason, entry_time)
    VALUES (?, ?, ?)
  `;
  connection.query(sql, [role, reason, entryTime], (err, results) => {
    if (err) {
      console.error('/visit_form error:', err);
      return res.status(500).json({ error: 'Database error', detail: err.message });
    }
    res.json({
      visitId: results.insertId,
      message: 'Visit form saved successfully.'
    });
  });
});

//contact usı mysqle gönder
app.post('/contact_us', (req, res) => {
  const { tc, message } = req.body;
  if (!tc || !message) {
    return res.status(400).json({ error: 'tc ve message gerekli' });
  }
  const sql = 'INSERT INTO contact_messages (tc, message) VALUES (?, ?)';
  connection.query(sql, [tc, message], (err, results) => {
    if (err) {
      console.error('/contact_us error:', err);
      return res.status(500).json({ error: 'Veritabanı hatası', detail: err.message });
    }
    res.json({ status: 'success', id: results.insertId });
  });
});

//admin kullanıcıları listelesin mysqlden veriyi al
app.get('/admin/users', (req, res) => {
  const sql = 'SELECT id, name, tc, role FROM users';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('/admin/users error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

//admin visit form verilerini listelemsi için mysqlden verileri al
app.get('/admin/visit_forms', (req, res) => {
  const sql = 'SELECT id, role, reason, entry_time FROM visit_forms';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('/admin/visit_forms error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

//admin contact us tablosunu listelemesi için mysqlden verileri al
app.get('/admin/contact_us', (req, res) => {
  const sql = `
    SELECT id, tc, message, created_at
      FROM contact_messages
     ORDER BY created_at DESC
  `;
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('/admin/contact_us error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

//adminin giriş çıkış kaydını mysqle gönder
app.post('/admin/records', (req, res) => {
  const { name, entryTime, exitTime } = req.body;
  if (!name || !entryTime || !exitTime) {
    return res.status(400).json({ error: 'Please provide name, entryTime, exitTime.' });
  }
  const sql = `
    INSERT INTO attendance_records (name, entry_time, exit_time)
    VALUES (?, ?, ?)
  `;
  connection.query(sql, [name, entryTime, exitTime], (err, result) => {
    if (err) {
      console.error('/admin/records POST error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: result.insertId });
  });
});

//uygulama değerlendirme verilerini mysqle gönder
app.post('/rate_app', (req, res) => {
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Geçerli bir puan girin (1-5).' });
  }

  const sql = 'INSERT INTO app_ratings (rating) VALUES (?)';
  connection.query(sql, [rating], (err, result) => {
    if (err) {
      console.error('/rate_app error:', err);
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }
    res.json({ success: true, id: result.insertId });
  });
});

//notifyları mysqle gönder
app.post('/admin_notify', (req, res) => {
  const { tc, message } = req.body;
  if (!tc || !message) {
    return res.status(400).json({ error: 'TC ve mesaj gerekli.' });
  }

  const sql = 'INSERT INTO notifications (tc, message) VALUES (?, ?)';
  connection.query(sql, [tc, message], (err, result) => {
    if (err) {
      console.error('/admin_notify error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: result.insertId });
  });
});

//notifyları mysqlden alıp admin listelemesi için
app.get('/notifications/:tc', (req, res) => {
  const { tc } = req.params;
  const sql = `
    SELECT id, message, created_at
      FROM notifications
     WHERE tc = ?
     ORDER BY created_at DESC
  `;
  connection.query(sql, [tc], (err, results) => {
    if (err) {
      console.error('/notifications/:tc error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});



app.listen(PORT, () => {
  console.log(`🚀 API dinleniyor: http://localhost:${PORT}`);
});
