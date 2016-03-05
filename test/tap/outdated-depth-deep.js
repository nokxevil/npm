var common = require('../common-tap')
var path = require('path')
var test = require('tap').test
var rimraf = require('rimraf')
var mr = require('npm-registry-mock')
var pkg = path.resolve(__dirname, 'outdated-depth-deep')
var cache = path.resolve(pkg, 'cache')

var osenv = require('osenv')
var mkdirp = require('mkdirp')
var fs = require('fs')

var pj = JSON.stringify({
  'name': 'whatever',
  'description': 'yeah idk',
  'version': '1.2.3',
  'main': 'index.js',
  'dependencies': {
    'underscore': '1.3.1',
    'npm-test-peer-deps': '0.0.0'
  },
  'repository': 'git://github.com/luk-/whatever'
}, null, 2)

function cleanup () {
  process.chdir(osenv.tmpdir())
  rimraf.sync(pkg)
}

function setup () {
  mkdirp.sync(pkg)
  process.chdir(pkg)
  fs.writeFileSync(path.resolve(pkg, 'package.json'), pj)
}

test('setup', function (t) {
  cleanup()
  setup()
  t.end()
})

test('outdated depth deep (9999)', function (t) {
                          // wanted,            has,                latest
  var underscoreOutdated = ['underscore@1.3.1', 'underscore@1.3.1', 'underscore@1.5.1']
  var childPkg = path.resolve(pkg, 'node_modules', 'npm-test-peer-deps')

  var expected = [ [path.join(childPkg, 'node_modules', 'underscore')].concat(underscoreOutdated),
                   [path.join(pkg, 'node_modules', 'underscore')].concat(underscoreOutdated) ]

  var server
  mr({ port: common.port }, function (err, s) {
    if (err) throw err
    server = s
    thenInstallTestDir()
  })

  var npmArgs = ['--cache=' + cache, '--loglevel=silent', '--registry=' + common.registry, '--depth=9999']

  function thenInstallTestDir (s) {
    var opts = {stdio: [0, 1, 2], cwd: pkg}
    common.npm(npmArgs.concat(['install', '.']), opts, function (err, code) {
      if (err) throw err
      t.is(code, 0, 'install ok')
      thenInstallUnderscore()
    })
  }

  function thenInstallUnderscore () {
    var opts = {
      cwd: path.join(pkg, 'node_modules', 'npm-test-peer-deps'),
      stdio: [0, 1, 2]
    }
    common.npm(npmArgs.concat(['install', 'underscore']), opts, function (err, code) {
      if (err) throw err
      t.is(code, 0, 'explore & install ok')
      thenOutdated()
    })
  }

  function thenOutdated () {
    var opts = { stdio: [0, 'pipe', 2], cwd: pkg }
    common.npm(npmArgs.concat(['--parseable', 'outdated']), opts, function (err, code, stdout, stderr) {
      if (err) throw err
      t.is(code, 0, 'outdated ran ok')
      var result = stdout.trim().split(/\n/).map(function (line) { return line.split(/:/) })
      t.deepEqual(result, expected)
      server.close()
      t.end()
    })
  }
})

test('cleanup', function (t) {
  cleanup()
  t.end()
})
