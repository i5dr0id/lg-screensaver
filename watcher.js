var exec = require("child_process").exec;

var APP = "com.custom.screensaver";
var POLL = 3000;

var TARGETS = [
  "com.webos.app.screensaver",
  "com.webos.app.inputcommon"
];

function getForegroundApp(cb) {
  exec('luna-send-pub -n 1 luna://com.webos.applicationManager/getForegroundAppInfo \'{}\'', function (err, out) {
    if (err || !out) return cb(null);
    try {
      var m = out.match(/"appId"\s*:\s*"([^"]+)"/);
      cb(m ? m[1] : null);
    } catch (e) { cb(null); }
  });
}

function launch() {
  exec('luna-send-pub -n 1 luna://com.webos.applicationManager/launch \'{"id":"' + APP + '"}\'', function () {
    console.log(new Date().toLocaleString() + " - Screensaver app launched");
  });
}

function check() {
  getForegroundApp(function (fg) {
    if (!fg) return;
    for (var i = 0; i < TARGETS.length; i++) {
      if (fg === TARGETS[i]) {
        console.log(new Date().toLocaleString() + " - Detected: " + fg + ", replacing...");
        launch();
        return;
      }
    }
  });
}

setInterval(check, POLL);
console.log("Screensaver watcher started (polling every " + (POLL / 1000) + "s)");
console.log("Watching for: " + TARGETS.join(", "));
