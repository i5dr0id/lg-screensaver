var exec = require("child_process").exec;

var APP = "com.custom.screensaver";
var POLL = 3000;

var TARGETS = [
  "com.webos.app.screensaver",
  "com.webos.app.inputcommon"
];

var replaced = false;

function launch() {
  exec('luna-send-pub -n 1 luna://com.webos.applicationManager/launch \'{"id":"' + APP + '"}\'', function () {
    console.log(new Date().toLocaleString() + " - Screensaver app launched");
    replaced = true;
  });
}

function check() {
  exec("ps aux", function (err, out) {
    if (!out) return;

    var appRunning = out.indexOf(APP) !== -1;

    for (var i = 0; i < TARGETS.length; i++) {
      if (out.indexOf(TARGETS[i]) !== -1) {
        if (!replaced) {
          console.log(new Date().toLocaleString() + " - Detected: " + TARGETS[i] + ", replacing...");
          launch();
        }
        return;
      }
    }

    if (replaced && !appRunning) {
      replaced = false;
    }
  });
}

setInterval(check, POLL);
console.log("Screensaver watcher started (polling every " + (POLL / 1000) + "s)");
console.log("Watching for: " + TARGETS.join(", "));
