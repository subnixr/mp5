// Runs before p5/p5.sound. On the first addModule call for each AudioWorklet
// context, injects a tiny shim into the worklet scope that makes
// registerProcessor idempotent. Subsequent p5 instances re-run worklet module
// code (same content, new blob URL) but the shim silently swallows duplicate
// registerProcessor calls instead of throwing "already registered".
(function () {
  var shimCode =
    'var _reg = globalThis.registerProcessor.bind(globalThis);' +
    'var _seen = new Set();' +
    'globalThis.registerProcessor = function (name, cls) {' +
    '  if (_seen.has(name)) return;' +
    '  _seen.add(name);' +
    '  if (name === "amplitude-processor") {' +
    '    var _origProcess = cls.prototype.process;' +
    '    cls.prototype.process = function (inputs, outputs, params) {' +
    '      if (!inputs[0]) return true;' +
    '      return _origProcess.call(this, inputs, outputs, params);' +
    '    };' +
    '  }' +
    '  try { _reg(name, cls); } catch (e) {}' +
    '};';

  var shimBlob = new Blob([shimCode], { type: 'application/javascript' });
  var SHIM_URL = URL.createObjectURL(shimBlob);

  var _addModule = AudioWorklet.prototype.addModule;
  var _shimmed = new WeakMap();

  // Every call waits for the shim: p5.sound adds its modules in parallel, and
  // one registered before the shim exists would be unknown to it.
  AudioWorklet.prototype.addModule = function (url, options) {
    var self = this;
    if (!_shimmed.has(self)) {
      _shimmed.set(self, _addModule.call(self, SHIM_URL));
    }
    return _shimmed.get(self).then(function () {
      return _addModule.call(self, url, options);
    });
  };
})();
