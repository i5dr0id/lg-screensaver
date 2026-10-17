var STEP = 6;
var SVG = 'http://www.w3.org/2000/svg';

var MINUTES = { labelRadius: 178, tickRadius: 202, labelEvery: 1 };
var SECONDS = { labelRadius: 256, tickRadius: 286, labelEvery: 5 };
var OUTER_RADIUS = SECONDS.tickRadius + 22;
var WIDTH_REACH = 0.36;

var WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function $(selector) { return document.querySelector(selector); }
function pad(n) { return String(n).length < 2 ? '0' + n : '' + n; }

// A ring is: .ring (position, fade-in) > .spin (rotates) > ticks + labels.
// Each label sits at a fixed spot on .spin and holds an .upright wrapper that
// counter-rotates, so the text stays level while the ring turns.
function createRing(cfg, className) {
  var labelRadius = cfg.labelRadius;
  var tickRadius = cfg.tickRadius;
  var ring = document.createElement('div');
  ring.className = 'ring ' + className;
  var spin = document.createElement('div');
  spin.className = 'spin';

  var size = (tickRadius + 30) * 2;
  var svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'ticks');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', (-size / 2) + ' ' + (-size / 2) + ' ' + size + ' ' + size);
  svg.setAttribute('aria-hidden', 'true');
  spin.appendChild(svg);

  var labels = [];
  var uprights = [];
  for (var v = 0; v < 60; v++) {
    var major = v % 5 === 0;
    var line = document.createElementNS(SVG, 'line');
    line.setAttribute('x1', tickRadius);
    line.setAttribute('x2', tickRadius + (major ? 22 : 9));
    line.setAttribute('transform', 'rotate(' + (-v * STEP) + ')');
    if (major) line.setAttribute('class', 'major');
    svg.appendChild(line);

    if (v % cfg.labelEvery !== 0) continue;

    var angle = -v * STEP * Math.PI / 180;
    var label = document.createElement('span');
    label.className = 'label';
    label.style.transform = 'translate(' +
      (labelRadius * Math.cos(angle)).toFixed(2) + 'px, ' +
      (labelRadius * Math.sin(angle)).toFixed(2) + 'px)';
    label.style.opacity = major ? 1 : 0;
    var upright = document.createElement('span');
    upright.className = 'upright';
    var text = document.createElement('span');
    text.textContent = pad(v);
    upright.appendChild(text);
    label.appendChild(upright);
    spin.appendChild(label);
    labels[v] = label;
    uprights[v] = upright;
  }

  ring.appendChild(spin);
  return { el: ring, spin: spin, labels: labels, uprights: uprights };
}

function isShown(v, active) {
  var distance = Math.min(Math.abs(v - active), 60 - Math.abs(v - active));
  return v === active || (v % 5 === 0 && distance >= 3);
}

function monthCells(date) {
  var year = date.getFullYear();
  var month = date.getMonth();
  var lead = (new Date(year, month, 1).getDay() + 6) % 7;
  var days = new Date(year, month + 1, 0).getDate();
  var cells = [];
  for (var i = 0; i < lead; i++) cells.push(null);
  for (var d = 1; d <= days; d++) cells.push(d);
  return cells;
}

function dayOfYear(date) {
  var start = new Date(date.getFullYear(), 0, 1);
  var today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((today - start) / 864e5) + 1;
}

function daysInYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

// --- Set up ------------------------------------------------------------------

var minutes = createRing(MINUTES, 'minutes');
var seconds = createRing(SECONDS, 'seconds');
$('.rings').appendChild(minutes.el);
$('.rings').appendChild(seconds.el);

var dial = $('.dial');
function fit() {
  var s = Math.max(innerHeight / 2, innerWidth * WIDTH_REACH) / OUTER_RADIUS;
  dial.style.webkitTransform = 'scale(' + s + ')';
  dial.style.transform = 'scale(' + s + ')';
}
fit();
window.addEventListener('resize', fit);

var loaded = Date.now();
var startMinutes = Math.floor(loaded / 60000) - new Date(loaded).getMinutes();

// --- Seconds: a CSS animation on the compositor -------------------------------
// The sweep is a 60s linear rotation. A negative animation-delay starts it at
// the current second, so no JavaScript runs per frame.

function syncSweep() {
  seconds.el.className = 'ring seconds';
  void seconds.el.offsetWidth;
  seconds.el.style.setProperty('--sweep-delay', (-(Date.now() % 60000) / 1000) + 's');
  seconds.el.className = 'ring seconds sweeping';
}

// How far (in degrees) the running sweep is from the wall clock.
function sweepDrift() {
  var m = getComputedStyle(seconds.spin).transform;
  if (!m || m === 'none') return 360;
  var p = m.slice(m.indexOf('(') + 1, -1).split(',');
  var angle = Math.atan2(parseFloat(p[1]), parseFloat(p[0])) * 180 / Math.PI;
  var expected = (Date.now() % 60000) / 60000 * 360;
  var diff = ((angle - expected) % 360 + 540) % 360 - 180;
  return Math.abs(diff);
}

syncSweep();
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) syncSweep();
});

// --- Minutes: one transition per change, only on labels you can see ----------

var shownMinute = -1;
var shownDate = '';

function turnMinutes(turn, active, previous) {
  minutes.spin.style.transform = 'rotate(' + turn + 'deg)';
  var counter = 'rotate(' + (-turn) + 'deg)';

  for (var v = 0; v < 60; v++) {
    var shown = isShown(v, active);
    var wasShown = previous >= 0 && isShown(v, previous);
    // Hidden labels jump straight to their new angle; only visible ones animate.
    minutes.uprights[v].className = shown || wasShown ? 'upright moving' : 'upright';
    minutes.uprights[v].style.transform = counter;
    minutes.labels[v].className = v === active ? 'label active' : 'label';
    minutes.labels[v].style.opacity = shown ? 1 : 0;
  }
}

// --- Everything else: once a second ------------------------------------------

function tick() {
  var now = new Date();
  var minute = now.getMinutes();

  if (minute !== shownMinute) {
    var turn = (Math.floor(now.getTime() / 60000) - startMinutes) * STEP;
    turnMinutes(turn, minute, shownMinute);
    $('.hour').textContent = pad(now.getHours());

    var dayProgress = (now.getHours() * 60 + minute) / 1440;
    $('[data-progress="day"]').style.transform = 'scaleX(' + dayProgress + ')';
    $('[data-label="day"]').textContent = Math.round(dayProgress * 100) + '%';

    if (shownMinute >= 0 && sweepDrift() > 1) syncSweep();
    shownMinute = minute;
  }

  var dateKey = now.toDateString();
  if (dateKey !== shownDate) {
    renderDate(now);
    shownDate = dateKey;
  }

  setTimeout(tick, 1000 - now.getMilliseconds());
}

function renderDate(now) {
  var monthName = now.toLocaleDateString('en-GB', { month: 'long' });
  $('.weekday').textContent = now.toLocaleDateString('en-GB', { weekday: 'long' });
  $('.full-date').textContent = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  $('.calendar-title').textContent = monthName.toUpperCase();

  var grid = $('.calendar-grid');
  grid.innerHTML = '';

  for (var w = 0; w < WEEKDAYS.length; w++) {
    var hd = document.createElement('span');
    hd.className = 'calendar-head';
    hd.textContent = WEEKDAYS[w];
    grid.appendChild(hd);
  }

  var cells = monthCells(now);
  for (var c = 0; c < cells.length; c++) {
    var cell = document.createElement('span');
    cell.textContent = cells[c] !== null ? cells[c] : '';
    if (cells[c] === now.getDate()) cell.className = 'today';
    grid.appendChild(cell);
  }

  var total = daysInYear(now.getFullYear());
  var today = dayOfYear(now);
  $('[data-progress="year"]').style.transform = 'scaleX(' + (today / total) + ')';
  $('[data-label="year"]').textContent = today + '/' + total;
}

tick();
