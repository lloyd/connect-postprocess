const should = require('should'),
postprocess = require('..'),
express = require('express'),
path = require('path'),
http = require('http'),
fs = require('fs'),
buffertools = require('buffertools');

describe('postprocess', function() {
  var app = express.createServer();

  app.use(postprocess(function(req, buffer) {
    return buffer.replace(/foo/g, 'bar');
  }));

  // test that writing two strings subsequently is
  // handled by postprocess
  app.get('/write_strings', function(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    res.write('foo');
    res.write('foo');
    res.end();
  });

  app.get('/end_string', function(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    res.end('foofoo');
  });

  app.get('/end_buffer', function(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    res.end(new Buffer('foofoo'));
  });

  app.use(express.static(path.join(__dirname, "files")));

  var port;

  it('should bind an ephemeral port', function() {
    app.listen(0, '127.0.0.1', function() {
      port = app.address().port;
      (port).should.be.within(1024, 65535);
    });
  });

  // lil' helper for requests
  function get(path, cb) {
    http.get({ port: port, host: '127.0.0.1', path: path }, function(res) {
      var buf = new Buffer(0);
      res.on('data', function(d) { buf = buffertools.concat(buf, d); } );
      res.on('end', function() {
        cb(null, { res: res, data: buf.toString() });
      });
    }).on('error', function(e) {
      cb(e);
    });
  }

  it('should handle 404s', function(done) {
    get('/404.html', function(err, r) {
      should(err === null);
      (r.res.statusCode).should.equal(404);
      r.data.should.equal("Cannot GET /404.html");
      done();
    });
  });

  // now let's test all of the static files
  fs.readdirSync(path.join(__dirname, 'files')).forEach(function(f) {
    it('should substitute properly for ' + f, function(done) {
      get('/' + f, function(err, r) {
        should(err === null);
        var l = fs.readFileSync(path.join(__dirname, 'files', f))
                            .toString().replace(/foo/g, 'bar').length;
        r.data.length.should.equal(l);
        done();
      });
    });
  });

  it('should not interfere with the semantics of write()', function(done) {
    get('/write_strings', function(err, r) {
      should(err === null);
      r.data.should.equal('barbar');
      done();
    });
  });

  it('should not interfere with the semantics of end()', function(done) {
    get('/end_string', function(err, r) {
      should(err === null);
      r.data.should.equal('barbar');
    });
    
    get('/end_buffer', function (err,r) {
      should(err === null);
      r.data.should.equal('barbar');
      done();
    });
  });
});
