var http = require('http'),
    path = require('path'),
    os = require('os'),
    url = require('url'),
    fs = require('fs'),
    IsThere = require("is-there");

var Busboy = require('busboy');

var tokenFile = 'tokens.json';
var tokens = loadTokens(tokenFile);

fs.watchFile(tokenFile, function(curr, prev) {
  console.log("Reloading tokens");
  tokens = loadTokens(tokenFile);
});

http.createServer(function(req, res) {
  var tokenString = url.parse(req.url, true).query.token;
  var token = tokens[tokenString];
  if(isValidToken(token)) {
    if (req.method === 'POST') {
      handleUpload(req, res, token, function() {
        if(!token.forever) {
          deprecateToken(tokenString);
        }
      });
    } else {
      showUpload(req, res);
    }
  } else {
    res.writeHead(403);
    res.end('Nope.');
  }
}).listen(8000, function() {
  console.log('Listening for requests');
});

function isValidToken(token) {
  if(!token) {
    return false;
  } else if(token.used) {
    return false;
  } else if(token.expire && new Date(token.expire) < Date.now()) {
    return false;
  }
  return true;
}

function loadTokens(filename) {
  return JSON.parse(fs.readFileSync(filename));
}

function saveTokens(filename, tokens) {
  var content = JSON.stringify(tokens, null, 2);
  fs.writeFile(filename, content, function(err) {
    if(err) console.log(err);
  });
}

function deprecateToken(token) {
  tokens[token].used = true;
  saveTokens(tokenFile, tokens);
}

function handleUpload(req, res, token, onSuccess) {
  var busboy = new Busboy({ headers: req.headers });
  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    var saveTo = generatePath(token.path, filename);
    if(saveTo === null) {
      console.log("Invalid path!");
    } else {
      console.log("Saving file:", saveTo);
      file.pipe(fs.createWriteStream(saveTo));
    }
  });
  busboy.on('finish', function() {
    res.writeHead(200, { 'Connection': 'close' });
    res.end("File uploaded successfully!");
    onSuccess();
  });
  return req.pipe(busboy);
}

function showUpload(req, res) {
  res.writeHead(200, { Connection: 'close' });
  res.end('<html><head></head><body>\
      <form method="POST" enctype="multipart/form-data">\
      <input type="file" name="upload"><br />\
      <input type="submit" value="Upload">\
      </form>\
      </body></html>');
}

function generatePath(requestedPath, filename) {
  var savePath = requestedPath || os.tmpDir();
  var pathStats = fs.statSync(savePath);
  if(!pathStats.isDirectory()) {
    return null;
  } 

  var filePath = path.join(savePath, path.basename(filename));
  var ok = false;
  var n = 0;
  while(!ok) {
    if(IsThere(filePath)) {
      n += 1;
      filePath = path.join(savePath, path.basename(filename) + "-" + n);
    } else {
      ok = true;
    }
  }

  return filePath;
}
